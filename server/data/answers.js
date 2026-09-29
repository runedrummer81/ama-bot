import fs from "node:fs/promises";

// ============================================================
//  PROFIL — ret din fødselsdato her (format: ÅÅÅÅ-MM-DD).
//  Alderen i svarene regnes ud fra den, så den altid er rigtig.
// ============================================================
const BIRTH_DATE = "1998-02-18";

// Spørgsmål vi foreslår i fallback og "hvad kan du?". Alle skal ramme en kategori.
const SUGGESTIONS = [
  "Hvor længe har Rune spillet trommer?",
  "Hvad er Runes yndlingsband?",
  "Spiller Rune i et band?",
  "Hvad er Runes livret?",
  "Hvor gammel er Rune?",
  "Hvad studerer Rune?",
  "Hvordan virker du?",
  "Fortæl om Rune",
];

// Korte opfølgninger uden eget emne. Bruges kun, hvis ingen kategori matcher.
const FOLLOW_UPS = [
  "og du",
  "og dig",
  "hvad med dig",
  "og hvad med dig",
  "hvorfor",
  "hvorfor det",
  "hvorfor egentlig",
  "fortæl mere",
  "fortæl mig mere",
  "mere",
  "uddyb",
  "uddyb det",
  "hvad ellers",
  "og så",
  "hvordan så",
];

// Er beskeden en kort "fortæl mere"-besked? Enten en af de faste sætninger,
// eller en kort besked (højst 7 ord) med et af disse ord, fx
// "kan du fortælle mig mere?" eller "hvad mere kan du sige om det?".
const FOLLOW_UP_WORDS = [
  "mere",
  "flere",
  "uddyb",
  "uddybe",
  "videre",
  "detaljer",
];

function isFollowUp(normalizedQuestion) {
  if (FOLLOW_UPS.includes(normalizedQuestion)) return true;
  const words = normalizedQuestion.split(" ");
  return (
    words.length <= 7 && words.some((word) => FOLLOW_UP_WORDS.includes(word))
  );
}

// ---------- Dynamiske dele ----------

export function calculateAge(birthDate = BIRTH_DATE, today = new Date()) {
  const [year, month, day] = birthDate.split("-").map(Number);
  let age = today.getFullYear() - year;
  const hasHadBirthdayThisYear =
    today.getMonth() + 1 > month ||
    (today.getMonth() + 1 === month && today.getDate() >= day);
  if (!hasHadBirthdayThisYear) age--;
  return age;
}

// Klokkeslæt i Danmark, uanset hvor serveren kører.
function getDanishTime(now = new Date()) {
  const parts = new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Europe/Copenhagen",
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour").value);
  const minute = parts.find((p) => p.type === "minute").value;
  return { hour, text: `${String(hour).padStart(2, "0")}:${minute}` };
}

function getGreeting(now = new Date()) {
  const { hour } = getDanishTime(now);
  if (hour >= 5 && hour < 10) return "Godmorgen";
  if (hour >= 10 && hour < 18) return "Goddag";
  if (hour >= 18 && hour < 23) return "Godaften";
  return "Godnat";
}

function getSuggestions(count = 3) {
  const shuffled = [...SUGGESTIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).join(" · ");
}

// Erstatter {alder}, {hilsen}, {tid} og {forslag} i et svar.
function fillTokens(text) {
  return text
    .replaceAll("{alder}", String(calculateAge()))
    .replaceAll("{hilsen}", getGreeting())
    .replaceAll("{tid}", getDanishTime().text)
    .replaceAll("{forslag}", getSuggestions());
}

// ---------- Normalisering og regex-matching ----------

// Små bogstaver, uden tegnsætning, æøå bevares, ét mellemrum mellem ord.
function normalizeQuestion(question) {
  return question
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// \b virker ikke med æøå, så vi laver vores egen ordgrænse:
// "ikke lige før/efter et bogstav eller tal" (lookbehind + lookahead).
const WORD_CHAR = "[\\p{L}\\p{N}]";
const regexCache = new Map();

// "hobby*" -> matcher hobby, hobbyer, hobbyerne (men ikke "hobbit")
// "hvor bor" -> matcher præcis de to ord efter hinanden
function keywordToRegex(keyword) {
  if (!regexCache.has(keyword)) {
    const pattern = keyword
      .normalize("NFC")
      .toLowerCase()
      .trim()
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&") // escape regex-tegn (undtagen *)
      .replace(/\*/g, `${WORD_CHAR}*`) // * = "resten af ordet"
      .replace(/\s+/g, "\\s+");
    regexCache.set(
      keyword,
      new RegExp(`(?<!${WORD_CHAR})${pattern}(?!${WORD_CHAR})`, "u"),
    );
  }
  return regexCache.get(keyword);
}

// Point for ét keyword (0 = ingen træffer).
// "længe + trommer*" er et OG-keyword: begge dele skal stå i spørgsmålet,
// i vilkårlig rækkefølge. Point = antal ord i alle delene.
function scoreKeyword(keyword, normalizedQuestion) {
  // "=hvad kan du" matcher kun, hvis HELE spørgsmålet er præcis det.
  // Så vinder "hvad kan du fortælle om musik" ikke som en generel "hvad kan du".
  if (keyword.startsWith("=")) {
    const exact = keyword.slice(1);
    return normalizedQuestion === exact ? exact.split(" ").length : 0;
  }

  const parts = keyword.split(" + ");
  const allMatch = parts.every((part) =>
    keywordToRegex(part).test(normalizedQuestion),
  );
  if (!allMatch) return 0;
  return parts.join(" ").trim().split(/\s+/).length;
}

function scoreKeywords(keywords = [], normalizedQuestion) {
  let score = 0;
  for (const keyword of keywords) {
    score += scoreKeyword(keyword, normalizedQuestion);
  }
  return score;
}

// Point for en hel kategori.
// - keywords tæller altid.
// - contextKeywords tæller kun, hvis sidste svar hører til "follows"
//   (enten via emnet, "topic", eller den præcise kategori).
//   Det er dem, der gør korte spørgsmål som "hvor længe?" forståelige.
function scoreGroup(group, normalizedQuestion, lastCategory, lastTopic) {
  let score = scoreKeywords(group.keywords, normalizedQuestion);

  // "follows" kan pege på et emne (topic) eller på en helt bestemt kategori.
  const isInContext =
    group.follows?.includes(lastTopic) || group.follows?.includes(lastCategory);
  if (isInContext) {
    const contextScore = scoreKeywords(
      group.contextKeywords,
      normalizedQuestion,
    );
    if (contextScore > 0) score += contextScore + 1; // +1: kontekst vinder uafgjort
  }
  return score;
}

// ---------- Vælg variant ----------

// Vælger en tilfældig variant, som ikke er brugt endnu i denne chat.
// Er alle brugt, starter vi forfra (men aldrig samme som sidst).
function pickVariant(pool, usedIndexes = []) {
  const all = pool.map((_, index) => index);
  let candidates = all.filter((index) => !usedIndexes.includes(index));
  if (candidates.length === 0) {
    const last = usedIndexes.at(-1);
    candidates = all.filter((index) => index !== last);
  }
  if (candidates.length === 0) candidates = all;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// pool: "answers" (normal), "repeat" (spurgt om før) eller "more" (opfølgning)
// "more" gives i rækkefølge (1., 2., 3. ...), de andre tilfældigt.
function buildAnswer(group, pool, context) {
  const usedKey = `${group.category}:${pool}`;
  const used = context.usedVariants?.[usedKey] ?? [];
  const variants = group[pool];
  const variant = pool === "more" ? used.length : pickVariant(variants, used);

  let answer = fillTokens(variants[variant]);
  // Første gang et emne besvares, guider vi videre med et hint om,
  // hvad man kan spørge om næste gang (så man undgår blindgyder).
  if (pool === "answers" && group.hint) {
    answer += " " + fillTokens(group.hint);
  }

  return {
    answer,
    category: group.category,
    pool,
    variant,
    matched: group.category !== "fallback",
  };
}

// ---------- Filhåndtering ----------

export async function loadAnswers() {
  try {
    const data = await fs.readFile("./data/answers.json", "utf8");
    return JSON.parse(data);
  } catch (error) {
    throw new Error(
      "Kunne ikke hente svarmuligheder. data/answers.json mangler eller er ugyldig",
    );
  }
}

export async function saveAnswers(answers) {
  const json = JSON.stringify(answers, null, 2);
  await fs.writeFile("./data/answers.json", json);
}

// ---------- Hovedfunktionen ----------

// context (alle dele er valgfrie):
//   lastCategory  — kategorien i botten seneste svar
//   usedVariants  — { "kategori:pool": [brugte index] }
export function findBestAnswer(question, answers, context = {}) {
  const normalizedQuestion = normalizeQuestion(question);
  const byCategory = (name) => answers.find((group) => group.category === name);

  // Sidste svars emne: fx er både "band-svartsot" og "festivaler" emnet "musik".
  const lastTopic =
    byCategory(context.lastCategory)?.topic ?? context.lastCategory;

  // 1) Find kategorien med flest point. Uafgjort -> den første i answers.json.
  let bestGroup = null;
  let bestScore = 0;
  for (const group of answers) {
    const score = scoreGroup(
      group,
      normalizedQuestion,
      context.lastCategory,
      lastTopic,
    );
    if (score > bestScore) {
      bestScore = score;
      bestGroup = group;
    }
  }

  // 2) Ingen træffere, men en kort opfølgning ("mere", "og du?") ->
  //    byg videre på sidste emne, så længe der er mere at sige.
  if (!bestGroup && isFollowUp(normalizedQuestion)) {
    const lastGroup = byCategory(context.lastCategory);
    const usedMore =
      context.usedVariants?.[`${context.lastCategory}:more`] ?? [];
    if (lastGroup?.more && usedMore.length < lastGroup.more.length) {
      return buildAnswer(lastGroup, "more", context);
    }
    // Ingen emne at bygge videre på? Så spørger vi, hvad man vil vide mere om.
    const category = context.lastCategory
      ? "opfoelgning"
      : "opfoelgning-uden-emne";
    return buildAnswer(byCategory(category), "answers", context);
  }

  // 3) Ingen træffere -> pæn fallback med forslag.
  if (!bestGroup) {
    return buildAnswer(byCategory("fallback"), "answers", context);
  }

  // 4) Er kategorien spurgt om før i denne chat, brug "igen"-varianterne.
  const askedBefore = Object.keys(context.usedVariants ?? {}).some((key) =>
    key.startsWith(`${bestGroup.category}:`),
  );
  const pool = askedBefore && bestGroup.repeat?.length ? "repeat" : "answers";
  return buildAnswer(bestGroup, pool, context);
}

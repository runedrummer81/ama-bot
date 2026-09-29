import fs from "node:fs/promises";

// ============================================================
//  PROFIL — ret din fødselsdato her (format: ÅÅÅÅ-MM-DD).
//  Alderen i svarene regnes ud fra den, så den altid er rigtig.
// ============================================================
const BIRTH_DATE = "1998-02-18"; // skift til din egen fødselsdag rigtige fødselsdag

// Spørgsmål vi foreslår i fallback og "hvad kan du?". Alle skal ramme en kategori.
const SUGGESTIONS = [
  "Hvor bor du?",
  "Hvad er dine hobbyer?",
  "Hvad er din livret?",
  "Hvor gammel er du?",
  "Spiller du et instrument?",
  "Hvad studerer du?",
  "Hvordan virker du?",
  "Fortæl om dig selv",
];

// Korte opfølgninger. Matcher hele beskeden (efter normalisering).
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

// Hvert keyword, der rammer, giver point = antal ord i keywordet.
// Så vinder "hvor gammel" (2 point) over bare "gammel" (1 point).
function scoreKeywords(keywords, normalizedQuestion) {
  let score = 0;
  for (const keyword of keywords) {
    if (keywordToRegex(keyword).test(normalizedQuestion)) {
      score += keyword.trim().split(/\s+/).length;
    }
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
function buildAnswer(group, pool, context) {
  const usedKey = `${group.category}:${pool}`;
  const variants = group[pool];
  const variant = pickVariant(variants, context.usedVariants?.[usedKey]);
  return {
    answer: fillTokens(variants[variant]),
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
//   lastCategory  — kategorien i botten seneste svar (til "hvorfor?", "og du?")
//   usedVariants  — { "kategori:pool": [brugte index] } (til varianter/"igen")
export function findBestAnswer(question, answers, context = {}) {
  const normalizedQuestion = normalizeQuestion(question);
  const byCategory = (name) => answers.find((group) => group.category === name);

  // 1) Kort opfølgning ("hvorfor?", "og du?") -> byg videre på sidste emne.
  if (FOLLOW_UPS.includes(normalizedQuestion)) {
    const lastGroup = byCategory(context.lastCategory);
    if (lastGroup?.more?.length) {
      return buildAnswer(lastGroup, "more", context);
    }
    return buildAnswer(byCategory("opfoelgning"), "answers", context);
  }

  // 2) Find kategorien med flest point. Uafgjort -> den første i answers.json.
  let bestGroup = null;
  let bestScore = 0;
  for (const group of answers) {
    const score = scoreKeywords(group.keywords, normalizedQuestion);
    if (score > bestScore) {
      bestScore = score;
      bestGroup = group;
    }
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

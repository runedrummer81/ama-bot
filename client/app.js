const API_URL = "http://localhost:3004";
const chatSection = document.querySelector(".chat");
const chatToolbar = document.querySelector(".chat-toolbar");
const welcomeEl = document.querySelector("#welcome");
// Den ydre boks (kant, klip, effekter, is-hidden/is-opening) vs. den indre
// scrollende boks (selve beskederne). Se styles.css for hvorfor de er delt op.
const messagesPanel = document.querySelector("#messages");
const messagesContainer = document.querySelector("#messages-inner");
const questionForm = document.querySelector("#question-form");
const questionInput = document.querySelector("#question");
const chatInputForm = document.querySelector("#chat-input-form");
const chatQuestionInput = document.querySelector("#chat-question");
const clearMessagesButton = document.querySelector("#clear-messages-button");
const suggestionsEl = document.querySelector(".suggestions");
const welcomePanel = document.querySelector(".welcome-panel");
const heroWrap = document.querySelector(".hero-photo-wrap");

const EXIT_TIMING = {
  collapse: 250,
  fly: 250 + 450,
  done: 250 + 450 + 350,
};

// Skal matche varigheden (3.2s) på `body.is-warping`-keyframes i styles.css.
const WARP_MS = 3200;
// Skal matche varigheden (700ms) på `.messages.is-opening` i styles.css.
const CHAT_OPEN_MS = 700;

function playWelcomeExit() {
  heroWrap?.classList.add("is-exiting");
  suggestionsEl.classList.add("is-exiting");
  welcomePanel?.classList.add("is-sending");

  return new Promise((resolve) => {
    setTimeout(() => {
      welcomePanel?.classList.remove("is-sending");
      welcomePanel?.classList.add("is-collapsing");
    }, EXIT_TIMING.collapse);

    setTimeout(() => {
      welcomePanel?.classList.remove("is-collapsing");
      welcomePanel?.classList.add("is-flying");
    }, EXIT_TIMING.fly);

    setTimeout(resolve, EXIT_TIMING.done);
  });
}

function resetWelcomeExit() {
  heroWrap?.classList.remove("is-hidden");
  heroWrap?.classList.remove("is-exiting");
  suggestionsEl.classList.remove("is-exiting");
  welcomePanel?.classList.remove("is-sending", "is-collapsing", "is-flying");
}

// Skal matche varighederne i styles.css.
const CHAT_CLOSE_MS = 400;
const WELCOME_ENTER_MS = 220;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// CRT-sluk: vinduet klapper sammen til en streg og forsvinder.
function playChatClose() {
  if (reducedMotion.matches) return Promise.resolve();

  messagesPanel.classList.add("is-closing");
  return new Promise((resolve) => setTimeout(resolve, CHAT_CLOSE_MS));
}

// Velkomstskærmen glitcher ind igen.
function playWelcomeEnter() {
  if (reducedMotion.matches) return;

  const targets = [welcomeEl, suggestionsEl];
  targets.forEach((el) => el.classList.add("is-entering"));
  setTimeout(() => {
    targets.forEach((el) => el.classList.remove("is-entering"));
  }, WELCOME_ENTER_MS);
}

// Viser enten velkomstskærmen (centreret, ingen "Ny chat"-knap) eller
// den normale chat-visning (historik + input i bunden), aldrig begge.
function updateView(messageCount) {
  const hasMessages = messageCount > 0;

  chatSection.classList.toggle("is-welcome", !hasMessages);
  chatToolbar.classList.toggle("is-hidden", !hasMessages);
  welcomeEl.classList.toggle("is-hidden", hasMessages);
  messagesPanel.classList.toggle("is-hidden", !hasMessages);
  suggestionsEl.classList.toggle("is-hidden", hasMessages);
  window.matrixBg?.setChatMode(hasMessages);
}

// "2026-09-29T08:38:42.670Z" -> "10:38" (lokal tid). Tomt hvis datoen mangler.
function formatTime(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

const GLYPHS = "01ABCDEF#$%&*<>/=+?";

function scramble(text, revealed) {
  return text
    .split("")
    .map((char, index) => {
      if (char === " ") return " ";
      if (index < revealed) return char;
      return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    })
    .join("");
}

// ---------- Sidebilleder (spawner i whitespace ved siden af chatten) ----------

const SIDE_IMAGE_MIN_SPACE = 150; // px whitespace pr. side, før der er plads
const SIDE_IMAGE_MAX_WIDTH = 440; // px, størst mulige bredde
const SIDE_IMAGE_MAX_HEIGHT = 0.55; // størst mulige højde (andel af vinduet)
const SIDE_IMAGE_LEAVE_MS = 450; // skal matche sideOut i styles.css
const SIDE_IMAGE_MIN_TOP = 90; // px, under knapperne øverst til højre

const SIDE_IMAGE_GAP = 20; // px mellem to billeder oven på hinanden
const SIDE_IMAGE_FLOOR_MARGIN = 20; // px luft over grid-gulvet

let nextSide = "left"; // billederne skifter side fra emne til emne
let imageCategory = null; // hvilket emne billederne lige nu hører til
let imageToken = 0; // så et forsinket spawn kan aflyses, hvis emnet skifter

function removeSideImage(figure) {
  if (figure.classList.contains("is-leaving")) return;
  figure.classList.add("is-leaving");
  setTimeout(
    () => figure.remove(),
    reducedMotion.matches ? 0 : SIDE_IMAGE_LEAVE_MS,
  );
}

// Alle billeder glitcher væk, og et evt. ventende spawn aflyses.
function clearSideImages() {
  imageToken++;
  let nextSide = "left"; // billederne skifter side fra emne til emne
  imageCategory = null;
  document.querySelectorAll(".side-image").forEach(removeSideImage);
}

function getSideSpace() {
  return (window.innerWidth - chatSection.getBoundingClientRect().width) / 2;
}

// Kaldes for hvert svar. Billederne hører til emnet (kategorien):
// - samme emne som sidst -> billederne bliver stående
// - nyt emne -> de gamle glitcher væk, og (hvis emnet har billeder) spawner
//   der to nye, når de gamle er væk, så de aldrig ligger oven på hinanden.
function updateSideImages(message) {
  if (message.category === imageCategory) return;

  const hadImages = document.querySelector(".side-image:not(.is-leaving)");
  clearSideImages();
  imageCategory = message.category;

  const images = pickImages(message.image);
  if (images.length === 0) return;

  const token = imageToken;
  const wait = hadImages && !reducedMotion.matches ? SIDE_IMAGE_LEAVE_MS : 0;
  setTimeout(() => spawnSideImages(images, token), wait);
}

// message.image = ét billede eller en liste. Vi vælger højst 2 tilfældige.
//   { src: "img/svartsot.jpg", alt: "Svartsot på scenen", scale: 1 }
function pickImages(images) {
  const list = (Array.isArray(images) ? images : [images]).filter(
    (image) => image?.src,
  );

  // Fuld URL for hvert billede, så "img/a.webp" og "./img/a.webp" tæller som det samme
  const toUrl = (src) => new URL(src, document.baseURI).href;

  // 1) Fjern dubletter i selve listen (samme src)
  const unique = [
    ...new Map(list.map((image) => [toUrl(image.src), image])).values(),
  ];

  // 2) Spring billeder over, der allerede er på skærmen (og ikke er ved at forsvinde)
  const onScreen = new Set(
    [...document.querySelectorAll(".side-image:not(.is-leaving)")].map(
      (el) => el.src,
    ),
  );
  const fresh = unique.filter((image) => !onScreen.has(toUrl(image.src)));

  return fresh.sort(() => Math.random() - 0.5).slice(0, 2);
}

// Henter billedet først, så vi kender formatet (stående/liggende/kvadratisk).
// Vi bruger DOM-metoder (ikke innerHTML) til src/alt, så teksten ikke kan
// snige HTML ind.
function loadImageElement(image) {
  return new Promise((resolve) => {
    const img = document.createElement("img");
    img.className = "side-image__img";
    img.alt = image.alt ?? "";
    img.addEventListener("load", () => resolve(img), { once: true });
    img.addEventListener("error", () => resolve(null), { once: true });
    img.src = image.src;
  });
}

// Nederste grænse for billederne: lige over grid-gulvets horisontlinje.
function getImageAreaBottom() {
  const floor = document.getElementById("grid-floor");
  const floorHeight = floor?.offsetHeight || window.innerHeight * 0.25;
  return window.innerHeight - floorHeight - SIDE_IMAGE_FLOOR_MARGIN;
}

async function spawnSideImages(images, token) {
  if (getSideSpace() < SIDE_IMAGE_MIN_SPACE) return; // for smalt: skip

  const loaded = await Promise.all(images.map(loadImageElement));
  if (token !== imageToken) return; // emnet nåede at skifte, mens de hentede

  // Kun de billeder, der faktisk blev hentet.
  const items = images
    .map((image, index) => ({ image, img: loaded[index] }))
    .filter((item) => item.img);
  if (items.length === 0) return;

  // Alle billederne står i samme side, oven på hinanden. Siden skifter
  // fra emne til emne.
  const side = nextSide;
  nextSide = side === "left" ? "right" : "left";

  const space = getSideSpace();
  const top = SIDE_IMAGE_MIN_TOP;
  const bottom = Math.max(getImageAreaBottom(), top + 100);
  const areaHeight = bottom - top;

  // Hvert billede må højst fylde sin del af højden (og ikke blive for bredt).
  const maxHeight =
    items.length === 1
      ? Math.min(window.innerHeight * SIDE_IMAGE_MAX_HEIGHT, areaHeight)
      : (areaHeight - SIDE_IMAGE_GAP * (items.length - 1)) / items.length;
  const maxWidth = Math.min(space - 24, SIDE_IMAGE_MAX_WIDTH);

  for (const item of items) {
    const aspect = item.img.naturalWidth / item.img.naturalHeight || 1;
    item.width = Math.min(
      Math.min(maxWidth, maxHeight * aspect) * (item.image.scale ?? 1),
      space - 24,
    );
    item.height = item.width / aspect;
  }

  // Stakken centreres lodret midt for chatvinduet, men holdes over gulvet.
  const stackHeight =
    items.reduce((sum, item) => sum + item.height, 0) +
    SIDE_IMAGE_GAP * (items.length - 1);
  const chatRect = chatSection.getBoundingClientRect();
  let y = Math.min(
    Math.max(chatRect.top + (chatRect.height - stackHeight) / 2, top),
    bottom - stackHeight,
  );

  // Alle spawner samtidig.
  for (const item of items) {
    placeSideImage(item, side, y, space);
    y += item.height + SIDE_IMAGE_GAP;
  }
}

function placeSideImage({ img, image, width }, side, top, space) {
  const offset = (space - width) / 2; // centreret i whitespace
  const glitchDelay = -(Math.random() * 6).toFixed(1); // så de ikke glitcher synkront

  const figure = document.createElement("figure");
  figure.className = `side-image side-image--${side}`;
  figure.style.setProperty("--img", `url("${image.src}")`);
  figure.style.setProperty("--w", `${width}px`);
  figure.style.setProperty("--offset", `${offset}px`);
  figure.style.setProperty("--top", `${top}px`);
  figure.style.setProperty("--tilt", "0deg"); // billederne står lige
  figure.style.setProperty("--gd", `${glitchDelay}s`);

  figure.append(img);
  for (const cls of [
    "side-image__tint",
    "side-image__slice side-image__slice--1",
    "side-image__slice side-image__slice--2",
    "side-image__slice side-image__slice--3",
    "side-image__slice side-image__slice--4",
    "side-image__rgb side-image__rgb--r",
    "side-image__rgb side-image__rgb--b",
    "side-image__noise",
  ]) {
    const layer = document.createElement("div");
    layer.className = cls;
    figure.append(layer);
  }

  document.body.append(figure);
}

async function showAnswer(message) {
  const plainText = decodeHtml(message.text);
  const article = displayMessage(message, { smooth: true });
  updateSideImages(message);
  const bodyEl = article.querySelector("p");
  const timeEl = article.querySelector("time");
  const realTime = timeEl?.textContent;

  article.classList.add("is-decrypting");
  if (timeEl) timeEl.textContent = "--:--";
  bodyEl.textContent = scramble(plainText, 0);

  await playDecode(bodyEl, plainText);

  article.classList.remove("is-decrypting");
  if (timeEl) timeEl.textContent = realTime;
}

function decodeHtml(html) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = html;
  return textarea.value;
}

const TICK_MS = 45; // hvor ofte tegnene flimrer (ms)

function playDecode(element, text, { hold = 1000, duration = 900 } = {}) {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(Math.max((elapsed - hold) / duration, 0), 1);
      const revealed = Math.floor(progress * text.length);

      element.textContent = scramble(text, revealed);

      if (progress === 1) {
        clearInterval(timer);
        element.textContent = text;
        resolve();
      }
    }, TICK_MS);
  });
}

// Udtoning i top/bund (kun når der er mere at scrolle til) og en scrollbar,
// der lyser op, mens man scroller.
let scrollTimer;

function updateScrollFades() {
  const el = messagesContainer;
  const maxScroll = el.scrollHeight - el.clientHeight;

  el.classList.toggle("can-scroll-up", el.scrollTop > 4);
  el.classList.toggle("can-scroll-down", el.scrollTop < maxScroll - 4);
}

messagesContainer.addEventListener(
  "scroll",
  () => {
    updateScrollFades();
    messagesContainer.classList.add("is-scrolling");
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      messagesContainer.classList.remove("is-scrolling");
    }, 700);
  },
  { passive: true },
);

function scrollToBottom({ smooth = false } = {}) {
  messagesContainer.scrollTo({
    top: messagesContainer.scrollHeight,
    behavior: smooth ? "smooth" : "auto",
  });
  updateScrollFades();
}

function displayMessage(message, { smooth = false } = {}) {
  const time = formatTime(message.createdAt);
  const timeHtml = time
    ? /*html*/ `<time datetime="${message.createdAt}">${time}</time>`
    : "";
  const html = /*html*/ `<article class="${message.type}">${timeHtml}<p>${message.text}</p></article>`;

  messagesContainer.insertAdjacentHTML("beforeend", html);
  scrollToBottom({ smooth });
  return messagesContainer.lastElementChild;
}

const MAX_LENGTH = 280; // Skal matche maxlength på input-feltet i index.html.
const charCounter = document.querySelector("#char-counter");
const sendButton = document.querySelector("#send-btn");
const chatCharCounter = document.querySelector("#chat-char-counter");
const chatSendButton = document.querySelector("#chat-send-btn");

function updateCharCounter(input, counter, button) {
  const length = input.value.length;

  counter.textContent = `${length}/${MAX_LENGTH}`;
  button.disabled = length === 0;
  counter.classList.toggle("char-counter--limit", length >= MAX_LENGTH);
}

questionInput.addEventListener("input", () => {
  updateCharCounter(questionInput, charCounter, sendButton);

  if (questionInput.value.length > 0) {
    pauseTypewriter();
    questionInput.placeholder = "";
  } else {
    resumeTypewriter();
  }
});

chatQuestionInput.addEventListener("input", () => {
  updateCharCounter(chatQuestionInput, chatCharCounter, chatSendButton);
});

async function getMessages() {
  try {
    const response = await fetch(`${API_URL}/messages`);
    const messages = await response.json();

    for (const message of messages) {
      displayMessage(message);
    }

    updateView(messages.length);
    scrollToBottom();
    if (messages.length > 0) {
      heroWrap?.classList.add("is-hidden");
      chatQuestionInput.focus();
      const lastAnswer = messages.filter((m) => m.type === "answer").at(-1);
      if (lastAnswer) updateSideImages(lastAnswer);
    }
  } catch (error) {
    console.error("Kunne ikke hente beskeder:", error);
    updateView(0); // fald tilbage til velkomstskærmen i stedet for at hænge
  }
}

async function sendQuestion(question) {
  const isWelcome = chatSection.classList.contains("is-welcome");

  const fetchPromise = fetch(`${API_URL}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  }).then((res) => res.json());

  // Allerede inde i en chat: ingen overgang, bare vis svaret.
  if (!isWelcome) {
    const data = await fetchPromise;
    updateView(1);
    displayMessage(data.question, { smooth: true });
    await showAnswer(data.answer);
    return;
  }

  // Første besked: hele overgangen velkomst -> chat.
  // 1) Hero, chips og panel glitcher/folder/flyver væk.
  await playWelcomeExit();
  const data = await fetchPromise;

  // 2) Rejse ind i matrixen: zoom + fart op, spawning stopper ved topfart,
  //    og tegnene glider derefter ud af skærmen indtil den er helt tom.
  if (window.matrixBg) {
    document.body.classList.add("is-warping");
    await window.matrixBg.warp(WARP_MS);
    document.body.classList.remove("is-warping");
    await window.matrixBg.drain();
  }

  // 3) Skærmen er tom for matrix-tegn: grid-gulvet glider op fra bunden.
  if (window.gridFloor) {
    await window.gridFloor.rise();
  }

  // 4) Chatvinduet (hele panelet, inkl. kant/effekter) folder sig åbent
  //    nedefra, oven på gulvet.
  updateView(1);
  messagesPanel.classList.add("is-opening");
  chatQuestionInput.focus();
  displayMessage(data.question);

  setTimeout(() => {
    messagesPanel.classList.remove("is-opening");
  }, CHAT_OPEN_MS);

  await showAnswer(data.answer);
}

let isResetting = false;

clearMessagesButton.addEventListener("click", async () => {
  if (isResetting) return; // ignorér dobbeltklik midt i animationen
  isResetting = true;

  try {
    const deleting = fetch(`${API_URL}/messages`, { method: "DELETE" });

    // 1) Chatvinduet slukker.
    clearSideImages();
    await playChatClose();
    await deleting;

    // 2) Ryd op og vis velkomstskærmen igen.
    messagesContainer.innerHTML = "";
    updateView(0);
    messagesPanel.classList.remove("is-closing");
    resetWelcomeExit();
    window.gridFloor?.reset();
    window.matrixBg?.resumeSpawning();

    // 3) Velkomsten glitcher ind.
    playWelcomeEnter();
    questionInput.value = "";
    updateCharCounter(questionInput, charCounter, sendButton);
    questionInput.focus();
    restartTypewriter();
  } catch (error) {
    console.error("Kunne ikke starte en ny chat:", error);
  } finally {
    isResetting = false;
  }
});

async function handleQuestionSubmit(input) {
  const question = input.value.trim();
  if (!question) return;

  await sendQuestion(question);

  input.value = "";
}

questionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await handleQuestionSubmit(questionInput);
  updateCharCounter(questionInput, charCounter, sendButton);
});

// Klik på et forslag = samme flow som at skrive spørgsmålet og trykke send.
// Spørgsmålet er den tekst, der står på knappen, så du kun skal ændre den ét
// sted i index.html. Teksten lægges i feltet, så den flyver væk med panelet.
suggestionsEl.addEventListener("click", async (event) => {
  const chip = event.target.closest(".suggestion-chip");
  if (!chip || suggestionsEl.classList.contains("is-exiting")) return;

  pauseTypewriter();
  questionInput.placeholder = "";
  questionInput.value = chip.querySelector(".chip-label").textContent.trim();
  updateCharCounter(questionInput, charCounter, sendButton);

  await handleQuestionSubmit(questionInput);
  updateCharCounter(questionInput, charCounter, sendButton);
});

chatInputForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const question = chatQuestionInput.value.trim();
  if (!question) return;

  chatQuestionInput.value = "";
  updateCharCounter(chatQuestionInput, chatCharCounter, chatSendButton);
  chatQuestionInput.focus();

  await sendQuestion(question);
});

// Rene UI-togglere for nu — ingen af dem er koblet til rigtig lyd,
// sprogskift eller tema endnu. De skifter bare visuel tilstand
// (ikon + aria-pressed), klar til at blive koblet til rigtig logik senere.
function setupUtilityToggle(selector) {
  const button = document.querySelector(selector);
  if (!button) return;

  button.addEventListener("click", () => {
    const isPressed = button.getAttribute("aria-pressed") === "true";
    button.setAttribute("aria-pressed", String(!isPressed));
  });
}

setupUtilityToggle("#sound-toggle-btn");
setupUtilityToggle("#theme-toggle-btn");

const TYPEWRITER_EXAMPLES = [
  "Hvor bor du?",
  "Hvad kan du?",
  "Hvad laver du i din fritid?",
];
const TYPE_SPEED = 55;
const DELETE_SPEED = 30;
const HOLD_MS = 1800;

let twIndex = 0;
let twCharIndex = 0;
let twDeleting = false;
let twTimeout = null;
let twPaused = false;

function typewriterTick() {
  if (twPaused) return;

  const current = TYPEWRITER_EXAMPLES[twIndex];

  if (!twDeleting) {
    twCharIndex++;
    questionInput.placeholder = current.slice(0, twCharIndex);

    if (twCharIndex === current.length) {
      twTimeout = setTimeout(() => {
        twDeleting = true;
        typewriterTick();
      }, HOLD_MS);
      return;
    }
    twTimeout = setTimeout(typewriterTick, TYPE_SPEED);
  } else {
    twCharIndex--;
    questionInput.placeholder = current.slice(0, twCharIndex);

    if (twCharIndex === 0) {
      twDeleting = false;
      twIndex = (twIndex + 1) % TYPEWRITER_EXAMPLES.length;
      twTimeout = setTimeout(typewriterTick, 400);
      return;
    }
    twTimeout = setTimeout(typewriterTick, DELETE_SPEED);
  }
}

function pauseTypewriter() {
  twPaused = true;
  clearTimeout(twTimeout);
}

// Starter forfra: bruges når velkomstskærmen kommer tilbage efter "Ny chat".
function restartTypewriter() {
  clearTimeout(twTimeout); // aldrig to loops på én gang
  twPaused = false;
  twIndex = 0;
  twCharIndex = 0;
  twDeleting = false;
  questionInput.placeholder = "";
  typewriterTick();
}

function resumeTypewriter() {
  if (questionInput.value.length > 0) return;
  twPaused = false;
  typewriterTick();
}

questionInput.addEventListener("focus", () => {
  welcomePanel?.classList.add("is-active");
});

questionInput.addEventListener("blur", () => {
  welcomePanel?.classList.remove("is-active");
});

typewriterTick();

getMessages();
updateCharCounter(questionInput, charCounter, sendButton);
updateCharCounter(chatQuestionInput, chatCharCounter, chatSendButton);
questionInput.focus();

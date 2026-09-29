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

async function showAnswer(message) {
  const plainText = decodeHtml(message.text);
  const article = displayMessage(message);
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

function displayMessage(message) {
  const time = formatTime(message.createdAt);
  const timeHtml = time
    ? /*html*/ `<time datetime="${message.createdAt}">${time}</time>`
    : "";
  const html = /*html*/ `<article class="${message.type}">${timeHtml}<p>${message.text}</p></article>`;

  messagesContainer.insertAdjacentHTML("beforeend", html);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
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

questionInput.addEventListener("input", () => {
  updateCharCounter();

  if (questionInput.value.length > 0) {
    pauseTypewriter();
    questionInput.placeholder = "";
  } else {
    resumeTypewriter();
  }
});

async function getMessages() {
  try {
    const response = await fetch(`${API_URL}/messages`);
    const messages = await response.json();

    for (const message of messages) {
      displayMessage(message);
    }

    updateView(messages.length);
    if (messages.length > 0) heroWrap?.classList.add("is-hidden");
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
    displayMessage(data.question);
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
  displayMessage(data.question);
  displayMessage(data.answer);

  setTimeout(() => {
    messagesPanel.classList.remove("is-opening");
  }, CHAT_OPEN_MS);

  await showAnswer(data.answer);
}

clearMessagesButton.addEventListener("click", async () => {
  await fetch(`${API_URL}/messages`, { method: "DELETE" });
  messagesContainer.innerHTML = "";
  updateView(0);
  resetWelcomeExit();
  window.gridFloor?.reset();
  window.matrixBg?.resumeSpawning();
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

const languageToggleButton = document.querySelector("#language-toggle-btn");
if (languageToggleButton) {
  languageToggleButton.addEventListener("click", () => {
    const isEnglish =
      languageToggleButton.getAttribute("aria-pressed") === "true";
    const next = !isEnglish;

    languageToggleButton.setAttribute("aria-pressed", String(next));
    languageToggleButton.textContent = next ? "EN" : "DA";
  });
}

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

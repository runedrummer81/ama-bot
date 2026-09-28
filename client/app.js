const API_URL = "http://localhost:3004";
const chatSection = document.querySelector(".chat");
const chatToolbar = document.querySelector(".chat-toolbar");
const welcomeEl = document.querySelector("#welcome");
const messagesContainer = document.querySelector("#messages");
const questionForm = document.querySelector("#question-form");
const questionInput = document.querySelector("#question");
const clearMessagesButton = document.querySelector("#clear-messages-button");
const suggestionsEl = document.querySelector(".suggestions");
const welcomePanel = document.querySelector(".welcome-panel");
const heroWrap = document.querySelector(".hero-photo-wrap");

const EXIT_TIMING = {
  collapse: 250,
  fly: 250 + 450,
  done: 250 + 450 + 350,
};

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
  messagesContainer.classList.toggle("is-hidden", !hasMessages);
  suggestionsEl.classList.toggle("is-hidden", hasMessages);
}

function displayMessage(message) {
  const html = /*html*/ `<article class="${message.type}"><p>${message.text}</p></article>`;

  messagesContainer.insertAdjacentHTML("beforeend", html);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

const MAX_LENGTH = 280; // Skal matche maxlength på input-feltet i index.html.
const charCounter = document.querySelector("#char-counter");
const sendButton = document.querySelector("#send-btn");

function updateCharCounter() {
  const length = questionInput.value.length;

  charCounter.textContent = `${length}/${MAX_LENGTH}`;
  sendButton.disabled = length === 0;
  charCounter.classList.toggle("char-counter--limit", length >= MAX_LENGTH);
}

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
  } catch (error) {
    console.error("Kunne ikke hente beskeder:", error);
    updateView(0); // fald tilbage til velkomstskærmen i stedet for at hænge
  }
}

async function sendQuestion(question) {
  const isWelcome = chatSection.classList.contains("is-welcome");
  const exitPromise = isWelcome ? playWelcomeExit() : Promise.resolve();

  const [response] = await Promise.all([
    fetch(`${API_URL}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    }),
    exitPromise,
  ]);

  const data = await response.json();

  updateView(1);
  displayMessage(data.question);
  displayMessage(data.answer);
}

clearMessagesButton.addEventListener("click", async () => {
  await fetch(`${API_URL}/messages`, { method: "DELETE" });
  messagesContainer.innerHTML = "";
  updateView(0);
  resetWelcomeExit();
});

suggestionsEl.addEventListener("click", (event) => {
  const chip = event.target.closest(".suggestion-chip");
  if (!chip) return;

  sendQuestion(chip.dataset.question);
});

questionForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const question = questionInput.value.trim();
  if (!question) return;

  await sendQuestion(question);

  questionInput.value = "";
  updateCharCounter();
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
updateCharCounter();
questionInput.focus();

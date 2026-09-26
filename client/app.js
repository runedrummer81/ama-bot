const API_URL = "http://localhost:3004";
const chatSection = document.querySelector(".chat");
const chatToolbar = document.querySelector(".chat-toolbar");
const welcomeEl = document.querySelector("#welcome");
const messagesContainer = document.querySelector("#messages");
const questionForm = document.querySelector("#question-form");
const questionInput = document.querySelector("#question");
const clearMessagesButton = document.querySelector("#clear-messages-button");
const capabilitiesButton = document.querySelector("#capabilities-btn");

// Viser enten velkomstskærmen (centreret, ingen "Ny chat"-knap) eller
// den normale chat-visning (historik + input i bunden), aldrig begge.
function updateView(messageCount) {
  const hasMessages = messageCount > 0;

  chatSection.classList.toggle("is-welcome", !hasMessages);
  chatToolbar.classList.toggle("is-hidden", !hasMessages);
  welcomeEl.classList.toggle("is-hidden", hasMessages);
  messagesContainer.classList.toggle("is-hidden", !hasMessages);
  capabilitiesButton.classList.toggle("is-hidden", hasMessages);
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

questionInput.addEventListener("input", updateCharCounter);

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
  const response = await fetch(`${API_URL}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });

  const data = await response.json();

  // Første besked i chatten — skift fra velkomst til chat-visning.
  updateView(1);

  displayMessage(data.question);
  displayMessage(data.answer);
}

clearMessagesButton.addEventListener("click", async () => {
  await fetch(`${API_URL}/messages`, { method: "DELETE" });
  messagesContainer.innerHTML = "";
  updateView(0);
});

capabilitiesButton.addEventListener("click", () => {
  sendQuestion("Hvad kan du?");
});

questionForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const question = questionInput.value.trim();
  if (!question) return;

  await sendQuestion(question);

  questionInput.value = "";
  updateCharCounter();
});

getMessages();
updateCharCounter();

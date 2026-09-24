const API_URL = "http://localhost:3004";
const messagesContainer = document.querySelector("#messages");
const questionForm = document.querySelector("#question-form");
const questionInput = document.querySelector("#question");
const clearMessagesButton = document.querySelector("#clear-messages-button");

function displayMessage(message) {
  const html = /*html*/ `<article class="${message.type}"><p>${message.text}</p></article>`;
  console.log(html);
  messagesContainer.insertAdjacentHTML("beforeend", html);
}

async function getMessages() {
  const response = await fetch(`${API_URL}/messages`);
  const messages = await response.json();

  for (const message of messages) {
    displayMessage(message);
  }

  console.log(messages);
}

getMessages();

questionForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const question = questionInput.value.trim();

  const response = await fetch(`${API_URL}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });

  const data = await response.json();

  console.log(data);
});

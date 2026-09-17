import express from "express";
import fs from "node:fs/promises";

const app = express();
const port = 3004;

app.use(express.json());

async function loadMessages() {
  const data = await fs.readFile("./data/messages.json", "utf8"); // Læs data/messages.json med fs.readFile() ("utf8").
  return JSON.parse(data); // Parse JSON-teksten til et array, og returnér det.
}

async function saveMessages(messages) {
  const json = JSON.stringify(messages, null, 2); // Omdan messages til formateret JSON-tekst med JSON.stringify().
  await fs.writeFile("./data/messages.json", json); // Skriv teksten til data/messages.json med fs.writeFile().
}

async function loadTopicStats() {
  const data = await fs.readFile("./data/topic-stats.json", "utf8");
  return JSON.parse(data);
}

async function saveTopicStats(topicStats) {
  const json = JSON.stringify(topicStats, null, 2);
  await fs.writeFile("./data/topic-stats.json", json);
}

const answers = [
  {
    category: "navn",
    keywords: ["navn", "hedder", "hvem er du"],
    answers: ["Jeg hedder Rune", "Mit fulde navn er Rune Frisch Knudsen"],
  },
  {
    category: "bosted",
    keywords: ["bor", "by", "fra"],
    answers: [
      "Jeg bor i Højbjerg",
      "Jeg bor i Højbjerg som er en del af Aarhus",
    ],
  },
  {
    category: "fritid",
    keywords: ["fritid", "hobby", "kan lide"],
    answers: [
      "I min fritid kan jeg godt lide at sprede demokrati og spille trommer.",
      "Jeg elsker at læse!",
    ],
  },
];

function countMatches(keywords, normalizedQuestion) {
  const matches = keywords.filter((keyword) => {
    return normalizedQuestion.includes(keyword);
  });
  return matches.length;
}

function findBestAnswer(question) {
  const normalizedQuestion = normalizeQuestion(question);
  let bestScore = 0;
  let bestAnswer = "Det kender jeg ikke svaret på endnu.";
  let bestCategory = "";

  for (const answerGroup of answers) {
    const score = countMatches(answerGroup.keywords, normalizedQuestion);
    if (score > bestScore) {
      bestScore = score;
      const randomIndex = Math.floor(
        Math.random() * answerGroup.answers.length,
      );
      bestAnswer = answerGroup.answers[randomIndex];
      bestCategory = answerGroup.category;
    }
  }

  return {
    answer: bestAnswer,
    category: bestCategory,
  };
}

function sanitizeQuestion(input) {
  return input.replace(/[\u0000-\u001F\u007F]/g, "");
}

function normalizeQuestion(question) {
  return question.trim().toLowerCase().replace(/\s+/g, " ");
}

app.get("/messages", async (request, response) => {
  const messages = await loadMessages();

  response.json(messages);
});

app.post("/messages", async (request, response) => {
  const messages = await loadMessages();
  const topicStats = await loadTopicStats();
  const question = request.body.question.trim();

  if (!question) {
    response.json({ error: "Skriv et spørgsmål, før du sender." });
    return;
  }

  const message = {
    type: "question",
    text: question,
    createdAt: new Date().toISOString(),
  };
  messages.push(message);

  const result = findBestAnswer(question);
  const answerMessage = {
    type: "answer",
    text: result.answer,
    createdAt: new Date().toISOString(),
  };
  messages.push(answerMessage);

  if (result.category) {
    topicStats[result.category] = topicStats[result.category] + 1;
  }

  await saveMessages(messages);
  await saveTopicStats(topicStats);

  response.json({ question: message, answer: answerMessage });
});

app.delete("/messages", async (request, response) => {
  await saveMessages([]);

  response.send();
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

import express from "express";
import fs from "node:fs/promises";

const app = express();
const port = 3004;

app.use(express.static("public"));

app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: true }));

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

app.post("/clear-messages", async (request, response) => {
  await saveMessages([]);
  response.redirect("/");
});

app.post("/ask", async (request, response) => {
  const topicStats = await loadTopicStats();
  const messages = await loadMessages();
  const rawQuestion = request.body.question;
  const question = sanitizeQuestion(rawQuestion).trim();
  let error = "";

  if (!question) {
    error = "Skriv et spørgsmål, før du sender";
  } else if (question.length > 280) {
    error = "Spørgsmålet må højst være 280 tegn.";
  } else {
    messages.push({ type: "question", text: question, createdAt: new Date() });
    const result = findBestAnswer(question);
    messages.push({
      type: "answer",
      text: result.answer,
      createdAt: new Date(),
    });
    if (result.category) {
      topicStats[result.category] = topicStats[result.category] + 1;
    }
  }
  await saveMessages(messages);
  await saveTopicStats(topicStats);
  response.render("index", { messages, error, topicStats });
});

app.get("/", async (request, response) => {
  const messages = await loadMessages();
  const topicStats = await loadTopicStats();
  response.render("index", { messages, error: "", topicStats });
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

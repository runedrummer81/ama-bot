import express from "express";
import fs from "node:fs/promises";

const app = express();
const port = 3004;

app.use(express.json());

async function loadTopicStats() {
  const data = await fs.readFile("./data/topic-stats.json", "utf8");
  return JSON.parse(data);
}

async function saveTopicStats(topicStats) {
  const json = JSON.stringify(topicStats, null, 2);
  await fs.writeFile("./data/topic-stats.json", json);
}

async function loadAnswers() {
  const data = await fs.readFile("./data/answers.json", "utf8");
  return JSON.parse(data);
}

async function saveAnswers(answers) {
  const json = JSON.stringify(answers, null, 2);
  await fs.writeFile("./data/answers.json", json);
}

function countMatches(keywords, normalizedQuestion) {
  const matches = keywords.filter((keyword) => {
    return normalizedQuestion.includes(keyword);
  });
  return matches.length;
}

function findBestAnswer(question, answers) {
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

  const answers = await loadAnswers();
  const result = findBestAnswer(question, answers);
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

app.post("/answers", async (request, response) => {
  const answers = await loadAnswers();

  const newAnswerRule = {
    category: request.body.category,
    keywords: request.body.keywords,
    answers: request.body.answers,
  };
  answers.push(newAnswerRule);
  await saveAnswers(answers);

  response.json(newAnswerRule);
});

app.put("/answers/:category", async (request, response) => {
  const answers = await loadAnswers();
  const answerRule = answers.find(
    (a) => a.category === request.params.category,
  );

  answerRule.keywords = request.body.keywords;
  answerRule.answers = request.body.answers;
  await saveAnswers(answers);

  response.json(answerRule);
});

app.get("/answers", async (request, response) => {
  const answers = await loadAnswers();

  response.json(answers);
});

app.get("/answers/:category", async (request, response) => {
  const answers = await loadAnswers();
  const answerRule = answers.find(
    (a) => a.category === request.params.category,
  );

  response.json(answerRule);
});

app.delete("/messages", async (request, response) => {
  await saveMessages([]);

  response.send();
});

app.delete("/answers/:category", async (request, response) => {
  let answers = await loadAnswers();

  answers = answers.filter((a) => a.category !== request.params.category);
  await saveAnswers(answers);

  response.send();
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

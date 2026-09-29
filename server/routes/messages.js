import express from "express";
import {
  loadMessages,
  saveMessages,
  loadTopicStats,
  saveTopicStats,
} from "../data/messages.js";
import { loadAnswers, findBestAnswer } from "../data/answers.js";

function sanitizeQuestion(input) {
  return input.replace(/[\u0000-\u001F\u007F]/g, "");
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Ud fra chatten indtil nu: hvad talte vi sidst om, og hvilke svar-varianter
// har vi allerede brugt? (bruges til "hvorfor?", "igen"-svar og undgå gentagelser)
function buildContext(messages) {
  const previousAnswers = messages.filter(
    (message) => message.type === "answer" && message.category,
  );

  const usedVariants = {};
  for (const message of previousAnswers) {
    const key = `${message.category}:${message.pool}`;
    usedVariants[key] ??= [];
    usedVariants[key].push(message.variant);
  }

  // Et fallback-svar er ikke et emne, man kan uddybe.
  const lastAnswer = previousAnswers.at(-1);
  const lastCategory =
    lastAnswer && lastAnswer.category !== "fallback" ? lastAnswer.category : "";

  return { lastCategory, usedVariants };
}

const router = express.Router();

router.get("/", async (request, response) => {
  const messages = await loadMessages();
  response.json(messages);
});

router.post("/", async (request, response) => {
  if (typeof request.body?.question !== "string") {
    response.status(400).json({ error: "Skriv et spørgsmål, før du sender." });
    return;
  }

  const messages = await loadMessages();
  const topicStats = await loadTopicStats();
  const question = sanitizeQuestion(request.body.question).trim();

  if (!question) {
    response.status(400).json({ error: "Skriv et spørgsmål, før du sender." });
    return;
  }

  const answers = await loadAnswers();
  const context = buildContext(messages);
  const result = findBestAnswer(question, answers, context);

  const message = {
    type: "question",
    text: escapeHtml(question),
    createdAt: new Date().toISOString(),
  };
  messages.push(message);

  const answerMessage = {
    type: "answer",
    text: escapeHtml(result.answer),
    createdAt: new Date().toISOString(),
    category: result.category,
    pool: result.pool,
    variant: result.variant,
  };
  messages.push(answerMessage);

  // Spørgsmål uden træffer tælles under "ukendt", så du kan se, hvad besøgende
  // spørger om, som botten endnu ikke kan svare på.
  const statKey = result.matched ? result.category : "ukendt";
  topicStats[statKey] = (topicStats[statKey] ?? 0) + 1;

  await saveMessages(messages);
  await saveTopicStats(topicStats);

  response.status(201).json({ question: message, answer: answerMessage });
});

router.delete("/", async (request, response) => {
  await saveMessages([]);
  response.status(204).send();
});

export default router;

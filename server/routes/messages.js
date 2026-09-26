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

const router = express.Router();

router.get("/", async (request, response) => {
  const messages = await loadMessages();
  response.json(messages);
});

router.post("/", async (request, response) => {
  const messages = await loadMessages();
  const topicStats = await loadTopicStats();
  const question = sanitizeQuestion(request.body.question).trim();

  if (!question) {
    response.status(400).json({ error: "Skriv et spørgsmål, før du sender." });
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

  response.status(201).json({ question: message, answer: answerMessage });
});

router.delete("/", async (request, response) => {
  await saveMessages([]);
  response.status(204).send();
});

export default router;

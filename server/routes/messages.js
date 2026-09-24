import express from "express";
import { loadMessages, saveMessages } from "../data/messages";

const router = express.Router();

router.get("/", async (request, response) => {
  const messages = await loadMessages();
  response.json(messages);
});

router.post("/", async (request, response) => {
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

router.delete("/", async (request, response) => {
  await saveMessages([]);
  response.send();
});

export default router;

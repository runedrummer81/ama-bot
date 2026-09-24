import express from "express";
import { loadAnswers, saveAnswers } from "../data/answers.js";

const router = express.Router();

router.post("/", async (request, response) => {
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

router.put("/:category", async (request, response) => {
  const answers = await loadAnswers();
  const answerRule = answers.find(
    (a) => a.category === request.params.category,
  );

  answerRule.keywords = request.body.keywords;
  answerRule.answers = request.body.answers;
  await saveAnswers(answers);

  response.json(answerRule);
});

router.get("/", async (request, response) => {
  const answers = await loadAnswers();

  response.json(answers);
});

router.get("/:category", async (request, response) => {
  const answers = await loadAnswers();
  const answerRule = answers.find(
    (a) => a.category === request.params.category,
  );

  response.json(answerRule);
});
export default router;

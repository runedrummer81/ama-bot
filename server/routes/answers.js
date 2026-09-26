import express from "express";
import { loadAnswers, saveAnswers } from "../data/answers.js";

const router = express.Router();

router.post("/", async (request, response) => {
  const answers = await loadAnswers();
  if (
    !request.body.category ||
    !request.body.keywords ||
    !request.body.answers
  ) {
    response
      .status(400)
      .json({ error: "category, keywords og answers skal alle udfyldes." });
    return;
  }

  const newAnswerRule = {
    category: request.body.category,
    keywords: request.body.keywords,
    answers: request.body.answers,
  };
  answers.push(newAnswerRule);
  await saveAnswers(answers);

  response.status(201).json(newAnswerRule);
});

router.put("/:category", async (request, response) => {
  const answers = await loadAnswers();
  const answerRule = answers.find(
    (a) => a.category === request.params.category,
  );
  if (!answerRule) {
    response
      .status(404)
      .json({ error: "Der findes ikke nogen svarregel med denne kategori" });
    return;
  }
  if (!request.body.keywords || !request.body.answers) {
    response
      .status(400)
      .json({ error: "keywords og answers skal begge udfyldes." });
    return;
  }

  answerRule.keywords = request.body.keywords;
  answerRule.answers = request.body.answers;
  await saveAnswers(answers);

  response.json(answerRule);
});

router.get("/", async (request, response) => {
  const answers = await loadAnswers();

  response.json(answers);
});

router.delete("/:category", async (request, response) => {
  let answers = await loadAnswers();
  const answerRule = answers.find(
    (a) => a.category === request.params.category,
  );
  if (!answerRule) {
    response
      .status(404)
      .json({ error: "Der findes ikke nogen svarregel med den kategori" });
    return;
  }

  answers = answers.filter((a) => a.category !== request.params.category);
  await saveAnswers(answers);

  response.status(204).send();
});

router.get("/:category", async (request, response) => {
  const answers = await loadAnswers();
  const answerRule = answers.find(
    (a) => a.category === request.params.category,
  );

  if (!answerRule) {
    response
      .status(404)
      .json({ error: "Der findes ikke nogen svarregel med den kategori" });
    return;
  }

  response.json(answerRule);
});
export default router;

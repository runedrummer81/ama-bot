import express from "express";

const app = express();
const port = 3004;

app.use(express.static("public"));

app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: true }));

const messages = [];

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

function findAnswer(question) {
  const normalizedQuestion = question.toLowerCase();

  for (const answerGroup of answers) {
    const hasMatch = answerGroup.keywords.some((keyword) =>
      normalizedQuestion.includes(keyword),
    );

    if (hasMatch) {
      const randomIndex = Math.floor(
        Math.random() * answerGroup.answers.length,
      );
      return answerGroup.answers[randomIndex];
    }
  }

  return "Det kender jeg desværre ikke svaret på endnu. Beklager!";
}

function findBestAnswer(question) {
  const normalizedQuestion = question.toLowerCase();
  let bestScore = 0;
  let bestAnswer = "Det kender jeg ikke svaret på endnu.";
  let bestCategory = "";

  for (const answerGroup of answers) {
    const score = countMatches(answerGroup.keywords, normalizedQuestion);
    if (score > bestScore) {
      bestScore = score;
      bestAnswer = answerGroup.answers[0];
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

const topicStats = {
  navn: 0,
  bosted: 0,
  fritid: 0,
};

app.post("/clear-messages", (request, response) => {
  messages.length = 0;
  response.redirect("/");
});

app.post("/ask", (request, response) => {
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
  response.render("index", { messages, error, topicStats });
});

app.get("/", (request, response) => {
  response.render("index", { messages, error: "", topicStats });
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

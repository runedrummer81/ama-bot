import express from "express";

const app = express();
const port = 3000;

app.use(express.static("public"));

app.set("view engine", "ejs");

app.get("/", (request, response) => {
  response.render("index");
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

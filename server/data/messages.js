import fs from "node:fs/promises";

export async function loadMessages() {
  const data = await fs.readFile("./data/messages.json", "utf8"); // Læs data/messages.json med fs.readFile() ("utf8").
  return JSON.parse(data); // Parse JSON-teksten til et array, og returnér det.
}

export async function saveMessages(messages) {
  const json = JSON.stringify(messages, null, 2); // Omdan messages til formateret JSON-tekst med JSON.stringify().
  await fs.writeFile("./data/messages.json", json); // Skriv teksten til data/messages.json med fs.writeFile().
}

import fs from "node:fs/promises";

export async function loadMessages() {
  try {
    const data = await fs.readFile("./data/messages.json", "utf8"); // Læs data/messages.json med fs.readFile() ("utf8").
    return JSON.parse(data); // Parse JSON-teksten til et array, og returnér det.
  } catch (error) {
    throw new Error(
      "Kunne ikke hente beskeder. data/messages.json mangler eller er ugyldig",
    );
  }
}

export async function saveMessages(messages) {
  const json = JSON.stringify(messages, null, 2); // Omdan messages til formateret JSON-tekst med JSON.stringify().
  await fs.writeFile("./data/messages.json", json); // Skriv teksten til data/messages.json med fs.writeFile().
}

export async function loadTopicStats() {
  const data = await fs.readFile("./data/topic-stats.json", "utf8");
  return JSON.parse(data);
}

export async function saveTopicStats(topicStats) {
  const json = JSON.stringify(topicStats, null, 2);
  await fs.writeFile("./data/topic-stats.json", json);
}

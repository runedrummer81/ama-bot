// Mønstre der typisk bruges, når nogen prøver at snyde et inputfelt.
const ATTACK_PATTERNS = [
  /<\s*\/?\s*[a-z!][^>]*>/i, // HTML/script-tags: <script>, <img onerror=...>
  /javascript\s*:/i, // javascript:-links
  /\bon(error|load|click|focus|blur|change|submit|input|toggle|mouse[a-z]*|key[a-z]*|animation[a-z]*)\s*=/i, // onerror=, onload= ...
  /\b(alert|eval|prompt|confirm)\s*\(/i, // JS-kald
  /document\s*\.\s*(cookie|write|location)/i,
  /\bunion\s+select\b|\bdrop\s+table\b|\binsert\s+into\b|\bdelete\s+from\b|\bselect\b.+\bfrom\b/i, // SQL
  /['"]\s*(or|and)\s+['"]?\w+['"]?\s*=\s*['"]?\w+/i, // ' OR '1'='1
  /\.\.[\/\\]/, // ../ (path traversal)
  /\$\{|\{\{|<%/, // template injection
  /[;|&]{1,2}\s*(rm|cat|ls|curl|wget|sudo)\b/i, // kommandolinje
];

export function detectAttack(text) {
  return ATTACK_PATTERNS.some((pattern) => pattern.test(text));
}

const REPLIES = [
  "Troede du virkelig, at det ville virke? Rune har lært at escape input, og din kode er nu bare tekst. Pæn indsats, dog.",
  "Igen? Det er stadig bare tekst. Du får ikke min server til at gøre andet end at svare på spørgsmål.",
  "Jeg er ikke særlig avanceret, men jeg er heldigvis bygget til ikke at æde alt, jeg får serveret. Det her er forsøg nummer tre.",
  "Du er vedholdende, det skal du have. Det ændrer bare ikke på, at svaret stadig er nej.",
  "Jeg har opgivet at tælle. Jeg svarer gerne på noget om Rune, hvis du er færdig med at teste mig.",
];

// attempts = hvor mange gange det er sket før i denne chat
export function attackReply(attempts) {
  return REPLIES[Math.min(attempts, REPLIES.length - 1)];
}

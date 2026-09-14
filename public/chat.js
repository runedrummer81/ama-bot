// Efter hvert page reload (fx efter man har sendt et spørgsmål) skal man
// stå nede ved den nyeste besked med det samme — IKKE se en synlig rejse
// fra toppen af chatten og ned. Det er beskedens egen spawn-animation
// (se styles.css) der skal give følelsen af bevægelse, ikke selve scrollet.

// Slår browserens egen "husk scroll-position"-funktion fra, så den ikke
// konkurrerer med vores eget scroll-kald herunder.
if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

function scrollChatToBottom() {
  const messages = document.querySelector(".messages"); // Find beskedcontaineren.

  if (messages) {
    messages.scrollTop = messages.scrollHeight; // Sæt scroll-positionen direkte og øjeblikkeligt, ingen animation.
  }
}

function focusInput() {
  const input = document.getElementById("question"); // Find inputfeltet.

  if (input) {
    input.focus(); // Sæt fokus, så man kan skrive videre uden selv at klikke ind i feltet.
  }
}

const MAX_LENGTH = 280; // Skal matche maxlength i EJS og grænsen i server.js.

function setupCharCounterAndSendButton() {
  const input = document.getElementById("question");
  const counter = document.getElementById("char-counter");
  const sendBtn = document.getElementById("send-btn");

  if (!input || !counter || !sendBtn) return; // Stop hvis et af elementerne mangler.

  function update() {
    const length = input.value.length;

    counter.textContent = `${length}/${MAX_LENGTH}`; // Opdater tælleren, fx "42/280".
    sendBtn.disabled = length === 0; // Deaktivér knappen når feltet er tomt.

    // Kun to tilstande: default (siger ikke noget undervejs) og en
    // tydelig "limit"-effekt der først vises når grænsen rent faktisk er nået.
    counter.classList.toggle("char-counter--limit", length >= MAX_LENGTH);
  }

  input.addEventListener("input", update); // Kør hver gang brugeren taster noget.
  update(); // Kør også med det samme, i tilfælde af at browseren har gendannet en tidligere værdi.
}

const SCRAMBLE_CHARS = "!<>-_\\/[]{}—=+*^?#$%&01"; // Symboler brugt til "støjen" før teksten afkodes.

function randomScrambleChar() {
  return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
}

// Genbrugelig scramble-funktion. Kan bruges på ethvert element med tekst i —
// fx et svar fra botten, eller en overskrift.
function scrambleText(
  target,
  { delay = 300, duration = 600, frameMs = 30 } = {},
) {
  if (!target) return;

  const finalText = target.textContent;
  const totalFrames = Math.round(duration / frameMs);

  // Skjul den rigtige tekst med det samme (før man når at se den),
  // og vis i stedet tilfældige symboler i samme længde som teksten.
  target.textContent = finalText
    .split("")
    .map((char) => (char === " " ? " " : randomScrambleChar()))
    .join("");

  setTimeout(() => {
    let frame = 0;

    const intervalId = setInterval(() => {
      // Hvor mange bogstaver skal være afsløret ved dette frame, baseret på
      // hvor langt vi er i det FASTE antal frames — ikke i tegn-antallet.
      const revealCount = Math.floor((frame / totalFrames) * finalText.length);

      target.textContent = finalText
        .split("")
        .map((char, index) => {
          if (char === " ") return " ";
          if (index < revealCount) return char; // Bogstaver "låses" gradvist fra venstre mod højre.
          return randomScrambleChar();
        })
        .join("");

      frame++;

      if (frame > totalFrames) {
        target.textContent = finalText; // Sikrer at slutresultatet altid er 100% korrekt.
        clearInterval(intervalId);
      }
    }, frameMs);
  }, delay);
}

function scrambleLatestAnswer() {
  const answerParagraphs = document.querySelectorAll(
    ".messages article.answer p",
  );
  if (answerParagraphs.length === 0) return;

  const target = answerParagraphs[answerParagraphs.length - 1]; // Den seneste af botens svar.
  scrambleText(target); // Bruger default-timingen (300ms delay, 600ms varighed).
}

function scrambleWelcomeHeading() {
  const heading = document.getElementById("welcome-heading");
  if (!heading) return; // Findes kun på velkomst-skærmen.

  // Lidt længere delay end svar-boblerne, så den kører EFTER
  // hjørne-brackets'ene er låst fast (se cornerIn-animationen i CSS).
  scrambleText(heading, { delay: 500, duration: 700 });
}

const POWER_DOWN_DURATION = 350; // ms — SKAL matche varigheden af powerDown-animationen i styles.css.
const POWER_TRANSITION_FLAG = "justClickedNewChat"; // Nøglen vi bruger i sessionStorage.

// Fælles funktion: spil power-down-effekten, husk (via sessionStorage) at
// den næste side skal spille power-up, og send så formularen for rigtigt.
function triggerPowerTransition(form) {
  document.body.classList.add("powering-down");
  sessionStorage.setItem(POWER_TRANSITION_FLAG, "true");

  setTimeout(() => {
    form.submit(); // .submit() trigger IKKE "submit"-eventet igen, så vi undgår en uendelig løkke.
  }, POWER_DOWN_DURATION);
}

function setupNewChatTransition() {
  const newChatForm = document.querySelector('form[action="/clear-messages"]');
  if (!newChatForm) return;

  newChatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    triggerPowerTransition(newChatForm);
  });
}

function setupWelcomeTransition() {
  const welcomeForm = document.querySelector(".welcome-input"); // Findes kun på velkomst-skærmen.
  if (!welcomeForm) return;

  welcomeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    triggerPowerTransition(welcomeForm);
  });
}

function playPowerUpIfNeeded() {
  if (sessionStorage.getItem(POWER_TRANSITION_FLAG) === "true") {
    document.body.classList.add("powering-up");
    sessionStorage.removeItem(POWER_TRANSITION_FLAG);
  }
}

const BOOT_FLAG = "hasSeenBootIntro"; // Nøglen vi bruger i sessionStorage.
const BOOT_TOTAL_DURATION = 2700; // ms — SKAL matche timingen i styles.css (sidste linjes delay + fade-out).

function setupBootIntro() {
  const overlay = document.getElementById("boot-overlay");
  if (!overlay) return;

  if (sessionStorage.getItem(BOOT_FLAG) === "true") {
    overlay.classList.add("boot-skip"); // Allerede set denne session — skip uden animation.
    return;
  }

  sessionStorage.setItem(BOOT_FLAG, "true"); // Så den ikke vises igen resten af sessionen.
  overlay.classList.add("booting"); // Trigger CSS-sekvensen (linjerne + fade-out).

  setTimeout(() => {
    overlay.remove(); // Fjern overlayet helt fra DOM'en, når animationen er færdig.
  }, BOOT_TOTAL_DURATION);
}

// DOMContentLoaded fyrer så snart HTML'en er parset, altså tidligere end
// "load" (som også venter på fonte/billeder) — det minimerer risikoen for
// at man når at se toppen af chatten, før vi rykker ned.
function setupCapabilitiesTransition() {
  const form = document.querySelector('form[action="/capabilities"]');
  if (!form) return; // Findes kun på velkomst-skærmen.

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    triggerPowerTransition(form); // Samme power-down/power-up-overgang som "Ny chat".
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupBootIntro();
  scrollChatToBottom();
  focusInput();
  setupCharCounterAndSendButton();
  scrambleLatestAnswer();
  scrambleWelcomeHeading();
  setupNewChatTransition();
  setupWelcomeTransition();
  setupCapabilitiesTransition();
  playPowerUpIfNeeded();
});

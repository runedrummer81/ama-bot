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
const SCRAMBLE_DELAY = 300; // ms — hvor længe der går før scramblet begynder.
const SCRAMBLE_FRAME_MS = 30; // ms mellem hvert "frame" i animationen — lavere tal = hurtigere/mere flimrende.
const SCRAMBLE_DURATION = 600; // ms — HELE afkodningen tager altid præcis denne tid, uanset svarets længde.
const SCRAMBLE_TOTAL_FRAMES = Math.round(SCRAMBLE_DURATION / SCRAMBLE_FRAME_MS);

function randomScrambleChar() {
  return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
}

function scrambleLatestAnswer() {
  const answerParagraphs = document.querySelectorAll(
    ".messages article.answer p",
  );
  if (answerParagraphs.length === 0) return;

  const target = answerParagraphs[answerParagraphs.length - 1]; // Den seneste af botens svar.
  const finalText = target.textContent;

  // Skjul den rigtige tekst med det samme (før man når at se den),
  // og vis i stedet tilfældige symboler i samme længde som svaret.
  target.textContent = finalText
    .split("")
    .map((char) => (char === " " ? " " : randomScrambleChar()))
    .join("");

  setTimeout(() => {
    let frame = 0;

    const intervalId = setInterval(() => {
      // Hvor mange bogstaver skal være afsløret ved dette frame, baseret på
      // hvor langt vi er i det FASTE antal frames — ikke i tegn-antallet.
      const revealCount = Math.floor(
        (frame / SCRAMBLE_TOTAL_FRAMES) * finalText.length,
      );

      target.textContent = finalText
        .split("")
        .map((char, index) => {
          if (char === " ") return " ";
          if (index < revealCount) return char; // Bogstaver "låses" gradvist fra venstre mod højre.
          return randomScrambleChar();
        })
        .join("");

      frame++;

      if (frame > SCRAMBLE_TOTAL_FRAMES) {
        target.textContent = finalText; // Sikrer at slutresultatet altid er 100% korrekt.
        clearInterval(intervalId);
      }
    }, SCRAMBLE_FRAME_MS);
  }, SCRAMBLE_DELAY);
}

const POWER_DOWN_DURATION = 350; // ms — SKAL matche varigheden af powerDown-animationen i styles.css.
const POWER_TRANSITION_FLAG = "justClickedNewChat"; // Nøglen vi bruger i sessionStorage.

function setupNewChatTransition() {
  const newChatForm = document.querySelector('form[action="/clear-messages"]');
  if (!newChatForm) return;

  newChatForm.addEventListener("submit", (event) => {
    event.preventDefault(); // Stop den normale, øjeblikkelige side-navigation.

    document.body.classList.add("powering-down"); // Trigger power-down-animationen.

    // Sæt et flag der overlever selve navigationen (sessionStorage nulstilles
    // ikke ved et almindeligt page-load), så vi ved på den NÆSTE side at det
    // var "Ny chat"-knappen der bragte os hertil, og kun DA skal power-up
    // effekten afspilles.
    sessionStorage.setItem(POWER_TRANSITION_FLAG, "true");

    // Vent til animationen er færdig, før vi rent faktisk sender
    // formularen og navigerer væk fra siden.
    setTimeout(() => {
      newChatForm.submit(); // .submit() (i modsætning til .requestSubmit()) trigger IKKE "submit"-eventet igen, så vi undgår en uendelig løkke.
    }, POWER_DOWN_DURATION);
  });
}

function playPowerUpIfNeeded() {
  if (sessionStorage.getItem(POWER_TRANSITION_FLAG) === "true") {
    document.body.classList.add("powering-up"); // Trigger power-up-animationen KUN denne ene gang.
    sessionStorage.removeItem(POWER_TRANSITION_FLAG); // Ryd flaget, så almindelige reloads ikke trigger den igen.
  }
}

// DOMContentLoaded fyrer så snart HTML'en er parset, altså tidligere end
// "load" (som også venter på fonte/billeder) — det minimerer risikoen for
// at man når at se toppen af chatten, før vi rykker ned.
document.addEventListener("DOMContentLoaded", () => {
  scrollChatToBottom();
  focusInput();
  setupCharCounterAndSendButton();
  scrambleLatestAnswer();
  setupNewChatTransition();
  playPowerUpIfNeeded();
});

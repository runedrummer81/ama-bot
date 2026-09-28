(() => {
  const canvases = [0, 1, 2, 3, 4, 5, 6].map((i) =>
    document.getElementById(`bg-layer-${i}`),
  );
  if (canvases.some((c) => !c)) return;
  const ctxs = canvases.map((c) => c.getContext("2d"));

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  function themeColor(varName, fallback) {
    const val = getComputedStyle(document.documentElement)
      .getPropertyValue(varName)
      .trim();
    return val || fallback;
  }

  const aqua = themeColor("--color-aqua", "#33c2cc");
  const headColor = themeColor("--color-text", "#e8f6f8");
  const fontFamily = themeColor("--font-mono", "monospace") || "monospace";

  const CHARSET = "01#$%&*+-/<>=?ABCDEF0123456789";

  // Minimum fart (px/frame) under "dræn", så skærmen bliver tom på få sekunder
  // i stedet for at vente på de langsomme baglag. Lavere tal = længere dræn.
  const DRAIN_MIN_SPEED = 8;

  // Zoom pr. lag under warp. SKAL matche scale-værdierne i warpScale0..6
  // i styles.css. Bruges til kun at regne med det SYNLIGE område.
  const WARP_SCALES = [1.3, 1.5, 1.75, 2.05, 2.4, 2.75, 3.1];
  const NO_ZOOM = [1, 1, 1, 1, 1, 1, 1];

  // Bagerst (0) -> forrest (6): mindre/svag/langsom -> stor/skarp/hurtig
  const LAYERS = [
    { fontSize: 10, speedMin: 0.5, speedMax: 0.8, alpha: 0.14, trail: 6 },
    { fontSize: 11, speedMin: 0.6, speedMax: 1.0, alpha: 0.2, trail: 7 },
    { fontSize: 13, speedMin: 0.8, speedMax: 1.2, alpha: 0.28, trail: 8 },
    { fontSize: 14, speedMin: 1.0, speedMax: 1.5, alpha: 0.38, trail: 9 },
    { fontSize: 16, speedMin: 1.2, speedMax: 1.8, alpha: 0.5, trail: 10 },
    { fontSize: 18, speedMin: 1.5, speedMax: 2.2, alpha: 0.65, trail: 11 },
    { fontSize: 20, speedMin: 1.8, speedMax: 2.6, alpha: 0.8, trail: 12 },
  ];

  // "Chat-tilstand": større tegn, mere mellemrum, roligere fart. Bruges ikke
  // længere til at genstarte regnen i chatten (den er erstattet af
  // grid-gulvet nedenfor), men beholdes for setChatMode()'s skyld, hvis vi
  // får brug for den et andet sted senere.
  const CHAT_LAYERS = LAYERS.map((layerDef) => ({
    ...layerDef,
    fontSize: Math.round(layerDef.fontSize * 1.6),
    speedMin: layerDef.speedMin * 0.55,
    speedMax: layerDef.speedMax * 0.55,
  }));

  let width, height, dpr;
  let columns = [];
  let animationFrame = null;
  let isRunning = false;

  let qualityMult = 1;
  let fpsCheckStart = null;
  let fpsFrameCount = 0;
  let fpsSettled = false;

  let activeLayers = LAYERS;
  let speedMult = 1;
  let isDraining = false;
  let layerZoom = NO_ZOOM;

  // Zoom er omkring skærmens midte, så kun en del af canvas'et er synligt.
  // Returnerer synlig top/bund i canvas-koordinater for et lag.
  function visibleTop(layer) {
    return (height / 2) * (1 - 1 / layerZoom[layer]);
  }
  function visibleBottom(layer) {
    return (height / 2) * (1 + 1 / layerZoom[layer]);
  }

  function randomChar() {
    return CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }

  // fromTop = true: kolonnen starter over skærmens top (spredt ud i højden),
  // så et nyt "regnskyl" kommer ind oppefra i stedet for at poppe frem midt
  // på skærmen. Trail'en hænger opad fra hovedet, så intet er synligt endnu.
  function makeColumn(layerIndex, x, fromTop = false) {
    const layerDef = activeLayers[layerIndex];
    const cell = layerDef.fontSize * 1.15;
    const y = fromTop
      ? -Math.random() * height * 1.2
      : -height * 0.3 + Math.random() * height * 1.6;

    return {
      layer: layerIndex,
      x,
      y,
      speed:
        layerDef.speedMin +
        Math.random() * (layerDef.speedMax - layerDef.speedMin),
      color: aqua,
      cell,
      dead: false,
      chars: Array.from({ length: layerDef.trail }, () => randomChar()),
    };
  }

  function initColumns(fromTop = false) {
    // Under et dræn må kolonner aldrig genoplives (fx via resize,
    // FPS-check eller setChatMode) — ellers popper matrixen tilbage.
    if (isDraining) return;

    columns = [];
    activeLayers.forEach((layerDef, layerIndex) => {
      const spacing = layerDef.fontSize * 1.3;
      const count = Math.max(6, Math.round((width / spacing) * qualityMult));
      const actualSpacing = width / count;

      for (let i = 0; i < count; i++) {
        const x = actualSpacing * i + actualSpacing / 2;
        columns.push(makeColumn(layerIndex, x, fromTop));
      }
    });
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    width = window.innerWidth;
    height = window.innerHeight;
    canvases.forEach((canvas, i) => {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctxs[i].setTransform(dpr, 0, 0, dpr, 0, 0);
    });
    initColumns();
  }

  function drawColumn(ctx, col) {
    const layerDef = activeLayers[col.layer];
    for (let i = 0; i < layerDef.trail; i++) {
      const pos = col.y - i * col.cell;
      if (pos < -col.cell || pos > height + col.cell) continue;

      const t = i / layerDef.trail;
      const alpha = Math.min(layerDef.alpha * (1 - t) * (i === 0 ? 1.5 : 1), 1);

      ctx.globalAlpha = alpha;
      ctx.fillStyle = i === 0 ? headColor : col.color;
      ctx.fillText(col.chars[i], col.x, pos);
    }
  }

  function updateColumn(col) {
    const layerDef = activeLayers[col.layer];
    const step = col.speed * speedMult;
    col.y += isDraining ? Math.max(step, DRAIN_MIN_SPEED) : step;

    if (Math.random() < 0.05) {
      const idx = Math.floor(Math.random() * col.chars.length);
      col.chars[idx] = randomChar();
    }

    const totalTrail = layerDef.trail * col.cell;
    const bottom = isDraining ? visibleBottom(col.layer) : height;
    if (col.y - totalTrail > bottom) {
      if (isDraining) {
        col.dead = true;
      } else {
        col.y = -Math.random() * height * 0.6;
        col.chars = Array.from({ length: layerDef.trail }, () => randomChar());
      }
    }
  }

  function draw() {
    ctxs.forEach((c) => c.clearRect(0, 0, width, height));

    activeLayers.forEach((layerDef, layerIndex) => {
      const ctx = ctxs[layerIndex];
      ctx.font = `${layerDef.fontSize}px ${fontFamily}`;
      ctx.textBaseline = "middle";

      columns
        .filter((col) => col.layer === layerIndex && !col.dead)
        .forEach((col) => {
          drawColumn(ctx, col);
          updateColumn(col);
        });

      ctx.globalAlpha = 1;
    });
  }

  // Stopper al spawning. Kolonner hvis hoved stadig er over skærmen har ingen
  // synlige tegn endnu, så de fjernes med det samme — resten får lov at
  // falde ud af bunden af sig selv.
  function startDraining() {
    if (isDraining) return;
    isDraining = true;
    for (const col of columns) {
      if (col.y < visibleTop(col.layer)) col.dead = true;
    }
  }

  // Resolver når skærmen er helt tom for matrix-tegn (eller ved timeout).
  function drain(maxWaitMs = 8000) {
    startDraining();
    return new Promise((resolve) => {
      const start = performance.now();
      function check() {
        const stillFalling = columns.some((c) => !c.dead);
        const timedOut = performance.now() - start > maxWaitMs;
        if (!stillFalling) {
          resolve();
        } else if (timedOut) {
          for (const c of columns) c.dead = true;
          resolve();
        } else {
          requestAnimationFrame(check);
        }
      }
      requestAnimationFrame(check);
    });
  }

  // Genstarter regnen. fromTop = true lader kolonnerne komme ind oppefra.
  // Bruges nu kun ved "Ny chat" (retur til velkomstskærmen) — ikke længere
  // ved chat-åbning, som i stedet viser grid-gulvet (se nedenfor).
  function resumeSpawning({ fromTop = false } = {}) {
    isDraining = false;
    speedMult = 1;
    layerZoom = NO_ZOOM;
    if (width && height) {
      initColumns(fromTop);
    }
  }

  function checkPerformance(now) {
    if (fpsSettled) return;
    if (fpsCheckStart === null) {
      fpsCheckStart = now;
      fpsFrameCount = 0;
    }
    fpsFrameCount++;
    const elapsed = now - fpsCheckStart;
    if (elapsed >= 2000) {
      const fps = (fpsFrameCount / elapsed) * 1000;
      fpsSettled = true;
      if (fps < 35) {
        qualityMult = 0.4;
        initColumns();
      } else if (fps < 50) {
        qualityMult = 0.7;
        initColumns();
      }
    }
  }

  function animate(now) {
    checkPerformance(now || performance.now());
    draw();
    if (!document.hidden) {
      animationFrame = requestAnimationFrame(animate);
    } else {
      isRunning = false;
    }
  }

  function startLoop() {
    if (isRunning) return;
    isRunning = true;
    animationFrame = requestAnimationFrame(animate);
  }

  // Skifter til/fra "chat-tilstand": større tegn, mere mellemrum, roligere
  // fart. Under et dræn genopbygges kolonnerne ikke her — det sker først i
  // resumeSpawning(). Ubrugt lige nu (matrixen genstarter ikke i chatten
  // længere), men skader ikke at beholde.
  function setChatMode(on) {
    const next = on ? CHAT_LAYERS : LAYERS;
    if (next === activeLayers) return;
    activeLayers = next;
    document.body.classList.toggle("bg-chat-mode", on);
    if (width && height) {
      initColumns();
    }
  }

  // "Rejse gennem matrixen": speedMult accelererer op til et peak. Når
  // accelerationen er slut, stopper spawning (dræn starter), og tegnene
  // falder ud af det SYNLIGE område. Promise'en resolver først når skærmen
  // er tom — så app.js kan åbne chatten med det samme (ingen drain() nødvendig).
  function warp(durationMs, maxExtraWaitMs = 6000) {
    const ACCEL_FRACTION = 0.35;
    const PEAK_MULT = 9;
    const SLOW_MULT = 4;

    function easeInQuad(x) {
      return x * x;
    }
    function easeOutCubic(x) {
      return 1 - Math.pow(1 - x, 3);
    }

    // Reduced motion: loopet kører ikke, så der er intet at vente på.
    if (prefersReducedMotion) {
      for (const c of columns) c.dead = true;
      return Promise.resolve();
    }

    layerZoom = WARP_SCALES;

    return new Promise((resolve) => {
      const start = performance.now();
      let drainStarted = false;

      function step(now) {
        const elapsed = Math.max(0, now - start);
        const t = Math.min(elapsed / durationMs, 1);

        if (t < ACCEL_FRACTION) {
          const p = t / ACCEL_FRACTION;
          speedMult = 1 + easeInQuad(p) * (PEAK_MULT - 1);
        } else {
          const p = (t - ACCEL_FRACTION) / (1 - ACCEL_FRACTION);
          speedMult = PEAK_MULT - easeOutCubic(p) * (PEAK_MULT - SLOW_MULT);
        }

        // Stop spawning ved topfart — fra nu af kommer der ingen nye kæder
        if (!drainStarted && t >= ACCEL_FRACTION) {
          drainStarted = true;
          startDraining();
        }

        // Færdig så snart alle tegn er ude af det synlige område
        // (speedMult bliver stående; resumeSpawning() nulstiller den).
        if (drainStarted && columns.every((c) => c.dead)) {
          resolve();
          return;
        }

        // Sikkerhedsnet mod at hænge
        if (elapsed > durationMs + maxExtraWaitMs) {
          for (const c of columns) c.dead = true;
          resolve();
          return;
        }

        requestAnimationFrame(step);
      }

      requestAnimationFrame(step);
    });
  }

  window.matrixBg = { warp, setChatMode, drain, resumeSpawning };

  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !prefersReducedMotion) {
      startLoop();
    }
  });

  resize();

  if (prefersReducedMotion) {
    draw();
  } else {
    startLoop();
  }
})();

// ==========================================================================
// Grid-gulv — den permanente chat-baggrund. Tegner kontinuerligt (også mens
// den er skjult under skærmkanten), så den allerede er i bevægelse, når den
// glider op i sigte. Uafhængig af matrix-canvasene ovenfor.
// ==========================================================================
(() => {
  const canvas = document.getElementById("grid-floor");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  function themeColor(varName, fallback) {
    const val = getComputedStyle(document.documentElement)
      .getPropertyValue(varName)
      .trim();
    return val || fallback;
  }

  const aquaRgb = "51,194,204"; // matcher --color-aqua (#33c2cc)
  const coralRgb = "234,72,132"; // matcher --color-coral (#ea4884)

  // Skal matche varigheden af `.grid-floor.is-rising` i styles.css.
  const RISE_MS = 900;

  let gw = 0,
    gh = 0,
    gdpr = 1;
  let breathT = 0;
  let gridOffset = 0;

  // Beskedpanelet, som "spotlight"-trekanten skal flugte med (se draw()).
  // Caches én gang — elementet forsvinder aldrig fra DOM'et, det skifter
  // bare synlighed via .is-hidden.
  const messagesEl = document.getElementById("messages");

  function resize() {
    gdpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const rect = canvas.getBoundingClientRect();
    gw = rect.width;
    gh = rect.height;
    canvas.width = gw * gdpr;
    canvas.height = gh * gdpr;
    ctx.setTransform(gdpr, 0, 0, gdpr, 0, 0);
  }

  // Canvas'et ER selve "gulvet" — toppen af canvas'et er horisonten, så der
  // er ingen ekstra offset at regne med, modsat en fuldskærms-version.
  function draw() {
    if (!gw || !gh) {
      requestAnimationFrame(draw);
      return;
    }

    ctx.clearRect(0, 0, gw, gh);

    breathT += 0.025;
    const breathe = 0.5 + 0.5 * Math.sin(breathT);
    const cols = 12;

    // Glød der falder ned fra horisonten (= toppen af laget)
    const glowH = gh * 0.6;
    const grad = ctx.createLinearGradient(0, 0, 0, glowH);
    grad.addColorStop(0, `rgba(${aquaRgb},${0.18 + 0.14 * breathe})`);
    grad.addColorStop(1, `rgba(${aquaRgb},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, gw, glowH);

    // "Spotlight"-trekant: spidsen forsvinder på horisonten (lokal y=0,
    // midt for beskedpanelet), og basen rammer PANELETS EGNE bund-hjørner
    // — ikke forkanten af gulvet. Panelets bundkant (rect.bottom) omregnes
    // til gulv-canvas'ets lokale koordinater (canvasTop = skærm-y for lokal
    // y=0), så trekanten stopper og "går i et med" panelets bundlinje
    // præcis der hvor kanten allerede er, uanset hvor højt/lavt panelet
    // sidder over gulvet. Fordi vi tegner den her — på selve gulv-canvas'et,
    // FØR gitterlinjerne — arver den også samme streg-stil som gulvet, og
    // gitteret tegnes ovenpå den.
    if (
      messagesEl &&
      !messagesEl.classList.contains("is-hidden") &&
      messagesEl.offsetParent !== null
    ) {
      const rect = messagesEl.getBoundingClientRect();
      const canvasTop = window.innerHeight - gh; // skærm-y for lokal y=0
      const baseY = Math.min(Math.max(rect.bottom - canvasTop, 0), gh);

      if (rect.width > 0 && baseY > 0) {
        const apexX = rect.left + rect.width / 2;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(apexX, 0);
        ctx.lineTo(rect.right, baseY);
        ctx.lineTo(rect.left, baseY);
        ctx.closePath();
        ctx.clip();

        const beamGrad = ctx.createLinearGradient(0, 0, 0, baseY);
        beamGrad.addColorStop(0, `rgba(${aquaRgb},${0.55 + 0.25 * breathe})`);
        beamGrad.addColorStop(1, `rgba(${aquaRgb},0.05)`);
        ctx.fillStyle = beamGrad;
        ctx.fillRect(0, 0, gw, baseY);
        ctx.restore();

        // Svage kant-linjer langs trekantens to sider
        ctx.strokeStyle = `rgba(232,246,248,${0.22 + 0.12 * breathe})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(apexX, 0);
        ctx.lineTo(rect.right, baseY);
        ctx.moveTo(apexX, 0);
        ctx.lineTo(rect.left, baseY);
        ctx.stroke();
      }
    }

    // Skarp, pulserende neon-linje ved horisonten
    ctx.save();
    ctx.shadowColor = `rgba(${aquaRgb},0.9)`;
    ctx.shadowBlur = 8 + 6 * breathe;
    ctx.strokeStyle = `rgba(${aquaRgb},${0.55 + 0.35 * breathe})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0.5);
    ctx.lineTo(gw, 0.5);
    ctx.stroke();
    ctx.restore();

    // Vandrette linjer, der ruller mod betragteren
    const rows = 10;
    for (let i = 0; i < rows; i++) {
      const t = ((i + gridOffset * 0.02) % rows) / rows;
      const y = t * t * gh;
      const alpha = 0.45 * (1 - t);
      ctx.strokeStyle = `rgba(${aquaRgb},${alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(gw, y);
      ctx.stroke();
    }
    gridOffset += 1.4;

    // Konvergerende lodrette linjer — hver 4. er coral
    for (let i = 0; i <= cols; i++) {
      const top = gw / 2 + (i - cols / 2) * (gw * 0.03);
      const bottom = gw / 2 + (i - cols / 2) * (gw * 0.16);
      const isCoral = i % 4 === 0;
      ctx.strokeStyle = isCoral
        ? `rgba(${coralRgb},0.28)`
        : `rgba(${aquaRgb},0.22)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(top, 0);
      ctx.lineTo(bottom, gh);
      ctx.stroke();
    }

    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);
  resize();

  if (!prefersReducedMotion) {
    requestAnimationFrame(draw);
  } else {
    draw(); // én statisk frame
  }

  window.gridFloor = {
    // Glider gulvet op i sigte. Resolver når animationen er færdig.
    rise() {
      canvas.classList.add("is-rising");
      return new Promise((resolve) => setTimeout(resolve, RISE_MS));
    },
    // Skjuler gulvet igen uden animation, klar til at rejse sig næste gang.
    reset() {
      canvas.classList.remove("is-rising");
    },
  };
})();

(() => {
  const canvases = [
    document.getElementById("bg-layer-0"),
    document.getElementById("bg-layer-1"),
    document.getElementById("bg-layer-2"),
    document.getElementById("bg-layer-3"),
    document.getElementById("bg-layer-4"),
  ];
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
  const coral = themeColor("--color-coral", "#ea4884");
  const dimColor = themeColor("--color-text-dim", "#6b7a94");
  const fontFamily = themeColor("--font-mono", "monospace") || "monospace";

  const CHARSET = "01#$%&*+-/<>=?ABCDEF0123456789";
  const WORDS = [
    "SVAR",
    "AMABOT",
    "ONLINE",
    "KLAR",
    "AKTIV",
    "FORBUNDET",
    "RUNE",
    "SYSTEM",
  ];

  const LAYERS = [
    {
      fontSize: 9,
      speedMin: 0.03,
      speedMax: 0.07,
      alpha: 0.15,
      interactive: false,
      density: 30000,
    },
    {
      fontSize: 11,
      speedMin: 0.06,
      speedMax: 0.12,
      alpha: 0.22,
      interactive: false,
      density: 40000,
    },
    {
      fontSize: 13,
      speedMin: 0.1,
      speedMax: 0.18,
      alpha: 0.32,
      interactive: false,
      density: 50000,
    },
    {
      fontSize: 15,
      speedMin: 0.18,
      speedMax: 0.28,
      alpha: 0.5,
      interactive: false,
      density: 60000,
    },
    {
      fontSize: 17,
      speedMin: 0.28,
      speedMax: 0.42,
      alpha: 0.85,
      interactive: true,
      density: 70000,
    },
  ];

  const REVEAL_MS = 650;
  const HOLD_MS = 1200;
  const REVERT_MS = 500;

  let width, height, dpr;
  let streams = [];
  let animationFrame = null;
  const mouse = { x: null, y: null };
  let hoveredStream = null;

  function randomChar() {
    return CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }

  function charWidth(fontSize) {
    return fontSize * 0.62;
  }

  function makeStream(layerIndex, y) {
    const layerDef = LAYERS[layerIndex];
    const length = 16 + Math.floor(Math.random() * 10);
    const chars = Array.from({ length }, randomChar);
    const cw = charWidth(layerDef.fontSize);
    const textWidth = length * cw;

    return {
      layer: layerIndex,
      y,
      x: Math.random() * (width + textWidth) - textWidth,
      length,
      chars,
      speed:
        layerDef.speedMin +
        Math.random() * (layerDef.speedMax - layerDef.speedMin),
      state: "drift",
      wordStart: -1,
      wordEnd: -1,
      word: "",
      phaseStart: 0,
      hoverT: 0,
    };
  }

  function initStreams() {
    streams = [];
    LAYERS.forEach((layerDef, layerIndex) => {
      const rawCount = Math.round((width * height) / layerDef.density);
      const count = Math.max(4, Math.min(rawCount, 22)) * qualityMult;
      const finalCount = Math.max(3, Math.round(count));
      const band = height / finalCount;
      for (let i = 0; i < finalCount; i++) {
        const y = band * i + band * 0.5 + (Math.random() - 0.5) * band * 0.4;
        streams.push(makeStream(layerIndex, y));
      }
    });
  }

  let qualityMult = 1;
  let fpsCheckStart = null;
  let fpsFrameCount = 0;
  let fpsSettled = false;

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
        initStreams();
      } else if (fps < 50) {
        qualityMult = 0.7;
        initStreams();
      }
    }
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
    initStreams();
  }

  function triggerReveal(stream) {
    const candidate = WORDS[Math.floor(Math.random() * WORDS.length)];
    if (candidate.length > stream.length - 4) return;
    const word = candidate;
    const maxStart = stream.length - word.length - 1;
    const start = 1 + Math.floor(Math.random() * Math.max(1, maxStart - 1));

    stream.state = "revealing";
    stream.word = word;
    stream.wordStart = start;
    stream.wordEnd = start + word.length;
    stream.phaseStart = performance.now();
  }

  function updateStreamPhase(stream, now) {
    if (stream.state === "revealing") {
      const elapsed = now - stream.phaseStart;
      const wl = stream.wordEnd - stream.wordStart;
      for (let i = stream.wordStart; i < stream.wordEnd; i++) {
        const idx = i - stream.wordStart;
        const lockTime = (idx / wl) * REVEAL_MS;
        if (elapsed >= lockTime) {
          stream.chars[i] = stream.word[idx];
        } else if (Math.random() < 0.5) {
          stream.chars[i] = randomChar();
        }
      }
      if (elapsed >= REVEAL_MS) {
        stream.state = "held";
        stream.phaseStart = now;
      }
    } else if (stream.state === "held") {
      if (now - stream.phaseStart >= HOLD_MS) {
        stream.state = "reverting";
        stream.phaseStart = now;
      }
    } else if (stream.state === "reverting") {
      const elapsed = now - stream.phaseStart;
      const wl = stream.wordEnd - stream.wordStart;
      for (let i = stream.wordStart; i < stream.wordEnd; i++) {
        const idx = i - stream.wordStart;
        const unlockTime = (idx / wl) * REVERT_MS;
        if (elapsed >= unlockTime) {
          stream.chars[i] = randomChar();
        }
      }
      if (elapsed >= REVERT_MS) {
        stream.state = "drift";
        stream.wordStart = -1;
        stream.wordEnd = -1;
      }
    }
  }

  function hitTest(stream, layerDef, px, py) {
    const cw = charWidth(layerDef.fontSize);
    const textWidth = stream.length * cw;
    const top = stream.y - layerDef.fontSize / 2 - 8;
    const bottom = stream.y + layerDef.fontSize / 2 + 8;
    return (
      px >= stream.x && px <= stream.x + textWidth && py >= top && py <= bottom
    );
  }

  function findHovered() {
    if (mouse.x === null) return null;
    const layerIndex = LAYERS.length - 1;
    const layerDef = LAYERS[layerIndex];
    for (const s of streams) {
      if (s.layer !== layerIndex) continue;
      if (hitTest(s, layerDef, mouse.x, mouse.y)) return s;
    }
    return null;
  }

  function draw() {
    ctxs.forEach((c) => c.clearRect(0, 0, width, height));
    const now = performance.now();
    hoveredStream = findHovered();
    canvases[canvases.length - 1].style.cursor = hoveredStream
      ? "pointer"
      : "default";

    LAYERS.forEach((layerDef, layerIndex) => {
      const ctx = ctxs[layerIndex];
      ctx.font = `${layerDef.fontSize}px ${fontFamily}`;
      ctx.textBaseline = "middle";

      streams
        .filter((s) => s.layer === layerIndex)
        .forEach((stream) => {
          if (stream.state !== "drift") {
            updateStreamPhase(stream, now);
          } else if (Math.random() < 0.03) {
            const idx = Math.floor(Math.random() * stream.length);
            stream.chars[idx] = randomChar();
          }

          const targetHover =
            layerDef.interactive && stream === hoveredStream ? 1 : 0;
          stream.hoverT += (targetHover - stream.hoverT) * 0.08;
          const speedMult = 1 - stream.hoverT * 0.85;

          stream.x += stream.speed * speedMult;
          const cw = charWidth(layerDef.fontSize);
          const textWidth = stream.length * cw;
          if (stream.x > width) {
            stream.x = -textWidth;
          }

          const baseAlpha = layerDef.alpha;
          ctx.globalAlpha = baseAlpha + stream.hoverT * (1 - baseAlpha) * 0.6;

          for (let i = 0; i < stream.length; i++) {
            const isWordChar =
              stream.wordStart >= 0 &&
              i >= stream.wordStart &&
              i < stream.wordEnd;
            ctx.fillStyle = isWordChar
              ? coral
              : stream.hoverT > 0.3
                ? aqua
                : dimColor;
            ctx.fillText(stream.chars[i], stream.x + i * cw, stream.y);
          }
        });
      ctx.globalAlpha = 1;
    });
  }

  let isRunning = false;

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

  window.addEventListener("resize", resize);
  window.addEventListener("mousemove", (e) => {
    const topEl = document.elementFromPoint(e.clientX, e.clientY);
    const overStreamLayer = canvases.includes(topEl);
    mouse.x = overStreamLayer ? e.clientX : null;
    mouse.y = overStreamLayer ? e.clientY : null;
  });
  window.addEventListener("mouseleave", () => {
    mouse.x = null;
    mouse.y = null;
  });
  canvases[canvases.length - 1].addEventListener("click", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    const hit = findHovered();
    if (hit && hit.state === "drift") {
      triggerReveal(hit);
    }
  });
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

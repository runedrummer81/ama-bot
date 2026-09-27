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

  let width, height, dpr;
  let columns = [];
  let animationFrame = null;
  let isRunning = false;

  let qualityMult = 1;
  let fpsCheckStart = null;
  let fpsFrameCount = 0;
  let fpsSettled = false;

  function randomChar() {
    return CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }

  function makeColumn(layerIndex, x) {
    const layerDef = LAYERS[layerIndex];
    const cell = layerDef.fontSize * 1.15;
    const y = -height * 0.3 + Math.random() * height * 1.6;

    return {
      layer: layerIndex,
      x,
      y,
      speed:
        layerDef.speedMin +
        Math.random() * (layerDef.speedMax - layerDef.speedMin),
      color: aqua,
      cell,
    };
  }

  function initColumns() {
    columns = [];
    LAYERS.forEach((layerDef, layerIndex) => {
      const spacing = layerDef.fontSize * 1.3;
      const count = Math.max(6, Math.round((width / spacing) * qualityMult));
      const actualSpacing = width / count;

      for (let i = 0; i < count; i++) {
        const x = actualSpacing * i + actualSpacing / 2;
        columns.push(makeColumn(layerIndex, x));
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
    const layerDef = LAYERS[col.layer];
    for (let i = 0; i < layerDef.trail; i++) {
      const pos = col.y - i * col.cell;
      if (pos < -col.cell || pos > height + col.cell) continue;

      const t = i / layerDef.trail;
      const alpha = Math.min(layerDef.alpha * (1 - t) * (i === 0 ? 1.5 : 1), 1);

      ctx.globalAlpha = alpha;
      ctx.fillStyle = i === 0 ? headColor : col.color;
      ctx.fillText(randomChar(), col.x, pos);
    }
  }

  function updateColumn(col) {
    const layerDef = LAYERS[col.layer];
    col.y += col.speed;

    const totalTrail = layerDef.trail * col.cell;
    if (col.y - totalTrail > height) {
      col.y = -Math.random() * height * 0.6;
    }
  }

  function draw() {
    ctxs.forEach((c) => c.clearRect(0, 0, width, height));

    LAYERS.forEach((layerDef, layerIndex) => {
      const ctx = ctxs[layerIndex];
      ctx.font = `${layerDef.fontSize}px ${fontFamily}`;
      ctx.textBaseline = "middle";

      columns
        .filter((col) => col.layer === layerIndex)
        .forEach((col) => {
          drawColumn(ctx, col);
          updateColumn(col);
        });

      ctx.globalAlpha = 1;
    });
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

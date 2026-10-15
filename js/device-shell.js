/* Memory Palace — device shell controller
   Desktop + Pad: shelled CSS-3D unit (drag bezel to spin).
   Real narrow phone: full-bleed, no fake island.
   CRITICAL: screen interior keeps pointer-events — tilt/drag never steal clicks. */
(function () {
  const STORAGE_MODEL = "lt-palace-shell-model";
  const STORAGE_FINISH = "lt-palace-shell";

  const MODELS = [
    { id: "island", name: "Island Pro", topChrome: "island" },
    { id: "notch", name: "Classic Notch", topChrome: "notch" },
    { id: "hole", name: "Android Hole", topChrome: "hole" },
    { id: "clean", name: "Clean", topChrome: "none" },
  ];

  const FINISHES = [
    { id: "obsidian", name: "Obsidian", swatch: "#1a1c20" },
    { id: "sterling", name: "Sterling", swatch: "#c5cad3" },
    { id: "champagne", name: "Champagne", swatch: "#c9a86a" },
    { id: "cobalt", name: "Cobalt", swatch: "#1e3a6e" },
    { id: "crimson", name: "Crimson", swatch: "#8b1e2d" },
    { id: "glacier", name: "Glacier", swatch: "#7eb8d4" },
    { id: "amethyst", name: "Amethyst", swatch: "#5b3d8a" },
    { id: "graphite", name: "Graphite", swatch: "#4a4d52" },
    { id: "pearl", name: "Pearl", swatch: "#e8e4dc" },
    { id: "sand", name: "Sand", swatch: "#b5a894" },
  ];

  const stage = document.getElementById("demo-stage");
  const unit = document.getElementById("device-unit");
  const rig = document.getElementById("device-rig");
  const swatches = document.getElementById("shell-swatches");
  const modelEl = document.getElementById("shell-models");
  const nameEl = document.getElementById("shell-name");
  const screenEl = document.querySelector(".device-screen");
  if (!stage || !unit || !rig) return;

  // Rotation state (deg)
  let rotX = 0;
  let rotY = 0;
  let dragging = false;
  let dragMoved = false;
  let lastX = 0;
  let lastY = 0;
  let hoverTiltX = 0;
  let hoverTiltY = 0;

  function tShell(key, fallback) {
    try {
      const I18N = window.LT_I18N;
      if (!I18N) return fallback;
      const loc = document.documentElement.lang || "en";
      const code = loc.startsWith("zh") ? "zh" : loc.slice(0, 2);
      const pack = I18N.strings[code] || I18N.strings.en;
      return pack[key] != null ? pack[key] : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function isRealPhone() {
    const params = new URLSearchParams(location.search);
    if (params.get("forcePhone") === "1") return true;
    if (params.get("forceShell") === "1") return false;
    return window.matchMedia("(max-width: 540px)").matches;
  }

  function prefersReduced() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function isOverScreen(target) {
    if (!target || !screenEl) return false;
    return screenEl.contains(target) || (target.closest && target.closest(".device-screen"));
  }

  function applyTransform() {
    if (isRealPhone()) {
      unit.style.setProperty("--shell-tilt-x", "0deg");
      unit.style.setProperty("--shell-tilt-y", "0deg");
      unit.classList.remove("is-back");
      return;
    }
    const x = rotX + hoverTiltX;
    const y = rotY + hoverTiltY;
    unit.style.setProperty("--shell-tilt-x", x.toFixed(2) + "deg");
    unit.style.setProperty("--shell-tilt-y", y.toFixed(2) + "deg");
    // When mostly showing the back, disable front screen hits
    const backFacing = Math.abs(((y % 360) + 360) % 360 - 180) < 90;
    unit.classList.toggle("is-back", backFacing);
  }

  function fitScale() {
    if (isRealPhone()) {
      stage.style.setProperty("--shell-fit", "1");
      return;
    }
    // Fit portrait unit into available viewport under chrome bars
    const availH = Math.max(420, window.innerHeight - 200);
    const availW = Math.max(280, Math.min(window.innerWidth - 48, 520));
    const unitH = 900; // bezel + padding approx
    const unitW = 430;
    const s = Math.min(1, availH / unitH, availW / unitW);
    stage.style.setProperty("--shell-fit", s.toFixed(3));
  }

  function applyMode() {
    const phone = isRealPhone();
    document.body.classList.toggle("is-real-phone", phone);
    stage.dataset.mode = phone ? "unshelled" : "shelled";
    stage.classList.toggle("is-floating", !phone && !prefersReduced() && !dragging);
    if (phone) {
      rotX = 0;
      rotY = 0;
      hoverTiltX = 0;
      hoverTiltY = 0;
      unit.dataset.topChrome = "none";
      stage.dataset.topChrome = "none";
    } else {
      const model = MODELS.find((m) => m.id === unit.dataset.model) || MODELS[0];
      unit.dataset.topChrome = model.topChrome;
      stage.dataset.topChrome = model.topChrome;
    }
    applyTransform();
    fitScale();
  }

  function applyModel(id, persist) {
    const model = MODELS.find((m) => m.id === id) || MODELS[0];
    unit.dataset.model = model.id;
    stage.dataset.model = model.id;
    if (!isRealPhone()) {
      unit.dataset.topChrome = model.topChrome;
      stage.dataset.topChrome = model.topChrome;
    } else {
      unit.dataset.topChrome = "none";
      stage.dataset.topChrome = "none";
    }
    if (modelEl) {
      modelEl.querySelectorAll(".shell-model").forEach((b) => {
        const on = b.dataset.model === model.id;
        b.classList.toggle("is-on", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
    }
    updateName();
    if (persist !== false) {
      try {
        localStorage.setItem(STORAGE_MODEL, model.id);
      } catch (_) {}
    }
  }

  function applyFinish(id, persist) {
    const finish = FINISHES.find((s) => s.id === id) || FINISHES[0];
    unit.dataset.shell = finish.id;
    stage.dataset.shell = finish.id;
    if (swatches) {
      swatches.querySelectorAll(".shell-swatch").forEach((b) => {
        b.classList.toggle("is-on", b.dataset.shell === finish.id);
        b.setAttribute("aria-selected", b.dataset.shell === finish.id ? "true" : "false");
      });
    }
    updateName();
    if (persist !== false) {
      try {
        localStorage.setItem(STORAGE_FINISH, finish.id);
      } catch (_) {}
    }
  }

  function updateName() {
    if (!nameEl) return;
    const model = MODELS.find((m) => m.id === unit.dataset.model) || MODELS[0];
    const finish = FINISHES.find((s) => s.id === unit.dataset.shell) || FINISHES[0];
    nameEl.textContent = model.name + " · " + finish.name;
  }

  function buildModels() {
    if (!modelEl) return;
    modelEl.innerHTML = "";
    MODELS.forEach((m) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "shell-model";
      btn.dataset.model = m.id;
      btn.dataset.topChrome = m.topChrome;
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-label", m.name);
      btn.textContent = m.name;
      btn.title = m.name + " (" + m.topChrome + ")";
      btn.addEventListener("click", () => applyModel(m.id));
      modelEl.appendChild(btn);
    });
  }

  function buildSwatches() {
    if (!swatches) return;
    swatches.innerHTML = "";
    FINISHES.forEach((s) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "shell-swatch";
      btn.dataset.shell = s.id;
      btn.style.background = `linear-gradient(145deg, ${s.swatch}, #000)`;
      btn.title = s.name;
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-label", s.name);
      btn.addEventListener("click", () => applyFinish(s.id));
      swatches.appendChild(btn);
    });
  }

  /* —— Interaction: screen clicks ALWAYS win ——
     Hover tilt: only when pointer is over rig but NOT over .device-screen
     Drag rotate: pointerdown on bezel/rim/back (not screen); move rotates */
  function onHoverMove(e) {
    if (isRealPhone() || prefersReduced() || dragging) return;
    const target = e.target;
    if (isOverScreen(target)) {
      hoverTiltX = 0;
      hoverTiltY = 0;
      applyTransform();
      return;
    }
    const rect = rig.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const clientX = e.clientX;
    const clientY = e.clientY;
    const nx = Math.max(-1, Math.min(1, (clientX - cx) / (rect.width / 2)));
    const ny = Math.max(-1, Math.min(1, (clientY - cy) / (rect.height / 2)));
    hoverTiltY = nx * 4;
    hoverTiltX = -ny * 3;
    unit.style.setProperty("--shell-gloss-x", (50 + nx * 28).toFixed(1) + "%");
    unit.style.setProperty("--shell-gloss-y", (32 + ny * 22).toFixed(1) + "%");
    applyTransform();
  }

  function onHoverLeave() {
    if (dragging) return;
    hoverTiltX = 0;
    hoverTiltY = 0;
    applyTransform();
  }

  function onPointerDown(e) {
    if (isRealPhone() || prefersReduced()) return;
    // Never start orbit from inside the interactive screen
    if (isOverScreen(e.target)) return;
    // Ignore UI chrome outside unit (shell-bar is outside rig usually)
    if (e.target.closest && e.target.closest(".shell-bar")) return;
    dragging = true;
    dragMoved = false;
    lastX = e.clientX;
    lastY = e.clientY;
    hoverTiltX = 0;
    hoverTiltY = 0;
    stage.classList.remove("is-floating");
    stage.classList.add("is-dragging");
    unit.classList.add("is-dragging");
    try {
      rig.setPointerCapture(e.pointerId);
    } catch (_) {}
  }

  function onPointerMove(e) {
    if (!dragging) {
      onHoverMove(e);
      return;
    }
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    if (Math.abs(dx) + Math.abs(dy) > 2) dragMoved = true;
    lastX = e.clientX;
    lastY = e.clientY;
    rotY += dx * 0.45;
    rotX -= dy * 0.35;
    // Clamp extreme flips a bit for usability (still allow back view)
    rotX = Math.max(-68, Math.min(68, rotX));
    // Keep Y free for full spin
    while (rotY > 180) rotY -= 360;
    while (rotY < -180) rotY += 360;
    applyTransform();
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    stage.classList.remove("is-dragging");
    unit.classList.remove("is-dragging");
    if (!isRealPhone() && !prefersReduced()) stage.classList.add("is-floating");
    try {
      rig.releasePointerCapture(e.pointerId);
    } catch (_) {}
    // If user barely moved, treat as click-through (no prevent)
  }

  function resetOrbit() {
    rotX = 0;
    rotY = 0;
    hoverTiltX = 0;
    hoverTiltY = 0;
    applyTransform();
  }

  // Wire orbit on rig — screen children keep their own clicks
  // Use pointer events in bubble phase; screen buttons fire first on their targets
  rig.addEventListener("pointerdown", onPointerDown);
  rig.addEventListener("pointermove", onPointerMove);
  rig.addEventListener("pointerup", onPointerUp);
  rig.addEventListener("pointercancel", onPointerUp);
  rig.addEventListener("pointerleave", onHoverLeave);

  // Hard guarantee: interactive screen keeps auto hit-testing.
  // Orbit pointerdown already ignores targets inside .device-screen (isOverScreen).
  // Do NOT stopPropagation on capture — that would kill button clicks.
  if (screenEl) {
    screenEl.style.pointerEvents = "auto";
  }

  // Reset button
  const resetBtn = document.getElementById("shell-reset");
  if (resetBtn) resetBtn.addEventListener("click", resetOrbit);

  // Flip to back helper
  const flipBtn = document.getElementById("shell-flip");
  if (flipBtn) {
    flipBtn.addEventListener("click", () => {
      if (Math.abs(rotY) > 90) rotY = 0;
      else rotY = 180;
      rotX = 0;
      applyTransform();
    });
  }

  buildModels();
  buildSwatches();

  const bootParams = new URLSearchParams(location.search);
  const qModel = bootParams.get("model");
  const qShell = bootParams.get("shell");
  let savedModel = null;
  let savedFinish = null;
  try {
    savedModel = localStorage.getItem(STORAGE_MODEL);
    savedFinish = localStorage.getItem(STORAGE_FINISH);
  } catch (_) {}

  const bootModel =
    qModel && MODELS.some((m) => m.id === qModel)
      ? qModel
      : savedModel && MODELS.some((m) => m.id === savedModel)
        ? savedModel
        : "island";
  const bootFinish =
    qShell && FINISHES.some((s) => s.id === qShell)
      ? qShell
      : savedFinish && FINISHES.some((s) => s.id === savedFinish)
        ? savedFinish
        : "obsidian";

  applyModel(bootModel, false);
  applyFinish(bootFinish, false);
  applyMode();

  const mqNarrow = window.matchMedia("(max-width: 540px)");
  const onChange = () => applyMode();
  if (mqNarrow.addEventListener) mqNarrow.addEventListener("change", onChange);
  else mqNarrow.addListener(onChange);
  window.addEventListener("orientationchange", () => setTimeout(applyMode, 120));
  window.addEventListener("resize", () => {
    fitScale();
  });

  window.LT_SHELL = {
    models: MODELS,
    finishes: FINISHES,
    shells: FINISHES,
    applyModel,
    applyFinish,
    applyShell: applyFinish,
    isRealPhone,
    resetOrbit,
    enableSyncTiltExperimental() {
      console.info("[LT shell] Sync tilt deferred — drag bezel to orbit on desktop.");
      return false;
    },
  };

  document.addEventListener("lt-i18n-applied", () => {
    const label = document.querySelector("[data-i18n='shellLabel']");
    if (label && !label.textContent) label.textContent = tShell("shellLabel", "Device shell");
    const hint = document.querySelector("[data-i18n='shellHint']");
    if (hint) hint.textContent = tShell("shellHint", "Drag the frame to rotate · tap the screen to practice");
  });
})();

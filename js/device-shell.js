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
    { id: "obsidian", name: "Obsidian", swatch: "#1a1c20", wash: "#d8dbe3" },
    { id: "sterling", name: "Sterling", swatch: "#c5cad3", wash: "#eef1f5" },
    { id: "champagne", name: "Champagne", swatch: "#c9a86a", wash: "#f5ecd8" },
    { id: "cobalt", name: "Cobalt", swatch: "#1e3a6e", wash: "#d5e2f5" },
    { id: "crimson", name: "Crimson", swatch: "#8b1e2d", wash: "#f3d8dc" },
    { id: "glacier", name: "Glacier", swatch: "#7eb8d4", wash: "#dff0f8" },
    { id: "amethyst", name: "Amethyst", swatch: "#5b3d8a", wash: "#e8dff5" },
    { id: "graphite", name: "Graphite", swatch: "#4a4d52", wash: "#e2e4e8" },
    { id: "pearl", name: "Pearl", swatch: "#e8e4dc", wash: "#f7f5f0" },
    { id: "sand", name: "Sand", swatch: "#b5a894", wash: "#f3eee4" },
  ];

  /* Bidirectional link: shell finish ↔ in-phone Today's tone (hue pairing) */
  const SHELL_TO_TONE = {
    obsidian: "midnight",
    sterling: "starlight",
    champagne: "space-gold",
    cobalt: "space-blue",
    crimson: "product-red",
    glacier: "sierra-blue",
    amethyst: "violet-night",
    graphite: "natural-titanium",
    pearl: "starlight",
    sand: "natural-titanium",
  };
  const TONE_TO_SHELL = {
    midnight: "obsidian",
    starlight: "sterling",
    "space-gold": "champagne",
    "space-blue": "cobalt",
    "product-red": "crimson",
    "sierra-blue": "glacier",
    "violet-night": "amethyst",
    purple: "amethyst",
    "natural-titanium": "sand",
    duolingo: "obsidian",
  };

  const stage = document.getElementById("demo-stage");
  const unit = document.getElementById("device-unit");
  const rig = document.getElementById("device-rig");
  const swatches = document.getElementById("shell-swatches");
  const modelEl = document.getElementById("shell-models");
  const nameEl = document.getElementById("shell-name");
  const screenEl = document.querySelector(".device-screen");
  if (!stage || !unit || !rig) return;

  let linkingFromShell = false;
  let linkingFromTone = false;

  // Rotation state (deg)
  // Left/right (rotY) hard-capped at ±80 so the phone never stands on edge.
  // Up/down (rotX) stays the prior gentle clamp.
  const MAX_YAW = 80;
  const MAX_PITCH = 68;
  let rotX = 0;
  let rotY = 0;
  let dragging = false;
  let dragMoved = false;
  let lastX = 0;
  let lastY = 0;
  let hoverTiltX = 0;
  let hoverTiltY = 0;
  let activePointerId = null;

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

  function isOverPhoneShell(target) {
    if (!target || !unit) return false;
    if (isOverScreen(target)) return true;
    return unit.contains(target) || (target.closest && target.closest("#device-unit, .device-unit"));
  }

  /** Buttons / pickers / pet / top bar — never start orbit or dblclick-reset on these. */
  function isInteractiveChrome(target) {
    if (!target || !target.closest) return false;
    return !!target.closest(
      "button, a, input, select, textarea, label, option," +
        "[role='button'], [role='option'], [role='tab'], [role='listbox'], [role='dialog']," +
        ".shell-bar, .shell-compact, .shell-dd, .shell-dd-panel, .stage-bar, .lang-switch, .screen-tabs," +
        "#stage-pet, .stage-pet, .finish-popover, .finish-wrap"
    );
  }

  function clampOrbit() {
    rotX = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, rotX));
    rotY = Math.max(-MAX_YAW, Math.min(MAX_YAW, rotY));
  }

  /** Empty page / bezel / glow — OK to orbit. Not screen UI, not chrome controls. */
  function canStartOrbit(target) {
    if (isOverScreen(target)) return false;
    if (isInteractiveChrome(target)) return false;
    return true;
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
    // With ±80 yaw we stay front-ish; keep class off so screen stays clickable
    unit.classList.toggle("is-back", false);
    document.dispatchEvent(new CustomEvent('lt-shell-render', { detail: { x, y } }));
  }

  function fitScale() {
    if (isRealPhone()) {
      stage.style.setProperty("--shell-fit", "1");
      return;
    }
    // Fit portrait unit into available viewport under chrome bars
    const availH = Math.max(420, window.innerHeight - 120);
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

  function applyPageWash(hex) {
    if (!hex) return;
    const root = document.documentElement;
    root.style.setProperty("--page-wash", hex);
    root.style.setProperty("--page-wash-soft", "color-mix(in srgb, " + hex + " 55%, #f4f6f8)");
    root.dataset.pageWash = hex;
  }

  function applyFinish(id, persist, linkTone) {
    const finish = FINISHES.find((s) => s.id === id) || FINISHES[0];
    unit.dataset.shell = finish.id;
    stage.dataset.shell = finish.id;
    document.documentElement.style.setProperty("--shell-accent-live", finish.swatch);
    /* Shell wash is a fallback; linked tone wash wins when tone sync runs */
    if (!linkingFromTone) {
      applyPageWash(finish.wash || finish.swatch);
    }
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
    if (linkTone !== false && !linkingFromTone && window.LT_PALACE && typeof window.LT_PALACE.applyFinish === "function") {
      const toneId = SHELL_TO_TONE[finish.id];
      if (toneId) {
        linkingFromShell = true;
        try {
          /* Manual shell pick turns off daily follow */
          try {
            localStorage.setItem("lt-palace-follow-tone", "0");
          } catch (_) {}
          document.querySelectorAll(".follow-tone-input").forEach((el) => {
            el.checked = false;
          });
          window.LT_PALACE.applyFinish(toneId, persist !== false);
        } catch (_) {
        } finally {
          linkingFromShell = false;
        }
      }
    }
  }

  function updateCompactIcons() {
    const model = MODELS.find((m) => m.id === unit.dataset.model) || MODELS[0];
    const finish = FINISHES.find((s) => s.id === unit.dataset.shell) || FINISHES[0];
    const mini = document.getElementById("shell-mini");
    if (mini) {
      mini.dataset.chrome = model.topChrome || "none";
      mini.style.setProperty("--shell-mini-fill", finish.swatch);
      const chrome = mini.querySelector(".shell-mini-chrome");
      if (chrome) chrome.dataset.chrome = model.topChrome || "none";
    }
    document.documentElement.style.setProperty("--shell-mini-fill", finish.swatch);
    const dot = document.getElementById("shell-color-dot");
    if (dot) {
      dot.style.background = "linear-gradient(145deg, " + finish.swatch + ", #000)";
    }
    const colorName = document.getElementById("shell-color-name");
    if (colorName) colorName.textContent = finish.name;
    const modelBtn = document.getElementById("shell-model-btn");
    if (modelBtn) modelBtn.title = model.name + " · " + finish.name;
    const colorBtn = document.getElementById("shell-color-btn");
    if (colorBtn) colorBtn.title = finish.name;
  }

  function updateName() {
    const model = MODELS.find((m) => m.id === unit.dataset.model) || MODELS[0];
    const finish = FINISHES.find((s) => s.id === unit.dataset.shell) || FINISHES[0];
    if (nameEl) nameEl.textContent = model.name + " · " + finish.name;
    updateCompactIcons();
  }

  function closeShellDrawers() {
    document.querySelectorAll(".shell-dd-panel").forEach((p) => {
      p.hidden = true;
      p.classList.remove("is-open");
    });
    document.querySelectorAll(".shell-icon-btn").forEach((b) => b.setAttribute("aria-expanded", "false"));
  }

  function toggleShellDrawer(kind) {
    const panelId = kind === "model" ? "shell-model-panel" : "shell-color-panel";
    const btnId = kind === "model" ? "shell-model-btn" : "shell-color-btn";
    const panel = document.getElementById(panelId);
    const btn = document.getElementById(btnId);
    if (!panel || !btn) return;
    const willOpen = panel.hidden;
    closeShellDrawers();
    if (willOpen) {
      panel.hidden = false;
      panel.classList.add("is-open");
      btn.setAttribute("aria-expanded", "true");
    }
  }

  function wireCompactChrome() {
    const modelBtn = document.getElementById("shell-model-btn");
    const colorBtn = document.getElementById("shell-color-btn");
    if (modelBtn) {
      modelBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleShellDrawer("model");
      });
    }
    if (colorBtn) {
      colorBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleShellDrawer("color");
      });
    }
    document.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.closest && t.closest(".shell-compact")) return;
      closeShellDrawers();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeShellDrawers();
    });
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
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        applyModel(m.id);
        closeShellDrawers();
      });
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
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        applyFinish(s.id);
        closeShellDrawers();
      });
      swatches.appendChild(btn);
    });
  }

  /* —— Interaction: screen clicks ALWAYS win ——
     Hover tilt: only when pointer is over rig but NOT over .device-screen
     Drag rotate: empty page / bezel (not screen, not chrome buttons)
     Dblclick outside phone shell → reset flat front
     Left/right yaw clamped ±80°; pitch unchanged (±68) */
  function onHoverMove(e) {
    if (isRealPhone() || prefersReduced() || dragging) return;
    const target = e.target;
    if (isOverScreen(target) || !rig.contains(target)) {
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
    if (e.button != null && e.button !== 0) return;
    if (!canStartOrbit(e.target)) return;
    dragging = true;
    dragMoved = false;
    activePointerId = e.pointerId;
    lastX = e.clientX;
    lastY = e.clientY;
    hoverTiltX = 0;
    hoverTiltY = 0;
    stage.classList.remove("is-floating");
    stage.classList.add("is-dragging");
    unit.classList.add("is-dragging");
    document.body.classList.add("is-shell-orbiting");
    try {
      // Capture on the start target so empty-page drags keep receiving moves
      if (e.currentTarget && e.currentTarget.setPointerCapture) {
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    } catch (_) {}
  }

  function onPointerMove(e) {
    if (!dragging || (activePointerId != null && e.pointerId !== activePointerId)) {
      if (!dragging) onHoverMove(e);
      return;
    }
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    if (Math.abs(dx) + Math.abs(dy) > 2) dragMoved = true;
    lastX = e.clientX;
    lastY = e.clientY;
    rotY += dx * 0.45;
    rotX -= dy * 0.35;
    clampOrbit();
    applyTransform();
  }

  function onPointerUp(e) {
    if (!dragging) return;
    if (activePointerId != null && e.pointerId !== activePointerId) return;
    dragging = false;
    activePointerId = null;
    stage.classList.remove("is-dragging");
    unit.classList.remove("is-dragging");
    document.body.classList.remove("is-shell-orbiting");
    if (!isRealPhone() && !prefersReduced()) stage.classList.add("is-floating");
    try {
      if (e.currentTarget && e.currentTarget.releasePointerCapture) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch (_) {}
  }

  function resetOrbit() {
    rotX = 0;
    rotY = 0;
    hoverTiltX = 0;
    hoverTiltY = 0;
    clampOrbit();
    applyTransform();
  }

  function onDblClickOutside(e) {
    if (isRealPhone() || prefersReduced()) return;
    // Double-click empty area outside the phone shell → flat front
    if (isOverPhoneShell(e.target)) return;
    if (isInteractiveChrome(e.target)) return;
    e.preventDefault();
    resetOrbit();
  }

  // Page-level orbit: empty background + bezel. Screen UI keeps its own clicks.
  document.addEventListener("pointerdown", onPointerDown);
  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", onPointerUp);
  document.addEventListener("pointercancel", onPointerUp);
  rig.addEventListener("pointerleave", onHoverLeave);
  document.addEventListener("dblclick", onDblClickOutside);

  // Hard guarantee: interactive screen keeps auto hit-testing.
  // Do NOT stopPropagation on capture — that would kill button clicks.
  if (screenEl) {
    screenEl.style.pointerEvents = "auto";
  }

  // Reset button
  const resetBtn = document.getElementById("shell-reset");
  if (resetBtn) resetBtn.addEventListener("click", resetOrbit);

  // Side peek helper (yaw capped at ±80 — no full flip past edge)
  const flipBtn = document.getElementById("shell-flip");
  if (flipBtn) {
    flipBtn.addEventListener("click", () => {
      if (Math.abs(rotY) > 40) rotY = 0;
      else rotY = rotY < 0 ? -MAX_YAW : MAX_YAW;
      rotX = 0;
      clampOrbit();
      applyTransform();
    });
  }

  buildModels();
  buildSwatches();
  wireCompactChrome();

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
  /* Boot without linking so palace tone (loaded first) stays source of truth */
  applyFinish(bootFinish, false, false);
  const bootTone = document.documentElement.getAttribute("data-finish");
  if (bootTone && TONE_TO_SHELL[bootTone]) {
    applyFinish(TONE_TO_SHELL[bootTone], false, false);
    if (window.LT_PALACE && window.LT_PALACE.TONE_WASH && window.LT_PALACE.TONE_WASH[bootTone]) {
      applyPageWash(window.LT_PALACE.TONE_WASH[bootTone]);
    }
  }
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
    shellToTone: SHELL_TO_TONE,
    toneToShell: TONE_TO_SHELL,
    applyModel,
    applyFinish,
    applyShell: applyFinish,
    applyPageWash,
    isRealPhone,
    resetOrbit,
    closeShellDrawers,
    updateCompactIcons,
    getOrbit() {
      return { rotX, rotY, maxYaw: MAX_YAW, maxPitch: MAX_PITCH };
    },
    setOrbit(x, y) {
      rotX = Number(x) || 0;
      rotY = Number(y) || 0;
      clampOrbit();
      applyTransform();
      return this.getOrbit();
    },
    enableSyncTiltExperimental() {
      console.info("[LT shell] Sync tilt deferred — drag empty space to orbit on desktop.");
      return false;
    },
  };

  document.addEventListener("lt-i18n-applied", () => {
    const label = document.querySelector("[data-i18n='shellLabel']");
    if (label && !label.textContent) label.textContent = tShell("shellLabel", "Device shell");
    const hint = document.querySelector("[data-i18n='shellHint']");
    if (hint) hint.textContent = tShell("shellHint", "Drag empty space to rotate (±80°) · double-click outside phone to reset · tap screen to practice");
  });

  /* In-phone tone → shell metal + page wash (no re-link loop) */
  document.addEventListener("lt-tone-changed", (ev) => {
    const detail = (ev && ev.detail) || {};
    if (detail.wash) applyPageWash(detail.wash);
    if (linkingFromShell) return;
    const toneId = detail.id;
    if (!toneId) return;
    const shellId = TONE_TO_SHELL[toneId];
    if (!shellId || unit.dataset.shell === shellId) return;
    linkingFromTone = true;
    try {
      applyFinish(shellId, true, false);
      if (detail.wash) applyPageWash(detail.wash);
    } finally {
      linkingFromTone = false;
    }
  });
})();

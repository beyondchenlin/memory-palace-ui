/* Memory Palace — demo-unit shell controller
   Desktop + Pad: shelled. Real narrow phone: full-bleed (no fake island/notch).
   topChrome is tied to shell MODEL, not in-app HUD.
   Pointer tilt + idle float. DeviceOrientation sync deferred. */
(function () {
  const STORAGE_MODEL = "lt-palace-shell-model";
  const STORAGE_FINISH = "lt-palace-shell";

  /** Model families — topChrome only applies on outer bezel when shelled */
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
  if (!stage || !unit || !rig) return;

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
    // HARD rule: narrow viewport = real phone full-bleed (no chrome).
    // Pad/tablet (≥541 CSS px) and desktop always shelled.
    const params = new URLSearchParams(location.search);
    if (params.get("forcePhone") === "1") return true;
    if (params.get("forceShell") === "1") return false;
    return window.matchMedia("(max-width: 540px)").matches;
  }

  function prefersReduced() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function applyMode() {
    const phone = isRealPhone();
    document.body.classList.toggle("is-real-phone", phone);
    stage.dataset.mode = phone ? "unshelled" : "shelled";
    stage.classList.toggle("is-floating", !phone && !prefersReduced());
    if (phone) {
      unit.style.setProperty("--shell-tilt-x", "0deg");
      unit.style.setProperty("--shell-tilt-y", "0deg");
      // Real phone: never draw fake island/notch/hole on the app UI
      unit.dataset.topChrome = "none";
      stage.dataset.topChrome = "none";
    } else {
      const model = MODELS.find((m) => m.id === unit.dataset.model) || MODELS[0];
      unit.dataset.topChrome = model.topChrome;
      stage.dataset.topChrome = model.topChrome;
    }
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

  /* Pointer-driven tilt + gloss */
  let raf = 0;
  function onPointer(e) {
    if (isRealPhone() || prefersReduced()) return;
    const rect = rig.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const nx = Math.max(-1, Math.min(1, (clientX - cx) / (rect.width / 2)));
    const ny = Math.max(-1, Math.min(1, (clientY - cy) / (rect.height / 2)));
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      unit.style.setProperty("--shell-tilt-y", (nx * 7).toFixed(2) + "deg");
      unit.style.setProperty("--shell-tilt-x", (-ny * 5).toFixed(2) + "deg");
      unit.style.setProperty("--shell-gloss-x", (50 + nx * 28).toFixed(1) + "%");
      unit.style.setProperty("--shell-gloss-y", (32 + ny * 22).toFixed(1) + "%");
    });
  }

  function resetTilt() {
    if (isRealPhone()) return;
    unit.style.setProperty("--shell-tilt-x", "0deg");
    unit.style.setProperty("--shell-tilt-y", "0deg");
    unit.style.setProperty("--shell-gloss-x", "42%");
    unit.style.setProperty("--shell-gloss-y", "28%");
  }

  rig.addEventListener("pointermove", onPointer, { passive: true });
  rig.addEventListener("pointerleave", resetTilt);
  rig.addEventListener("touchmove", onPointer, { passive: true });

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

  // Migrate legacy finish-only ids; default island for previous demos
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
  const mqCoarse = window.matchMedia("(pointer: coarse)");
  const onChange = () => applyMode();
  if (mqNarrow.addEventListener) {
    mqNarrow.addEventListener("change", onChange);
    mqCoarse.addEventListener("change", onChange);
  } else {
    mqNarrow.addListener(onChange);
    mqCoarse.addListener(onChange);
  }
  window.addEventListener("orientationchange", () => setTimeout(applyMode, 120));

  window.LT_SHELL = {
    models: MODELS,
    finishes: FINISHES,
    /** @deprecated use finishes */
    shells: FINISHES,
    applyModel,
    applyFinish,
    applyShell: applyFinish,
    isRealPhone,
    enableSyncTiltExperimental() {
      console.info(
        "[LT shell] Sync tilt (experimental) deferred — use pointer tilt on the demo unit."
      );
      return false;
    },
  };

  document.addEventListener("lt-i18n-applied", () => {
    const label = document.querySelector("[data-i18n='shellLabel']");
    if (label && !label.textContent) label.textContent = tShell("shellLabel", "Demo unit");
  });
})();

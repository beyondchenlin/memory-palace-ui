/* Memory Palace — formal product device stage v9
   Mockiosa UV glue: CanvasTexture on glass + front HTML overlay (no CSS crop).
   Outer-stage drag orbit with damping · small idle sway · gentle unlock.
   Double-click outside → spring reset. No permanent model/color rail. */
(function () {
  const STORAGE_MODEL = "lt-palace-shell-model";
  const STORAGE_FINISH = "lt-palace-shell";
  const STORAGE_SS_LOCK = "lt-palace-ss-lock";
  const STORAGE_SS_PIN = "lt-palace-ss-pin";
  const IDLE_MS = 60000;

  const MODELS = [
    { id: "island", name: "Island Pro", brand: "Apex", topChrome: "island" },
    { id: "notch", name: "Classic Notch", brand: "Nova", topChrome: "notch" },
    { id: "hole", name: "Android Hole", brand: "Pulse", topChrome: "hole" },
    { id: "clean", name: "Clean Frame", brand: "Horizon", topChrome: "none" },
    { id: "dual", name: "Dual Punch", brand: "Orbit", topChrome: "hole" },
    { id: "slim", name: "Edge Slim", brand: "Vela", topChrome: "island" },
    { id: "curve", name: "Soft Curve", brand: "Lumen", topChrome: "notch" },
    { id: "flat", name: "Flat Glass", brand: "Terra", topChrome: "none" },
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

  /* Optional soft link: shell finish → nearest today's tone */
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

  const stage = document.getElementById("demo-stage");
  const unit = document.getElementById("device-unit");
  const rig = document.getElementById("device-rig");
  const swatches = document.getElementById("shell-swatches");
  const modelEl = document.getElementById("shell-models");
  const nameEl = document.getElementById("shell-name");
  const screenEl = document.querySelector(".device-screen");
  const ssEl = document.getElementById("phone-screensaver");
  const ssTime = document.getElementById("ss-time");
  const ssDate = document.getElementById("ss-date");
  const ssHint = document.getElementById("ss-hint");
  const ssPinForm = document.getElementById("ss-pin");
  const ssPinInput = document.getElementById("ss-pin-input");
  const ssPinUnlock = document.getElementById("ss-pin-unlock");
  const ssPinErr = document.getElementById("ss-pin-err");
  if (!stage || !unit || !rig) return;

  let rotX = 0;
  let rotY = 0;
  let dragging = false;
  let dragMoved = false;
  let lastX = 0;
  let lastY = 0;
  let hoverTiltX = 0;
  let hoverTiltY = 0;
  let idleTimer = 0;
  let ssClock = 0;
  let screensaverOn = false;
  let pinGate = false;
  let captureArmed = false;
  let activePointerId = null;
  let shakeBuf = [];
  let orbitAnim = null;
  /* Silky orbit: targets jump on drag, view lerps every frame */
  let viewRotX = 0;
  let viewRotY = 0;
  let targetRotX = 0;
  let targetRotY = 0;
  let dampRaf = 0;
  const DAMP = 0.16; /* higher = snappier; 0.12–0.2 feels silky */

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
    if (window.LT_MESH && window.LT_MESH.glued && window.LT_MESH.getFacingBack && window.LT_MESH.getFacingBack()) {
      return false;
    }
    return screenEl.contains(target) || (target.closest && target.closest(".device-screen"));
  }

  function isPointOnScreen(clientX, clientY) {
    if (!screenEl) return false;
    /* When CSS3D-glued, projected AABB balloons while orbiting — do NOT use it
       for outer-drag gating. Element-under-cursor (isOverScreen) is enough. */
    if (window.LT_MESH && window.LT_MESH.glued) return false;
    const s = screenEl.getBoundingClientRect();
    return clientX >= s.left && clientX <= s.right && clientY >= s.top && clientY <= s.bottom;
  }

  function isPointOnPhone(clientX, clientY) {
    if (!unit) return false;
    const u = unit.getBoundingClientRect();
    return clientX >= u.left && clientX <= u.right && clientY >= u.top && clientY <= u.bottom;
  }

  function isChromeControl(target) {
    if (!target || !target.closest) return false;
    return !!(
      target.closest(".shell-rail") ||
      target.closest(".shell-lock-panel") ||
      target.closest(".shell-lock-btn") ||
      target.closest(".shell-model") ||
      target.closest(".shell-swatch") ||
      target.closest(".stage-bar") ||
      target.closest(".site-tips") ||
      target.closest("#stage-pet") ||
      target.closest(".stage-pet") ||
      target.closest(".lang-switch")
    );
  }

  /** Outside phone = stage chrome around unit (or bezel rim), never the glass UI */
  function isOuterOrbitTarget(target, clientX, clientY) {
    if (isChromeControl(target)) return false;
    if (isOverScreen(target) || isPointOnScreen(clientX, clientY)) return false;
    /* Anywhere in stage/rig that is not the screen — includes empty stage + bezel rim */
    if (target.closest && (target.closest("#demo-stage") || target.closest(".product-stage") || target.closest("#device-rig"))) {
      return true;
    }
    return false;
  }

  function facingBack() {
    let y = ((viewRotY % 360) + 360) % 360;
    return y > 100 && y < 260;
  }

  function applyTransform() {
    if (isRealPhone()) {
      unit.style.setProperty("--shell-tilt-x", "0deg");
      unit.style.setProperty("--shell-tilt-y", "0deg");
      unit.classList.remove("is-back");
      unit.classList.remove("is-orbiting");
      targetRotX = 0;
      targetRotY = 0;
      viewRotX = 0;
      viewRotY = 0;
      if (window.LT_MESH) window.LT_MESH.setRotation(0, 0);
      return;
    }
    targetRotX = rotX + hoverTiltX;
    targetRotY = rotY + hoverTiltY;
    /* v9: ONLY rotate shared Three.js root; viewRot lerps in dampLoop */
    unit.style.setProperty("--shell-tilt-x", "0deg");
    unit.style.setProperty("--shell-tilt-y", "0deg");
  }

  function syncViewToMesh() {
    if (isRealPhone()) return;
    if (window.LT_MESH) window.LT_MESH.setRotation(viewRotX, viewRotY);
    const back = window.LT_MESH && typeof window.LT_MESH.getFacingBack === "function"
      ? window.LT_MESH.getFacingBack()
      : (() => {
          let y = ((viewRotY % 360) + 360) % 360;
          return y > 100 && y < 260;
        })();
    unit.classList.toggle("is-back", back && !screensaverOn);
  }

  function dampLoop() {
    dampRaf = requestAnimationFrame(dampLoop);
    if (isRealPhone()) return;
    const dx = targetRotX - viewRotX;
    let dy = targetRotY - viewRotY;
    /* shortest-path wrap for yaw so 350→10 doesn't spin the long way */
    if (dy > 180) dy -= 360;
    if (dy < -180) dy += 360;
    viewRotX += dx * DAMP;
    viewRotY += dy * DAMP;
    if (viewRotY > 360) viewRotY -= 360;
    if (viewRotY < -360) viewRotY += 360;
    if (Math.abs(dx) < 0.02 && Math.abs(dy) < 0.02) {
      viewRotX = targetRotX;
      viewRotY = targetRotY;
    }
    syncViewToMesh();
  }

  function fitScale() {
    if (isRealPhone()) {
      stage.style.setProperty("--shell-fit", "1");
      return;
    }
    /* Always moderate CSS unit size — WebGL matches via matchCssUnitFraming.
       Never force fit=1 (that caused the post-GLB grow). */
    const availH = Math.max(420, window.innerHeight - 200);
    const availW = Math.max(260, Math.min(window.innerWidth - 64, 420));
    const unitH = 900;
    const unitW = 430;
    const s = Math.min(0.92, availH / unitH, availW / unitW);
    stage.style.setProperty("--shell-fit", s.toFixed(3));
    if (window.LT_MESH?.matchCssUnitFraming) {
      requestAnimationFrame(() => window.LT_MESH.matchCssUnitFraming());
    }
  }

  function applyPageWash(hex) {
    if (!hex) return;
    const root = document.documentElement;
    root.style.setProperty("--page-wash", hex);
    root.style.setProperty("--page-wash-soft", "color-mix(in srgb, " + hex + " 55%, #f4f6f8)");
    root.dataset.pageWash = hex;
  }

  function applyMode() {
    const phone = isRealPhone();
    document.body.classList.toggle("is-real-phone", phone);
    stage.dataset.mode = phone ? "unshelled" : "shelled";
    stage.classList.toggle("is-floating", !phone && !prefersReduced() && !dragging && !screensaverOn);
    if (phone) {
      rotX = 0;
      rotY = 0;
      hoverTiltX = 0;
      hoverTiltY = 0;
      unit.dataset.topChrome = "none";
      stage.dataset.topChrome = "none";
      stopShowcaseOrbit();
      hideScreensaver(true);
    } else {
      const model = MODELS.find((m) => m.id === unit.dataset.model) || MODELS[0];
      unit.dataset.topChrome = model.topChrome;
      stage.dataset.topChrome = model.topChrome;
    }
    applyTransform();
    fitScale();
  }

  function svgFrame(chrome) {
    /* Original flat smartphone frames — currentColor fillable, no trademarks */
    if (chrome === "island") {
      return (
        '<svg class="shell-model-svg" viewBox="0 0 40 72" aria-hidden="true">' +
        '<rect x="4" y="2" width="32" height="68" rx="8" fill="none" stroke="currentColor" stroke-width="2.5"/>' +
        '<rect x="12" y="6" width="16" height="4" rx="2" fill="currentColor"/>' +
        '<rect x="8" y="12" width="24" height="50" rx="2" fill="currentColor" opacity="0.18"/>' +
        "</svg>"
      );
    }
    if (chrome === "notch") {
      return (
        '<svg class="shell-model-svg" viewBox="0 0 40 72" aria-hidden="true">' +
        '<rect x="4" y="2" width="32" height="68" rx="8" fill="none" stroke="currentColor" stroke-width="2.5"/>' +
        '<path d="M12 2h16v6a4 4 0 0 1-4 4h-8a4 4 0 0 1-4-4V2z" fill="currentColor"/>' +
        '<rect x="8" y="14" width="24" height="48" rx="2" fill="currentColor" opacity="0.18"/>' +
        "</svg>"
      );
    }
    if (chrome === "hole") {
      return (
        '<svg class="shell-model-svg" viewBox="0 0 40 72" aria-hidden="true">' +
        '<rect x="4" y="2" width="32" height="68" rx="8" fill="none" stroke="currentColor" stroke-width="2.5"/>' +
        '<circle cx="20" cy="9" r="2.2" fill="currentColor"/>' +
        '<rect x="8" y="14" width="24" height="48" rx="2" fill="currentColor" opacity="0.18"/>' +
        "</svg>"
      );
    }
    return (
      '<svg class="shell-model-svg" viewBox="0 0 40 72" aria-hidden="true">' +
      '<rect x="4" y="2" width="32" height="68" rx="8" fill="none" stroke="currentColor" stroke-width="2.5"/>' +
      '<rect x="8" y="10" width="24" height="52" rx="2" fill="currentColor" opacity="0.18"/>' +
      "</svg>"
    );
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
    bumpIdle();
    if (persist !== false) {
      try {
        localStorage.setItem(STORAGE_MODEL, model.id);
      } catch (_) {}
    }
  }

  function applyFinish(id, persist, linkTone) {
    const finish = FINISHES.find((s) => s.id === id) || FINISHES[0];
    unit.dataset.shell = finish.id;
    stage.dataset.shell = finish.id;
    document.documentElement.style.setProperty("--shell-accent-live", finish.swatch);
    applyPageWash(finish.wash || finish.swatch);
    if (swatches) {
      swatches.querySelectorAll(".shell-swatch").forEach((b) => {
        b.classList.toggle("is-on", b.dataset.shell === finish.id);
        b.setAttribute("aria-selected", b.dataset.shell === finish.id ? "true" : "false");
      });
    }
    if (modelEl) {
      modelEl.style.color = finish.swatch;
      modelEl.querySelectorAll(".shell-model").forEach((b) => {
        b.style.color = finish.swatch;
      });
    }
    updateName();
    bumpIdle();
    if (persist !== false) {
      try {
        localStorage.setItem(STORAGE_FINISH, finish.id);
      } catch (_) {}
    }
    if (linkTone !== false && window.LT_PALACE && typeof window.LT_PALACE.applyFinish === "function") {
      const toneId = SHELL_TO_TONE[finish.id];
      if (toneId) {
        try {
          window.LT_PALACE.applyFinish(toneId, true);
        } catch (_) {}
      }
    }
  }

  function updateName() {
    if (!nameEl) return;
    const model = MODELS.find((m) => m.id === unit.dataset.model) || MODELS[0];
    const finish = FINISHES.find((s) => s.id === unit.dataset.shell) || FINISHES[0];
    nameEl.textContent = model.brand + " " + model.name + " · " + finish.name;
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
      btn.setAttribute("aria-label", m.brand + " " + m.name);
      btn.innerHTML =
        svgFrame(m.topChrome) +
        '<span class="shell-model-meta"><span class="shell-model-brand">' +
        m.brand +
        '</span><span class="shell-model-name">' +
        m.name +
        "</span></span>";
      btn.title = m.brand + " · " + m.name;
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
      btn.style.background = "linear-gradient(145deg, " + s.swatch + ", color-mix(in srgb, " + s.swatch + " 40%, #000))";
      btn.title = s.name;
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-label", s.name);
      btn.addEventListener("click", () => applyFinish(s.id));
      swatches.appendChild(btn);
    });
  }

  function resetOrbit() {
    stopShowcaseOrbit();
    rotX = 0;
    rotY = 0;
    hoverTiltX = 0;
    hoverTiltY = 0;
    targetRotX = 0;
    targetRotY = 0;
    /* spring toward front — damping still smooths */
    unit.classList.remove("is-back");
    unit.classList.add("is-spring");
    applyTransform();
    setTimeout(() => unit.classList.remove("is-spring"), 420);
    bumpIdle();
  }

  function flipToBack() {
    stopShowcaseOrbit();
    rotY = 180;
    rotX = -6;
    hoverTiltX = 0;
    hoverTiltY = 0;
    applyTransform();
    bumpIdle();
  }

  function toggleFlip() {
    if (facingBack()) resetOrbit();
    else flipToBack();
  }

  /* —— Screensaver + showcase orbit —— */
  function formatSsClock() {
    const d = new Date();
    const h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, "0");
    const hh = ((h + 11) % 12) + 1;
    if (ssTime) ssTime.textContent = hh + ":" + m;
    if (ssDate) {
      try {
        ssDate.textContent = d.toLocaleDateString(undefined, {
          weekday: "long",
          month: "short",
          day: "numeric",
        });
      } catch (_) {
        ssDate.textContent = "";
      }
    }
  }

  function lockEnabled() {
    try {
      return localStorage.getItem(STORAGE_SS_LOCK) === "1" && !!localStorage.getItem(STORAGE_SS_PIN);
    } catch (_) {
      return false;
    }
  }

  function getPin() {
    try {
      return localStorage.getItem(STORAGE_SS_PIN) || "";
    } catch (_) {
      return "";
    }
  }

  function startShowcaseOrbit() {
    /* v7: SMALL idle sway only — never auto-orbit to full back */
    stopShowcaseOrbit();
    if (prefersReduced() || isRealPhone()) return;
    unit.classList.add("is-orbiting");
    stage.classList.add("is-showcase");
    const start = performance.now();
    const baseY = 0;
    const ampY = 7;   /* gentle left-right */
    const ampX = 2.5; /* slight up-down */
    const period = 5200;
    function tick(now) {
      if (!screensaverOn) {
        stopShowcaseOrbit();
        return;
      }
      const t = (now - start) / period;
      rotY = baseY + ampY * Math.sin(t * Math.PI * 2);
      rotX = -ampX * Math.sin(t * Math.PI * 2 * 0.85 + 0.4);
      hoverTiltX = 0;
      hoverTiltY = 0;
      applyTransform();
      orbitAnim = requestAnimationFrame(tick);
    }
    orbitAnim = requestAnimationFrame(tick);
  }

  function stopShowcaseOrbit() {
    if (orbitAnim) {
      cancelAnimationFrame(orbitAnim);
      orbitAnim = null;
    }
    unit.classList.remove("is-orbiting");
    stage.classList.remove("is-showcase");
  }

  function showScreensaver() {
    if (isRealPhone() || !ssEl || screensaverOn) return;
    screensaverOn = true;
    pinGate = false;
    ssEl.hidden = false;
    ssEl.setAttribute("aria-hidden", "false");
    stage.classList.add("is-screensaver");
    stage.classList.remove("is-floating");
    if (ssPinForm) ssPinForm.hidden = true;
    if (ssPinErr) ssPinErr.hidden = true;
    if (ssHint) {
      ssHint.hidden = false;
      ssHint.textContent = lockEnabled()
        ? tShell("screensaverHintLock", "Move or tap logo · then enter PIN")
        : tShell("screensaverHint", "Move slightly or tap the logo to unlock");
    }
    formatSsClock();
    if (ssClock) clearInterval(ssClock);
    ssClock = setInterval(formatSsClock, 15000);
    startShowcaseOrbit();
    /* Glue screensaver onto screen.001 immediately */
    if (window.LT_MESH && window.LT_MESH.captureNow) {
      setTimeout(() => window.LT_MESH.captureNow(), 80);
      setTimeout(() => window.LT_MESH.captureNow(), 400);
    }
  }

  function hideScreensaver(silent) {
    if (!ssEl) return;
    const was = screensaverOn;
    screensaverOn = false;
    pinGate = false;
    moveAccum = 0;
    lastMoveX = null;
    lastMoveY = null;
    ssEl.hidden = true;
    ssEl.setAttribute("aria-hidden", "true");
    stage.classList.remove("is-screensaver");
    stopShowcaseOrbit();
    if (ssClock) {
      clearInterval(ssClock);
      ssClock = 0;
    }
    if (ssPinForm) ssPinForm.hidden = true;
    if (!silent && was && !isRealPhone() && !prefersReduced() && !dragging) {
      stage.classList.add("is-floating");
    }
    if (was && window.LT_MESH && window.LT_MESH.captureNow) {
      setTimeout(() => window.LT_MESH.captureNow(), 60);
    }
  }

  function wakeToPin() {
    pinGate = true;
    if (ssPinForm) ssPinForm.hidden = false;
    if (ssHint) ssHint.hidden = true;
    if (ssPinInput) {
      ssPinInput.value = "";
      try {
        ssPinInput.focus();
      } catch (_) {}
    }
    if (ssPinErr) ssPinErr.hidden = true;
  }

  function tryUnlockWithPin() {
    const entered = (ssPinInput && ssPinInput.value) || "";
    if (entered && entered === getPin()) {
      hideScreensaver();
      bumpIdle();
      return true;
    }
    if (ssPinErr) ssPinErr.hidden = false;
    return false;
  }

  function requestUnlock() {
    if (!screensaverOn) return;
    gentleUnlock();
  }

  function bumpIdle() {
    if (screensaverOn && !pinGate) hideScreensaver(true);
    else if (!screensaverOn) {
      /* already off */
    }
    if (idleTimer) clearTimeout(idleTimer);
    if (isRealPhone()) return;
    idleTimer = setTimeout(showScreensaver, IDLE_MS);
  }

  /* —— Gentle unlock: slight mouse move OR logo/brand tap (no shake threshold) —— */
  let moveAccum = 0;
  let lastMoveX = null;
  let lastMoveY = null;
  function playUnlockAnim(done) {
    if (ssEl) {
      ssEl.classList.add("is-unlocking");
      stage.classList.add("is-unlocking");
    }
    setTimeout(() => {
      if (ssEl) ssEl.classList.remove("is-unlocking");
      stage.classList.remove("is-unlocking");
      if (done) done();
    }, 420);
  }
  function gentleUnlock() {
    if (!screensaverOn) return;
    if (lockEnabled()) {
      wakeToPin();
      return;
    }
    playUnlockAnim(() => {
      hideScreensaver();
      bumpIdle();
    });
  }
  function onShakeSample(e) {
    if (!screensaverOn || pinGate) return;
    if (lastMoveX == null) {
      lastMoveX = e.clientX;
      lastMoveY = e.clientY;
      return;
    }
    const dx = e.clientX - lastMoveX;
    const dy = e.clientY - lastMoveY;
    lastMoveX = e.clientX;
    lastMoveY = e.clientY;
    moveAccum += Math.hypot(dx, dy);
    /* low threshold — a slight nudge wakes, not a frantic shake */
    if (moveAccum > 28) {
      moveAccum = 0;
      lastMoveX = null;
      lastMoveY = null;
      gentleUnlock();
    }
  }

  /* —— Orbit: outside phone / not on screen —— */
  function onHoverMove(e) {
    if (isRealPhone() || prefersReduced() || dragging || screensaverOn) return;
    if (isOverScreen(e.target) || isPointOnPhone(e.clientX, e.clientY)) {
      hoverTiltX = 0;
      hoverTiltY = 0;
      applyTransform();
      return;
    }
    const rect = rig.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const nx = Math.max(-1, Math.min(1, (e.clientX - cx) / (rect.width / 2 || 1)));
    const ny = Math.max(-1, Math.min(1, (e.clientY - cy) / (rect.height / 2 || 1)));
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
    if (isRealPhone() || prefersReduced() || screensaverOn) return;
    if (e.button != null && e.button !== 0) return;
    /* v10d: LMB drag ANYWHERE on page (except chrome controls) = free rotate */
    if (isChromeControl(e.target)) return;
    dragging = true;
    dragMoved = false;
    captureArmed = false;
    activePointerId = e.pointerId;
    lastX = e.clientX;
    lastY = e.clientY;
    hoverTiltX = 0;
    hoverTiltY = 0;
    stopShowcaseOrbit();
    stage.classList.remove("is-floating");
    stage.classList.add("is-dragging");
    unit.classList.add("is-dragging");
    if (window.LT_MESH && window.LT_MESH.setDragging) window.LT_MESH.setDragging(true);
  }

  function onPointerMove(e) {
    if (screensaverOn) {
      onShakeSample(e);
      return;
    }
    if (!dragging) {
      onHoverMove(e);
      return;
    }
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    if (!dragMoved && Math.abs(dx) + Math.abs(dy) > 4) {
      dragMoved = true;
      if (!captureArmed && activePointerId != null) {
        captureArmed = true;
        try {
          stage.setPointerCapture(activePointerId);
        } catch (_) {
          try {
            rig.setPointerCapture(activePointerId);
          } catch (_) {}
        }
      }
    }
    if (!dragMoved) return;
    lastX = e.clientX;
    lastY = e.clientY;
    rotY = rotY + dx * 0.48;
    rotX = Math.max(-28, Math.min(28, rotX - dy * 0.36));
    /* Keep Y unbounded for free orbit past 180 so back is seen from mirrored angle */
    if (rotY > 360) rotY -= 360;
    if (rotY < -360) rotY += 360;
    applyTransform();
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    captureArmed = false;
    stage.classList.remove("is-dragging");
    unit.classList.remove("is-dragging");
    if (window.LT_MESH && window.LT_MESH.setDragging) window.LT_MESH.setDragging(false);
    if (!isRealPhone() && !prefersReduced() && !screensaverOn) stage.classList.add("is-floating");
    try {
      if (activePointerId != null) {
        stage.releasePointerCapture(activePointerId);
        rig.releasePointerCapture(activePointerId);
      }
    } catch (_) {}
    activePointerId = null;
    bumpIdle();
  }

  function onOuterDblClick(e) {
    if (isRealPhone() || screensaverOn) return;
    if (isChromeControl(e.target)) return;
    /* v10d: double-click ANYWHERE = reset to flat front */
    e.preventDefault();
    e.stopPropagation();
    resetOrbit();
  }

  dampLoop();

  stage.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
  rig.addEventListener("pointerleave", onHoverLeave);
  window.addEventListener("dblclick", onOuterDblClick, true);

  if (screenEl) {
    screenEl.style.pointerEvents = "auto";
    screenEl.addEventListener(
      "pointerdown",
      (e) => {
        e.stopPropagation();
        if (screensaverOn) {
          /* let ss handler decide */
          return;
        }
        bumpIdle();
      },
      true
    );
  }

  if (ssEl) {
    ssEl.addEventListener("click", (e) => {
      e.stopPropagation();
      if (e.target.closest && e.target.closest(".ss-pin")) return;
      requestUnlock();
    });
  }
  const ssLogo = ssEl && ssEl.querySelector(".ss-logo, .ss-brand, .ss-wordmark");
  if (ssEl) {
    ssEl.querySelectorAll(".ss-logo, .ss-brand, .ss-wordmark").forEach((el) => {
      el.style.cursor = "pointer";
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        gentleUnlock();
      });
    });
  }

  if (ssPinUnlock) {
    ssPinUnlock.addEventListener("click", (e) => {
      e.stopPropagation();
      tryUnlockWithPin();
    });
  }
  if (ssPinInput) {
    ssPinInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        tryUnlockWithPin();
      }
    });
  }

  /* Lock settings panel */
  const lockBtn = document.getElementById("shell-lock-btn");
  const lockPanel = document.getElementById("shell-lock-panel");
  const lockEnabledEl = document.getElementById("ss-lock-enabled");
  const lockSetEl = document.getElementById("ss-lock-set");
  const lockSave = document.getElementById("ss-lock-save");
  const lockClear = document.getElementById("ss-lock-clear");
  const lockClose = document.getElementById("ss-lock-close");

  function syncLockUi() {
    if (lockEnabledEl) {
      try {
        lockEnabledEl.checked = localStorage.getItem(STORAGE_SS_LOCK) === "1";
      } catch (_) {}
    }
  }

  if (lockBtn && lockPanel) {
    lockBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      syncLockUi();
      lockPanel.hidden = !lockPanel.hidden;
    });
  }
  if (lockClose && lockPanel) {
    lockClose.addEventListener("click", () => {
      lockPanel.hidden = true;
    });
  }
  if (lockSave) {
    lockSave.addEventListener("click", () => {
      const pin = (lockSetEl && lockSetEl.value) || "";
      const en = !!(lockEnabledEl && lockEnabledEl.checked);
      try {
        if (en && pin && /^\d{4,6}$/.test(pin)) {
          localStorage.setItem(STORAGE_SS_PIN, pin);
          localStorage.setItem(STORAGE_SS_LOCK, "1");
        } else if (en && getPin()) {
          localStorage.setItem(STORAGE_SS_LOCK, "1");
        } else {
          localStorage.setItem(STORAGE_SS_LOCK, "0");
        }
      } catch (_) {}
      if (lockPanel) lockPanel.hidden = true;
      bumpIdle();
    });
  }
  if (lockClear) {
    lockClear.addEventListener("click", () => {
      try {
        localStorage.removeItem(STORAGE_SS_PIN);
        localStorage.setItem(STORAGE_SS_LOCK, "0");
      } catch (_) {}
      if (lockEnabledEl) lockEnabledEl.checked = false;
      if (lockSetEl) lockSetEl.value = "";
    });
  }

  ["keydown", "wheel", "touchstart"].forEach((ev) => {
    document.addEventListener(
      ev,
      () => {
        if (!screensaverOn) bumpIdle();
      },
      { passive: true }
    );
  });

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
  applyFinish(bootFinish, false, false);
  applyMode();
  bumpIdle();

  const mqNarrow = window.matchMedia("(max-width: 540px)");
  const onChange = () => applyMode();
  if (mqNarrow.addEventListener) mqNarrow.addEventListener("change", onChange);
  else mqNarrow.addListener(onChange);
  window.addEventListener("orientationchange", () => setTimeout(applyMode, 120));
  window.addEventListener("resize", () => fitScale());

    /* Sync real GLTF chassis */
  function syncMeshChassis() {
    if (!window.LT_MESH) return;
    const mid = unit.dataset.model || stage.dataset.model || "island";
    const fid = unit.dataset.shell || stage.dataset.shell || "obsidian";
    Promise.resolve(window.LT_MESH.setModelUiId(mid)).then(() => {
      window.LT_MESH.setFinish(fid);
      applyTransform();
    });
  }
  syncMeshChassis();

window.LT_SHELL = {
    models: MODELS,
    finishes: FINISHES,
    shells: FINISHES,
    applyModel,
    applyFinish,
    applyShell: applyFinish,
    applyPageWash,
    isRealPhone,
    resetOrbit,
    flipToBack,
    toggleFlip,
    isFlipped: function () {
      return facingBack();
    },
    showScreensaver,
    hideScreensaver,
    bumpIdle,
    getRotation: function () {
      return { x: rotX, y: rotY };
    },
    getOrbit: function () {
      return { x: rotX, y: rotY, viewX: viewRotX, viewY: viewRotY };
    },
    setOrbit: function (x, y, snap) {
      rotX = x || 0;
      rotY = y || 0;
      hoverTiltX = 0;
      hoverTiltY = 0;
      targetRotX = rotX;
      targetRotY = rotY;
      if (snap) {
        viewRotX = rotX;
        viewRotY = rotY;
        syncViewToMesh();
      } else {
        applyTransform();
      }
    },
  };

  document.addEventListener("lt-i18n-applied", () => {
    updateName();
  });

  /* Tone finish also washes the page (lighter tint) */
  document.addEventListener("lt-tone-changed", (ev) => {
    const wash = ev && ev.detail && ev.detail.wash;
    if (wash) applyPageWash(wash);
  });
})();

/* Memory Palace — device shell controller
   Desktop + Pad: shelled CSS-3D unit (drag bezel to spin).
   Real narrow phone: full-bleed, no fake island.
   CRITICAL: screen interior keeps pointer-events — tilt/drag never steal clicks. */
(function () {
  const STORAGE_MODEL = "lt-palace-shell-model";
  const STORAGE_FINISH = "lt-palace-shell";

  const MODELS = window.LT_DEVICES.models;

  // The in-phone palette owns IDs, order, colors and translated mood names.
  const FINISHES = window.LT_PALACE.FINISH_IDS.map((finish) => ({
    ...finish,
    wash: window.LT_PALACE.TONE_WASH[finish.id],
    get name() {
      const code = (document.documentElement.lang || "en").slice(0, 2);
      const labels = window.LT_I18N.finishes;
      const label = labels[code]?.[finish.id] || labels.en?.[finish.id];
      return label?.mood || (finish.id === "pure-black" ? "Black" : finish.id);
    },
  }));
  const SHELL_TO_TONE = Object.fromEntries(FINISHES.map(({ id }) => [id, id]));
  const TONE_TO_SHELL = SHELL_TO_TONE;
  // Accept saved shell IDs from the previous palette without showing duplicates.
  const LEGACY_FINISHES = {
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
  function normalizeFinish(id) {
    return LEGACY_FINISHES[id] || id;
  }

  const stage = document.getElementById("demo-stage");
  const unit = document.getElementById("device-unit");
  const rig = document.getElementById("device-rig");
  const swatches = document.getElementById("shell-swatches");
  const modelEl = document.getElementById("shell-models");
  const nameEl = document.getElementById("shell-name");
  const pickerDock = document.getElementById("shell-picker-dock");
  const screenEl = document.querySelector(".device-screen");
  if (!stage || !unit || !rig || !pickerDock) return;

  let linkingFromShell = false;
  let linkingFromTone = false;

  // Rotation state (deg)
  // Left/right (rotY) hard-capped at ±80 so the phone never stands on edge.
  // Up/down (rotX) stays the prior gentle clamp.
  const MAX_YAW = 80;
  const MAX_PITCH = 68;
  let rotX = 0;
  let rotY = 0;
  let backView = false;
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
    // Phones remain phones in landscape. A coarse pointer plus the physical
    // screen's short CSS side avoids misclassifying a tablet with its keyboard.
    return window.matchMedia("(max-width: 540px)").matches ||
      (window.matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) <= 540);
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
        ".shell-bar, .shell-compact, .shell-picker-dock, .shell-dd, .shell-dd-panel, .stage-bar, .lang-switch, .screen-tabs," +
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
    const y = rotY + hoverTiltY + (backView ? 180 : 0);
    unit.style.setProperty("--shell-tilt-x", x.toFixed(2) + "deg");
    unit.style.setProperty("--shell-tilt-y", y.toFixed(2) + "deg");
    // With ±80 yaw we stay front-ish; keep class off so screen stays clickable
    unit.classList.toggle("is-back", backView);
    document.getElementById("shell-flip")?.setAttribute("aria-pressed", String(backView));
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
    if (phone && dragging) onPointerUp({pointerId: activePointerId});
    document.body.classList.toggle("is-real-phone", phone);
    unit.tabIndex = phone ? -1 : 0;
    if (phone) unit.removeAttribute('aria-keyshortcuts');
    else unit.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight ArrowUp ArrowDown Home');
    stage.dataset.mode = phone ? "unshelled" : "shelled";
    stage.classList.toggle("is-floating", !phone && !prefersReduced() && !dragging);
    if (phone) {
      backView = false;
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
    const model = window.LT_DEVICES.get(id);
    unit.dataset.model = model.id;
    stage.dataset.model = model.id;
    stage.style.setProperty("--device-body-w", model.width + "px");
    stage.style.setProperty("--device-body-h", model.height + "px");
    stage.style.setProperty("--shell-radius", model.radius * window.LT_DEVICES.scale + "px");
    stage.style.setProperty("--shell-screen-radius", model.screenRadius * window.LT_DEVICES.scale + "px");
    stage.style.setProperty("--device-inset-x", (model.width - model.displayWidth) / 2 + "px");
    stage.style.setProperty("--device-inset-y", (model.height - model.displayHeight) / 2 + "px");
    unit.setAttribute("aria-label", model.name + " · " + model.dimensions);
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
        b.setAttribute("aria-checked", String(on));
        b.tabIndex = on ? 0 : -1;
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
    const finish = FINISHES.find((s) => s.id === normalizeFinish(id)) || FINISHES[0];
    unit.dataset.shell = finish.id;
    stage.dataset.shell = finish.id;
    stage.style.setProperty("--shell-finish", finish.swatch);
    document.documentElement.style.setProperty("--shell-accent-live", finish.swatch);
    /* Shell wash is a fallback; linked tone wash wins when tone sync runs */
    if (!linkingFromTone) {
      applyPageWash(finish.wash || finish.swatch);
    }
    if (swatches) {
      swatches.querySelectorAll(".shell-swatch").forEach((b) => {
        const on = b.dataset.shell === finish.id;
        b.classList.toggle("is-on", on);
        b.setAttribute("aria-checked", String(on));
        b.tabIndex = on ? 0 : -1;
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
      if (mini.dataset.model !== model.id) {
        mini.innerHTML = phoneSvg(model, 19, 30);
        mini.dataset.model = model.id;
      }
      mini.style.setProperty("--shell-mini-fill", finish.swatch);
    }
    document.documentElement.style.setProperty("--shell-mini-fill", finish.swatch);
    const dot = document.getElementById("shell-color-dot");
    if (dot) {
      dot.style.setProperty("--swatch", finish.swatch);
    }
    const colorName = document.getElementById("shell-color-name");
    if (colorName) colorName.textContent = finish.name;
    const modelBtn = document.getElementById("shell-model-btn");
    if (modelBtn) {
      modelBtn.title = model.name + " · " + finish.name;
      modelBtn.setAttribute("aria-label", tShell("shellLabel", "Phone frame") + ": " + model.name);
    }
    const colorBtn = document.getElementById("shell-color-btn");
    if (colorBtn) {
      colorBtn.title = finish.name;
      colorBtn.setAttribute("aria-label", tShell("shellColorsLabel", "Shell color") + ": " + finish.name);
    }
  }

  function updateName() {
    const model = MODELS.find((m) => m.id === unit.dataset.model) || MODELS[0];
    const finish = FINISHES.find((s) => s.id === unit.dataset.shell) || FINISHES[0];
    if (nameEl) nameEl.textContent = model.name + " · " + model.dimensions;
    updateCompactIcons();
  }

  const pickerAnimations = new WeakMap();
  let dockAnimation = null;
  let dockTarget = 0;

  function animatePickerSpace(height) {
    if (height === dockTarget) return;
    const current = pickerDock.getBoundingClientRect().height;
    dockTarget = height;
    dockAnimation?.cancel();
    pickerDock.style.height = height + "px";
    pickerDock.style.overflow = "hidden";
    if (prefersReduced()) {
      pickerDock.style.overflow = height ? "visible" : "hidden";
      return;
    }
    const animation = pickerDock.animate([{ height: current + "px" }, { height: height + "px" }], {
      duration: height ? 340 : 280,
      easing: "cubic-bezier(.22,1,.36,1)",
    });
    dockAnimation = animation;
    animation.onfinish = () => {
      if (dockAnimation === animation) pickerDock.style.overflow = dockTarget ? "visible" : "hidden";
    };
  }

  function closeShellDrawers(restoreFocus, keepSpace) {
    let closed = false;
    document.querySelectorAll(".shell-dd-panel").forEach((panel) => {
      if (!panel.classList.contains("is-open")) return;
      closed = true;
      const trigger = document.querySelector('[aria-controls="' + panel.id + '"]');
      if (restoreFocus && trigger) trigger.focus({ preventScroll: true });
      const currentStyle = getComputedStyle(panel);
      const opacity = currentStyle.opacity;
      const transform = currentStyle.transform;
      panel.inert = true;
      panel.classList.remove("is-open");
      if (trigger) trigger.setAttribute("aria-expanded", "false");
      pickerAnimations.get(panel)?.cancel();
      if (prefersReduced()) {
        panel.hidden = true;
        return;
      }
      const animation = panel.animate([
        { opacity, transform },
        { opacity: 0, transform: "translateY(-4px) scale(.98)" },
      ], { duration: 130, easing: "cubic-bezier(.4,0,1,1)" });
      pickerAnimations.set(panel, animation);
      animation.onfinish = () => { if (!panel.classList.contains("is-open")) panel.hidden = true; };
    });
    if (closed && !keepSpace) animatePickerSpace(0);
  }

  function positionShellDrawer(panel, trigger) {
    const anchor = pickerDock.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    panel.style.setProperty("--picker-pointer", Math.max(22, Math.min(anchor.width - 22, triggerRect.left + triggerRect.width / 2 - anchor.left)) + "px");
    animatePickerSpace(panel.offsetHeight + 18);
  }

  function positionOpenDrawers() {
    document.querySelectorAll(".shell-dd-panel.is-open").forEach((panel) => {
      positionShellDrawer(panel, document.querySelector('[aria-controls="' + panel.id + '"]'));
    });
  }

  function toggleShellDrawer(kind, keyboard) {
    const panelId = kind === "model" ? "shell-model-panel" : "shell-color-panel";
    const btnId = kind === "model" ? "shell-model-btn" : "shell-color-btn";
    const panel = document.getElementById(panelId);
    const btn = document.getElementById(btnId);
    if (!panel || !btn) return;
    const willOpen = !panel.classList.contains("is-open");
    closeShellDrawers(false, willOpen);
    if (willOpen) {
      pickerAnimations.get(panel)?.cancel();
      panel.hidden = false;
      panel.inert = false;
      panel.classList.add("is-open");
      btn.setAttribute("aria-expanded", "true");
      positionShellDrawer(panel, btn);
      if (!prefersReduced()) {
        pickerAnimations.set(panel, panel.animate([
          { opacity: 0, transform: "translateY(-6px) scale(.975)" },
          { opacity: 1, transform: "translateY(0) scale(1)" },
        ], { duration: 250, delay: 45, fill: "backwards", easing: "cubic-bezier(.16,1,.3,1)" }));
        panel.querySelectorAll('[role="radio"]').forEach((option, i) => {
          option.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "translateY(0)" }],
            { duration: 230, delay: 65 + i * 12, fill: "backwards", easing: "cubic-bezier(.16,1,.3,1)" });
        });
      }
      if (keyboard) panel.querySelector('[aria-checked="true"]')?.focus({ preventScroll: true });
    }
  }

  function wireCompactChrome() {
    const modelBtn = document.getElementById("shell-model-btn");
    const colorBtn = document.getElementById("shell-color-btn");
    if (modelBtn) {
      modelBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleShellDrawer("model", e.detail === 0);
      });
    }
    if (colorBtn) {
      colorBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleShellDrawer("color", e.detail === 0);
      });
    }
    document.addEventListener("click", (e) => {
      const t = e.target;
      if (isPickerTarget(t)) return;
      closeShellDrawers();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && document.querySelector(".shell-dd-panel.is-open")) {
        e.preventDefault();
        closeShellDrawers(true);
      }
    });
    document.querySelectorAll("[data-shell-close]").forEach((button) => {
      button.addEventListener("click", () => closeShellDrawers(true));
    });
    [document.getElementById("shell-compact"), pickerDock].forEach((element) => {
      element.addEventListener("focusout", (e) => {
        if (!isPickerTarget(e.relatedTarget)) closeShellDrawers();
      });
    });
    document.querySelectorAll(".shell-dd-panel [role='radiogroup']").forEach((group) => {
      group.addEventListener("keydown", (e) => {
        const option = e.target.closest("[role='radio']");
        if (!option) return;
        const items = [...group.querySelectorAll("[role='radio']")];
        const offsets = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 1, ArrowUp: -1 };
        let index = items.indexOf(option);
        if (e.key === "Home") index = 0;
        else if (e.key === "End") index = items.length - 1;
        else if (e.key in offsets) index = (index + offsets[e.key] + items.length) % items.length;
        else return;
        e.preventDefault();
        items[index].focus({ preventScroll: true });
        items[index].click();
        const itemRect = items[index].getBoundingClientRect();
        const groupRect = group.getBoundingClientRect();
        if (itemRect.left < groupRect.left || itemRect.right > groupRect.right) {
          group.scrollTo({ left: group.scrollLeft + itemRect.left - groupRect.left - (groupRect.width - itemRect.width) / 2, behavior: prefersReduced() ? "instant" : "smooth" });
        }
      });
    });
    // Keep in-flow space in sync with fonts, locale changes and viewport width.
    const toolbarObserver = new ResizeObserver(positionOpenDrawers);
    toolbarObserver.observe(document.querySelector(".stage-bar"));
    document.querySelectorAll(".shell-dd-panel").forEach((panel) => toolbarObserver.observe(panel));
  }

  function isPickerTarget(target) {
    return target && target.closest && target.closest(".shell-compact, .shell-picker-dock");
  }

  const checkSvg = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8 3 3 6-6"/></svg>';

  function phoneSvg(model, width, height) {
    const w = model.mm.width, h = model.mm.height;
    const sx = (model.width - model.displayWidth) / (2 * window.LT_DEVICES.scale);
    const sy = (model.height - model.displayHeight) / (2 * window.LT_DEVICES.scale);
    const cutout = model.cutout;
    return '<svg class="picker-phone" viewBox="-5 -4 88 174" width="' + width + '" height="' + height + '" aria-hidden="true" focusable="false">' +
      model.buttons.map(([side,y,length]) => '<rect class="picker-phone-button" x="' + (side < 0 ? -1.4 : w - .2) + '" y="' + (h/2-y-length/2) + '" width="1.6" height="' + length + '" rx=".8"/>').join('') +
      '<rect class="picker-phone-body" width="' + w + '" height="' + h + '" rx="' + model.radius + '"/>' +
      '<rect class="picker-phone-screen" x="' + sx + '" y="' + sy + '" width="' + (w-2*sx) + '" height="' + (h-2*sy) + '" rx="' + model.screenRadius + '"/>' +
      '<rect class="picker-phone-chrome" x="' + (w-cutout.width)/2 + '" y="' + (sy+cutout.offset-cutout.height/2) + '" width="' + cutout.width + '" height="' + cutout.height + '" rx="' + cutout.height/2 + '"/>' +
      '<rect class="picker-phone-home" x="' + (w/2-10) + '" y="' + (h-sy-4) + '" width="20" height="1" rx=".5"/></svg>';
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
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-label", m.name);
      btn.innerHTML = phoneSvg(m, 18, 32) + '<span class="shell-model-copy"><strong>' + m.name + '</strong><span>' + m.dimensions + '</span></span><span class="shell-model-check">' + checkSvg + '</span>';
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        applyModel(m.id);
      });
      modelEl.appendChild(btn);
    });
  }

  function buildSwatches() {
    if (!swatches) return;
    swatches.style.setProperty("--shell-color-count", FINISHES.length);
    swatches.innerHTML = "";
    FINISHES.forEach((s) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "shell-swatch";
      btn.dataset.shell = s.id;
      btn.style.setProperty("--swatch", s.swatch);
      const rgb = s.swatch.match(/\w\w/g).map((channel) => parseInt(channel, 16));
      btn.style.setProperty("--swatch-ink", rgb[0] * .299 + rgb[1] * .587 + rgb[2] * .114 > 150 ? "#18202b" : "#fff");
      btn.innerHTML = '<span class="shell-swatch-orb" aria-hidden="true"></span><span class="shell-swatch-name">' + s.name + '</span><span class="shell-swatch-check" aria-hidden="true">' + checkSvg + '</span>';
      btn.title = s.name;
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-label", s.name);
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        applyFinish(s.id);
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
      if (hoverTiltX === 0 && hoverTiltY === 0) return;
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
    if (hoverTiltX === 0 && hoverTiltY === 0) return;
    hoverTiltX = 0;
    hoverTiltY = 0;
    applyTransform();
  }

  function onPointerDown(e) {
    if (isRealPhone()) return;
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
    backView = false;
    rotX = 0;
    rotY = 0;
    hoverTiltX = 0;
    hoverTiltY = 0;
    clampOrbit();
    applyTransform();
  }

  function onDblClickOutside(e) {
    if (isRealPhone()) return;
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
  window.addEventListener("blur", () => {
    if (dragging) onPointerUp({ pointerId: activePointerId });
  });
  rig.addEventListener("pointerleave", onHoverLeave);
  document.addEventListener("dblclick", onDblClickOutside);
  unit.addEventListener('keydown', event => {
    // Only the focused frame owns these keys; inputs/buttons inside keep theirs.
    if (event.target !== unit || isRealPhone()) return;
    const steps={ArrowLeft:[0,-8],ArrowRight:[0,8],ArrowUp:[6,0],ArrowDown:[-6,0]};
    if (event.key === 'Home') { event.preventDefault(); resetOrbit(); return; }
    const step=steps[event.key];
    if (!step) return;
    event.preventDefault();rotX+=step[0];rotY+=step[1];clampOrbit();applyTransform();
  });

  // Hard guarantee: interactive screen keeps auto hit-testing.
  // Do NOT stopPropagation on capture — that would kill button clicks.
  if (screenEl) {
    screenEl.style.pointerEvents = "auto";
  }

  // Reset button
  const resetBtn = document.getElementById("shell-reset");
  if (resetBtn) resetBtn.addEventListener("click", resetOrbit);

  // Explicit back view keeps ordinary front-facing drag within its ±80° range.
  const flipBtn = document.getElementById("shell-flip");
  if (flipBtn) {
    flipBtn.addEventListener("click", () => {
      backView = !backView;
      rotY = 0;
      rotX = 0;
      clampOrbit();
      applyTransform();
    });
  }

  buildModels();
  buildSwatches();
  wireCompactChrome();

  const bootParams = new URLSearchParams(location.search);
  const qModel = bootParams.has("model") ? window.LT_DEVICES.get(bootParams.get("model")).id : null;
  const qShell = normalizeFinish(bootParams.get("shell"));
  let savedModel = null;
  let savedFinish = null;
  try {
    const storedModel = localStorage.getItem(STORAGE_MODEL);
    savedModel = storedModel ? window.LT_DEVICES.get(storedModel).id : null;
    savedFinish = normalizeFinish(localStorage.getItem(STORAGE_FINISH));
  } catch (_) {}

  const bootModel =
    qModel && MODELS.some((m) => m.id === qModel)
      ? qModel
      : savedModel && MODELS.some((m) => m.id === savedModel)
        ? savedModel
        : MODELS[0].id;
  const bootFinish =
    qShell && FINISHES.some((s) => s.id === qShell)
      ? qShell
      : savedFinish && FINISHES.some((s) => s.id === savedFinish)
        ? savedFinish
        : FINISHES[0].id;

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
    if (isRealPhone()) closeShellDrawers();
    else positionOpenDrawers();
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
      return { rotX, rotY: rotY + (backView ? 180 : 0), backView, maxYaw: MAX_YAW, maxPitch: MAX_PITCH };
    },
    setOrbit(x, y) {
      rotX = Number(x) || 0;
      const yaw = Number(y) || 0;
      backView = Math.abs(yaw) >= 100 && Math.abs(yaw) <= 260;
      rotY = backView ? yaw - Math.sign(yaw) * 180 : yaw;
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
    swatches?.querySelectorAll(".shell-swatch").forEach((button) => {
      const finish = FINISHES.find((item) => item.id === button.dataset.shell);
      button.querySelector(".shell-swatch-name").textContent = finish.name;
      button.title = finish.name;
      button.setAttribute("aria-label", finish.name);
    });
    updateCompactIcons();
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

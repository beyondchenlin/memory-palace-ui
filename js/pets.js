/* Memory Palace — mood pets v6
   Animal centered in tone circle. Desktop pet sits bottom-right of phone with gentle bob only (draggable). */
(function () {
  // Native vector art fixes colors that vary across operating-system emoji sets.
  // No image downloads, filters on neighboring UI, or animation loops are needed.
  const OCTOPUS = '<svg class="pet-art" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><g stroke="#39245d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path fill="#7c5cff" d="M14 36c-3 4-8 3-9 7-1 5 4 8 9 5l4-3c-3 7 1 13 6 10l5-6c0 10 9 10 10 0l4 6c5 3 9-3 6-10l4 3c5 3 10 0 9-5-1-4-7-3-9-7V27c0-15-10-21-21-21S11 14 11 27Z"/><path fill="#a89aff" stroke="none" d="M16 24c1-8 7-13 15-13 5 0 10 2 12 5-12-4-21 1-27 8Z"/><ellipse fill="#fff" cx="24" cy="28" rx="7" ry="8"/><ellipse fill="#fff" cx="42" cy="28" rx="7" ry="8"/><ellipse fill="#241b37" stroke="none" cx="26" cy="29" rx="3" ry="4"/><ellipse fill="#241b37" stroke="none" cx="40" cy="29" rx="3" ry="4"/><path fill="none" d="M29 39q4 5 8 0"/><path fill="none" stroke="#b9a7ff" stroke-width="3" d="m12 44 3-1m7 7 2-3m19 3-2-3m11-3-3-1"/></g></svg>';
  const BUTTERFLY = '<svg class="pet-art" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><g stroke="#43255f" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path fill="#9b5de5" d="M29 28C19 6 3 7 5 23c1 10 8 14 15 15C3 39 8 57 19 54c7-2 11-10 13-16 2 6 6 14 13 16 11 3 16-15-1-16 7-1 14-5 15-15C61 7 45 6 35 28Z"/><path stroke="none" fill="#c6a1f4" d="M24 27C16 13 9 13 10 22c1 7 7 10 14 11ZM40 27c8-14 15-14 14-5-1 7-7 10-14 11ZM23 42c-11-1-11 9-5 8 3-1 5-5 5-8Zm18 0c11-1 11 9 5 8-3-1-5-5-5-8Z"/><path fill="#59347d" d="M28 25q4-5 8 0l-1 19q-3 8-6 0Z"/><circle fill="#bb8bf0" cx="32" cy="22" r="6"/><path fill="none" d="m29 17-4-6m10 6 4-6"/><circle fill="#20172c" stroke="none" cx="30" cy="22" r="1.2"/><circle fill="#20172c" stroke="none" cx="34" cy="22" r="1.2"/></g></svg>';
  const CRAB = '<svg class="pet-art" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><g stroke="#682139" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path fill="none" stroke="#e11d48" stroke-width="4" d="m22 36-12 4-5 8m18-5-7 8-7 3m33-18 12 4 5 8m-18-5 7 8 7 3M21 33q-9-4-9-12m31 12q9-4 9-12"/><path fill="#e11d48" d="M13 24C3 24 1 13 6 8l4 8 5-8c7 5 5 14-2 16Z"/><path fill="#e11d48" d="M51 24c10 0 12-11 7-16l-4 8-5-8c-7 5-5 14 2 16Z"/><ellipse fill="#e11d48" cx="32" cy="37" rx="17" ry="12"/><path fill="none" d="m25 29-1-7m15 7 1-7"/><circle fill="#fff" cx="24" cy="21" r="4"/><circle fill="#fff" cx="40" cy="21" r="4"/><circle fill="#251822" stroke="none" cx="25" cy="21" r="1.8"/><circle fill="#251822" stroke="none" cx="39" cy="21" r="1.8"/><path fill="none" stroke="#ff8da7" stroke-width="3" d="M22 33q10-7 20 0"/><path fill="none" d="M27 39q5 6 10 0"/></g></svg>';
  const PET_MAP = {
    duolingo: { emoji: "🐸", id: "frog", nameKey: "petFrog" },
    "violet-night": { emoji: "🐙", art: OCTOPUS, id: "octopus", nameKey: "petOctopus" },
    "space-gold": { emoji: "🐥", id: "chick", nameKey: "petChick" },
    "space-blue": { emoji: "🐬", id: "dolphin", nameKey: "petDolphin" },
    "product-red": { emoji: "🦀", art: CRAB, id: "crab", nameKey: "petCrab" },
    "sierra-blue": { emoji: "🐳", id: "whale", nameKey: "petWhale" },
    purple: { emoji: "🦋", art: BUTTERFLY, id: "butterfly", nameKey: "petButterfly" },
    midnight: { emoji: "🦝", id: "raccoon", nameKey: "petRaccoon" },
    starlight: { emoji: "🐰", id: "bunny", nameKey: "petBunny" },
    "natural-titanium": { emoji: "🦔", id: "hedgehog", nameKey: "petHedgehog" },
    "pure-black": { emoji: "🐼", id: "panda", nameKey: "petPanda" },
  };

  const DEFAULT = PET_MAP.duolingo;
  let petEl = null;
  let drag = null;

  function t(key, fallback) {
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

  function petFor(finishId) {
    return PET_MAP[finishId] || DEFAULT;
  }

  function setGlyph(element, pet) {
    if (element.dataset.pet === pet.id) return;
    element.dataset.pet = pet.id;
    if (pet.art) element.innerHTML = pet.art;
    else element.textContent = pet.emoji;
  }

  function openToneFromPet() {
    const lesson = document.getElementById("screen-lesson");
    const onLesson = lesson && lesson.classList.contains("is-active");
    const home = document.getElementById("screen-home");
    // Navigation closes tone popovers, so switch screens before opening one.
    if (!onLesson && !(home && home.classList.contains("is-active"))) {
      document.querySelector('.tab[data-screen="home"]')?.click();
    }
    let usePop = onLesson ? "finish-popover-lesson" : "finish-popover-home";
    let useChip = onLesson ? "finish-chip-lesson" : "finish-chip-home";
    let useMascot = onLesson ? "mascot-lesson" : "mascot-home";
    if (home && home.classList.contains("is-active")) {
      usePop = "finish-popover-home";
      useChip = "finish-chip-home";
      useMascot = "mascot-home";
    }
    const pop = document.getElementById(usePop);
    const chip = document.getElementById(useChip);
    const mascot = document.getElementById(useMascot);
    if (!pop) return;
    document.querySelectorAll(".finish-popover").forEach((p) => p.classList.remove("is-open"));
    document.querySelectorAll(".finish-chip, .mascot-btn").forEach((c) =>
      c.setAttribute("aria-expanded", "false")
    );
    pop.classList.add("is-open");
    if (chip) chip.setAttribute("aria-expanded", "true");
    if (mascot) mascot.setAttribute("aria-expanded", "true");
  }

  function placeDefaultBesidePhone(el) {
    const unit = document.getElementById("device-unit");
    const stage = document.querySelector(".stage") || document.body;
    if (!unit) {
      el.style.left = "calc(50% + 180px)";
      el.style.top = "68%";
      return;
    }
    const ur = unit.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    const left = ur.right - sr.left + 8;
    const maxLeft = Math.max(8, Math.min(sr.width, innerWidth - sr.left) - 72);
    const top = ur.bottom - sr.top - 72;
    el.style.left = Math.max(8, Math.min(left, maxLeft)) + "px";
    el.style.top = Math.max(8, top) + "px";
    el.style.right = "auto";
    el.style.bottom = "auto";
  }

  function constrainPosition(el, x, y) {
    const stage = document.querySelector(".stage") || document.body;
    const bounds = stage.getBoundingClientRect();
    const maxX = Math.max(8, Math.min(bounds.width, innerWidth - bounds.left) - el.offsetWidth - 8);
    const maxY = Math.max(8, bounds.height - el.offsetHeight - 8);
    el.style.left = Math.max(8, Math.min(x, maxX)) + "px";
    el.style.top = Math.max(8, Math.min(y, maxY)) + "px";
  }

  function reconcilePosition() {
    if (!petEl || document.body.classList.contains("is-real-phone")) return;
    if (petEl.dataset.userMoved) {
      constrainPosition(petEl, parseFloat(petEl.style.left) || 8, parseFloat(petEl.style.top) || 8);
    } else placeDefaultBesidePhone(petEl);
  }

  function ensureStagePet() {
    if (petEl && petEl.isConnected) return petEl;
    const stage = document.querySelector(".stage") || document.body;
    if (getComputedStyle(stage).position === "static") {
      stage.style.position = "relative";
    }
    petEl = document.createElement("button");
    petEl.type = "button";
    petEl.id = "stage-pet";
    petEl.className = "stage-pet";
    petEl.setAttribute("aria-label", t("mascotAria", "Open today's tone"));
    petEl.title = t("mascotAria", "Open today's tone");
    petEl.innerHTML =
      '<span class="stage-pet-bubble" aria-hidden="true"></span><span class="stage-pet-emoji" aria-hidden="true">🐸</span>';
    petEl.addEventListener("click", (e) => {
      if (petEl.dataset.didDrag === "1" && e.detail !== 0) {
        petEl.dataset.didDrag = "0";
        return;
      }
      petEl.dataset.didDrag = "0";
      e.preventDefault();
      e.stopPropagation();
      petEl.classList.remove("is-react");
      void petEl.offsetWidth;
      petEl.classList.add("is-react");
      openToneFromPet();
    });
    /* Drag anywhere — our idle anim must NOT wander */
    petEl.addEventListener("pointerdown", (e) => {
      if (document.body.classList.contains("is-real-phone")) return;
      if (e.button != null && e.button !== 0) return;
      if (drag || e.isPrimary === false) return;
      // A canceled gesture may not produce a click to consume its suppression.
      petEl.dataset.didDrag = "0";
      e.stopPropagation();
      const rect = petEl.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      drag = {
        id: e.pointerId,
        ox: e.clientX - rect.left,
        oy: e.clientY - rect.top,
        moved: false,
        stageLeft: stageRect.left,
        stageTop: stageRect.top,
        startX: e.clientX,
        startY: e.clientY,
      };
      petEl.classList.add("is-dragging");
      try {
        petEl.setPointerCapture(e.pointerId);
      } catch (_) {}
    });
    petEl.addEventListener("pointermove", (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      const x = e.clientX - drag.stageLeft - drag.ox;
      const y = e.clientY - drag.stageTop - drag.oy;
      if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 4) drag.moved = true;
      constrainPosition(petEl, x, y);
      petEl.style.right = "auto";
      petEl.style.bottom = "auto";
    });
    const endDrag = (e) => {
      if (!drag || (e && drag.id !== e.pointerId)) return;
      const previous = drag;
      drag = null;
      if (previous.moved) {
        petEl.dataset.didDrag = "1";
        petEl.dataset.userMoved = "1";
      }
      petEl.classList.remove("is-dragging");
      if (petEl.hasPointerCapture(previous.id)) petEl.releasePointerCapture(previous.id);
    };
    petEl.addEventListener("pointerup", endDrag);
    petEl.addEventListener("pointercancel", endDrag);
    petEl.addEventListener("lostpointercapture", endDrag);
    window.addEventListener("blur", () => endDrag());
    stage.appendChild(petEl);
    placeDefaultBesidePhone(petEl);
    return petEl;
  }

  function syncMascots(finishId) {
    const pet = petFor(finishId);
    document.querySelectorAll(".mascot-btn").forEach((btn) => {
      btn.classList.add("has-centered-pet");
      const eye = btn.querySelector(".mascot-eye");
      if (eye) eye.setAttribute("aria-hidden", "true");
      let badge = btn.querySelector(".mascot-pet");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "mascot-pet";
        badge.setAttribute("aria-hidden", "true");
        btn.appendChild(badge);
      }
      let glyph = badge.querySelector(".mascot-pet-glyph");
      if (!glyph) {
        glyph = document.createElement("span");
        glyph.className = "mascot-pet-glyph";
        badge.replaceChildren(glyph);
      }
      setGlyph(glyph, pet);
      btn.title = t(pet.nameKey, pet.id) + " · " + t("mascotAria", "Open today's tone");
    });
  }

  function syncStagePet(finishId) {
    const phone = document.body.classList.contains("is-real-phone");
    const el = ensureStagePet();
    const pet = petFor(finishId);
    const emoji = el.querySelector(".stage-pet-emoji");
    if (emoji) setGlyph(emoji, pet);
    el.dataset.pet = pet.id;
    el.setAttribute(
      "aria-label",
      t(pet.nameKey, pet.id) + " · " + t("mascotAria", "Open today's tone")
    );
    el.title = el.getAttribute("aria-label");
    el.classList.toggle("is-hidden", phone);
    el.hidden = !!phone;
    el.tabIndex = phone ? -1 : 0;
    if (!phone && !el.dataset.userMoved) {
      placeDefaultBesidePhone(el);
    }
  }

  function apply(finishId) {
    syncMascots(finishId);
    syncStagePet(finishId);
  }

  function decorateSwatches() {
    document.querySelectorAll(".finish-swatch, .shell-swatch").forEach((btn) => {
      const id = btn.dataset.finish || btn.dataset.shell;
      const pet = petFor(id);
      const circle = btn.querySelector(".sw, .shell-swatch-orb");
      if (!circle) return;
      let slot = btn.querySelector(".swatch-pet");
      if (!slot) {
        slot = document.createElement("span");
        slot.className = "swatch-pet";
        slot.setAttribute("aria-hidden", "true");
      }
      if (slot.parentElement !== circle) circle.appendChild(slot);
      setGlyph(slot, pet);
    });
  }

  const mo = new MutationObserver(() => {
    const id = document.documentElement.getAttribute("data-finish") || "duolingo";
    apply(id);
  });
  mo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-finish"],
  });

  document.addEventListener("lt-i18n-applied", () => {
    decorateSwatches();
    apply(document.documentElement.getAttribute("data-finish") || "duolingo");
  });

  const watchBody = new MutationObserver(() => {
    apply(document.documentElement.getAttribute("data-finish") || "duolingo");
  });
  watchBody.observe(document.body, { attributes: true, attributeFilter: ["class"] });

  window.addEventListener("resize", reconcilePosition);

  const pickerDock = document.getElementById("shell-picker-dock");
  if (pickerDock) {
    const followLayout = new ResizeObserver(reconcilePosition);
    followLayout.observe(pickerDock);
    followLayout.observe(document.querySelector(".stage"));
  }

  function boot() {
    decorateSwatches();
    apply(document.documentElement.getAttribute("data-finish") || "duolingo");
    document.querySelectorAll(".finish-grid").forEach((g) => {
      const go = new MutationObserver(() => decorateSwatches());
      go.observe(g, { childList: true });
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.LT_PETS = { map: PET_MAP, petFor, apply, decorateSwatches, openToneFromPet };
})();

/* Memory Palace — mood pets v6
   Animal centered in tone circle. Desktop pet sits bottom-right of phone with gentle bob only (draggable). */
(function () {
  const PET_MAP = {
    duolingo: { emoji: "🐸", id: "frog", nameKey: "petFrog" },
    "violet-night": { emoji: "🦉", id: "owl", nameKey: "petOwl" },
    "space-gold": { emoji: "🦊", id: "fox", nameKey: "petFox" },
    "space-blue": { emoji: "🐬", id: "dolphin", nameKey: "petDolphin" },
    "product-red": { emoji: "🦜", id: "parrot", nameKey: "petParrot" },
    "sierra-blue": { emoji: "🐧", id: "penguin", nameKey: "petPenguin" },
    purple: { emoji: "🦩", id: "flamingo", nameKey: "petFlamingo" },
    midnight: { emoji: "🐱", id: "cat", nameKey: "petCat" },
    starlight: { emoji: "🐰", id: "bunny", nameKey: "petBunny" },
    "natural-titanium": { emoji: "🐻", id: "bear", nameKey: "petBear" },
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

  function openToneFromPet() {
    const lesson = document.getElementById("screen-lesson");
    const onLesson = lesson && lesson.classList.contains("is-active");
    const home = document.getElementById("screen-home");
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
    if (!onLesson && !(home && home.classList.contains("is-active"))) {
      const tab = document.querySelector('.tab[data-screen="home"]');
      if (tab) tab.click();
      requestAnimationFrame(() => {
        const hp = document.getElementById("finish-popover-home");
        if (hp) hp.classList.add("is-open");
      });
    }
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
    const top = ur.bottom - sr.top - 72;
    el.style.left = Math.max(8, left) + "px";
    el.style.top = Math.max(8, top) + "px";
    el.style.right = "auto";
    el.style.bottom = "auto";
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
      if (petEl.dataset.didDrag === "1") {
        petEl.dataset.didDrag = "0";
        return;
      }
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
      if (!drag.moved && Math.hypot(e.movementX || 0, e.movementY || 0) > 2) drag.moved = true;
      petEl.style.left = x + "px";
      petEl.style.top = y + "px";
      petEl.style.right = "auto";
      petEl.style.bottom = "auto";
    });
    const endDrag = (e) => {
      if (!drag || (e && drag.id !== e.pointerId)) return;
      if (drag.moved) {
        petEl.dataset.didDrag = "1";
        petEl.dataset.userMoved = "1";
      }
      petEl.classList.remove("is-dragging");
      drag = null;
    };
    petEl.addEventListener("pointerup", endDrag);
    petEl.addEventListener("pointercancel", endDrag);
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
      glyph.textContent = pet.emoji;
      btn.title = t(pet.nameKey, pet.id) + " · " + t("mascotAria", "Open today's tone");
    });
  }

  function syncStagePet(finishId) {
    const phone = document.body.classList.contains("is-real-phone");
    const el = ensureStagePet();
    const pet = petFor(finishId);
    const emoji = el.querySelector(".stage-pet-emoji");
    if (emoji) emoji.textContent = pet.emoji;
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
    document.querySelectorAll(".finish-swatch").forEach((btn) => {
      const id = btn.dataset.finish;
      const pet = petFor(id);
      const circle = btn.querySelector(".sw");
      if (!circle) return;
      let slot = btn.querySelector(".swatch-pet");
      if (!slot) {
        slot = document.createElement("span");
        slot.className = "swatch-pet";
        slot.setAttribute("aria-hidden", "true");
      }
      if (slot.parentElement !== circle) circle.appendChild(slot);
      slot.textContent = pet.emoji;
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

  window.addEventListener("resize", () => {
    if (petEl && !petEl.dataset.userMoved && !document.body.classList.contains("is-real-phone")) {
      placeDefaultBesidePhone(petEl);
    }
  });

  const pickerDock = document.getElementById("shell-picker-dock");
  if (pickerDock) {
    const followLayout = new ResizeObserver(() => {
      if (petEl && !petEl.dataset.userMoved && !document.body.classList.contains("is-real-phone")) {
        placeDefaultBesidePhone(petEl);
      }
    });
    followLayout.observe(pickerDock);
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

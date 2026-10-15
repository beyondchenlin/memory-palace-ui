(function () {
  const FINISH_IDS = [
    { id: "duolingo", swatch: "#58cc02" },
    { id: "violet-night", swatch: "#7c5cff" },
    { id: "space-gold", swatch: "#c9a227" },
    { id: "space-blue", swatch: "#2f6fed" },
    { id: "product-red", swatch: "#e11d48" },
    { id: "sierra-blue", swatch: "#69b4e8" },
    { id: "purple", swatch: "#9b5de5" },
    { id: "midnight", swatch: "#2c2c2e" },
    { id: "starlight", swatch: "#f5f0e8" },
    { id: "natural-titanium", swatch: "#a89f91" },
  ];
  const STORAGE_FINISH = "lt-palace-finish";
  const STORAGE_FOLLOW = "lt-palace-follow-tone";
  const STORAGE_LOCALE = "lt-palace-locale";
  const I18N = window.LT_I18N;

  let locale = "en";
  try {
    const saved = localStorage.getItem(STORAGE_LOCALE);
    if (saved && I18N.strings[saved]) locale = saved;
  } catch (_) {}

  function t(key) {
    const pack = I18N.strings[locale] || I18N.strings.en;
    return pack[key] != null ? pack[key] : (I18N.strings.en[key] || key);
  }

  function finishMood(id) {
    const map = (I18N.finishes[locale] || I18N.finishes.en)[id] || I18N.finishes.en[id];
    return map || { mood: id, hint: "" };
  }

  function applyI18n() {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : locale;
    document.title = t("docTitle");
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const val = t(key);
      if (el.hasAttribute("data-i18n-html")) el.innerHTML = val;
      else el.textContent = val;
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria")));
    });
    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
    });
    document.querySelectorAll(".lang-switch button").forEach((b) => {
      b.classList.toggle("is-on", b.dataset.locale === locale);
    });
    try { document.dispatchEvent(new CustomEvent("lt-i18n-applied")); } catch (_) {}
    // Rebuild tone grids with mood labels
    buildFinishGrid(document.getElementById("finish-grid-home"));
    buildFinishGrid(document.getElementById("finish-grid-lesson"));
    const cur = document.documentElement.getAttribute("data-finish");
    if (cur) syncSwatchSelection(cur);
    updateToneChipLabels();
  }

  const tabs = document.querySelectorAll(".tab");
  const screens = document.querySelectorAll(".screen");
  const gotoBtns = document.querySelectorAll("[data-goto]");
  const clipChips = document.querySelectorAll(".clip-chip");
  const poster = document.getElementById("poster");
  const lessonScreen = document.getElementById("screen-lesson");
  const videoStage = document.getElementById("video-stage");
  const sheet = document.getElementById("interpret-sheet");
  const duckBadge = document.getElementById("audio-duck-badge");
  const btnInterpret = document.getElementById("btn-interpret");
  const btnClose = document.getElementById("btn-close-interpret");
  const scrim = document.getElementById("interpret-scrim");
  const btnSheetDone = document.getElementById("btn-sheet-done");
  const btnSheetNext = document.getElementById("btn-sheet-next");
  const btnCheck = document.getElementById("btn-check");
  const btnSkip = document.getElementById("btn-skip-note");

  function showScreen(id) {
    closeInterpret();
    closeFinishPopovers();
    screens.forEach((s) => {
      s.classList.toggle("is-active", s.dataset.screen === id);
    });
    tabs.forEach((tEl) => {
      tEl.classList.toggle("is-active", tEl.dataset.screen === id);
    });
  }

  function setMuted(on) {
    if (videoStage) videoStage.classList.toggle("is-ducked", on);
    if (duckBadge) duckBadge.hidden = !on;
    if (lessonScreen) lessonScreen.classList.toggle("is-interpreting", on);
    if (btnInterpret) {
      btnInterpret.classList.toggle("is-open", on);
      btnInterpret.setAttribute("aria-expanded", on ? "true" : "false");
    }
  }

  function openInterpret() {
    if (!sheet) return;
    closeFinishPopovers();
    sheet.hidden = false;
    sheet.setAttribute("aria-hidden", "false");
    setMuted(true);
  }

  function closeInterpret() {
    if (!sheet || sheet.hidden) {
      setMuted(false);
      return;
    }
    sheet.hidden = true;
    sheet.setAttribute("aria-hidden", "true");
    setMuted(false);
  }

  /* —— Date-seeded daily finish —— */
  function ymdLocal() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function hashSeed(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function dailyFinishId() {
    const idx = hashSeed(ymdLocal() + "|lt-tone") % FINISH_IDS.length;
    return FINISH_IDS[idx].id;
  }

  function isFollowOn() {
    try {
      return localStorage.getItem(STORAGE_FOLLOW) === "1";
    } catch (_) {
      return false;
    }
  }

  function setFollow(on) {
    try {
      localStorage.setItem(STORAGE_FOLLOW, on ? "1" : "0");
    } catch (_) {}
    document.querySelectorAll(".follow-tone-input").forEach((el) => {
      el.checked = !!on;
    });
    if (on) applyFinish(dailyFinishId(), true);
  }

  function syncSwatchSelection(id) {
    document.querySelectorAll(".finish-swatch").forEach((el) => {
      el.classList.toggle("is-on", el.dataset.finish === id);
    });
  }

  function updateToneChipLabels() {
    document.querySelectorAll(".finish-chip em[data-i18n='toneChip']").forEach((em) => {
      em.textContent = t("toneChip");
    });
  }

  function applyFinish(id, persist) {
    const fin = FINISH_IDS.find((f) => f.id === id) || FINISH_IDS[0];
    document.documentElement.setAttribute("data-finish", fin.id);
    if (persist !== false) {
      try {
        localStorage.setItem(STORAGE_FINISH, fin.id);
      } catch (_) {}
    }
    syncSwatchSelection(fin.id);
    const idx = FINISH_IDS.findIndex((f) => f.id === fin.id);
    const preview = [
      FINISH_IDS[idx].swatch,
      FINISH_IDS[(idx + 1) % FINISH_IDS.length].swatch,
      FINISH_IDS[(idx + 2) % FINISH_IDS.length].swatch,
    ];
    document.querySelectorAll(".finish-chip-dots").forEach((dots) => {
      const is = dots.querySelectorAll("i");
      preview.forEach((c, i) => {
        if (is[i]) is[i].style.background = c;
      });
    });
    // Mascot pupil tint
    document.querySelectorAll(".mascot-eye").forEach((eye) => {
      eye.style.setProperty("--mascot-glow", fin.swatch);
    });
  }

  function buildFinishGrid(gridEl) {
    if (!gridEl) return;
    gridEl.innerHTML = "";
    FINISH_IDS.forEach((f) => {
      const mood = finishMood(f.id);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "finish-swatch";
      btn.dataset.finish = f.id;
      btn.setAttribute("role", "option");
      btn.title = mood.mood + " · " + mood.hint;
      btn.innerHTML =
        '<span class="sw" style="background:' +
        f.swatch +
        '"></span><span>' +
        mood.mood +
        "</span>";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        // Manual pick turns off follow for that choice's persistence
        if (isFollowOn()) setFollow(false);
        applyFinish(f.id);
        closeFinishPopovers();
      });
      gridEl.appendChild(btn);
    });
  }

  function closeFinishPopovers() {
    document.querySelectorAll(".finish-popover").forEach((p) => p.classList.remove("is-open"));
    document.querySelectorAll(".finish-chip, .mascot-btn").forEach((c) =>
      c.setAttribute("aria-expanded", "false")
    );
  }

  function openTonePopover(popId, trigger) {
    const pop = document.getElementById(popId);
    if (!pop) return;
    const open = !pop.classList.contains("is-open");
    closeFinishPopovers();
    if (open) {
      pop.classList.add("is-open");
      if (trigger) trigger.setAttribute("aria-expanded", "true");
    }
  }

  function wireFinishChip(chipId, popoverId) {
    const chip = document.getElementById(chipId);
    const pop = document.getElementById(popoverId);
    if (!chip || !pop) return;
    chip.addEventListener("click", (e) => {
      e.stopPropagation();
      openTonePopover(popoverId, chip);
    });
  }

  function wireMascot(btnId, popoverId) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openTonePopover(popoverId, btn);
    });
  }

  buildFinishGrid(document.getElementById("finish-grid-home"));
  buildFinishGrid(document.getElementById("finish-grid-lesson"));
  wireFinishChip("finish-chip-home", "finish-popover-home");
  wireFinishChip("finish-chip-lesson", "finish-popover-lesson");
  wireMascot("mascot-home", "finish-popover-home");
  wireMascot("mascot-lesson", "finish-popover-lesson");

  document.querySelectorAll(".follow-tone-input").forEach((el) => {
    el.checked = isFollowOn();
    el.addEventListener("change", (e) => {
      e.stopPropagation();
      setFollow(el.checked);
    });
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".finish-wrap") && !e.target.closest(".mascot-wrap")) {
      closeFinishPopovers();
    }
  });

  /* Locale switcher */
  document.querySelectorAll(".lang-switch button").forEach((btn) => {
    btn.addEventListener("click", () => {
      locale = btn.dataset.locale || "en";
      try {
        localStorage.setItem(STORAGE_LOCALE, locale);
      } catch (_) {}
      applyI18n();
    });
  });

  let savedFinish = null;
  try {
    savedFinish = localStorage.getItem(STORAGE_FINISH);
  } catch (_) {}

  let initial;
  if (isFollowOn()) {
    initial = dailyFinishId();
  } else if (savedFinish && FINISH_IDS.some((f) => f.id === savedFinish)) {
    initial = savedFinish;
  } else {
    initial = document.documentElement.getAttribute("data-finish") || "duolingo";
  }
  applyFinish(initial, false);
  applyI18n();

  tabs.forEach((tEl) => {
    tEl.addEventListener("click", () => showScreen(tEl.dataset.screen));
  });

  gotoBtns.forEach((btn) => {
    btn.addEventListener("click", () => showScreen(btn.dataset.goto));
  });

  if (btnInterpret)
    btnInterpret.addEventListener("click", () => {
      if (sheet && !sheet.hidden) closeInterpret();
      else openInterpret();
    });
  if (btnClose) btnClose.addEventListener("click", () => closeInterpret());
  if (scrim) scrim.addEventListener("click", () => closeInterpret());
  if (btnSheetDone) btnSheetDone.addEventListener("click", () => closeInterpret());
  if (btnSheetNext) {
    btnSheetNext.addEventListener("click", () => {
      closeInterpret();
      showScreen("settle");
    });
  }
  if (btnCheck) {
    btnCheck.addEventListener("click", () => {
      const rails = document.getElementById("type-rails");
      if (rails) {
        rails.innerHTML =
          '<span class="rail-word is-done">I</span>' +
          '<span class="rail-word is-done">love</span>' +
          '<span class="rail-word is-done">you.</span>';
      }
      openInterpret();
    });
  }
  if (btnSkip) {
    btnSkip.addEventListener("click", () => {
      closeInterpret();
      showScreen("settle");
    });
  }

  clipChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      clipChips.forEach((c) => c.classList.remove("is-on"));
      chip.classList.add("is-on");
      if (!poster) return;
      if (chip.dataset.clip === "b") {
        poster.classList.remove("poster-war");
        poster.classList.add("poster-toon");
        const label = poster.querySelector(".poster-label strong");
        if (label) label.textContent = "Cartoon · Soft scene";
      } else {
        poster.classList.remove("poster-toon");
        poster.classList.add("poster-war");
        const label = poster.querySelector(".poster-label strong");
        if (label) label.textContent = "War drama · Scene 04";
      }
    });
  });

  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const scope = btn.dataset.scope || "library";
      const group = btn.closest(".lang-toggle");
      if (group) {
        group.querySelectorAll(".lang-btn").forEach((b) => b.classList.remove("is-on"));
      }
      btn.classList.add("is-on");
      const isNative = btn.dataset.lang === "zh";
      if (scope === "sheet") {
        const zh = document.querySelector(".sheet-zh");
        const en = document.querySelector(".sheet-en");
        if (zh) zh.classList.toggle("is-hidden", !isNative);
        if (en) en.classList.toggle("is-hidden", isNative);
      } else {
        const zh = document.querySelector("#palace-body .palace-zh");
        const en = document.querySelector("#palace-body .palace-en");
        if (zh) zh.classList.toggle("is-hidden", !isNative);
        if (en) en.classList.toggle("is-hidden", isNative);
      }
    });
  });

  const rails = document.getElementById("type-rails");
  if (rails) {
    let typed = false;
    rails.addEventListener("click", () => {
      if (typed) return;
      typed = true;
      rails.innerHTML =
        '<span class="rail-word is-done">I</span>' +
        '<span class="rail-word is-done">love</span>' +
        '<span class="rail-word is-done">you.</span>';
    });
  }
})();

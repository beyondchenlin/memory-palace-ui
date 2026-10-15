/* Boot: CSS copper shell at moderate size → GLB+texture ready → one reveal. */
import { createDeviceMesh } from "./device-mesh.js";

const mount = document.getElementById("device-webgl-mount");
const creditEl = document.getElementById("device-credit");
const screenEl = document.querySelector(".device-screen");
const rig = document.getElementById("device-rig");
const stage =
  document.getElementById("demo-stage") ||
  document.querySelector(".product-stage") ||
  document.querySelector(".demo-stage");

function setModerateFit() {
  if (!stage) return;
  const availH = Math.max(420, window.innerHeight - 200);
  const availW = Math.max(260, Math.min(window.innerWidth - 64, 420));
  const s = Math.min(0.92, availH / 900, availW / 430);
  stage.style.setProperty("--shell-fit", s.toFixed(3));
}

async function boot() {
  const params = new URLSearchParams(location.search);
  const phoneMode =
    params.get("forcePhone") === "1" ||
    (params.get("forceShell") !== "1" &&
      window.matchMedia("(max-width: 540px)").matches);

  setModerateFit();

  if (phoneMode) {
    document.body.classList.add("is-real-phone");
  } else if (!mount) {
    console.warn("[palace] no webgl mount — shell will run without GLTF");
  } else {
    document.body.classList.add("is-gltf-pending");
    if (rig && mount.parentElement !== rig) {
      rig.insertBefore(mount, rig.firstChild);
    }
    try {
      const mesh = createDeviceMesh({
        mount,
        creditEl,
        screenEl,
        backLine: "Hear it. Type it. Keep it.",
      });
      window.LT_MESH = mesh;
      await mesh.ready;
      setModerateFit();
      mesh.matchCssUnitFraming?.();
      /* Atomic reveal: classes + overlay in same turn — no copper+HTML double */
      document.body.classList.add(
        "has-gltf-chassis",
        "has-glued-screen",
        "has-texture-screen",
        "has-gltf-ready",
      );
      document.body.classList.remove("is-gltf-pending");
      mesh.revealFront?.();
      mesh.resize?.();
      console.info("[palace] chassis ready", mesh.getLoadMs?.(), "ms");
    } catch (err) {
      console.error("[palace] GLTF chassis failed", err);
      document.body.classList.remove("is-gltf-pending");
      document.body.classList.add("gltf-chassis-failed");
      if (screenEl) {
        const bezel = document.querySelector(".device-bezel");
        if (bezel && !bezel.contains(screenEl)) bezel.appendChild(screenEl);
      }
    }
  }

  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "js/device-shell.js";
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });

  setModerateFit();
  if (window.LT_MESH?.matchCssUnitFraming) {
    requestAnimationFrame(() => {
      window.LT_MESH.matchCssUnitFraming();
      window.LT_MESH.revealFront?.();
      window.LT_MESH.resize?.();
    });
  }
}

boot();

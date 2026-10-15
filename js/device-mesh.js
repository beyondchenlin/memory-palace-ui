/* Memory Palace v10g — size-locked UV glue + multi-chassis path
   Reference: phone-mockup-studio UV affine on screen.001
   - Moderate size locked to CSS unit (no grow after GLB)
   - Hide WebGL until texture captured; CSS copper shell meantime
   - One reveal: chassis + full UI, no white / no double-phone flash
   - HTML overlay when near-front for clicks; UV while orbiting
   - Rear camera bump forced opaque white; finish tints chassis metal
   - CHASSIS_REGISTRY: 17pm default · 15pm optional · android reserved */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { toCanvas } from "html-to-image";

const PX_W = 390;
const PX_H = 844;
const FRONT_DOT = 0.951; /* ~cos(18°) — clickable near-front; UV when orbiting */
const CAPTURE_MIN_MS = 280;
const DRAG_CAPTURE_MS = 900;

/** Real-device GLB registry. Island chrome only on island-family shells.
 *  Android / hole-punch entries must set topChrome:"hole" and never draw CSS island.
 *  Add new devices here + meshopt .min.glb; do not DIY SVG bodies. */
const CHASSIS_REGISTRY = {
  "17pm": {
    id: "17pm",
    label: "iPhone 17 Pro Max",
    family: "island",
    topChrome: "island",
    url: "assets/models/iphone-17-pro-max.min.glb",
    fallbackUrl: "assets/models/iphone-17-pro-max.glb",
    screenMat: "screen.001",
    rot: [0, Math.PI / 2, 0],
    uv: { repeat: [-1.028278, -1], offset: [0.020257, 1.0019], clamp: true },
    credit: "iPhone 17 Pro Max · phone-mockup-studio UV glue · meshopt",
    cameraBumpMat: "Material.007",
  },
  "15pm": {
    id: "15pm",
    label: "iPhone 15 Pro Max",
    family: "island",
    topChrome: "island",
    url: "assets/models/iphone-15-pro-max.glb",
    fallbackUrl: "assets/models/iphone-15-pro-max.glb",
    screenMat: "screen.001",
    rot: [0, Math.PI / 2, 0],
    /* Approximate until studio affine tuned — prefer 17pm in production */
    uv: { repeat: [-1.02, -1], offset: [0.02, 1.0], clamp: true },
    credit: "iPhone 15 Pro Max · Sketchfab CC BY · UV glue",
    cameraBumpMat: "Material.007",
  },
  /* Reserved: drop meshopt Android GLB + UV affine, set family:"android" topChrome:"hole" */
  android: null,
};

let CHASSIS = CHASSIS_REGISTRY["17pm"];

function resolveChassisId(hint) {
  const params = new URLSearchParams(location.search);
  const q = (hint || params.get("chassis") || params.get("device") || "17pm").toLowerCase();
  if (q === "15" || q === "15pm" || q === "iphone15") return "15pm";
  if (q === "android" || q === "hole") return CHASSIS_REGISTRY.android ? "android" : "17pm";
  return CHASSIS_REGISTRY[q] ? q : "17pm";
}

function makeBackTexture(line) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 2048;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#0c0e12";
  ctx.fillRect(0, 0, c.width, c.height);
  const g = ctx.createRadialGradient(512, 900, 80, 512, 980, 700);
  g.addColorStop(0, "rgba(88,204,2,0.18)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#58cc02";
  ctx.beginPath();
  ctx.arc(512, 720, 54, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0c0e12";
  ctx.font = "bold 54px Nunito, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("LT", 512, 738);
  ctx.fillStyle = "#f4f7f2";
  ctx.font = "800 72px Nunito, system-ui, sans-serif";
  ctx.fillText("LingoTrace", 512, 980);
  ctx.fillStyle = "rgba(244,247,242,0.78)";
  ctx.font = "600 36px Nunito, system-ui, sans-serif";
  wrapText(ctx, line || "Hear it. Type it. Keep it.", 512, 1080, 720, 48);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = String(text).split(/\s+/);
  let line = "";
  let yy = y;
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + " " + words[i] : words[i];
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = words[i];
      yy += lineH;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
}

/** Paint a readable fallback UI so glass is never black if capture fails. */
function paintFallbackUi(canvas, label) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = "#f4f6f8";
  ctx.fillRect(0, 0, w, h);
  /* status bar */
  ctx.fillStyle = "#0f172a";
  ctx.font = `600 ${Math.round(w * 0.045)}px Nunito, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText("9:41", w * 0.08, h * 0.05);
  /* streak / xp pills */
  roundRect(ctx, w * 0.08, h * 0.08, w * 0.28, h * 0.055, 20, "#fff");
  roundRect(ctx, w * 0.64, h * 0.08, w * 0.28, h * 0.055, 20, "#fff");
  ctx.fillStyle = "#0f172a";
  ctx.font = `700 ${Math.round(w * 0.035)}px Nunito, system-ui, sans-serif`;
  ctx.fillText("STREAK 12", w * 0.12, h * 0.115);
  ctx.textAlign = "center";
  ctx.fillText("80 XP", w * 0.78, h * 0.115);
  /* title */
  ctx.textAlign = "left";
  ctx.font = `800 ${Math.round(w * 0.07)}px Nunito, system-ui, sans-serif`;
  ctx.fillStyle = "#0f172a";
  ctx.fillText("Today's word", w * 0.08, h * 0.22);
  ctx.font = `800 ${Math.round(w * 0.09)}px Nunito, system-ui, sans-serif`;
  ctx.fillText("I love you", w * 0.08, h * 0.32);
  /* clip cards */
  roundRect(ctx, w * 0.08, h * 0.42, w * 0.38, h * 0.22, 24, "#ffe8d6");
  roundRect(ctx, w * 0.54, h * 0.42, w * 0.38, h * 0.22, 24, "#ffd6e7");
  ctx.fillStyle = "#0f172a";
  ctx.font = `700 ${Math.round(w * 0.04)}px Nunito, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("Clip A", w * 0.27, h * 0.55);
  ctx.fillText("Clip B", w * 0.73, h * 0.55);
  ctx.fillStyle = "rgba(15,23,42,0.45)";
  ctx.font = `600 ${Math.round(w * 0.028)}px Nunito, system-ui, sans-serif`;
  ctx.fillText(label || "LingoTrace", w * 0.5, h * 0.92);
}

function roundRect(ctx, x, y, w, h, r, fill) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Sample canvas — true if real UI ink exists in MID glass (not status-bar-only / white wash). */
function canvasHasContent(canvas) {
  try {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const { width: w, height: h } = canvas;
    const step = 24;
    let lit = 0;
    let ink = 0;
    let midInk = 0;
    let midN = 0;
    let n = 0;
    let sum = 0;
    let sum2 = 0;
    const y0 = Math.floor(h * 0.12);
    const y1 = Math.floor(h * 0.88);
    for (let y = step; y < h - step; y += step) {
      for (let x = step; x < w - step; x += step) {
        const d = ctx.getImageData(x, y, 1, 1).data;
        const s = d[0] + d[1] + d[2];
        const sat = Math.max(d[0], d[1], d[2]) - Math.min(d[0], d[1], d[2]);
        const isInk = s < 520 || sat > 28;
        sum += s;
        sum2 += s * s;
        if (s > 40) lit++;
        if (isInk) ink++;
        n++;
        if (y >= y0 && y <= y1) {
          midN++;
          if (isInk) midInk++;
        }
      }
    }
    if (n <= 0 || midN <= 0) return false;
    const mean = sum / n;
    const variance = sum2 / n - mean * mean;
    /* Reject near-uniform white/light wash */
    if (mean > 660 && variance < 1200) return false;
    /* Status-bar-only captures look white on tilt — require mid-glass ink */
    if (midInk / midN < 0.06) return false;
    return lit / n > 0.08 && ink / n > 0.05;
  } catch (_) {
    return false;
  }
}

/**
 * CSS matrix3d that maps a w×h element onto an arbitrary screen-space quad.
 * corners: [TL, TR, BR, BL] in the same coordinate space as the element's offsetParent
 * (we use fixed positioning + document viewport, so corners are client coords).
 * Algorithm: Frank Lin / CSS matrix3d for 4-point transform.
 */
function matrix3dForQuad(w, h, corners) {
  const [tl, tr, br, bl] = corners;
  function adj(m) {
    /* adjugate of 3x3 */
    return [
      m[4] * m[8] - m[5] * m[7],
      m[2] * m[7] - m[1] * m[8],
      m[1] * m[5] - m[2] * m[4],
      m[5] * m[6] - m[3] * m[8],
      m[0] * m[8] - m[2] * m[6],
      m[2] * m[3] - m[0] * m[5],
      m[3] * m[7] - m[4] * m[6],
      m[1] * m[6] - m[0] * m[7],
      m[0] * m[4] - m[1] * m[3],
    ];
  }
  function mul(a, b) {
    const r = new Array(9);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        r[i * 3 + j] =
          a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
      }
    }
    return r;
  }
  function basis(p1, p2, p3, p4) {
    const m = [p1.x, p2.x, p3.x, p1.y, p2.y, p3.y, 1, 1, 1];
    const a = adj(m);
    const v = [p4.x, p4.y, 1];
    const s = [
      a[0] * v[0] + a[1] * v[1] + a[2] * v[2],
      a[3] * v[0] + a[4] * v[1] + a[5] * v[2],
      a[6] * v[0] + a[7] * v[1] + a[8] * v[2],
    ];
    return [m[0] * s[0], m[1] * s[1], m[2] * s[2], m[3] * s[0], m[4] * s[1], m[5] * s[2], m[6] * s[0], m[7] * s[1], m[8] * s[2]];
  }
  const src = basis({ x: 0, y: 0 }, { x: w, y: 0 }, { x: 0, y: h }, { x: w, y: h });
  const dst = basis(tl, tr, bl, br);
  const t = mul(dst, adj(src));
  /* normalize */
  const n = t[8] || 1;
  for (let i = 0; i < 9; i++) t[i] /= n;
  /* CSS matrix3d column-major 4x4 from 3x3 homography */
  return `matrix3d(${t[0]},${t[3]},0,${t[6]},${t[1]},${t[4]},0,${t[7]},0,0,1,0,${t[2]},${t[5]},0,${t[8]})`;
}

function applyStudioUv(tex) {
  const uv = CHASSIS.uv || {};
  tex.flipY = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.center.set(0, 0);
  tex.rotation = 0;
  if (uv.repeat) tex.repeat.set(uv.repeat[0], uv.repeat[1]);
  else tex.repeat.set(1, 1);
  if (uv.offset) tex.offset.set(uv.offset[0], uv.offset[1]);
  else tex.offset.set(0, 0);
  if (uv.clamp) {
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
  }
  tex.needsUpdate = true;
}

export function createDeviceMesh(opts = {}) {
  const mount = opts.mount;
  const creditEl = opts.creditEl;
  const screenEl = opts.screenEl || document.querySelector(".device-screen");
  if (!mount) throw new Error("device-mesh: mount required");

  const glued = !!screenEl;

  const placeholder = document.createElement("div");
  placeholder.className = "device-placeholder";
  placeholder.setAttribute("aria-hidden", "true");
  placeholder.innerHTML =
    '<div class="device-placeholder-body"><div class="device-placeholder-glass"></div></div>';
  mount.appendChild(placeholder);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.className = "device-webgl";
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.style.pointerEvents = "none";
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 40);
  /* Moderate framing — matched to CSS unit after load */
  camera.position.set(0, 0.12, 7.6);
  camera.lookAt(0, 0.16, 0);

  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(2.4, 3.2, 4.2);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xb8d4ff, 0.55);
  fill.position.set(-3.2, 0.6, 2.2);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.7);
  rim.position.set(-1.2, -2.4, -3.5);
  scene.add(rim);
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  scene.add(new THREE.HemisphereLight(0xe8eef8, 0x2a2e35, 0.55));

  const root = new THREE.Group();
  scene.add(root);

  const loader = new GLTFLoader();
  try {
    loader.setMeshoptDecoder(MeshoptDecoder);
  } catch (_) {}

  let phone = null;
  let screenMesh = null;
  let screenMat = null;
  let uiCanvas = null;
  let uiTex = null;
  let captureHost = null;
  let captureClone = null; /* permanent phone clone — never the live overlay */
  let rotX = 0;
  let rotY = 0;
  let running = true;
  let backLine = opts.backLine || "Hear it. Type it. Keep it.";
  let backTex = makeBackTexture(backLine);
  let facingCamera = true;
  let overlayMode = false;
  let loadMs = 0;
  let captureBusy = false;
  let captureQueued = false;
  let lastCapture = 0;
  let lastGoodCapture = 0;
  let mutObs = null;
  let syncTimer = 0;
  let draggingHint = false;

  function resize() {
    const w = Math.max(1, mount.clientWidth);
    const h = Math.max(1, mount.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function fitPhone(obj) {
    /* MUST reset scale first — setFromObject includes current scale.
       Calling fitPhone twice otherwise collapses scale to ~1 (shrink bug). */
    obj.scale.setScalar(1);
    obj.position.set(0, 0, 0);
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    obj.position.sub(center);
    const maxDim = Math.max(size.x, size.y, size.z);
    const target = 2.18; /* moderate — center-third width, ~80% stage height */
    obj.scale.setScalar(target / (maxDim || 1));
    obj.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(obj);
    const c2 = box2.getCenter(new THREE.Vector3());
    obj.position.sub(c2);
    /* Bias upward so phone sits high in the stage (not mid/low) */
    obj.position.y += 0.18;
  }

  /** Dolly camera so projected screen height matches CSS #device-unit (no grow jump). */
  function matchCssUnitFraming() {
    const unit = document.getElementById("device-unit");
    if (!unit || !screenMesh || !phone) return;
    const urect = unit.getBoundingClientRect();
    if (urect.height < 80) return;
    /* Prefer CSS-unit height when shell-fit applied; else ~80% stage (moderate). */
    const stageH = Math.max(420, window.innerHeight - 160);
    const moderate = stageH * 0.90;
    const want = Math.min(urect.height * 0.98, moderate);
    let zLo = 5.2;
    let zHi = 11.5;
    for (let i = 0; i < 14; i++) {
      const z = (zLo + zHi) / 2;
      camera.position.z = z;
      camera.updateMatrixWorld(true);
      root.updateWorldMatrix(true, true);
      const proj = projectScreenCorners();
      if (!proj) break;
      /* larger z → smaller on-screen phone */
      if (proj.aabb.height > want) zLo = z;
      else zHi = z;
    }
    camera.position.z = (zLo + zHi) / 2;
    camera.lookAt(0, Math.max(0.08, phone.position.y * 0.35), 0);
    camera.updateMatrixWorld(true);
    console.info("[palace] framed z=", camera.position.z.toFixed(2), "wantH=", want.toFixed(0));
  }

  function applyBackContent(rootObj) {
    rootObj.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (!m) return;
        const n = (m.name || "").toLowerCase();
        if (n.includes("backpanel") || n.includes("logo_face") || n === "back glass") {
          const clone = m.clone();
          clone.map = backTex;
          clone.emissiveMap = backTex;
          clone.emissive = new THREE.Color(0xffffff);
          clone.emissiveIntensity = 0.55;
          clone.color = new THREE.Color(0x111318);
          clone.roughness = 0.55;
          clone.metalness = 0.15;
          clone.needsUpdate = true;
          if (Array.isArray(o.material)) {
            o.material = mats.map((x) => (x === m ? clone : x));
          } else o.material = clone;
        }
      });
    });
  }

  function findScreenMesh(rootObj, screenName) {
    let found = null;
    rootObj.traverse((o) => {
      if (!o.isMesh || found) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m) continue;
        const n = (m.name || "").toLowerCase();
        if (m.name === screenName || n === "screen.001" || n.includes("screen") || n === "oled") {
          found = o;
          return;
        }
      }
    });
    return found;
  }

  function getScreenOutwardNormal(mesh) {
    mesh.updateWorldMatrix(true, false);
    const geom = mesh.geometry;
    if (!geom) return new THREE.Vector3(0, 0, 1);
    if (!geom.boundingBox) geom.computeBoundingBox();
    if (geom.attributes && geom.attributes.normal) {
      const nAttr = geom.attributes.normal;
      const acc = new THREE.Vector3();
      const tmp = new THREE.Vector3();
      const step = Math.max(1, Math.floor(nAttr.count / 200));
      let c = 0;
      for (let i = 0; i < nAttr.count; i += step) {
        tmp.fromBufferAttribute(nAttr, i);
        acc.add(tmp);
        c++;
      }
      if (c) acc.multiplyScalar(1 / c).normalize();
      acc.transformDirection(mesh.matrixWorld).normalize();
      return acc;
    }
    const bb = geom.boundingBox;
    const sz = new THREE.Vector3();
    bb.getSize(sz);
    let axis = new THREE.Vector3(0, 0, 1);
    if (sz.x <= sz.y && sz.x <= sz.z) axis.set(1, 0, 0);
    else if (sz.y <= sz.x && sz.y <= sz.z) axis.set(0, 1, 0);
    axis.transformDirection(mesh.matrixWorld).normalize();
    return axis;
  }

  function ensureCaptureHost() {
    if (captureHost) return captureHost;
    captureHost = document.createElement("div");
    captureHost.className = "device-screen-capture-host";
    captureHost.setAttribute("aria-hidden", "true");
    document.body.appendChild(captureHost);
    return captureHost;
  }

  /** Clone full glass contents (lesson UI + screensaver) into capture host. */
  function syncCaptureClone() {
    if (!screenEl) return null;
    const host = ensureCaptureHost();
    host.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "device-screen-capture-clone is-texture-screen";
    wrap.style.cssText = `width:${PX_W}px;height:${PX_H}px;position:relative;overflow:hidden;background:#050608;border-radius:44px;`;
    Array.from(screenEl.children).forEach((child) => {
      const clone = child.cloneNode(true);
      clone.style.width = PX_W + "px";
      clone.style.height = PX_H + "px";
      clone.style.margin = "0";
      clone.style.transform = "none";
      if (clone.classList && clone.classList.contains("phone-screensaver")) {
        const live = !child.hidden && child.getAttribute("aria-hidden") !== "true";
        if (live) {
          clone.hidden = false;
          clone.style.display = "flex";
          clone.style.position = "absolute";
          clone.style.inset = "0";
          clone.style.zIndex = "5";
          clone.removeAttribute("aria-hidden");
        } else {
          clone.style.display = "none";
        }
      } else {
        clone.style.position = "relative";
      }
      clone.querySelectorAll("[aria-hidden]").forEach((el) => el.removeAttribute("aria-hidden"));
      wrap.appendChild(clone);
    });
    if (!wrap.children.length) {
      const livePhone = screenEl.querySelector(".phone") || screenEl;
      const clone = livePhone.cloneNode(true);
      clone.style.cssText = `width:${PX_W}px;height:${PX_H}px;margin:0;transform:none;position:relative;`;
      wrap.appendChild(clone);
    }
    host.appendChild(wrap);
    captureClone = wrap;
    return wrap;
  }

  function scheduleCloneSync() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      syncTimer = 0;
      syncCaptureClone();
      captureUiToTexture(false);
    }, 120);
  }

  async function captureUiToTexture(force) {
    if (!glued || !uiTex || !uiCanvas) return;
    if (captureBusy) {
      captureQueued = true;
      return;
    }
    const now = performance.now();
    const minGap = draggingHint ? DRAG_CAPTURE_MS : CAPTURE_MIN_MS;
    if (!force && now - lastCapture < minGap) return;
    captureBusy = true;
    lastCapture = now;
    try {
      if (!captureClone || !captureClone.isConnected) syncCaptureClone();
      const target = captureClone || syncCaptureClone();
      if (!target) {
        paintFallbackUi(uiCanvas, "LingoTrace");
        uiTex.needsUpdate = true;
        return;
      }
      void target.offsetWidth;
      const shot = await toCanvas(target, {
        width: PX_W,
        height: PX_H,
        canvasWidth: PX_W * 2,
        canvasHeight: PX_H * 2,
        pixelRatio: 1,
        cacheBust: false,
        skipFonts: true,
        backgroundColor: "#f4f6f8",
        style: {
          transform: "none",
          inset: "auto",
          left: "0",
          top: "0",
          position: "relative",
          width: PX_W + "px",
          height: PX_H + "px",
          margin: "0",
          opacity: "1",
        },
      });
      const ctx = uiCanvas.getContext("2d");
      ctx.fillStyle = "#f4f6f8";
      ctx.fillRect(0, 0, uiCanvas.width, uiCanvas.height);
      ctx.drawImage(shot, 0, 0, uiCanvas.width, uiCanvas.height);
      if (!canvasHasContent(uiCanvas)) {
        console.warn("[palace] capture looked empty — keeping fallback/last good");
        if (!lastGoodCapture) {
          paintFallbackUi(uiCanvas, "LingoTrace");
          lastGoodCapture = performance.now();
        } else {
          /* restore last good by repainting fallback rather than leaving white */
          paintFallbackUi(uiCanvas, "LingoTrace");
        }
      } else {
        lastGoodCapture = performance.now();
      }
      uiTex.needsUpdate = true;
      applyStudioUv(uiTex);
      if (screenMat) {
        screenMat.emissiveMap = uiTex;
        if (screenMat.emissive) screenMat.emissive.set(0xffffff);
        screenMat.needsUpdate = true;
      }
    } catch (err) {
      console.warn("[palace] UI texture capture failed", err && err.message ? err.message : err);
      if (!lastGoodCapture) {
        paintFallbackUi(uiCanvas, "LingoTrace");
        uiTex.needsUpdate = true;
      }
    } finally {
      captureBusy = false;
      if (captureQueued) {
        captureQueued = false;
        captureUiToTexture(true);
      }
    }
  }

  /**
   * Project the 4 corners of the screen mesh's dominant face into CSS client pixels.
   * Returns { tl, tr, br, bl, aabb } or null.
   */
  function projectScreenCorners() {
    if (!screenMesh) return null;
    const canvas = renderer.domElement;
    const mrect = canvas.getBoundingClientRect();
    if (mrect.width < 8 || mrect.height < 8) return null;

    screenMesh.updateWorldMatrix(true, false);
    const geom = screenMesh.geometry;
    if (!geom) return null;
    if (!geom.boundingBox) geom.computeBoundingBox();
    const bb = geom.boundingBox;
    const sz = new THREE.Vector3();
    bb.getSize(sz);
    const c = new THREE.Vector3();
    bb.getCenter(c);

    /* Dominant face: thinnest axis is the screen normal */
    let u = new THREE.Vector3(1, 0, 0);
    let v = new THREE.Vector3(0, 1, 0);
    let faceW;
    let faceH;
    if (sz.x <= sz.y && sz.x <= sz.z) {
      /* thin X — face in YZ; portrait: Y height, Z width */
      faceW = sz.z;
      faceH = sz.y;
      u.set(0, 0, 1);
      v.set(0, 1, 0);
    } else if (sz.y <= sz.x && sz.y <= sz.z) {
      faceW = sz.x;
      faceH = sz.z;
      u.set(1, 0, 0);
      v.set(0, 0, 1);
    } else {
      faceW = sz.x;
      faceH = sz.y;
      u.set(1, 0, 0);
      v.set(0, 1, 0);
    }

    /* Local corners: TL TR BR BL in UI sense (V up in geom → top is +v) */
    const locals = [
      c.clone().addScaledVector(u, -faceW / 2).addScaledVector(v, faceH / 2), /* TL */
      c.clone().addScaledVector(u, faceW / 2).addScaledVector(v, faceH / 2), /* TR */
      c.clone().addScaledVector(u, faceW / 2).addScaledVector(v, -faceH / 2), /* BR */
      c.clone().addScaledVector(u, -faceW / 2).addScaledVector(v, -faceH / 2), /* BL */
    ];

    const pts = [];
    const p = new THREE.Vector3();
    for (let i = 0; i < 4; i++) {
      p.copy(locals[i]).applyMatrix4(screenMesh.matrixWorld).project(camera);
      if (Math.abs(p.z) > 1.2) return null;
      pts.push({
        x: (p.x * 0.5 + 0.5) * mrect.width + mrect.left,
        y: (-p.y * 0.5 + 0.5) * mrect.height + mrect.top,
      });
    }

    /* Orient so index 0 is top-left in screen space (min x+y) */
    let best = 0;
    let bestScore = Infinity;
    for (let i = 0; i < 4; i++) {
      const score = pts[i].x + pts[i].y;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    /* Walk clockwise or counterclockwise from TL */
    const ordered = [pts[best], pts[(best + 1) % 4], pts[(best + 2) % 4], pts[(best + 3) % 4]];
    /* Ensure ordered[1] is more to the right of ordered[0] than ordered[3] */
    const to1 = { x: ordered[1].x - ordered[0].x, y: ordered[1].y - ordered[0].y };
    const to3 = { x: ordered[3].x - ordered[0].x, y: ordered[3].y - ordered[0].y };
    /* Cross product z: if to1 x to3 is negative, we're winding the wrong way for TL-TR-BR-BL */
    if (to1.x * to3.y - to1.y * to3.x > 0) {
      /* swap to go the other way: TL, prev, opposite, next */
      const rev = [ordered[0], ordered[3], ordered[2], ordered[1]];
      ordered[1] = rev[1];
      ordered[2] = rev[2];
      ordered[3] = rev[3];
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const q of ordered) {
      if (q.x < minX) minX = q.x;
      if (q.y < minY) minY = q.y;
      if (q.x > maxX) maxX = q.x;
      if (q.y > maxY) maxY = q.y;
    }
    if (!isFinite(minX) || maxX - minX < 8 || maxY - minY < 8) return null;

    return {
      tl: ordered[0],
      tr: ordered[1],
      br: ordered[2],
      bl: ordered[3],
      aabb: { left: minX, top: minY, width: maxX - minX, height: maxY - minY },
    };
  }

  function showOverlay() {
    if (!screenEl) return;
    facingCamera = true;
    const proj = projectScreenCorners();
    if (!proj) {
      /* Keep trying — never leave a permanent park if we intend front */
      console.warn("[palace] showOverlay: no projection yet");
      return;
    }

    /* Exact projected AABB of screen mesh — never an empirical % of the mount. */
    const { aabb } = proj;
    /* Slight inset so HTML stays inside glass bezel, not covering metal rim */
    const inset = 0.028; /* keep HTML inside glass, leave metal rim visible */
    const left = aabb.left + aabb.width * inset;
    const top = aabb.top + aabb.height * inset;
    const width = aabb.width * (1 - inset * 2);
    const height = aabb.height * (1 - inset * 2);

    if (screenEl.parentElement !== document.body) {
      document.body.appendChild(screenEl);
    }
    screenEl.classList.add("is-overlay-screen", "is-texture-screen");
    screenEl.classList.remove("is-css3d-screen");

    /* Dead-front only: axis-aligned overlay inset in glass. Orbit = UV only. */
    screenEl.style.position = "fixed";
    screenEl.style.setProperty("left", left + "px", "important");
    screenEl.style.setProperty("top", top + "px", "important");
    screenEl.style.setProperty("width", width + "px", "important");
    screenEl.style.setProperty("height", height + "px", "important");
    screenEl.style.setProperty("right", "auto", "important");
    screenEl.style.setProperty("bottom", "auto", "important");
    screenEl.style.setProperty("transform", "none", "important");
    document.documentElement.style.setProperty("--overlay-left", left + "px");
    document.documentElement.style.setProperty("--overlay-top", top + "px");
    document.documentElement.style.setProperty("--overlay-width", width + "px");
    document.documentElement.style.setProperty("--overlay-height", height + "px");

    screenEl.style.zIndex = "6";
    screenEl.style.pointerEvents = "auto";
    screenEl.style.opacity = "1";
    screenEl.style.margin = "0";
    screenEl.setAttribute("aria-hidden", "false");
    overlayMode = true;
  }

  function hideOverlayKeepTexture() {
    if (!screenEl) return;
    /* Park live screen off-viewport but do NOT put it in capture host —
       capture uses its own clone. */
    if (screenEl.parentElement !== document.body) {
      document.body.appendChild(screenEl);
    }
    screenEl.classList.add("is-texture-screen");
    screenEl.classList.remove("is-overlay-screen", "is-css3d-screen");
    screenEl.style.cssText = "";
    screenEl.style.position = "fixed";
    screenEl.style.left = "-12000px";
    screenEl.style.top = "0";
    screenEl.style.width = PX_W + "px";
    screenEl.style.height = PX_H + "px";
    screenEl.style.opacity = "0";
    screenEl.style.pointerEvents = "none";
    screenEl.style.transform = "none";
    screenEl.setAttribute("aria-hidden", "true");
    overlayMode = false;
  }

  /** Build 0–1 UVs on the dominant face so CanvasTexture maps correctly. */
  function ensurePlanarUVs(mesh) {
    const geom = mesh.geometry;
    if (!geom || !geom.attributes.position) return;
    if (!geom.boundingBox) geom.computeBoundingBox();
    const bb = geom.boundingBox;
    const size = new THREE.Vector3();
    bb.getSize(size);
    const min = bb.min;
    const axes = [
      { axis: "x", s: size.x },
      { axis: "y", s: size.y },
      { axis: "z", s: size.z },
    ].sort((a, b) => b.s - a.s);
    /* Portrait glass: V = longest (height), U = second (width) */
    const vAxis = axes[0].axis;
    const uAxis = axes[1].axis;
    const vSize = Math.max(axes[0].s, 1e-6);
    const uSize = Math.max(axes[1].s, 1e-6);
    const pos = geom.attributes.position;
    const uvs = new Float32Array(pos.count * 2);
    const get = { x: (i) => pos.getX(i), y: (i) => pos.getY(i), z: (i) => pos.getZ(i) };
    for (let i = 0; i < pos.count; i++) {
      const u = (get[uAxis](i) - min[uAxis]) / uSize;
      const v = (get[vAxis](i) - min[vAxis]) / vSize;
      /* Flip U — screen.001 local Z runs opposite to UI left→right when facing camera */
      uvs[i * 2] = 1 - u;
      uvs[i * 2 + 1] = 1 - v;
    }
    geom.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geom.attributes.uv.needsUpdate = true;
  }

  /** Rear camera bump / lenses — opaque WHITE (never transparent glass void). */
  function forceCameraBumpWhite(rootObj, bumpMatName) {
    const want = (bumpMatName || "Material.007").toLowerCase();
    rootObj.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const meshN = (o.name || "").toLowerCase();
      mats.forEach((m, idx) => {
        if (!m) return;
        const n = (m.name || "").toLowerCase();
        const isBump =
          n === want ||
          n.includes("material.007") ||
          n.includes("material007") ||
          n.includes("camera") ||
          n.includes("lens") ||
          n.includes("bump") ||
          meshN.includes("material007");
        if (!isBump) return;
        const clone = m.clone();
        if (clone.color) clone.color.setHex(0xffffff);
        if (clone.emissive) {
          clone.emissive.setHex(0xffffff);
          clone.emissiveIntensity = 0.12;
        }
        clone.transparent = false;
        clone.opacity = 1;
        clone.depthWrite = true;
        if ("metalness" in clone) clone.metalness = 0.18;
        if ("roughness" in clone) clone.roughness = 0.32;
        if (clone.map) clone.map = null; /* solid white plate, no see-through tex */
        if (clone.alphaMap) clone.alphaMap = null;
        clone.needsUpdate = true;
        if (Array.isArray(o.material)) o.material[idx] = clone;
        else o.material = clone;
        console.info("[palace] camera bump → opaque white", o.name, m.name);
      });
    });
  }

  function tintChassisMetal(rootObj, hex) {
    if (!rootObj || !hex) return;
    let color;
    try {
      color = new THREE.Color(hex);
    } catch (_) {
      return;
    }
    rootObj.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const meshN = (o.name || "").toLowerCase();
      mats.forEach((m, idx) => {
        if (!m) return;
        const n = (m.name || "").toLowerCase();
        /* Metal frame only — not screen, not camera bump, not back glass UI */
        const isMetal =
          meshN.includes("black002") ||
          n.includes("palette material001") ||
          n.includes("palettematerial001") ||
          (n.includes("metal") && !n.includes("screen"));
        if (!isMetal) return;
        const clone = m.clone();
        if (clone.color) clone.color.copy(color);
        if ("metalness" in clone) clone.metalness = Math.max(clone.metalness || 0, 0.65);
        if ("roughness" in clone) clone.roughness = Math.min(clone.roughness ?? 0.4, 0.42);
        clone.transparent = false;
        clone.opacity = 1;
        clone.needsUpdate = true;
        if (Array.isArray(o.material)) o.material[idx] = clone;
        else o.material = clone;
      });
    });
  }

  function glueScreenUi(mesh) {
    if (!glued || !screenEl) return;
    screenMesh = mesh;

    uiCanvas = document.createElement("canvas");
    uiCanvas.width = PX_W * 2;
    uiCanvas.height = PX_H * 2;
    paintFallbackUi(uiCanvas, "LingoTrace");

    uiTex = new THREE.CanvasTexture(uiCanvas);
    uiTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy?.() || 4);
    applyStudioUv(uiTex);

    // Studio style: emissive screenshot, base black, no specular wash
    screenMat = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: new THREE.Color(0xffffff),
      emissiveMap: uiTex,
      emissiveIntensity: 1,
      map: null,
      metalness: 0,
      roughness: 1,
      envMapIntensity: 0,
      toneMapped: false,
      side: THREE.DoubleSide,
      depthWrite: true,
      transparent: false,
    });

    /* CRITICAL: Cube010_black002_0 is the metal chassis (thickness + side buttons).
       Never hide it. Only UV-map screen.001. glass002 is the BACK panel — keep visible. */
    let phoneRoot = mesh;
    while (phoneRoot.parent && phoneRoot.parent !== root && phoneRoot.parent.type !== "Scene") {
      phoneRoot = phoneRoot.parent;
    }
    const meshReport = [];
    phoneRoot.traverse((o) => {
      if (!o.isMesh) return;
      o.visible = true; /* restore any prior hide */
      const n = (o.name || "").toLowerCase();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      meshReport.push(o.name + " mats=" + mats.map((m) => m?.name).join("|"));
      /* Soften front-facing black bezel so screen texture reads cleanly, but KEEP geometry */
      if (n.includes("black002")) {
        mats.forEach((m) => {
          if (!m) return;
          /* Keep original GLTF palette; just ensure metal reads under lights */
          if ("metalness" in m && m.metalness < 0.4) m.metalness = 0.72;
          if ("roughness" in m && m.roughness > 0.7) m.roughness = 0.38;
          if (m.color) {
            /* Avoid near-black void that reads as missing chassis */
            const c = m.color;
            if (c.r + c.g + c.b < 0.12) c.setHex(0xb85a28);
          }
          m.needsUpdate = true;
        });
        console.info("[palace] chassis visible", o.name);
      }
      if (n.includes("glass002")) {
        /* Back glass stays visible for camera bump / rear; do not replace with screen UV */
        mats.forEach((m) => {
          if (!m) return;
          if ("transparent" in m) {
            m.transparent = false;
            m.opacity = 1;
          }
          m.depthWrite = true;
          m.needsUpdate = true;
        });
        console.info("[palace] back glass visible", o.name);
      }
    });
    console.info("[palace] meshes", meshReport.join(" · "));
    forceCameraBumpWhite(phoneRoot, CHASSIS.cameraBumpMat);
    /* Ensure back glass never renders as transparent void over bump */
    phoneRoot.traverse((o) => {
      if (!o.isMesh) return;
      if (!(o.name || "").toLowerCase().includes("glass002")) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (!m) return;
        m.transparent = false;
        m.opacity = 1;
        m.depthWrite = true;
        m.needsUpdate = true;
      });
    });

    // Keep native GLB UVs — studio maps via texture.repeat/offset only
    mesh.material = screenMat;
    mesh.renderOrder = 2;
    mesh.visible = true;
    screenMesh = mesh;
    console.info("[palace] UV glue mesh", mesh.name, "studio affine", JSON.stringify(CHASSIS.uv));

    /* Keep live screen in CSS layout for first capture — avoid white glass.
       Do NOT add has-glued-screen yet — that hides CSS copper shell and would flash. */
    syncCaptureClone();

    if (typeof MutationObserver !== "undefined") {
      mutObs = new MutationObserver(() => scheduleCloneSync());
      mutObs.observe(screenEl, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
      });
    }
  }

  /** Wait until CanvasTexture has real UI pixels (not blank white). */
  async function waitForGoodCapture(maxMs = 4500) {
    const t0 = performance.now();
    /* First: capture while .phone still visible in CSS shell */
    syncCaptureClone();
    await captureUiToTexture(true);
    while (!lastGoodCapture && performance.now() - t0 < maxMs) {
      syncCaptureClone();
      await captureUiToTexture(true);
      await new Promise((r) => setTimeout(r, 120));
    }
    if (!lastGoodCapture) {
      paintFallbackUi(uiCanvas, "LingoTrace");
      applyStudioUv(uiTex);
      if (screenMat) {
        screenMat.emissiveMap = uiTex;
        screenMat.needsUpdate = true;
      }
      lastGoodCapture = performance.now();
      console.warn("[palace] capture fallback painted — UI may be sparse");
    }
  }

  function updateFacing() {
    /* Until boot reveals, keep HTML inside CSS copper shell — no overlay flash */
    if (document.body.classList.contains("is-gltf-pending")) {
      facingCamera = true;
      return;
    }
    if (!document.body.classList.contains("has-gltf-ready")) {
      return;
    }
    const yRad = THREE.MathUtils.degToRad(rotY);
    const xRad = THREE.MathUtils.degToRad(rotX);
    const faceDot = Math.cos(yRad) * Math.cos(xRad);
    const deadFront =
      !draggingHint &&
      Math.abs(rotX) < 14 &&
      Math.abs(rotY) < 14 &&
      faceDot > FRONT_DOT;
    facingCamera = deadFront;

    if (!screenEl) return;
    if (deadFront) {
      showOverlay();
    } else {
      if (overlayMode) {
        syncCaptureClone();
        captureUiToTexture(true);
      }
      hideOverlayKeepTexture();
    }
  }

  async function loadChassis() {
    const t0 = performance.now();
    CHASSIS = CHASSIS_REGISTRY[resolveChassisId()] || CHASSIS_REGISTRY["17pm"];
    try {
      if (MeshoptDecoder && MeshoptDecoder.ready) await MeshoptDecoder.ready;
    } catch (_) {}
    let gltf;
    try {
      gltf = await loader.loadAsync(CHASSIS.url);
    } catch (err) {
      console.warn("[palace] meshopt GLB failed, falling back", err);
      gltf = await loader.loadAsync(CHASSIS.fallbackUrl);
    }
    loadMs = Math.round(performance.now() - t0);

    if (phone) {
      root.remove(phone);
      phone = null;
    }

    phone = gltf.scene.clone(true);
    phone.rotation.set(CHASSIS.rot[0], CHASSIS.rot[1], CHASSIS.rot[2]);
    fitPhone(phone);
    applyBackContent(phone);
    root.add(phone);

    /* phone-mockup-studio base rot for 17pm: [0, π/2, 0] — screen toward +Z camera */
    phone.rotation.set(CHASSIS.rot[0], CHASSIS.rot[1], CHASSIS.rot[2]);
    fitPhone(phone);
    console.info("[palace] studio orient yaw", phone.rotation.y.toFixed(3));

    let mesh = null;
    phone.traverse((o) => {
      if (!o.isMesh || mesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (mats.some((m) => m && m.name === CHASSIS.screenMat)) mesh = o;
    });
    if (!mesh) mesh = findScreenMesh(phone, CHASSIS.screenMat);
    if (mesh) glueScreenUi(mesh);
    else console.warn("[palace] screen mesh not found — UI may not glue");

    /* Size-lock to CSS unit BEFORE reveal so first GLB frame matches pic1 */
    matchCssUnitFraming();
    await waitForGoodCapture(5000);
    matchCssUnitFraming();
    /* Keep HTML in CSS bezel until boot flips has-gltf-ready (avoids double-phone). */
    facingCamera = true;

    placeholder.classList.add("is-gone");
    setTimeout(() => placeholder.remove(), 200);

    if (creditEl) {
      creditEl.textContent =
        CHASSIS.credit + " · loaded " + loadMs + "ms · size-locked UV glue";
    }
    return CHASSIS;
  }

  function setRotation(xDeg, yDeg) {
    rotX = xDeg || 0;
    rotY = yDeg || 0;
    root.rotation.x = THREE.MathUtils.degToRad(rotX);
    root.rotation.y = THREE.MathUtils.degToRad(rotY);
    const orbiting = Math.abs(rotX) > 10 || Math.abs(rotY) > 10;
    draggingHint = orbiting;
    if (orbiting) {
      /* Always stamp lesson fallback onto glass BEFORE hide — html-to-image
         often yields status-bar-only white on remote; never show blank glass. */
      if (uiCanvas && uiTex) {
        paintFallbackUi(uiCanvas, "LingoTrace");
        applyStudioUv(uiTex);
        if (screenMat) {
          screenMat.emissiveMap = uiTex;
          if (screenMat.emissive) screenMat.emissive.set(0xffffff);
          screenMat.emissiveIntensity = 1.15;
          screenMat.needsUpdate = true;
        }
        uiTex.needsUpdate = true;
        lastGoodCapture = performance.now();
      }
      if (overlayMode) {
        syncCaptureClone();
        captureUiToTexture(true); /* async upgrade if richer capture lands */
      }
      hideOverlayKeepTexture();
      facingCamera = false;
    } else if (document.body.classList.contains("has-gltf-ready")) {
      /* Returned to front (incl. damp end) — restore HTML hit layer */
      facingCamera = true;
      showOverlay();
    }
  }

  function setBackLine(line) {
    backLine = line || backLine;
    backTex.dispose();
    backTex = makeBackTexture(backLine);
    if (phone) applyBackContent(phone);
  }

  let finishHex = "#b85a28";
  function setFinish(idOrHex) {
    const map = {
      obsidian: "#1a1c20",
      sterling: "#c5cad3",
      champagne: "#c9a86a",
      cobalt: "#1e3a6e",
      crimson: "#8b1e2d",
      glacier: "#7eb8d4",
      amethyst: "#5b3d8a",
      graphite: "#4a4d52",
      pearl: "#e8e4dc",
      sand: "#b5a894",
      duolingo: "#58cc02",
      "violet-night": "#7c5cff",
      "space-gold": "#c9a227",
      "space-blue": "#2f6fed",
      "product-red": "#e11d48",
      "sierra-blue": "#69b4e8",
      purple: "#9b5de5",
      midnight: "#2c2c2e",
      starlight: "#f5f0e8",
      "natural-titanium": "#a89f91",
    };
    const hex =
      (idOrHex && map[idOrHex]) ||
      (typeof idOrHex === "string" && idOrHex.startsWith("#") ? idOrHex : null) ||
      finishHex;
    finishHex = hex;
    if (phone) {
      tintChassisMetal(phone, hex);
      forceCameraBumpWhite(phone, CHASSIS.cameraBumpMat);
    }
  }
  function setModelUiId(uiId) {
    /* Map shell UI model ids → chassis registry. Android/hole keeps island GLB
       until an android GLB ships — topChrome still comes from CSS model dataset. */
    const map = {
      island: "17pm",
      slim: "17pm",
      notch: "15pm",
      curve: "15pm",
      hole: "17pm",
      dual: "17pm",
      clean: "17pm",
      flat: "17pm",
      "17pm": "17pm",
      "15pm": "15pm",
    };
    const next = map[uiId] || resolveChassisId(uiId);
    if (!CHASSIS_REGISTRY[next] || next === CHASSIS.id) {
      return Promise.resolve(CHASSIS);
    }
    /* Hot-swap chassis (rare); keep current if load fails */
    CHASSIS = CHASSIS_REGISTRY[next];
    return loadChassis()
      .then(() => {
        setFinish(finishHex);
        matchCssUnitFraming();
        revealFrontSafe();
        return CHASSIS;
      })
      .catch((err) => {
        console.warn("[palace] chassis swap failed", err);
        CHASSIS = CHASSIS_REGISTRY["17pm"];
        return CHASSIS;
      });
  }
  function revealFrontSafe() {
    facingCamera = true;
    draggingHint = false;
    rotX = 0;
    rotY = 0;
    root.rotation.x = 0;
    root.rotation.y = 0;
    showOverlay();
  }

  let frameCount = 0;
  function frame() {
    if (!running) return;
    resize();
    updateFacing();
    renderer.render(scene, camera);
    frameCount++;
    /* Idle refresh of live UI onto glass */
    if (frameCount % 120 === 0) {
      captureUiToTexture(false);
    }
    requestAnimationFrame(frame);
  }

  resize();
  requestAnimationFrame(frame);
  window.addEventListener("resize", resize);

  const ready = loadChassis();

  return {
    ready,
    glued: true,
    textureScreen: true,
    chassis: CHASSIS_REGISTRY,
    getChassis: () => CHASSIS,
    setModelUiId,
    setFinish,
    dumpMaterials() {
      if (!phone) return [];
      const out = [];
      phone.traverse((o) => {
        if (!o.isMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          if (!m) return;
          out.push({
            mesh: o.name,
            mat: m.name,
            color: m.color ? "#" + m.color.getHexString() : null,
            transparent: !!m.transparent,
            opacity: m.opacity,
            metalness: m.metalness,
            roughness: m.roughness,
          });
        });
      });
      return out;
    },
    setRotation,
    setDragging(on) {
      draggingHint = !!on;
      if (on && overlayMode) {
        syncCaptureClone();
        captureUiToTexture(true);
        hideOverlayKeepTexture();
        facingCamera = false;
      }
    },
    setBackLine,
    matchCssUnitFraming,
    revealFront() {
      facingCamera = true;
      draggingHint = false;
      rotX = 0;
      rotY = 0;
      root.rotation.x = 0;
      root.rotation.y = 0;
      showOverlay();
      /* If projection not ready yet, retry next frames */
      if (!overlayMode) {
        requestAnimationFrame(() => showOverlay());
        setTimeout(() => showOverlay(), 50);
        setTimeout(() => showOverlay(), 200);
      }
    },
    resize,
    captureNow: () => {
      syncCaptureClone();
      return captureUiToTexture(true);
    },
    debugPaint(color) {
      if (!uiCanvas || !uiTex) return false;
      const ctx = uiCanvas.getContext("2d");
      ctx.fillStyle = color || "#ff00aa";
      ctx.fillRect(0, 0, uiCanvas.width, uiCanvas.height);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 64px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("TEX OK", uiCanvas.width / 2, uiCanvas.height / 2);
      uiTex.needsUpdate = true;
      if (screenMat) {
        screenMat.emissiveMap = uiTex;
        if (screenMat.emissive) screenMat.emissive.set(0xffffff);
        screenMat.needsUpdate = true;
      }
      if (screenMesh) {
        screenMesh.material = screenMat;
        screenMesh.visible = true;
      }
      return { ok: true, mesh: screenMesh?.name, hasMap: !!screenMat?.map };
    },
    debugSolid(hex) {
      if (!screenMesh) return false;
      const mat = new THREE.MeshBasicMaterial({
        color: hex || 0xff00aa,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      screenMesh.material = mat;
      screenMesh.visible = true;
      return screenMesh.name;
    },
    getLoadMs: () => loadMs,
    getFacingBack() {
      return !facingCamera;
    },
    isFacingCamera() {
      return facingCamera;
    },
    getOverlayMode: () => overlayMode,
    getProjection: () => projectScreenCorners(),
    debugOrient() {
      const m = screenMesh || (phone && findScreenMesh(phone, CHASSIS.screenMat));
      if (!m) return null;
      const n = getScreenOutwardNormal(m);
      const box = new THREE.Box3().setFromObject(m);
      const c = box.getCenter(new THREE.Vector3());
      const sz = box.getSize(new THREE.Vector3());
      return {
        normal: [n.x, n.y, n.z],
        center: [c.x, c.y, c.z],
        size: [sz.x, sz.y, sz.z],
        phoneRot: phone ? [phone.rotation.x, phone.rotation.y, phone.rotation.z] : null,
        rootRot: [root.rotation.x, root.rotation.y, root.rotation.z],
        overlay: overlayMode,
        lastGoodCapture,
      };
    },
    dispose() {
      running = false;
      if (mutObs) mutObs.disconnect();
      if (syncTimer) clearTimeout(syncTimer);
      renderer.dispose();
      if (uiTex) uiTex.dispose();
    },
  };
}

window.LT_DEVICE_MESH = { createDeviceMesh, CHASSIS };

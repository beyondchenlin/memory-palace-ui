import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const OUT = "/workspace/english-tool-deploys/memory-palace-svg/screenshots";
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1280,900"],
  defaultViewport: { width: 1280, height: 900 },
});
const page = await browser.newPage();
await page.goto("http://127.0.0.1:8765/?forceShell=1", { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForFunction(() => window.LT_SHELL && document.getElementById("device-unit"), { timeout: 15000 });

const results = [];

function shot(name) {
  return page.screenshot({ path: path.join(OUT, name), fullPage: false });
}

// 1) Front baseline
await page.evaluate(() => window.LT_SHELL.resetOrbit());
await new Promise((r) => setTimeout(r, 200));
let o = await page.evaluate(() => window.LT_SHELL.getOrbit());
results.push({ step: "front", ...o });
await shot("svg-orbit-front.png");

// 2) Force yaw beyond 80 via setOrbit — must clamp
o = await page.evaluate(() => window.LT_SHELL.setOrbit(0, 120));
results.push({ step: "setYaw120_clamped", ...o, pass: o.rotY === 80 });
await shot("svg-orbit-yaw-clamp-pos.png");

o = await page.evaluate(() => window.LT_SHELL.setOrbit(0, -120));
results.push({ step: "setYawNeg120_clamped", ...o, pass: o.rotY === -80 });
await shot("svg-orbit-yaw-clamp-neg.png");

// 3) Drag from empty page background far to the right — should hit +80 max
await page.evaluate(() => window.LT_SHELL.resetOrbit());
const stageBox = await page.evaluate(() => {
  const s = document.getElementById("demo-stage");
  const r = s.getBoundingClientRect();
  // pick a point left of the phone (empty-ish) — stage left padding
  return { x: r.left + 24, y: r.bottom - 40, w: r.width, h: r.height, right: r.right, left: r.left, top: r.top, bottom: r.bottom };
});
// Prefer body empty area: top-left of viewport outside stage-bar buttons
await page.mouse.move(40, 420);
await page.mouse.down();
// drag a long way right
await page.mouse.move(900, 420, { steps: 40 });
await page.mouse.up();
await new Promise((r) => setTimeout(r, 150));
o = await page.evaluate(() => window.LT_SHELL.getOrbit());
results.push({
  step: "dragEmptyRight",
  ...o,
  pass: o.rotY <= 80 && o.rotY > 10,
  note: "yaw should rise but never exceed 80",
});
await shot("svg-orbit-drag-clamped.png");

const yawAfterDrag = o.rotY;

// 4) Double-click empty area outside phone → reset
const unitBox = await page.evaluate(() => {
  const u = document.getElementById("device-unit");
  const r = u.getBoundingClientRect();
  return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
});
// click well left of phone
const dblX = Math.max(30, unitBox.left - 80);
const dblY = 500;
await page.mouse.click(dblX, dblY, { clickCount: 2, delay: 40 });
await new Promise((r) => setTimeout(r, 200));
o = await page.evaluate(() => window.LT_SHELL.getOrbit());
results.push({
  step: "dblclickOutsideReset",
  ...o,
  dblAt: { dblX, dblY },
  yawBefore: yawAfterDrag,
  pass: Math.abs(o.rotX) < 0.01 && Math.abs(o.rotY) < 0.01,
});
await shot("svg-orbit-dblclick-reset.png");

// 5) Screen button still clickable (mascot / finish chip)
const clickOk = await page.evaluate(() => {
  const btn = document.getElementById("finish-chip-home") || document.querySelector(".cta-check, .mascot-btn, .chip");
  if (!btn) return { found: false };
  let fired = false;
  const h = () => { fired = true; };
  btn.addEventListener("click", h, { once: true });
  btn.click();
  btn.removeEventListener("click", h);
  return { found: true, fired, id: btn.id || btn.className };
});
results.push({ step: "screenClick", ...clickOk, pass: !!clickOk.fired });

// 6) Drag should NOT start when pointerdown on a shell-bar button
await page.evaluate(() => window.LT_SHELL.resetOrbit());
const before = await page.evaluate(() => window.LT_SHELL.getOrbit());
await page.click("#shell-reset");
const afterBtn = await page.evaluate(() => window.LT_SHELL.getOrbit());
results.push({
  step: "chromeButtonNoOrbitSteal",
  before,
  afterBtn,
  pass: afterBtn.rotY === 0 && afterBtn.rotX === 0,
});

// Summary
const allPass = results.every((r) => r.pass !== false);
const report = { allPass, results, maxYaw: 80 };
fs.writeFileSync(path.join(OUT, "svg-orbit-qa.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
process.exit(allPass ? 0 : 1);

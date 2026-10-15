import { createRequire } from "module";
import fs from "fs";
import path from "path";
const require = createRequire(import.meta.url);
const puppeteer = require("/workspace/english-tool-deploys/memory-palace-ui/node_modules/puppeteer-core");

const OUT = path.resolve("screenshots");
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1400,980"],
  defaultViewport: { width: 1400, height: 980 },
});
const page = await browser.newPage();
const results = [];

function shot(name) {
  return page.screenshot({ path: path.join(OUT, name), fullPage: false });
}

await page.goto("http://127.0.0.1:8765/?forceShell=1", { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForFunction(() => window.LT_SHELL && window.LT_PALACE && document.getElementById("device-unit"), { timeout: 20000 });
await new Promise((r) => setTimeout(r, 400));

const layout = await page.evaluate(() => {
  const bar = document.querySelector(".shell-bar");
  const compact = document.getElementById("shell-compact");
  const modelBtn = document.getElementById("shell-model-btn");
  const colorBtn = document.getElementById("shell-color-btn");
  const unit = document.getElementById("device-unit");
  const stageBar = document.querySelector(".stage-bar");
  const ur = unit.getBoundingClientRect();
  const sr = stageBar.getBoundingClientRect();
  return {
    shellBarDisplay: bar ? getComputedStyle(bar).display : "absent",
    compactInStageBar: !!(compact && stageBar.contains(compact)),
    modelBtn: !!modelBtn,
    colorBtn: !!colorBtn,
    phoneTop: Math.round(ur.top),
    stageBarBottom: Math.round(sr.bottom),
  };
});
results.push({ step: "layout", ...layout, pass: layout.compactInStageBar && (layout.shellBarDisplay === "none" || layout.shellBarDisplay === "absent") && layout.modelBtn && layout.colorBtn });
await page.evaluate(() => window.LT_SHELL.resetOrbit());
await shot("svg-compact-front.png");

const beforeTop = await page.evaluate(() => document.getElementById("device-unit").getBoundingClientRect().top);
await page.click("#shell-model-btn");
await new Promise((r) => setTimeout(r, 200));
const afterOpen = await page.evaluate(() => {
  const panel = document.getElementById("shell-model-panel");
  const unit = document.getElementById("device-unit");
  return {
    open: panel && !panel.hidden,
    phoneTop: unit.getBoundingClientRect().top,
    models: document.querySelectorAll("#shell-models .shell-model").length,
  };
});
results.push({
  step: "model_drawer_overlay",
  beforeTop,
  ...afterOpen,
  pass: afterOpen.open && Math.abs(afterOpen.phoneTop - beforeTop) < 4 && afterOpen.models >= 4,
});
await shot("svg-compact-model-drawer.png");

await page.evaluate(() => {
  const btn = document.querySelector('#shell-models .shell-model[data-model="notch"]');
  if (btn) btn.click();
});
await new Promise((r) => setTimeout(r, 250));
const modelPick = await page.evaluate(() => {
  const unit = document.getElementById("device-unit");
  const mini = document.getElementById("shell-mini");
  const panel = document.getElementById("shell-model-panel");
  return {
    model: unit.dataset.model,
    topChrome: unit.dataset.topChrome,
    miniChrome: mini && mini.dataset.chrome,
    drawerClosed: !!(panel && panel.hidden),
  };
});
results.push({ step: "pick_notch", ...modelPick, pass: modelPick.model === "notch" && modelPick.topChrome === "notch" && modelPick.miniChrome === "notch" && modelPick.drawerClosed });
await shot("svg-compact-model-notch.png");

await page.click("#shell-color-btn");
await new Promise((r) => setTimeout(r, 150));
await page.evaluate(() => {
  const btn = document.querySelector('#shell-swatches .shell-swatch[data-shell="cobalt"]');
  if (btn) btn.click();
});
await new Promise((r) => setTimeout(r, 350));
const colorPick = await page.evaluate(() => {
  const unit = document.getElementById("device-unit");
  const tone = document.documentElement.getAttribute("data-finish");
  const wash = getComputedStyle(document.documentElement).getPropertyValue("--page-wash").trim();
  const pet = document.querySelector("#stage-pet .stage-pet-emoji");
  const chipOn = document.querySelector(".finish-swatch.is-on");
  const expectedTone = window.LT_SHELL.shellToTone.cobalt;
  return {
    shell: unit.dataset.shell,
    tone,
    expectedTone,
    wash,
    petEmoji: pet && pet.textContent,
    chipFinish: chipOn && chipOn.dataset.finish,
    miniFill: getComputedStyle(document.documentElement).getPropertyValue("--shell-mini-fill").trim(),
  };
});
results.push({
  step: "pick_cobalt_link",
  ...colorPick,
  pass:
    colorPick.shell === "cobalt" &&
    colorPick.tone === colorPick.expectedTone &&
    colorPick.chipFinish === colorPick.expectedTone &&
    !!colorPick.petEmoji,
});
await shot("svg-compact-color-cobalt.png");

await page.evaluate(() => {
  window.LT_PALACE.applyFinish("product-red", true);
});
await new Promise((r) => setTimeout(r, 300));
const reverse = await page.evaluate(() => {
  const unit = document.getElementById("device-unit");
  const tone = document.documentElement.getAttribute("data-finish");
  const pet = document.querySelector("#stage-pet .stage-pet-emoji");
  return {
    shell: unit.dataset.shell,
    tone,
    expectedShell: window.LT_SHELL.toneToShell["product-red"],
    petEmoji: pet && pet.textContent,
  };
});
results.push({
  step: "tone_to_shell",
  ...reverse,
  pass: reverse.shell === reverse.expectedShell && reverse.tone === "product-red",
});
await shot("svg-compact-tone-red.png");

let o = await page.evaluate(() => window.LT_SHELL.setOrbit(0, 120));
results.push({ step: "yaw_clamp", ...o, pass: o.rotY === 80 && o.maxYaw === 80 });
await shot("svg-compact-yaw80.png");
await page.evaluate(() => window.LT_SHELL.resetOrbit());

const clickOk = await page.evaluate(async () => {
  const chip = document.getElementById("finish-chip-home");
  // go home first
  const homeTab = document.querySelector('.tab[data-screen="home"]');
  if (homeTab) homeTab.click();
  await new Promise((r) => setTimeout(r, 80));
  if (!chip) return { ok: false, reason: "no chip" };
  chip.click();
  await new Promise((r) => setTimeout(r, 100));
  const pop = document.getElementById("finish-popover-home");
  const open = pop && pop.classList.contains("is-open");
  const tab = document.querySelector('.tab[data-screen="lesson"]');
  if (tab) tab.click();
  await new Promise((r) => setTimeout(r, 80));
  const lesson = document.getElementById("screen-lesson");
  return { ok: open && lesson && lesson.classList.contains("is-active"), open, lesson: !!(lesson && lesson.classList.contains("is-active")) };
});
results.push({ step: "inside_clicks", ...clickOk, pass: !!clickOk.ok });
await shot("svg-compact-inside-click.png");

const pass = results.every((r) => r.pass);
fs.writeFileSync(path.join(OUT, "svg-compact-qa.json"), JSON.stringify({ pass, results }, null, 2));
console.log(JSON.stringify({ pass, results }, null, 2));
await browser.close();
process.exit(pass ? 0 : 1);

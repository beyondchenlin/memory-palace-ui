import { createRequire } from "module";
import fs from "fs";
import path from "path";
const require = createRequire(import.meta.url);
const puppeteer = require("/workspace/english-tool-deploys/memory-palace-ui/node_modules/puppeteer-core");
const OUT = path.resolve("screenshots/deploy-proof");
fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1400,980"],
  defaultViewport: { width: 1400, height: 980 },
});
const page = await browser.newPage();
await page.goto("https://lingotrace-palace-svg.vercel.app/?forceShell=1", { waitUntil: "networkidle0", timeout: 90000 });
await page.waitForFunction(() => window.LT_SHELL && document.getElementById("shell-compact"), { timeout: 20000 });
await new Promise((r) => setTimeout(r, 500));
await page.screenshot({ path: path.join(OUT, "prod-front.png") });
await page.click("#shell-model-btn");
await new Promise((r) => setTimeout(r, 250));
await page.screenshot({ path: path.join(OUT, "prod-model-drawer.png") });
await page.evaluate(() => document.querySelector('#shell-models .shell-model[data-model="notch"]')?.click());
await new Promise((r) => setTimeout(r, 200));
await page.click("#shell-color-btn");
await new Promise((r) => setTimeout(r, 150));
await page.evaluate(() => document.querySelector('#shell-swatches .shell-swatch[data-shell="cobalt"]')?.click());
await new Promise((r) => setTimeout(r, 400));
const state = await page.evaluate(() => ({
  shell: document.getElementById("device-unit")?.dataset.shell,
  model: document.getElementById("device-unit")?.dataset.model,
  tone: document.documentElement.getAttribute("data-finish"),
  pet: document.querySelector("#stage-pet .stage-pet-emoji")?.textContent,
  compact: !!document.getElementById("shell-compact"),
}));
await page.screenshot({ path: path.join(OUT, "prod-cobalt-linked.png") });
fs.writeFileSync(path.join(OUT, "prod-qa.json"), JSON.stringify(state, null, 2));
console.log(JSON.stringify(state, null, 2));
await browser.close();

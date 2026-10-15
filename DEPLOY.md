# Memory Palace UI — v10e (size-locked reveal + clickable front)

Shipped: 2026-10-15 Asia/Shanghai (UTC+8)

## Reference
phone-mockup-studio UV affine on iPhone 17 Pro Max `screen.001` (unchanged glue).

## Root causes fixed
1. **Grow after GLB**: `fitScale` forced `--shell-fit:1` when glued; WebGL `fitPhone` target 2.78 + camera z 6.15 oversized vs CSS unit. Fixed: keep moderate `--shell-fit`, `matchCssUnitFraming()` dolly, target 2.18.
2. **Flash / double-phone**: body got `has-glued-screen` before texture ready; WebGL shown while CSS copper still visible; `showOverlay` during `is-gltf-pending`. Fixed: `is-gltf-pending` hides WebGL; reveal only after `waitForGoodCapture` + `has-gltf-ready`.
3. **White glass**: reveal before `lastGoodCapture`; `canvasHasContent` treated white wash as OK. Fixed: await good capture; reject uniform near-white; paint lesson fallback first.
4. **Clicks**: capture clone used class `.device-screen`, so hit-tests/querySelector hit the offscreen clone. Fixed: clone uses `.device-screen-capture-clone`; HTML overlay near-front (~18°).

## Proof
- `screenshots/v10e/01-load-first-frame.png`
- `screenshots/v10e/02-after-load.png`
- `screenshots/v10e/03-tilt-content.png`
- `screenshots/v10e/04-front-click.png` + `CLICK-HIT-TEST.md`

## Deploy
Temp only — do not claim until user OK.

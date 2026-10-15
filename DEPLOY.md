# Memory Palace UI — v10d (phone-mockup-studio UV glue)

Shipped: 2026-10-15 Asia/Shanghai (UTC+8)

## Reference
**quentin-pla/phone-mockup-studio** (iPhone 17 Pro Max `screen.001`):
- Native mesh UVs — never rewrite
- Texture affine: `repeat: [-1.028278, -1]`, `offset: [0.020257, 1.0019]`, clamp
- CanvasTexture as `emissiveMap` on screen material (base black, roughness 1)
- One Object3D orbit (`root.rotation`); camera locked
- Base yaw `[0, π/2, 0]`

## Fixes vs v10b/c
1. **Shrink drift**: `fitPhone` reset scale before measure (was collapsing to 1 on re-fit); CSS `--shell-fit:1` + no float when glued
2. **Desync**: stop rewriting UVs; studio affine; UV owns orbit (HTML overlay only dead-front); capture includes screensaver
3. **Chassis**: `Cube010_black002_0` always visible
4. **Interaction**: LMB drag anywhere (except chrome) = orbit; dblclick anywhere = reset

## Proof shots
- `screenshots/v10d/front.png` — high+large, copper frame, UI
- `screenshots/v10d/tilt-30.png` — side buttons + glass UV
- `screenshots/v10d/screensaver-tilt.png` — screensaver glued while tilted
- `screenshots/v10d/after-drag.png` — stable after reset

## Live
| Role | URL |
|------|-----|
| Temp v10d | https://temporary-nimble-ochre-areavrw.vercel.app/ |
| Claim (do not until user OK) | https://vercel.com/claim-deployment?code=d7a53385-d5ff-45be-aeed-862d272945e4 |

Deployment: `dpl_22kfWUCnf6aTBnStMV9wCtCabyfD` — **not claimed**.

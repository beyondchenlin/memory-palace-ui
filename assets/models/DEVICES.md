# Multi-device chassis path (v10g+)

## Rules
- **Never** DIY SVG/CSS slab phone bodies for desktop/pad showcase.
- **Island CSS cutout** only when `topChrome === "island"` AND mode is shelled.
- **Android / hole / clean**: `topChrome` is `hole` or `none` — never draw Dynamic Island.
- **Real narrow phones** (`is-real-phone` / `forcePhone=1`): unshelled, `topChrome=none`, no fake island.

## Registry (`js/device-mesh.js` → `CHASSIS_REGISTRY`)
| id | File | Status | topChrome |
|----|------|--------|-----------|
| `17pm` | `iphone-17-pro-max.min.glb` (meshopt ~191KB) | **default** | island |
| `15pm` | `iphone-15-pro-max.glb` (~9MB) | optional `?chassis=15pm` — meshopt later | island |
| `android` | _TBD_ meshopt GLB + UV affine | reserved (`null`) | hole |

## Adding Android (or any non-island)
1. Source CC-licensed GLB with a clear screen material name.
2. Meshopt-compress to `*.min.glb` (<300KB target).
3. Measure UV `repeat`/`offset` like phone-mockup-studio (or calibrate with magenta debug paint).
4. Register in `CHASSIS_REGISTRY` with `family:"android"`, `topChrome:"hole"`, `cameraBumpMat` if any.
5. Map shell UI model `hole` / `dual` → that id in `setModelUiId`.
6. QA: `islandDisplay===none` on android + unshelled ; shelled pad/desktop still show frame.

## Query overrides
- `?chassis=17pm` | `15pm`
- `?forceShell=1` / `?forcePhone=1`

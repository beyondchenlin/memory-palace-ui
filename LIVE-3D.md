# Live 3D presentation · 2026-10-16

This iteration is local only at http://127.0.0.1:8877/. Do not commit, push or
trigger a Vercel deployment until requested. The SVG app remains the reference
for courses, interaction, language packs, tone colors and pets. This adapter
owns the handset presentation.

## Hardware and live UI

The active catalog exports original geometry and PBR materials from
react-3d-mockups@0.2.0: iPhone 18 Pro Max, Galaxy S26 Ultra, iPhone 18 Pro and
Galaxy S26. Previous hand-built approximations are replaced. See
DEVICE-REFERENCES.md for sources, licensing, sizes and reproducible commands.
Xiaomi/Huawei are pending suitable exact assets, with no relabeled substitutes.

js/device-profiles.js is metadata only. Dimensions share one physical scale;
screen ratio, corners, keys, cutouts and rear cameras change with each handset.
js/device-live-mesh.js loads original content-hashed GLBs, restores material
render traits and links tagged finishes using the source HDR studio lighting.
The camera near plane preserves fine layered geometry without depth fighting.

One native .device-screen is projected onto the handset using a homography.
Actual buttons, input, video and animations remain live, without screenshot
texture captures or a duplicated status bar. Rear-facing input becomes hidden
and inert, returning when facing forward. Front glass borders stay black.

## Loading and rendering

- The working CSS shell/app paint before 3D. Optional fonts do not block startup.
  React/R3F/Drei and source geometry-building code are offline dependencies.
- First desktop load fetches only the current handset (658 KB for iPhone 18 Pro
  Max), one shared Three.js engine/decoder and 68 KB gzipped HDR studio lighting.
  Other GLBs are requested only on first selection, then cached with their
  geometry, materials and compiled shaders. No speculative model preloading.
- The cache is bounded by this four-entry catalog. Pending loads are deduplicated;
  version tokens ignore stale responses. A loading indicator keeps the previous
  handset working. A failed switch restores its selection/dimensions and permits
  retry. Initial failure or unavailable/lost WebGL retains the working CSS shell.
- DPR starts at at most 1.5 and steps down to 1 after sustained slow animation
  frames; native HTML text is unaffected. Rotation and finish changes use
  time-based damping. WebGL stops drawing when still, hidden or offscreen.
  Layout observers share one scheduled frame, unchanged projection/material
  updates are skipped, and repeated mouse movement outside the rig is ignored.
  Leaving desktop aborts pending model downloads and disposes renderer,
  geometry, materials, environment and listeners.
- Real phones (narrow viewport, or coarse input on a screen with a short side
  ≤540 px, including landscape) use the full-screen native app and request no
  Three.js, loader, GLB or studio atlas.
- A shared CSS-composited parent breathes by 6 px over 5.5 seconds. Hover, focus,
  drag and open pickers pause it; reduced motion is respected. No extra GPU draws.

The selected GLB download overlaps engine/HDR preparation. The shared Three.js
bundle exports only names required by the live adapter and its loader: 586,553
bytes versus 742,291 previously (raw JavaScript, about 21% less). There is still
one engine instance. Unselected devices are never prefetched.

The focused frame supports arrow-key rotation and Home reset. Descendant
inputs/buttons retain their keys. Manual drag remains available with reduced
motion, using an immediate pose; hover/breathing stay disabled. Pointer cancel,
blur and crossing into phone mode clear drag state.

## Desktop simulated status

js/device-status.js reads local host time and aligns updates to minute boundaries.
Battery, charging, cellular bars, Wi-Fi and airplane mode are explicitly simulated
in the status tooltip/accessibility label. It does not read signal strength or
change host network, battery or airplane settings.

Signal changes take neighboring steps every 14–22 seconds; battery moves by 1%
every 50–70 seconds within 18–96%. Short charging episodes appear after roughly
1.5–2.5 minutes, then later a short 8–12-second airplane episode. Radio icons
return afterward. Reduced motion disables icon pulses/transitions. Labels cover
five app languages without live announcement spam. One timeout schedules the
next event/minute; hidden documents and phones stop it, and resume syncs time.
Status DOM updates never request a WebGL render. Mobile hides the entire fake
status bar, including on touch-phone landscape, leaving native OS chrome alone.

Both pickers share LT_PALACE.FINISH_IDS: Fresh, Dream, Glow, Calm, Fire, Soft,
Muse, Focus, Clear, Steady and Black. Order, names, swatch colors and animals
match in both directions. Black is pure-black, #101114, panda. Legacy saved IDs
and older missing translations fall back safely rather than disabling controls.
Pickers preserve SVG parity: full-width in-flow strips, persistent selection,
keyboard navigation, outside dismissal and Escape focus return.

## Validation and measured limits

qa-preview-server.py serves loopback only, with no-store headers and no growing
request logs. Versioned module/style URLs prevent mixing old and new dependencies.
Use existing PLAYWRIGHT_MODULE / CHROME_PATH; QA_URL selects the server and
QA_OUTPUT selects evidence. Relevant checks:

- qa-original-lazy.cjs: exactly one initial GLB, new downloads only on selection,
  cached switching, source identity, front/back visuals, actual lesson clicks,
  idle draws, startup timings and rotation frame samples.
- qa-original-resilience.cjs: 4 Mbps/100 ms network plus 4× CPU slowdown, usable UI
  before 3D, failed switch/retry, stale responses, bounded GPU/cache allocations
  and initial download failure fallback.
- qa-live-3d.cjs: course flow, projection, one native screen, drag/reset, scroll,
  resize round trip, mobile boundary/downloads, missing WebGL and context loss.
- qa-palette.cjs: eleven linked finishes, actual material colors, five locales
  and legacy saved state.
- qa-3d-pickers.cjs: animated layout, keyboard/focus, reduced motion and narrow
  horizontal scrolling. Uses PICKER_QA_URL and PICKER_QA_OUTPUT.
- qa-devices.cjs: sizes, screen ratios, rear input behavior, persistence and
  mixed older-i18n cache regression.

Evidence is retained outside the checkout under
../3d-local-preview-evidence/original/. Local Chrome on NVIDIA RTX 4090 measured
roughly 0.1–0.25 s until UI availability and 1.2–1.8 s until first 3D ready.
A rotation sample averaged 16.67 ms/frame (p95 16.8 ms). These are local high-end
GPU measurements, not guarantees for other hardware or online networks.

The throttled test uses uncompressed local JavaScript, 4 Mbps, 100 ms latency
and 4× CPU slowdown. GPU remains RTX 4090. UI becomes usable before 3D; course
navigation works while models load. See result JSON for exact timings. This
does not replace a real low-end GPU or deployed CDN test. Initial WebGL context
creation and shader preparation can still briefly occupy the main thread.

The next optimization/status iteration is recorded in APPEARANCE-TEST-PLAN.md.
Its evidence is under ../3d-local-preview-evidence/appearance-20261016/;
qa-device-status.cjs, qa-appearance-stress.cjs and qa-mobile-status.cjs cover
the new scheduling, interactions, adaptive rendering and mobile orientation.
Baseline and updated network conditions are identical, but hardware timing is
variable: see the plan for the individual local samples and their limits.

## Release boundary

Existing 3D project: lingotrace-palace-ui,
https://lingotrace-palace-ui.vercel.app/. The reviewed release is published
from the dedicated 3d-phone branch. Do not deploy to the separate SVG or delta
projects. vercel.json explicitly skips dependency installation and build commands:
the checked-in HTML/CSS/modules, GLBs and HDR atlas are the static runtime.

Production rollback reference captured before this release: dpl_HmYz3yJCFhrePRzH64ZRggAhRX8b
(https://lingotrace-palace-n43sc3wl5-beyondchenlins-projects.vercel.app).
See RELEASE-REVIEW.md for the two review passes and regression coverage.

## Local artifact retention

Reused the existing memory-palace-3d worktree; no extra worktree was created.
Keep its node_modules for reproducible offline exports and keep all prior/new
browser evidence. The local preview server remains running on loopback:8877.
After export browsers exited, removed only task-created qa-generated/original.js,
qa-generated/original.html and the unreferenced initial iphone-18-pro-max.glb
(3,953,178 logical bytes total). Exact paths, reparse attributes, recent writes,
exporter processes and exclusive file locks were checked before removal.
Actual free-space movement also includes concurrent writes by other tasks.

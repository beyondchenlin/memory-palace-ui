# Live 3D presentation · 2026-10-16

The app, course content, appearance pickers, colors, language packs, pet and
responsive styles follow the current SVG work in commit
`a55b3df80c60fa9c73e317968e80c50928ce9c38` on `fix/svg-full-viewport-background`.
The earlier deployment URL selected an old overlay-picker version. The user's
correction requires the current in-flow picker strips: full-width rows, preview
icons, persistent selection, animated space for the phone and notes, keyboard
controls, outside dismissal and Escape focus return.

## Presentation boundary

- `index.html` adds one presentation stylesheet, an import map and a lazy boot module.
- `js/device-shell.js` has two adapter hooks: publish rotation, and recognize the
  projected live screen as part of the phone for double-click protection.
- `js/device-live-boot.js` manages desktop/phone transitions and WebGL fallback.
- `js/device-live-mesh.js` creates real extruded rounded bodies, bevels, separate
  side keys, antenna bands, rear camera details, physical materials and a local
  studio reflection environment. Four generic silhouettes match the SVG choices;
  these are procedural 3D bodies, not scanned manufacturer models.
- The original native DOM is projected onto the screen with a homography. There
  is only one UI and one status bar at every angle. Native buttons, text, video
  elements and animations remain live; there are no screenshot texture captures.
- Rotation uses time-based damping and the reference's yaw/pitch limits. Rendering
  stops when the device is still and while the document is hidden.
- Real phones do not download Three.js or create WebGL. Resize back to desktop
  creates one renderer. Leaving desktop disposes geometry, materials, environment,
  renderer and listeners. Unavailable/lost WebGL restores the working SVG shell.

Legacy GLB assets and old rendering source remain in Git for recovery. They are
excluded from deployment and not requested by the new presentation.

## Verification

Use a static server and the existing shared browser runtime; no install/build is
required. Run `node qa-live-3d.cjs` with `PLAYWRIGHT_MODULE` pointing to Playwright
and optionally `CHROME_PATH` pointing to Chrome. `QA_URL` selects the deployment
(default localhost:8877), and `QA_OUTPUT` selects the evidence directory.

The browser test covers live-screen uniqueness, animated picker space, four
models, shell/tone changes, actual clicks at an angle, lesson → interpret → check
→ settle, Palace, locale, pointer drag, reset, clamp, idle rendering, tablet/phone
boundaries, resize round trip, scroll projection, cold mobile network requests,
missing WebGL and context loss. Screenshot and JSON evidence is retained in the
chosen directory (ignored by Git by default).

`qa-3d-pickers.cjs` specifically checks parity with the current SVG pickers:
full-width single-row panels, screen/body tracking throughout expansion,
phone/notes movement down and back, selection without dismissal, model previews,
color linking, keyboard navigation, focus return, reduced motion and narrow
viewport horizontal scrolling. It accepts `PICKER_QA_URL` and `PICKER_QA_OUTPUT`.

## Deployment and rollback

3D project: `lingotrace-palace-ui` (`prj_Z2ZGVk1gyekqpZvCqR8Hkz4xsAkc`).
Long-term URL: https://lingotrace-palace-ui.vercel.app/

Deploy to this existing project, verify the staged deployment, then promote it.
The unused multi-region Functions setting was removed: this is a static site,
and the old setting caused a Hobby-plan rejection without improving CDN delivery.
No account settings or plan changes are needed.

Previous production deployment for rollback:
`dpl_8SMHUADLvuskzruH3nWRpFaC1pn2`
(`https://lingotrace-palace-juq9kl0qq-beyondchenlins-projects.vercel.app`).

Do not deploy this presentation to `lingotrace-palace-svg` or `lingotrace-delta`.

# Memory Palace UI — v10g (outside-orbit / inside-click / white bump)

Shipped: 2026-10-15 Asia/Shanghai (UTC+8)

## Checklist matrix (Playwright `qa-v10g.mjs`) — 23/23 PASS
1. Load speed (meshopt) — PASS (~70ms)
2. Drag outside = orbit; dblclick outside = reset; inside = no orbit — PASS
3. Single overlay, no double screen — PASS
4. Clicks: Start, Clip, Tone, Interpret, ClipA, Lang — PASS
5. Wash follows tone — PASS
6. Camera bump opaque white — PASS
7. Chassis registry 17pm (+15pm/android path) — PASS
8. Mobile: phone unshelled; pad/desktop shelled; android no island — PASS
9. Position pending→ready no jump — PASS
10. Temp deploy + PR push — this ship

## Root fix this stage
Capture clone stripped `id`/`name` so `getElementById` never hits offscreen clone (broke Interpret/sheet).

## Proof
`screenshots/v10g/` + `qa-v10g.json`

## Deploy
Temp only — do not claim until user OK.

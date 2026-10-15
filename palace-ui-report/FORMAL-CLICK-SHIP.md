# Memory Palace A — formal product + click-safe shell (2026-10-15 CST)

## URLs
- **Durable A:** https://lingotrace-palace-ui.vercel.app/  (307 soft → temp)
- **Temp:** https://temporary-brisk-nova-omozci2.vercel.app/
- **Claim:** https://vercel.com/claim-deployment?code=f8e46d72-d55a-4358-a0fd-a80668b13ed6
- Phone unshelled: add `?forcePhone=1`

## Fail → fix log (source audit; no box Playwright per steering)
| Fail | Fix |
|------|-----|
| Demo/preview/视觉决策/演示样机/MOCK POSTER copy | Formal product strings in `index.html` + all `i18n` locales; notes = “How Memory Palace works” |
| Stage pet decorative-only (`pointer-events:none`, `<div>`) | `<button id="stage-pet">` + `pointer-events:auto` + click opens tone picker + bounce |
| Possible orbit stealing screen clicks | Drag only if `!isOverScreen`; gloss/island/notch/hole/glow `pe:none`; screen `pe:auto` |
| Forced `position:relative` on all screen buttons (broke fabs) | Removed; keep pe:auto only |
| Flip face still hit front | `is-back` class toggles front/back pointer-events |
| Pet wandering over phone center | Wander constrained to left/right gutters |
| Listen/Play dead | Visual pulse wired on play-fab + listen-btn; type-rails focusable + keydown |

## Files changed
- `index.html`
- `js/i18n.js`, `js/palace.js`, `js/device-shell.js`, `js/pets.js`
- `css/palace.css`, `css/device-shell.css`, `css/pets.css`
- `DEPLOY.md`, `.vercel/anonymous.json`

## Curl-verified live markers
- Device shell / How Memory Palace works / Licensed (no Demo unit / Visual decisions)
- `data-finish="duolingo"`
- pets.js `createElement("button")` + `openToneFromPet`
- pets.css `pointer-events: auto !important`
- device-shell `is-back` + `forcePhone`

## Parent still needs to verify in desktop browser
Tab nav, Start, Listen, type rails, Check, Interpret open/close, Today's tone + Follow, language, shell model/finish, Flip, stage-pet click.

Studio untouched.

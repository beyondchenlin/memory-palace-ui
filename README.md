# Memory Palace UI Preview (standalone)

Working title: **影视记忆宫殿课** — Duolingo-like lesson shell + cartoon HUD.  
**Not merged into LingoTrace Studio.** Do not deploy onto `lingotrace-delta`.

## Open locally
```bash
cd /workspace/english-tool-deploys/memory-palace-ui
python3 -m http.server 8765
# http://127.0.0.1:8765/
```

## Screens
Top tabs: Today → Clip → Palace → Settle (phone frame 390×844).

## Visual decisions
- Soft Duolingo greens / cream phone chrome + sharp HUD rings, micro-meters, edge light
- No muddy double-glass; no Studio dark chrome clone
- No caption capsule over video; LISTEN ref only above typing rails
- Keyboard = dim dock only (no fake QWERTY)
- Mock posters only (no copyrighted footage)

## Paths
- Source: `/workspace/english-tool-deploys/memory-palace-ui/`
- Store copy: `/cursor/stores/store-ff53f92a-627a-43b0-9205-873f7626ce00/memory-palace-ui/`
- Screenshots: `screenshots/mobile-{home,lesson,palace,settle}.png`

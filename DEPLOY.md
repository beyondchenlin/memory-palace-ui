# Memory Palace UI — v10g durable (SF01 fix)

Shipped: 2026-10-16 Asia/Shanghai (UTC+8)

## Cause of 403 SF01
China phone (VPN on) hit anonymous **temporary** deploy `temporary-zippy-marsh-*`.
Vercel Security Firewall **SF01** (`该请求被阻止`) blocks many CN/VPN exit IPs on unclaimed temp hosts.
Box (iad1) still got HTTP 200 — not a content bug.

Project `lingotrace-palace-ui`: SSO/password/IP protection **off**; no Attack Challenge seawall.

## Fix
Production deploy `dpl_8SMHUADLvuskzruH3nWRpFaC1pn2` → durable alias.

## Open this (CN phone)
**https://lingotrace-palace-ui.vercel.app/**

Do **not** use `temporary-*.vercel.app` from CN — they expire (~1h) and trip SF01.

## Multi-region note
Hobby plan cannot set `functionDefaultRegions` multi (402). Static CDN still global.
`vercel.json` keeps `regions: [sfo1,iad1,hkg1,sin1]` for when plan allows / anonymous CLI.

## Temp (expires ~60m; may 403 from CN)
https://temporary-brisk-quasar-gv0ehvv.vercel.app/
Claim: https://vercel.com/claim-deployment?code=2abe4895-0223-41af-aea6-408bf18eb499

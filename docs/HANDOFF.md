# Memory Palace / LingoTrace — 交接文档 HANDOFF

> 写于：2026-10-16 Asia/Shanghai（UTC+8）  
> 原因：Grok Bot（英语工具）额度将尽，需换其他大模型继续。  
> 作者身份：Grok Bot 执行子代理；用户：吱 陈（beyondchenlin）。

本文同时服务：**下一个接手的模型** + **用户自己下载核对**。  
**中文为主，关键专有名保留英文。**

---

## 1. 项目是什么

### LingoTrace（Studio）
英语学习 / 影视字幕工作室产品。主仓：`beyondchenlin/lingotrace`。  
Studio 正式预览历史域名（勿与记忆宫殿混淆）：`https://lingotrace-delta.vercel.app/studio/`（以当时部署为准）。

当前 Studio 线：`feat/hud-rescue` —— HUD 视觉挽回、continue5–38 工艺批、`dist` 静态导出。  
刚推完本地领先的约 76 个 commit，并开了 PR。

### Memory Palace UI（记忆宫殿预览）
工作标题：**影视记忆宫殿课** —— Duolingo 风格课时壳 + 卡通 HUD + **真机样机展示**。  
**独立仓**，**不要**合并进 Studio，**不要**部署到 `lingotrace-delta`。

仓：`https://github.com/beyondchenlin/memory-palace-ui`

两条并行产品线（必须分开，不要互相 alias）：

| 线 | 实现 | 长期域名 | 分支 | PR |
|----|------|----------|------|-----|
| **3D** | Three.js + glTF 真机壳（UV 贴屏） | https://lingotrace-palace-ui.vercel.app/ | `feat/v10d-gltf-uv-glue` | [#1](https://github.com/beyondchenlin/memory-palace-ui/pull/1) |
| **SVG** | CSS/SVG demo-unit 壳（选机/选色/小动物） | https://lingotrace-palace-svg.vercel.app/ | `feat/svg-shell-restore` | [#2](https://github.com/beyondchenlin/memory-palace-ui/pull/2) |

用户在额度耗尽前明确：**3D 版本保持住**；当前主改 **SVG 原版**（选机+选色+右下角宠物、白底已去）。

遗留紫罗兰 sibling（旧）：`https://lingotrace-palace-ui-b.vercel.app/`（可能 307，勿当主站）。

---

## 2. 仓库 / 分支 / PR 一览

### memory-palace-ui
- Repo: https://github.com/beyondchenlin/memory-palace-ui
- `main`：脚手架起点（`ce1a594`）
- `feat/v10d-gltf-uv-glue`：3D v10d→v10g（**PR #1**）
- `feat/svg-shell-restore`：SVG 恢复 + compact drawers（**PR #2**）
- `archive/demo-unit-shell-alt`：本机 `memory-palace-ui-alt` 快照（交接时归档，无 PR）
- **本交接文档 PR**：见下文 §11（仅 `docs/HANDOFF.md`）

### lingotrace（Studio）
- Repo: https://github.com/beyondchenlin/lingotrace
- `feat/hud-rescue`：https://github.com/beyondchenlin/lingotrace/pull/1  
  （2026-10-16 刚把本地 ahead 76 commits 推上去并开 PR）

### 参考上游（3D 贴合来源）
- https://github.com/quentin-pla/phone-mockup-studio  
  屏幕用原生 UV + CanvasTexture 贴 `screen.001`；整机一起转。

---

## 3. 长期 URL 与部署铁律

### 必须用的长期站（中国手机可开）
| 用途 | URL |
|------|-----|
| 3D v10g | **https://lingotrace-palace-ui.vercel.app/** |
| SVG compact | **https://lingotrace-palace-svg.vercel.app/** |

### 禁止
- **不要把 `temporary-*` 链接发给用户（尤其中国大陆 / VPN）**  
  Vercel Security Firewall **SF01** 会拦：页面显示「该请求被阻止 / 403」。  
  临时站还约 1 小时过期。  
  本机（iad1）curl 200 **不能**证明用户端能开。
- **不要把 SVG 构建 alias 到 `lingotrace-palace-ui`**（会盖掉 3D）。
- **不要把记忆宫殿部署到 Studio 的 `lingotrace-delta`**。

### Vercel 项目（claimed / durable）
| Alias | 项目名（约） | 说明 |
|-------|--------------|------|
| lingotrace-palace-ui | memory-palace-formal-v9 / palace-ui 线 | 3D；SSO/密码/IP 防护关；无 Attack Challenge |
| lingotrace-palace-svg | lingotrace-palace-svg | SVG；`prj_TvECxOyeCHow5LpYlBCqx3ri39H9` |

Team：`beyondchenlins-projects`（`team_v5rpr2P5kc6fjCn8oF5Br9Qx`）  
Hobby 多 region 函数可能 402；`vercel.json` 里仍留 `regions: [sfo1,iad1,hkg1,sin1]`。

### 推荐部署姿势
```bash
# 3D
cd /workspace/english-tool-deploys/memory-palace-ui
# 已 link 到 durable 项目时：
npx vercel deploy --prod --yes
# 或先 anonymous temp，再 claim，再 alias —— 但最终必须落到长期域名再给人

# SVG（独立项目）
cd /workspace/english-tool-deploys/memory-palace-svg   # 或 memory-palace-svg-wt
npx vercel deploy --prod --yes
```
本机预览：
```bash
cd /workspace/english-tool-deploys/memory-palace-ui   # 或 -svg / -svg-wt
python3 -m http.server 8765
# http://127.0.0.1:8765/
```
QA：目录内 `qa-v10g.mjs`、`qa-svg-compact.mjs`、`qa-svg-orbit.mjs`、`qa-svg-prod.mjs`（puppeteer-core + 本机 Chrome）。

---

## 4. 本机（agent box）路径

Box 是所有该用户 agent **共享的一台 Linux**；桌面/浏览器会话按 agent 隔离。

| 路径 | 内容 |
|------|------|
| `/workspace/english-tool-deploys/memory-palace-ui` | **3D** 工作树，`feat/v10d-gltf-uv-glue`，已与 origin 同步 |
| `/workspace/english-tool-deploys/memory-palace-svg-wt` | **SVG** git worktree，`feat/svg-shell-restore` |
| `/workspace/english-tool-deploys/memory-palace-svg` | SVG 部署副本（无 .git；与 wt 源码对齐） |
| `/workspace/english-tool-deploys/memory-palace-ui-alt` | 旧 demo-unit / 紫罗兰 sibling 源；已归档到 `archive/demo-unit-shell-alt` |
| `/workspace/english-tool-deploys/lingotrace` | Studio，`feat/hud-rescue` |
| `/workspace/english-tool-deploys/palace-ui-report` | 报告碎片 |
| Store：`/cursor/stores/store-ff53f92a-627a-43b0-9205-873f7626ce00/memory-palace-ui/` | DEPLOY.md、SHELL-CLAIM.md、README 等镜像 |
| Store `memory-palace-v10e/` | 点击命中测试笔记 |

用户机器（最近一条消息）：`de6115b5-cda8-4025-b011-0f245870bb85`（桌面）。

Agent 名：英语工具；store id：`store-ff53f92a-627a-43b0-9205-873f7626ce00`。

---

## 5. 已完成（Done）

### 用户流程硬规则（两条线都适用）
1. **真手机**（宽 ≤540px）：**无假机壳、无假刘海**，全屏 app。
2. **桌面 / Pad**：始终套样机壳，竖屏 app 在壳内。
3. **每阶段修改必须 git commit + push + PR**（用户强调：防本机死机丢数据）。
4. 设计/前端相关：**开最高档**执行（用户多次强调）。

### SVG 线（当前主线，PR #2）
- 恢复 CSS/SVG demo-unit 壳（非 Three.js）
- 机型：Island Pro / Classic Notch / Android Hole / Clean
- 外壳 10 色 swatches
- 右下角 desk pet：**透明底**（无白色底板）
- 顶部语言行旁：**手机图标 + 颜色图标** → 点击下拉弹层（**overlay，不把手机往下推**）
- **颜色全联动**：外壳色 ↔ 壳内右上角 Tone ↔ 卡片配色 ↔ 小动物 ↔（目标）顶部图标观感
- 倾角：**左右 yaw 钳制 ±80°**（用户要求，避免超过 90° 竖起来难看）；上下可较少动
- **壳外任意处**拖转旋转；**双击壳外**回正；壳内点击穿透到网页内容
- Durable：`lingotrace-palace-svg.vercel.app`
- QA 截图已提交：`screenshots/svg-compact-*`、`color-link-*`、`deploy-proof/`

### 3D 线（保持，PR #1，v10g）
- 对照 phone-mockup-studio：glTF UV + CanvasTexture 贴 `screen.001`
- 恢复金属机身/侧面边框（曾误藏网格导致「只有白屏」）
- 壳外 orbit / 壳内点击分离；双击回正
- 后摄 **不透明白色**（曾错误透明）
- 去掉首屏白屏闪 / 双机过渡；尺寸锁中等
- 心境/Tone 改背景洗色
- 多 chassis 骨架（用户问「其他真机能不能做」——已开始，未全部验收）
- 加载约 ~70ms 量级（本机 QA）
- Durable：`lingotrace-palace-ui.vercel.app`（修过 CN SF01 403）
- QA：`qa-v10g.mjs` 清单曾报 23/23

### Studio（lingotrace PR #1）
- `feat/hud-rescue`：continue15 峰 + premium glass；continue5–38 批；`dist` 静态导出已推。

---

## 6. 未完成 / 用户反馈待办（Next）

按用户最近原话优先级（SVG 为主）：

1. **继续打磨 SVG compact UX**  
   - 确认顶部下拉「附着表面、手机不位移」在所有视口稳定  
   - 机型横滑 / 颜色选择手感  
   - 「顶部手机 SVG 图标随颜色变」的旧版体验 vs 当前边框品质——**保持现在边框逻辑**，补齐联动观感

2. **壳内 1:1 点击与动效回归**  
   - 每个按钮、动效、中英切换、Tone、课程卡都要网页态自测（用户要求「什么系统都可以展开看」）  
   - 背景洗色随右上角颜色（SVG 与 3D 都要核对）

3. **3D 线（保持，暂非主改）**  
   - 更多真机型号完整可切换  
   - 3D 展示速度/贴合边角 case  
   - 首屏位置是否再跳（用户反复问加载第一帧 vs 就绪帧）  
   - 勿破坏长期 3D 域名

4. **工程纪律**  
   - 每个阶段 → commit → push → **更新对应 PR**（或新 PR）  
   - 给人链接只用 durable；临时站仅本机调试  
   - 额度回来后可继续本对话；期间由其他模型按本文接手

5. **Studio**  
   - Review / merge `lingotrace#1` 是否与产品节奏一致（与记忆宫殿独立）

6. **可选清理**  
   - `main` 仍停留脚手架；是否把稳定 SVG 或 3D 合入 `main` 由用户定  
   - `archive/demo-unit-shell-alt` 仅备份，不必合 main

---

## 7. 定时任务 / Routines

**本 Memory Palace 工作流没有已配置的 Grok Bot Routine / cron。**  
没有「自动 redeploy」或「定时截图」自动化绑在此 agent 上。  
部署与推 PR 均为对话内手动执行。

若接手模型要加例行检查：用 Routines skill；默认工作日白天；结果回用户本聊天。

---

## 8. 给下一个模型的操作手册

### 立刻该做的
1. 读完本文 + 打开两个 durable URL，手机+桌面各看一遍。  
2. `git clone` 或在 box 上：
   - 3D：`/workspace/english-tool-deploys/memory-palace-ui` → `feat/v10d-gltf-uv-glue`
   - SVG：`/workspace/english-tool-deploys/memory-palace-svg-wt` → `feat/svg-shell-restore`
3. 改 SVG 时 **不要** checkout 弄乱 3D 未提交文件；两线分目录/分 worktree。  
4. 改完：本机 `python3 -m http.server` + 相关 `qa-*.mjs` → commit → push → 更新 PR #2（SVG）或 #1（3D）→ **durable** `vercel deploy --prod` → 给人长期链接。  
5. 用户说「先不要推」时：**立刻停 push/deploy**（曾发生过）。

### 交互约定（用户原话浓缩）
- 壳外拖转 + 双击回正；左右 ≤80°  
- 颜色与壳内 Tone / 卡片 / 宠物联动  
- 选机选色用右上角小图标下拉，别用大块顶栏把手机顶下去  
- 真机无壳；Pad/桌面有壳  
- 阶段必推 GitHub PR，防丢数据  
- 设计类开最高档

### 说话
- 对用户用中文，简洁；用户名「吱 陈」，通过其账号操作时用第一人称「我」。  
- 不要自称底层模型名；若问身份：Grok Bot（或接手方自己的产品名）。

---

## 9. 关键文件地图

### SVG
- `index.html` — 壳 + HUD 结构  
- `css/device-shell.css` / `js/device-shell.js` — 样机、倾角、orbit  
- `css/finishes.css` / `js/finishes-meta.json` — 外壳色  
- `js/palace.js` / `css/palace.css` — 课时内容  
- `js/pets.js` — 右下角动物  
- `js/i18n.js` — 中英  
- `DEPLOY.md` / `vercel.json`

### 3D
- `js/device-mesh.js` — glTF / Three 壳  
- `js/device-shell-boot.js` — 启动与尺寸锁  
- `assets/` — 模型与贴图  
- `vendor/three/` — 锁定 three 模块  
- `qa-v10*.mjs` — 演进 QA  
- `screenshots/v10g/` 等

---

## 10. 近期事故速查

| 现象 | 原因 | 处理 |
|------|------|------|
| 中国手机 403「该请求被阻止」 | temporary-* + SF01 | 只用 lingotrace-palace-ui / -svg |
| 3D 只有白屏无边框 | 金属网格被藏 | v10 恢复 chassis |
| 首屏跳变/变大白屏 | 双机过渡 + 尺寸未锁 | v10e/g size-lock，杀白闪 |
| 壳内点不了 | 捕获层挡点击 | outside-orbit / inside-click 分离 |
| 后摄发透 | 材质透明 | 不透明白 |
| 倾角 >90° 难看 | 无钳制 | SVG yaw ±80° |
| 部署过期 | temporary 1h | durable alias |
| 本机有代码 GitHub 没有 | 忘推 | **每阶段必推**；本次已补推 SVG QA、Studio 76 commits、ui-alt archive |

---

## 11. 本交接文档位置

- 仓内：`docs/HANDOFF.md`（独立 PR，仅此文件）  
- Box：`/workspace/english-tool-deploys/memory-palace-ui/docs/HANDOFF.md`（可供 SendToUser 附件下载）

---

## 12. English summary (for non-Chinese models)

**LingoTrace Studio** = `beyondchenlin/lingotrace` @ `feat/hud-rescue` ([PR #1](https://github.com/beyondchenlin/lingotrace/pull/1)).  
**Memory Palace UI** = standalone lesson+phone mock preview, **not** Studio: `beyondchenlin/memory-palace-ui`.

Two durable tracks — keep separate:
- **3D v10g**: https://lingotrace-palace-ui.vercel.app/ — branch `feat/v10d-gltf-uv-glue` — [PR #1](https://github.com/beyondchenlin/memory-palace-ui/pull/1)
- **SVG compact**: https://lingotrace-palace-svg.vercel.app/ — branch `feat/svg-shell-restore` — [PR #2](https://github.com/beyondchenlin/memory-palace-ui/pull/2)

User froze 3D; active polish is SVG (compact phone/color drawers, full tone linkage, ±80° yaw, outside-drag / dblclick-reset, transparent desk pet).  
Never send `temporary-*.vercel.app` to CN users (SF01 403).  
Every milestone: commit + push + PR. No Memory Palace routines/cron configured.  
Box paths under `/workspace/english-tool-deploys/memory-palace-*`. Continue from SVG PR #2 unless user reopens 3D.

---

*End of handoff. 额度恢复后可从用户原对话继续；此前请其他模型严格按本文与 GitHub PR 追溯。*

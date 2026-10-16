# 3D Phone · 2026-10-16 里程碑

Tag：`3d-phone-milestone-2026-10-16`。分支：`3d-phone`。
正式网址：https://lingotrace-palace-ui.vercel.app/。
本轮基线：`cb337cf760ba8c0491aa8f0c52c67eef602325a6`。

## 两轮审查与修复

两轮均由当前代理完成：第一轮逐项复核交互及事件生命周期；第二轮复核修复、
多指/隐藏状态、存储受限、选中状态语义，并执行完整回归。

1. **旋转拖动的指针捕获无效。** 监听器挂在 document，却调用 currentTarget
   的捕获方法，实际没有捕获。现改为由手势起始元素捕获，结束/丢失捕获/
   失焦/隐藏时释放；额外指针不再覆盖正在进行的手势。
2. **跨页面点击宠物后色板状态不一致。** 导航先关闭了已打开的色板和
   aria-expanded，下一帧仅恢复视觉显示。现先导航再同步展开面板和状态，
   去掉滞后的重开操作。覆盖首页、片段、宫殿、结算四个入口。
3. **取消宠物拖动后首次点击或 Enter 被吞。** 取消手势未必触发 click，旧的
   拖动抑制标记会残留。现新指针手势重置标记，键盘激活也可立即操作；
   正常拖动结束后的误点击仍被抑制。
4. **顶部选择状态未向辅助技术公开。** 语言按钮同步 aria-pressed；页面导航
   使用原生导航语义并标识唯一 aria-current。移除没有配套 tab 行为的 tablist
   声明。保留原来的按钮、布局及导航流程。

新测试 qa-milestone-review.cjs 在修复前记录失败，修复后七项全部通过，
并在 Edge 再次验证。没有引入依赖或新网络资源，没有改写英语学习业务流程。

## 回归结果

| 检查 | 结果 |
| --- | --- |
| qa-milestone-review.cjs | Chrome / Edge 七项边界通过 |
| qa-release-review.cjs | 先前宠物边界、首次加载断点竞态通过 |
| qa-appearance-stress.cjs | 指针取消、DPR 调整、离屏/隐藏暂停、下载取消与单画布恢复通过 |
| qa-live-3d.cjs | 真实点击、倾斜屏幕、前后视角、课程入口与 WebGL 回退通过 |
| qa-original-resilience.cjs | 弱网、失败重试、过期响应及重复切换 GPU 资源稳定通过 |
| qa-3d-pickers.cjs | 图标直接触发、展开布局、键盘、减弱动态与窄屏通过 |
| qa-devices.cjs | 四款尺寸、比例、镜头、持久化与旧 i18n 缓存通过 |
| qa-palette.cjs | 11 色、宠物、五语言及双向同步通过 |
| qa-device-status.cjs | 跨日/时区、六小时虚拟运行、充电/飞行模拟、单定时器通过 |
| qa-mobile-status.cjs | 触屏手机横竖屏不加载 3D 或模拟栏；平板键盘不误判通过 |
| qa-original-lazy.cjs | 首开仅一款，四款按需缓存，静止不重绘通过 |

另核验 10 个应用 JS 的语法、四个 GLB 的字节数与 SHA-256 文件名前缀、许可、
生产文件排除规则及本轮差异。两轮未发现尚未处理的阻断发布问题。
本机 Chrome / Edge 与 RTX 4090；弱网/CPU 限速不是低端 GPU 实测，
手机为浏览器模拟，尚未进行 Safari/Firefox 与真实手机硬件验收。

证据保留于 `../3d-local-preview-evidence/milestone-20261016/`，包含修复前
失败记录、修复后结果及线上验收。浏览器均在 finally 关闭。

## 合并、发布与恢复

复用现有工作树，在本地审查分支提交后，以 --ff-only 合并至 3d-phone；
只推送该分支及上述 annotated tag，不强推、不改 main 或 SVG 工作树。
生产项目为 beyondchenlins-projects/lingotrace-palace-ui，项目 ID
`prj_Z2ZGVk1gyekqpZvCqR8Hkz4xsAkc`。一次生产构建，验收同一产物后提升到正式域名，
再将 tag 指向验收的提交。最终 SHA、部署 ID 与 tag 解析结果记录于工作区外证据。

发布前可回滚部署：`dpl_9WK3E2nYZcM7yC6fBuRzRUvuZNBK`。
没有新增 worktree、安装依赖或重建模型；证据预算约 40 MiB。本地依赖、
旧验收证据、未使用的旧灯光参考图及 8877 预览服务继续保留，没有执行清理。

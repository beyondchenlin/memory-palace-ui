# 3d-phone 发布审查 · 2026-10-16

范围：当前 3D 工作区相对 0e8c907 的累计改动，包括原包四款机身、按需加载、
渲染调度、真实 HTML 屏幕、桌面模拟状态栏、主题/宠物、统一顶部工具栏及发布配置。
两轮均由当前代理复核，没有额外代理审查。未修改英语学习业务流程。

## 第一轮：运行时、交互与回退

复核模型下载/解码/编译顺序、过期响应、资源销毁、移动端识别、GPU 休眠、
状态栏定时器、颜色联动及宠物指针操作。原有弱网失败恢复和资源稳定性检查通过。

发现并复现宠物拖动后的窗口收窄问题：1440→600 时宠物仍留在 x=1148，
被页面裁掉而无法再点击。修复拖拽和布局变化后的边界约束，保留用户移动位置。
同时修复逐次小幅移动未累计拖动距离而误触色板、失焦/丢失指针捕获未结束拖拽。

新增 qa-release-review.cjs，覆盖真实鼠标拖动、连续 1px 慢拖、窗口收窄、
边缘、失焦，以及手机隐藏/桌面恢复。最初失败证据保留，不覆盖旧验收资料。

## 第二轮：加载边界与发布内容

复核第一轮修复，并针对初始化中跨断点的竞态新增延迟模型测试。
forceShell=1 下，在首个 GLB 尚未返回时将 1440 缩到 390，旧代码会增加
modeVersion 并废弃已经创建的候选渲染器，最终无 LT_MESH，测试超时。
修复为仅在实际需要新初始化或切换到真实手机时变更版本，并中止过期预取。
同一复现通过；现有手机往返、取消下载和单画布恢复测试也通过。

核对本地资源引用、GLB 文件名 SHA-256 前缀和字节数、10 个应用 JS 的语法、
依赖锁一致性、MIT 许可及 Vercel 排除规则。当前 HDR 在 assets/devices/ 内，
不受旧 assets/lighting/ 排除规则影响。旧灯光 PNG 仅保留本地，加入忽略规则。
静态发布显式跳过 npm 安装和构建，复用已核验的运行文件；不上传测试脚本、
截图、node_modules、环境变量文件或旧模型目录。无需重新导出模型。
发布 dry-run 核对了全部输入（约 3.1 MB）；同时移除历史上误跟踪的
.vercel/anonymous.json 临时部署元数据，不将临时声明信息带入新分支。
保留本地当前项目的 .vercel/project.json，仍由忽略规则排除。

## 验证与证据

已通过：qa-original-resilience.cjs、qa-appearance-stress.cjs、qa-release-review.cjs、
qa-palette.cjs、qa-device-status.cjs、qa-mobile-status.cjs、qa-live-3d.cjs、
qa-3d-pickers.cjs、qa-original-lazy.cjs。覆盖弱网/失败重试/过期响应、24 次缓存切换资源稳定、
11 色与五语言、时钟跨日和六小时模拟、桌面/触屏横竖屏、键盘/指针、
WebGL 不可用与丢失回退、现有学习入口实际点击。

证据目录：../3d-local-preview-evidence/release-3d-phone-review1/ 和
../3d-local-preview-evidence/release-3d-phone-review2/。本机 Chrome、RTX 4090；
CPU/网络限速测试不是低端 GPU 实测。未做 Safari/Firefox 的实际设备验证。
当前两轮未发现尚未处理的阻断发布问题。

## 合并与发布边界

复用 memory-palace-3d 工作树及其依赖。将已审查改动提交至现有修复分支，
从 0e8c907 建立 3d-phone，通过 --ff-only 合并修复分支；远端只推送 3d-phone，
不强推，不合并到 main，不修改 SVG 工作树。

目标团队 team_v5rpr2P5kc6fjCn8oF5Br9Qx，项目 prj_Z2ZGVk1gyekqpZvCqR8Hkz4xsAkc
（lingotrace-palace-ui），正式域名 https://lingotrace-palace-ui.vercel.app/。
发布前目标为 dpl_HmYz3yJCFhrePRzH64ZRggAhRX8b，可用于回滚。
只创建一次生产构建，先检查生产部署，再将同一产物提升到正式域名。
生产结果和最终 SHA 记录在工作区外的发布证据中，避免为记录 SHA 再提交/部署。

未新增工作树、未安装依赖。所有测试浏览器在 finally 关闭；新截图与结果
仅作为外部验收证据保留，本地 8877 预览服务继续运行，没有删除旧资料。

# CHANGELOG - 决策番茄钟

## 版本存档

| 版本 | 文件 | 内容 |
|------|------|------|
| v1.1 | `archives/pomodoro-v1.1.html` | + 时间自定义设置（配置档案系统）+ 音效基础设施 |
| v1.2 | `archives/pomodoro-v1.2.html` | + 木鱼音效系统（ConvolverNode 混响）+ Google Calendar 集成 + AI 辅助 |
| v1.3 | `archives/pomodoro-v1.3.html` | + 产出类型胶囊按钮组 + placeholder 联动 |
| v1.4 | `archives/pomodoro-v1.4.html` | + 轮次选择器（1轮/2轮）+ 蓝色色调优化 |
| v1.5 | `archives/pomodoro-v1.5.html` | + 浏览器通知（阶段完成时桌面弹窗） |
| **v2.0** | `decision-pomodoro/` | 从单 HTML 重构为 Vite + 模块化 JS，继承 v1.5 全部功能 |

### 版本命名对照

| 旧命名 | 新命名 |
|--------|--------|
| pomodoro-v2.html | v1.1 |
| pomodoro-v3.html | v1.2 |
| pomodoro-v4.html | v1.3 |
| pomodoro-v5.html | v1.4 |
| pomodoro-v6.html | v1.5 |
| decision-pomodoro/ (Vite) | **v2.0** |

### 当前文件结构

```
20250611-番茄钟决策系统/
├── decision-pomodoro/            # v2.0 项目（Vite 模块化）
│   ├── index.html
│   ├── package.json
│   ├── public/favicon.svg
│   └── src/
│       ├── main.js
│       ├── timer.js
│       ├── ui.js
│       ├── state.js
│       ├── config.js
│       ├── sound.js
│       ├── storage.js
│       ├── export.js
│       ├── settings.js
│       ├── ai.js
│       └── style.css
├── 启动番茄钟.bat                 # 一键启动 Vite 开发服务器
├── agent-v2.0.md                  # 最新版说明
├── CLAUDE.md                      # 项目说明
├── CHANGELOG.md                   # 本文件
└── archives/                      # v1.x 旧版本存档
    ├── pomodoro-v1.1.html
    ├── pomodoro-v1.2.html
    ├── pomodoro-v1.3.html
    ├── pomodoro-v1.4.html
    ├── pomodoro-v1.5.html
    ├── agent-v1.1.md
    ├── agent-v1.2.md
    ├── agent-v1.3.md
    ├── agent-v1.4.md
    ├── agent-v1.5.md
    └── 启动番茄钟-v1.0.md
```

---

## 2026-06-17：v3.1 胶囊卡瘦身 + R2 按需添加

### 根因诊断
v3.0 体验后发现整页向下拉得太长。问题是结构性的：执行卡 / 复盘卡默认渲染 R1+R2 两段，纵向高度 ≈ 拆分卡的 2 倍；三列因 grid stretch 被拉到等高，拆分阶段时 R2 完全是"未来的事"，纯视觉负担。降字号/padding 治标不治本。

### 关键变化
- **默认 1 轮模式**：`DEFAULT_ROUNDS` 由 2 → 1；默认"经典" profile rounds 由 2 → 1
- **R2 按需添加**：执行卡末尾出现 `+ 添加轮次 2` 按钮 → 一键追加 R2（重建 `PHASE_ORDER` / `PHASES` / phase-indicator / subtitle）；已添加但未进入时变 `− 移除轮次 2`；已进入 R2 后置灰显示 `✓ 已启用 2 轮`
- **`min-height: 380px` → `min-height: 0`**：三列自适应内容，不再硬撑空白
- **产出形式按钮组折叠**：用 `<details>` 包住 4 个类型按钮（默认折叠，summary 显示"📐 产出形式 · 当前: 主结论"），textarea 仍常驻；默认形态减少 ~50px 高度
- **R2 toggle 按钮放在 `.capsule-body` 外**：避开 locked 状态的 `pointer-events: none`，确保拆分阶段也能点

### 文件变化
- `decision-pomodoro/src/config.js`：DEFAULT_ROUNDS / 默认 profile rounds
- `decision-pomodoro/src/cards.js`：`renderExecCard` 改按 `currentRounds` 循环；新增 `addRound2 / removeRound2 / canRemoveRound2 / renderRoundToggle / updateOutputTypeLabel`
- `decision-pomodoro/src/main.js`：`#btnToggleRound2` 事件绑定；默认 profile rounds 改 1
- `decision-pomodoro/src/settings.js`：`applyAndClose` 后调 `renderAllCards / renderRoundToggle`
- `decision-pomodoro/index.html`：执行卡 4 类型按钮包进 `<details>`；R2 默认 hidden；R2 toggle 按钮放卡底（capsule-body 外）
- `decision-pomodoro/src/style.css`：min-height 取消；`.exec-round + .exec-round` 兄弟选择器替代 margin-bottom；新增 `.round-toggle-btn`、`.output-type-details summary` 样式

### 验证
- `vite build` 通过（16 modules transformed，0 错误，1 个动态 import warning 不影响运行）
- 浏览器手动验证待用户使用

---

## 2026-06-17：v3.0 三胶囊卡架构

把原本"同一个 textarea 三阶段共用"的设计拆成 **3 张胶囊卡横向 grid**（拆分 / 执行 / 复盘），解决"切换阶段时上一阶段内容留不留"的死结——已写完的内容不消失，只是从"可编辑"变成"已锁定参考卡"，下一阶段在新卡里写，上一阶段的卡常驻可见。

### UI 变化
- 三张卡横向并列（移动端 < 900px 降级为纵向）
- 当前阶段卡高亮 + 可编辑，已完成卡变 ✓ 状态，未到达卡 locked + 半透明
- 执行卡 / 复盘卡内部纵向堆叠 **轮次 1 / 轮次 2** 小节；1 轮模式下 R2 自动隐藏
- container 最大宽度 600px → 1180px 容纳三列

### 数据模型升级（`session.version = 3`）
- 拆分卡：`{ bigProblem, tasks: [{id, text, criterion}] }`
- 执行卡：`{ rounds: { 1: {checks, outputType, output, stuck}, 2: {...} } }`
- 复盘卡：`{ rounds: { 1: {finding, mistake, nextStep}, 2: {...} } }`
- 拆分任务自动镜像到执行卡的勾选列表 + 复盘卡的只读对照列表
- 旧 v2 历史记录沿用原渲染（前向兼容）

### 各阶段字段重新设计
- **拆分**：今日大问题（一句话）+ 1–3 个小任务（每个带"完成判断标准"），不再要求一段自由产出
- **执行**：勾选完成的任务 + 本轮最小产物（主结论/概念卡/证据表/文段或代码）+ 可选卡住记录
- **复盘**：自动显示本轮完成情况 + 一个发现 + 一个失误 + 下一个番茄钟要做什么（结构化短字段，非大段 textarea）

### AI 按钮分阶段定制
- 拆分卡：「让 AI 帮我拆任务」—— 给出 1–3 个可执行小任务
- 执行卡：「让 AI 帮我聚焦/整理」—— 把草稿整理成更聚焦的产物
- 复盘卡：「让 AI 帮我提炼经验」—— 给出发现/失误/下一步三行建议
- 原全局"AI 建议"按钮移除

### 文件变化
- 新增 `src/cards.js`（约 250 行）：胶囊卡数据模型 + 渲染 + 拆分↔执行同步
- 重写 `index.html` 胶囊卡区
- 重写 `src/main.js` 事件绑定，加入卡级 AI 调用
- 简化 `src/ui.js`（移除旧 outputType 切换）
- 调整 `src/timer.js`：产出校验改用 `currentPhaseHasInput()` / `currentPhaseSnapshot()`
- `src/style.css` 新增 ~250 行胶囊卡样式

### 验证
- `vite build` 通过，15 modules transformed，无错误
- 浏览器手动验证待用户使用

---

## 2026-06-17：迁移至 GitHub 仓库

- 项目代码托管到 GitHub：https://github.com/qingfeng2234/decision-pomodoro（公开仓库）
- 新增项目根 `.gitignore`（排除 `node_modules/`、`dist/`、`.env`、IDE 临时文件等）
- 新增 `README.md` 作为 GitHub 仓库主页说明（项目介绍 + 启动方式 + 技术栈）
- 更新 `CLAUDE.md`：版本管理由"复制目录改名为 vX"改为 git commit + tag 工作流，`archives/` 不再扩充
- 首次 commit 打 tag `v2.0` 作为重构基线

---

## 2026-06-17：新增 `start.bat` 启动脚本并优化启动速度

- 新增 `start.bat`（项目根目录），双击启动 Vite 开发服务器
- **去掉 `npx`**：直接调用本地 `node_modules\.bin\vite.cmd`，省去 npx 解析包路径的开销（约 1–3 秒）
- **并行打开浏览器**：用 `start "" http://localhost:5173/` 在 Vite 启动同时发起浏览器请求，整体启动感受更快
- 原 `启动番茄钟.bat` 保留不动作为回溯基线

---

## 2026-06-16：Vite 模块化重构（v2.0）

从单 HTML 重构为 Vite 项目，功能完全继承 v1.5。

### 结构变化
- **单 HTML → 模块化**：功能按模块拆分至 `src/` 目录（timer、ui、sound…）
- **开发模式**：`npx vite` 启动，热更新
- **生产构建**：`npm run build` 输出 `dist/index.html`

### 功能不变
- 五阶段决策流程（1轮/2轮）
- 防发散机制（强制产出、走神检查、止损）
- 木鱼音效（Web Audio API）
- Google Calendar 集成
- AI 助手（OpenAI 兼容）
- 产出类型胶囊按钮组
- 浏览器通知（Notification API）
- 时间自定义（最多5套配置）

### 批处理文件更新
- `启动番茄钟.bat` 改为 `cd decision-pomodoro → npx vite --open`
- 修复编码问题（GBK 编码写入，CMD 不再乱码）

---

## 2026-06-16：启动番茄钟批处理修复

（同 v1.5，详见 archives）

---

## 2026-06-16：浏览器通知（v1.5）

（详见 archives/agent-v1.5.md）

---

## 2026-06-16：启动番茄钟批处理 + 目录整理

（详见 archives）

---

## 2026-06-15：轮次选择器 + 蓝色色调优化（v1.4）

（内容不变，详见 archives）

---

## 2026-06-15：产出类型胶囊按钮组（v1.3）

（内容不变，详见 archives）

---

## 2026-06-14：四大功能改进（v1.2）

（内容不变，详见 archives）

---

## 2025-06-11：番茄钟决策系统诞生

- 将日历模板升级为交互式网页应用
- 核心创新：把"防发散"机制嵌入到计时流程中
- 单 HTML 文件，零依赖，localStorage 持久化

## 2025-06-10：日历模板先行

- 创建 `.ics` 日历模板用于 Google Calendar 规划决策时间块
- 发现纯日历模板无法解决"执行过程中发散"的问题，推动了番茄钟应用的开发

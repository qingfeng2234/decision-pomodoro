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

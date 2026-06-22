# 决策番茄钟 — 项目说明

## 项目概述

**决策番茄钟**是一个基于网页的专注工具，将经典番茄工作法与结构化决策流程相结合。

- **当前版本**：v2.0（Vite 模块化）
- **技术栈**：Vite + 纯前端（HTML + CSS + JavaScript），零运行时依赖
- **存储方式**：浏览器 localStorage（本地持久化）
- **核心设计理念**："完成大于完美"——先产出最小可行结论，再迭代优化

---

## 启动方式

- **双击 `start.bat`**：自动起 Vite 开发服务器并打开浏览器
- **手动**：`cd decision-pomodoro && npm run dev`
- **构建**：`cd decision-pomodoro && npm run build`，产物在 `dist/`

---

## 版本管理（Git 工作流）

项目已托管在 GitHub：https://github.com/qingfeng2234/decision-pomodoro

**每完成一个功能**：
1. 更新 `CHANGELOG.md` 记录本次变更
2. `git add -A && git commit -m "vX.Y: 简述"`
3. 大版本节点打 tag：`git tag vX.Y && git push --tags`
4. `git push`

**不再用"复制目录改名为 v1/v2"的方式做版本基线**——回溯请用 `git checkout <tag>`。
`archives/` 仅保留 v1.x 单 HTML 历史存档，新版本不再往里塞。

---

## 维护说明

- 修改 `src/` 下的 JS 文件后 Vite 自动热更新，无需手动构建
- 数据备份：F12 → Application → Local Storage → 复制 `pomodoro_YYYY-MM-DD` 键值

---

## Claude Code + Hermes Agent 协作

- Hermes MCP 已连接：可用 `mcp__hermes__channels_list` / `conversations_list` / `messages_read` 读取消息状态
- 构建/PR 完成后可通过 `messages_send` 通知用户
- 项目注册表：`F:\hermess\hermes-home\project-registry.json`
- Hermes 可通过 `claude -p "任务" --add-dir "项目路径" --max-turns 10` 调度 cc

### 协作配置文件位置

```
F:\hermess\
├── .claude\settings.json                   ← 权限（中间层）
├── projects\.mcp.json                      ← MCP 注册
└── hermes-home\
    ├── hermes-mcp-bridge.bat               ← MCP 桥接启动
    └── project-registry.json               ← 项目注册表
```

---

*最后更新：2026-06-20*

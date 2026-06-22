# 🍅 决策番茄钟（Decision Pomodoro）

一个把**经典番茄工作法**与**结构化决策流程**结合的网页端专注工具。

> 设计理念：**完成大于完美**——先产出最小可行结论，再迭代优化。

## 核心特性

- **五阶段流程**：问题拆分 → 执行 → 复盘 → 执行 → 复盘（1 轮或 2 轮可选）
- **防发散机制**：强制每阶段产出、走神检查弹窗、两轮未达标自动止损
- **新想法拦截器**：突发想法即时记录，本轮结束后再处理，避免跳转
- **木鱼音效**：基于 Web Audio API + ConvolverNode 的真实混响
- **浏览器桌面通知**：阶段切换自动弹通知
- **Google Calendar 集成**：读取今日日程并关联到番茄钟 session；支持 OAuth 连接、ICS 导出与 Markdown 导出
- **AI 助手**：可配置 OpenAI 兼容接口，在拆分/复盘阶段给出建议
- **完全本地**：所有数据存浏览器 localStorage，零后端、零隐私外泄

## 技术栈

- 构建：Vite
- 前端：原生 HTML + CSS + JavaScript（零运行时依赖）
- 存储：浏览器 localStorage

## 快速开始

### 双击启动（推荐）

双击根目录的 `start.bat`，自动启动 Vite 开发服务器并打开浏览器。

### 手动启动

```bash
cd decision-pomodoro
npm install         # 首次需安装依赖
npm run dev         # 开发模式（热更新），访问 http://localhost:5173
npm run build       # 构建生产版本到 dist/
```

构建产物为静态文件，可直接部署到任意静态托管（GitHub Pages、Vercel、Netlify 等）。

## 项目结构

```
pomodoro/
├── decision-pomodoro/        # v2.0 主工程（Vite + 模块化 JS）
│   ├── index.html
│   ├── package.json
│   └── src/
│       ├── main.js           # 入口、事件绑定
│       ├── timer.js          # 番茄钟核心逻辑
│       ├── ui.js             # 阶段切换、DOM 更新
│       ├── state.js          # 全局状态
│       ├── config.js         # 配置档案
│       ├── sound.js          # 木鱼音效
│       ├── storage.js        # localStorage 持久化
│       ├── export.js         # ICS / Markdown 导出
│       ├── settings.js       # 设置面板
│       ├── ai.js             # AI 助手
│       ├── calendar.js       # Google Calendar OAuth + 日程读取
│       └── style.css
├── archives/                 # v1.x 旧版本存档（单 HTML）
├── start.bat                 # 一键启动脚本
├── CHANGELOG.md              # 版本变更记录
└── CLAUDE.md                 # AI agent 工作约定
```

## Google Calendar 集成配置

1. 去 [Google Cloud Console](https://console.cloud.google.com) 创建项目
2. 启用 **Google Calendar API**
3. 创建 **OAuth 2.0 Client ID**（应用类型：Web 应用）
4. 把 `http://localhost:5173` 加到 **Authorized JavaScript origins**
5. 在 OAuth 同意屏幕 (Consent Screen) 里把自己的 Gmail 加入 **测试用户**
6. 在番茄钟里点击「连接」→ 填入上面的 Client ID → 完成授权

成功后即可在面板中看到今日日程，点击日程即关联到当前番茄钟 session。

## 数据备份

浏览器按 F12 → Application → Local Storage → 复制 `pomodoro_YYYY-MM-DD` 键值即可备份单日记录。

## 版本

当前版本 **v3.4**，详见 [CHANGELOG.md](./CHANGELOG.md)。

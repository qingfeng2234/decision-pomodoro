# CSS 设计令牌地基重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `decision-pomodoro/src/style.css` 中重复的颜色/圆角/阴影/过渡字面量抽成 `:root` CSS 设计令牌，渲染结果逐像素不变。

**Architecture:** 在 `style.css` 顶部新增 `:root {}` 令牌块；随后将文件中等于令牌值的字面量按值全局替换为 `var(--…)`。CSS 变量是值的别名，计算结果不变 → 外观一致。分批替换（中性色 → 品牌/强调色 → 状态色 → 圆角/阴影），每批独立构建 + 肉眼核对 + 提交。

**Tech Stack:** 纯 CSS（CSS Custom Properties / 自定义属性）；Vite 8 构建；无测试框架。

## Global Constraints

- 仅修改 `decision-pomodoro/src/style.css`；不动 HTML / JS / 布局 / `@media` 媒体查询。
- 每个替换必须 1:1 等值映射（令牌值 === 被替换的原字面量）。
- 渲染结果**逐像素不变**——这是验收硬标准。
- 按"值"全局替换 hex（同一 hex 无论出现在什么角色，值相同 → 替换后外观必然不变）。
- **`white` / `#fff` 关键字本次不令牌化**（surface-白 与 文字-白 的区分留给后续深色模式那一轮处理）；`--c-bg` 令牌先定义、本轮不使用。
- 保留字面量（不抽取，文末"保留清单"列明）：一次性 / 局部装饰色。
- 无测试框架，每个任务的"测试"= `npm run build` 通过 + 肉眼对照界面无变化。
- 提交信息用中文，遵循项目 `vX.Y: 简述` 之外的 `style:` 习惯亦可。

---

### Task 1: 新增 `:root` 设计令牌块

**Files:**
- Modify: `decision-pomodoro/src/style.css`（在文件最顶部、`* {}` 之前插入）

**Interfaces:**
- Produces: 下列 CSS 自定义属性，供后续所有任务以 `var(--…)` 引用。

- [ ] **Step 1: 在 `style.css` 顶部插入 `:root` 块**

在文件第 1 行之前插入（完整、逐字）：

```css
:root {
  /* 品牌（主紫） */
  --c-brand: #667eea;
  --c-brand-strong: #5a6fd6;        /* 主按钮 hover */
  --c-brand-deep: #764ba2;          /* 渐变末端 */
  --c-brand-tint: #f0f4ff;          /* 浅品牌底（AI 框 / 悬停） */
  --c-brand-tint-strong: #e0eaff;
  --c-brand-tint-border: #c5d0f5;

  /* 蓝色强调（产出类型按钮 / 日程选中） */
  --c-accent: #4a8fe7;
  --c-accent-strong: #3a6fd8;
  --c-accent-ink: #4a6fa5;
  --c-accent-border: #bcd4f0;
  --c-accent-tint: #eaf2fd;

  /* 次要按钮（蓝灰） */
  --c-secondary: #5a7fa0;
  --c-secondary-strong: #4c6e8c;

  /* 文字 */
  --c-ink: #1e3a5f;
  --c-muted: #5c7a9a;
  --c-faint: #94a8be;

  /* 背景 / 面 / 线 */
  --c-bg: #ffffff;                  /* 本轮不使用，留给深色模式 */
  --c-surface: #f8f9fa;
  --c-surface-2: #e9ecef;
  --c-surface-3: #eef1f6;
  --c-border: #c8d6e5;
  --c-border-soft: #e0e6ef;
  --c-border-dashed: #d4dbe6;

  /* 状态 */
  --c-success: #28a745; --c-success-strong: #218838; --c-success-bg: #d4edda; --c-success-ink: #155724;
  --c-danger:  #ff6b6b; --c-danger-strong:  #ff5252; --c-danger-bg:  #f8d7da; --c-danger-ink:  #721c24;
  --c-warning: #ffc107; --c-warning-strong: #e0a800; --c-warning-bg: #fff3cd; --c-warning-ink: #856404; --c-warning-border: #ffeaa7;
  --c-info-bg: #d1ecf1; --c-info-ink: #0c5460;

  /* 圆角 */
  --r-sm: 6px; --r-md: 8px; --r-lg: 10px; --r-xl: 12px; --r-2xl: 16px; --r-3xl: 20px;

  /* 阴影 / 蒙层 / 过渡 */
  --shadow-card: 0 6px 24px rgba(102,126,234,.18);
  --shadow-lg:   0 20px 60px rgba(0,0,0,.3);
  --shadow-btn:  0 2px 8px rgba(74,143,231,.35);
  --overlay:     rgba(0,0,0,.5);
  --transition:  .2s;
}
```

- [ ] **Step 2: 构建验证**

Run: `cd decision-pomodoro; npm run build`
Expected: 构建成功（`✓ built in …`），无报错。

- [ ] **Step 3: 视觉验证**

Run: `cd decision-pomodoro; npm run dev`，浏览器打开 http://localhost:5173/
Expected: 界面与改动前**完全一致**（此时令牌已定义但尚未被引用，理论上不可能有任何变化）。

- [ ] **Step 4: 提交**

```bash
git add decision-pomodoro/src/style.css
git commit -m "style: 新增 :root CSS 设计令牌块（暂未引用）"
```

---

### Task 2: 替换中性色（文字 / 面 / 线）

**Files:**
- Modify: `decision-pomodoro/src/style.css`

**Interfaces:**
- Consumes: Task 1 定义的 `--c-ink/--c-muted/--c-faint/--c-surface/--c-surface-2/--c-surface-3/--c-border/--c-border-soft/--c-border-dashed`

- [ ] **Step 1: 按值全局替换（区分大小写，整段 hex）**

对每一项，在 `style.css` 中把**所有**出现的左值替换为右值（编辑器"全部替换" / replace_all）：

```
#1e3a5f  → var(--c-ink)
#5c7a9a  → var(--c-muted)
#94a8be  → var(--c-faint)
#f8f9fa  → var(--c-surface)
#e9ecef  → var(--c-surface-2)
#eef1f6  → var(--c-surface-3)
#c8d6e5  → var(--c-border)
#e0e6ef  → var(--c-border-soft)
#d4dbe6  → var(--c-border-dashed)
```

注意：**不要**替换 `:root` 块内 Task 1 写下的定义行（那里必须保留原始 hex）。只替换令牌定义之外的使用处。

- [ ] **Step 2: 构建验证**

Run: `cd decision-pomodoro; npm run build`
Expected: 构建成功，无报错。

- [ ] **Step 3: 残留核对**

Run: `Select-String -Path decision-pomodoro\src\style.css -Pattern '#1e3a5f|#5c7a9a|#94a8be|#f8f9fa|#e9ecef|#eef1f6|#c8d6e5|#e0e6ef|#d4dbe6'`
Expected: 只在 `:root` 定义行命中（每个值 1 处）；其余使用处已全部变成 `var(...)`。

- [ ] **Step 4: 视觉验证**

dev server 页面与改动前一致：重点扫文字颜色、卡片浅灰底、各处边框、进度条底色。

- [ ] **Step 5: 提交**

```bash
git add decision-pomodoro/src/style.css
git commit -m "style: 中性色（文字/面/线）改用设计令牌"
```

---

### Task 3: 替换品牌色 / 蓝色强调 / 次要按钮色

**Files:**
- Modify: `decision-pomodoro/src/style.css`

**Interfaces:**
- Consumes: Task 1 的 `--c-brand*`、`--c-accent*`、`--c-secondary*`

- [ ] **Step 1: 按值全局替换（不含 `:root` 定义行）**

```
#667eea  → var(--c-brand)
#5a6fd6  → var(--c-brand-strong)
#764ba2  → var(--c-brand-deep)
#f0f4ff  → var(--c-brand-tint)
#e0eaff  → var(--c-brand-tint-strong)
#c5d0f5  → var(--c-brand-tint-border)
#4a8fe7  → var(--c-accent)
#3a6fd8  → var(--c-accent-strong)
#4a6fa5  → var(--c-accent-ink)
#bcd4f0  → var(--c-accent-border)
#eaf2fd  → var(--c-accent-tint)
#5a7fa0  → var(--c-secondary)
#4c6e8c  → var(--c-secondary-strong)
```

注意 1：`#667eea` 也出现在 `--shadow-card` 的 `rgba(102,126,234,…)` 里——那是 rgb 数字形式，不是 `#667eea`，不受 hex 替换影响，保持不动（已由 `--shadow-card` 令牌承载）。
注意 2：渐变写法如 `linear-gradient(135deg, #667eea 0%, #764ba2 100%)` 中的 hex 同样按上表替换为 `var(--c-brand)` / `var(--c-brand-deep)`，`var()` 在 `linear-gradient` 内合法。

- [ ] **Step 2: 构建验证**

Run: `cd decision-pomodoro; npm run build`
Expected: 构建成功。

- [ ] **Step 3: 残留核对**

Run: `Select-String -Path decision-pomodoro\src\style.css -Pattern '#667eea|#5a6fd6|#764ba2|#f0f4ff|#e0eaff|#c5d0f5|#4a8fe7|#3a6fd8|#4a6fa5|#bcd4f0|#eaf2fd|#5a7fa0|#4c6e8c'`
Expected: 只在 `:root` 定义行命中。

- [ ] **Step 4: 视觉验证**

重点扫：主按钮（紫）、次要按钮（蓝灰）、产出类型按钮（默认/悬停/选中三态）、AI 建议框与 AI 按钮、body 紫色渐变背景、进度条渐变、胶囊卡 active 边框、GCal 事件悬停/选中。

- [ ] **Step 5: 提交**

```bash
git add decision-pomodoro/src/style.css
git commit -m "style: 品牌/强调/次要按钮色改用设计令牌"
```

---

### Task 4: 替换状态色（成功 / 危险 / 警告 / 信息）

**Files:**
- Modify: `decision-pomodoro/src/style.css`

**Interfaces:**
- Consumes: Task 1 的 `--c-success*`、`--c-danger*`、`--c-warning*`、`--c-info*`

- [ ] **Step 1: 按值全局替换（不含 `:root` 定义行）**

```
#28a745  → var(--c-success)
#218838  → var(--c-success-strong)
#d4edda  → var(--c-success-bg)
#155724  → var(--c-success-ink)
#ff6b6b  → var(--c-danger)
#ff5252  → var(--c-danger-strong)
#f8d7da  → var(--c-danger-bg)
#721c24  → var(--c-danger-ink)
#ffc107  → var(--c-warning)
#e0a800  → var(--c-warning-strong)
#fff3cd  → var(--c-warning-bg)
#856404  → var(--c-warning-ink)
#ffeaa7  → var(--c-warning-border)
#d1ecf1  → var(--c-info-bg)
#0c5460  → var(--c-info-ink)
```

注意：`#fff3cd`/`#856404`/`#ffeaa7` 同时被"想法拦截器"（琥珀色块）使用——同值替换，外观不变，符合预期。

- [ ] **Step 2: 构建验证**

Run: `cd decision-pomodoro; npm run build`
Expected: 构建成功。

- [ ] **Step 3: 残留核对**

Run: `Select-String -Path decision-pomodoro\src\style.css -Pattern '#28a745|#218838|#d4edda|#155724|#ff6b6b|#ff5252|#f8d7da|#721c24|#ffc107|#e0a800|#fff3cd|#856404|#ffeaa7|#d1ecf1|#0c5460'`
Expected: 只在 `:root` 定义行命中。

- [ ] **Step 4: 视觉验证**

重点扫：四种状态条（info 蓝 / success 绿 / warning 黄 / danger 红）、成功/危险/警告按钮三态、想法拦截器琥珀色块、危险类删除按钮（task-remove 红字）。

- [ ] **Step 5: 提交**

```bash
git add decision-pomodoro/src/style.css
git commit -m "style: 状态色改用设计令牌"
```

---

### Task 5: 替换圆角 / 阴影 / 蒙层 / 过渡

**Files:**
- Modify: `decision-pomodoro/src/style.css`

**Interfaces:**
- Consumes: Task 1 的 `--r-*`、`--shadow-*`、`--overlay`、`--transition`

- [ ] **Step 1: 替换阴影 / 蒙层（按值全局替换，不含 `:root` 定义行）**

```
0 20px 60px rgba(0,0,0,0.3)            → var(--shadow-lg)
0 6px 24px rgba(102, 126, 234, 0.18)  → var(--shadow-card)
0 2px 8px rgba(74, 143, 231, 0.35)    → var(--shadow-btn)
rgba(0,0,0,0.5)                       → var(--overlay)
```

注意：源文件 rgba 可能带空格（如 `rgba(102, 126, 234, 0.18)`）。替换前用查找确认实际写法，按实际字符串整体替换为对应 `var(...)`。若某阴影写法与令牌定义的紧凑形式不一致，以源文件实际字符串为准做整体替换。

- [ ] **Step 2: 替换圆角（仅替换有令牌对应的值；零散一次性值保留）**

```
border-radius: 6px   → border-radius: var(--r-sm)
border-radius: 8px   → border-radius: var(--r-md)
border-radius: 10px  → border-radius: var(--r-lg)
border-radius: 12px  → border-radius: var(--r-xl)
border-radius: 16px  → border-radius: var(--r-2xl)
border-radius: 20px  → border-radius: var(--r-3xl)
```

保留字面量（无令牌、出现少）：`border-radius: 4px` / `5px` / `7px` / `14px` 及 `border-radius: 50%`（圆形）保持不动。

注意：以 `border-radius: ` 前缀整体匹配，避免误伤 `4px` 这类出现在 padding/margin 里的同名数值。

- [ ] **Step 3: 替换过渡时长 `0.2s`（仅 transition 上下文）**

只替换 `transition` 简写里独立的 `0.2s` 时长为 `var(--transition)`，例如：
`transition: all 0.2s;` → `transition: all var(--transition);`
`transition: background 0.15s;` 等非 0.2s 的保持不动（`0.15s`/`0.3s`/`1s` 无令牌，保留）。
注意：逐处确认是 `transition` 属性里的时长，勿替换动画/其它处的 `0.2s`（本文件 `pulse` 动画无 0.2s，风险低，仍需确认）。

- [ ] **Step 4: 构建验证**

Run: `cd decision-pomodoro; npm run build`
Expected: 构建成功。

- [ ] **Step 5: 视觉验证**

重点扫：所有卡片/按钮/输入框圆角弧度不变；容器大阴影；胶囊卡 active 阴影；产出类型选中按钮阴影；弹窗蒙层半透明黑；按钮 hover 过渡手感不变。

- [ ] **Step 6: 提交**

```bash
git add decision-pomodoro/src/style.css
git commit -m "style: 圆角/阴影/蒙层/过渡改用设计令牌"
```

---

### Task 6: 最终核对与保留清单确认

**Files:**
- Read only: `decision-pomodoro/src/style.css`（如发现遗漏才修改并提交）

- [ ] **Step 1: 扫描全部残留 hex**

Run: `Select-String -Path decision-pomodoro\src\style.css -Pattern '#[0-9a-fA-F]{3,8}' -AllMatches`
Expected: 命中项应**仅限**以下两类：
1. `:root {}` 内的令牌定义行；
2. 下列"保留清单"中的一次性 / 局部色。

**保留清单（预期仍为字面量，属正常）：**
- 音量滑块：`#2d9c8f`（轨道）、`#e0b44c`（滑块）
- 近白悬停底：`#f8f9ff`（icon-btn / modal-btn hover）
- GCal 局部：`#e1e8f0`（gcal 边框）、`#e8f0ff`/`#eef4ff`（选中/全天底）、`#4a7be0`（选中边框）、`#16a34a`（已连接绿）
- 想法清空按钮 hover：`#fff8e0`、`#d4a017`
- 轮次移除态（remove-mode）：`#d9534f`、`#e8b4b4`、`#fdf2f2`
- 任务标准输入底色：`#fafbfc`（`.task-item .task-criterion`，一次性，无对应令牌）
- 关键字 `white` / `#fff`（本轮按约束不令牌化）

若出现**不在**上述两类中的残留 hex（说明某任务漏替换）→ 回到对应任务补替换、重建、重新视觉核对后提交。

- [ ] **Step 2: 全量视觉回归**

dev server 逐屏对照（可与改动前截图比对）：头部图标栏、阶段指示条、计时器区、三张胶囊卡全部状态、想法拦截器、底部操作按钮、历史记录区、所有弹窗（卡住/专注/止损/时间到/导出/设置/AI 配置）、GCal 连接区与事件列表。
Expected: 与改动前**逐像素一致**。

- [ ] **Step 3: 更新 CHANGELOG**

在 `CHANGELOG.md` 顶部加一条（参考既有格式）：
```
## 2026-06-23：vX.Y CSS 设计令牌地基
### 改动
- style.css 抽出 :root 设计令牌（颜色/圆角/阴影/过渡），逐像素不变，为深色模式铺路
```

```bash
git add CHANGELOG.md
git commit -m "docs: CHANGELOG 记录 CSS 设计令牌重构"
```

---

## Self-Review

**1. Spec coverage（逐条对照 spec）：**
- `:root` 令牌块（颜色/圆角/阴影/过渡）→ Task 1 ✓
- 1:1 字面量替换 → Task 2–5 ✓
- 逐像素不变 → 每任务的视觉验证步 + Task 6 全量回归 ✓
- 保留一次性字面量 → Task 6 保留清单 ✓
- 不动 HTML/JS/布局/@media → Global Constraints ✓
- 验证（build + 视觉 + 自查残留）→ 各任务 Step + Task 6 ✓
- 后续深色模式只覆盖 `:root` → 令牌均语义命名、集中定义 ✓（`white`/`#fff` 与 `--c-bg` 的衔接已在约束中说明留待深色模式轮次）

**2. Placeholder scan：** 无 TBD/TODO；所有替换给出确切 hex→var 映射与确切命令；保留清单逐项列明。✓

**3. Type/命名一致性：** 令牌名在 Task 1 定义、Task 2–5 引用，逐一对应（如 `--c-ink`、`--c-accent-tint`、`--r-3xl`、`--shadow-card`），无错名。✓

> 已知偏差（有意）：`--c-bg` 在本轮定义但不引用（深色模式轮次启用）；`white`/`#fff` 保留字面量。两者均在 Global Constraints 与保留清单中显式说明，非遗漏。

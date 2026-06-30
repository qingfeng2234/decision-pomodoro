# CSS 设计令牌地基重构 — 执行报告

**日期：** 2026-06-23
**计划：** `docs/superpowers/plans/2026-06-23-css-design-tokens.md`
**目标文件：** `decision-pomodoro/src/style.css`（+ Task 6 的 `CHANGELOG.md`）
**基线：** `e1c3d6b`
**最终 HEAD：** `177105e`
**提交范围：** `e1c3d6b..177105e`（6 次提交）

> 视觉验证说明：本次执行在无浏览器环境下完成，**无法做逐像素肉眼核对**。每个任务的验证 = `npm run build` 通过 + 残留 grep 核对。逐像素视觉回归留给人工。每个 hex/字符串替换均为 1:1 等值映射，理论上渲染结果不变。

---

## Task 1 — 新增 :root 设计令牌块

- **替换内容：** 在文件最顶部（`* {}` 之前）插入完整 `:root {}` 令牌块（51 行），逐字按计划。此时令牌已定义但尚未被引用。
- **构建结果：** `✓ built in 94ms`，仅有预期内的 `INEFFECTIVE_DYNAMIC_IMPORT`（ui.js）警告。
- **残留 grep：** 不适用（本任务只新增定义）。
- **提交哈希：** `d743edf` — `style: 新增 :root CSS 设计令牌块（暂未引用）`（1 file changed, 51 insertions）

---

## Task 2 — 中性色（文字 / 面 / 线）

- **替换内容（9 项，全局 replace_all，仅使用处）：**
  - `#1e3a5f → var(--c-ink)`
  - `#5c7a9a → var(--c-muted)`
  - `#94a8be → var(--c-faint)`
  - `#f8f9fa → var(--c-surface)`
  - `#e9ecef → var(--c-surface-2)`
  - `#eef1f6 → var(--c-surface-3)`
  - `#c8d6e5 → var(--c-border)`
  - `#e0e6ef → var(--c-border-soft)`
  - `#d4dbe6 → var(--c-border-dashed)`
  - replace_all 同时改写了 :root 的 9 行定义；随后将这 9 行定义恢复为原始 hex（定义行必须保留 raw hex）。
- **构建结果：** `✓ built in 92ms`，无错误。
- **残留 grep：** `#1e3a5f|#5c7a9a|#94a8be|#f8f9fa|#e9ecef|#eef1f6|#c8d6e5|#e0e6ef|#d4dbe6` → 仅命中 :root 定义行（行 22–33，每值 1 处），使用处全部已变 `var(...)`。✓
- **提交哈希：** `1d91726` — `style: 中性色（文字/面/线）改用设计令牌`

---

## Task 3 — 品牌色 / 蓝色强调 / 次要按钮色

- **替换内容（13 项，全局 replace_all，仅使用处）：**
  - `#667eea → var(--c-brand)`
  - `#5a6fd6 → var(--c-brand-strong)`
  - `#764ba2 → var(--c-brand-deep)`
  - `#f0f4ff → var(--c-brand-tint)`
  - `#e0eaff → var(--c-brand-tint-strong)`
  - `#c5d0f5 → var(--c-brand-tint-border)`
  - `#4a8fe7 → var(--c-accent)`
  - `#3a6fd8 → var(--c-accent-strong)`
  - `#4a6fa5 → var(--c-accent-ink)`
  - `#bcd4f0 → var(--c-accent-border)`
  - `#eaf2fd → var(--c-accent-tint)`
  - `#5a7fa0 → var(--c-secondary)`
  - `#4c6e8c → var(--c-secondary-strong)`
  - 渐变（`linear-gradient(135deg, #667eea 0%, #764ba2 100%)`、`linear-gradient(90deg, ...)`、`linear-gradient(135deg, #4a8fe7, #3a6fd8)`）内的 hex 也按值替换为 `var(...)`，合法。
  - `--shadow-card` 内的 `rgba(102,126,234,…)` 为 rgb 数字形式，不是 `#667eea`，未受影响（符合计划注 1）。
  - replace_all 同时改写了 :root 的品牌/强调/次要 17 行定义；随后恢复为原始 hex。
- **构建结果：** `✓ built in 103ms`，无错误。
- **残留 grep：** 13 个 hex 仅命中 :root 定义行（行 3–8、11–15、18–19）。✓
- **提交哈希：** `944953a` — `style: 品牌/强调/次要按钮色改用设计令牌`

---

## Task 4 — 状态色（成功 / 危险 / 警告 / 信息）

- **替换内容（15 项，全局 replace_all，仅使用处）：**
  - `#28a745 → var(--c-success)` / `#218838 → var(--c-success-strong)` / `#d4edda → var(--c-success-bg)` / `#155724 → var(--c-success-ink)`
  - `#ff6b6b → var(--c-danger)` / `#ff5252 → var(--c-danger-strong)` / `#f8d7da → var(--c-danger-bg)` / `#721c24 → var(--c-danger-ink)`
  - `#ffc107 → var(--c-warning)` / `#e0a800 → var(--c-warning-strong)` / `#fff3cd → var(--c-warning-bg)` / `#856404 → var(--c-warning-ink)` / `#ffeaa7 → var(--c-warning-border)`
  - `#d1ecf1 → var(--c-info-bg)` / `#0c5460 → var(--c-info-ink)`
  - `#fff3cd`/`#856404`/`#ffeaa7` 同时被"想法拦截器"琥珀色块使用 —— 同值替换，外观不变（符合计划注）。
  - replace_all 同时改写了 :root 的 4 行状态定义（行 36–39）；随后恢复为原始 hex。
- **构建结果：** `✓ built in 95ms`，无错误。
- **残留 grep：** 15 个 hex 仅命中 :root 定义行（行 36–39）。✓
- **提交哈希：** `0c1c5e6` — `style: 状态色改用设计令牌`
  - 注：commit 命令在 PowerShell 下报 exit 255（原生命令调用怪癖），但 git 实际提交成功（`[main 0c1c5e6]`），随后 `git log` 确认，工作树干净。

---

## Task 5 — 圆角 / 阴影 / 蒙层 / 过渡

### Step 1 — 阴影 / 蒙层（按文件实际字符串整体替换）
源文件实际写法（带空格，与 :root 紧凑定义不同，故只命中使用处）：
- `box-shadow: 0 20px 60px rgba(0,0,0,0.3);` → `box-shadow: var(--shadow-lg);`（行 71）
- `box-shadow: 0 2px 8px rgba(74, 143, 231, 0.35);` → `box-shadow: var(--shadow-btn);`（行 213）
- `box-shadow: 0 6px 24px rgba(102, 126, 234, 0.18);` → `box-shadow: var(--shadow-card);`（行 665）
- `background: rgba(0,0,0,0.5);` → `background: var(--overlay);`（行 366）

### Step 2 — 圆角（仅 6 个有令牌的尺寸）
- `border-radius: 6px → var(--r-sm)` / `8px → var(--r-md)` / `10px → var(--r-lg)` / `12px → var(--r-xl)` / `16px → var(--r-2xl)` / `20px → var(--r-3xl)`
- 保留字面量（无令牌，未动）：`4px`（行 155/163/613）、`50%`（行 624/633）、`14px`（行 654/909）、`7px`（行 733/764/803/820/917/946）、`5px`（行 780）。

### Step 3 — 过渡时长 0.2s
- 全文件 6 处 `0.2s` 全部位于 `transition:` 属性内（行 198/305/412/510/659/922），无动画里的 0.2s。`0.2s → var(--transition)`。
- 行 659 `transition: opacity 0.2s, border-color 0.2s;` 两处 0.2s 均替换为 `var(--transition)`。
- `0.15s`/`0.3s`/`1s`（width 1s linear）无令牌，保留不动。

- **构建结果：** `✓ built in 92ms`，无错误。
- **残留 grep：**
  - 阴影字符串 → 仅命中 :root 定义行（紧凑形式 `.18/.3/.35`），使用处全部已变 `var(...)`。✓
  - 6 个令牌化圆角 `border-radius: (6px|8px|10px|12px|16px|20px);` → 使用处 0 残留。✓
  - `0.2s` → 0 残留。✓
  - 保留圆角（4px/5px/7px/14px/50%）→ 全部完好为字面量。✓
- **提交哈希：** `5675328` — `style: 圆角/阴影/蒙层/过渡改用设计令牌`

---

## Task 6 — 最终核对 + CHANGELOG

- **全量 hex 扫描：** `#[0-9a-fA-F]{3,8}` 命中分两类（见下方完整清单）。
- **CHANGELOG：** 在顶部新增 `## 2026-06-23：v3.6 CSS 设计令牌地基` 一条（参考既有格式）。
- **构建结果：** Task 5 构建已通过；Task 6 仅改 CHANGELOG（非 CSS），不影响构建。
- **提交哈希：** `177105e` — `docs: CHANGELOG 记录 CSS 设计令牌重构`
  - 注：git 提示 `LF will be replaced by CRLF`（CHANGELOG.md 行尾），属正常 Windows 行尾警告，不影响提交。

---

## 最终：style.css 中所有残留 hex 分类清单

### 第一类：:root 令牌定义行（必须保留 raw hex，正常）
行 3–39，共 37 个令牌定义 hex + `#ffffff`（--c-bg）：

| 行 | hex | 令牌 |
|----|-----|------|
| 3 | #667eea | --c-brand |
| 4 | #5a6fd6 | --c-brand-strong |
| 5 | #764ba2 | --c-brand-deep |
| 6 | #f0f4ff | --c-brand-tint |
| 7 | #e0eaff | --c-brand-tint-strong |
| 8 | #c5d0f5 | --c-brand-tint-border |
| 11 | #4a8fe7 | --c-accent |
| 12 | #3a6fd8 | --c-accent-strong |
| 13 | #4a6fa5 | --c-accent-ink |
| 14 | #bcd4f0 | --c-accent-border |
| 15 | #eaf2fd | --c-accent-tint |
| 18 | #5a7fa0 | --c-secondary |
| 19 | #4c6e8c | --c-secondary-strong |
| 22 | #1e3a5f | --c-ink |
| 23 | #5c7a9a | --c-muted |
| 24 | #94a8be | --c-faint |
| 27 | #ffffff | --c-bg（本轮定义未使用，留给深色模式） |
| 28 | #f8f9fa | --c-surface |
| 29 | #e9ecef | --c-surface-2 |
| 30 | #eef1f6 | --c-surface-3 |
| 31 | #c8d6e5 | --c-border |
| 32 | #e0e6ef | --c-border-soft |
| 33 | #d4dbe6 | --c-border-dashed |
| 36 | #28a745 / #218838 / #d4edda / #155724 | --c-success* |
| 37 | #ff6b6b / #ff5252 / #f8d7da / #721c24 | --c-danger* |
| 38 | #ffc107 / #e0a800 / #fff3cd / #856404 / #ffeaa7 | --c-warning* |
| 39 | #d1ecf1 / #0c5460 | --c-info* |

### 第二类：保留清单（预期仍为字面量，正常）

| 行 | hex | 保留清单项 |
|----|-----|-----------|
| 418 | #f8f9ff | 近白悬停底（icon-btn / modal-btn hover）✓ |
| 516 | #f8f9ff | 近白悬停底 ✓ |
| 612 | #2d9c8f | 音量滑块轨道 ✓ |
| 623 | #e0b44c | 音量滑块滑块 ✓ |
| 632 | #e0b44c | 音量滑块滑块 ✓ |
| 961 | #d9534f | 轮次移除态 remove-mode ✓ |
| 962 | #e8b4b4 | 轮次移除态 remove-mode ✓ |
| 966 | #fdf2f2 | 轮次移除态 remove-mode ✓ |
| 967 | #d9534f | 轮次移除态 remove-mode ✓ |
| 988 | #fff8e0 | 想法清空按钮 hover ✓ |
| 989 | #d4a017 | 想法清空按钮 hover ✓ |
| 1035 | #e1e8f0 | GCal 边框 ✓ |
| 1054 | #16a34a | GCal 已连接绿 ✓ |
| 1075 | #fff | 关键字 white/#fff（本轮按约束不令牌化）✓ |
| 1076 | #e1e8f0 | GCal 边框 ✓ |
| 1120 | #4a7be0 | GCal 选中边框 ✓ |
| 1121 | #e8f0ff | GCal 选中底 ✓ |
| 1125 | #eef4ff | GCal 全天底 ✓ |

### ⚠ 第三类：FLAG — 既非 :root 定义、也不在保留清单的残留 hex

| 行 | hex | 上下文 | 说明 |
|----|-----|--------|------|
| 787 | #fafbfc | `.task-item .task-criterion { background: #fafbfc; }` | **不在任何 Task（2–5）的替换列表里，也未列入 Task 6 保留清单。** |

**关于 `#fafbfc` 的判定：**
- 这是**原始文件就存在的字面量**（改前位于 `.task-item .task-criterion`，与 `color: #5c7a9a; background: #fafbfc;` 同行）。
- 计划的 Task 2–5 替换映射表中**从未包含** `#fafbfc`，:root 也**没有任何令牌**等于该值。因此它**不是漏替换**——没有任何任务把它指派给某个令牌，按"按值 1:1 等值替换"原则它本就该保持字面量。
- 但它也**未被写入 Task 6 的保留清单**，属于计划在编写时对保留清单的一处遗漏。
- **当前处理：保持原样不动**（正确：渲染逐像素不变；若强行令牌化反而要新增一个本轮范围外的令牌）。
- **建议：** 后续若做深色模式那一轮，把 `#fafbfc`（近白行内底）一并纳入面/底令牌体系（如新增 `--c-surface-faint` 或归入 `--c-bg` 系列），并补进保留/令牌清单。

除此一项外，所有残留 hex 均落入前两类，无其它漏替换。

---

## 总结

- 6 个任务全部按计划执行，6 次提交一一对应（`e1c3d6b..177105e`）。
- 每个颜色任务后已确认 :root 定义行保留 raw hex（replace_all 误改后即时恢复）。
- 全部构建通过（`✓ built in …`），仅预期内的 ui.js 动态导入警告。
- 仅一处需 FLAG：`#fafbfc`（行 787），为原始一次性字面量，非漏替换，但未被列入保留清单——已保持原样并给出后续建议。
- **逐像素视觉回归未做（无浏览器），留待人工核对。**

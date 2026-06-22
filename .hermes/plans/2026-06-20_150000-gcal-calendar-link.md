# Google Calendar 日程关联 — 实施计划

> **For 执行者（CC/Hermes）：** 按 Task 顺序逐一实施，每完成一个 Task 提交一次 commit。

**目标：** 让决策番茄钟能读取用户 Google Calendar 今日日程，并将每轮番茄钟产出关联到对应的日程事件。

**现状：** 目前只有「导出到 GCal」（打开预填 URL / 下载 .ics），完全不能读取日历。

**技术栈：** Vite + 纯前端（Vanilla JS）、Google Identity Services (GIS) OAuth 2.0、Google Calendar API v3

**MVP 原则：** 先做「读取今天日程 + 手动关联」，不做自动匹配、不做多日视图、不做推送。关联信息先存 localStorage，后续再考虑同步。

**架构：** 纯前端项目（无后端），使用 GIS Token 流获取 access_token → 通过 userinfo endpoint 拿用户邮箱 → 手动 fetch Calendar API → 事件列表在 UI 中以可折叠面板展示 → 用户选择关联 → 关联信息存入 session 数据模型。

---

## 前置准备（需要用户操作）

1. 去 [Google Cloud Console](https://console.google.com) 创建项目
2. 启用 **Google Calendar API**（仅此一项即可，userinfo endpoint 无需单独启用）
3. 创建 **OAuth 2.0 Client ID**（应用类型：Web 应用；添加 `http://localhost:5173` 到 Authorized JavaScript origins）
4. 拿到 Client ID 填入番茄钟的配置页面中

---

## Task 1: 添加 GCal 配置 UI + OAuth 连接

**Objective:** 在配置弹窗中新增 Google Calendar 连接区域，用户填入 Client ID 后触发 OAuth 授权。

**Files:**
- Modify: `decision-pomodoro/src/config.js`（新增常量）
- Modify: `decision-pomodoro/index.html`（新增 GCal 配置区）
- Modify: `decision-pomodoro/src/main.js`（绑定事件）
- Create: `decision-pomodoro/src/calendar.js`（GCal 模块）

### Step 1: 添加常量

`decision-pomodoro/src/config.js`，在 `VOLUME_PREF_KEY` 后追加：

```js
export const GCAL_CONFIG_KEY = 'pomodoro_gcal_config';
```

### Step 2: 创建 calendar.js

`decision-pomodoro/src/calendar.js`，新建模块，包含：

**模块级状态：**
- `gcalClientId` — 当前配置的 Client ID
- `gcalConnected` — 是否已连接
- `gcalUserEmail` — 授权后的用户邮箱（通过 userinfo endpoint 获取）
- `selectedEvent` — 当前选中的事件对象 (null | {id, summary, startTime, endTime, isAllDay})

**导出的函数：**

```js
// 从 localStorage 恢复已保存的 Client ID
export function loadGcalConfig() { ... }

// 保存 Client ID
export function saveGcalConfig(clientId) { ... }

// 初始化 OAuth：加载 GIS 库 + 配置 tokenClient
export async function initGcalOAuth(clientId) { ... }

// 触发 OAuth 弹窗（必须在用户点击事件中调用）
export function connectGcal() { ... }

// 断开连接：revoke token + 清状态
export function disconnectGcal() { ... }

// 获取今天的日程事件列表
export async function fetchTodayEvents() { ... }

// 选中/取消选中事件（统一通过 gcal:link-event 自定义事件对外通知）
export function selectEvent(event) { ... }
export function deselectEvent() { ... }
export function getSelectedEvent() { ... }

// 从 session 恢复选中状态
export function restoreSelectionFromSession(session) { ... }
```

**OAuth 核心逻辑（使用 userinfo endpoint 替代 id_token）：**

> ⚠️ **重要：** GIS 的 `initTokenClient`（Implicit/Token 流）**不会返回 `id_token`**——`id_token` 是 OIDC（`initCodeClient` 授权码流）才有的字段。这里改用 Google 的 `userinfo` endpoint 拿邮箱。

```js
let tokenClient = null;
let accessToken = null;
let gcalUserEmail = '';
let gcalConnected = false;
let selectedEvent = null;

export async function initGcalOAuth(clientId) {
  // 加载 GIS 库（如果尚未加载）
  if (typeof google === 'undefined' || !google.accounts?.oauth2) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    // 注意：scope 含 userinfo.email 才能调 userinfo endpoint 拿邮箱
    scope: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email',
    callback: async (response) => {
      if (response.access_token) {
        accessToken = response.access_token;
        gcalConnected = true;
        // 通过 userinfo endpoint 取邮箱（不要再解析 id_token，token 流不返回它）
        try {
          const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (userRes.ok) {
            const user = await userRes.json();
            gcalUserEmail = user.email || '（未知）';
          } else {
            gcalUserEmail = '（未知）';
          }
        } catch (e) {
          gcalUserEmail = '（未知）';
        }
        // 统一对外事件：携带 email
        document.dispatchEvent(new CustomEvent('gcal:connected', {
          detail: { email: gcalUserEmail },
        }));
      } else {
        document.dispatchEvent(new CustomEvent('gcal:auth-error', {
          detail: { error: response.error || '未知错误' },
        }));
      }
    },
    error_callback: (err) => {
      document.dispatchEvent(new CustomEvent('gcal:auth-error', {
        detail: { error: err?.message || err?.type || '授权被取消' },
      }));
    },
  });
}

export function connectGcal() {
  if (!tokenClient) {
    document.dispatchEvent(new CustomEvent('gcal:auth-error', {
      detail: { error: '请先保存 Client ID' },
    }));
    return;
  }
  // 必须在用户手势中调用
  tokenClient.requestAccessToken({ prompt: 'consent' });
}
```

**fetchTodayEvents（处理全天事件 + isAllDay 标记）：**

```js
export async function fetchTodayEvents() {
  if (!accessToken) throw new Error('not_connected');

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events`
    + `?timeMin=${encodeURIComponent(todayStart.toISOString())}`
    + `&timeMax=${encodeURIComponent(todayEnd.toISOString())}`
    + `&orderBy=startTime&singleEvents=true`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 401) {
    // token expired
    disconnectGcal();
    throw new Error('token_expired');
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  return (data.items || [])
    .filter(item => item.status !== 'cancelled')
    .map(item => {
      // 全天事件：item.start.date（YYYY-MM-DD），无 dateTime
      // 定时事件：item.start.dateTime（ISO 字符串）
      const isAllDay = !!item.start?.date && !item.start?.dateTime;
      return {
        id: item.id,
        summary: item.summary || '（无标题）',
        startTime: item.start?.dateTime || item.start?.date,
        endTime: item.end?.dateTime || item.end?.date,
        isAllDay,
        htmlLink: item.htmlLink,
      };
    });
}
```

### Step 3: 修改 index.html

在 `aiConfigModal` 中，`aiConfigFields` 的 `</div>` 之后、`modal-buttons` 之前，插入：

```html
<div style="border-top: 1px solid #c8d6e5; padding-top: 12px; margin-top: 12px;">
  <div style="font-size: 14px; font-weight: 600; color: #1e3a5f; margin-bottom: 8px;">
    📅 Google Calendar 集成
  </div>
  <div class="settings-group">
    <label>OAuth Client ID</label>
    <input type="text" id="gcalClientId" class="settings-input"
           placeholder="123456789-xxxxx.apps.googleusercontent.com">
  </div>
  <div id="gcalConnectArea">
    <button class="btn btn-secondary" id="btnConnectGcal"
            style="width: 100%; margin-bottom: 4px;">
      🔗 连接到 Google Calendar
    </button>
    <button class="btn btn-secondary" id="btnDisconnectGcal"
            style="width: 100%; display: none; margin-bottom: 4px;">
      🔌 断开连接
    </button>
    <div id="gcalStatus" style="font-size: 12px; color: #5c7a9a; margin-bottom: 4px;"></div>
  </div>
  <div style="font-size: 12px; color: #94a8be;">
    ⚠️ 需要 Google Cloud 项目 + OAuth 凭据，详见 README。
    只读取日历（只读权限），不会修改你的日程。
  </div>
</div>
```

在 `capsule-grid` 上方（第 40 行左右）插入可折叠日历面板：

```html
<!-- 📅 GCal 日程面板 -->
<details class="gcal-panel" id="gcalPanel" style="display: none;">
  <summary class="gcal-panel-summary">📅 今日日程 <span id="gcalEventCount"></span></summary>
  <div id="gcalEventList" class="gcal-event-list">
    <div class="gcal-loading">加载中...</div>
  </div>
  <div class="gcal-panel-footer">
    <button class="gcal-refresh-btn" id="btnRefreshEvents">🔄 刷新</button>
    <span id="gcalSelectedInfo" class="gcal-selected-info"></span>
  </div>
</details>
```

### Step 4: 修改 main.js

在 `preferences` / config 区域增加 import：

```js
import {
  loadGcalConfig, saveGcalConfig, initGcalOAuth,
  connectGcal, disconnectGcal, fetchTodayEvents,
  selectEvent, deselectEvent, getSelectedEvent,
} from './calendar.js';
```

在 `setupEventListeners` 中绑定 GCal 按钮：

```js
// GCal
document.getElementById('btnConnectGcal').addEventListener('click', connectGcal);
document.getElementById('btnDisconnectGcal').addEventListener('click', () => {
  disconnectGcal();
  document.getElementById('gcalPanel').style.display = 'none';
});
document.getElementById('btnRefreshEvents').addEventListener('click', async () => {
  await loadAndRenderEvents();
});
```

在 `openAIConfig` 中加入 GCal 状态恢复：

```js
const gcalConfig = loadGcalConfig();
if (gcalConfig && gcalConfig.clientId) {
  document.getElementById('gcalClientId').value = gcalConfig.clientId;
}
```

在 `init()` 中尝试自动恢复 GCal 初始化（只初始化 tokenClient，不静默拉 token）：

```js
const saved = loadGcalConfig();
if (saved && saved.clientId) {
  try {
    await initGcalOAuth(saved.clientId);
    // 注意：token 不持久化，用户需手动点击「连接」按钮重新授权
  } catch(e) { /* silent */ }
}
```

新增事件监听（统一在 `gcal:connected` / `gcal:auth-error` / `gcal:disconnected` 三个名称之间）：

```js
document.addEventListener('gcal:connected', async (e) => {
  document.getElementById('btnConnectGcal').style.display = 'none';
  document.getElementById('btnDisconnectGcal').style.display = '';
  document.getElementById('gcalPanel').style.display = '';
  document.getElementById('gcalStatus').textContent = '✅ 已连接: ' + (e.detail?.email || '');
  await loadAndRenderEvents();
});

document.addEventListener('gcal:auth-error', (e) => {
  showStatus('Google 授权失败：' + (e.detail?.error || '未知错误'), 'danger');
});

document.addEventListener('gcal:disconnected', () => {
  document.getElementById('btnConnectGcal').style.display = '';
  document.getElementById('btnDisconnectGcal').style.display = 'none';
  document.getElementById('gcalPanel').style.display = 'none';
  document.getElementById('gcalStatus').textContent = '';
});
```

新增辅助函数（渲染要区分全天事件）：

```js
async function loadAndRenderEvents() {
  const list = document.getElementById('gcalEventList');
  list.innerHTML = '<div class="gcal-loading">加载中...</div>';
  try {
    const events = await fetchTodayEvents();
    if (events.length === 0) {
      list.innerHTML = '<div class="gcal-empty">今天没有日程事件</div>';
      document.getElementById('gcalEventCount').textContent = '';
      return;
    }
    document.getElementById('gcalEventCount').textContent = `（${events.length} 个）`;
    list.innerHTML = events.map(e => {
      const timeLabel = e.isAllDay
        ? '全天'
        : `${formatGcalTime(e.startTime)} — ${formatGcalTime(e.endTime)}`;
      const isSelected = getSelectedEvent()?.id === e.id;
      return `<div class="gcal-event-item${isSelected ? ' selected' : ''}" data-event-id="${e.id}">
        <div class="gcal-event-time">${timeLabel}</div>
        <div class="gcal-event-title">${escapeText(e.summary)}</div>
      </div>`;
    }).join('');
    // 为每个事件绑定点击选择
    list.querySelectorAll('.gcal-event-item').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.eventId;
        const ev = events.find(e => e.id === id);
        if (!ev) return;
        if (getSelectedEvent()?.id === id) {
          deselectEvent();
        } else {
          selectEvent(ev);
        }
        loadAndRenderEvents();
        updateSelectedInfo();
      });
    });
    updateSelectedInfo();
  } catch (e) {
    if (e.message === 'token_expired') {
      list.innerHTML = '<div class="gcal-error">⏰ Token 已过期，请<a href="#" id="btnReauth">重新登录</a></div>';
      document.getElementById('btnReauth')?.addEventListener('click', (ev) => {
        ev.preventDefault();
        connectGcal();
      });
    } else {
      list.innerHTML = `<div class="gcal-error">❌ ${escapeText(e.message)}</div>`;
    }
  }
}

function formatGcalTime(isoStr) {
  if (!isoStr) return '--:--';
  // 仅用于带 dateTime 的事件；全天事件走 isAllDay 分支不会进这里
  const d = new Date(isoStr);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function updateSelectedInfo() {
  const sel = getSelectedEvent();
  const info = document.getElementById('gcalSelectedInfo');
  info.textContent = sel
    ? `✓ 已关联：${sel.summary}`
    : '';
}
```

**注意：** `escapeText` 必须从 `utils.js`（或现有公共模块）导入，不要在 main.js 重新定义。如果项目尚无该函数，需在 `decision-pomodoro/src/utils.js` 中新增：

```js
// HTML 文本转义（防 XSS，用于把不可信文本放进 innerHTML）
export function escapeText(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

并在 `main.js` 顶部 import：`import { escapeText } from './utils.js';`

### Step 5: 修改 openAIConfig 中的保存逻辑

在 `saveAIConfig` 结束后或单独绑定 gcalClientId 的保存：

```js
document.getElementById('gcalClientId').addEventListener('change', () => {
  const v = document.getElementById('gcalClientId').value.trim();
  if (v) {
    saveGcalConfig(v);
  }
});
```

### Step 6: 验证

- [ ] 打开 AI 配置弹窗 → 看到 GCal 配置区，可以填入 Client ID
- [ ] 填入 Client ID → 点击连接 → 弹出 Google 授权窗口
- [ ] 授权后 → 显示「已连接: xxx@gmail.com」+ 日程面板出现（邮箱来自 userinfo endpoint，不再依赖 id_token）
- [ ] 断开连接 → 面板隐藏，按钮变回连接状态
- [ ] 重新打开弹窗 → Client ID 保留（localStorage 持久化）

### Step 7: Commit

```bash
git add -A
git commit -m "feat: add GCal OAuth connection UI and calendar.js module"
```

---

## Task 2: 完善日程面板样式

**Objective:** 给 GCal 日程面板样式，使其视觉上融入现有 UI 风格。

**Files:**
- Modify: `decision-pomodoro/src/style.css`

**新增样式（追加约 50 行）：**

```css
/* 📅 GCal 日程面板 */
.gcal-panel {
  background: #f8faff;
  border: 1px solid #d0dce8;
  border-radius: 10px;
  margin-bottom: 16px;
  padding: 8px 12px;
}
.gcal-panel-summary {
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
  color: #1e3a5f;
  padding: 4px 0;
  user-select: none;
}
.gcal-panel-summary:hover { color: #2d6a9f; }
.gcal-event-list {
  max-height: 240px;
  overflow-y: auto;
  margin: 8px 0;
}
.gcal-event-item {
  display: flex;
  flex-direction: column;
  padding: 8px 10px;
  margin-bottom: 4px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
  border: 1px solid transparent;
}
.gcal-event-item:hover { background: #e8f0fe; }
.gcal-event-item.selected {
  background: #e3eeff;
  border-color: #1a73e8;
}
.gcal-event-time {
  font-size: 12px;
  color: #5c7a9a;
  margin-bottom: 2px;
}
.gcal-event-title {
  font-size: 14px;
  color: #1e3a5f;
  font-weight: 500;
}
.gcal-loading, .gcal-empty, .gcal-error {
  font-size: 13px;
  color: #94a8be;
  padding: 12px 0;
  text-align: center;
}
.gcal-error { color: #d93025; }
.gcal-panel-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 6px;
  border-top: 1px solid #d0dce8;
}
.gcal-refresh-btn {
  border: none;
  background: none;
  color: #1a73e8;
  cursor: pointer;
  font-size: 13px;
  padding: 2px 6px;
  border-radius: 4px;
}
.gcal-refresh-btn:hover { background: #e8f0fe; }
.gcal-selected-info {
  font-size: 13px;
  color: #34a853;
  flex: 1;
  text-align: right;
}
```

### 验证

- [ ] 日程面板视觉风格与现有 UI 一致（蓝色调、圆角、字体）
- [ ] 选中事件有蓝色边框高亮
- [ ] 鼠标悬停有反馈
- [ ] 移动端也能正常显示（flex 布局自适应）

### Commit

```bash
git add -A
git commit -m "style: add GCal panel styles matching UI theme"
```

---

## Task 3: 关联事件 → session 数据模型

**Objective:** 用户选中日程后，关联信息随 session 一起保存到 localStorage。

**Files:**
- Modify: `decision-pomodoro/src/calendar.js`（selectEvent/deselectEvent 实现）
- Modify: `decision-pomodoro/src/main.js`（监听 `gcal:link-event` 自定义事件）
- Modify: `decision-pomodoro/src/storage.js`（历史渲染时展示关联信息）

### Step 1: calendar.js selectEvent/deselectEvent（统一为单一 `gcal:link-event` 事件）

> ⚠️ **CustomEvent 命名统一**：原计划混用了 `gcal:event-selected` / `gcal:event-deselected` / `gcal:link-event`，统一为单一 `gcal:link-event`，detail 为 event 对象或 null（取消选中）。下游只监听这一个事件即可。

```js
// 选中事件
export function selectEvent(event) {
  selectedEvent = {
    id: event.id,
    summary: event.summary,
    startTime: event.startTime,
    endTime: event.endTime,
    isAllDay: !!event.isAllDay,
  };
  document.dispatchEvent(new CustomEvent('gcal:link-event', {
    detail: { ...selectedEvent },
  }));
}

// 取消选中
export function deselectEvent() {
  selectedEvent = null;
  document.dispatchEvent(new CustomEvent('gcal:link-event', {
    detail: null,
  }));
}

export function getSelectedEvent() {
  return selectedEvent;
}

// 从 session 恢复选中状态（不派发事件，避免初始化时回写循环）
export function restoreSelectionFromSession(session) {
  if (session && session.linkedEvent) {
    selectedEvent = { ...session.linkedEvent };
  } else {
    selectedEvent = null;
  }
}
```

### Step 2: main.js 监听 `gcal:link-event` 同步到 currentSession

```js
// GCal 选中事件 → 同步到 session（统一事件名，不再用 window.__updateLinkedEvent 全局桥）
document.addEventListener('gcal:link-event', (e) => {
  const s = { ...currentSession };
  s.linkedEvent = e.detail; // null 表示取消关联
  updateCurrentSession(s);
});
```

### Step 3: storage.js 历史记录展示关联日程

`saveSession()` 直接 `{...currentSession}` 序列化，`linkedEvent` 字段自动包含，无需改保存逻辑。

`renderHistory()` 需要在历史项中加一行关联日程（注意用 `escapeText` 转义）：

```js
import { escapeText } from './utils.js';

// 在每个 session 的渲染块中：
const linked = session.linkedEvent;
const eventInfo = linked
  ? `<div style="font-size: 12px; color: #34a853; margin-top: 4px;">
      📅 关联日程：${escapeText(linked.summary)}${linked.isAllDay ? '（全天）' : ''}
    </div>`
  : '';
```

将 `eventInfo` 加入历史项的 innerHTML 中。

### Step 4: 验证

- [ ] 选中一个日程事件 → 完成一轮番茄钟 → 查看 localStorage → `linkedEvent` 字段含 `{id, summary, startTime, endTime, isAllDay}`
- [ ] 历史记录中看到关联的日程名称（全天事件附「（全天）」）
- [ ] 取消关联 → 新的 session 中 linkedEvent 为 null
- [ ] 全程只通过 `gcal:link-event` 一个事件名通信，无残留 `event-selected`/`event-deselected`

### Commit

```bash
git add -A
git commit -m "feat: link selected GCal event to pomodoro session via gcal:link-event"
```

---

## Task 4: 导出中显示关联信息（含 ICS 转义）

**Objective:** .ics 导出和 Markdown 导出都包含关联日程信息；ICS 字段按 RFC 5545 转义。

**Files:**
- Modify: `decision-pomodoro/src/export.js`

### Step 1: ICS 转义工具

> ⚠️ **RFC 5545 转义规则**：DESCRIPTION/SUMMARY 等 TEXT 字段中，`\` → `\\`、`;` → `\;`、`,` → `\,`、换行 → `\n`（字面两字符，不是真实换行）。否则用户日程名含逗号/分号/换行时整条 .ics 会被解析坏。

在 `export.js` 顶部加入：

```js
// RFC 5545 TEXT 字段转义
function escapeIcsText(str) {
  if (str == null) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}
```

### Step 2: exportICS 嵌入关联日程

构造 DESCRIPTION 时，把关联日程拼进原描述后再统一转义：

```js
const linked = latestSession.linkedEvent;
const linkedLine = linked
  ? `\n\n📅 关联日程: ${linked.summary}${linked.isAllDay ? '（全天）' : ''}`
    + ` (${linked.startTime || ''} — ${linked.endTime || ''})`
  : '';
const descriptionRaw = `${baseDescription}${linkedLine}`;
const description = escapeIcsText(descriptionRaw);
// 再写入 DESCRIPTION: ${description}
```

如果 SUMMARY 字段也来自用户输入，同样需 `escapeIcsText`。

### Step 3: exportMarkdown

在 session 信息块中添加（Markdown 不需要 ICS 转义，但仍需用 `escapeText` 防御 HTML 渲染场景）：

```js
const linked = session.linkedEvent;
const eventInfo = linked
  ? `\n**📅 关联日程：** ${linked.summary}${linked.isAllDay ? '（全天）' : ''}`
    + `（${fmt(linked.startTime)} — ${fmt(linked.endTime)}）\n\n`
  : '';
```

插入到 `## 轮次 X` 头部区域。

### 验证

- [ ] 有关联的 session → 导出 .ics → DESCRIPTION 含关联日程
- [ ] 日程名包含逗号/分号/换行 → .ics 在 Google Calendar / Outlook 中导入正常，不串行
- [ ] 全天事件导出 → 标注「（全天）」
- [ ] 有关联的 session → 导出 Markdown → 关联日程字段存在

### Commit

```bash
git add -A
git commit -m "feat: include linked GCal event in ICS (RFC5545-escaped) and Markdown exports"
```

---

## Task 5: 断开/错误处理 + 细节完善

**Objective:** 处理 OAuth 断开（含 token revoke）、token 过期自动提示、首次使用引导。

**Files:**
- Modify: `decision-pomodoro/src/calendar.js`
- Modify: `decision-pomodoro/src/main.js`

### Step 1: disconnectGcal 完整实现（调用 GIS revoke）

> ⚠️ **revoke**：仅清本地 `accessToken` 变量不能真正撤销 Google 侧的授权；必须调用 `google.accounts.oauth2.revoke(token, callback)` 通知 Google 服务端撤销。下次连接会重新走授权流程。

```js
export function disconnectGcal() {
  const tokenToRevoke = accessToken;
  accessToken = null;
  gcalUserEmail = '';
  gcalConnected = false;
  selectedEvent = null;

  // 通知 Google 撤销 token（失败也不阻塞 UI）
  if (tokenToRevoke && typeof google !== 'undefined' && google.accounts?.oauth2?.revoke) {
    try {
      google.accounts.oauth2.revoke(tokenToRevoke, () => { /* revoked */ });
    } catch (e) { /* ignore */ }
  }

  // 同时取消关联（让 main.js 把 currentSession.linkedEvent 置 null）
  document.dispatchEvent(new CustomEvent('gcal:link-event', { detail: null }));
  document.dispatchEvent(new CustomEvent('gcal:disconnected'));
}
```

### Step 2: 首次使用引导

在 `gcalStatus` 区域显示提示文案：

```html
<div id="gcalStatus" style="font-size: 12px; color: #5c7a9a; margin: 4px 0;">
  💡 首次使用？需在 Google Cloud Console 创建 OAuth 凭据，详见文档。
</div>
```

### Step 3: `init()` 中自动恢复连接

`main.js` 中的 `init()` 异步尝试：

```js
const gcalSaved = loadGcalConfig();
if (gcalSaved?.clientId) {
  try {
    await initGcalOAuth(gcalSaved.clientId);
    // 只初始化 tokenClient，不静默请求 token（防止被浏览器当弹窗拦截）
  } catch (e) {
    // 静默失败，用户手动点击连接即可
  }
}
```

注意：GIS 的 `tokenClient.requestAccessToken({ prompt: 'none' })` 可以静默刷新，但放在 `init()` 中可能因非用户手势被浏览器拒绝。建议只设置 `initGcalOAuth`（初始化 tokenClient），由用户点击「连接」按钮时再真正请求。

### 验证

- [ ] 用户点击断开 → 调用 GIS `revoke` → 控制台无报错；下次连接需重新授权弹窗
- [ ] token 过期 → fetch 返回 401 → 显示「重新登录」链接 → 点击重新授权 → 恢复
- [ ] 页面刷新 → Client ID 保留、但需要重新授权（token 不持久）
- [ ] 断开后 currentSession.linkedEvent 也被清空（通过 `gcal:link-event` detail: null）

### Commit

```bash
git add -A
git commit -m "chore: revoke GCal token on disconnect, polish error handling and init recovery"
```

---

## Task 6: 更新 CHANGELOG + 文档

**Objective:** 项目约定「每完成一个功能更新 CHANGELOG.md」，本特性整体作为一个版本节点写入。

**Files:**
- Modify: `decision-pomodoro/CHANGELOG.md`（如不存在则在仓库根 `CHANGELOG.md` 中追加）
- Modify: `README.md`（如有）：补 GCal 前置准备步骤、Client ID 来源

### Step 1: CHANGELOG 条目（追加到顶部）

```markdown
## v3.4: Google Calendar 日程关联

### 新增
- GCal OAuth 连接（Token 流 + userinfo endpoint 拿邮箱，非 id_token）
- 今日日程面板（含全天事件标记）
- 番茄轮次关联到日程事件，随 session 持久化
- 历史记录 / Markdown / ICS 导出均含关联日程信息
- ICS 导出按 RFC 5545 转义 DESCRIPTION，避免逗号/分号/换行破坏文件

### 改动
- 新增 `src/calendar.js` 模块、`pomodoro_gcal_config` localStorage key
- 统一 GCal 自定义事件命名为 `gcal:connected` / `gcal:auth-error` / `gcal:disconnected` / `gcal:link-event`
- 新增 `src/utils.js` 的 `escapeText` 工具（若此前不存在）

### 安全
- `disconnectGcal` 调用 `google.accounts.oauth2.revoke` 真正撤销服务端 token
- scope 仅 `calendar.readonly` + `userinfo.email`，无写日历权限
```

### Step 2: README 增补

```markdown
## Google Calendar 集成

1. 在 Google Cloud Console 创建项目并启用 Google Calendar API
2. 创建 OAuth 2.0 Client ID（Web 应用），把 `http://localhost:5173` 加到 Authorized JavaScript origins
3. 在番茄钟「AI 配置」弹窗的 GCal 区填入 Client ID 并保存
4. 点击「连接到 Google Calendar」完成授权
```

### 验证

- [ ] CHANGELOG.md 顶部有 v3.4 条目，描述特性、改动、安全说明
- [ ] README 含 GCal 前置步骤
- [ ] `git log --oneline` 能看到 Task 1–5 的提交 + 本 Task 的文档提交

### Commit

```bash
git add -A
git commit -m "docs: changelog v3.4 + README for Google Calendar integration"
git tag v3.4
git push --tags
git push
```

---

## 最终验证清单

- [ ] 完整的 GCal OAuth 连接/断开流程（token 流 + userinfo endpoint，非 id_token）
- [ ] disconnect 调用 GIS revoke 真正撤销服务端 token
- [ ] 连接后展示今日日程列表，全天事件正确显示「全天」
- [ ] 点击事件高亮选中
- [ ] 选中事件关联到 session，存入 localStorage（含 isAllDay 字段）
- [ ] 自定义事件全程统一为 `gcal:connected` / `gcal:auth-error` / `gcal:disconnected` / `gcal:link-event`
- [ ] 历史记录显示关联日程
- [ ] ICS 导出含关联信息，DESCRIPTION 按 RFC 5545 转义（`\` `;` `,` `\n`）
- [ ] Markdown 导出含关联信息
- [ ] `escapeText` 集中在 `utils.js`，无重复定义
- [ ] Token 过期友好提示
- [ ] 断开连接完全清除状态 + revoke + 清 `currentSession.linkedEvent`
- [ ] Client ID 持久化存储
- [ ] CHANGELOG.md 更新、tag v3.4 推送
- [ ] `vite build` 无错误

---

## 风险与注意事项

| 风险 | 缓解 |
|------|------|
| OAuth 弹窗被浏览器拦截 | `connectGcal()` 必须在用户点击事件处理函数中同步调用，不能 setTimeout/await |
| token 有效期约 1 小时 | 过期后手动重新连接；不做后台静默刷新（需要后端） |
| Token 流不返回 id_token | 用 `https://www.googleapis.com/oauth2/v3/userinfo` 拿邮箱，scope 加 `userinfo.email` |
| 全天事件被当成 0:00 定时事件 | 用 `start.date` 是否存在判定 `isAllDay`，UI 显示「全天」而不是「00:00 — 00:00」|
| ICS 字段含逗号/分号/换行 | `escapeIcsText` 按 RFC 5545 转义 `\` `;` `,` `\n` |
| 用户无 Google Cloud 项目 | 在 README 和 UI 中写清步骤，链接到文档 |
| 无后端 = token 在客户端 | scope 只读日历，断开时 revoke；风险可控 |
| 多个日历 | MVP 只读 primary calendar |

---

## 未来迭代（Phase 2，不在此计划中）

- 自动匹配：根据番茄钟时间自动找到对应日程事件
- 多日视图：查看未来几天的日程来做计划
- 写入日历：把番茄钟产出作为事件描述写回 Google Calendar
- 日程冲突提醒：开始番茄钟前如果检测到日程冲突则弹出警告
- 多个日历选择：让用户在下拉中选择要展示的日历

---

*计划版本：1.1（修订：userinfo endpoint / 全天事件 / ICS 转义 / revoke / 统一 CustomEvent / CHANGELOG Task）| 适用版本：v3.x 决策番茄钟*

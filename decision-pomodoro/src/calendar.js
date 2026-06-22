// Google Calendar 集成（Task 1：连接 + 拉取今日日程）
//
// 设计要点：
// - 用 Google Identity Services (GIS) 的 token client 走 OAuth2 隐式流程；
//   只要 access_token，不解析 id_token；用户身份调 userinfo 端点获取
// - scope：calendar.readonly + userinfo.email（最小权限）
// - 全天事件标记 isAllDay（start.date 存在、start.dateTime 不存在）
// - 断开连接时调 revoke 端点，把 token 在 Google 侧也吊销
// - 与外部通信用 CustomEvent，避免硬耦合：
//     'gcal:connected'    detail = { email }
//     'gcal:disconnected' detail = {}
//     'gcal:events'       detail = { events, date }
//     'gcal:error'        detail = { message }
// - fetch 与 render 分离：fetchTodayEvents() 只返回数据，
//   renderEvents() 只负责把数据塞进 DOM

import { GCAL_CONFIG_KEY } from './config.js';

const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const SCOPES = [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/userinfo.email'
].join(' ');
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const CALENDAR_EVENTS_URL =
    'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

let gisLoadPromise = null;
let tokenClient = null;
let tokenClientForClientId = null;

// ---------- 配置 / token 存储 ----------

export function loadGCalConfig() {
    try {
        return JSON.parse(localStorage.getItem(GCAL_CONFIG_KEY)) || {};
    } catch (e) {
        return {};
    }
}

function saveGCalConfig(cfg) {
    localStorage.setItem(GCAL_CONFIG_KEY, JSON.stringify(cfg));
}

function clearGCalToken() {
    const cfg = loadGCalConfig();
    delete cfg.accessToken;
    delete cfg.expiresAt;
    delete cfg.email;
    saveGCalConfig(cfg);
}

export function isConnected() {
    const cfg = loadGCalConfig();
    return !!(cfg.accessToken && cfg.expiresAt && Date.now() < cfg.expiresAt);
}

export function getConnectedEmail() {
    return loadGCalConfig().email || '';
}

// ---------- 事件分发 ----------

function emit(name, detail) {
    document.dispatchEvent(new CustomEvent('gcal:' + name, { detail: detail || {} }));
}

// ---------- GIS 加载 / token client 初始化 ----------

function loadGIS() {
    if (gisLoadPromise) return gisLoadPromise;
    gisLoadPromise = new Promise((resolve, reject) => {
        if (window.google && window.google.accounts && window.google.accounts.oauth2) {
            resolve();
            return;
        }
        const s = document.createElement('script');
        s.src = GIS_SCRIPT_SRC;
        s.async = true;
        s.defer = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('无法加载 Google Identity Services 脚本'));
        document.head.appendChild(s);
    });
    return gisLoadPromise;
}

function ensureTokenClient(clientId) {
    if (tokenClient && tokenClientForClientId === clientId) return tokenClient;
    tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: () => {} // 每次 connect() 时动态覆盖
    });
    tokenClientForClientId = clientId;
    return tokenClient;
}

// ---------- 连接 / 断开 ----------

export async function connect(clientId) {
    clientId = (clientId || loadGCalConfig().clientId || '').trim();
    if (!clientId) {
        emit('error', { message: '请先填写 Google OAuth Client ID' });
        return;
    }
    try {
        await loadGIS();
    } catch (err) {
        emit('error', { message: err.message });
        return;
    }

    const client = ensureTokenClient(clientId);
    client.callback = async (resp) => {
        if (resp.error) {
            emit('error', { message: 'OAuth 失败：' + resp.error });
            return;
        }
        const accessToken = resp.access_token;
        const expiresIn = parseInt(resp.expires_in, 10) || 3600;
        const expiresAt = Date.now() + (expiresIn - 60) * 1000;
        let email = '';
        try {
            const r = await fetch(USERINFO_URL, {
                headers: { Authorization: 'Bearer ' + accessToken }
            });
            if (r.ok) {
                const info = await r.json();
                email = info.email || '';
            }
        } catch (e) {
            // userinfo 拿不到不阻塞，主流程继续
        }
        saveGCalConfig({ clientId, accessToken, expiresAt, email });
        emit('connected', { email });
    };

    // prompt='' 表示沿用既有同意；用户首次会被要求授权
    client.requestAccessToken({ prompt: '' });
}

export async function disconnect() {
    const cfg = loadGCalConfig();
    const token = cfg.accessToken;
    clearGCalToken();
    if (token) {
        try {
            await fetch(REVOKE_URL + '?token=' + encodeURIComponent(token), {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
        } catch (e) {
            // revoke 失败不影响本地已清理
        }
    }
    emit('disconnected', {});
}

// ---------- 拉取日程 ----------

function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function endOfDay(d) {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
}

function normalizeEvent(raw) {
    const isAllDay = !!(raw.start && raw.start.date && !raw.start.dateTime);
    const startStr = (raw.start && (raw.start.dateTime || raw.start.date)) || '';
    const endStr = (raw.end && (raw.end.dateTime || raw.end.date)) || '';
    return {
        id: raw.id,
        title: raw.summary || '(无标题)',
        location: raw.location || '',
        description: raw.description || '',
        htmlLink: raw.htmlLink || '',
        isAllDay,
        start: startStr,
        end: endStr
    };
}

export async function fetchTodayEvents(date) {
    const cfg = loadGCalConfig();
    if (!cfg.accessToken) throw new Error('未连接 Google Calendar');
    const day = date || new Date();
    const timeMin = startOfDay(day).toISOString();
    const timeMax = endOfDay(day).toISOString();
    const url =
        CALENDAR_EVENTS_URL +
        '?singleEvents=true&orderBy=startTime' +
        '&timeMin=' + encodeURIComponent(timeMin) +
        '&timeMax=' + encodeURIComponent(timeMax) +
        '&maxResults=50';

    const r = await fetch(url, {
        headers: { Authorization: 'Bearer ' + cfg.accessToken }
    });
    if (r.status === 401) {
        // token 失效，清掉本地 token，提示用户重连
        clearGCalToken();
        emit('disconnected', {});
        throw new Error('登录已过期，请重新连接');
    }
    if (!r.ok) {
        const body = await r.text();
        throw new Error('Calendar API ' + r.status + '：' + body.slice(0, 200));
    }
    const data = await r.json();
    const events = (data.items || []).map(normalizeEvent);
    emit('events', { events, date: day });
    return events;
}

// ---------- 渲染（与 fetch 分离） ----------

function fmtTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return String(d.getHours()).padStart(2, '0') + ':' +
           String(d.getMinutes()).padStart(2, '0');
}

export function renderEvents(events, container) {
    if (!container) return;
    container.innerHTML = '';
    if (!events || events.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'gcal-empty';
        empty.textContent = '今天没有日程，专注当下 🍅';
        container.appendChild(empty);
        return;
    }
    events.forEach((ev) => {
        const item = document.createElement('div');
        item.className = 'gcal-event' + (ev.isAllDay ? ' all-day' : '');
        const time = document.createElement('span');
        time.className = 'gcal-event-time';
        time.textContent = ev.isAllDay
            ? '全天'
            : fmtTime(ev.start) + '–' + fmtTime(ev.end);
        const title = document.createElement('span');
        title.className = 'gcal-event-title';
        title.textContent = ev.title;
        item.appendChild(time);
        item.appendChild(title);
        if (ev.location) {
            const loc = document.createElement('span');
            loc.className = 'gcal-event-loc';
            loc.textContent = '· ' + ev.location;
            item.appendChild(loc);
        }
        container.appendChild(item);
    });
}

// ---------- 配置面板（Client ID 持久化的便利方法） ----------

export function saveClientId(clientId) {
    const cfg = loadGCalConfig();
    cfg.clientId = (clientId || '').trim();
    saveGCalConfig(cfg);
}

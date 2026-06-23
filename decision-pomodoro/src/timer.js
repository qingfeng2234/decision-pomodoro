import {
    PHASE_ORDER, PHASES, currentPhaseIndex, currentRounds, timeRemaining, totalTime,
    timerInterval, isRunning, isPaused, currentSession, focusCheckTriggered,
    updateCurrentPhaseIndex, updateTimeRemaining, updateTotalTime,
    updateTimerInterval, updateIsRunning, updateIsPaused, updateCurrentSession,
    updateFocusCheckTriggered, updatePhaseOrder, updatePhases, buildPhases
} from './state.js';
import { buildPhaseOrder, getActiveProfile, DEFAULT_ROUNDS } from './config.js';
import { Sounds, toggleSound } from './sound.js';
import {
    updatePhaseIndicator, updatePhaseUI, updateTimerDisplay, updateProgress,
    showStatus, showModal, closeModal, renderPhaseIndicator, updateSubtitle
} from './ui.js';
import { saveSession, renderHistory } from './storage.js';
import { currentPhaseHasInput, currentPhaseSnapshot, renderAllCards } from './cards.js';

export { toggleSound };

// 时间对齐：已提醒过哪些事件，避免重复
const _eventAlertedIds = new Set();

// 基于时间戳的倒计时：记录本阶段的绝对截止时刻，避免后台/息屏时 setInterval 被节流导致计时漂移
let phaseDeadline = null;

// 在用户手势（点击「开始」）时申请桌面通知权限——比页面加载时自动申请更可靠
function ensureNotificationPermission() {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') {
        try { Notification.requestPermission(); } catch (e) { /* 旧版返回 Promise 之外的实现，忽略 */ }
    }
}

function checkEventTimeAlignment() {
    if (!currentSession.linkedEvent || currentSession.linkedEvent.isAllDay) return;
    const endStr = currentSession.linkedEvent.end;
    if (!endStr) return;
    const eventEnd = new Date(endStr);
    if (isNaN(eventEnd.getTime())) return;

    const id = currentSession.linkedEvent.id;
    if (_eventAlertedIds.has(id)) return;

    const minsLeft = Math.floor((eventEnd.getTime() - Date.now()) / 60000);
    if (minsLeft <= 5 && minsLeft >= 0) {
        _eventAlertedIds.add(id);
        showStatus('⏰ 关联日程「' + currentSession.linkedEvent.title + '」还有 ' + minsLeft + ' 分钟结束，注意收尾！', 'warning');
        sendNotification('⏰ 日程即将结束', '「' + currentSession.linkedEvent.title + '」还有 ' + minsLeft + ' 分钟');
    }
}

export function startTimer() {
    const currentPhaseKey = PHASE_ORDER[currentPhaseIndex];

    if (currentPhaseKey === 'split' && !currentPhaseHasInput()) {
        showStatus('请先在「拆分」卡里写出今日大问题或至少一个任务再开始！', 'warning');
        document.getElementById('splitBigProblem').focus();
        return;
    }

    if (!currentSession.startTime) {
        var session = { ...currentSession };
        session.startTime = new Date().toISOString();
        if (!session.taskName) {
            session.taskName = (session.cards && session.cards.split.bigProblem || '').trim().substring(0, 50);
        }
        updateCurrentSession(session);
    }

    ensureNotificationPermission();

    updateIsRunning(true);
    updateIsPaused(false);
    document.getElementById('btnStart').classList.add('hidden');
    document.getElementById('btnPause').classList.remove('hidden');
    document.getElementById('btnSettings').disabled = true;
    document.getElementById('btnSettings').style.opacity = '0.5';
    document.getElementById('btnSettings').style.cursor = 'not-allowed';
    showStatus('专注中... 保持主线，不要发散', 'info');
    Sounds.phaseStart();

    // 用当前剩余秒数锚定一个绝对截止时刻；之后每次 tick 都用真实时间反算，
    // 即使标签页被切到后台/息屏导致定时器被节流，回到前台后也会立刻校正。
    phaseDeadline = Date.now() + timeRemaining * 1000;
    const interval = setInterval(tick, 250);
    updateTimerInterval(interval);
}

function tick() {
    if (phaseDeadline === null) return;
    const prev = timeRemaining;
    const remaining = Math.max(0, Math.round((phaseDeadline - Date.now()) / 1000));
    if (remaining === prev && remaining > 0) return; // 同一秒内无需重复刷新

    updateTimeRemaining(remaining);
    updateTimerDisplay();
    updateProgress();

    const currentPhaseKey = PHASE_ORDER[currentPhaseIndex];

    if (currentPhaseKey.startsWith('exec') &&
        !focusCheckTriggered &&
        PHASES[currentPhaseKey].minutes >= 10 &&
        remaining <= (PHASES[currentPhaseKey].minutes - 10) * 60 &&
        remaining > 0) {
        updateFocusCheckTriggered(true);
        Sounds.focusCheck();
        pauseTimer();
        showModal('focusModal');
        return;
    }

    // 仅在真实跨过一秒时播放（跳过后台静默期），且页面可见时才有意义
    if (remaining <= 10 && remaining > 0 && remaining < prev) Sounds.countdownTick();

    // 跨过整分钟边界时检查时间对齐（后台跳秒也能命中）
    if (remaining > 0 && Math.floor(prev / 60) !== Math.floor(remaining / 60)) {
        checkEventTimeAlignment();
    }

    if (remaining <= 0) {
        completePhase();
    }
}

// 回到前台时立即校正显示（后台节流期间可能积压了若干秒）
if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && isRunning && phaseDeadline !== null) tick();
    });
}

export function pauseTimer() {
    updateIsRunning(false);
    updateIsPaused(true);
    clearInterval(timerInterval);
    updateTimerInterval(null);
    document.getElementById('btnStart').classList.remove('hidden');
    document.getElementById('btnPause').classList.add('hidden');
    document.getElementById('btnSettings').disabled = false;
    document.getElementById('btnSettings').style.opacity = '';
    document.getElementById('btnSettings').style.cursor = '';
    showStatus('已暂停', 'warning');
}

export function continueTimer() {
    closeModal('focusModal');
    startTimer();
}

export function captureDistraction() {
    const distraction = prompt('你在想什么？写下来，继续执行：');
    if (distraction) {
        captureIdea('【走神】' + distraction);
    }
    closeModal('focusModal');
    startTimer();
}

export function completePhase() {
    clearInterval(timerInterval);
    updateTimerInterval(null);
    updateIsRunning(false);
    updateIsPaused(false);
    updateFocusCheckTriggered(false);
    Sounds.phaseComplete();

    const currentPhaseKey = PHASE_ORDER[currentPhaseIndex];

    if (currentPhaseKey.startsWith('exec') && !currentPhaseHasInput()) {
        showStatus('执行阶段必须有产出！没有产出不算完成一轮。', 'danger');
        document.getElementById('btnStart').classList.remove('hidden');
        document.getElementById('btnPause').classList.add('hidden');
        return;
    }

    const snapshot = currentPhaseSnapshot();

    var session = { ...currentSession };
    session.phases.push({
        phase: currentPhaseKey,
        phaseName: PHASES[currentPhaseKey].name,
        outputType: snapshot.outputType,
        outputTypeName: snapshot.outputTypeName,
        output: snapshot.output,
        completedAt: new Date().toISOString()
    });
    updateCurrentSession(session);

    var indicator = document.querySelector(`[data-phase="${currentPhaseKey}"]`);
    if (indicator) {
        indicator.classList.add('completed');
        indicator.classList.remove('active');
    }

    if (currentPhaseKey === 'review1' && currentRounds >= 2 && !checkStandardMet()) {
        showStatus('第一轮未达标，进入第二轮执行。', 'warning');
    }

    var nextIndex = currentPhaseIndex + 1;
    updateCurrentPhaseIndex(nextIndex);

    if (nextIndex >= PHASE_ORDER.length) {
        finishSession();
        return;
    }

    if (currentRounds >= 2 && nextIndex === PHASE_ORDER.length - 1 && !checkStandardMet()) {
        showModal('stopLossModal');
        showStatus('🛑 强制止损：两轮未达标，必须输出最弱结论', 'danger');
    }

    const nextPhaseKey = PHASE_ORDER[nextIndex];
    sendNotification(
        PHASES[currentPhaseKey].icon + ' ' + PHASES[currentPhaseKey].name + ' 完成',
        '下一阶段：' + PHASES[nextPhaseKey].icon + ' ' + PHASES[nextPhaseKey].name
    );

    showTimeUpModal(
        PHASES[currentPhaseKey].icon + ' ' + PHASES[currentPhaseKey].name + ' 时间到',
        '下一阶段：' + PHASES[nextPhaseKey].icon + ' ' + PHASES[nextPhaseKey].name
    );

    updateTimeRemaining(PHASES[nextPhaseKey].minutes * 60);
    updateTotalTime(PHASES[nextPhaseKey].minutes * 60);

    updatePhaseIndicator();
    updatePhaseUI();
    updateTimerDisplay();
    updateProgress();
    renderAllCards();

    document.getElementById('btnStart').classList.remove('hidden');
    document.getElementById('btnPause').classList.add('hidden');

    showStatus(`进入${PHASES[nextPhaseKey].name}，请准备产出`, 'success');
}

function checkStandardMet() {
    const review1 = currentSession.phases.find(p => p.phase === 'review1');
    if (!review1) return false;
    return review1.output.toLowerCase().includes('达标') ||
           review1.output.toLowerCase().includes('完成') ||
           review1.output.toLowerCase().includes('yes');
}

function finishSession() {
    document.getElementById('btnStart').disabled = true;
    document.getElementById('btnComplete').disabled = true;
    document.getElementById('btnStuck').disabled = true;
    document.getElementById('btnSettings').disabled = false;
    document.getElementById('btnSettings').style.opacity = '';
    document.getElementById('btnSettings').style.cursor = '';
    showStatus('本轮结束！请导出到日历或开始新一轮。', 'success');
    Sounds.sessionComplete();
    sendNotification('🏁 番茄钟完成', '任务「' + currentSession.taskName + '」— 全部阶段已完成！');
    showTimeUpModal('🏁 全部阶段完成', '任务「' + currentSession.taskName + '」已全部完成！');
    saveSession();
    renderHistory();
    // 通知 main.js 可以执行回写
    document.dispatchEvent(new CustomEvent('session:finished', { detail: { ...currentSession } }));
}

export function endSession() {
    if (confirm('确定要结束本轮吗？当前进度将保存。')) {
        clearInterval(timerInterval);
        updateTimerInterval(null);
        updateIsRunning(false);
        document.getElementById('btnSettings').disabled = false;
        document.getElementById('btnSettings').style.opacity = '';
        document.getElementById('btnSettings').style.cursor = '';
        saveSession();
        renderHistory();
        showStatus('本轮已保存，可以在下方导出到日历。', 'info');
    }
}

export function handleStuckOption(option) {
    closeModal('stuckModal');
    // 每个策略追问一句，把"标签"落实成"这一步具体做什么"
    const prompts = {
        smaller: { q: '最小版本具体是什么？（10 分钟内能做完的那一小步）', prefix: '【拆小】先只做：' },
        angle:   { q: '换个问法，新的问题是什么？', prefix: '【换角度】重新定义问题：' },
        action:  { q: '现在立刻要做的第一个动作是什么？', prefix: '【最小行动】立刻去做：' }
    };
    const cfg = prompts[option];
    const answer = cfg ? (prompt(cfg.q) || '').trim() : '';

    // 写入当前执行轮次的 stuck 字段（如在执行阶段）
    const key = PHASE_ORDER[currentPhaseIndex];
    if (answer && key && key.startsWith('exec')) {
        const r = parseInt(key.slice(4));
        const session = { ...currentSession };
        const prev = session.cards.exec.rounds[r].stuck;
        const line = cfg.prefix + answer;
        session.cards.exec.rounds[r].stuck = (prev ? prev + '\n' : '') + line;
        updateCurrentSession(session);
        renderAllCards();
        showStatus('已落实应对：' + line, 'info');
    } else {
        showStatus('继续执行，保持主线', 'info');
    }
    startTimer();
}

export function captureIdea(idea) {
    var session = { ...currentSession };
    session.ideas.push({
        text: idea,
        capturedAt: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    });
    updateCurrentSession(session);
    renderIdeas();
}

function renderIdeas() {
    var btn = document.getElementById('btnClearIdeas');
    if (currentSession.ideas.length === 0) {
        document.getElementById('ideaList').innerHTML = '';
        if (btn) btn.classList.add('hidden');
        return;
    }
    document.getElementById('ideaList').innerHTML = currentSession.ideas.map((idea, index) =>
        `<div class="idea-item">${index + 1}. [${idea.capturedAt}] ${idea.text}</div>`
    ).join('');
    if (btn) btn.classList.remove('hidden');
}

export function clearIdeas() {
    var session = { ...currentSession };
    session.ideas = [];
    updateCurrentSession(session);
    renderIdeas();
}

let _notifyHintShown = false;
function sendNotification(title, body) {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            tag: 'pomodoro-phase',
            requireInteraction: true
        });
        return;
    }
    // 没有桌面通知权限时，提示一次如何开启（避免只靠声音/页面内弹窗错过提醒）
    if (!_notifyHintShown) {
        _notifyHintShown = true;
        const tip = Notification.permission === 'denied'
            ? '桌面通知已被浏览器拦截，点击地址栏左侧🔒→允许通知，息屏也能收到提醒。'
            : '想在息屏/切走时也收到提醒？请在浏览器允许本页面的桌面通知。';
        showStatus('🔔 ' + tip, 'warning');
    }
}

function showTimeUpModal(title, body) {
    document.getElementById('timeUpModalTitle').textContent = title;
    document.getElementById('timeUpModalText').textContent = body;
    showModal('timeUpModal');
}

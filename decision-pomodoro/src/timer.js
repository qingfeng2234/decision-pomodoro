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

    updateIsRunning(true);
    updateIsPaused(false);
    document.getElementById('btnStart').classList.add('hidden');
    document.getElementById('btnPause').classList.remove('hidden');
    document.getElementById('btnSettings').disabled = true;
    document.getElementById('btnSettings').style.opacity = '0.5';
    document.getElementById('btnSettings').style.cursor = 'not-allowed';
    showStatus('专注中... 保持主线，不要发散', 'info');
    Sounds.phaseStart();

    const interval = setInterval(() => {
        var remaining = timeRemaining - 1;
        updateTimeRemaining(remaining);
        updateTimerDisplay();
        updateProgress();

        if (currentPhaseKey.startsWith('exec') &&
            !focusCheckTriggered &&
            PHASES[currentPhaseKey].minutes >= 10 &&
            remaining <= (PHASES[currentPhaseKey].minutes - 10) * 60) {
            updateFocusCheckTriggered(true);
            Sounds.focusCheck();
            pauseTimer();
            showModal('focusModal');
        }

        if (remaining <= 10 && remaining > 0) Sounds.countdownTick();
        if (remaining <= 0) {
            completePhase();
        }
    }, 1000);
    updateTimerInterval(interval);
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
    const templates = {
        smaller: '【拆小】当前任务太大，先完成最小版本：',
        angle: '【换角度】换个问法重新思考：',
        action: '【最小行动】不管完美，先做：'
    };
    // v3.0：写入当前执行轮次的 stuck 字段（如在执行阶段），否则忽略
    const key = PHASE_ORDER[currentPhaseIndex];
    if (key && key.startsWith('exec')) {
        const r = parseInt(key.slice(4));
        const session = { ...currentSession };
        const prev = session.cards.exec.rounds[r].stuck;
        session.cards.exec.rounds[r].stuck = (prev ? prev + '\n' : '') + templates[option];
        updateCurrentSession(session);
        renderAllCards();
    }
    showStatus('已选择应对策略，继续执行', 'info');
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

function sendNotification(title, body) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    new Notification(title, {
        body: body,
        tag: 'pomodoro-phase',
        requireInteraction: true
    });
}

function showTimeUpModal(title, body) {
    document.getElementById('timeUpModalTitle').textContent = title;
    document.getElementById('timeUpModalText').textContent = body;
    showModal('timeUpModal');
}

import './style.css';

import { getActiveProfile, getActiveProfileName, loadProfiles, saveProfiles, SOUND_PREF_KEY, VOLUME_PREF_KEY, PROFILES_KEY, ACTIVE_PROFILE_KEY, DEFAULT_ROUNDS, AI_CONFIG_KEY } from './config.js';
import {
    PHASE_ORDER, PHASES, currentPhaseIndex, currentRounds, soundMuted, mokugyoVolume,
    updatePhaseOrder, updatePhases, updateCurrentRounds, updateTimeRemaining,
    updateTotalTime, updateCurrentPhaseIndex, updateCurrentSession, currentSession,
    updateSoundMuted, updateMokugyoVolume, buildPhases
} from './state.js';
import { buildPhaseOrder } from './config.js';
import { toggleSound } from './timer.js';
import { renderPhaseIndicator, updateSubtitle, updateTimerDisplay, updateProgress, updatePhaseUI, showStatus, showModal, closeModal } from './ui.js';
import { loadTodayHistory, renderHistory } from './storage.js';
import { exportICS, exportMarkdown } from './export.js';
import { renderSettings, loadProfile, saveAsNewProfile, updateCurrentProfile, deleteProfile, applyAndClose, updateSettingsPreview, setRounds } from './settings.js';
import { startTimer, pauseTimer, continueTimer, captureDistraction, completePhase, endSession, handleStuckOption, captureIdea } from './timer.js';
import { toggleAIConfigFields, testAIConnection, saveAIConfig } from './ai.js';
import { ensureCardsInit, renderAllCards, addTask, syncSplitBigProblem, addRound2, removeRound2, canRemoveRound2, renderRoundToggle } from './cards.js';

function init() {
    const profile = getActiveProfile();
    updateCurrentRounds(profile.rounds || DEFAULT_ROUNDS);
    const order = buildPhaseOrder(currentRounds);
    updatePhaseOrder(order);
    const phases = buildPhases({ split: profile.split, exec: profile.exec, review: profile.review, rounds: currentRounds });
    updatePhases(phases);
    updateTimeRemaining(phases.split.minutes * 60);
    updateTotalTime(phases.split.minutes * 60);

    updateSoundMuted(localStorage.getItem(SOUND_PREF_KEY) === 'true');
    document.getElementById('btnSound').textContent = soundMuted ? '🔇' : '🔊';

    const vol = parseInt(localStorage.getItem(VOLUME_PREF_KEY)) || 50;
    updateMokugyoVolume(vol);
    document.getElementById('volumeSlider').value = vol;

    updateCurrentSession({
        date: new Date().toISOString().split('T')[0],
        startTime: null,
        phases: [],
        ideas: [],
        taskName: '',
        version: 3,
        cards: null
    });
    ensureCardsInit();

    if (loadProfiles().length === 0) {
        saveProfiles([{ name: '经典', split: 5, exec: 25, review: 5, rounds: 1 }]);
        localStorage.setItem(ACTIVE_PROFILE_KEY, '经典');
    }

    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    loadTodayHistory();
    renderPhaseIndicator();
    updateSubtitle(profile.split, profile.exec, profile.review, profile.rounds || DEFAULT_ROUNDS);
    updateTimerDisplay();
    updateProgress();
    renderAllCards();
    updatePhaseUI();
    setupEventListeners();
}

function setupEventListeners() {
    document.getElementById('btnStart').addEventListener('click', startTimer);
    document.getElementById('btnPause').addEventListener('click', pauseTimer);
    document.getElementById('btnComplete').addEventListener('click', completePhase);
    document.getElementById('btnStuck').addEventListener('click', function() { pauseTimer(); showModal('stuckModal'); });
    document.getElementById('btnEnd').addEventListener('click', endSession);
    document.getElementById('btnExport').addEventListener('click', exportICS);
    document.getElementById('btnExportMarkdown').addEventListener('click', exportMarkdown);
    document.getElementById('btnExportGCal').addEventListener('click', exportSelectedToGCal);
    document.getElementById('btnExportICS').addEventListener('click', exportSelectedICS);
    document.getElementById('btnSettings').addEventListener('click', function() { if (!PHASE_ORDER.length) return; renderSettings(); });
    document.getElementById('btnSound').addEventListener('click', toggleSound);
    document.getElementById('btnAIConfig').addEventListener('click', openAIConfig);
    document.getElementById('btnSaveNewProfile').addEventListener('click', saveAsNewProfile);
    document.getElementById('btnUpdateProfile').addEventListener('click', updateCurrentProfile);
    document.getElementById('btnApplySettings').addEventListener('click', applyAndClose);
    document.getElementById('btnTestAI').addEventListener('click', testAIConnection);
    document.getElementById('btnSaveAI').addEventListener('click', saveAIConfig);
    document.getElementById('aiEnabled').addEventListener('change', toggleAIConfigFields);

    document.getElementById('volumeSlider').addEventListener('input', function() {
        updateMokugyoVolume(parseInt(this.value));
        localStorage.setItem(VOLUME_PREF_KEY, this.value);
    });

    document.getElementById('inputSplit').addEventListener('input', updateSettingsPreview);
    document.getElementById('inputExec').addEventListener('input', updateSettingsPreview);
    document.getElementById('inputReview').addEventListener('input', updateSettingsPreview);

    document.getElementById('ideaInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && e.target.value.trim()) {
            captureIdea(e.target.value.trim());
            e.target.value = '';
        }
    });

    // 拆分卡：大问题输入 + 添加任务
    document.getElementById('splitBigProblem').addEventListener('input', syncSplitBigProblem);
    document.getElementById('btnAddTask').addEventListener('click', addTask);

    // 执行卡：R2 按需添加/移除
    document.getElementById('btnToggleRound2').addEventListener('click', () => {
        if (currentRounds < 2) {
            addRound2();
        } else if (canRemoveRound2()) {
            removeRound2();
        }
    });

    // 三张卡内的 AI 按钮
    document.querySelectorAll('[data-ai]').forEach(btn => {
        btn.addEventListener('click', () => requestCardAI(btn.dataset.ai));
    });
    document.querySelectorAll('[data-ai-apply]').forEach(btn => {
        btn.addEventListener('click', () => applyCardAI(btn.dataset.aiApply));
    });
    document.querySelectorAll('[data-ai-dismiss]').forEach(btn => {
        btn.addEventListener('click', () => dismissCardAI(btn.dataset.aiDismiss));
    });

    document.addEventListener('click', function(e) {
        var target = e.target.closest('[data-action]');
        if (!target) return;
        var action = target.dataset.action;

        if (action === 'close' || action.startsWith('close')) {
            var modalId = action.replace('close', '') + 'Modal';
            closeModal(modalId);
            return;
        }

        switch (action) {
            case 'stuck-smaller': handleStuckOption('smaller'); break;
            case 'stuck-angle': handleStuckOption('angle'); break;
            case 'stuck-action': handleStuckOption('action'); break;
            case 'focus-continue': continueTimer(); break;
            case 'focus-distraction': captureDistraction(); break;
            case 'closestop-loss': closeModal('stopLossModal'); break;
            case 'dismiss-time-up': closeModal('timeUpModal'); break;
            case 'rounds-1': setRounds(1); break;
            case 'rounds-2': setRounds(2); break;
        }

        if (action.startsWith('load-profile:')) {
            var name = action.substring('load-profile:'.length);
            loadProfile(name);
        }
        if (action.startsWith('delete-profile:')) {
            var name = action.substring('delete-profile:'.length);
            deleteProfile(name);
        }
    });

    document.getElementById('btnExportGCal').addEventListener('click', exportSelectedToGCal);
    document.getElementById('btnExportICS').addEventListener('click', exportSelectedICS);
}

function openAIConfig() {
    const saved = JSON.parse(localStorage.getItem(AI_CONFIG_KEY) || '{}');
    document.getElementById('aiEnabled').checked = saved.enabled || false;
    document.getElementById('aiEndpoint').value = saved.endpoint || '';
    document.getElementById('aiApiKey').value = saved.apiKey || '';
    document.getElementById('aiModel').value = saved.model || '';
    toggleAIConfigFields();
    showModal('aiConfigModal');
}

var exportSelectedSessions = null;

function exportSelectedToGCal() {
    if (!exportSelectedSessions) return;
    var session = exportSelectedSessions;
    var profile = getActiveProfile();
    var r = profile.rounds || DEFAULT_ROUNDS;
    var totalMs = (profile.split + profile.exec * r + profile.review * r) * 60 * 1000;
    var startDate = new Date(session.startTime || new Date());
    var endDate = new Date(startDate.getTime() + totalMs);

    var outputs = session.phases.map(function(p) {
        return (PHASES[p.phase] ? PHASES[p.phase].name : p.phase) + ': ' + p.output;
    }).join('\n\n');

    var gcalUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
        '&text=' + encodeURIComponent('🍅 番茄钟 - ' + (session.taskName || '')) +
        '&dates=' + startDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z' +
        '/' + endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z' +
        '&details=' + encodeURIComponent(outputs);

    window.open(gcalUrl, '_blank');
    closeModal('exportModal');
    showStatus('已打开 Google Calendar 页面，点击保存即可', 'success');
}

function exportSelectedICS() {
    exportICS();
    closeModal('exportModal');
}

// ---------- 卡级 AI ----------

function buildCardPrompt(card) {
    const c = currentSession.cards;
    if (card === 'split') {
        const tasksTxt = c.split.tasks.map((t, i) => `${i + 1}. ${t.text || '(空)'}${t.criterion ? '（标准：' + t.criterion + '）' : ''}`).join('\n');
        return [
            '你正在使用决策番茄钟的「问题拆分」阶段。',
            '今日大问题：' + (c.split.bigProblem || '(还没写)'),
            '当前拆出的任务：\n' + (tasksTxt || '(还没拆)'),
            '请给出 1–3 个"5–25 分钟可完成、可判断标准"的小任务建议。',
            '格式：每行一个任务，写明"动作"和"如何判断已完成"。'
        ].join('\n\n');
    }
    if (card === 'exec') {
        const phaseKey = PHASE_ORDER[currentPhaseIndex] || 'exec1';
        const r = phaseKey.startsWith('exec') ? parseInt(phaseKey.slice(4)) : 1;
        const rd = c.exec.rounds[r];
        const checked = c.split.tasks.filter(t => rd.checks[t.id]).map(t => '✓ ' + t.text).join('\n');
        return [
            '你正在使用决策番茄钟的「执行」阶段（第 ' + r + ' 轮）。',
            '已完成的任务：\n' + (checked || '(暂无)'),
            '当前产出草稿：\n' + (rd.output || '(还没写)'),
            '请帮我把上述产出整理成更聚焦的「' + ({conclusion:'核心结论', concept:'概念卡', evidence:'证据表', snippet:'文段片段'}[rd.outputType] || '结论') + '」，1–2 段即可。'
        ].join('\n\n');
    }
    if (card === 'review') {
        const phaseKey = PHASE_ORDER[currentPhaseIndex] || 'review1';
        const r = phaseKey.startsWith('review') ? parseInt(phaseKey.slice(6)) : 1;
        const rd = c.review.rounds[r];
        const execRd = c.exec.rounds[r];
        return [
            '你正在使用决策番茄钟的「复盘」阶段（第 ' + r + ' 轮）。',
            '本轮执行产出：\n' + (execRd.output || '(无)'),
            '已写的发现：' + (rd.finding || '(空)'),
            '已写的失误：' + (rd.mistake || '(空)'),
            '已写的下一步：' + (rd.nextStep || '(空)'),
            '请给出 3 行建议（各 1 句话）：① 一个真正的"发现" ② 一个值得记的"失误" ③ 下一个番茄钟最该做的事。'
        ].join('\n\n');
    }
    return '';
}

function requestCardAI(card) {
    const config = JSON.parse(localStorage.getItem(AI_CONFIG_KEY) || '{}');
    if (!config.enabled || !config.apiKey) {
        showStatus('请先在 🤖 AI 配置中启用并填入 API', 'warning');
        return;
    }

    const btn = document.querySelector(`[data-ai="${card}"]`);
    const result = document.querySelector(`[data-ai-result="${card}"]`);
    const textBox = document.querySelector(`[data-ai-text="${card}"]`);
    btn.disabled = true;
    btn.textContent = '⏳ AI 思考中...';

    const prompt = buildCardPrompt(card);

    fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + config.apiKey },
        body: JSON.stringify({ model: config.model, messages: [{ role: 'user', content: prompt }], max_tokens: 600 })
    })
    .then(r => r.json())
    .then(data => {
        btn.disabled = false;
        btn.textContent = aiBtnText(card);
        var text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (text) {
            textBox.textContent = text;
            result.classList.remove('hidden');
        } else {
            showStatus('AI 返回异常，请重试', 'warning');
        }
    })
    .catch(err => {
        btn.disabled = false;
        btn.textContent = aiBtnText(card);
        showStatus('AI 请求失败：' + err.message, 'danger');
    });
}

function aiBtnText(card) {
    return { split: '🤖 让 AI 帮我拆任务', exec: '🤖 让 AI 帮我聚焦/整理', review: '🤖 让 AI 帮我提炼经验' }[card];
}

function applyCardAI(card) {
    const text = document.querySelector(`[data-ai-text="${card}"]`).textContent;
    if (!text) return;
    if (card === 'split') {
        // 把首行作为大问题/或追加到任务区注释中
        const ta = document.getElementById('splitBigProblem');
        ta.value = (ta.value ? ta.value + '\n\n' : '') + '[AI 建议]\n' + text;
        ta.dispatchEvent(new Event('input'));
    } else {
        const phaseKey = PHASE_ORDER[currentPhaseIndex];
        if (card === 'exec' && phaseKey && phaseKey.startsWith('exec')) {
            const r = parseInt(phaseKey.slice(4));
            const ta = document.querySelector(`[data-output="exec${r}"]`);
            ta.value = (ta.value ? ta.value + '\n\n' : '') + text;
            ta.dispatchEvent(new Event('input'));
        } else if (card === 'review' && phaseKey && phaseKey.startsWith('review')) {
            const r = parseInt(phaseKey.slice(6));
            const target = document.querySelector(`[data-review-field="finding${r}"]`);
            if (target && !target.value) {
                target.value = text.split('\n')[0].slice(0, 200);
                target.dispatchEvent(new Event('input'));
            }
        }
    }
    document.querySelector(`[data-ai-result="${card}"]`).classList.add('hidden');
    showStatus('已采用 AI 建议', 'success');
}

function dismissCardAI(card) {
    document.querySelector(`[data-ai-result="${card}"]`).classList.add('hidden');
}

init();

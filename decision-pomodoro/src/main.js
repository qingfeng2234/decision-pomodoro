import './style.css';

import { getActiveProfile, getActiveProfileName, loadProfiles, saveProfiles, SOUND_PREF_KEY, VOLUME_PREF_KEY, PROFILES_KEY, ACTIVE_PROFILE_KEY, DEFAULT_ROUNDS } from './config.js';
import {
    PHASE_ORDER, PHASES, currentRounds, soundMuted, mokugyoVolume,
    updatePhaseOrder, updatePhases, updateCurrentRounds, updateTimeRemaining,
    updateTotalTime, updateCurrentPhaseIndex, updateCurrentSession,
    updateSoundMuted, updateMokugyoVolume, buildPhases
} from './state.js';
import { buildPhaseOrder } from './config.js';
import { toggleSound } from './timer.js';
import { renderPhaseIndicator, updateSubtitle, updateTimerDisplay, updateProgress, updatePhaseUI, showStatus, showModal, closeModal } from './ui.js';
import { loadTodayHistory, renderHistory } from './storage.js';
import { exportICS, exportMarkdown } from './export.js';
import { renderSettings, loadProfile, saveAsNewProfile, updateCurrentProfile, deleteProfile, applyAndClose, updateSettingsPreview, setRounds } from './settings.js';
import { startTimer, pauseTimer, continueTimer, captureDistraction, completePhase, endSession, handleStuckOption, captureIdea } from './timer.js';
import { toggleAIConfigFields, testAIConnection, saveAIConfig, applyAISuggestion, dismissAISuggestion } from './ai.js';

function init() {
    const profile = getActiveProfile();
    updateCurrentRounds(profile.rounds || DEFAULT_ROUNDS);
    const order = buildPhaseOrder(currentRounds);
    updatePhaseOrder(order);
    const phases = buildPhases({ split: profile.split, exec: profile.exec, review: profile.review, rounds: currentRounds });
    updatePhases(phases);
    updateTimeRemaining(phases.split.minutes * 60);
    updateTotalTime(phases.split.minutes * 60);

    // Sound state
    updateSoundMuted(localStorage.getItem(SOUND_PREF_KEY) === 'true');
    document.getElementById('btnSound').textContent = soundMuted ? '🔇' : '🔊';

    const vol = parseInt(localStorage.getItem(VOLUME_PREF_KEY)) || 50;
    updateMokugyoVolume(vol);
    document.getElementById('volumeSlider').value = vol;

    // Init session
    updateCurrentSession({
        date: new Date().toISOString().split('T')[0],
        startTime: null,
        phases: [],
        ideas: [],
        taskName: ''
    });

    // Ensure default profile exists
    if (loadProfiles().length === 0) {
        saveProfiles([{ name: '经典', split: 5, exec: 25, review: 5, rounds: 2 }]);
        localStorage.setItem(ACTIVE_PROFILE_KEY, '经典');
    }

    // 请求浏览器通知权限（阶段完成时弹桌面通知）
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    loadTodayHistory();
    renderPhaseIndicator();
    updateSubtitle(profile.split, profile.exec, profile.review, profile.rounds || DEFAULT_ROUNDS);
    updateTimerDisplay();
    updateProgress();
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
    document.getElementById('btnAISuggest').addEventListener('click', requestAISuggestion);
    document.getElementById('btnApplyAI').addEventListener('click', applyAISuggestion);
    document.getElementById('btnDismissAI').addEventListener('click', dismissAISuggestion);
    document.getElementById('btnSaveNewProfile').addEventListener('click', saveAsNewProfile);
    document.getElementById('btnUpdateProfile').addEventListener('click', updateCurrentProfile);
    document.getElementById('btnApplySettings').addEventListener('click', applyAndClose);
    document.getElementById('btnTestAI').addEventListener('click', testAIConnection);
    document.getElementById('btnSaveAI').addEventListener('click', saveAIConfig);
    document.getElementById('aiEnabled').addEventListener('change', toggleAIConfigFields);

    // Input events
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

    document.getElementById('outputTypeGroup').addEventListener('click', (e) => {
        var btn = e.target.closest('.output-type-btn');
        if (btn) {
            document.getElementById('outputTypeGroup').querySelectorAll('.output-type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            // placeholder update from ui.js setOutputType
            var placeholders = {
                conclusion: '例如：核心结论是 XXX，因为 YYY 证据表明...',
                concept:    '例如：概念卡：「XX效应」— 当 A 条件满足时，B 会自动发生...',
                evidence:   '例如：✅ 支持：实验数据表明... | ❌ 反对：但 XX 情况下不成立...',
                action:     '例如：今天要完成PHE降解实验的样品前处理，具体动作是称取3组沉积物样品各5g'
            };
            document.getElementById('outputInput').placeholder = placeholders[btn.dataset.value] || placeholders.conclusion;
        }
    });

    // Global data-action event delegation
    document.addEventListener('click', function(e) {
        var target = e.target.closest('[data-action]');
        if (!target) return;
        var action = target.dataset.action;

        // Modal actions
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
            case 'apply-ai-suggestion': applyAISuggestion(); break;
            case 'dismiss-ai-suggestion': dismissAISuggestion(); break;
        }

        // Profile actions
        if (action.startsWith('load-profile:')) {
            var name = action.substring('load-profile:'.length);
            loadProfile(name);
        }
        if (action.startsWith('delete-profile:')) {
            var name = action.substring('delete-profile:'.length);
            deleteProfile(name);
        }
    });

    // Export modal actions
    document.getElementById('btnExportGCal').addEventListener('click', exportSelectedToGCal);
    document.getElementById('btnExportICS').addEventListener('click', exportSelectedICS);
}

// AI Config modal
function openAIConfig() {
    const saved = JSON.parse(localStorage.getItem('pomodoro_ai_config') || '{}');
    document.getElementById('aiEnabled').checked = saved.enabled || false;
    document.getElementById('aiEndpoint').value = saved.endpoint || '';
    document.getElementById('aiApiKey').value = saved.apiKey || '';
    document.getElementById('aiModel').value = saved.model || '';
    toggleAIConfigFields();
    showModal('aiConfigModal');
}

// Export helper
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

// AI Suggestion request
function requestAISuggestion() {
    var input = document.getElementById('outputInput').value.trim();
    var currentPhaseKey = PHASE_ORDER[currentPhaseIndex];

    var config = JSON.parse(localStorage.getItem('pomodoro_ai_config') || '{}');
    if (!config.enabled || !config.apiKey) {
        showStatus('请先在 AI 配置中设置并启用 API', 'warning');
        return;
    }

    document.getElementById('btnAISuggest').classList.add('hidden');
    document.getElementById('aiLoading').classList.remove('hidden');

    var prompt = '';
    if (currentPhaseKey === 'split') {
        prompt = '你正在使用决策番茄钟的「问题拆分」阶段。需要把以下大问题拆解为"今天能完成、可判断标准"的小任务。当前输入：\n\n' + (input || '（还没有输入）') + '\n\n请给出具体的下一步行动建议，要求：\n1. 每个任务5-25分钟内可完成\n2. 可判断是否完成\n3. 列出最多3个选项';
    } else if (currentPhaseKey === 'review1' || currentPhaseKey === 'review2') {
        prompt = '你正在使用决策番茄钟的「复盘」阶段。基于以下执行产出，请帮我复盘总结：\n\n' + input + '\n\n请评估：1）是否达到初步完成标准？2）还有哪些遗漏？3）下一步建议';
    } else {
        prompt = '当前正在执行以下任务，请给出建议帮助我保持专注和高效：\n\n' + input + '\n\n请给出1-2条简洁建议';
    }

    fetch(config.endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + config.apiKey
        },
        body: JSON.stringify({
            model: config.model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 500
        })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        document.getElementById('aiLoading').classList.add('hidden');
        var text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (text) {
            document.getElementById('aiSuggestionText').textContent = text;
            document.getElementById('aiSuggestion').classList.remove('hidden');
        } else {
            document.getElementById('btnAISuggest').classList.remove('hidden');
            showStatus('AI 返回异常，请重试', 'warning');
        }
    })
    .catch(function(err) {
        document.getElementById('aiLoading').classList.add('hidden');
        document.getElementById('btnAISuggest').classList.remove('hidden');
        showStatus('AI 请求失败：' + err.message, 'danger');
    });
}

// Go
init();

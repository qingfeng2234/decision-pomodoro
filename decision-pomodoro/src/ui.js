import { PHASE_ORDER, PHASES, currentPhaseIndex, timeRemaining, totalTime } from './state.js';

export function updatePhaseIndicator() {
    document.querySelectorAll('.phase-step').forEach((step, index) => {
        step.classList.remove('active');
        if (index === currentPhaseIndex) {
            step.classList.add('active');
        }
    });
}

export function updatePhaseUI() {
    const currentPhaseKey = PHASE_ORDER[currentPhaseIndex];
    const phase = PHASES[currentPhaseKey];
    document.getElementById('phaseName').textContent = phase.name + '阶段';
    document.getElementById('hintText').textContent = phase.hint;
    document.getElementById('outputLabelIcon').textContent = phase.icon;

    if (currentPhaseKey === 'split') {
        setOutputType('action');
    } else if (currentPhaseKey.startsWith('exec')) {
        setOutputType('conclusion');
    } else if (currentPhaseKey.startsWith('review')) {
        setOutputType('evidence');
    }
}

export function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    document.getElementById('timerDisplay').textContent =
        String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');

    if (timeRemaining <= 60) {
        document.getElementById('timerDisplay').classList.add('warning');
    } else {
        document.getElementById('timerDisplay').classList.remove('warning');
    }
}

export function updateProgress() {
    const progress = ((totalTime - timeRemaining) / totalTime) * 100;
    document.getElementById('progressFill').style.width = progress + '%';
}

export function showStatus(message, type) {
    document.getElementById('statusMessage').textContent = message;
    document.getElementById('statusMessage').className = 'status-message ' + type;
}

export function renderPhaseIndicator() {
    var container = document.getElementById('phaseIndicator');
    container.innerHTML = '';
    PHASE_ORDER.forEach(function(key, index) {
        var phase = PHASES[key];
        var div = document.createElement('div');
        div.className = 'phase-step' + (index === 0 ? ' active' : '');
        div.setAttribute('data-phase', key);
        div.innerHTML = phase.icon + ' ' + phase.name.replace('轮次', '') + '<br><small>' + phase.minutes + 'min</small>';
        container.appendChild(div);
    });
}

export function updateSubtitle(split, exec, review, rounds) {
    var r = rounds || 2;
    var text = split + '分钟拆分 → ' + exec + '分钟执行 → ' + review + '分钟复盘';
    if (r >= 2) {
        text += ' → ' + exec + '分钟执行 → ' + review + '分钟复盘';
    }
    document.getElementById('subtitle').textContent = text + ' → 强制产出';
}

export function updatePhaseIndicatorLabels() {
    document.querySelectorAll('.phase-step').forEach((step, index) => {
        const phaseKey = PHASE_ORDER[index];
        if (PHASES[phaseKey]) {
            step.querySelector('small').textContent = PHASES[phaseKey].minutes + 'min';
        }
    });
}

export function showModal(id) {
    document.getElementById(id).classList.add('show');
}

export function closeModal(id) {
    document.getElementById(id).classList.remove('show');
}

function getOutputType() {
    var active = document.getElementById('outputTypeGroup').querySelector('.output-type-btn.active');
    return active ? active.dataset.value : 'conclusion';
}

function setOutputType(value) {
    document.getElementById('outputTypeGroup').querySelectorAll('.output-type-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.value === value);
    });
    updateOutputPlaceholder(value);
}

function updateOutputPlaceholder(type) {
    var placeholders = {
        conclusion: '例如：核心结论是 XXX，因为 YYY 证据表明...',
        concept:    '例如：概念卡：「XX效应」— 当 A 条件满足时，B 会自动发生...',
        evidence:   '例如：✅ 支持：实验数据表明... | ❌ 反对：但 XX 情况下不成立...',
        action:     '例如：今天要完成PHE降解实验的样品前处理，具体动作是称取3组沉积物样品各5g'
    };
    document.getElementById('outputInput').placeholder = placeholders[type] || placeholders.conclusion;
}

export { getOutputType, setOutputType, updateOutputPlaceholder };

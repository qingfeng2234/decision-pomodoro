import { PHASE_ORDER, PHASES, currentPhaseIndex, timeRemaining, totalTime } from './state.js';
import { updateCardActivation } from './cards.js';

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
    if (!currentPhaseKey) return;
    const phase = PHASES[currentPhaseKey];
    const nameEl = document.getElementById('phaseName');
    if (nameEl) nameEl.textContent = phase.name + '阶段';
    updateCardActivation();
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

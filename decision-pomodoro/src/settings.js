import {
    loadProfiles, saveProfiles, getActiveProfileName, getActiveProfile,
    MAX_PROFILES, DEFAULT_ROUNDS
} from './config.js';
import {
    PHASE_ORDER, PHASES, currentRounds, tempRounds,
    updatePhaseOrder, updatePhases, updateCurrentRounds, updateTempRounds,
    updateTimeRemaining, updateTotalTime, updateCurrentPhaseIndex,
    buildPhases
} from './state.js';
import { buildPhaseOrder, PROFILES_KEY, ACTIVE_PROFILE_KEY } from './config.js';
import { renderPhaseIndicator, updateSubtitle, updateTimerDisplay, updateProgress, updatePhaseUI, showStatus, showModal, closeModal } from './ui.js';
import { renderAllCards, renderRoundToggle } from './cards.js';

import { isRunning } from './state.js';

export function renderSettings() {
    const profiles = loadProfiles();
    const activeName = getActiveProfileName();
    const active = getActiveProfile();

    const listEl = document.getElementById('profilesList');
    if (profiles.length === 0) {
        listEl.innerHTML = '<div style="font-size:13px;color:#94a8be;padding:8px;">暂无保存的配置</div>';
    } else {
        listEl.innerHTML = profiles.map(function(p) {
            const isActive = p.name === activeName;
            var r = p.rounds || DEFAULT_ROUNDS;
            const total = p.split + p.exec * r + p.review * r;
            return '<div class="export-session-item" style="' + (isActive ? 'border:2px solid #667eea;background:#f0f4ff;' : '') + '">' +
                '<div style="flex:1;">' +
                '<strong>' + (isActive ? '● ' : '') + p.name + '</strong>' +
                '<small style="color:#5c7a9a;margin-left:8px;">(' + p.split + '/' + p.exec + '/' + p.review + ' · ' + r + '轮 · ' + total + 'min)</small>' +
                '</div>' +
                '<button class="btn btn-secondary" style="flex:none;min-width:auto;padding:4px 10px;font-size:12px;" data-action="load-profile:' + p.name.replace(/'/g, "\\'") + '">加载</button>' +
                '<button class="btn btn-danger" style="flex:none;min-width:auto;padding:4px 10px;font-size:12px;margin-left:4px;" data-action="delete-profile:' + p.name.replace(/'/g, "\\'") + '">删除</button>' +
                '</div>';
        }).join('');
    }

    document.getElementById('inputSplit').value = active.split;
    document.getElementById('inputExec').value = active.exec;
    document.getElementById('inputReview').value = active.review;

    document.getElementById('btnRounds1').classList.toggle('active', (active.rounds || DEFAULT_ROUNDS) === 1);
    document.getElementById('btnRounds2').classList.toggle('active', (active.rounds || DEFAULT_ROUNDS) === 2);

    updateSettingsPreview();
    showModal('settingsModal');
}

export function loadProfile(name) {
    const profiles = loadProfiles();
    const p = profiles.find(function(item) { return item.name === name; });
    if (!p) return;

    document.getElementById('inputSplit').value = p.split;
    document.getElementById('inputExec').value = p.exec;
    document.getElementById('inputReview').value = p.review;

    updateTempRounds(p.rounds || DEFAULT_ROUNDS);
    document.getElementById('btnRounds1').classList.toggle('active', tempRounds === 1);
    document.getElementById('btnRounds2').classList.toggle('active', tempRounds === 2);

    localStorage.setItem(ACTIVE_PROFILE_KEY, name);
    updateSettingsPreview();
    renderSettings();
}

export function saveAsNewProfile() {
    const profiles = loadProfiles();
    if (profiles.length >= MAX_PROFILES) {
        showStatus('最多保存 ' + MAX_PROFILES + ' 个配置，请先删除一个', 'warning');
        return;
    }

    const name = prompt('请输入配置名称（如：专注写作、快速决策）：');
    if (!name || !name.trim()) return;
    const trimName = name.trim();

    if (profiles.find(function(p) { return p.name === trimName; })) {
        showStatus('名称 "' + trimName + '" 已存在，请更换', 'warning');
        return;
    }

    const split = clamp(parseInt(document.getElementById('inputSplit').value) || 5, 1, 30);
    const exec = clamp(parseInt(document.getElementById('inputExec').value) || 25, 5, 90);
    const review = clamp(parseInt(document.getElementById('inputReview').value) || 5, 1, 30);

    profiles.push({ name: trimName, split: split, exec: exec, review: review, rounds: tempRounds });
    saveProfiles(profiles);
    localStorage.setItem(ACTIVE_PROFILE_KEY, trimName);
    showStatus('配置 "' + trimName + '" 已保存', 'success');
    renderSettings();
}

export function updateCurrentProfile() {
    const activeName = getActiveProfileName();
    const profiles = loadProfiles();
    const idx = profiles.findIndex(function(p) { return p.name === activeName; });

    if (idx === -1) {
        showStatus('请先选择一个配置', 'warning');
        return;
    }

    profiles[idx].split = clamp(parseInt(document.getElementById('inputSplit').value) || 5, 1, 30);
    profiles[idx].exec = clamp(parseInt(document.getElementById('inputExec').value) || 25, 5, 90);
    profiles[idx].review = clamp(parseInt(document.getElementById('inputReview').value) || 5, 1, 30);
    profiles[idx].rounds = tempRounds;

    saveProfiles(profiles);
    showStatus('配置 "' + activeName + '" 已更新', 'success');
    renderSettings();
}

export function deleteProfile(name) {
    const profiles = loadProfiles();
    if (profiles.length <= 1) {
        showStatus('至少保留一个配置', 'warning');
        return;
    }
    if (!confirm('确定删除配置 "' + name + '" 吗？')) return;

    const newProfiles = profiles.filter(function(p) { return p.name !== name; });
    saveProfiles(newProfiles);

    if (getActiveProfileName() === name) {
        localStorage.setItem(ACTIVE_PROFILE_KEY, newProfiles[0].name);
    }

    showStatus('配置 "' + name + '" 已删除', 'info');
    renderSettings();
}

export function applyAndClose() {
    const split = clamp(parseInt(document.getElementById('inputSplit').value) || 5, 1, 30);
    const exec = clamp(parseInt(document.getElementById('inputExec').value) || 25, 5, 90);
    const review = clamp(parseInt(document.getElementById('inputReview').value) || 5, 1, 30);

    document.getElementById('inputSplit').value = split;
    document.getElementById('inputExec').value = exec;
    document.getElementById('inputReview').value = review;

    updateCurrentRounds(tempRounds);
    const newOrder = buildPhaseOrder(tempRounds);
    updatePhaseOrder(newOrder);
    const newPhases = buildPhases({ split: split, exec: exec, review: review, rounds: tempRounds });
    updatePhases(newPhases);
    updateTimeRemaining(newPhases.split.minutes * 60);
    updateTotalTime(newPhases.split.minutes * 60);
    updateCurrentPhaseIndex(0);

    renderPhaseIndicator();
    updateSubtitle(split, exec, review, tempRounds);
    updateTimerDisplay();
    updateProgress();
    updatePhaseUI();
    renderAllCards();
    renderRoundToggle();

    closeModal('settingsModal');
    var r = tempRounds;
    var total = split + exec * r + review * r;
    showStatus('设置已保存，总时长 ' + total + ' 分钟', 'success');
}

export function onPresetChange() {
    var preset = document.getElementById('presetSelect').value;
    // preset select doesn't exist in current HTML - kept for compatibility
    updateSettingsPreview();
}

export function updateSettingsPreview() {
    var split = clamp(parseInt(document.getElementById('inputSplit').value) || 0, 1, 30);
    var exec = clamp(parseInt(document.getElementById('inputExec').value) || 0, 5, 90);
    var review = clamp(parseInt(document.getElementById('inputReview').value) || 0, 1, 30);
    var r = tempRounds || DEFAULT_ROUNDS;
    var total = split + exec * r + review * r;
    var breakdown = split + ' + ' + exec + ' + ' + review;
    if (r >= 2) breakdown += ' + ' + exec + ' + ' + review;
    document.getElementById('settingsPreview').textContent =
        '总时长: ' + total + ' 分钟（' + r + '轮: ' + breakdown + '）';
}

export function setRounds(n) {
    updateTempRounds(n);
    document.getElementById('btnRounds1').classList.toggle('active', n === 1);
    document.getElementById('btnRounds2').classList.toggle('active', n === 2);
    updateSettingsPreview();
}

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

// v3.0 三胶囊卡数据模型 + 渲染
// 数据放在 currentSession.cards 下，结构：
// {
//   split:  { bigProblem: '', tasks: [{id, text, criterion}] }
//   exec:   { rounds: { 1: {checks:{taskId:true}, outputType, output, stuck}, 2: {...} } }
//   review: { rounds: { 1: {finding, mistake, nextStep}, 2: {...} } }
// }

import { currentSession, updateCurrentSession, PHASE_ORDER, PHASES, currentPhaseIndex, currentRounds, updateCurrentRounds, updatePhaseOrder, updatePhases, buildPhases } from './state.js';
import { buildPhaseOrder, getActiveProfile, DEFAULT_ROUNDS } from './config.js';

export const SESSION_VERSION = 3;

export function ensureCardsInit() {
    if (!currentSession.cards) {
        const session = { ...currentSession };
        session.version = SESSION_VERSION;
        session.cards = freshCards();
        updateCurrentSession(session);
    }
}

export function freshCards() {
    return {
        split: { bigProblem: '', tasks: [] },
        exec: { rounds: { 1: emptyExecRound(), 2: emptyExecRound() } },
        review: { rounds: { 1: emptyReviewRound(), 2: emptyReviewRound() } }
    };
}

function emptyExecRound() {
    return { checks: {}, outputType: 'conclusion', output: '', stuck: '' };
}

function emptyReviewRound() {
    return { finding: '', mistake: '', nextStep: '' };
}

let taskCounter = 1;
function newTaskId() { return 't' + (taskCounter++) + '-' + Math.floor(performance.now() * 1000) % 100000; }

// ---------- 拆分卡 ----------

export function renderSplitCard() {
    ensureCardsInit();
    const c = currentSession.cards.split;
    document.getElementById('splitBigProblem').value = c.bigProblem || '';

    const list = document.getElementById('splitTasksList');
    list.innerHTML = '';
    c.tasks.forEach(task => list.appendChild(buildTaskItem(task)));
}

function buildTaskItem(task) {
    const wrap = document.createElement('div');
    wrap.className = 'task-item';
    wrap.dataset.taskId = task.id;
    wrap.innerHTML = `
        <div class="task-fields">
            <input class="task-text" type="text" placeholder="任务描述，5-25 分钟可完成" value="${escapeAttr(task.text)}">
            <input class="task-criterion" type="text" placeholder="完成判断标准（怎么算做完？）" value="${escapeAttr(task.criterion)}">
        </div>
        <button type="button" class="task-remove" title="删除">×</button>
    `;
    wrap.querySelector('.task-text').addEventListener('input', e => {
        task.text = e.target.value;
        syncChecklists();
    });
    wrap.querySelector('.task-criterion').addEventListener('input', e => {
        task.criterion = e.target.value;
        syncChecklists();
    });
    wrap.querySelector('.task-remove').addEventListener('click', () => removeTask(task.id));
    return wrap;
}

export function addTask() {
    ensureCardsInit();
    const session = { ...currentSession };
    if (session.cards.split.tasks.length >= 6) return;
    session.cards.split.tasks.push({ id: newTaskId(), text: '', criterion: '' });
    updateCurrentSession(session);
    renderSplitCard();
    syncChecklists();
}

function removeTask(id) {
    const session = { ...currentSession };
    session.cards.split.tasks = session.cards.split.tasks.filter(t => t.id !== id);
    // 同步移除 exec/review 勾选
    [1, 2].forEach(r => { delete session.cards.exec.rounds[r].checks[id]; });
    updateCurrentSession(session);
    renderSplitCard();
    syncChecklists();
}

export function syncSplitBigProblem() {
    ensureCardsInit();
    const session = { ...currentSession };
    session.cards.split.bigProblem = document.getElementById('splitBigProblem').value;
    if (!session.taskName) session.taskName = session.cards.split.bigProblem.substring(0, 50);
    updateCurrentSession(session);
}

// ---------- 执行卡 ----------

export function renderExecCard() {
    ensureCardsInit();
    for (let r = 1; r <= currentRounds; r++) {
        renderExecRound(r);
    }
    // 根据 currentRounds 显隐 R2
    document.getElementById('execRound2').classList.toggle('hidden', currentRounds < 2);
    document.getElementById('reviewRound2').classList.toggle('hidden', currentRounds < 2);
    renderRoundToggle();
}

function renderExecRound(r) {
    const cardR = currentSession.cards.exec.rounds[r];
    const checkList = document.querySelector(`[data-checklist="exec${r}"]`);
    checkList.innerHTML = '';
    const tasks = currentSession.cards.split.tasks.filter(t => t.text.trim());
    if (tasks.length === 0) {
        checkList.innerHTML = '<div class="task-check-empty">先在「拆分」卡里写出任务</div>';
    } else {
        tasks.forEach(t => {
            const done = !!cardR.checks[t.id];
            const item = document.createElement('label');
            item.className = 'task-check-item' + (done ? ' done' : '');
            item.innerHTML = `
                <input type="checkbox" ${done ? 'checked' : ''}>
                <span><span class="task-check-text">${escapeText(t.text)}</span><span class="task-check-criterion">${t.criterion ? '· ' + escapeText(t.criterion) : ''}</span></span>
            `;
            item.querySelector('input').addEventListener('change', e => {
                const session = { ...currentSession };
                session.cards.exec.rounds[r].checks[t.id] = e.target.checked;
                updateCurrentSession(session);
                item.classList.toggle('done', e.target.checked);
                // 同步复盘卡
                renderReviewChecklist(r);
            });
            checkList.appendChild(item);
        });
    }

    // output type buttons
    const grp = document.querySelector(`[data-output-types="exec${r}"]`);
    grp.querySelectorAll('.output-type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === cardR.outputType);
    });
    updateOutputTypeLabel(r, cardR.outputType);
    grp.onclick = e => {
        const btn = e.target.closest('.output-type-btn');
        if (!btn) return;
        const session = { ...currentSession };
        session.cards.exec.rounds[r].outputType = btn.dataset.value;
        updateCurrentSession(session);
        grp.querySelectorAll('.output-type-btn').forEach(b => b.classList.toggle('active', b === btn));
        updateOutputTypeLabel(r, btn.dataset.value);
    };

    // output textarea
    const ta = document.querySelector(`[data-output="exec${r}"]`);
    ta.value = cardR.output || '';
    ta.oninput = e => {
        const session = { ...currentSession };
        session.cards.exec.rounds[r].output = e.target.value;
        updateCurrentSession(session);
    };

    // stuck
    const stuck = document.querySelector(`[data-stuck="exec${r}"]`);
    stuck.value = cardR.stuck || '';
    stuck.oninput = e => {
        const session = { ...currentSession };
        session.cards.exec.rounds[r].stuck = e.target.value;
        updateCurrentSession(session);
    };
}

// ---------- 复盘卡 ----------

export function renderReviewCard() {
    ensureCardsInit();
    [1, 2].forEach(r => {
        renderReviewChecklist(r);
        renderReviewFields(r);
    });
}

function renderReviewChecklist(r) {
    const checkList = document.querySelector(`[data-checklist="review${r}"]`);
    if (!checkList) return;
    checkList.innerHTML = '';
    const tasks = currentSession.cards.split.tasks.filter(t => t.text.trim());
    const checks = currentSession.cards.exec.rounds[r].checks;
    if (tasks.length === 0) {
        checkList.innerHTML = '<div class="task-check-empty">无任务</div>';
        return;
    }
    tasks.forEach(t => {
        const done = !!checks[t.id];
        const item = document.createElement('label');
        item.className = 'task-check-item' + (done ? ' done' : '');
        item.innerHTML = `
            <input type="checkbox" ${done ? 'checked' : ''} disabled>
            <span><span class="task-check-text">${escapeText(t.text)}</span><span class="task-check-criterion">${t.criterion ? '· ' + escapeText(t.criterion) : ''}</span></span>
        `;
        checkList.appendChild(item);
    });
}

function renderReviewFields(r) {
    const cardR = currentSession.cards.review.rounds[r];
    const fields = ['finding', 'mistake', 'nextStep'];
    fields.forEach(f => {
        const el = document.querySelector(`[data-review-field="${f}${r}"]`);
        if (!el) return;
        el.value = cardR[f] || '';
        el.oninput = e => {
            const session = { ...currentSession };
            session.cards.review.rounds[r][f] = e.target.value;
            updateCurrentSession(session);
        };
    });
}

// ---------- 卡状态切换 ----------

export function updateCardActivation() {
    const phaseKey = PHASE_ORDER[currentPhaseIndex];
    if (!phaseKey) return;
    const phase = PHASES[phaseKey];

    ['split', 'exec', 'review'].forEach(card => {
        const el = document.getElementById('card' + cap(card));
        el.classList.remove('active', 'locked', 'completed');

        if (card === phase.card) {
            el.classList.add('active');
        } else if (isCardBefore(card, phase.card)) {
            el.classList.add('completed');
        } else {
            el.classList.add('locked');
        }
    });

    // 执行/复盘卡内 R1/R2 激活态
    [1, 2].forEach(r => {
        const exec = document.getElementById('execRound' + r);
        const review = document.getElementById('reviewRound' + r);
        exec.classList.remove('active', 'locked');
        review.classList.remove('active', 'locked');

        const execKey = 'exec' + r;
        const reviewKey = 'review' + r;
        const execIdx = PHASE_ORDER.indexOf(execKey);
        const reviewIdx = PHASE_ORDER.indexOf(reviewKey);

        if (execIdx < 0 || execIdx > currentPhaseIndex) exec.classList.add('locked');
        if (execIdx === currentPhaseIndex) exec.classList.add('active');

        if (reviewIdx < 0 || reviewIdx > currentPhaseIndex) review.classList.add('locked');
        if (reviewIdx === currentPhaseIndex) review.classList.add('active');
    });
}

function isCardBefore(a, b) {
    const order = { split: 0, exec: 1, review: 2 };
    return order[a] < order[b];
}

function cap(s) { return s[0].toUpperCase() + s.slice(1); }

// ---------- 拆分→执行同步 ----------

export function syncChecklists() {
    [1, 2].forEach(r => {
        if (document.querySelector(`[data-checklist="exec${r}"]`)) renderExecRound(r);
        if (document.querySelector(`[data-checklist="review${r}"]`)) renderReviewChecklist(r);
    });
}

// ---------- 阶段产出校验（替代旧的 outputInput 检查） ----------

export function currentPhaseHasInput() {
    const key = PHASE_ORDER[currentPhaseIndex];
    if (!key) return false;
    const c = currentSession.cards;
    if (key === 'split') {
        return !!(c.split.bigProblem.trim() || c.split.tasks.some(t => t.text.trim()));
    }
    if (key.startsWith('exec')) {
        const r = parseInt(key.slice(4));
        return !!c.exec.rounds[r].output.trim();
    }
    if (key.startsWith('review')) {
        const r = parseInt(key.slice(6));
        const rd = c.review.rounds[r];
        return !!(rd.finding.trim() || rd.mistake.trim() || rd.nextStep.trim());
    }
    return false;
}

export function currentPhaseSnapshot() {
    const key = PHASE_ORDER[currentPhaseIndex];
    if (!key) return { output: '', outputType: '', outputTypeName: '' };
    const c = currentSession.cards;
    if (key === 'split') {
        const tasksTxt = c.split.tasks
            .filter(t => t.text.trim())
            .map((t, i) => `${i + 1}. ${t.text}${t.criterion ? '（标准：' + t.criterion + '）' : ''}`)
            .join('\n');
        return {
            output: c.split.bigProblem + (tasksTxt ? '\n\n任务清单：\n' + tasksTxt : ''),
            outputType: 'split',
            outputTypeName: '问题拆分'
        };
    }
    if (key.startsWith('exec')) {
        const r = parseInt(key.slice(4));
        const rd = c.exec.rounds[r];
        const typeMap = { conclusion: '🎯 主结论', concept: '💡 概念卡', evidence: '📊 证据表', snippet: '📝 文段/代码' };
        return {
            output: rd.output + (rd.stuck.trim() ? '\n\n[卡住记录] ' + rd.stuck : ''),
            outputType: rd.outputType,
            outputTypeName: typeMap[rd.outputType] || rd.outputType
        };
    }
    if (key.startsWith('review')) {
        const r = parseInt(key.slice(6));
        const rd = c.review.rounds[r];
        const lines = [];
        if (rd.finding.trim()) lines.push('💡 发现：' + rd.finding);
        if (rd.mistake.trim()) lines.push('⚠️ 失误：' + rd.mistake);
        if (rd.nextStep.trim()) lines.push('➡️ 下一步：' + rd.nextStep);
        return { output: lines.join('\n'), outputType: 'review', outputTypeName: '复盘' };
    }
    return { output: '', outputType: '', outputTypeName: '' };
}

// ---------- 工具 ----------

function escapeAttr(s) { return String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
function escapeText(s) { return String(s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

export function renderAllCards() {
    renderSplitCard();
    renderExecCard();
    renderReviewCard();
    updateCardActivation();
}

// ---------- R2 按需添加/移除 ----------

const TYPE_LABELS = { conclusion: '主结论', concept: '概念卡', evidence: '证据表', snippet: '文段/代码' };

function updateOutputTypeLabel(r, value) {
    const label = document.querySelector(`[data-output-type-label="exec${r}"]`);
    if (label) label.textContent = TYPE_LABELS[value] || '主结论';
}

export function canRemoveRound2() {
    const idx = PHASE_ORDER.indexOf('exec2');
    return idx >= 0 && currentPhaseIndex < idx;
}

export function addRound2() {
    if (currentRounds >= 2) return;
    const profile = getActiveProfile();
    updateCurrentRounds(2);
    updatePhaseOrder(buildPhaseOrder(2));
    updatePhases(buildPhases({ split: profile.split, exec: profile.exec, review: profile.review, rounds: 2 }));
    renderAllCards();
    refreshPhaseHeader();
}

export function removeRound2() {
    if (currentRounds < 2 || !canRemoveRound2()) return;
    const session = { ...currentSession };
    session.cards.exec.rounds[2] = { checks: {}, outputType: 'conclusion', output: '', stuck: '' };
    session.cards.review.rounds[2] = { finding: '', mistake: '', nextStep: '' };
    updateCurrentSession(session);

    const profile = getActiveProfile();
    updateCurrentRounds(1);
    updatePhaseOrder(buildPhaseOrder(1));
    updatePhases(buildPhases({ split: profile.split, exec: profile.exec, review: profile.review, rounds: 1 }));
    renderAllCards();
    refreshPhaseHeader();
}

function refreshPhaseHeader() {
    // 动态 import 避免循环依赖
    import('./ui.js').then(ui => {
        ui.renderPhaseIndicator();
        const profile = getActiveProfile();
        ui.updateSubtitle(profile.split, profile.exec, profile.review, currentRounds);
        ui.updatePhaseUI();
    });
}

export function renderRoundToggle() {
    const btn = document.getElementById('btnToggleRound2');
    if (!btn) return;
    if (currentRounds < 2) {
        btn.textContent = '+ 添加轮次 2';
        btn.classList.remove('remove-mode');
        btn.disabled = false;
        btn.title = '在 1 轮模式下追加第 2 轮（执行 + 复盘）';
    } else if (canRemoveRound2()) {
        btn.textContent = '− 移除轮次 2';
        btn.classList.add('remove-mode');
        btn.disabled = false;
        btn.title = '尚未进入第 2 轮，可以撤销';
    } else {
        btn.textContent = '✓ 已启用 2 轮';
        btn.classList.remove('remove-mode');
        btn.disabled = true;
        btn.title = '已经在执行第 2 轮，无法撤销';
    }
}

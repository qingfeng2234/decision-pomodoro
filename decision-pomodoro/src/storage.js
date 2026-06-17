import { currentSession, PHASES, PHASE_ORDER, currentRounds } from './state.js';
import { DEFAULT_ROUNDS } from './config.js';

export function saveSession() {
    if (currentSession.phases.length === 0 && currentSession.ideas.length === 0) return;

    const key = 'pomodoro_' + currentSession.date;
    const sessions = JSON.parse(localStorage.getItem(key) || '[]');
    sessions.push({...currentSession});
    localStorage.setItem(key, JSON.stringify(sessions));
}

export function loadTodayHistory() {
    renderHistory();
}

export function renderHistory() {
    const key = 'pomodoro_' + new Date().toISOString().split('T')[0];
    const sessions = JSON.parse(localStorage.getItem(key) || '[]');

    if (sessions.length === 0) {
        document.getElementById('historyList').innerHTML = '<div class="history-item">今天还没有记录</div>';
        return;
    }

    document.getElementById('historyList').innerHTML = sessions.map((session, index) => {
        const phaseSummary = session.phases.map(p => {
            var icon = PHASES[p.phase] ? PHASES[p.phase].icon : '🔹';
            var name = PHASES[p.phase] ? PHASES[p.phase].name : p.phase;
            return icon + ' ' + (p.outputTypeName || name) + ': ' + p.output.substring(0, 30) + (p.output.length > 30 ? '...' : '');
        }).join('<br>');

        const ideaSummary = session.ideas.length > 0
            ? `<br><strong>💭 延后想法 (${session.ideas.length}个):</strong> ${session.ideas.map(i => i.text).join('；').substring(0, 60)}...`
            : '';

        return `
            <div class="history-item">
                <div class="history-time">#${index + 1} ${new Date(session.startTime).toLocaleTimeString('zh-CN')}</div>
                <div><strong>任务：</strong>${session.taskName || '未命名'}</div>
                <div>${phaseSummary}</div>
                ${ideaSummary}
            </div>
        `;
    }).join('');
}

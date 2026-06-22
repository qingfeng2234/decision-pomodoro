import { getActiveProfile, DEFAULT_ROUNDS } from './config.js';
import { PHASES, PHASE_ORDER } from './state.js';
import { showStatus, showModal } from './ui.js';

function escapeICS(str) {
    if (!str) return '';
    return String(str)
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\r\n|\r|\n/g, '\\n');
}

export function exportICS() {
    const key = 'pomodoro_' + new Date().toISOString().split('T')[0];
    const sessions = JSON.parse(localStorage.getItem(key) || '[]');

    if (sessions.length === 0) {
        alert('今天还没有记录，先完成一轮再导出');
        return;
    }

    const latestSession = sessions[sessions.length - 1];
    const startDate = new Date(latestSession.startTime || new Date());
    var profile = getActiveProfile();
    var r = profile.rounds || DEFAULT_ROUNDS;
    var totalMs = (profile.split + profile.exec * r + profile.review * r) * 60 * 1000;
    const endDate = new Date(startDate.getTime() + totalMs);

    const formatDate = (date) => {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const outputs = latestSession.phases.map(p => {
        var name = PHASES[p.phase] ? PHASES[p.phase].name : p.phase;
        return name + ': [' + (p.outputTypeName || '') + '] ' + p.output;
    }).join('\\\\n\\\\n');

    const ideas = latestSession.ideas.length > 0
        ? '\\\\n\\\\n延后想法：\\\\n' + latestSession.ideas.map(i => `- ${i.text}`).join('\\\\n')
        : '';

    var desc = outputs + ideas;
    if (latestSession.linkedEvent) {
        const le = latestSession.linkedEvent;
        desc += '\\\\n\\\\n📅 关联日程: ' + le.title + (le.isAllDay ? ' (全天)' : '') + '\\\\n(' + (le.start||'') + ' — ' + (le.end||'') + ')';
    }

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Decision Pomodoro//CN
BEGIN:VEVENT
UID:${Date.now()}@decision-pomodoro
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(endDate)}
SUMMARY:${escapeICS('🍅 决策番茄钟 - ' + (latestSession.taskName || '专注 session'))}
DESCRIPTION:${escapeICS(desc)}
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `decision-pomodoro-${new Date().toISOString().split('T')[0]}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showStatus('已导出 .ics 文件，拖入 Google Calendar 即可导入', 'success');
}

export function exportMarkdown() {
    const key = 'pomodoro_' + new Date().toISOString().split('T')[0];
    const sessions = JSON.parse(localStorage.getItem(key) || '[]');

    if (sessions.length === 0) {
        alert('今天还没有记录，先完成一轮再导出');
        return;
    }

    const today = new Date().toISOString().split('T')[0];
    let md = '# 🍅 番茄钟记录 - ' + today + '\n\n';
    md += '> 自动生成于 ' + new Date().toLocaleString('zh-CN') + '\n\n';
    md += '---\n\n';

    sessions.forEach((session, index) => {
        const startTime = session.startTime ? new Date(session.startTime) : null;
        const startTimeStr = startTime ? startTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '--:--';

        const lastPhase = session.phases.length > 0 ? session.phases[session.phases.length - 1] : null;
        const endTime = lastPhase && lastPhase.completedAt ? new Date(lastPhase.completedAt) : null;
        const endTimeStr = endTime ? endTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '--:--';

        md += '## 轮次 ' + (index + 1) + ' - ' + startTimeStr + ' ~ ' + endTimeStr + '\\n\\n';
        md += '**任务：** ' + (session.taskName || '未命名任务') + '\\n\\n';

        if (session.linkedEvent) {
            const le = session.linkedEvent;
            md += '**📅 关联日程：** ' + le.title + (le.isAllDay ? '（全天）' : '') + '\\n\\n';
        }

        if (session.phases.length > 0) {
            md += '| 阶段 | 类型 | 产出 |\n';
            md += '|------|------|------|\n';
            session.phases.forEach(p => {
                const icon = PHASES[p.phase] ? PHASES[p.phase].icon : '🔹';
                const phaseName = PHASES[p.phase] ? PHASES[p.phase].name : p.phase;
                const typeName = p.outputTypeName || p.outputType || '未分类';
                const output = (p.output || '').replace(/\n/g, ' ').replace(/\|/g, '\\|') || '（无产出）';
                md += '| ' + icon + ' ' + phaseName + ' | ' + typeName + ' | ' + output + ' |\n';
            });
            md += '\n';
        }

        const reviews = session.phases.filter(p => p.phase.startsWith('review'));
        if (reviews.length > 0) {
            md += '**📝 复盘笔记：**\n\n';
            reviews.forEach(r => {
                const reviewName = PHASES[r.phase] ? PHASES[r.phase].name : r.phase;
                const output = r.output || '（无笔记）';
                md += '- **' + reviewName + '：** ' + output.replace(/\n/g, ' ') + '\n';
            });
            md += '\n';
        }

        const isCompleted = session.phases.length >= PHASE_ORDER.length;
        const review1 = session.phases.find(p => p.phase === 'review1');
        const review2 = session.phases.find(p => p.phase === 'review2');
        let completionStatus = '未完成';
        if (isCompleted) {
            if (review2 && review2.output) {
                const lowerOutput = review2.output.toLowerCase();
                if (lowerOutput.includes('达标') || lowerOutput.includes('完成') || lowerOutput.includes('yes')) {
                    completionStatus = '✅ 达标完成';
                } else {
                    completionStatus = '⚠️ 已完成但未完全达标';
                }
            } else {
                completionStatus = '✅ 已完整执行';
            }
        } else if (session.phases.length > 0) {
            completionStatus = '⏸️ 进行中（' + session.phases.length + '/' + PHASE_ORDER.length + ' 阶段）';
        }
        md += '**完成情况：** ' + completionStatus + '\n\n';

        if (session.ideas && session.ideas.length > 0) {
            md += '**💭 延后想法：**\n\n';
            session.ideas.forEach(idea => {
                md += '- [' + (idea.capturedAt || '--:--') + '] ' + idea.text + '\n';
            });
            md += '\n';
        }

        md += '---\n\n';
    });

    md += '\n*由决策番茄钟自动生成*\n';

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
    const timeStr = pad(now.getHours()) + pad(now.getMinutes());
    const filename = '番茄钟-' + dateStr + '-' + timeStr + '.md';

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showStatus('已下载 ' + filename, 'success');
}

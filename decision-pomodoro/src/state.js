import { buildPhaseOrder, DEFAULT_ROUNDS } from './config.js';

export function buildPhases(s) {
    var phases = {
        split:   { name: '问题拆分',   minutes: s.split,  icon: '🧩', hint: '拆分阶段：把大问题变成"今天能完成的、可判断标准"的小任务' },
        exec1:   { name: '执行轮次1',  minutes: s.exec,   icon: '🎯', hint: '执行阶段：只做拆分好的任务，不想别的' },
        review1: { name: '复盘轮次1',  minutes: s.review, icon: '📝', hint: '复盘阶段：是否达到完成标准？原因是什么？' }
    };
    if (s.rounds >= 2) {
        phases.exec2   = { name: '执行轮次2',  minutes: s.exec,   icon: '🎯', hint: '第二轮执行：继续深入或调整方向' };
        phases.review2 = { name: '复盘轮次2',  minutes: s.review, icon: '📝', hint: '最终复盘：输出主结论/概念卡/证据表/最小行动' };
    }
    return phases;
}

export let currentPhaseIndex = 0;
export let currentRounds = DEFAULT_ROUNDS;
export let tempRounds = DEFAULT_ROUNDS;
export let timeRemaining = 0;
export let totalTime = 0;
export let timerInterval = null;
export let isRunning = false;
export let isPaused = false;
export let currentSession = null;
export let focusCheckTriggered = false;
export let soundMuted = false;
export let mokugyoVolume = 50;
export let audioCtx = null;
export let PHASE_ORDER = [];
export let PHASES = {};

export function updatePhaseOrder(newOrder) {
    PHASE_ORDER = newOrder;
}

export function updatePhases(newPhases) {
    PHASES = newPhases;
}

export function updateCurrentPhaseIndex(index) {
    currentPhaseIndex = index;
}

export function updateCurrentRounds(rounds) {
    currentRounds = rounds;
}

export function updateTempRounds(rounds) {
    tempRounds = rounds;
}

export function updateTimeRemaining(t) {
    timeRemaining = t;
}

export function updateTotalTime(t) {
    totalTime = t;
}

export function updateTimerInterval(interval) {
    timerInterval = interval;
}

export function updateIsRunning(v) {
    isRunning = v;
}

export function updateIsPaused(v) {
    isPaused = v;
}

export function updateCurrentSession(session) {
    currentSession = session;
}

export function updateFocusCheckTriggered(v) {
    focusCheckTriggered = v;
}

export function updateSoundMuted(v) {
    soundMuted = v;
}

export function updateMokugyoVolume(v) {
    mokugyoVolume = v;
}

export function updateAudioCtx(ctx) {
    audioCtx = ctx;
}

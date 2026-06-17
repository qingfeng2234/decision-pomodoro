export const DEFAULT_ROUNDS = 1;

export function buildPhaseOrder(rounds) {
    if (rounds === 1) return ['split', 'exec1', 'review1'];
    return ['split', 'exec1', 'review1', 'exec2', 'review2'];
}

export const TIME_PRESETS = {
    classic: { name: '经典', split: 5, exec: 25, review: 5, rounds: 2 },
    short:   { name: '短时', split: 3, exec: 15, review: 3, rounds: 1 },
    long:    { name: '长时', split: 10, exec: 45, review: 10, rounds: 2 }
};

export const PROFILES_KEY = 'pomodoro_time_profiles';
export const ACTIVE_PROFILE_KEY = 'pomodoro_active_profile';
export const SOUND_PREF_KEY = 'pomodoro_sound_muted';
export const AI_CONFIG_KEY = 'pomodoro_ai_config';
export const VOLUME_PREF_KEY = 'pomodoro_mokugyo_volume';
export const MAX_PROFILES = 5;

export function loadProfiles() {
    try { return JSON.parse(localStorage.getItem(PROFILES_KEY)) || []; }
    catch(e) { return []; }
}

export function saveProfiles(list) {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(list));
}

export function getActiveProfileName() {
    return localStorage.getItem(ACTIVE_PROFILE_KEY) || '';
}

export function getActiveProfile() {
    const name = getActiveProfileName();
    const profiles = loadProfiles();
    return profiles.find(p => p.name === name) || { name: '经典', split: 5, exec: 25, review: 5, rounds: 1 };
}

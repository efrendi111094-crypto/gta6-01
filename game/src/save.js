// save.js: the save game — money, story progress, position and stats,
// kept in localStorage and written after every job and at the Safehouse.

import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      money: state.player.money,
      hp: state.player.hp,
      armor: state.player.armor,
      x: state.player.x,
      y: state.player.y,
      missionsDone: state.missionsDone,
      medallions: state.city.medallions.map((m) => m.taken),
      medallionCount: state.medallions,
      stats: state.stats,
      storyComplete: state.storyComplete,
      clock: state.clock,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(state) {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    state.player.money = data.money ?? 250;
    state.player.hp = data.hp ?? 100;
    state.player.armor = data.armor ?? 0;
    state.player.x = data.x ?? state.player.x;
    state.player.y = data.y ?? state.player.y;
    state.missionsDone = data.missionsDone ?? [];
    state.medallions = data.medallionCount ?? 0;
    state.stats = { ...state.stats, ...(data.stats ?? {}) };
    state.storyComplete = !!data.storyComplete;
    state.clock = data.clock ?? state.clock;
    if (Array.isArray(data.medallions)) {
      data.medallions.forEach((taken, i) => {
        if (state.city.medallions[i]) state.city.medallions[i].taken = !!taken;
      });
    }
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  try {
    return !!window.localStorage.getItem(SAVE_KEY);
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch { /* best-effort */ }
}

// ui.js: the menus — start screen with the story, pause, mission briefing
// and the help panel. All DOM, styled in index.html.

import { STORY_INTRO } from './missions.js';
import { formatMoney } from './utils.js';
import { hasSave } from './save.js';

export function createUi(callbacks) {
  const menu = document.getElementById('menu');
  const pauseMenu = document.getElementById('pause');
  const briefing = document.getElementById('briefing');
  const help = document.getElementById('help');

  function showMenu(state) {
    menu.style.display = 'flex';
    pauseMenu.style.display = 'none';
    briefing.style.display = 'none';
    document.getElementById('story').textContent = STORY_INTRO;
    document.getElementById('continue-btn').style.display = hasSave() ? 'block' : 'none';
    document.getElementById('menu-stats').textContent = state.missionsDone.length > 0
      ? `Jobs done: ${state.missionsDone.length}/5 · ${formatMoney(state.player.money)}`
      : 'A sun-soaked open-world crime game — drive, steal, run, and pay off the debt.';
  }

  function showPause(state) {
    pauseMenu.style.display = 'flex';
    document.getElementById('pause-stats').innerHTML =
      `Money ${formatMoney(state.player.money)} · Jobs ${state.missionsDone.length}/5 · ` +
      `Medallions ${state.medallions}/10 · Cars stolen ${state.stats.carsStolen} · ` +
      `Distance ${Math.round(state.stats.distance / 1000)} km`;
  }

  function showBriefing(mission) {
    document.getElementById('briefing-title').textContent = mission.title;
    document.getElementById('briefing-giver').textContent = `${mission.giver} — new job`;
    document.getElementById('briefing-text').textContent = mission.brief;
    briefing.style.display = 'flex';
  }

  function hideAll() {
    menu.style.display = 'none';
    pauseMenu.style.display = 'none';
    briefing.style.display = 'none';
    help.style.display = 'none';
  }

  document.getElementById('new-btn').addEventListener('click', () => callbacks.onNew());
  document.getElementById('continue-btn').addEventListener('click', () => callbacks.onContinue());
  document.getElementById('help-btn').addEventListener('click', () => {
    help.style.display = help.style.display === 'flex' ? 'none' : 'flex';
  });
  document.getElementById('help-close').addEventListener('click', () => { help.style.display = 'none'; });
  document.getElementById('resume-btn').addEventListener('click', () => callbacks.onResume());
  document.getElementById('save-btn').addEventListener('click', () => callbacks.onSave());
  document.getElementById('quit-btn').addEventListener('click', () => callbacks.onQuit());
  document.getElementById('briefing-go').addEventListener('click', () => {
    briefing.style.display = 'none';
    callbacks.onBriefingDone();
  });

  return { showMenu, showPause, showBriefing, hideAll };
}

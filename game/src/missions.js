// missions.js: the story of Kai Moreno and the five jobs Mara Solis lines up.
// Each mission is a list of steps: go somewhere, pick someone up, steal a car,
// clear a place out, or escape the law. Steps point at the HUD and the minimap.

import { MISSION_REWARDS } from './config.js';
import { dist } from './utils.js';
import { landmarkCenter } from './city.js';
import { notify } from './state.js';
import { addWanted, clearWanted } from './police.js';
import { spawnEnemy } from './combat.js';
import { spawnCar } from './vehicles.js';

export const STORY_INTRO =
  'Kai Moreno drove couriers for the Marina docks until the night his van — and his boss’s money — vanished. '
  + 'Now Mara Solis, the fixer who runs the Sunset, owns his debt. Five jobs. No questions. '
  + 'Pay it off, and Kai walks away clean.';

// Step kinds: goto | pickup | deliver | steal | clear | escape | talk
export const MISSIONS = [
  {
    id: 'm1', title: 'The First Run', giver: 'Mara Solis',
    brief: 'A package is waiting at the Marina office. Pick it up and drop it at the Beachfront kiosk. Drive careful — the cargo is "fragile".',
    steps: [
      { kind: 'goto', at: 'marina', text: 'Pick up the package at Mara’s office' },
      { kind: 'goto', at: 'beachKiosk', text: 'Deliver the package to the Beachfront kiosk' },
    ],
  },
  {
    id: 'm2', title: 'Hot Wheels', giver: 'Mara Solis',
    brief: 'A client wants the red Vela GT parked at the Sunset Casino. Take it. Don’t scratch it. Bring it to the AutoSol Garage.',
    steps: [
      { kind: 'steal', at: 'casino', text: 'Steal the red Vela GT at the Sunset Casino' },
      { kind: 'goto', at: 'garage', text: 'Deliver the Vela GT to the AutoSol Garage', inCar: true },
    ],
  },
  {
    id: 'm3', title: 'Harbor Trouble', giver: 'Mara Solis',
    brief: 'The dock crew at the Harbor Warehouse stopped paying their cut. Go remind them who runs the Sunset. Bring the pistol.',
    steps: [
      { kind: 'goto', at: 'harbor', text: 'Reach the Harbor Warehouse' },
      { kind: 'clear', at: 'harbor', text: 'Clear out the dock crew (4)', count: 4 },
      { kind: 'goto', at: 'marina', text: 'Report back to Mara’s office' },
    ],
  },
  {
    id: 'm4', title: 'Getaway Driver', giver: 'Mara Solis',
    brief: 'Mara’s meeting in Downtown went bad. Pick her up, lose the cops, and bring her home to the Safehouse. She hates sirens.',
    steps: [
      { kind: 'pickup', at: 'downtown', text: 'Pick up Mara in Downtown' },
      { kind: 'escape', at: 'safehouse', text: 'Lose the heat and reach the Safehouse', stars: 3 },
    ],
  },
  {
    id: 'm5', title: 'The Sunset Score', giver: 'Mara Solis',
    brief: 'The last job. The Sunset Casino counts its cash at dusk. Walk in, take the bag, and outrun the whole city to the Safehouse. Then we’re even.',
    steps: [
      { kind: 'goto', at: 'casino', text: 'Get to the Sunset Casino' },
      { kind: 'goto', at: 'casinoVault', text: 'Grab the cash from the count room', grab: true },
      { kind: 'escape', at: 'safehouse', text: 'Escape the 4-star heat — reach the Safehouse', stars: 4 },
    ],
  },
];

function markerPoint(state, key) {
  const c = state.city;
  switch (key) {
    case 'beachKiosk': return { x: c.worldW * 0.3, y: c.worldW + 60, name: 'Beachfront Kiosk' };
    case 'downtown': return { x: 3.5 * 352, y: 1.5 * 352, name: 'Downtown' };
    case 'casinoVault': {
      const p = landmarkCenter(c, 'casino');
      return { x: p.x + 60, y: p.y + 150, name: 'Count Room' };
    }
    default: {
      // Landmark entrances sit just south of the building, where a car or a
      // person can actually stand — never inside the walls.
      const p = landmarkCenter(c, key);
      return { x: p.x, y: p.y + 150, name: p.name };
    }
  }
}

export function nextMission(state) {
  return MISSIONS.find((m) => !state.missionsDone.includes(m.id)) ?? null;
}

export function startMission(state, mission) {
  state.mission = {
    id: mission.id, title: mission.title, giver: mission.giver,
    brief: mission.brief, stepIndex: 0, steps: mission.steps,
    startedAt: state.time, maraInCar: false, cashGrabbed: false,
  };
  applyStep(state);
  notify(state, `New job: ${mission.title}`, 'info', 5);
}

export function currentStep(state) {
  if (!state.mission) return null;
  return state.mission.steps[state.mission.stepIndex] ?? null;
}

function applyStep(state) {
  const step = currentStep(state);
  if (!step) return;
  const point = markerPoint(state, step.at);
  state.objective = step.text;
  state.objectiveTarget = { x: point.x, y: point.y, name: point.name };
  if (step.kind === 'clear' && !step.spawned) {
    step.spawned = true;
    const rngSpots = [[-70, -40], [60, -60], [-40, 70], [80, 50], [0, -90], [40, 90]];
    for (let i = 0; i < (step.count ?? 4); i += 1) {
      const s = rngSpots[i % rngSpots.length];
      spawnEnemy(state, point.x + s[0], point.y + s[1]);
    }
    notify(state, 'Hostiles ahead — clear them out.', 'bad', 4);
  }
  if (step.kind === 'escape' && !step.heatSet) {
    step.heatSet = true;
    state.wanted = Math.max(state.wanted, step.stars ?? 3);
    notify(state, `${step.stars}-star heat! Lose the cops.`, 'bad', 5);
  }
  if (step.kind === 'pickup') {
    // Mara waits at the marker.
    state.maraWaiting = { x: point.x, y: point.y };
  }
}

function completeStep(state, audio) {
  const mission = state.mission;
  mission.stepIndex += 1;
  if (audio) audio.pickup();
  if (mission.stepIndex >= mission.steps.length) {
    completeMission(state, audio);
  } else {
    applyStep(state);
  }
}

function completeMission(state, audio) {
  const mission = state.mission;
  const reward = MISSION_REWARDS[mission.id] ?? 0;
  state.player.money += reward;
  state.missionsDone.push(mission.id);
  state.stats.missions += 1;
  state.mission = null;
  state.objective = '';
  state.objectiveTarget = null;
  state.maraWaiting = null;
  if (audio) audio.cash();
  if (audio) audio.missionDone();
  notify(state, `Job done: ${mission.title} — +$${reward}`, 'good', 6);
  if (state.missionsDone.length >= MISSIONS.length) {
    state.storyComplete = true;
    notify(state, 'STORY COMPLETE — Kai is free. Solmar Bay is yours.', 'good', 8);
  }
  // Auto-save after every job.
  try {
    window.dispatchEvent(new CustomEvent('solmar-autosave'));
  } catch { /* save is best-effort */ }
}

export function failMission(state, reason) {
  if (!state.mission) return;
  notify(state, `Job failed: ${reason}`, 'bad', 5);
  state.mission = null;
  state.objective = '';
  state.objectiveTarget = null;
  state.maraWaiting = null;
  state.enemies = [];
  clearWanted(state, null);
}

// Called every frame while a mission runs.
export function updateMission(state, dt, audio) {
  if (!state.mission) return;
  const step = currentStep(state);
  if (!step) return;
  const p = state.player;
  const point = markerPoint(state, step.at);
  const d = dist(p.x, p.y, point.x, point.y);

  if (step.kind === 'goto' || step.kind === 'pickup') {
    if (d < 70) {
      if (step.inCar && !(p.inCar && p.inCar.missionCar)) {
        state.objective = 'Bring the Vela GT here — on foot won’t cut it';
        return;
      }
      if (step.kind === 'pickup') {
        state.mission.maraInCar = true;
        state.maraWaiting = null;
        notify(state, 'Mara’s in. Drive — and don’t stop for anything.', 'info', 4);
      }
      completeStep(state, audio);
    }
    return;
  }
  if (step.kind === 'steal') {
    if (p.inCar && p.inCar.missionCar) {
      notify(state, 'That’s the one. Now the garage — in one piece.', 'info', 4);
      completeStep(state, audio);
    }
    return;
  }
  if (step.kind === 'clear') {
    if (state.enemies.length === 0) completeStep(state, audio);
    return;
  }
  if (step.kind === 'escape') {
    if (d < 80 && state.wanted === 0) {
      completeStep(state, audio);
    } else if (d < 80 && state.wanted > 0) {
      state.objective = `Lose the heat first — ${state.wanted} star${state.wanted > 1 ? 's' : ''} left`;
    } else {
      state.objective = step.text;
    }
    return;
  }
}

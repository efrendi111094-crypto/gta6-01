// shots.js: staged scenes for the screenshots (?shot=chase|foot|combat|menu).
// Each one sets up the real game — the real rules, the real city — then lets
// it play itself for a couple of seconds under a small autopilot, so the frame
// is what a short game really looks like.

import { roadCenter, landmarkCenter } from './city.js';
import { MISSIONS, startMission } from './missions.js';
import { spawnCar } from './vehicles.js';
import { spawnEnemy } from './combat.js';

// Seconds of live play before the frame is taken.
export const SHOT_DELAY = { chase: 1.7, foot: 1.6, combat: 2.2, menu: 0.6 };

export function stageShot(name, state) {
  const p = state.player;
  if (name === 'chase') {
    // Mid-chase: Kai in the Vela GT, 3 stars, SBPD on his tail, Mara's getaway job live.
    const y = roadCenter(5);
    const car = spawnCar(state, 'vela', roadCenter(4), y, 0, 'player');
    car.color = '#c93a4a';
    car.speed = 380;
    p.inCar = car;
    p.x = car.x; p.y = car.y; p.angle = 0;
    p.money = 1450;
    state.wanted = 3;
    for (let i = 0; i < 3; i += 1) {
      const cop = spawnCar(state, 'police', roadCenter(4) - 120 - i * 90, y + (i % 2 ? 26 : -26), 0, 'police');
      cop.speed = 360;
    }
    const m4 = MISSIONS.find((m) => m.id === 'm4');
    startMission(state, m4);
    state.mission.stepIndex = 1;
    state.mission.maraInCar = true;
    const home = landmarkCenter(state.city, 'safehouse');
    state.objective = 'Lose the heat and reach the Safehouse';
    state.objectiveTarget = { x: home.x, y: home.y, name: 'Safehouse' };
    state.screen = 'play';
    return;
  }
  if (name === 'combat') {
    // Harbor shootout: Kai on foot, four dock rivals, the clear-out job live.
    const harbor = landmarkCenter(state.city, 'harbor');
    p.x = harbor.x - 160;
    p.y = harbor.y + 180;
    p.angle = 0;
    p.aimAngle = 0;
    p.money = 980;
    p.armor = 50;
    const m3 = MISSIONS.find((m) => m.id === 'm3');
    startMission(state, m3);
    state.mission.stepIndex = 1;
    const spots = [[-70, -40], [60, -60], [-40, 70], [80, 50]];
    for (const s of spots) spawnEnemy(state, harbor.x + s[0], harbor.y + 150 + s[1]);
    state.objective = 'Clear out the dock crew (4)';
    state.objectiveTarget = { x: harbor.x, y: harbor.y + 150, name: 'Harbor Warehouse' };
    state.screen = 'play';
    return;
  }
  if (name === 'foot') {
    // On foot in Downtown: traffic, pedestrians, the first job live.
    p.x = roadCenter(2) + 40;
    p.y = roadCenter(2) + 60;
    p.angle = Math.PI / 4;
    p.aimAngle = Math.PI / 4;
    p.money = 250;
    const m1 = MISSIONS.find((m) => m.id === 'm1');
    startMission(state, m1);
    state.screen = 'play';
    return;
  }
  // menu: the start screen as it opens.
  state.screen = 'menu';
}

// Scripted input while a shot plays itself. Returns {ax, ay, steer} overrides
// or null when the shot drives nothing.
export function shotDriver(name, state) {
  const p = state.player;
  if (name === 'chase' && p.inCar) {
    const targetY = roadCenter(5);
    const steer = Math.max(-1, Math.min(1, (targetY - p.inCar.y) * 0.02));
    return { ax: steer, ay: -1, brake: false, mouseDown: false };
  }
  if (name === 'foot') {
    return { ax: 0.4, ay: 0.2, brake: false, mouseDown: false };
  }
  if (name === 'combat') {
    // Aim at the nearest rival and fire.
    let best = null;
    let bestD = Infinity;
    for (const e of state.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < bestD) { best = e; bestD = d; }
    }
    if (best) {
      p.aimAngle = Math.atan2(best.y - p.y, best.x - p.x);
      return { ax: 0, ay: 0, brake: false, mouseDown: true };
    }
  }
  return null;
}

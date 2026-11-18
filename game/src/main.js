// Solmar Bay — main.js: boot, the fixed-step loop, and the wiring between
// systems. The game runs in two modes: the menu, and play. ?seed=N fixes the
// city; ?shot=chase|foot|combat|menu stages a screenshot scene and sets
// window.__shotReady once it has played itself into frame.

import { PLAYER, WORLD } from './config.js';
import { clamp, lerp } from './utils.js';
import { buildCity, landmarkCenter } from './city.js';
import { createState, notify, SCREEN_MENU, SCREEN_PAUSED, SCREEN_PLAY } from './state.js';
import { createInput, ACT_HORN, ACT_INTERACT, ACT_MUTE, ACT_PAUSE } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
import { createHud } from './hud.js';
import { createUi } from './ui.js';
import { populateTraffic, spawnCar, updatePoliceCar, updateTraffic, resolveCarCollisions } from './vehicles.js';
import { populatePeds, updatePeds, checkPedRunOver } from './pedestrians.js';
import { updateWanted, addWanted } from './police.js';
import { updateBullets, updateEnemies, updateParticles } from './combat.js';
import { updateMission } from './missions.js';
import { doInteract, interactTarget, spawnPlayer, updatePlayer } from './player.js';
import { saveGame, loadGame, clearSave } from './save.js';
import { stageShot, shotDriver, SHOT_DELAY } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261119;

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const audio = createAudio();
const renderer = createRenderer(canvas);
const hud = createHud();
const input = createInput(canvas);

function buildFreshState() {
  const state = createState(seed);
  state.audio = audio;
  state.city = buildCity(seed);
  state.shotMode = shot;
  spawnPlayer(state);
  populateTraffic(state);
  populatePeds(state);
  // Health and armor pickups near the hospital and the police station.
  const hospital = landmarkCenter(state.city, 'hospital');
  const station = landmarkCenter(state.city, 'police');
  const garage = landmarkCenter(state.city, 'garage');
  state.pickups = [
    { x: hospital.x - 130, y: hospital.y + 130, kind: 'health', taken: false },
    { x: hospital.x + 130, y: hospital.y - 130, kind: 'health', taken: false },
    { x: station.x + 130, y: station.y + 130, kind: 'armor', taken: false },
    { x: garage.x - 130, y: garage.y - 130, kind: 'armor', taken: false },
  ];
  return state;
}

let state = buildFreshState();
window.__solmarState = state;

function announce(message) {
  statusEl.textContent = message;
}

function updateCamera(state, dt) {
  const p = state.player;
  const lookX = p.inCar ? Math.cos(p.angle) * Math.abs(p.inCar.speed) * 0.25 : 0;
  const lookY = p.inCar ? Math.sin(p.angle) * Math.abs(p.inCar.speed) * 0.25 : 0;
  const targetZoom = p.inCar ? 1 - clamp(Math.abs(p.inCar.speed) / 620, 0, 1) * 0.22 : 1;
  state.camera.x = lerp(state.camera.x, p.x + lookX, 1 - Math.pow(0.001, dt));
  state.camera.y = lerp(state.camera.y, p.y + lookY, 1 - Math.pow(0.001, dt));
  state.camera.zoom = lerp(state.camera.zoom, targetZoom, 1 - Math.pow(0.01, dt));
  const view = renderer.viewSize();
  const hw = view.w / 2 / state.camera.zoom;
  const hh = view.h / 2 / state.camera.zoom;
  state.camera.x = clamp(state.camera.x, hw - 100, state.city.worldW - hw + 100);
  state.camera.y = clamp(state.camera.y, hh - 100, state.city.worldH - hh + 100);
}

function updateWorld(state, dt) {
  state.time += dt;
  state.clock += dt / 1.5; // a game minute every 1.5 real seconds
  // Mouse position in world coordinates, for aiming.
  const view = renderer.viewSize();
  const cam = state.camera;
  input.mouseWorldX = (input.mouse.x - view.w / 2) / cam.zoom + cam.x;
  input.mouseWorldY = (input.mouse.y - view.h / 2) / cam.zoom + cam.y;

  // Scripted input for screenshot scenes.
  let effectiveInput = input;
  if (state.shotMode && state.time < (SHOT_DELAY[state.shotMode] ?? 2) + 1) {
    const drive = shotDriver(state.shotMode, state);
    if (drive) {
      effectiveInput = {
        ...input,
        axis: () => ({ x: drive.ax, y: drive.ay }),
        sprint: () => false,
        handbrake: () => drive.brake,
        mouse: { ...input.mouse, down: drive.mouseDown },
        mouseWorldX: input.mouseWorldX,
        mouseWorldY: input.mouseWorldY,
      };
    }
  }

  updatePlayer(state, effectiveInput, dt, audio);
  for (const car of state.cars) {
    if (car.driver === 'traffic') updateTraffic(state, car, dt);
    else if (car.driver === 'police') updatePoliceCar(state, car, dt, audio);
  }
  resolveCarCollisions(state);
  updatePeds(state, dt);
  updateWanted(state, dt, audio);
  updateEnemies(state, dt, audio);
  updateBullets(state, dt, audio);
  updateParticles(state, dt);
  updateMission(state, dt, audio);

  // Running someone over in the player's car.
  if (state.player.inCar) {
    const hit = checkPedRunOver(state, state.player.inCar, audio);
    if (hit) addWanted(state, 1, 'Pedestrian hit — SBPD alerted.', audio);
  }

  // Engine + siren beds.
  const p = state.player;
  audio.setEngine(!!p.inCar, p.inCar ? clamp(Math.abs(p.inCar.speed) / 620, 0, 1) : 0);
  audio.setSiren(state.wanted > 0);

  updateCamera(state, dt);
}

function startPlaying(state, announceText) {
  state.screen = SCREEN_PLAY;
  ui.hideAll();
  hud.show();
  audio.unlock();
  announce(announceText);
}

const ui = createUi({
  onNew() {
    clearSave();
    state = buildFreshState();
    window.__solmarState = state;
    startPlaying(state, 'New game. Visit Mara’s office for your first job.');
    notify(state, 'Welcome to Solmar Bay. Mara’s office is marked on the map — go see her.', 'info', 6);
  },
  onContinue() {
    const loaded = loadGame(state);
    startPlaying(state, loaded ? 'Save loaded. Welcome back to Solmar Bay.' : 'No save found — starting fresh.');
    if (loaded) notify(state, 'Save loaded. Welcome back, Kai.', 'good', 4);
  },
  onResume() {
    state.screen = SCREEN_PLAY;
    ui.hideAll();
    hud.show();
  },
  onSave() {
    if (saveGame(state)) notify(state, 'Game saved.', 'good', 3);
    else notify(state, 'Save failed — storage unavailable.', 'bad', 3);
  },
  onQuit() {
    saveGame(state);
    state.screen = SCREEN_MENU;
    hud.hide();
    ui.showMenu(state);
  },
  onBriefingDone() {
    // Briefing dismissed; play continues.
  },
});

window.addEventListener('solmar-autosave', () => saveGame(state));
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.screen === SCREEN_PLAY) {
    state.screen = SCREEN_PAUSED;
    ui.showPause(state);
  }
});

// Shot mode: stage the scene, play it live, flag readiness for the screenshot.
let shotReady = false;
if (shot && SHOT_DELAY[shot] !== undefined) {
  stageShot(shot, state);
  if (shot === 'menu') {
    hud.hide();
    ui.showMenu(state);
  } else {
    ui.hideAll();
    hud.show();
  }
} else {
  hud.hide();
  ui.showMenu(state);
}

let accumulator = 0;
let last = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  accumulator += Math.min((now - last) / 1000, MAX_FRAME);
  last = now;

  const { flags } = input.takeActions();
  if (flags & ACT_PAUSE) {
    if (state.screen === SCREEN_PLAY) {
      state.screen = SCREEN_PAUSED;
      ui.showPause(state);
    } else if (state.screen === SCREEN_PAUSED) {
      state.screen = SCREEN_PLAY;
      ui.hideAll();
      hud.show();
    }
  }
  if (flags & ACT_MUTE) {
    state.muted = !state.muted;
    audio.setMuted(state.muted);
    notify(state, state.muted ? 'Sound off (M to turn on).' : 'Sound on.', 'info', 2);
  }
  if (flags & ACT_HORN && state.player.inCar) audio.horn();
  if (flags & ACT_INTERACT && state.screen === SCREEN_PLAY) doInteract(state, audio);

  if (state.screen === SCREEN_PLAY) {
    while (accumulator >= STEP) {
      updateWorld(state, STEP);
      accumulator -= STEP;
    }
    renderer.draw(state);
    const target = interactTarget(state);
    hud.update(state, target ? target.text : (state.player.inCar ? 'WASD drive · Space handbrake · E get out' : 'WASD move · Mouse aim · Click shoot · E interact'));
  } else if (state.screen === SCREEN_MENU) {
    // The menu shows the city alive behind it: idle traffic, no player control.
    while (accumulator >= STEP) {
      state.time += STEP;
      for (const car of state.cars) if (car.driver === 'traffic') updateTraffic(state, car, STEP);
      updatePeds(state, STEP);
      updateParticles(state, STEP);
      accumulator -= STEP;
    }
    renderer.draw(state);
  } else if (state.screen === SCREEN_PAUSED) {
    accumulator = 0;
    renderer.draw(state);
  }

  if (shot && !shotReady && state.time >= (SHOT_DELAY[shot] ?? 2)) {
    shotReady = true;
    window.__shotReady = true;
  }
}

announce('Solmar Bay. An open-world crime game. Press New Game to start.');
requestAnimationFrame(frame);

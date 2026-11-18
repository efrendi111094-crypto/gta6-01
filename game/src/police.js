// police.js: the wanted system — stars rise with crimes, fall when the player
// stays unseen, and the SBPD responds with cars and foot cops per star level.

import { WANTED } from './config.js';
import { clamp, dist, makeRng } from './utils.js';
import { notify } from './state.js';
import { spawnCar } from './vehicles.js';
import { landmarkCenter } from './city.js';

export function addWanted(state, stars, reason, audio) {
  const before = state.wanted;
  state.wanted = clamp(state.wanted + stars, 0, WANTED.maxStars);
  state.wantedTimer = 0;
  state.lastCrimeAt = state.time;
  if (state.wanted > before) {
    notify(state, reason, 'bad', 3);
    if (audio) audio.wantedUp();
  }
}

export function clearWanted(state, reason) {
  state.wanted = 0;
  state.wantedTimer = 0;
  removeAllPolice(state);
  if (reason) notify(state, reason, 'good', 4);
}

export function removeAllPolice(state) {
  state.cars = state.cars.filter((c) => c.driver !== 'police');
  state.cops = [];
}

// Is any officer close enough to see the player?
export function policeNearby(state, radius = 520) {
  const p = state.player;
  for (const car of state.cars) {
    if (car.driver === 'police' && dist(car.x, car.y, p.x, p.y) < radius) return true;
  }
  for (const cop of state.cops) {
    if (dist(cop.x, cop.y, p.x, p.y) < radius) return true;
  }
  return false;
}

function spawnPoliceCar(state) {
  const rng = makeRng((state.seed + Math.floor(state.time * 31) + state.cars.length * 17) >>> 0);
  const p = state.player;
  // Spawn on a road 500-800px away, off-screen.
  const angle = rng() * Math.PI * 2;
  const d = 550 + rng() * 250;
  const x = clamp(p.x + Math.cos(angle) * d, 80, state.city.worldW - 80);
  const y = clamp(p.y + Math.sin(angle) * d, 80, state.city.worldW - 80);
  const car = spawnCar(state, 'police', x, y, Math.atan2(p.y - y, p.x - x), 'police');
  car.color = '#20242c';
  return car;
}

function spawnFootCop(state) {
  const p = state.player;
  const rng = makeRng((state.seed + Math.floor(state.time * 17) + state.cops.length * 29) >>> 0);
  const angle = rng() * Math.PI * 2;
  const d = 320 + rng() * 160;
  state.cops.push({
    x: clamp(p.x + Math.cos(angle) * d, 40, state.city.worldW - 40),
    y: clamp(p.y + Math.sin(angle) * d, 40, state.city.worldW - 40),
    angle: 0, speed: 200, hp: 68, fireCooldown: 0, state: 'chase',
  });
}

export function updateWanted(state, dt, audio) {
  const level = state.wanted;
  const wantCars = WANTED.policeCars[level] ?? 0;
  const wantCops = WANTED.footCops[level] ?? 0;
  const haveCars = state.cars.filter((c) => c.driver === 'police').length;

  // Decay: unseen for a while, stars fall one at a time.
  if (level > 0 && !policeNearby(state, 560)) {
    state.wantedTimer += dt;
    if (state.wantedTimer > WANTED.decayDelay + WANTED.decayInterval) {
      state.wanted -= 1;
      state.wantedTimer = WANTED.decayDelay;
      notify(state, state.wanted === 0 ? 'You lost them. Heat is off.' : `Heat dropping… ${state.wanted} star${state.wanted > 1 ? 's' : ''} left.`, 'good', 3);
      if (state.wanted === 0) removeAllPolice(state);
    }
  } else if (level > 0) {
    state.wantedTimer = 0;
  }

  // Reinforcements trickle in while wanted.
  if (level > 0 && haveCars < wantCars && Math.random() < dt * 0.8) spawnPoliceCar(state);
  if (level >= 2 && state.cops.length < wantCops && !state.player.inCar && Math.random() < dt * 0.5) {
    spawnFootCop(state);
  }

  // Foot cops chase and, at 3+ stars, shoot. Touching the player busts them.
  const p = state.player;
  for (const cop of state.cops) {
    const d = dist(cop.x, cop.y, p.x, p.y);
    cop.angle = Math.atan2(p.y - cop.y, p.x - cop.x);
    if (d > 200 || level < 3) {
      const speed = cop.speed * (level >= 3 ? 1.1 : 1);
      cop.x += Math.cos(cop.angle) * speed * dt;
      cop.y += Math.sin(cop.angle) * speed * dt;
    }
    if (level >= 3 && d < 420 && d > 60) {
      cop.fireCooldown -= dt;
      if (cop.fireCooldown <= 0) {
        cop.fireCooldown = 1.1;
        const a = cop.angle + (Math.random() - 0.5) * 0.3;
        state.bullets.push({
          x: cop.x + Math.cos(a) * 18, y: cop.y + Math.sin(a) * 18,
          vx: Math.cos(a) * 950, vy: Math.sin(a) * 950,
          range: 460, from: 'cop', damage: 8,
        });
        if (audio) audio.enemyShoot();
      }
    }
    if (d < 22 && !p.inCar && !p.dead) {
      bustPlayer(state, audio);
    }
  }
  state.cops = state.cops.filter((c) => c.hp > 0);
}

export function bustPlayer(state, audio) {
  const p = state.player;
  if (p.dead || p.busted) return;
  p.busted = true;
  const fine = Math.min(p.money, 200);
  p.money -= fine;
  clearWanted(state, null);
  if (audio) audio.busted();
  notify(state, `BUSTED. Fine $${fine}.`, 'bad', 5);
  // Wake up outside SBPD Central.
  const station = landmarkCenter(state.city, 'police');
  p.x = station.x;
  p.y = station.y + 150;
  p.hp = 100;
  if (p.inCar) { p.inCar.driver = 'parked'; p.inCar = null; }
}

export function killPlayer(state, audio) {
  const p = state.player;
  if (p.dead) return;
  p.dead = true;
  const bill = Math.min(p.money, 150);
  p.money -= bill;
  clearWanted(state, null);
  notify(state, `WASTED. Hospital bill $${bill}.`, 'bad', 5);
  const hospital = landmarkCenter(state.city, 'hospital');
  p.x = hospital.x;
  p.y = hospital.y + 150;
  p.hp = 100;
  p.armor = 0;
  if (p.inCar) { p.inCar.driver = 'parked'; p.inCar = null; }
}

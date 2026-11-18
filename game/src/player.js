// player.js: Kai on foot and behind the wheel — movement, entering and
// stealing cars, interacting with the city (garage, safehouse, taxi, pickups).

import { PLAYER, WANTED } from './config.js';
import { clamp, dist } from './utils.js';
import { landmarkCenter, hitsBuilding } from './city.js';
import { notify } from './state.js';
import { driveCar, nearestDrivableCar, spawnCar } from './vehicles.js';
import { addWanted, clearWanted } from './police.js';
import { playerShoot } from './combat.js';
import { startMission, nextMission, failMission } from './missions.js';

export function spawnPlayer(state) {
  const home = landmarkCenter(state.city, 'safehouse');
  state.player.x = home.x;
  state.player.y = home.y + 160;
  state.player.angle = -Math.PI / 2;
  state.player.aimAngle = -Math.PI / 2;
  state.camera.x = state.player.x;
  state.camera.y = state.player.y;
}

function moveOnFoot(state, input, dt) {
  const p = state.player;
  const axis = input.axis();
  const sprint = input.sprint();
  const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  let dx = axis.x, dy = axis.y;
  const len = Math.hypot(dx, dy);
  if (len > 0) {
    dx /= len; dy /= len;
    const nx = p.x + dx * speed * dt;
    const ny = p.y + dy * speed * dt;
    if (!hitsBuilding(state.city, nx, p.y, 10)) p.x = clamp(nx, 12, state.city.worldW - 12);
    if (!hitsBuilding(state.city, p.x, ny, 10)) p.y = clamp(ny, 12, state.city.worldH - 12);
    p.angle = Math.atan2(dy, dx);
    state.stats.distance += speed * dt;
  }
  // Aim follows the mouse.
  p.aimAngle = Math.atan2(
    input.mouseWorldY - p.y,
    input.mouseWorldX - p.x,
  );
  if (input.mouse.down) playerShoot(state, state.audio);
  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  p.invulnerable = Math.max(0, p.invulnerable - dt);
}

function drivePlayerCar(state, input, dt) {
  const p = state.player;
  const car = p.inCar;
  const axis = input.axis();
  driveCar(state, car, -axis.y, axis.x, input.handbrake(), dt);
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  state.stats.distance += Math.abs(car.speed) * dt;
  if (Math.abs(car.speed) > 200 && Math.random() < dt * 8) {
    state.particles.push({
      kind: 'smoke', x: car.x - Math.cos(car.angle) * 26, y: car.y - Math.sin(car.angle) * 26,
      vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20,
      life: 0.4, maxLife: 0.4, size: 6,
    });
  }
}

// What the E key does right now, for the hint line and the action itself.
export function interactTarget(state) {
  const p = state.player;
  if (p.inCar) return { kind: 'exit', text: 'E — Get out of the car' };
  const car = nearestDrivableCar(state, p.x, p.y, 74);
  if (car) {
    return {
      kind: 'enter', car,
      text: car.driver === 'parked' ? `E — Steal the ${car.name}` : `E — Get in the ${car.name}`,
    };
  }
  const garage = landmarkCenter(state.city, 'garage');
  if (dist(p.x, p.y, garage.x, garage.y) < 130 && state.wanted > 0 && state.wanted <= 2) {
    return { kind: 'garage', text: `E — AutoSol Garage: clear heat ($${WANTED.bribeCost})` };
  }
  const home = landmarkCenter(state.city, 'safehouse');
  if (dist(p.x, p.y, home.x, home.y) < 130) {
    return { kind: 'safehouse', text: 'E — Save game & rest at the Safehouse' };
  }
  const hospital = landmarkCenter(state.city, 'hospital');
  if (dist(p.x, p.y, hospital.x, hospital.y) < 130 && p.hp < PLAYER.maxHp) {
    return { kind: 'hospital', text: 'E — Patch up at Solmar General (free)' };
  }
  for (const ped of state.peds) {
    if (ped.taxi && !ped.dead && dist(p.x, p.y, ped.x, ped.y) < 60) {
      return { kind: 'taxi', ped, text: `E — Take the fare ($${ped.fare})` };
    }
  }
  if (!state.mission) {
    const office = landmarkCenter(state.city, 'marina');
    if (dist(p.x, p.y, office.x, office.y) < 130) {
      const m = nextMission(state);
      if (m) return { kind: 'mission', mission: m, text: `E — New job from Mara: ${m.title}` };
    }
  }
  return null;
}

export function doInteract(state, audio) {
  const target = interactTarget(state);
  if (!target) return;
  const p = state.player;
  if (target.kind === 'exit') {
    const car = p.inCar;
    car.driver = 'parked';
    car.speed = 0;
    p.inCar = null;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
    if (audio) audio.door();
    return;
  }
  if (target.kind === 'enter') {
    const car = target.car;
    const wasParked = car.driver === 'parked';
    car.driver = 'player';
    p.inCar = car;
    if (wasParked) {
      state.stats.carsStolen += 1;
      if (state.wanted < 2 && Math.random() < 0.5) addWanted(state, 1, 'Car stolen — someone called it in.', audio);
      notify(state, `You took the ${car.name}.`, 'info', 3);
    }
    if (audio) audio.door();
    return;
  }
  if (target.kind === 'garage') {
    if (p.money >= WANTED.bribeCost) {
      p.money -= WANTED.bribeCost;
      clearWanted(state, 'AutoSol fresh paint — heat cleared.');
      if (audio) audio.cash();
    } else {
      notify(state, `Need $${WANTED.bribeCost} for the garage.`, 'bad', 3);
    }
    return;
  }
  if (target.kind === 'safehouse') {
    p.hp = PLAYER.maxHp;
    window.dispatchEvent(new CustomEvent('solmar-autosave'));
    notify(state, 'Rested and saved. Good as new.', 'good', 4);
    if (audio) audio.pickup();
    return;
  }
  if (target.kind === 'hospital') {
    p.hp = PLAYER.maxHp;
    notify(state, 'Patched up at Solmar General.', 'good', 3);
    if (audio) audio.pickup();
    return;
  }
  if (target.kind === 'taxi') {
    const ped = target.ped;
    state.peds = state.peds.filter((x) => x !== ped); // hops in; rides along
    state.taxi = { dest: ped.fareDest, fare: ped.fare };
    state.objective = `Taxi fare — drop your passenger at the marker ($${ped.fare})`;
    state.objectiveTarget = { x: ped.fareDest.x, y: ped.fareDest.y, name: 'Fare drop-off' };
    notify(state, `Fare accepted — $${ped.fare} on delivery.`, 'info', 4);
    return;
  }
  if (target.kind === 'mission') {
    startMission(state, target.mission);
  }
}

export function updatePlayer(state, input, dt, audio) {
  const p = state.player;
  if (p.dead || p.busted) {
    // Short beat, then back on the street.
    p.dead = false;
    p.busted = false;
    p.invulnerable = 2;
    if (state.mission) failMission(state, 'you got caught');
    return;
  }
  if (p.inCar) drivePlayerCar(state, input, dt);
  else moveOnFoot(state, input, dt);

  // Taxi drop-off.
  if (state.taxi && !state.mission) {
    const d = dist(p.x, p.y, state.taxi.dest.x, state.taxi.dest.y);
    if (d < 70) {
      p.money += state.taxi.fare;
      state.stats.fares += 1;
      notify(state, `Fare complete — +$${state.taxi.fare}`, 'good', 4);
      if (audio) audio.cash();
      state.taxi = null;
      state.objective = '';
      state.objectiveTarget = null;
    }
  }

  // Medallions.
  for (const m of state.city.medallions) {
    if (!m.taken && dist(p.x, p.y, m.x, m.y) < 34) {
      m.taken = true;
      state.medallions += 1;
      p.money += 100;
      notify(state, `Sun Medallion ${state.medallions}/10 — +$100`, 'good', 4);
      if (audio) audio.pickup();
    }
  }

  // Health / armor pickups.
  for (const pk of state.pickups) {
    if (!pk.taken && dist(p.x, p.y, pk.x, pk.y) < 30) {
      pk.taken = true;
      if (pk.kind === 'health') p.hp = Math.min(PLAYER.maxHp, p.hp + 50);
      else p.armor = Math.min(PLAYER.maxArmor, p.armor + 50);
      notify(state, pk.kind === 'health' ? 'Health +50' : 'Armor +50', 'good', 3);
      if (audio) audio.pickup();
    }
  }
}

// vehicles.js: car physics, traffic AI, parked cars and police pursuit driving.
// Cars are arcade: throttle, brake/reverse, speed-sensitive steering, handbrake drift.

import { CAR_TYPES, PITCH, WORLD, WORLD_W } from './config.js';
import { angleDiff, clamp, dist, makeRng, pick, range } from './utils.js';
import { hitsBuilding, isRoad, roadCenter } from './city.js';

let nextCarId = 1;

export function spawnCar(state, type, x, y, angle, driver) {
  const spec = CAR_TYPES[type];
  const car = {
    id: nextCarId, type, name: spec.name,
    x, y, angle, speed: 0,
    w: spec.w, h: spec.h,
    color: driver === 'police' ? spec.color : spec.color,
    driver, // 'player' | 'traffic' | 'parked' | 'police'
    hp: 100,
    targetSpeed: 0,
    route: null,       // traffic waypoint {x, y}
    stuck: 0,
    siren: driver === 'police',
    missionCar: false,
    brakeLight: false,
    honk: 0,
  };
  nextCarId += 1;
  state.cars.push(car);
  return car;
}

const TRAFFIC_COLORS = ['#c9c9c9', '#e8b23a', '#7a4a3a', '#5a7a9c', '#4a8a5a', '#8a5a9c', '#d97b7b', '#3a3a3a', '#e8e8e8', '#c96f4a'];
const TRAFFIC_TYPES = ['duna', 'brisa', 'toro', 'carga'];

// Scatter the city's traffic and parked cars.
export function populateTraffic(state, count = 16) {
  const rng = makeRng(state.seed ^ 0x9e3779b9);
  for (const p of state.city.parked) {
    const car = spawnCar(state, p.type, p.x, p.y, p.angle, 'parked');
    car.color = pick(rng, TRAFFIC_COLORS);
    if (p.type === 'vela') car.color = '#c93a4a';
    if (p.missionCar) car.missionCar = true;
  }
  for (let i = 0; i < count; i += 1) {
    const vertical = rng() < 0.5;
    const line = 1 + Math.floor(rng() * (WORLD.blocks - 1));
    const along = 200 + rng() * (WORLD_W - 400);
    const car = spawnCar(
      state, pick(rng, TRAFFIC_TYPES),
      vertical ? roadCenter(line) : along,
      vertical ? along : roadCenter(line),
      vertical ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI),
      'traffic',
    );
    car.color = pick(rng, TRAFFIC_COLORS);
    car.targetSpeed = range(rng, 120, 190);
    pickTrafficRoute(state, car);
  }
}

// Traffic follows the road grid: pick a far intersection on the same road,
// or turn at the next one.
export function pickTrafficRoute(state, car) {
  const rng = makeRng((state.seed + car.id * 7919 + Math.floor(state.time * 7)) >>> 0);
  const vertical = Math.abs(Math.sin(car.angle)) > Math.abs(Math.cos(car.angle));
  const line = Math.round(((vertical ? car.x : car.y) - WORLD.road / 2) / PITCH);
  const dir = vertical ? Math.sign(Math.sin(car.angle)) || 1 : Math.sign(Math.cos(car.angle)) || 1;
  const blocksAhead = 1 + Math.floor(rng() * 4);
  const target = roadCenter(Math.max(0, Math.min(WORLD.blocks, line + dir * blocksAhead)));
  // At the target intersection, maybe turn onto the cross road.
  if (rng() < 0.45) {
    const cross = Math.round(((vertical ? car.y : car.x) - WORLD.road / 2) / PITCH);
    const turn = cross + (rng() < 0.5 ? -1 : 1) * (1 + Math.floor(rng() * 3));
    const t2 = roadCenter(Math.max(0, Math.min(WORLD.blocks, turn)));
    car.route = vertical ? { x: target, y: t2 } : { x: t2, y: target };
  } else {
    car.route = vertical ? { x: car.x, y: target } : { x: target, y: car.y };
  }
}

function nearestCarAhead(state, car, lookAhead) {
  let best = null;
  let bestD = Infinity;
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  for (const other of state.cars) {
    if (other === car || other.driver === 'parked') continue;
    const dx = other.x - car.x, dy = other.y - car.y;
    const along = dx * fx + dy * fy;
    if (along < 0 || along > lookAhead) continue;
    const side = Math.abs(-dx * fy + dy * fx);
    if (side < 34 && along < bestD) { best = other; bestD = along; }
  }
  return best;
}

// One physics step for a car. throttle -1..1, steer -1..1, handbrake bool.
export function driveCar(state, car, throttle, steer, handbrake, dt) {
  const spec = CAR_TYPES[car.type];
  const maxSpeed = spec.maxSpeed;
  if (throttle > 0) car.speed += spec.accel * throttle * dt * (car.speed < 0 ? 2.2 : 1);
  else if (throttle < 0) {
    if (car.speed > 5) car.speed -= spec.accel * 1.6 * dt; // brake
    else car.speed = Math.max(-160, car.speed + spec.accel * 0.8 * throttle * dt);
  } else {
    car.speed -= car.speed * 0.55 * dt; // rolling drag
  }
  if (!handbrake) car.speed = clamp(car.speed, -160, maxSpeed);
  else car.speed = clamp(car.speed, -160, maxSpeed * 1.05);

  const speedNorm = clamp(Math.abs(car.speed) / maxSpeed, 0, 1);
  const steerRate = (handbrake ? 2.6 : 2.1) * (1 - speedNorm * 0.55);
  const dir = car.speed >= 0 ? 1 : -1;
  car.angle += steer * steerRate * speedNorm * dir * dt * (handbrake ? 1.35 : 1);

  // Drift: handbrake keeps some sideways slide.
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  let vx = fx * car.speed, vy = fy * car.speed;
  if (handbrake && Math.abs(car.speed) > 120) {
    const slide = 0.35;
    const px = -fy, py = fx;
    const lateral = (car._lat ?? 0) * (1 - dt * 2) + steer * 60 * dt;
    car._lat = lateral;
    vx += px * lateral * slide;
    vy += py * lateral * slide;
  } else {
    car._lat = 0;
  }

  const nx = car.x + vx * dt;
  const ny = car.y + vy * dt;
  const b = hitsBuilding(state.city, nx, ny, 14);
  if (b) {
    // Scrape: stop along the blocked axis, lose speed, spark.
    if (!hitsBuilding(state.city, nx, car.y, 14)) car.x = nx;
    else if (!hitsBuilding(state.city, car.x, ny, 14)) car.y = ny;
    else {
      if (Math.abs(car.speed) > 140) {
        car.hp -= 6;
        spawnSparks(state, car.x, car.y);
      }
    }
    car.speed *= 0.55;
  } else {
    car.x = clamp(nx, 20, WORLD_W - 20);
    car.y = clamp(ny, 20, state.city.worldH - 20);
  }
  car.brakeLight = throttle < 0 || handbrake;
}

export function spawnSparks(state, x, y) {
  for (let i = 0; i < 8; i += 1) {
    state.particles.push({
      kind: 'spark', x, y,
      vx: (Math.random() - 0.5) * 260, vy: (Math.random() - 0.5) * 260,
      life: 0.3 + Math.random() * 0.3, maxLife: 0.6, size: 2 + Math.random() * 2,
    });
  }
}

export function spawnSmoke(state, x, y) {
  state.particles.push({
    kind: 'smoke', x, y,
    vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 20,
    life: 0.8, maxLife: 0.8, size: 8 + Math.random() * 6,
  });
}

// Traffic AI: drive toward the route point, slow for cars ahead, re-route on arrival.
export function updateTraffic(state, car, dt) {
  if (!car.route || dist(car.x, car.y, car.route.x, car.route.y) < 46) pickTrafficRoute(state, car);
  const targetAngle = Math.atan2(car.route.y - car.y, car.route.x - car.x);
  const turn = clamp(angleDiff(car.angle, targetAngle) * 2.2, -1, 1);
  const ahead = nearestCarAhead(state, car, 90);
  const throttle = ahead ? 0 : (car.speed < car.targetSpeed ? 1 : 0);
  // Nudge back onto a road if pushed off.
  if (!isRoad(car.x, car.y) && dist(car.x, car.y, car.route.x, car.route.y) > 200) {
    pickTrafficRoute(state, car);
  }
  driveCar(state, car, throttle, turn, false, dt);
}

// Police pursuit: steer hard at the player, ram on contact, back up when stuck.
export function updatePoliceCar(state, car, dt, audio) {
  const p = state.player;
  const target = p.inCar ?? p;
  const targetAngle = Math.atan2(target.y - car.y, target.x - car.x);
  const turn = clamp(angleDiff(car.angle, targetAngle) * 2.6, -1, 1);
  const d = dist(car.x, car.y, target.x, target.y);
  const throttle = d > 30 ? 1 : 0.4;
  const wasSpeed = Math.abs(car.speed);
  driveCar(state, car, throttle, turn, false, dt);
  if (Math.abs(car.speed) < 20 && wasSpeed < 20) car.stuck += dt;
  else car.stuck = 0;
  if (car.stuck > 1.2) {
    driveCar(state, car, -1, -turn, false, dt);
    if (car.stuck > 2) { car.stuck = 0; }
  }
  // Ram damage to the player's car.
  if (p.inCar && d < 52) {
    p.inCar.hp -= 14 * dt;
    if (Math.random() < dt * 2) spawnSparks(state, car.x, car.y);
    if (audio && Math.random() < dt * 0.8) audio.crash();
  }
}

// Car-car collision: push apart, trade a little speed.
export function resolveCarCollisions(state) {
  const cars = state.cars;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i], b = cars[j];
      if (a.driver === 'parked' && b.driver === 'parked') continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = 44;
      if (d > 0 && d < min) {
        const push = (min - d) / 2;
        const nx = dx / d, ny = dy / d;
        const aMove = a.driver === 'parked' ? 0 : 1;
        const bMove = b.driver === 'parked' ? 0 : 1;
        a.x -= nx * push * aMove; a.y -= ny * push * aMove;
        b.x += nx * push * bMove; b.y += ny * push * bMove;
        const impact = Math.abs(a.speed - b.speed);
        if (impact > 120) {
          a.hp -= 3; b.hp -= 3;
          spawnSparks(state, (a.x + b.x) / 2, (a.y + b.y) / 2);
        }
        a.speed *= 0.92; b.speed *= 0.92;
      }
    }
  }
  // Wrecked cars smoke and slow down.
  for (const car of cars) {
    if (car.hp < 35 && car.hp > 0 && Math.random() < 0.3) spawnSmoke(state, car.x, car.y);
    if (car.hp <= 0) car.speed *= 0.9;
  }
}

export function nearestDrivableCar(state, x, y, maxDist = 70) {
  let best = null;
  let bestD = maxDist;
  for (const car of state.cars) {
    if (car.driver === 'police' || car.hp <= 0) continue;
    const d = dist(x, y, car.x, car.y);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}

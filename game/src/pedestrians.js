// pedestrians.js: sidewalk walkers who wander the blocks, flee gunfire and
// police chases, and flag taxis. A few are taxi customers with a destination.

import { PITCH, WORLD, WORLD_W } from './config.js';
import { clamp, dist, makeRng, pick, range } from './utils.js';
import { hitsBuilding, roadCenter } from './city.js';

const SHIRTS = ['#e86a5a', '#5a9ce8', '#e8c95a', '#7ac95a', '#c95aa8', '#5ad9c9', '#f2f2f2', '#3a3a3a', '#e89a5a', '#9a5ae8'];
const PANTS = ['#2a3a5a', '#3a3a3a', '#5a4a3a', '#1f4a2a', '#6a6a6a'];

export function spawnPed(state, x, y, opts = {}) {
  const rng = makeRng((state.seed + state.peds.length * 131 + Math.floor(x + y)) >>> 0);
  const ped = {
    x, y, angle: rng() * Math.PI * 2,
    speed: range(rng, 45, 75),
    shirt: pick(rng, SHIRTS),
    pants: pick(rng, PANTS),
    skin: pick(rng, ['#f2c9a0', '#d9a06a', '#a06a3a', '#8a5a2a', '#e8b88a']),
    state: 'walk',          // walk | flee | wait | taxi
    tx: x, ty: y,           // walk target
    wait: 0,
    taxi: opts.taxi || false,
    fareDest: opts.fareDest || null,
    fare: opts.fare || 0,
    dead: false,
    panic: 0,
  };
  state.peds.push(ped);
  return ped;
}

export function populatePeds(state, count = 34) {
  const rng = makeRng(state.seed ^ 0x51ed);
  for (let i = 0; i < count; i += 1) {
    // On a sidewalk: just off a road, on a block edge.
    const vertical = rng() < 0.5;
    const line = 1 + Math.floor(rng() * (WORLD.blocks - 1));
    const along = 150 + rng() * (WORLD_W - 300);
    const off = (rng() < 0.5 ? -1 : 1) * (WORLD.road / 2 + 12 + rng() * 8);
    spawnPed(state,
      vertical ? roadCenter(line) + off : along,
      vertical ? along : roadCenter(line) + off);
  }
  // Two taxi customers waiting at marked curbs.
  const spots = [
    { x: roadCenter(3) + 48, y: roadCenter(4) },
    { x: roadCenter(6) - 48, y: roadCenter(7) },
  ];
  for (const s of spots) {
    const dest = {
      x: roadCenter(1 + Math.floor(rng() * 8)),
      y: roadCenter(1 + Math.floor(rng() * 8)),
    };
    spawnPed(state, s.x, s.y, { taxi: true, fareDest: dest, fare: 60 + Math.floor(rng() * 4) * 30 });
  }
}

function pickWalkTarget(state, ped) {
  const rng = makeRng((state.seed + Math.floor(state.time * 13) + Math.floor(ped.x)) >>> 0);
  // Walk along the nearest sidewalk line, a block or two.
  const vertical = rng() < 0.5;
  const line = Math.round(((vertical ? ped.x : ped.y) - WORLD.road / 2) / PITCH);
  const centre = roadCenter(Math.max(0, Math.min(WORLD.blocks, line)));
  const off = (ped.x - centre || ped.y - centre) > 0 ? 1 : -1;
  const along = clamp((vertical ? ped.y : ped.x) + (rng() < 0.5 ? -1 : 1) * (200 + rng() * 500), 60, WORLD_W - 60);
  ped.tx = vertical ? centre + off * (WORLD.road / 2 + 12) : along;
  ped.ty = vertical ? along : centre + off * (WORLD.road / 2 + 12);
}

export function updatePeds(state, dt) {
  const p = state.player;
  for (const ped of state.peds) {
    if (ped.dead) continue;
    // Panic: gunfire, sirens or a speeding car nearby.
    const danger = state.wanted >= 2 && dist(ped.x, ped.y, p.x, p.y) < 320;
    const shooting = state.bullets.length > 0 && state.bullets.some((b) => dist(ped.x, ped.y, b.x, b.y) < 260);
    if (danger || shooting) ped.panic = 3;
    if (ped.panic > 0) {
      ped.panic -= dt;
      ped.state = 'flee';
    } else if (ped.state === 'flee') {
      ped.state = ped.taxi ? 'wait' : 'walk';
    }
    if (ped.state === 'wait') {
      ped.angle += Math.sin(state.time * 2 + ped.x) * 0.01;
      continue;
    }
    const speed = ped.state === 'flee' ? ped.speed * 2.4 : ped.speed;
    if (dist(ped.x, ped.y, ped.tx, ped.ty) < 12 || ped.wait > 0) {
      if (ped.wait <= 0) { pickWalkTarget(state, ped); ped.wait = 0.4 + Math.random(); }
      else ped.wait -= dt;
      continue;
    }
    let targetAngle = Math.atan2(ped.ty - ped.y, ped.tx - ped.x);
    if (ped.state === 'flee') {
      targetAngle = Math.atan2(ped.y - p.y, ped.x - p.x);
    }
    ped.angle = targetAngle;
    const nx = ped.x + Math.cos(ped.angle) * speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * speed * dt;
    if (!hitsBuilding(state.city, nx, ny, 6)) {
      ped.x = clamp(nx, 10, WORLD_W - 10);
      ped.y = clamp(ny, 10, state.city.worldH - 10);
    } else {
      pickWalkTarget(state, ped);
    }
  }
}

// A car running a ped over: the ped falls, the player earns heat.
export function checkPedRunOver(state, car, audio) {
  if (car.driver !== 'player') return null;
  for (const ped of state.peds) {
    if (ped.dead) continue;
    if (dist(ped.x, ped.y, car.x, car.y) < 26 && Math.abs(car.speed) > 60) {
      ped.dead = true;
      return ped;
    }
  }
  return null;
}

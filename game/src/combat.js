// combat.js: the pistol, bullets, muzzle flash, hit particles, and the
// armed rivals who guard mission locations.

import { COMBAT } from './config.js';
import { dist, makeRng } from './utils.js';
import { hitsBuilding } from './city.js';
import { addWanted, killPlayer } from './police.js';

export function spawnEnemy(state, x, y, opts = {}) {
  const enemy = {
    x, y, angle: 0, hp: opts.hp ?? 68,
    speed: opts.speed ?? 150,
    fireCooldown: 0.5 + Math.random(),
    state: 'guard',       // guard | chase | attack
    homeX: x, homeY: y,
    shirt: opts.shirt ?? '#8a2a2a',
    dead: false,
  };
  state.enemies.push(enemy);
  return enemy;
}

export function playerShoot(state, audio) {
  const p = state.player;
  if (p.inCar || p.dead) return;
  if (p.fireCooldown > 0) return;
  p.fireCooldown = COMBAT.fireInterval;
  const a = p.aimAngle;
  state.bullets.push({
    x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20,
    vx: Math.cos(a) * COMBAT.bulletSpeed, vy: Math.sin(a) * COMBAT.bulletSpeed,
    range: COMBAT.bulletRange, from: 'player', damage: COMBAT.pistolDamage,
  });
  // Muzzle flash + a puff of smoke.
  state.particles.push({
    kind: 'flash', x: p.x + Math.cos(a) * 24, y: p.y + Math.sin(a) * 24,
    vx: 0, vy: 0, life: 0.06, maxLife: 0.06, size: 12,
  });
  if (audio) audio.shoot();
  // Firing a gun where the law can see it earns a star.
  if (state.wanted === 0 && Math.random() < 0.6) addWanted(state, 1, 'Shots fired — SBPD alerted.', audio);
}

function spawnBlood(state, x, y) {
  for (let i = 0; i < 6; i += 1) {
    state.particles.push({
      kind: 'blood', x, y,
      vx: (Math.random() - 0.5) * 200, vy: (Math.random() - 0.5) * 200,
      life: 0.4, maxLife: 0.4, size: 3 + Math.random() * 3,
    });
  }
}

export function updateBullets(state, dt, audio) {
  const p = state.player;
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.range -= COMBAT.bulletSpeed * dt;
    if (b.range <= 0) { b.dead = true; continue; }
    if (hitsBuilding(state.city, b.x, b.y, 0)) {
      b.dead = true;
      state.particles.push({
        kind: 'spark', x: b.x, y: b.y, vx: 0, vy: 0, life: 0.15, maxLife: 0.15, size: 3,
      });
      continue;
    }
    if (b.from === 'player') {
      for (const e of state.enemies) {
        if (!e.dead && dist(b.x, b.y, e.x, e.y) < 16) {
          e.hp -= b.damage;
          b.dead = true;
          spawnBlood(state, e.x, e.y);
          if (audio) audio.hit();
          if (e.hp <= 0) {
            e.dead = true;
            state.stats.kills += 1;
          }
          break;
        }
      }
      if (b.dead) continue;
      for (const cop of state.cops) {
        if (dist(b.x, b.y, cop.x, cop.y) < 16) {
          cop.hp -= b.damage;
          b.dead = true;
          spawnBlood(state, cop.x, cop.y);
          if (cop.hp <= 0) addWanted(state, 2, 'Officer down — the whole city is after you.', audio);
          break;
        }
      }
      if (b.dead) continue;
      for (const ped of state.peds) {
        if (!ped.dead && dist(b.x, b.y, ped.x, ped.y) < 14) {
          ped.dead = true;
          b.dead = true;
          spawnBlood(state, ped.x, ped.y);
          addWanted(state, 1, 'Civilian down — SBPD alerted.', audio);
          break;
        }
      }
    } else if (!p.dead && !p.inCar && dist(b.x, b.y, p.x, p.y) < 15) {
      b.dead = true;
      damagePlayer(state, b.damage, audio);
      spawnBlood(state, p.x, p.y);
    }
  }
  state.bullets = state.bullets.filter((b) => !b.dead);
  state.enemies = state.enemies.filter((e) => !e.dead);
}

export function damagePlayer(state, amount, audio) {
  const p = state.player;
  if (p.invulnerable > 0 || p.dead) return;
  let rest = amount;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, rest);
    p.armor -= absorbed;
    rest -= absorbed;
  }
  p.hp -= rest;
  p.invulnerable = 0.15;
  if (p.hp <= 0) {
    p.hp = 0;
    killPlayer(state, audio);
  }
}

// Rivals guard their turf, chase the player when close, and shoot on sight.
export function updateEnemies(state, dt, audio) {
  const p = state.player;
  for (const e of state.enemies) {
    const d = dist(e.x, e.y, p.x, p.y);
    e.angle = Math.atan2(p.y - e.y, p.x - e.x);
    if (d < 420 && !p.dead) {
      e.state = 'attack';
      if (d > 240) {
        e.x += Math.cos(e.angle) * e.speed * dt;
        e.y += Math.sin(e.angle) * e.speed * dt;
      }
      e.fireCooldown -= dt;
      if (e.fireCooldown <= 0 && d < 430) {
        e.fireCooldown = COMBAT.enemyFireInterval + Math.random() * 0.4;
        const a = e.angle + (Math.random() - 0.5) * 0.35;
        state.bullets.push({
          x: e.x + Math.cos(a) * 18, y: e.y + Math.sin(a) * 18,
          vx: Math.cos(a) * COMBAT.bulletSpeed, vy: Math.sin(a) * COMBAT.bulletSpeed,
          range: 460, from: 'enemy', damage: COMBAT.enemyDamage,
        });
        state.particles.push({
          kind: 'flash', x: e.x + Math.cos(a) * 22, y: e.y + Math.sin(a) * 22,
          vx: 0, vy: 0, life: 0.06, maxLife: 0.06, size: 10,
        });
        if (audio) audio.enemyShoot();
      }
    } else if (dist(e.x, e.y, e.homeX, e.homeY) > 30) {
      e.state = 'guard';
      const a = Math.atan2(e.homeY - e.y, e.homeX - e.x);
      e.x += Math.cos(a) * e.speed * 0.6 * dt;
      e.y += Math.sin(a) * e.speed * 0.6 * dt;
      e.angle = a;
    }
  }
}

export function updateParticles(state, dt) {
  for (const pt of state.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= (1 - dt * 2);
    pt.vy *= (1 - dt * 2);
    pt.life -= dt;
  }
  state.particles = state.particles.filter((pt) => pt.life > 0);
}

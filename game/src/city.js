// city.js: builds Solmar Bay — a 10x10 grid of blocks, roads, buildings,
// parks, landmarks and the beach. Deterministic from the seed.

import { DISTRICTS, PALETTE, PITCH, WORLD, WORLD_H, WORLD_W } from './config.js';
import { makeRng, pick, range, rangeInt } from './utils.js';

export function roadCenter(i) {
  return i * PITCH + WORLD.road / 2;
}

export function blockOrigin(col, row) {
  return { x: WORLD.road + col * PITCH, y: WORLD.road + row * PITCH };
}

export function isRoad(x, y) {
  if (x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_W) return false;
  const mx = x % PITCH, my = y % PITCH;
  return mx < WORLD.road || my < WORLD.road;
}

// Nearest point on the road network to (x, y), used to keep cars on roads.
export function snapToRoad(x, y) {
  const gx = Math.round((x - WORLD.road / 2) / PITCH);
  const gy = Math.round((y - WORLD.road / 2) / PITCH);
  const cx = roadCenter(Math.max(0, Math.min(WORLD.blocks, gx)));
  const cy = roadCenter(Math.max(0, Math.min(WORLD.blocks, gy)));
  return Math.abs(x - cx) < Math.abs(y - cy) ? { x: cx, y, vertical: true } : { x, y: cy, vertical: false };
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  const parks = [];
  const parkingLots = [];
  const districts = DISTRICTS.map((d) => ({
    name: d.name,
    x0: d.cols[0] * PITCH, x1: (d.cols[1] + 1) * PITCH + WORLD.road,
    y0: d.rows[0] * PITCH, y1: (d.rows[1] + 1) * PITCH + WORLD.road,
  }));

  // Landmark blocks: fixed so missions always find them.
  const landmarks = {
    safehouse: { col: 2, row: 7, name: 'Safehouse', color: '#e8a13a' },
    garage: { col: 4, row: 4, name: 'AutoSol Garage', color: '#3aa3e8' },
    hospital: { col: 1, row: 3, name: 'Solmar General', color: '#e8e8e8' },
    casino: { col: 6, row: 8, name: 'Sunset Casino', color: '#c93a8f' },
    police: { col: 3, row: 2, name: 'SBPD Central', color: '#3a5ac9' },
    harbor: { col: 8, row: 5, name: 'Harbor Warehouse', color: '#8a7a5a' },
    marina: { col: 5, row: 5, name: 'Mara’s Office', color: '#7ac93a' },
  };

  for (let row = 0; row < WORLD.blocks; row += 1) {
    for (let col = 0; col < WORLD.blocks; col += 1) {
      const origin = blockOrigin(col, row);
      const district = DISTRICTS.find(
        (d) => col >= d.cols[0] && col <= d.cols[1] && row >= d.rows[0] && row <= d.rows[1],
      );
      const landmarkKey = Object.keys(landmarks).find(
        (k) => landmarks[k].col === col && landmarks[k].row === row,
      );
      const roll = rng();

      if (landmarkKey) {
        const lm = landmarks[landmarkKey];
        buildings.push({
          x: origin.x + 40, y: origin.y + 40, w: 200, h: 200,
          height: landmarkKey === 'casino' ? 46 : 26,
          roof: lm.color, side: '#8a8a8a', landmark: lm.name, glass: true,
        });
        continue;
      }
      if ((district && district.park && roll < 0.55) || roll < 0.12) {
        parks.push({ x: origin.x, y: origin.y, w: WORLD.block, h: WORLD.block });
        for (let t = 0; t < 9; t += 1) {
          trees.push({
            x: origin.x + 24 + rng() * (WORLD.block - 48),
            y: origin.y + 24 + rng() * (WORLD.block - 48),
            r: 9 + rng() * 7,
          });
        }
        continue;
      }
      if (roll < 0.2) {
        parkingLots.push({ x: origin.x, y: origin.y, w: WORLD.block, h: WORLD.block });
        continue;
      }
      // A block holds 1 big building or a 2x2 set of small ones.
      const tall = district && district.tall;
      if (rng() < 0.45) {
        const h = tall ? rangeInt(rng, 30, 52) : rangeInt(rng, 10, 26);
        const ci = rangeInt(rng, 0, PALETTE.buildingRoof.length - 1);
        buildings.push({
          x: origin.x + 24, y: origin.y + 24, w: WORLD.block - 48, h: WORLD.block - 48,
          height: h, roof: PALETTE.buildingRoof[ci], side: PALETTE.buildingSide[ci],
          glass: tall && rng() < 0.6,
        });
      } else {
        for (let by = 0; by < 2; by += 1) {
          for (let bx = 0; bx < 2; bx += 1) {
            if (rng() < 0.15) continue;
            const h = tall ? rangeInt(rng, 24, 44) : rangeInt(rng, 8, 22);
            const ci = rangeInt(rng, 0, PALETTE.buildingRoof.length - 1);
            buildings.push({
              x: origin.x + 16 + bx * 132, y: origin.y + 16 + by * 132, w: 116, h: 116,
              height: h, roof: PALETTE.buildingRoof[ci], side: PALETTE.buildingSide[ci],
              glass: tall && rng() < 0.5,
            });
          }
        }
      }
      // Street trees along the block edge.
      for (let t = 0; t < 3; t += 1) {
        trees.push({
          x: origin.x + 10 + rng() * (WORLD.block - 20),
          y: origin.y + 6 + (rng() < 0.5 ? 0 : WORLD.block - 12),
          r: 7 + rng() * 5,
        });
      }
    }
  }

  // Sun medallions: hidden collectibles, one per picked block corner.
  const medallions = [];
  const medSpots = [[0, 0], [9, 0], [0, 9], [9, 9], [4, 1], [1, 5], [7, 2], [2, 8], [6, 6], [8, 3]];
  for (const [col, row] of medSpots) {
    const o = blockOrigin(col, row);
    medallions.push({ x: o.x + 20 + rng() * (WORLD.block - 40), y: o.y + 20 + rng() * (WORLD.block - 40), taken: false });
  }

  // Parked cars on parking lots and curbs.
  const parked = [];
  for (const lot of parkingLots) {
    const n = rangeInt(rng, 2, 4);
    for (let i = 0; i < n; i += 1) {
      parked.push({
        x: lot.x + 50 + (i % 2) * 120 + range(rng, -8, 8),
        y: lot.y + 50 + Math.floor(i / 2) * 90 + range(rng, -8, 8),
        angle: rng() < 0.5 ? 0 : Math.PI / 2,
        type: pick(rng, ['duna', 'brisa', 'toro', 'carga']),
      });
    }
  }
  // A few curb-parked cars for stealing.
  for (let i = 0; i < 10; i += 1) {
    const vertical = rng() < 0.5;
    const line = rangeInt(rng, 1, WORLD.blocks - 1);
    const along = range(rng, 200, WORLD_W - 200);
    parked.push({
      x: vertical ? roadCenter(line) + 26 : along,
      y: vertical ? along : roadCenter(line) + 26,
      angle: vertical ? Math.PI / 2 : 0,
      type: pick(rng, ['duna', 'brisa', 'toro', 'carga', 'vela']),
    });
  }

  // The mission Vela GT waits in the casino lot.
  const casino = blockOrigin(landmarks.casino.col, landmarks.casino.row);
  parked.push({ x: casino.x + 60, y: casino.y + 250, angle: 0, type: 'vela', missionCar: true });

  return {
    seed, buildings, trees, parks, parkingLots, districts, landmarks,
    medallions, parked, worldW: WORLD_W, worldH: WORLD_H,
  };
}

export function landmarkCenter(city, key) {
  const lm = city.landmarks[key];
  const o = blockOrigin(lm.col, lm.row);
  return { x: o.x + WORLD.block / 2, y: o.y + WORLD.block / 2, name: lm.name };
}

// Point inside any building? (collision for people and cars)
export function hitsBuilding(city, x, y, margin = 0) {
  for (const b of city.buildings) {
    if (x > b.x - margin && x < b.x + b.w + margin && y > b.y - margin && y < b.y + b.h + margin) return b;
  }
  return null;
}

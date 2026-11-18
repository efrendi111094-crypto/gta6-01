// render.js: paints the world — roads, blocks, fake-3D buildings with long
// golden-hour shadows, cars, people, particles and the mission beacon.
// Only draws what the camera sees.

import { CAR_TYPES, PALETTE, PITCH, WORLD } from './config.js';
import { clamp } from './utils.js';
import { isRoad } from './city.js';

const SHADOW_DX = 14; // golden hour: shadows stretch east
const SHADOW_DY = 10;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let viewW = 0, viewH = 0, dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
    canvas.style.width = `${viewW}px`;
    canvas.style.height = `${viewH}px`;
  }
  resize();
  window.addEventListener('resize', resize);

  function worldToScreen(state, x, y) {
    const cam = state.camera;
    return {
      x: (x - cam.x) * cam.zoom + viewW / 2,
      y: (y - cam.y) * cam.zoom + viewH / 2,
    };
  }

  function drawGround(state) {
    const cam = state.camera;
    const z = cam.zoom;
    const x0 = cam.x - viewW / 2 / z - 80;
    const y0 = cam.y - viewH / 2 / z - 80;
    const x1 = cam.x + viewW / 2 / z + 80;
    const y1 = cam.y + viewH / 2 / z + 80;
    const city = state.city;

    // Base: sidewalk dust, then grass blocks, roads, beach, water.
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(0, 0, viewW, viewH);

    const toSx = (x) => (x - cam.x) * z + viewW / 2;
    const toSy = (y) => (y - cam.y) * z + viewH / 2;

    // Water + sand at the south edge.
    const waterY = city.worldW + WORLD.beach;
    if (y1 > waterY) {
      ctx.fillStyle = PALETTE.sand;
      ctx.fillRect(toSx(0), toSy(city.worldW), city.worldW * z, WORLD.beach * z);
      const grad = ctx.createLinearGradient(0, toSy(waterY), 0, toSy(city.worldH));
      grad.addColorStop(0, PALETTE.water);
      grad.addColorStop(1, PALETTE.waterDeep);
      ctx.fillStyle = grad;
      ctx.fillRect(toSx(0), toSy(waterY), city.worldW * z, WORLD.water * z);
      // Wave lines.
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      for (let w = 0; w < 3; w += 1) {
        ctx.beginPath();
        const wy = toSy(waterY + 14 + w * 26 + Math.sin(state.time * 1.2 + w) * 3);
        ctx.moveTo(toSx(0), wy);
        ctx.lineTo(toSx(city.worldW), wy);
        ctx.stroke();
      }
    }

    // Parks.
    for (const park of city.parks) {
      if (park.x > x1 || park.x + park.w < x0 || park.y > y1 || park.y + park.h < y0) continue;
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(toSx(park.x), toSy(park.y), park.w * z, park.h * z);
    }
    // Parking lots.
    for (const lot of city.parkingLots) {
      if (lot.x > x1 || lot.x + lot.w < x0 || lot.y > y1 || lot.y + lot.h < y0) continue;
      ctx.fillStyle = '#4a4a52';
      ctx.fillRect(toSx(lot.x), toSy(lot.y), lot.w * z, lot.h * z);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i += 1) {
        ctx.strokeRect(toSx(lot.x + 30 + i * 60), toSy(lot.y + 30), 44 * z, 80 * z);
      }
    }

    // Roads: asphalt strips + centre dashes + crosswalks.
    ctx.fillStyle = PALETTE.asphalt;
    for (let i = 0; i <= WORLD.blocks; i += 1) {
      const c = i * PITCH + WORLD.road / 2;
      if (c + WORLD.road / 2 > x0 && c - WORLD.road / 2 < x1) {
        ctx.fillRect(toSx(c - WORLD.road / 2), toSy(0), WORLD.road * z, city.worldW * z);
      }
      if (c + WORLD.road / 2 > y0 && c - WORLD.road / 2 < y1) {
        ctx.fillRect(toSx(0), toSy(c - WORLD.road / 2), city.worldW * z, WORLD.road * z);
      }
    }
    // Centre dashes.
    ctx.fillStyle = PALETTE.lane;
    const dash = 26, gap = 30;
    for (let i = 0; i <= WORLD.blocks; i += 1) {
      const c = i * PITCH + WORLD.road / 2;
      for (let d = 0; d < city.worldW; d += dash + gap) {
        if (c > x0 && c < x1 && d > y0 && d < y1) ctx.fillRect(toSx(c) - 1.5 * z, toSy(d), 3 * z, dash * z);
        if (c > y0 && c < y1 && d > x0 && d < x1) ctx.fillRect(toSx(d), toSy(c) - 1.5 * z, dash * z, 3 * z);
      }
    }
    // Crosswalks at intersections.
    ctx.fillStyle = PALETTE.crosswalk;
    for (let i = 0; i <= WORLD.blocks; i += 1) {
      for (let j = 0; j <= WORLD.blocks; j += 1) {
        const cx = i * PITCH + WORLD.road / 2;
        const cy = j * PITCH + WORLD.road / 2;
        if (cx < x0 || cx > x1 || cy < y0 || cy > y1) continue;
        for (let s = -2; s <= 2; s += 1) {
          ctx.fillRect(toSx(cx + s * 12 - 4), toSy(cy - WORLD.road / 2 - 6), 8 * z, 12 * z);
          ctx.fillRect(toSx(cx + s * 12 - 4), toSy(cy + WORLD.road / 2 - 6), 8 * z, 12 * z);
        }
      }
    }
  }

  function drawBuildings(state) {
    const cam = state.camera;
    const z = cam.zoom;
    const x0 = cam.x - viewW / 2 / z - 120;
    const y0 = cam.y - viewH / 2 / z - 120;
    const x1 = cam.x + viewW / 2 / z + 120;
    const y1 = cam.y + viewH / 2 / z + 120;
    const toSx = (x) => (x - cam.x) * z + viewW / 2;
    const toSy = (y) => (y - cam.y) * z + viewH / 2;
    for (const b of state.city.buildings) {
      if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
      const h = b.height;
      // Long golden-hour shadow.
      ctx.fillStyle = 'rgba(60,40,20,0.25)';
      ctx.fillRect(toSx(b.x + h * 0.7), toSy(b.y + h * 0.5), b.w * z, b.h * z);
      // Side faces (fake height), then roof.
      ctx.fillStyle = b.side;
      ctx.fillRect(toSx(b.x), toSy(b.y + b.h), b.w * z, h * 0.5 * z);
      ctx.fillRect(toSx(b.x + b.w), toSy(b.y), h * 0.7 * z, b.h * z);
      ctx.fillStyle = b.roof;
      ctx.fillRect(toSx(b.x), toSy(b.y), b.w * z, b.h * z);
      // Roof detail: rim + a vent or two.
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 2 * z;
      ctx.strokeRect(toSx(b.x + 5), toSy(b.y + 5), (b.w - 10) * z, (b.h - 10) * z);
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(toSx(b.x + b.w * 0.3), toSy(b.y + b.h * 0.3), 18 * z, 18 * z);
      if (b.glass) {
        ctx.fillStyle = 'rgba(207,232,239,0.5)';
        ctx.fillRect(toSx(b.x + 12), toSy(b.y + 12), (b.w - 24) * z, 16 * z);
      }
      if (b.landmark) {
        ctx.fillStyle = 'rgba(20,20,28,0.75)';
        ctx.font = `bold ${Math.max(11, 13 * z)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(b.landmark, toSx(b.x + b.w / 2), toSy(b.y + b.h / 2) + 5);
      }
    }
    // Trees.
    for (const t of state.city.trees) {
      if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
      ctx.fillStyle = 'rgba(60,40,20,0.25)';
      ctx.beginPath();
      ctx.ellipse(toSx(t.x + SHADOW_DX), toSy(t.y + SHADOW_DY), t.r * 1.2 * z, t.r * 0.8 * z, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.treeDark;
      ctx.beginPath();
      ctx.arc(toSx(t.x), toSy(t.y), t.r * z, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.tree;
      ctx.beginPath();
      ctx.arc(toSx(t.x - 2), toSy(t.y - 2), t.r * 0.7 * z, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCar(state, car) {
    const s = worldToScreen(state, car.x, car.y);
    const z = state.camera.zoom;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.roundRect((-car.h / 2 + 4) * z, (-car.w / 2 + 5) * z, car.h * z, car.w * z, 8 * z);
    ctx.fill();
    // Body.
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect((-car.h / 2) * z, (-car.w / 2) * z, car.h * z, car.w * z, 9 * z);
    ctx.fill();
    // Cabin + windshield.
    ctx.fillStyle = '#1d2733';
    ctx.beginPath();
    ctx.roundRect((-car.h * 0.22) * z, (-car.w * 0.38) * z, car.h * 0.4 * z, car.w * 0.76 * z, 5 * z);
    ctx.fill();
    ctx.fillStyle = 'rgba(207,232,239,0.85)';
    ctx.fillRect((car.h * 0.16) * z, (-car.w * 0.32) * z, 5 * z, car.w * 0.64 * z);
    // Headlights / taillights.
    ctx.fillStyle = '#fff6c9';
    ctx.fillRect((car.h / 2 - 4) * z, (-car.w / 2 + 3) * z, 3 * z, 7 * z);
    ctx.fillRect((car.h / 2 - 4) * z, (car.w / 2 - 10) * z, 3 * z, 7 * z);
    ctx.fillStyle = car.brakeLight ? '#ff2a2a' : '#a02020';
    ctx.fillRect((-car.h / 2 + 1) * z, (-car.w / 2 + 3) * z, 3 * z, 7 * z);
    ctx.fillRect((-car.h / 2 + 1) * z, (car.w / 2 - 10) * z, 3 * z, 7 * z);
    if (car.type === 'police') {
      // Light bar, alternating flash.
      const phase = Math.floor(state.time * 6) % 2 === 0;
      ctx.fillStyle = phase ? '#ff2a2a' : '#2a6aff';
      ctx.fillRect((-6) * z, (-car.w / 2 + 4) * z, 12 * z, 8 * z);
      ctx.fillStyle = phase ? '#2a6aff' : '#ff2a2a';
      ctx.fillRect((-6) * z, (car.w / 2 - 12) * z, 12 * z, 8 * z);
      ctx.fillStyle = '#e8e8e8';
      ctx.font = `bold ${9 * z}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('SBPD', 0, 3 * z);
    }
    if (car.type === 'soltaxi') {
      ctx.fillStyle = '#20242c';
      ctx.font = `bold ${9 * z}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, 3 * z);
    }
    // Damage smoke.
    if (car.hp < 35 && car.hp > 0) {
      ctx.fillStyle = 'rgba(80,80,80,0.5)';
      ctx.beginPath();
      ctx.arc((car.h / 2 - 8) * z, 0, (6 + Math.sin(state.time * 9) * 2) * z, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPerson(state, x, y, angle, shirt, pants, skin, opts = {}) {
    const s = worldToScreen(state, x, y);
    const z = state.camera.zoom;
    const walk = opts.walking ? Math.sin(state.time * 10 + x * 0.05) * 3 : 0;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(3 * z, 4 * z, 11 * z, 8 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    // Legs.
    ctx.fillStyle = pants;
    ctx.fillRect((-10) * z, (-6 + walk) * z, 8 * z, 5 * z);
    ctx.fillRect((-10) * z, (1 - walk) * z, 8 * z, 5 * z);
    // Torso.
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.roundRect((-6) * z, (-7) * z, 14 * z, 14 * z, 4 * z);
    ctx.fill();
    // Head.
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc((10) * z, 0, 6.5 * z, 0, Math.PI * 2);
    ctx.fill();
    // Hair cap.
    ctx.fillStyle = opts.hair ?? '#2a1f14';
    ctx.beginPath();
    ctx.arc((8) * z, 0, 6.5 * z, Math.PI * 0.6, Math.PI * 1.4);
    ctx.fill();
    if (opts.gun) {
      ctx.fillStyle = '#20242c';
      ctx.fillRect((12) * z, (-2) * z, 12 * z, 4 * z);
    }
    ctx.restore();
  }

  function drawBeacon(state) {
    const t = state.objectiveTarget;
    if (!t) return;
    const s = worldToScreen(state, t.x, t.y);
    const z = state.camera.zoom;
    const pulse = 1 + Math.sin(state.time * 4) * 0.15;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#ffd23a';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 46 * z * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#ffd23a';
    ctx.lineWidth = 3 * z;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 30 * z * pulse, 0, Math.PI * 2);
    ctx.stroke();
    // A light pillar, visible from far away.
    const grad = ctx.createLinearGradient(0, s.y - 220 * z, 0, s.y);
    grad.addColorStop(0, 'rgba(255,210,58,0)');
    grad.addColorStop(1, 'rgba(255,210,58,0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(s.x - 6 * z, s.y - 220 * z, 12 * z, 220 * z);
    ctx.fillStyle = '#ffd23a';
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - 26 * z);
    ctx.lineTo(s.x - 9 * z, s.y - 44 * z);
    ctx.lineTo(s.x + 9 * z, s.y - 44 * z);
    ctx.closePath();
    ctx.fill();
  }

  function drawParticles(state) {
    for (const pt of state.particles) {
      const s = worldToScreen(state, pt.x, pt.y);
      const z = state.camera.zoom;
      const a = clamp(pt.life / pt.maxLife, 0, 1);
      if (pt.kind === 'spark') {
        ctx.fillStyle = `rgba(255,200,60,${a})`;
        ctx.fillRect(s.x - pt.size * z / 2, s.y - pt.size * z / 2, pt.size * z, pt.size * z);
      } else if (pt.kind === 'smoke') {
        ctx.fillStyle = `rgba(120,120,120,${a * 0.5})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, pt.size * z * (1.6 - a * 0.6), 0, Math.PI * 2);
        ctx.fill();
      } else if (pt.kind === 'blood') {
        ctx.fillStyle = `rgba(160,20,20,${a})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, pt.size * z, 0, Math.PI * 2);
        ctx.fill();
      } else if (pt.kind === 'flash') {
        ctx.fillStyle = `rgba(255,240,150,${a})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, pt.size * z, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawPickups(state) {
    for (const m of state.city.medallions) {
      if (m.taken) continue;
      const s = worldToScreen(state, m.x, m.y);
      const z = state.camera.zoom;
      const bob = Math.sin(state.time * 3 + m.x) * 3;
      ctx.fillStyle = 'rgba(255,210,58,0.35)';
      ctx.beginPath();
      ctx.arc(s.x, s.y + bob * z, 16 * z, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd23a';
      ctx.beginPath();
      ctx.arc(s.x, s.y + bob * z, 8 * z, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#b8860b';
      ctx.font = `bold ${11 * z}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('☀', s.x, s.y + bob * z + 4 * z);
    }
    for (const pk of state.pickups) {
      if (pk.taken) continue;
      const s = worldToScreen(state, pk.x, pk.y);
      const z = state.camera.zoom;
      ctx.fillStyle = pk.kind === 'health' ? '#e8e8e8' : '#3a5ac9';
      ctx.beginPath();
      ctx.roundRect((s.x - 12 * z), (s.y - 12 * z), 24 * z, 24 * z, 5 * z);
      ctx.fill();
      ctx.fillStyle = pk.kind === 'health' ? '#c93a3a' : '#e8e8e8';
      ctx.font = `bold ${16 * z}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(pk.kind === 'health' ? '+' : '🛡', s.x, s.y + 6 * z);
    }
  }

  function drawVignette() {
    const grad = ctx.createRadialGradient(
      viewW / 2, viewH / 2, Math.min(viewW, viewH) * 0.45,
      viewW / 2, viewH / 2, Math.max(viewW, viewH) * 0.75,
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(40,20,0,0.28)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, viewW, viewH);
    // Warm sun wash from the top-left.
    const sun = ctx.createLinearGradient(0, 0, viewW * 0.5, viewH * 0.5);
    sun.addColorStop(0, 'rgba(255,190,90,0.10)');
    sun.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, viewW, viewH);
  }

  return {
    resize,
    viewSize() { return { w: viewW, h: viewH }; },
    worldToScreen,
    draw(state) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawGround(state);
      drawBuildings(state);
      drawBeacon(state);
      drawPickups(state);
      // Mara waiting for pickup.
      if (state.maraWaiting) {
        drawPerson(state, state.maraWaiting.x, state.maraWaiting.y, Math.sin(state.time) * 0.4, '#c93a8f', '#20242c', '#e8b88a', { hair: '#1a1a1a' });
        const s = worldToScreen(state, state.maraWaiting.x, state.maraWaiting.y - 34);
        ctx.fillStyle = '#ffd23a';
        ctx.font = `bold ${13}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('MARA', s.x, s.y);
      }
      for (const ped of state.peds) {
        if (ped.dead) {
          const s = worldToScreen(state, ped.x, ped.y);
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.beginPath();
          ctx.ellipse(s.x, s.y, 12 * state.camera.zoom, 7 * state.camera.zoom, ped.angle, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }
        drawPerson(state, ped.x, ped.y, ped.angle, ped.shirt, ped.pants, ped.skin, { walking: ped.state !== 'wait' });
        if (ped.taxi) {
          const s = worldToScreen(state, ped.x, ped.y - 30);
          ctx.fillStyle = '#ffd23a';
          ctx.font = `bold ${12}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(`TAXI $${ped.fare}`, s.x, s.y);
        }
      }
      for (const cop of state.cops) {
        drawPerson(state, cop.x, cop.y, cop.angle, '#2a4a9c', '#1a1a2a', '#d9a06a', { gun: true, walking: true, hair: '#3a2a1a' });
      }
      for (const e of state.enemies) {
        drawPerson(state, e.x, e.y, e.angle, e.shirt, '#2a2a2a', '#c98a5a', { gun: true, walking: e.state !== 'guard', hair: '#1a1a1a' });
      }
      for (const car of state.cars) drawCar(state, car);
      // The player, on foot.
      const p = state.player;
      if (!p.inCar && !p.dead) {
        const blink = p.invulnerable > 0 && Math.floor(state.time * 12) % 2 === 0;
        if (!blink) {
          drawPerson(state, p.x, p.y, p.aimAngle, '#e8e8e8', '#2a3a5a', '#d9a06a', { gun: true, walking: true, hair: '#1a1208' });
          // Aim line.
          const s = worldToScreen(state, p.x, p.y);
          const z = state.camera.zoom;
          ctx.strokeStyle = 'rgba(255,255,255,0.35)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(s.x + Math.cos(p.aimAngle) * 24 * z, s.y + Math.sin(p.aimAngle) * 24 * z);
          ctx.lineTo(s.x + Math.cos(p.aimAngle) * 60 * z, s.y + Math.sin(p.aimAngle) * 60 * z);
          ctx.stroke();
        }
      }
      // Bullets.
      ctx.fillStyle = '#fff2a0';
      for (const b of state.bullets) {
        const s = worldToScreen(state, b.x, b.y);
        ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
      }
      drawParticles(state);
      drawVignette();
    },
  };
}

// hud.js: the heads-up display — minimap canvas, wanted stars, health,
// money, objective banner, speedometer and toast messages (all DOM).

import { CAR_TYPES, MEDALLION_COUNT, PALETTE, PITCH, WORLD } from './config.js';
import { formatClock, formatMoney } from './utils.js';
import { districtAt } from './state.js';
import { landmarkCenter } from './city.js';

export function createHud() {
  const el = {
    root: document.getElementById('hud'),
    minimap: document.getElementById('minimap'),
    stars: document.getElementById('stars'),
    money: document.getElementById('money'),
    clock: document.getElementById('clock'),
    district: document.getElementById('district'),
    healthFill: document.getElementById('health-fill'),
    armorFill: document.getElementById('armor-fill'),
    healthText: document.getElementById('health-text'),
    speed: document.getElementById('speed'),
    vehicle: document.getElementById('vehicle'),
    objective: document.getElementById('objective'),
    hint: document.getElementById('hint'),
    toasts: document.getElementById('toasts'),
    medallions: document.getElementById('medallions'),
  };
  const mapCtx = el.minimap.getContext('2d');
  const MAP = 172; // minimap px
  let lastToastCount = 0;

  function drawMinimap(state) {
    const city = state.city;
    const scale = MAP / city.worldW;
    mapCtx.clearRect(0, 0, MAP, MAP);
    // Round frame.
    mapCtx.save();
    mapCtx.beginPath();
    mapCtx.arc(MAP / 2, MAP / 2, MAP / 2, 0, Math.PI * 2);
    mapCtx.clip();
    // Sea + land.
    mapCtx.fillStyle = '#1f6f8b';
    mapCtx.fillRect(0, 0, MAP, MAP);
    mapCtx.fillStyle = '#b3a894';
    mapCtx.fillRect(0, 0, MAP, city.worldW * scale);
    // Parks.
    mapCtx.fillStyle = '#6fa34e';
    for (const park of city.parks) {
      mapCtx.fillRect(park.x * scale, park.y * scale, park.w * scale, park.h * scale);
    }
    // Roads.
    mapCtx.fillStyle = '#3d4149';
    for (let i = 0; i <= WORLD.blocks; i += 1) {
      const c = i * PITCH + WORLD.road / 2;
      mapCtx.fillRect((c - WORLD.road / 2) * scale, 0, WORLD.road * scale, city.worldW * scale);
      mapCtx.fillRect(0, (c - WORLD.road / 2) * scale, city.worldW * scale, WORLD.road * scale);
    }
    // Buildings.
    mapCtx.fillStyle = 'rgba(120,90,60,0.8)';
    for (const b of city.buildings) {
      mapCtx.fillRect(b.x * scale, b.y * scale, Math.max(2, b.w * scale), Math.max(2, b.h * scale));
    }
    // Landmark dots.
    const dots = { safehouse: '#e8a13a', garage: '#3aa3e8', hospital: '#ffffff', casino: '#c93a8f', police: '#3a5ac9' };
    for (const [key, color] of Object.entries(dots)) {
      const p = landmarkCenter(city, key);
      mapCtx.fillStyle = color;
      mapCtx.beginPath();
      mapCtx.arc(p.x * scale, p.y * scale, 3.5, 0, Math.PI * 2);
      mapCtx.fill();
    }
    // Police blips (flashing blue/red).
    const flash = Math.floor(state.time * 4) % 2 === 0;
    mapCtx.fillStyle = flash ? '#2a6aff' : '#ff2a2a';
    for (const car of state.cars) {
      if (car.driver !== 'police') continue;
      mapCtx.fillRect(car.x * scale - 2, car.y * scale - 2, 4, 4);
    }
    // Objective marker (pulsing yellow).
    if (state.objectiveTarget) {
      const t = state.objectiveTarget;
      const r = 5 + Math.sin(state.time * 5) * 1.5;
      mapCtx.fillStyle = '#ffd23a';
      mapCtx.beginPath();
      mapCtx.arc(t.x * scale, t.y * scale, r, 0, Math.PI * 2);
      mapCtx.fill();
      mapCtx.strokeStyle = '#fff';
      mapCtx.lineWidth = 1.5;
      mapCtx.stroke();
    }
    // Player arrow.
    const p = state.player;
    mapCtx.save();
    mapCtx.translate(p.x * scale, p.y * scale);
    mapCtx.rotate(p.angle);
    mapCtx.fillStyle = '#ffffff';
    mapCtx.strokeStyle = '#20242c';
    mapCtx.lineWidth = 1;
    mapCtx.beginPath();
    mapCtx.moveTo(7, 0);
    mapCtx.lineTo(-5, -5);
    mapCtx.lineTo(-5, 5);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.stroke();
    mapCtx.restore();
    mapCtx.restore();
    // Ring.
    mapCtx.strokeStyle = 'rgba(255,255,255,0.85)';
    mapCtx.lineWidth = 3;
    mapCtx.beginPath();
    mapCtx.arc(MAP / 2, MAP / 2, MAP / 2 - 1.5, 0, Math.PI * 2);
    mapCtx.stroke();
  }

  function updateToasts(state) {
    const active = state.messages.filter((m) => state.time < m.until);
    if (active.length !== lastToastCount) {
      lastToastCount = active.length;
      el.toasts.innerHTML = active.map((m) => `<div class="toast ${m.kind}">${m.text}</div>`).join('');
    }
  }

  return {
    show() { el.root.style.display = 'block'; },
    hide() { el.root.style.display = 'none'; },
    update(state, hintText) {
      drawMinimap(state);
      updateToasts(state);
      const p = state.player;
      // Wanted stars.
      let stars = '';
      for (let i = 0; i < 5; i += 1) stars += `<span class="star ${i < state.wanted ? 'lit' : ''}">★</span>`;
      el.stars.innerHTML = stars;
      el.money.textContent = formatMoney(p.money);
      el.clock.textContent = formatClock(state.clock);
      el.district.textContent = districtAt(state.city, p.x, p.y);
      el.healthFill.style.width = `${p.hp}%`;
      el.healthFill.className = p.hp < 30 ? 'fill low' : 'fill';
      el.armorFill.style.width = `${p.armor}%`;
      el.healthText.textContent = `${Math.ceil(p.hp)} HP`;
      el.medallions.textContent = `☀ ${state.medallions}/${MEDALLION_COUNT}`;
      if (p.inCar) {
        const kmh = Math.round(Math.abs(p.inCar.speed) * 0.36);
        el.speed.textContent = `${kmh}`;
        el.vehicle.textContent = p.inCar.name;
        el.speed.parentElement.style.display = 'block';
      } else {
        el.speed.parentElement.style.display = 'none';
      }
      el.objective.textContent = state.objective || (state.mission ? '' : 'Visit Mara’s office for a job — or explore Solmar Bay');
      el.objective.style.display = state.objective || !state.mission ? 'block' : 'none';
      el.hint.textContent = hintText ?? '';
    },
  };
}

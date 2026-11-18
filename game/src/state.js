// state.js: the one mutable game state every system reads and writes.
// main.js creates it; systems never create their own copy.

export const SCREEN_MENU = 'menu';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_DEAD = 'dead';
export const SCREEN_BUSTED = 'busted';

export function createState(seed) {
  return {
    seed,
    screen: SCREEN_MENU,
    time: 0,                 // seconds since this run started
    clock: 17 * 60 + 24,     // minutes of day: golden hour, 5:24 PM
    city: null,              // built by city.js
    player: {
      x: 0, y: 0, angle: 0, aimAngle: 0,
      hp: 100, armor: 0, money: 250,
      inCar: null,           // car object or null
      fireCooldown: 0,
      dead: false, busted: false,
      invulnerable: 0,
    },
    cars: [],                // every car: player, traffic, parked, police
    peds: [],                // pedestrians
    cops: [],                // on-foot police
    enemies: [],             // armed rivals (mission combat)
    bullets: [],
    particles: [],
    pickups: [],             // health / armor / medallions
    wanted: 0,
    wantedTimer: 0,          // time since last seen by police
    lastCrimeAt: 0,
    mission: null,           // active mission runtime state
    missionsDone: [],
    taxi: null,              // active taxi fare
    medallions: 0,
    stats: { carsStolen: 0, kills: 0, distance: 0, missions: 0, fares: 0 },
    camera: { x: 0, y: 0, zoom: 1 },
    messages: [],            // toast queue {text, until, kind}
    objective: '',           // current mission objective line for the HUD
    objectiveTarget: null,   // {x, y} world marker for the HUD arrow + minimap
    muted: false,
    paused: false,
    shotMode: null,          // set by ?shot= for staged screenshots
    storyComplete: false,
  };
}

// A short toast above the HUD. kind: 'info' | 'good' | 'bad'.
export function notify(state, text, kind = 'info', seconds = 4) {
  state.messages.push({ text, kind, until: state.time + seconds });
  if (state.messages.length > 4) state.messages.shift();
}

export function districtAt(city, x, y) {
  if (!city) return 'Solmar Bay';
  for (const d of city.districts) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
  }
  return y >= city.worldH - 240 ? 'Sunset Beach' : 'Solmar Bay';
}

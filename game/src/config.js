// Solmar Bay — a sun-soaked open-world crime game. All names, characters,
// places and art are original, made for this game.
// config.js: every tuning number, palette and catalogue in one place.

export const WORLD = {
  block: 280,          // city block size in px
  road: 72,            // road width in px
  blocks: 10,          // 10 x 10 blocks
  beach: 150,          // sand strip at the south edge
  water: 90,           // water strip beyond the sand
};

export const PITCH = WORLD.block + WORLD.road; // 352
export const WORLD_W = WORLD.blocks * WORLD.block + (WORLD.blocks + 1) * WORLD.road;
export const WORLD_H = WORLD_W + WORLD.beach + WORLD.water;

// Golden-hour palette: warm sun, teal sea, dusty streets.
export const PALETTE = {
  asphalt: '#3d4149',
  asphaltEdge: '#2f333b',
  lane: '#e8d98a',
  sidewalk: '#b3a894',
  sidewalkEdge: '#9c917d',
  grass: '#7fae5a',
  sand: '#e8d29a',
  water: '#2f8fae',
  waterDeep: '#1f6f8b',
  crosswalk: '#e8e4da',
  buildingRoof: ['#c96f4a', '#d9a05b', '#7a9cc6', '#8fb996', '#b78fc6', '#d97b7b', '#5ba3a3', '#c9b458'],
  buildingSide: ['#a85438', '#b3814a', '#5f7fa8', '#739a7d', '#9778a8', '#b25f5f', '#478585', '#a8944a'],
  buildingGlass: '#cfe8ef',
  park: '#6fa34e',
  tree: '#4e7d3a',
  treeDark: '#3c6130',
};

export const DISTRICTS = [
  { name: 'Downtown', cols: [0, 4], rows: [0, 2], tall: true },
  { name: 'North Hills', cols: [5, 9], rows: [0, 2], park: true },
  { name: 'Old Town', cols: [0, 3], rows: [3, 6] },
  { name: 'Marina', cols: [4, 6], rows: [3, 6] },
  { name: 'Harbor', cols: [7, 9], rows: [3, 6], docks: true },
  { name: 'Beachfront', cols: [0, 9], rows: [7, 9], beach: true },
];

// Vehicle catalogue — original models, tuned per class.
export const CAR_TYPES = {
  duna:    { name: 'Duna Sedan',    w: 34, h: 62, accel: 240, maxSpeed: 430, grip: 3.4, color: '#c9c9c9' },
  brisa:   { name: 'Brisa Hatch',   w: 32, h: 56, accel: 260, maxSpeed: 400, grip: 3.8, color: '#e8b23a' },
  toro:    { name: 'Toro Pickup',   w: 36, h: 66, accel: 220, maxSpeed: 410, grip: 3.0, color: '#7a4a3a' },
  carga:   { name: 'Carga Van',     w: 38, h: 70, accel: 180, maxSpeed: 350, grip: 2.6, color: '#5a7a9c' },
  vela:    { name: 'Vela GT',       w: 34, h: 64, accel: 340, maxSpeed: 620, grip: 4.2, color: '#c93a4a' },
  soltaxi: { name: 'Sol Taxi',      w: 34, h: 62, accel: 240, maxSpeed: 430, grip: 3.4, color: '#e8c93a' },
  police:  { name: 'SBPD Interceptor', w: 34, h: 64, accel: 320, maxSpeed: 580, grip: 4.0, color: '#20242c' },
};

export const PLAYER = {
  walkSpeed: 185,
  sprintSpeed: 265,
  radius: 13,
  maxHp: 100,
  maxArmor: 100,
};

export const COMBAT = {
  pistolDamage: 34,
  bulletSpeed: 950,
  bulletRange: 520,
  fireInterval: 0.22,   // seconds between shots
  enemyDamage: 9,
  enemyFireInterval: 0.9,
};

export const WANTED = {
  maxStars: 5,
  decayDelay: 14,       // seconds unseen before stars start to fall
  decayInterval: 9,     // seconds per star lost while unseen
  policeCars: [0, 2, 3, 4, 5, 6], // cop cars per star level
  footCops: [0, 0, 2, 3, 4, 5],
  bribeCost: 150,       // garage clears heat up to 2 stars
};

export const SAVE_KEY = 'solmar-bay-save-v1';

export const MISSION_REWARDS = { m1: 300, m2: 500, m3: 700, m4: 900, m5: 2000 };
export const TAXI_FARE = [60, 90, 120, 150];
export const MEDALLION_REWARD = 100;
export const MEDALLION_COUNT = 10;

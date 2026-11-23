// Solara Heat — every tuning number and colour in one place.
// The city is a fixed 3200x2400 world; the renderer shows a 1280x720 window of it and the
// camera follows the player, so no rule below depends on the screen size.
export const WORLD = { width: 3200, height: 2400 };
export const VIEW = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const ROAD = { width: 96, spacing: 400, first: 200 };
export const PLAYER = {
  radius: 13,
  walkSpeed: 185,
  runSpeed: 250,
  health: 100,
  punchDamage: 12,
  punchRange: 46,
  punchCooldown: 0.38,
};
export const CAR = {
  length: 54,
  width: 26,
  accel: 420,
  brake: 620,
  reverseAccel: 220,
  maxSpeed: 520,
  maxReverse: 160,
  turnRate: 2.6,
  drag: 0.55,
  stealRange: 72,
};
export const TRAFFIC_CARS = 11;
export const PEDESTRIANS = 15;
export const POLICE = { maxChase: 4, ramDamage: 2, ramCooldown: 1.6, spawnRange: 620 };
export const WANTED = { max: 3, decaySeconds: 26, hideSeconds: 14 };
export const COMBAT = { bulletSpeed: 900, bulletRange: 620, fireCooldown: 0.22, damage: 34 };
export const CASH_PICKUPS = 8;
export const CASH_VALUE = 50;

export const MISSIONS = [
  {
    id: 1,
    name: 'First Wheels',
    intro: 'Mara needs wheels. Steal a car, then drive it to Rocco\u2019s Garage.',
    objectiveSteal: 'Steal a car \u2014 walk up to one and press E',
    objectiveDrive: 'Drive to Rocco\u2019s Garage',
    reward: 200,
  },
  {
    id: 2,
    name: 'The Courier',
    intro: 'A package is waiting at Solara Market. Pick it up, deliver it to the docks \u2014 and the police will notice.',
    objectivePickup: 'Pick up the package at Solara Market',
    objectiveDeliver: 'Deliver the package to the docks \u2014 evade the police!',
    reward: 400,
  },
  {
    id: 3,
    name: 'Harbor Lights Heist',
    intro: 'The vault car is parked at the harbour, gold paint and all. Take it and lose the heat at the garage.',
    objectiveSteal: 'Steal the vault car at the harbour',
    objectiveEscape: 'Escape to Rocco\u2019s Garage \u2014 wanted level 3!',
    reward: 1000,
  },
];

// Districts and mission landmarks, in world coordinates.
export const LANDMARKS = {
  garage: { x: 1500, y: 1840, label: "Rocco's Garage" },
  market: { x: 1200, y: 1040, label: 'Solara Market' },
  docks: { x: 2900, y: 500, label: 'Harbour Docks' },
  vaultCar: { x: 2880, y: 380, label: 'Vault Car' },
  park: { x: 800, y: 800, label: 'Palma Park' },
  start: { x: 1400, y: 1400, label: 'Downtown' },
};

export const PALETTE = {
  backdrop: '#0e1420',
  grass: '#7fae62',
  parkGrass: '#69a454',
  sidewalk: '#c9bfa8',
  road: '#464b58',
  roadLine: '#e8d44f',
  buildingA: '#e07856',
  buildingB: '#e8b04b',
  buildingC: '#5b8fc9',
  buildingD: '#b06a9e',
  roof: '#2e3442',
  water: '#2f7fb8',
  sand: '#d9c48f',
  dock: '#8a7a5c',
  containerA: '#c94f42',
  containerB: '#3f8f6a',
  containerC: '#e8a13c',
  player: '#ffd23e',
  playerCar: '#ff5a3c',
  trafficCar: '#9fb4c8',
  policeCar: '#1d2733',
  ped: '#f2ede4',
  cash: '#ffd23e',
  marker: '#ffd23e',
  text: '#f4f1e8',
  muted: '#c8c2b2',
  panel: '#141a26',
  panelEdge: '#ffd23e',
  health: '#58d68d',
  healthLow: '#e5534b',
  wanted: '#ffcf3f',
  policeLightR: '#ff3b30',
  policeLightB: '#2f7bff',
  minimapBg: 'rgba(12,18,30,0.82)',
  muzzle: '#ffe9a8',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where progress is kept between visits (this browser only). */
export const SAVE_KEY = 'solara-heat.save.v1';

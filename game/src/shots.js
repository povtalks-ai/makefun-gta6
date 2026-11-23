// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple driving
// autopilot (steer toward the mission target, throttle forward, brake for sharp turns), so
// the frame is what a short game really looks like and the same seed always gives the same
// frame. No scene is composited: every pixel is drawn by render.js from the live world.
import { LANDMARKS, MISSIONS, STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const DRIVE_SECONDS = 2;
const CHASE_SECONDS = 6;
const MISSION_SECONDS = 3;

/** Normalise an angle difference to [-PI, PI]. */
function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function nearestRoadX(x) {
  const roads = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
  let best = roads[0];
  for (const rx of roads) if (Math.abs(rx - x) < Math.abs(best - x)) best = rx;
  return best;
}

function nearestRoadY(y) {
  const roads = [200, 600, 1000, 1400, 1800, 2200];
  let best = roads[0];
  for (const ry of roads) if (Math.abs(ry - y) < Math.abs(best - y)) best = ry;
  return best;
}

/**
 * A road-following driving autopilot: it routes along the city grid (vertical road, then
 * horizontal road, then the final approach) instead of cutting straight through buildings,
 * brakes before turns so the turn radius fits the road, and reverses out when wedged.
 * The route is fixed when the target changes; waypoints advance only once reached.
 */
export function createDriver() {
  let route = null;
  let routeTarget = null;
  let wpIndex = 0;
  let lastX = 0;
  let lastY = 0;
  let lastCheck = -10;
  let reversing = 0;
  return function drive(world, tx, ty) {
    const player = world.state.player;
    const time = world.state.time;
    const key = `${tx},${ty}`;
    if (routeTarget !== key) {
      const rxP = nearestRoadX(player.x);
      const ryT = nearestRoadY(ty);
      route = [];
      if (Math.abs(player.x - rxP) > 40) route.push([rxP, player.y]);
      route.push([rxP, ryT]);
      if (Math.abs(tx - rxP) > 30) route.push([tx, ryT]);
      route.push([tx, ty]);
      routeTarget = key;
      wpIndex = 0;
    }
    if (time - lastCheck > 1.5) {
      // Only position proves a wedge: a slow car turning at an intersection is not stuck.
      const moved = Math.hypot(player.x - lastX, player.y - lastY);
      if (lastCheck > 0 && moved < 40 && reversing <= 0) reversing = 0.8;
      lastX = player.x;
      lastY = player.y;
      lastCheck = time;
    }
    if (reversing > 0) {
      reversing -= 1 / 60;
      // Reverse straight out of the wedge; steering while reversing only spins the car.
      return { move: { x: 0, y: 1 }, aimAngle: player.angle, fire: false, enter: false, punch: false, reverse: true };
    }
    let wp = route[Math.min(wpIndex, route.length - 1)];
    while (wpIndex < route.length - 1 && Math.hypot(player.x - wp[0], player.y - wp[1]) < 70) {
      wpIndex += 1;
      wp = route[wpIndex];
    }
    const desired = Math.atan2(wp[1] - player.y, wp[0] - player.x);
    const diff = angleDiff(desired, player.angle);
    const steer = Math.max(-1, Math.min(1, diff * 2.2));
    const speed = player.car ? Math.abs(player.car.speed) : 0;
    const distToWp = Math.hypot(wp[0] - player.x, wp[1] - player.y);
    // Brake for sharp turns only when moving fast: a stopped car cannot steer, so at low
    // speed it creeps forward through the turn instead. Never reverse except to escape a wedge.
    let throttle = -1;
    if (Math.abs(diff) > 0.55 && speed > 120) throttle = 1;
    else if (speed > 300 && distToWp < 220) throttle = 0;
    return { move: { x: steer, y: throttle }, aimAngle: player.angle, fire: false, enter: false, punch: false, reverse: false };
  };
}

/** Put the player into a car at (x, y): the nearest traffic car is teleported there first. */
function putPlayerInCar(world, x, y, angle) {
  const state = world.state;
  let car = null;
  for (const c of state.cars) {
    if (c.kind === 'traffic') {
      car = c;
      break;
    }
  }
  if (!car) return;
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = 0;
  car.kind = 'player';
  car.color = '#ff5a3c';
  state.player.inCar = true;
  state.player.car = car;
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
}

/** Park a police car near the player so the chase is already on. */
function parkPoliceNear(world, x, y, angle) {
  const cop = {
    kind: 'police', x, y, angle, speed: 320, color: '#1d2733',
    axis: 'h', dir: 1, road: y, health: 80, active: true, ramCooldown: 0,
  };
  world.state.police.push(cop);
  return cop;
}

function extrasFor(world) {
  const state = world.state;
  const mission = world.mission();
  return {
    speedKmh: world.speedKmh(),
    objective: world.currentObjective(),
    missionName: state.won ? 'SOLARA HEAT' : `MISSION ${mission.id} \u2014 ${mission.name.toUpperCase()}`,
    muted: false,
    hasSave: false,
    saveText: '',
  };
}

/**
 * Set `world` to the named scene (start, drive, chase or mission; any other name is start)
 * and return the screen to draw over it plus the HUD extras for that frame.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name !== 'drive' && name !== 'chase' && name !== 'mission') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      world.step(STEP, { move: { x: 0, y: 0 }, aimAngle: null, fire: false, enter: false, punch: false }, true);
    }
    return { screen: SCREEN_TITLE, extras: { ...extrasFor(world), hasSave: true, saveText: 'Mission 2 \u00b7 Cash $250' } };
  }

  if (name === 'drive') {
    // Mission 1, stage 2: Mara has stolen a car downtown and is driving south to the garage.
    state.missionIndex = 0;
    state.missionStage = 1;
    state.cash = 50;
    putPlayerInCar(world, 1400, 1020, Math.PI / 2);
    state.player.car.speed = 260;
    const drive = createDriver();
    for (let i = 0; i < DRIVE_SECONDS / STEP; i += 1) {
      world.step(STEP, drive(world, LANDMARKS.garage.x, LANDMARKS.garage.y), false);
    }
    return { screen: SCREEN_PLAY, extras: extrasFor(world) };
  }

  if (name === 'chase') {
    // Mission 2 delivery gone loud: wanted level 3, three police cars ramming Mara's car.
    state.missionIndex = 1;
    state.missionStage = 1;
    state.hasPackage = true;
    state.wanted = 3;
    state.crimeTimer = 26;
    state.cash = 450;
    putPlayerInCar(world, 1800, 1400, 0);
    state.player.car.speed = 380;
    parkPoliceNear(world, 1560, 1400, 0);
    parkPoliceNear(world, 1800, 1160, Math.PI / 2);
    parkPoliceNear(world, 2040, 1400, Math.PI);
    const drive = createDriver();
    for (let i = 0; i < CHASE_SECONDS / STEP; i += 1) {
      const controls = drive(world, 3050, 1400);
      world.step(STEP, controls, false);
      state.wanted = 3;
      state.crimeTimer = 26;
    }
    return { screen: SCREEN_PLAY, extras: extrasFor(world) };
  }

  // mission: the harbour heist. Mara in the gold vault car at the docks, wanted level 3,
  // police closing in, cash on the ground, the garage far to the south.
  state.missionIndex = 2;
  state.missionStage = 1;
  state.wanted = 3;
  state.crimeTimer = 26;
  state.cash = 650;
  let vault = null;
  for (const c of state.cars) if (c.kind === 'vault') vault = c;
  if (vault) {
    vault.x = LANDMARKS.vaultCar.x;
    vault.y = LANDMARKS.vaultCar.y;
    vault.angle = Math.PI / 2;
    state.player.inCar = true;
    state.player.car = vault;
    state.player.x = vault.x;
    state.player.y = vault.y;
    state.player.angle = vault.angle;
    vault.speed = 200;
  }
  parkPoliceNear(world, 2700, 380, 0);
  parkPoliceNear(world, 2900, 700, -Math.PI / 2);
  const drive = createDriver();
  for (let i = 0; i < MISSION_SECONDS / STEP; i += 1) {
    const controls = drive(world, 2900, 1200);
    world.step(STEP, controls, false);
    state.wanted = 3;
    state.crimeTimer = 26;
  }
  return { screen: SCREEN_PLAY, extras: extrasFor(world) };
}

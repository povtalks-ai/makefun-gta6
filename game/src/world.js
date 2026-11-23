// Solara Heat — the game's rules and state, with no drawing and no browser in it: the city
// grid and its districts, the player on foot and in a car, traffic cars and pedestrians, the
// police and the wanted level, combat, cash, the three-mission story and the win/fail states.
// step() advances one fixed step and returns what happened as bit flags, so the caller can
// react (sounds, announcements) without the world knowing about screens or sound.
import {
  CAR, CASH_PICKUPS, CASH_VALUE, COMBAT, LANDMARKS, MISSIONS, PEDESTRIANS,
  PLAYER, POLICE, ROAD, TRAFFIC_CARS, WANTED, WORLD,
} from './config.js';
import { pick, range } from './random.js';

export const EVENT_HIT = 1;
export const EVENT_SHOT = 2;
export const EVENT_CASH = 4;
export const EVENT_CRIME = 8;
export const EVENT_MISSION = 16;
export const EVENT_WIN = 32;
export const EVENT_BUSTED = 64;
export const EVENT_STEAL = 128;

const ROAD_XS = [];
const ROAD_YS = [];
for (let x = ROAD.first; x <= WORLD.width - ROAD.first; x += ROAD.spacing) ROAD_XS.push(x);
for (let y = ROAD.first; y <= WORLD.height - ROAD.first; y += ROAD.spacing) ROAD_YS.push(y);

const BUILDING_COLORS = ['#e07856', '#e8b04b', '#5b8fc9', '#b06a9e', '#7fb069', '#c97b4a'];
const CAR_COLORS = ['#9fb4c8', '#e8b04b', '#7fb069', '#b06a9e', '#5b8fc9', '#e07856', '#dfe3e6'];
const PED_COLORS = ['#f2ede4', '#ffd23e', '#7fb069', '#e07856', '#5b8fc9', '#e8b04b'];

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function circleHitsRect(x, y, r, rect) {
  const cx = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const cy = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  return dist(x, y, cx, cy) < r;
}

function pushOutOfRect(x, y, r, rect) {
  const cx = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const cy = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  const dx = x - cx;
  const dy = y - cy;
  const d = Math.hypot(dx, dy);
  if (d >= r || d === 0) return { x, y, hit: d < r };
  return { x: cx + (dx / d) * r, y: cy + (dy / d) * r, hit: true };
}

export function createWorld(random) {
  // ---- The city, built once from the seed. ----
  const buildings = [];
  const trees = [];
  const containers = [];
  for (let col = 0; col < ROAD_XS.length - 1; col += 1) {
    for (let row = 0; row < ROAD_YS.length - 1; row += 1) {
      const bx = ROAD_XS[col] + ROAD.width / 2 + 10;
      const by = ROAD_YS[row] + ROAD.width / 2 + 10;
      const bw = ROAD.spacing - ROAD.width - 20;
      const bh = ROAD.spacing - ROAD.width - 20;
      const cx = bx + bw / 2;
      const cy = by + bh / 2;
      const isPark = col === 1 && row === 1;
      const isHarbour = col >= 6 && row <= 1;
      const isGarageBlock = col === 3 && row === 4;
      const isMarketBlock = col === 2 && row === 2;
      if (isPark) {
        for (let t = 0; t < 12; t += 1) {
          trees.push({ x: bx + 30 + random() * (bw - 60), y: by + 30 + random() * (bh - 60), r: 14 + random() * 8 });
        }
        continue;
      }
      if (isHarbour) {
        for (let t = 0; t < 5; t += 1) {
          containers.push({
            x: bx + random() * (bw - 90), y: by + random() * (bh - 40),
            w: 70 + random() * 30, h: 30, color: pick(random, ['#c94f42', '#3f8f6a', '#e8a13c']),
          });
        }
        continue;
      }
      if (isGarageBlock || isMarketBlock) {
        buildings.push({
          x: bx + 20, y: by + 20, w: bw - 40, h: bh - 40,
          color: isGarageBlock ? '#8a7a5c' : '#e8b04b', tall: false, label: isGarageBlock ? 'GARAGE' : 'MARKET',
        });
        continue;
      }
      const count = random() < 0.55 ? 2 : 1;
      for (let b = 0; b < count; b += 1) {
        const w = count === 1 ? bw - 40 : (bw - 60) / 2;
        const h = count === 1 ? bh - 40 : bh - 40;
        const x = count === 1 ? bx + 20 : bx + 10 + b * (w + 20);
        buildings.push({
          x, y: by + 20, w, h, color: pick(random, BUILDING_COLORS), tall: random() < 0.5, label: '',
        });
      }
      if (random() < 0.6) trees.push({ x: cx + range(random, -90, 90), y: cy + range(random, -90, 90), r: 12 });
    }
  }

  // ---- Dynamic state. ----
  const player = {
    x: LANDMARKS.start.x, y: LANDMARKS.start.y, angle: -Math.PI / 2, health: PLAYER.health,
    inCar: false, car: null, punchCooldown: 0, fireCooldown: 0, invulnerable: 0,
  };
  const cars = [];
  const peds = [];
  const police = [];
  const bullets = [];
  const particles = [];
  const cashPickups = [];
  for (let i = 0; i < 24; i += 1) bullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 });
  for (let i = 0; i < 80; i += 1) particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, color: '#fff', size: 3 });

  const state = {
    player, cars, peds, police, bullets, particles, cashPickups, buildings, trees, containers,
    roadXs: ROAD_XS, roadYs: ROAD_YS, missionTarget: null,
    wanted: 0, cash: 0, elapsed: 0, missionIndex: 0, missionStage: 0, hasPackage: false,
    won: false, busted: false, banner: null, hint: '',
    crimeTimer: 0, policeTimer: 0, cashTimer: 0, time: 0,
  };

  function spawnParticle(x, y, color, count, speed) {
    let made = 0;
    for (const p of particles) {
      if (made >= count) break;
      if (p.active) continue;
      p.active = true;
      p.x = x;
      p.y = y;
      const a = random() * Math.PI * 2;
      const s = speed * (0.4 + random() * 0.8);
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.life = 0.4 + random() * 0.4;
      p.color = color;
      p.size = 2 + random() * 3;
      made += 1;
    }
  }

  function freeBullet() {
    for (const b of bullets) if (!b.active) return b;
    return null;
  }

  function nearestRoadX(x) {
    let best = ROAD_XS[0];
    for (const rx of ROAD_XS) if (Math.abs(rx - x) < Math.abs(best - x)) best = rx;
    return best;
  }

  function nearestRoadY(y) {
    let best = ROAD_YS[0];
    for (const ry of ROAD_YS) if (Math.abs(ry - y) < Math.abs(best - y)) best = ry;
    return best;
  }

  function spawnTrafficCar() {
    const vertical = random() < 0.5;
    const color = pick(random, CAR_COLORS);
    if (vertical) {
      const rx = pick(random, ROAD_XS);
      const dir = random() < 0.5 ? 1 : -1;
      const cruise = range(random, 120, 200);
      return {
        kind: 'traffic', x: rx + (dir > 0 ? 24 : -24), y: range(random, 100, WORLD.height - 100),
        angle: dir > 0 ? Math.PI / 2 : -Math.PI / 2, speed: cruise, cruise,
        color, axis: 'v', dir, road: rx, health: 100, active: true,
      };
    }
    const ry = pick(random, ROAD_YS);
    const dir = random() < 0.5 ? 1 : -1;
    const cruise = range(random, 120, 200);
    return {
      kind: 'traffic', x: range(random, 100, WORLD.width - 100), y: ry + (dir > 0 ? 24 : -24),
      angle: dir > 0 ? 0 : Math.PI, speed: cruise, cruise,
      color, axis: 'h', dir, road: ry, health: 100, active: true,
    };
  }

  function spawnPed() {
    const rx = pick(random, ROAD_XS);
    const ry = pick(random, ROAD_YS);
    const onVertical = random() < 0.5;
    return {
      x: onVertical ? rx + (random() < 0.5 ? 62 : -62) : range(random, 100, WORLD.width - 100),
      y: onVertical ? range(random, 100, WORLD.height - 100) : ry + (random() < 0.5 ? 62 : -62),
      angle: random() * Math.PI * 2, speed: range(random, 28, 55), tx: 0, ty: 0,
      color: pick(random, PED_COLORS), alive: true, down: 0, flee: 0,
    };
  }

  function spawnCashPickup() {
    const rx = pick(random, ROAD_XS);
    const ry = pick(random, ROAD_YS);
    return { x: rx + range(random, -70, 70), y: ry + range(random, -70, 70), taken: false, bob: random() * 6 };
  }

  function reset() {
    player.x = LANDMARKS.start.x;
    player.y = LANDMARKS.start.y;
    player.angle = -Math.PI / 2;
    player.health = PLAYER.health;
    player.inCar = false;
    player.car = null;
    player.punchCooldown = 0;
    player.fireCooldown = 0;
    player.invulnerable = 0;
    cars.length = 0;
    for (let i = 0; i < TRAFFIC_CARS; i += 1) cars.push(spawnTrafficCar());
    // The vault car waits at the harbour for mission 3.
    cars.push({
      kind: 'vault', x: LANDMARKS.vaultCar.x, y: LANDMARKS.vaultCar.y, angle: Math.PI / 2,
      speed: 0, color: '#ffd23e', axis: 'h', dir: 1, road: LANDMARKS.vaultCar.y, health: 100, active: true,
    });
    peds.length = 0;
    for (let i = 0; i < PEDESTRIANS; i += 1) {
      const ped = spawnPed();
      ped.tx = ped.x;
      ped.ty = ped.y;
      peds.push(ped);
    }
    police.length = 0;
    for (const b of bullets) b.active = false;
    for (const p of particles) p.active = false;
    cashPickups.length = 0;
    for (let i = 0; i < CASH_PICKUPS; i += 1) cashPickups.push(spawnCashPickup());
    state.wanted = 0;
    state.cash = 0;
    state.elapsed = 0;
    state.missionIndex = 0;
    state.missionStage = 0;
    state.hasPackage = false;
    state.won = false;
    state.busted = false;
    state.banner = null;
    state.hint = 'WASD drive / walk \u00b7 E steal car \u00b7 Mouse aim, click shoot \u00b7 F punch';
    state.crimeTimer = 0;
    state.policeTimer = 0;
    state.cashTimer = 0;
    state.time = 0;
  }

  function setBanner(title, sub) {
    state.banner = { title, sub, timer: 3.2 };
  }

  function addWanted(amount) {
    const before = state.wanted;
    state.wanted = Math.min(WANTED.max, state.wanted + amount);
    state.crimeTimer = WANTED.decaySeconds;
    if (state.wanted > before) return true;
    return false;
  }

  function mission() {
    return MISSIONS[Math.min(state.missionIndex, MISSIONS.length - 1)];
  }

  function currentObjective() {
    if (state.won) return 'All missions complete \u2014 free roam Port Solara!';
    if (state.busted) return 'Busted! Press Space to try again.';
    const m = mission();
    if (state.missionIndex === 0) return state.missionStage === 0 ? m.objectiveSteal : m.objectiveDrive;
    if (state.missionIndex === 1) return state.missionStage === 0 ? m.objectivePickup : m.objectiveDeliver;
    return state.missionStage === 0 ? m.objectiveSteal : m.objectiveEscape;
  }

  function missionTarget() {
    if (state.won || state.busted) return null;
    if (state.missionIndex === 0) {
      if (state.missionStage === 0) return null;
      return { x: LANDMARKS.garage.x, y: LANDMARKS.garage.y };
    }
    if (state.missionIndex === 1) {
      return state.missionStage === 0
        ? { x: LANDMARKS.market.x, y: LANDMARKS.market.y }
        : { x: LANDMARKS.docks.x, y: LANDMARKS.docks.y };
    }
    if (state.missionStage === 0) return { x: LANDMARKS.vaultCar.x, y: LANDMARKS.vaultCar.y };
    return { x: LANDMARKS.garage.x, y: LANDMARKS.garage.y };
  }

  function completeMission() {
    const m = mission();
    state.cash += m.reward;
    setBanner(`Mission complete: ${m.name}`, `+$${m.reward}  \u00b7  Cash $${state.cash}`);
    state.missionIndex += 1;
    state.missionStage = 0;
    state.hasPackage = false;
    if (state.missionIndex >= MISSIONS.length) {
      state.won = true;
      setBanner('SOLARA HEAT COMPLETE', `Mara did it. Cash $${state.cash} \u2014 free roam Port Solara!`);
      return EVENT_MISSION | EVENT_WIN;
    }
    const next = mission();
    setBanner(`New mission: ${next.name}`, next.intro);
    return EVENT_MISSION;
  }

  function checkMissions() {
    if (state.won || state.busted) return 0;
    const px = player.x;
    const py = player.y;
    if (state.missionIndex === 0) {
      if (state.missionStage === 0 && player.inCar) {
        state.missionStage = 1;
        setBanner('Wheels secured!', 'Drive to Rocco\u2019s Garage in the south.');
        return EVENT_MISSION;
      }
      if (state.missionStage === 1 && player.inCar && dist(px, py, LANDMARKS.garage.x, LANDMARKS.garage.y) < 110) {
        return completeMission();
      }
    } else if (state.missionIndex === 1) {
      if (state.missionStage === 0 && dist(px, py, LANDMARKS.market.x, LANDMARKS.market.y) < 90) {
        state.missionStage = 1;
        state.hasPackage = true;
        addWanted(1);
        setBanner('Package picked up!', 'Deliver it to the docks \u2014 the police are on you.');
        return EVENT_MISSION | EVENT_CRIME;
      }
      if (state.missionStage === 1 && dist(px, py, LANDMARKS.docks.x, LANDMARKS.docks.y) < 110) {
        return completeMission();
      }
    } else if (state.missionIndex === 2) {
      if (state.missionStage === 0 && player.inCar && player.car && player.car.kind === 'vault') {
        state.missionStage = 1;
        state.wanted = WANTED.max;
        state.crimeTimer = WANTED.decaySeconds;
        setBanner('The vault car is yours!', 'Escape to Rocco\u2019s Garage \u2014 wanted level 3!');
        return EVENT_MISSION | EVENT_CRIME;
      }
      if (state.missionStage === 1 && player.inCar && player.car && player.car.kind === 'vault'
        && dist(px, py, LANDMARKS.garage.x, LANDMARKS.garage.y) < 110) {
        return completeMission();
      }
    }
    return 0;
  }

  function nearestStealableCar() {
    let best = null;
    let bestD = CAR.stealRange;
    for (const car of cars) {
      if (!car.active || car === player.car) continue;
      const d = dist(player.x, player.y, car.x, car.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    for (const cop of police) {
      const d = dist(player.x, player.y, cop.x, cop.y);
      if (d < bestD) {
        bestD = d;
        best = cop;
      }
    }
    return best;
  }

  function enterCar(car) {
    player.inCar = true;
    player.car = car;
    // The car Mara drives is always her red getaway car; the gold vault car keeps its paint.
    car.kind = car.kind === 'vault' ? 'vault' : 'player';
    if (car.kind === 'player') car.color = '#ff5a3c';
    car.speed = 0;
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    spawnParticle(car.x, car.y, '#ffd23e', 6, 90);
  }

  function exitCar() {
    const car = player.car;
    if (!car) return;
    car.speed = 0;
    player.inCar = false;
    player.car = null;
    player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
    player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
    player.angle = car.angle;
  }

  function stealCar() {
    if (player.inCar) {
      exitCar();
      return EVENT_STEAL;
    }
    const car = nearestStealableCar();
    if (!car) return 0;
    const wasPolice = car.kind === 'police';
    const wasVault = car.kind === 'vault';
    enterCar(car);
    if (wasPolice) {
      const idx = police.indexOf(car);
      if (idx >= 0) police.splice(idx, 1);
      addWanted(2);
      setBanner('You stole a police car!', 'The whole force is after you now.');
      return EVENT_STEAL | EVENT_CRIME;
    }
    if (wasVault) {
      addWanted(1);
      return EVENT_STEAL | EVENT_CRIME;
    }
    addWanted(1);
    setBanner('Car stolen!', 'The owner called it in \u2014 wanted level up.');
    return EVENT_STEAL | EVENT_CRIME;
  }

  function punch() {
    if (player.punchCooldown > 0 || player.inCar) return 0;
    player.punchCooldown = PLAYER.punchCooldown;
    const fx = player.x + Math.cos(player.angle) * PLAYER.punchRange;
    const fy = player.y + Math.sin(player.angle) * PLAYER.punchRange;
    let events = 0;
    for (const ped of peds) {
      if (!ped.alive) continue;
      if (dist(fx, fy, ped.x, ped.y) < 26) {
        ped.alive = false;
        ped.down = 4;
        ped.flee = 0;
        spawnParticle(ped.x, ped.y, '#f2ede4', 8, 120);
        addWanted(1);
        events |= EVENT_CRIME;
      }
    }
    for (const cop of police) {
      if (dist(fx, fy, cop.x, cop.y) < 40) {
        cop.health -= PLAYER.punchDamage;
        addWanted(1);
        events |= EVENT_CRIME;
      }
    }
    return events;
  }

  function fireBullet(aimAngle) {
    if (player.fireCooldown > 0 || player.inCar) return 0;
    player.fireCooldown = COMBAT.fireCooldown;
    const bullet = freeBullet();
    if (!bullet) return 0;
    bullet.active = true;
    bullet.x = player.x + Math.cos(aimAngle) * 22;
    bullet.y = player.y + Math.sin(aimAngle) * 22;
    bullet.vx = Math.cos(aimAngle) * COMBAT.bulletSpeed;
    bullet.vy = Math.sin(aimAngle) * COMBAT.bulletSpeed;
    bullet.life = COMBAT.bulletRange / COMBAT.bulletSpeed;
    spawnParticle(bullet.x, bullet.y, '#ffe9a8', 4, 160);
    return EVENT_SHOT;
  }

  function collideBuildings(x, y, r) {
    let nx = x;
    let ny = y;
    let hit = false;
    for (const b of buildings) {
      if (circleHitsRect(nx, ny, r, b)) {
        const out = pushOutOfRect(nx, ny, r, b);
        nx = out.x;
        ny = out.y;
        hit = true;
      }
    }
    for (const c of containers) {
      if (circleHitsRect(nx, ny, r, c)) {
        const out = pushOutOfRect(nx, ny, r, c);
        nx = out.x;
        ny = out.y;
        hit = true;
      }
    }
    return { x: nx, y: ny, hit };
  }

  function stepPlayerOnFoot(dt, move, aimAngle) {
    const len = Math.hypot(move.x, move.y);
    if (len > 0) {
      const speed = PLAYER.walkSpeed;
      const nx = player.x + (move.x / len) * speed * dt;
      const ny = player.y + (move.y / len) * speed * dt;
      const out = collideBuildings(nx, ny, PLAYER.radius);
      player.x = Math.max(24, Math.min(WORLD.width - 24, out.x));
      player.y = Math.max(24, Math.min(WORLD.height - 24, out.y));
      player.angle = Math.atan2(move.y, move.x);
    }
    if (aimAngle !== null && aimAngle !== undefined) player.angle = aimAngle;
    if (player.punchCooldown > 0) player.punchCooldown -= dt;
    if (player.fireCooldown > 0) player.fireCooldown -= dt;
    if (player.invulnerable > 0) player.invulnerable -= dt;
  }

  function stepPlayerCar(dt, controls) {
    const car = player.car;
    if (!car) {
      player.inCar = false;
      return;
    }
    const move = controls.move;
    const forward = move.y < 0 ? 1 : move.y > 0 ? -1 : 0;
    if (move.y < 0) car.speed += CAR.accel * dt;
    else if (move.y > 0) {
      if (car.speed > 0) {
        // S brakes the car to a stop; it only reverses when the driver means it.
        car.speed = Math.max(0, car.speed - CAR.brake * dt);
      } else if (controls.reverse) {
        car.speed -= CAR.reverseAccel * dt;
      }
    } else car.speed -= Math.sign(car.speed) * CAR.drag * 220 * dt;
    if (Math.abs(car.speed) < 8 && move.y === 0) car.speed = 0;
    car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
    const steer = move.x;
    if (car.speed !== 0) {
      // Steering works at any speed (a slow car can still turn away from a wall); its
      // effect grows with speed so fast cars stay controllable.
      const turnEffect = Math.max(0.3, Math.min(1, Math.abs(car.speed) / 200));
      car.angle += steer * CAR.turnRate * dt * Math.sign(car.speed) * turnEffect;
      if (Math.abs(car.speed) > 300 && steer !== 0 && random() < 0.3) {
        spawnParticle(car.x - Math.cos(car.angle) * 24, car.y - Math.sin(car.angle) * 24, '#c9bfa8', 1, 30);
      }
    }
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const out = collideBuildings(nx, ny, 22);
    if (out.hit) {
      // A glancing hit scrubs some speed but never traps the car: it can still steer away.
      car.speed *= 0.85;
      spawnParticle(car.x, car.y, '#e8d44f', 5, 140);
    }
    car.x = Math.max(30, Math.min(WORLD.width - 30, out.x));
    car.y = Math.max(30, Math.min(WORLD.height - 30, out.y));
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    // Running over pedestrians is a crime.
    for (const ped of peds) {
      if (!ped.alive) continue;
      if (dist(car.x, car.y, ped.x, ped.y) < 30 && Math.abs(car.speed) > 60) {
        ped.alive = false;
        ped.down = 4;
        spawnParticle(ped.x, ped.y, '#f2ede4', 10, 160);
        addWanted(1);
      }
    }
    // Bumping traffic cars shoves them forward and scrubs a little speed, never a jam.
    for (const other of cars) {
      if (other === car || !other.active || other.kind === 'vault') continue;
      if (dist(car.x, car.y, other.x, other.y) < 52) {
        car.speed *= 0.9;
        other.speed = Math.max(other.speed, Math.abs(car.speed) * 0.6);
        other.x += Math.cos(car.angle) * 6;
        other.y += Math.sin(car.angle) * 6;
        spawnParticle((car.x + other.x) / 2, (car.y + other.y) / 2, '#e8d44f', 4, 120);
      }
    }
  }

  function stepTraffic(dt) {
    for (const car of cars) {
      if (!car.active || car.kind === 'player' || car.kind === 'vault') continue;
      if (car.kind === 'traffic') {
        // Simple avoidance: slow down when another car is right ahead, then cruise again.
        let targetSpeed = car.cruise || 150;
        for (const other of cars) {
          if (other === car || !other.active) continue;
          const dx = other.x - car.x;
          const dy = other.y - car.y;
          const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
          const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
          if (ahead > 0 && ahead < 90 && side < 30) targetSpeed = Math.min(targetSpeed, 40);
        }
        const px = player.x;
        const py = player.y;
        const pdx = px - car.x;
        const pdy = py - car.y;
        const pAhead = pdx * Math.cos(car.angle) + pdy * Math.sin(car.angle);
        const pSide = Math.abs(-pdx * Math.sin(car.angle) + pdy * Math.cos(car.angle));
        if (pAhead > 0 && pAhead < 80 && pSide < 30) targetSpeed = Math.min(targetSpeed, 0);
        car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 2);
        if (car.axis === 'v') {
          car.y += Math.sin(car.angle) * car.speed * dt;
          car.x = car.road + (car.dir > 0 ? 24 : -24);
          if (car.y < 80 || car.y > WORLD.height - 80) {
            car.dir *= -1;
            car.angle += Math.PI;
          }
          if (Math.abs(car.y - nearestRoadY(car.y)) < 6 && random() < 0.004) {
            car.axis = 'h';
            car.road = nearestRoadY(car.y);
            car.angle = car.dir > 0 ? 0 : Math.PI;
            car.y = car.road + (car.dir > 0 ? 24 : -24);
          }
        } else {
          car.x += Math.cos(car.angle) * car.speed * dt;
          car.y = car.road + (car.dir > 0 ? 24 : -24);
          if (car.x < 80 || car.x > WORLD.width - 80) {
            car.dir *= -1;
            car.angle += Math.PI;
          }
          if (Math.abs(car.x - nearestRoadX(car.x)) < 6 && random() < 0.004) {
            car.axis = 'v';
            car.road = nearestRoadX(car.x);
            car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
            car.x = car.road + (car.dir > 0 ? 24 : -24);
          }
        }
      }
    }
  }

  function stepPeds(dt) {
    for (const ped of peds) {
      if (!ped.alive) {
        ped.down -= dt;
        if (ped.down <= 0) {
          const fresh = spawnPed();
          ped.x = fresh.x;
          ped.y = fresh.y;
          ped.tx = ped.x;
          ped.ty = ped.y;
          ped.alive = true;
          ped.color = fresh.color;
        }
        continue;
      }
      if (ped.flee > 0) {
        ped.flee -= dt;
        const away = Math.atan2(ped.y - player.y, ped.x - player.x);
        ped.x += Math.cos(away) * 120 * dt;
        ped.y += Math.sin(away) * 120 * dt;
        ped.angle = away;
        continue;
      }
      const d = dist(ped.x, ped.y, ped.tx, ped.ty);
      if (d < 12) {
        const rx = pick(random, ROAD_XS);
        const ry = pick(random, ROAD_YS);
        if (random() < 0.5) {
          ped.tx = rx + (random() < 0.5 ? 62 : -62);
          ped.ty = ped.y + range(random, -300, 300);
        } else {
          ped.tx = ped.x + range(random, -300, 300);
          ped.ty = ry + (random() < 0.5 ? 62 : -62);
        }
        ped.tx = Math.max(60, Math.min(WORLD.width - 60, ped.tx));
        ped.ty = Math.max(60, Math.min(WORLD.height - 60, ped.ty));
      } else {
        ped.angle = Math.atan2(ped.ty - ped.y, ped.tx - ped.x);
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
      }
      // Pedestrians scatter from a speeding car or a gunshot.
      if (dist(ped.x, ped.y, player.x, player.y) < 110 && player.inCar && player.car && Math.abs(player.car.speed) > 200) {
        ped.flee = 1.2;
      }
    }
  }

  function spawnPoliceCar() {
    const angle = random() * Math.PI * 2;
    const x = Math.max(80, Math.min(WORLD.width - 80, player.x + Math.cos(angle) * POLICE.spawnRange));
    const y = Math.max(80, Math.min(WORLD.height - 80, player.y + Math.sin(angle) * POLICE.spawnRange));
    return {
      kind: 'police', x: nearestRoadX(x), y: nearestRoadY(y), angle: 0, speed: 0,
      color: '#1d2733', axis: 'h', dir: 1, road: nearestRoadY(y), health: 80, active: true, ramCooldown: 0,
    };
  }

  function stepPolice(dt) {
    const wantCount = state.wanted === 0 ? 0 : state.wanted === 1 ? 2 : state.wanted === 2 ? 3 : POLICE.maxChase;
    state.policeTimer -= dt;
    if (police.length < wantCount && state.policeTimer <= 0) {
      police.push(spawnPoliceCar());
      state.policeTimer = 1.2;
    }
    if (state.wanted === 0 && police.length > 0) {
      police.pop();
    }
    for (const cop of police) {
      const targetAngle = Math.atan2(player.y - cop.y, player.x - cop.x);
      let diff = targetAngle - cop.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      cop.angle += Math.max(-2.8 * dt, Math.min(2.8 * dt, diff));
      // Police are fast but never quite as fast as Mara's getaway car at full speed.
      const chaseSpeed = 330 + state.wanted * 30;
      cop.speed += (chaseSpeed - cop.speed) * Math.min(1, dt * 1.5);
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      // Police stay on land: the harbour water east of x=3040 is not drivable.
      cop.x = Math.max(30, Math.min(3040, cop.x));
      cop.y = Math.max(30, Math.min(WORLD.height - 30, cop.y));
      if (cop.ramCooldown > 0) cop.ramCooldown -= dt;
      const d = dist(cop.x, cop.y, player.x, player.y);
      if (d < 46 && cop.ramCooldown <= 0) {
        cop.ramCooldown = POLICE.ramCooldown;
        player.health -= POLICE.ramDamage;
        cop.speed *= 0.3;
        // A ram jolts the getaway car but never stops it dead: chases stay chases.
        if (player.inCar && player.car) player.car.speed *= 0.9;
        spawnParticle(player.x, player.y, '#ff3b30', 8, 160);
        if (player.health <= 0) {
          player.health = 0;
          state.busted = true;
          setBanner('BUSTED!', 'The Port Solara police caught Mara. Press Space to try again.');
        }
      }
      if (cop.health <= 0) {
        spawnParticle(cop.x, cop.y, '#ff3b30', 14, 200);
        cop.health = 80;
        cop.x = Math.max(80, Math.min(WORLD.width - 80, player.x + range(random, -700, 700)));
        cop.y = Math.max(80, Math.min(WORLD.height - 80, player.y + range(random, -700, 700)));
        cop.speed = 0;
      }
    }
  }

  function stepBullets(dt) {
    for (const b of bullets) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD.width || b.y > WORLD.height) {
        b.active = false;
        continue;
      }
      let hitBuilding = false;
      for (const rect of buildings) {
        if (b.x > rect.x && b.x < rect.x + rect.w && b.y > rect.y && b.y < rect.y + rect.h) hitBuilding = true;
      }
      if (hitBuilding) {
        b.active = false;
        spawnParticle(b.x, b.y, '#e8d44f', 4, 120);
        continue;
      }
      for (const ped of peds) {
        if (!ped.alive) continue;
        if (dist(b.x, b.y, ped.x, ped.y) < 16) {
          ped.alive = false;
          ped.down = 4;
          spawnParticle(ped.x, ped.y, '#ff3b30', 8, 140);
          addWanted(1);
          b.active = false;
          break;
        }
      }
      if (!b.active) continue;
      for (const cop of police) {
        if (dist(b.x, b.y, cop.x, cop.y) < 30) {
          cop.health -= COMBAT.damage;
          spawnParticle(b.x, b.y, '#ff3b30', 6, 140);
          addWanted(1);
          b.active = false;
          break;
        }
      }
    }
  }

  function stepParticles(dt) {
    for (const p of particles) {
      if (!p.active) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 2 * dt;
      p.vy *= 1 - 2 * dt;
      p.life -= dt;
      if (p.life <= 0) p.active = false;
    }
  }

  function stepCash(dt) {
    let events = 0;
    state.cashTimer -= dt;
    for (const pickup of cashPickups) {
      if (pickup.taken) continue;
      pickup.bob += dt * 3;
      if (dist(player.x, player.y, pickup.x, pickup.y) < 34) {
        pickup.taken = true;
        state.cash += CASH_VALUE;
        spawnParticle(pickup.x, pickup.y, '#ffd23e', 10, 150);
        state.cashTimer = 6;
        events |= EVENT_CASH;
      }
    }
    if (state.cashTimer <= 0) {
      for (const pickup of cashPickups) {
        if (pickup.taken) {
          const fresh = spawnCashPickup();
          pickup.x = fresh.x;
          pickup.y = fresh.y;
          pickup.taken = false;
          break;
        }
      }
      state.cashTimer = 6;
    }
    return events;
  }

  function stepWanted(dt) {
    if (state.wanted === 0) return;
    state.crimeTimer -= dt;
    if (state.crimeTimer <= 0) {
      state.wanted -= 1;
      state.crimeTimer = WANTED.decaySeconds;
      if (state.wanted === 0) setBanner('You lost the heat.', 'The police have moved on \u2014 for now.');
    }
  }

  /**
   * One fixed step. `controls` is { move: {x, y}, aimAngle, fire, enter, punch }.
   * `harmless` (the title screen's backdrop) runs traffic and pedestrians but no crime,
   * no missions and no damage.
   */
  function step(dt, controls, harmless) {
    let events = 0;
    state.elapsed += dt;
    state.time += dt;
    if (state.banner && state.banner.timer > 0) state.banner.timer -= dt;

    if (!harmless && !state.busted && !state.won) {
      if (controls.enter) events |= stealCar();
      if (controls.punch) events |= punch();
      if (controls.fire) events |= fireBullet(controls.aimAngle);
    }

    // Busted freezes Mara: the city keeps moving, but she cannot drive or fight.
    if (state.busted) {
      stepTraffic(dt);
      stepPeds(dt);
      stepParticles(dt);
      state.missionTarget = missionTarget();
      return events | EVENT_BUSTED;
    }

    if (player.inCar) stepPlayerCar(dt, controls);
    else stepPlayerOnFoot(dt, controls.move, controls.aimAngle);

    stepTraffic(dt);
    stepPeds(dt);
    if (!harmless) {
      stepPolice(dt);
      stepBullets(dt);
      events |= stepCash(dt);
      stepWanted(dt);
      events |= checkMissions();
      if (state.busted) events |= EVENT_BUSTED;
      if (state.won) events |= EVENT_WIN;
      // Slow health recovery: faster with the heat off, a trickle while it is on.
      if (player.health > 0 && player.health < PLAYER.health) {
        const rate = state.wanted === 0 ? 1.2 : 0.8;
        player.health = Math.min(PLAYER.health, player.health + rate * dt);
      }
    }
    stepParticles(dt);
    state.missionTarget = missionTarget();
    return events;
  }

  function getSave() {
    return {
      missionIndex: state.missionIndex, missionStage: state.missionStage,
      cash: state.cash, health: Math.round(player.health), won: state.won,
    };
  }

  function applySave(save) {
    if (!save) return;
    state.missionIndex = Math.min(save.missionIndex || 0, MISSIONS.length - 1);
    state.missionStage = save.missionStage || 0;
    state.cash = save.cash || 0;
    player.health = save.health || PLAYER.health;
    state.won = !!save.won;
    if (state.missionIndex > 0) {
      setBanner(`Welcome back, Mara.`, `Mission ${state.missionIndex + 1}: ${mission().name} \u2014 Cash $${state.cash}`);
    }
  }

  function speedKmh() {
    if (!player.inCar || !player.car) return 0;
    return Math.round(Math.abs(player.car.speed) * 0.18);
  }

  reset();
  return {
    state, reset, step, mission, currentObjective, missionTarget, getSave, applySave, speedKmh,
    nearestStealableCar, ROAD_XS, ROAD_YS,
  };
}

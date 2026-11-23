// Drawing only: the world's state and the current screen in, pixels out. The 1280x720 view
// window is scaled to fit the browser window and centred; the camera follows the player
// across the 3200x2400 city. Flat shapes and canvas text: roads and blocks, the park and the
// harbour, cars and pedestrians, police light bars, particles, the HUD with its minimap and
// wanted stars, and the title / pause / busted / win panels.
import { CAR, FONT, LANDMARKS, PALETTE, PLAYER, VIEW, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const PANEL = { width: 680, top: 150, line: 32, bottom: 76 };
const MINIMAP = { x: 1036, y: 16, w: 228, h: 172 };

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createRenderer(canvas, opts) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const camera = { x: 0, y: 0 };
  const fixedSize = opts && opts.width && opts.height ? { width: opts.width, height: opts.height } : null;

  function resize() {
    let width;
    let height;
    if (fixedSize) {
      width = fixedSize.width;
      height = fixedSize.height;
    } else {
      const ratio = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
      width = Math.round(window.innerWidth * ratio);
      height = Math.round(window.innerHeight * ratio);
    }
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = `${weight || ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight || ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.fillText(value, x, y);
  }

  function updateCamera(state) {
    camera.x = clamp(state.player.x - VIEW.width / 2, 0, WORLD.width - VIEW.width);
    camera.y = clamp(state.player.y - VIEW.height / 2, 0, WORLD.height - VIEW.height);
  }

  function roadLines(state) {
    return state;
  }

  function drawWorld(state) {
    const ctx = context;
    const camX = camera.x;
    const camY = camera.y;
    // Base ground: sun-baked grass and sand.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(camX - 40, camY - 40, VIEW.width + 80, VIEW.height + 80);

    // Harbour water on the east edge, with a sand beach.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(3020, 0, 60, WORLD.height);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(3080, 0, WORLD.width - 3080, WORLD.height);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let y = 60; y < WORLD.height; y += 180) {
      ctx.fillRect(3090, y, 90, 6);
    }

    // Roads: asphalt strips with dashed centre lines.
    ctx.fillStyle = PALETTE.road;
    for (const rx of state.roadXs || []) {
      ctx.fillRect(rx - 48, 0, 96, WORLD.height);
    }
    for (const ry of state.roadYs || []) {
      ctx.fillRect(0, ry - 48, WORLD.width, 96);
    }
    ctx.fillStyle = PALETTE.roadLine;
    for (const rx of state.roadXs || []) {
      for (let y = 20; y < WORLD.height; y += 64) ctx.fillRect(rx - 3, y, 6, 30);
    }
    for (const ry of state.roadYs || []) {
      for (let x = 20; x < WORLD.width; x += 64) ctx.fillRect(x, ry - 3, 30, 6);
    }

    // Palma Park: deep green block with a pond and palms.
    ctx.fillStyle = PALETTE.parkGrass;
    ctx.fillRect(648, 648, 304, 304);
    ctx.fillStyle = PALETTE.water;
    ctx.beginPath();
    ctx.arc(800, 800, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.sand;
    ctx.beginPath();
    ctx.arc(800, 800, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.water;
    ctx.beginPath();
    ctx.arc(800, 800, 42, 0, Math.PI * 2);
    ctx.fill();

    // Harbour docks: brown piers and shipping containers.
    ctx.fillStyle = PALETTE.dock;
    ctx.fillRect(2648, 248, 400, 504);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(2648, 248, 400, 24);
    for (const c of state.containers) {
      ctx.fillStyle = c.color;
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(c.x, c.y + c.h - 6, c.w, 6);
    }

    // City blocks: sidewalk slabs, then the buildings on them. The building's own colour
    // dominates; a dark rooftop core and bright windows sit on top of it.
    for (const b of state.buildings) {
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(b.x - 8, b.y - 8, b.w + 16, b.h + 16);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 34));
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          ctx.fillRect(b.x + 14 + cx * 34, b.y + 14 + cy * 34, 13, 13);
        }
      }
      ctx.fillStyle = PALETTE.roof;
      ctx.fillRect(b.x + b.w * 0.28, b.y + b.h * 0.28, b.w * 0.44, b.h * 0.44);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(b.x + b.w * 0.34, b.y + b.h * 0.34, 12, 12);
      ctx.fillRect(b.x + b.w * 0.58, b.y + b.h * 0.58, 12, 12);
      if (b.label) {
        text(b.label, b.x + b.w / 2, b.y + b.h / 2 + 8, 22, '#ffffff', 'center', 'bold ');
      }
    }

    // Palm trees.
    for (const t of state.trees) {
      ctx.fillStyle = '#5d7a3a';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7fae62';
      ctx.beginPath();
      ctx.arc(t.x - 4, t.y - 4, t.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cash pickups: spinning gold coins.
    for (const p of state.cashPickups) {
      if (p.taken) continue;
      const bob = Math.sin(p.bob) * 3;
      ctx.fillStyle = '#b8860b';
      ctx.beginPath();
      ctx.arc(p.x, p.y + bob, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.cash;
      ctx.beginPath();
      ctx.arc(p.x, p.y + bob, 10, 0, Math.PI * 2);
      ctx.fill();
      text('$', p.x, p.y + bob + 5, 14, '#7a5b00', 'center', 'bold ');
    }

    // Mission target marker: pulsing ring and beacon.
    if (state.missionTarget) {
      const t = state.missionTarget;
      const pulse = 1 + Math.sin(state.time * 4) * 0.15;
      ctx.strokeStyle = PALETTE.marker;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 34 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,210,62,0.25)';
      ctx.beginPath();
      ctx.arc(t.x, t.y, 30 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.marker;
      ctx.beginPath();
      ctx.moveTo(t.x, t.y - 58);
      ctx.lineTo(t.x - 12, t.y - 80);
      ctx.lineTo(t.x + 12, t.y - 80);
      ctx.closePath();
      ctx.fill();
    }

    // Landmark labels.
    text('PALMA PARK', 800, 640, 18, '#ffffff', 'center', 'bold ');
    text('HARBOUR', 2850, 240, 18, '#ffffff', 'center', 'bold ');
    text("ROCCO'S GARAGE", LANDMARKS.garage.x, LANDMARKS.garage.y + 90, 16, '#ffffff', 'center', 'bold ');
    text('SOLARA MARKET', LANDMARKS.market.x, LANDMARKS.market.y + 90, 16, '#ffffff', 'center', 'bold ');
    text('DOWNTOWN PORT SOLARA', 1400, 1330, 20, '#ffffff', 'center', 'bold ');

    drawCars(state);
    drawPeds(state);
    drawBullets(state);
    drawParticles(state);
    drawPlayer(state);
  }

  function drawCarShape(car, isPlayerCar) {
    const ctx = context;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const len = CAR.length;
    const wid = CAR.width;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-len / 2 + 3, -wid / 2 + 4, len, wid);
    ctx.fillStyle = car.color;
    ctx.fillRect(-len / 2, -wid / 2, len, wid);
    ctx.fillStyle = 'rgba(20,26,38,0.85)';
    ctx.fillRect(-len / 2 + 10, -wid / 2 + 5, 12, wid - 10);
    ctx.fillRect(-2, -wid / 2 + 4, 16, wid - 8);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(len / 2 - 4, -wid / 2 + 3, 3, 6);
    ctx.fillRect(len / 2 - 4, wid / 2 - 9, 3, 6);
    ctx.fillStyle = '#ff3b30';
    ctx.fillRect(-len / 2 + 1, -wid / 2 + 3, 3, 6);
    ctx.fillRect(-len / 2 + 1, wid / 2 - 9, 3, 6);
    if (car.kind === 'vault') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-len / 2 + 4, -3, len - 8, 6);
      text('$', 0, 6, 18, '#7a5b00', 'center', 'bold ');
    }
    if (isPlayerCar) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(-len / 2 - 3, -wid / 2 - 3, len + 6, wid + 6);
    }
    ctx.restore();
  }

  function drawCars(state) {
    const ctx = context;
    for (const car of state.cars) {
      if (!car.active) continue;
      drawCarShape(car, car === state.player.car);
    }
    for (const cop of state.police) {
      drawCarShape(cop, false);
      // Flashing light bar.
      const flash = Math.floor(state.time * 6) % 2 === 0;
      ctx.save();
      ctx.translate(cop.x, cop.y);
      ctx.rotate(cop.angle);
      ctx.fillStyle = flash ? PALETTE.policeLightR : PALETTE.policeLightB;
      ctx.fillRect(-6, -CAR.width / 2 - 2, 12, 6);
      ctx.fillStyle = flash ? PALETTE.policeLightB : PALETTE.policeLightR;
      ctx.fillRect(-6, CAR.width / 2 - 4, 12, 6);
      ctx.restore();
      text('POLICE', cop.x, cop.y - 26, 11, '#ffffff', 'center', 'bold ');
    }
  }

  function drawPeds(state) {
    const ctx = context;
    for (const ped of state.peds) {
      if (!ped.alive) {
        ctx.fillStyle = 'rgba(60,60,60,0.8)';
        ctx.beginPath();
        ctx.ellipse(ped.x, ped.y, 12, 6, ped.angle, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.arc(ped.x, ped.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2e3442';
      ctx.beginPath();
      ctx.arc(ped.x + Math.cos(ped.angle) * 4, ped.y + Math.sin(ped.angle) * 4, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBullets(state) {
    const ctx = context;
    ctx.fillStyle = PALETTE.muzzle;
    for (const b of state.bullets) {
      if (!b.active) continue;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawParticles(state) {
    const ctx = context;
    for (const p of state.particles) {
      if (!p.active) continue;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayer(state) {
    const ctx = context;
    const player = state.player;
    if (player.inCar) return;
    const blink = player.invulnerable > 0 && Math.floor(player.invulnerable * 10) % 2 === 0;
    if (blink) return;
    // Shadow, body, head, and the aim line of Mara's pistol.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(player.x, player.y + 8, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(player.x, player.y, PLAYER.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7a5b00';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x, player.y, PLAYER.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#2e3442';
    ctx.beginPath();
    ctx.arc(player.x + Math.cos(player.angle) * 5, player.y + Math.sin(player.angle) * 5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(player.x + Math.cos(player.angle) * 14, player.y + Math.sin(player.angle) * 14);
    ctx.lineTo(player.x + Math.cos(player.angle) * 34, player.y + Math.sin(player.angle) * 34);
    ctx.stroke();
    text('MARA', player.x, player.y - 22, 11, '#ffffff', 'center', 'bold ');
  }

  function drawMinimap(state) {
    const ctx = context;
    const sx = MINIMAP.w / WORLD.width;
    const sy = MINIMAP.h / WORLD.height;
    ctx.fillStyle = PALETTE.minimapBg;
    ctx.fillRect(MINIMAP.x, MINIMAP.y, MINIMAP.w, MINIMAP.h);
    ctx.strokeStyle = '#ffd23e';
    ctx.lineWidth = 1;
    ctx.strokeRect(MINIMAP.x, MINIMAP.y, MINIMAP.w, MINIMAP.h);
    const mx = (wx) => MINIMAP.x + wx * sx;
    const my = (wy) => MINIMAP.y + wy * sy;
    ctx.fillStyle = '#2f7fb8';
    ctx.fillRect(mx(3050), MINIMAP.y, MINIMAP.w - 3050 * sx, MINIMAP.h);
    ctx.fillStyle = '#69a454';
    ctx.fillRect(mx(648), my(648), 304 * sx, 304 * sy);
    ctx.fillStyle = '#3a3f4a';
    for (const rx of state.roadXs || []) ctx.fillRect(mx(rx - 48), MINIMAP.y, 96 * sx, MINIMAP.h);
    for (const ry of state.roadYs || []) ctx.fillRect(MINIMAP.x, my(ry - 48), MINIMAP.w, 96 * sy);
    if (state.missionTarget) {
      const t = state.missionTarget;
      ctx.fillStyle = PALETTE.marker;
      ctx.beginPath();
      ctx.arc(mx(t.x), my(t.y), 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx(t.x), my(t.y), 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#9fb4c8';
    for (const car of state.cars) {
      if (!car.active || car === state.player.car) continue;
      ctx.fillRect(mx(car.x) - 1, my(car.y) - 1, 3, 3);
    }
    const flash = Math.floor(state.time * 6) % 2 === 0;
    ctx.fillStyle = flash ? '#ff3b30' : '#2f7bff';
    for (const cop of state.police) {
      ctx.beginPath();
      ctx.arc(mx(cop.x), my(cop.y), 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(mx(state.player.x), my(state.player.y), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd23e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx(state.player.x), my(state.player.y), 7, 0, Math.PI * 2);
    ctx.stroke();
    text('PORT SOLARA', MINIMAP.x + 6, MINIMAP.y + MINIMAP.h - 8, 11, '#ffffff', 'left', 'bold ');
  }

  function drawHud(state, extras) {
    const ctx = context;
    const player = state.player;
    ctx.textBaseline = 'top';
    // Health bar and cash, top left.
    ctx.fillStyle = 'rgba(12,18,30,0.82)';
    ctx.fillRect(14, 14, 250, 64);
    text('MARA VOSS', 26, 22, 15, PALETTE.text, 'left', 'bold ');
    text(`$${state.cash}`, 26, 44, 22, PALETTE.cash, 'left', 'bold ');
    const hw = 130;
    const hx = 120;
    const hy = 26;
    ctx.fillStyle = '#333a48';
    ctx.fillRect(hx, hy, hw, 14);
    ctx.fillStyle = player.health > 30 ? PALETTE.health : PALETTE.healthLow;
    ctx.fillRect(hx, hy, hw * (player.health / PLAYER.health), 14);
    text(`${Math.ceil(player.health)}`, hx + hw + 8, hy - 2, 14, PALETTE.text, 'left', 'bold ');
    // Wanted stars, top centre.
    const stars = '★★★';
    ctx.fillStyle = 'rgba(12,18,30,0.82)';
    ctx.fillRect(VIEW.width / 2 - 110, 14, 220, 44);
    text('WANTED', VIEW.width / 2, 20, 12, PALETTE.muted, 'center', 'bold ');
    for (let i = 0; i < 3; i += 1) {
      const filled = i < state.wanted;
      const flash = state.wanted === 3 && Math.floor(state.time * 4) % 2 === 0;
      text('★', VIEW.width / 2 - 36 + i * 36, 34, 26, filled ? (flash ? '#ff3b30' : PALETTE.wanted) : '#555c6a', 'center');
    }
    // Speed and mode, bottom left.
    ctx.fillStyle = 'rgba(12,18,30,0.82)';
    ctx.fillRect(14, VIEW.height - 66, 220, 52);
    text(player.inCar ? `${extras.speedKmh} km/h` : 'ON FOOT', 26, VIEW.height - 58, 24, PALETTE.text, 'left', 'bold ');
    text(player.inCar ? 'DRIVING \u00b7 E to exit' : 'WALKING \u00b7 E near a car to steal it', 26, VIEW.height - 28, 12, PALETTE.muted, 'left');
    // Hint line and mute state, bottom right, on a dark backing so they read over the city.
    if (state.hint) {
      ctx.fillStyle = 'rgba(12,18,30,0.7)';
      ctx.fillRect(VIEW.width - 560, VIEW.height - 122, 544, 22);
      text(extras.muted ? 'M \u00b7 SOUND OFF' : 'M \u00b7 SOUND ON', VIEW.width - 16, VIEW.height - 118, 12, PALETTE.muted, 'right');
      ctx.fillStyle = 'rgba(12,18,30,0.7)';
      ctx.fillRect(VIEW.width - 560, VIEW.height - 96, 544, 22);
      text(state.hint, VIEW.width - 16, VIEW.height - 92, 12, 'rgba(244,241,232,0.9)', 'right');
    }
    // Mission objective bar, bottom centre.
    const objective = extras.objective || '';
    const missionName = extras.missionName || '';
    ctx.fillStyle = 'rgba(12,18,30,0.85)';
    ctx.fillRect(VIEW.width / 2 - 330, VIEW.height - 66, 660, 52);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(VIEW.width / 2 - 330, VIEW.height - 66, 660, 52);
    text(missionName, VIEW.width / 2, VIEW.height - 58, 14, PALETTE.marker, 'center', 'bold ');
    text(objective, VIEW.width / 2, VIEW.height - 36, 15, PALETTE.text, 'center');
    // Hint line, bottom right above minimap edge.
    drawMinimap(state);
    // Mission banner.
    if (state.banner && state.banner.timer > 0) {
      const alpha = Math.min(1, state.banner.timer);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(12,18,30,0.9)';
      ctx.fillRect(VIEW.width / 2 - 320, 84, 640, 74);
      ctx.strokeStyle = PALETTE.panelEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(VIEW.width / 2 - 320, 84, 640, 74);
      text(state.banner.title, VIEW.width / 2, 100, 28, PALETTE.marker, 'center', 'bold ');
      text(state.banner.sub, VIEW.width / 2, 132, 16, PALETTE.text, 'center');
      ctx.globalAlpha = 1;
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (VIEW.width - PANEL.width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = 'rgba(10,14,22,0.72)';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = accent || PALETTE.panelEdge;
    context.lineWidth = 3;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, VIEW.width / 2, y + 72, 46, PALETTE.text, 'center', 'bold ');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], VIEW.width / 2, y + PANEL.top + index * PANEL.line, 20, PALETTE.muted, 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 36, 22, PALETTE.marker, 'center', 'bold ');
  }

  const TITLE_LINES = [
    'Port Solara, a sun-soaked city on the coast. Mara Voss, getaway driver,',
    'is back \u2014 and the whole city is about to know her name.',
    'Three missions: steal wheels, run a courier job, pull the harbour heist.',
    '',
    'WASD / Arrows \u2014 walk & drive   \u00b7   Mouse \u2014 aim   \u00b7   Click \u2014 shoot',
    'E \u2014 steal / exit a car   \u00b7   F \u2014 punch   \u00b7   P / Esc \u2014 pause   \u00b7   M \u2014 mute',
    'Traffic, pedestrians, police and a wanted level: mind the heat.',
  ];

  /** Paint one frame: the city, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, extras) {
    const safeExtras = extras || { speedKmh: 0, objective: '', missionName: '', muted: false, hasSave: false };
    updateCamera(state);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    // Clip to the view window, then translate by the camera.
    context.save();
    context.beginPath();
    context.rect(0, 0, VIEW.width, VIEW.height);
    context.clip();
    context.translate(-camera.x, -camera.y);
    drawWorld(state);
    context.restore();
    if (screen === SCREEN_TITLE) {
      const lines = TITLE_LINES.slice();
      if (safeExtras.hasSave) {
        lines.push('');
        lines.push(`Saved game found: ${safeExtras.saveText || 'progress saved'} \u2014 press C to Continue.`);
      }
      drawPanel('SOLARA HEAT', lines, safeExtras.hasSave ? 'Space to Start  \u00b7  C to Continue saved game' : 'Press Space or click to start');
      return;
    }
    drawHud(state, safeExtras);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The city waits for you. Traffic, police and missions are frozen.', '', `Mission: ${safeExtras.missionName || ''}`, safeExtras.objective || ''], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      drawPanel('BUSTED!', ['The Port Solara police caught Mara Voss.', `Cash kept: $${state.cash} \u00b7 Mission ${Math.min(state.missionIndex + 1, 3)} of 3`, ''], 'Press Space to try again');
    } else if (screen === SCREEN_WIN) {
      drawPanel('SOLARA HEAT COMPLETE', ['Mara pulled the harbour heist and lost the heat.', `Final cash: $${state.cash} \u00b7 All 3 missions complete.`, '', 'Free roam: keep driving Port Solara, or press Space to play again.'], 'Press Space to play again');
    }
  }

  resize();
  if (typeof window !== 'undefined') window.addEventListener('resize', resize);
  return {
    draw, resize,
    camera() {
      return { x: camera.x, y: camera.y, scale: view.scale, offsetX: view.x, offsetY: view.y };
    },
    /** Convert canvas pixel coordinates to world coordinates. */
    screenToWorld(sx, sy) {
      return {
        x: camera.x + (sx - view.x) / view.scale,
        y: camera.y + (sy - view.y) / view.scale,
      };
    },
  };
}

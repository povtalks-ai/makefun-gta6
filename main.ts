// Solara Heat — a gta6-01 entry (Node 22, standard library only): an original open-world
// crime game in this directory's game/ folder, plain static files a desktop browser loads
// offline (game/index.html and its ES modules, no library and no network request). The program
// hands it in: it copies game/ and screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored make.fun library.
// Authored change vs the kit starter: this header now describes Solara Heat, and the copy
// below refuses a screenshots/ folder holding anything but the game's own renders.
//
// The game: Port Solara, a 3200x2400 top-down city. Mara Voss, getaway driver, on foot and by
// car; stealable cars, traffic and pedestrians, a 0-3 star wanted level with chasing police,
// punch and pistol combat, cash pickups, three story missions in order (First Wheels, The
// Courier, Harbor Lights Heist), a HUD with health, cash, wanted stars, speed and a minimap,
// a title screen, pause, a localStorage save with Continue, and WebAudio-oscillator sound.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  const shots = readdirSync(join(here, 'screenshots')).filter((f) => !f.startsWith('.'));
  if (shots.length < 3 || shots.length > 4) throw new Error(`expected 3 or 4 screenshots, found ${shots.length}`);
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

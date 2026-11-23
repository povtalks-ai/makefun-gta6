# Solara Heat — Make GTA 6

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/povtalks-ai/makefun-gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/povtalks-ai/makefun-gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Built for the [make.fun "Make GTA 6" bounty](https://make.fun/bounty/gta6-01), $1,666 in USDC over 100 places.

**Solara Heat** is an original open-world crime game that plays offline in a desktop
browser from static files — no build step, no network request, no Rockstar names, art,
music or map. Everything (the city of Port Solara, Mara Voss, the cars, the story, the
sounds) is original, drawn and synthesised by the game's own code.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

Or open `game/index.html` from any static file server. Keyboard and mouse.

## The game

Mara Voss, getaway driver, is back in Port Solara, a sun-soaked coastal city of
3,200 × 2,400 pixels: a road grid with downtown blocks, Palma Park, a garage district
and a harbour with docks, containers and open water.

- **On foot and by car** — the camera follows Mara; walk the sidewalks or steal any
  car on the street (walk up to one, press `E`) and drive it.
- **Traffic and pedestrians** — cars cruise the roads, slow for the car ahead and turn
  at intersections; pedestrians wander the sidewalks and scatter from speeding cars
  and gunfire.
- **Wanted level 0–3 stars** — stealing, hitting pedestrians or police, and shooting
  raise the heat; police cars spawn, chase and ram. Lay low and the heat decays.
- **Combat** — punch (`F`) and a pistol aimed with the mouse (click to shoot).
- **Three story missions, in order** — 1 *First Wheels*: steal a car, drive it to
  Rocco's Garage. 2 *The Courier*: pick up a package at Solara Market, deliver it to
  the docks while the police are on you. 3 *Harbor Lights Heist*: steal the gold vault
  car at the harbour and escape at wanted level 3. Then free roam.
- **Cash** — mission rewards plus gold pickups scattered around the city.
- **HUD** — health, cash, wanted stars, speed, the mission objective bar, and a live
  minimap of Port Solara with player, police and objective markers.
- **Menus and save** — title screen with the story and controls, pause (`P` / `Esc`),
  busted and win screens, and a localStorage save: mission, cash and health, with
  Continue (`C`) on the title screen.
- **Sound** — WebAudio oscillators only (engine hum, two-tone siren, gunshot, pickup
  blips, mission jingle). `M` mutes. No audio files.

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrows | Walk / drive (W accelerates, S brakes, then reverses) |
| Mouse + click | Aim / shoot the pistol |
| E | Steal / exit a car |
| F | Punch |
| P / Esc | Pause |
| M | Mute |
| Space / click | Start, restart |
| C (title screen) | Continue the saved game |

## Screenshots

The four shots in `screenshots/` are renders of the game's own code, staged through
`?shot=start|drive|chase|mission` (see `shots.json`): the title screen over downtown,
driving to the garage, a three-star police chase, and the harbour heist. They were
rendered headlessly by executing the game's render code in Node with `@napi-rs/canvas`
(the VM's Chromium cannot start), driving the same `stageShot` scenes the browser
stages — no browser capture was available, and no shot is edited or composited.

## Structure

```
game/
  index.html          page shell, one module script
  src/
    config.js         tuning numbers, missions, landmarks, palette
    random.js         seeded RNG (mulberry32) — same seed, same city
    input.js          keyboard + mouse, one-shot action flags
    world.js          city, cars, pedestrians, police, wanted, combat,
                      cash, the three missions, win / busted
    render.js         top-down city, cars, HUD, minimap, menus
    shots.js          the four screenshot scenes + driving autopilot
    main.js           boot, fixed-step loop, WebAudio sound, save/load
main.ts               hands the entry in: copies game/ + screenshots/ to
                      /output and writes /output/dossier.json
serve.ts              tiny static server for local play
shots.json            the four screenshot scenes and their ?shot= queries
```

The simulation runs at a fixed 1/60 s step, the city and traffic are seeded, and
`main.ts` (Node 22, standard library only) is the entrypoint the grader runs:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see `LICENSE`.

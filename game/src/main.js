// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between five screens: title, play, paused, busted and win. Progress (mission, cash,
// health) is saved to localStorage whenever a mission ends, and the title screen offers
// Continue. All sound is WebAudio oscillators only: no audio files, no network.
//
// ?seed=N fixes the city and traffic. ?shot=start|drive|chase|mission (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets window.__shotReady for a
// screenshot.
import { SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_CASH, EVENT_CRIME, EVENT_MISSION, EVENT_SHOT, EVENT_STEAL, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

/** Sound, built only from WebAudio oscillators: engine hum, siren, gunshot, pickup, jingle. */
function createSound() {
  let context = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;

  function ensure() {
    if (context) return true;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return false;
      context = new AudioContextClass();
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(context.destination);
      engineOsc.start();
      sirenOsc = context.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 750;
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(context.destination);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function blip(from, to, duration, type, volume) {
    if (!context || muted) return;
    try {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(from, context.currentTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), context.currentTime + duration);
      gain.gain.setValueAtTime(volume || 0.12, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start();
      osc.stop(context.currentTime + duration + 0.02);
    } catch {
      // Sound is garnish: a failure here must never stop the game.
    }
  }

  return {
    unlock() {
      if (ensure() && context.state === 'suspended') context.resume();
    },
    toggleMute() {
      muted = !muted;
      if (engineGain) engineGain.gain.value = 0;
      if (sirenGain) sirenGain.gain.value = 0;
      return muted;
    },
    isMuted() {
      return muted;
    },
    engine(speed01, driving) {
      if (!context || muted || !engineGain) return;
      engineGain.gain.value = driving ? 0.03 + speed01 * 0.05 : 0;
      engineOsc.frequency.value = 55 + speed01 * 130;
    },
    siren(on, time) {
      if (!context || muted || !sirenGain) return;
      sirenGain.gain.value = on ? 0.035 : 0;
      if (on) sirenOsc.frequency.value = Math.floor(time * 2) % 2 === 0 ? 720 : 960;
    },
    shot() {
      blip(900, 120, 0.12, 'square', 0.14);
    },
    pickup() {
      blip(880, 1320, 0.16, 'sine', 0.14);
    },
    steal() {
      blip(220, 440, 0.2, 'triangle', 0.12);
    },
    mission() {
      blip(523, 523, 0.12, 'sine', 0.14);
      setTimeout(() => blip(659, 659, 0.12, 'sine', 0.14), 110);
      setTimeout(() => blip(784, 784, 0.22, 'sine', 0.14), 220);
    },
    busted() {
      blip(320, 90, 0.6, 'sawtooth', 0.12);
    },
  };
}

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const sound = createSound();

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (typeof save.missionIndex !== 'number') return null;
    return save;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(world.getSave()));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function saveText(save) {
  if (!save) return '';
  return `Mission ${Math.min(save.missionIndex + 1, 3)} of 3 \u00b7 Cash $${save.cash}`;
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.extras);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let save = readSave();
  let muted = false;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function extras() {
    const mission = world.mission();
    return {
      speedKmh: world.speedKmh(),
      objective: world.currentObjective(),
      missionName: world.state.won ? 'SOLARA HEAT' : `MISSION ${mission.id} \u2014 ${mission.name.toUpperCase()}`,
      muted,
      hasSave: save !== null,
      saveText: saveText(save),
    };
  }

  function startGame(continueSave) {
    world.reset();
    if (continueSave && save) world.applySave(save);
    accumulator = 0;
    screen = SCREEN_PLAY;
    sound.unlock();
    announce(`Playing. Mission ${world.state.missionIndex + 1}: ${world.mission().name}.`);
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    writeSave();
    if (won) {
      sound.mission();
      announce(`Solara Heat complete. Cash $${world.state.cash}.`);
    } else {
      sound.busted();
      announce(`Busted. Cash $${world.state.cash}. Press Space to try again.`);
    }
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      muted = sound.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame(false);
      return;
    }
    if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (actions & ACTION_CONFIRM) {
        save = readSave();
        startGame(false);
      }
      return;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  // Continue a saved game with C on the title screen.
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyC' && screen === SCREEN_TITLE && save) {
      startGame(true);
    }
  });

  function aimAngle() {
    const ratio = window.devicePixelRatio || 1;
    const mouse = input.mouse;
    const worldPoint = renderer.screenToWorld(mouse.x * ratio, mouse.y * ratio);
    return Math.atan2(worldPoint.y - world.state.player.y, worldPoint.x - world.state.player.x);
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { move: { x: 0, y: 0 }, aimAngle: null, fire: false, enter: false, punch: false }, true);
      return;
    }
    const move = input.move();
    const car = world.state.player.car;
    const controls = {
      move,
      aimAngle: aimAngle(),
      fire: input.isFiring(),
      enter: !!(actions & ACTION_ENTER),
      punch: !!(actions & ACTION_PUNCH),
      // Holding S in a stopped car reverses; holding it at speed only brakes.
      reverse: move.y > 0 && world.state.player.inCar && car !== null && car.speed <= 0,
    };
    const events = world.step(STEP, controls, false);
    if (events & EVENT_SHOT) sound.shot();
    if (events & EVENT_CASH) sound.pickup();
    if (events & EVENT_STEAL) sound.steal();
    if (events & EVENT_MISSION) {
      sound.mission();
      writeSave();
      announce(`Mission update: ${world.currentObjective()}`);
    }
    if (events & EVENT_CRIME) announce('Wanted level up!');
    if (events & EVENT_BUSTED) endGame(false);
    else if (events & EVENT_WIN) endGame(true);
    const playerCar = world.state.player.car;
    const speed01 = playerCar ? Math.min(1, Math.abs(playerCar.speed) / 520) : 0;
    sound.engine(speed01, world.state.player.inCar);
    sound.siren(world.state.wanted > 0, world.state.time);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // One-shot presses are taken exactly once per frame and shared by the menu and the world.
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      // One-shot presses fire on the first step of the frame only, never twice.
      let firstStep = true;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(firstStep ? actions : 0);
        firstStep = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
      sound.engine(0, false);
      sound.siren(false, 0);
    }
    renderer.draw(world.state, screen, extras());
  }

  // Leaving the tab pauses a running game rather than letting the police catch Mara unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solara Heat. Mara Voss, getaway driver. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

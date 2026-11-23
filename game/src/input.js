// Keyboard and mouse input for Solara Heat. Held keys give a movement vector; one-shot
// presses (confirm, pause, enter/exit car, punch, mute) are queued as bit flags and taken once
// by the loop, so a press between two frames is never lost and never counted twice. The mouse
// position is kept in canvas pixels for combat aiming.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const PUNCH = new Set(['KeyF']);
const MUTE = new Set(['KeyM']);

export function createInput(target) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let firing = false;
  let actions = 0;
  const mouse = { x: 0, y: 0, inside: false };

  function onKeyDown(event) {
    if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (ENTER.has(event.code)) {
      if (!event.repeat) actions |= ACTION_ENTER;
    } else if (PUNCH.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PUNCH;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  }

  function onKeyUp(event) {
    if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
  }

  function clearKeys() {
    up = false;
    down = false;
    left = false;
    right = false;
    firing = false;
  }

  // In a browser this wires real listeners; in a headless harness the same object is driven
  // by calling setKey / setMouse directly, which is how the screenshot autopilot steers.
  if (typeof window !== 'undefined' && target && target.addEventListener) {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearKeys);
    target.addEventListener('pointerdown', (event) => {
      actions |= ACTION_CONFIRM;
      firing = true;
      mouse.x = event.offsetX || 0;
      mouse.y = event.offsetY || 0;
      mouse.inside = true;
    });
    target.addEventListener('pointerup', () => {
      firing = false;
    });
    target.addEventListener('pointermove', (event) => {
      mouse.x = event.offsetX || 0;
      mouse.y = event.offsetY || 0;
      mouse.inside = true;
    });
  }

  return {
    /** Movement vector: x -1..1 (left/right), y -1..1 (up/down). */
    move() {
      return { x: (right ? 1 : 0) - (left ? 1 : 0), y: (down ? 1 : 0) - (up ? 1 : 0) };
    },
    /** True while the mouse button (or touch) is held: the pistol fires. */
    isFiring() {
      return firing;
    },
    mouse,
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Headless / test driver: pretend a key is held or released. */
    setKey(code, held) {
      if (UP.has(code)) up = held;
      else if (DOWN.has(code)) down = held;
      else if (LEFT.has(code)) left = held;
      else if (RIGHT.has(code)) right = held;
    },
    /** Headless / test driver: queue a one-shot action. */
    press(action) {
      actions |= action;
    },
    setFiring(value) {
      firing = value;
    },
    setMouse(x, y) {
      mouse.x = x;
      mouse.y = y;
      mouse.inside = true;
    },
  };
}

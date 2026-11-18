// input.js: keyboard + mouse state. Held keys are read every frame; one-shot
// presses (interact, pause, mute, horn) are queued as flags and taken once.

export const ACT_INTERACT = 1;
export const ACT_PAUSE = 2;
export const ACT_MUTE = 4;
export const ACT_HORN = 8;
export const ACT_RELOAD = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'KeyE') actions |= ACT_INTERACT;
    else if (event.code === 'Escape' || event.code === 'KeyP') actions |= ACT_PAUSE;
    else if (event.code === 'KeyM') actions |= ACT_MUTE;
    else if (event.code === 'KeyH') actions |= ACT_HORN;
    else if (event.code === 'KeyR') actions |= ACT_RELOAD;
    if (UP.has(event.code) || DOWN.has(event.code) || event.code === 'Space') event.preventDefault();
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    mouse.down = true;
    mouse.clicked = true;
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  });
  window.addEventListener('pointerup', () => { mouse.down = false; });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    // -1..1 steering / throttle axes.
    axis() {
      const x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0)
        - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      const y = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0)
        - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
      return { x, y };
    },
    sprint() { return keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('Space'); },
    handbrake() { return keys.has('Space'); },
    mouse,
    takeActions() {
      const taken = actions;
      actions = 0;
      const click = mouse.clicked;
      mouse.clicked = false;
      return { flags: taken, click };
    },
  };
}

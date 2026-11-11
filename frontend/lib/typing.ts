/**
 * "Escribiendo…" in the support chat, on both sides.
 *
 * The writer repeats "typing" every couple of seconds while keys keep coming and says "stopped"
 * after a short pause or when the box is emptied/sent. The reader drops it on its own if nothing
 * arrives for a few seconds, so it never stays stuck if the other side closes the window.
 */
const REPEAT_MS = 2000;
const IDLE_MS = 3000;
export const TYPING_EXPIRES_MS = 5000;

export function createTypingSender(emit: (isTyping: boolean) => void) {
  let on = false;
  let last = 0;
  let idle: ReturnType<typeof setTimeout> | null = null;
  const stop = () => {
    if (idle) clearTimeout(idle);
    idle = null;
    if (on) { on = false; emit(false); }
  };
  const update = (hasText: boolean) => {
    if (!hasText) return stop();
    const now = Date.now();
    if (!on || now - last > REPEAT_MS) { on = true; last = now; emit(true); }
    if (idle) clearTimeout(idle);
    idle = setTimeout(stop, IDLE_MS);
  };
  return { update, stop };
}

/** Turns typing events into a flag that switches itself off when they stop arriving. */
export function createTypingReader(set: (on: boolean) => void) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (isTyping: boolean) => {
    if (timer) clearTimeout(timer);
    timer = null;
    set(isTyping);
    if (isTyping) timer = setTimeout(() => set(false), TYPING_EXPIRES_MS);
  };
}

/**
 * Short synthesized sounds for the session logging (rest timer). One shared AudioContext — phones
 * (iOS Safari) only let it play after it was started or resumed inside a tap, so the logging pages
 * call unlockWorkoutAudio() on every tap; after that, sounds can also fire from a timer.
 *
 * Limits of a web app: no sound while the phone is locked or the browser is in the background,
 * and on iPhones the silent switch mutes it. The vibration is Android only (iOS has no API).
 */

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try { ctx = new Ctor(); } catch { return null; }
  return ctx;
}

/** Call from a tap: creates / resumes the AudioContext so later timer sounds are allowed */
export function unlockWorkoutAudio(): void {
  const c = context();
  if (!c) return;
  if (c.state !== 'running') void c.resume().catch(() => {});
}

/** One tone: frequency (Hz), length (ms), start offset (ms from now) */
function tone(freq: number, ms: number, offsetMs = 0, volume = 0.3): void {
  try {
    const c = context();
    if (!c) return;
    if (c.state !== 'running') void c.resume().catch(() => {});
    const start = c.currentTime + offsetMs / 1000;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + ms / 1000);
    osc.connect(gain).connect(c.destination);
    osc.start(start);
    osc.stop(start + ms / 1000);
  } catch { /* no sound — the screen still changes */ }
}

/** Short tick for the last seconds of a countdown */
export function playCountdownTick(): void {
  tone(660, 90, 0, 0.22);
}

/** Rest is over: two short tones and a longer, higher one */
export function playRestOver(): void {
  tone(880, 160, 0);
  tone(880, 160, 220);
  tone(1175, 480, 440);
}

/** Vibration when the rest is over (Android; iPhones ignore it) */
export function vibrateRestOver(): void {
  try { navigator.vibrate?.([200, 100, 200, 100, 400]); } catch { /* not supported */ }
}

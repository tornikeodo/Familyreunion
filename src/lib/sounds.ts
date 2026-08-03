// Web Audio API based sound effects - no external files needed

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return audioCtx;
}

function playTone(freq: number, duration: number, type: OscillatorType = "sine", vol = 0.15) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = vol;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio not available
  }
}

export function playBidSound() {
  playTone(880, 0.1, "sine", 0.12);
  setTimeout(() => playTone(1100, 0.15, "sine", 0.1), 60);
}

export function playSpinSound() {
  let i = 0;
  const interval = setInterval(() => {
    playTone(300 + i * 20, 0.06, "square", 0.06);
    i++;
    if (i > 30) clearInterval(interval);
  }, 60);
}

export function playHammerSound() {
  playTone(200, 0.15, "square", 0.15);
  setTimeout(() => playTone(150, 0.25, "square", 0.12), 150);
  setTimeout(() => playTone(100, 0.4, "square", 0.1), 350);
}

export function playGoalSound() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((n, i) => {
    setTimeout(() => playTone(n, 0.2, "sine", 0.12), i * 120);
  });
}

export function playTimerWarning() {
  playTone(600, 0.08, "square", 0.1);
}

export function playTimerEnd() {
  playTone(400, 0.15, "sine", 0.15);
  setTimeout(() => playTone(300, 0.3, "sine", 0.12), 150);
}

export function playResultReveal() {
  playTone(523, 0.12, "sine", 0.1);
  setTimeout(() => playTone(659, 0.12, "sine", 0.1), 100);
  setTimeout(() => playTone(784, 0.2, "sine", 0.12), 200);
}

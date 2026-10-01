// Pure Web Audio API Sound Effects (Zero asset dependencies, super lightweight)
export function playSound(type = 'click') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'click') {
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'victory') {
      // Victory Fanfare
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        const startTime = now + idx * 0.12;
        o.frequency.setValueAtTime(freq, startTime);
        g.gain.setValueAtTime(0.15, startTime);
        g.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);
        o.start(startTime);
        o.stop(startTime + 0.3);
      });
    } else if (type === 'defeat') {
      const notes = [400, 350, 300, 240];
      notes.forEach((freq, idx) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        const startTime = now + idx * 0.14;
        o.frequency.setValueAtTime(freq, startTime);
        g.gain.setValueAtTime(0.15, startTime);
        g.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);
        o.start(startTime);
        o.stop(startTime + 0.25);
      });
    } else if (type === 'alert') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(880, now + 0.1);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch {
    // AudioContext might be blocked until user gesture, ignore silently
  }
}

// audio.js: every sound is synthesized with WebAudio — no audio files.
// Engine hum, sirens, gunfire, pickups, a jingle, and a mellow chord loop.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let musicStep = 0;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type = 'sine', vol = 0.2, when = 0, slideTo = null) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function noise(dur, vol = 0.3, filterFreq = 1200) {
    if (!ctx || muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(master);
    src.start();
  }

  // A lazy four-chord loop (Am – F – C – G) with soft triangle pads.
  const CHORDS = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 261.6, 329.6], [196, 246.9, 293.7]];
  function startMusic() {
    if (!ctx || musicTimer) return;
    const playChord = () => {
      if (muted) return;
      const chord = CHORDS[musicStep % CHORDS.length];
      musicStep += 1;
      for (const f of chord) tone(f, 2.4, 'triangle', 0.045);
      tone(chord[0] / 2, 2.4, 'sine', 0.05);
    };
    playChord();
    musicTimer = window.setInterval(playChord, 2400);
  }

  return {
    unlock() {
      if (ensure()) startMusic();
    },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
    },
    isMuted() { return muted; },
    shoot() { noise(0.12, 0.35, 2500); tone(180, 0.08, 'square', 0.12, 0, 60); },
    enemyShoot() { noise(0.1, 0.18, 1800); },
    hit() { tone(120, 0.08, 'square', 0.15, 0, 70); },
    crash() { noise(0.25, 0.4, 700); tone(90, 0.2, 'sawtooth', 0.15, 0, 40); },
    pickup() { tone(660, 0.1, 'sine', 0.2); tone(990, 0.16, 'sine', 0.2, 0.09); },
    cash() { tone(880, 0.09, 'triangle', 0.2); tone(1174, 0.09, 'triangle', 0.2, 0.08); tone(1568, 0.18, 'triangle', 0.2, 0.16); },
    missionDone() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.22, i * 0.13));
    },
    wantedUp() { tone(440, 0.15, 'square', 0.12); tone(330, 0.2, 'square', 0.12, 0.14); },
    busted() { tone(392, 0.3, 'sawtooth', 0.15); tone(311, 0.4, 'sawtooth', 0.15, 0.28); },
    horn() { tone(370, 0.25, 'square', 0.12); tone(466, 0.25, 'square', 0.1); },
    door() { noise(0.08, 0.2, 900); },
    step() { noise(0.03, 0.05, 500); },
    setEngine(running, speedNorm) {
      if (!ctx) return;
      if (!running) {
        if (engineGain) engineGain.gain.value = 0;
        return;
      }
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineGain = ctx.createGain();
        engineGain.gain.value = 0;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        engineOsc.connect(filter).connect(engineGain).connect(master);
        engineOsc.start();
      }
      engineOsc.frequency.value = 55 + speedNorm * 130;
      engineGain.gain.value = muted ? 0 : 0.05 + speedNorm * 0.05;
    },
    setSiren(on) {
      if (!ctx) return;
      if (!on) {
        if (sirenGain) sirenGain.gain.value = 0;
        return;
      }
      if (!sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'sine';
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0;
        sirenOsc.connect(sirenGain).connect(master);
        sirenOsc.start();
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.9;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 220;
        lfo.connect(lfoGain).connect(sirenOsc.frequency);
        sirenOsc.frequency.value = 780;
        lfo.start();
      }
      sirenGain.gain.value = muted ? 0 : 0.045;
    },
  };
}

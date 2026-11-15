export function createAudio() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  let context = null;
  let master = null;
  let ambience = null;
  let muted = false;
  let volume = 0.68;
  let noise = null;

  function ensure() {
    if (context || !AudioContext) return;
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = muted ? 0 : volume;
    master.connect(context.destination);
    const length = context.sampleRate * 0.7;
    noise = context.createBuffer(1, length, context.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length * 0.3);
    const hum = context.createOscillator();
    const humGain = context.createGain();
    hum.type = 'sawtooth'; hum.frequency.value = 41;
    humGain.gain.value = 0.025;
    hum.connect(humGain); humGain.connect(master); hum.start();
    const hum2 = context.createOscillator();
    const hum2Gain = context.createGain();
    hum2.type = 'sine'; hum2.frequency.value = 57;
    hum2Gain.gain.value = 0.014;
    hum2.connect(hum2Gain); hum2Gain.connect(master); hum2.start();
    ambience = [humGain, hum2Gain];
  }

  function tone(freq, duration, type = 'sine', gain = 0.1, endFreq = freq) {
    if (!context) return;
    const at = context.currentTime;
    const osc = context.createOscillator();
    const env = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(18, endFreq), at + duration);
    env.gain.setValueAtTime(gain, at);
    env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(env); env.connect(master); osc.start(at); osc.stop(at + duration + 0.015);
  }

  function hiss(duration, gain, filterFreq = 3800) {
    if (!context || !noise) return;
    const at = context.currentTime;
    const src = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const env = context.createGain();
    src.buffer = noise;
    filter.type = 'lowpass'; filter.frequency.value = filterFreq;
    env.gain.setValueAtTime(gain, at); env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    src.connect(filter); filter.connect(env); env.connect(master); src.start(at); src.stop(at + duration);
  }

  function play(name, strength = 1) {
    if (!context || muted) return;
    const s = Math.max(0.25, Math.min(1.7, strength));
    if (name === 'shot') { tone(105, 0.16, 'triangle', 0.22 * s, 38); hiss(0.095, 0.16 * s, 1850); }
    else if (name === 'shot-soft') { tone(170, 0.11, 'triangle', 0.1 * s, 70); hiss(0.065, 0.07 * s, 2800); }
    else if (name === 'reload') { tone(360, 0.055, 'square', 0.045); setTimeout(() => tone(220, 0.085, 'square', 0.05), 360); setTimeout(() => tone(470, 0.06, 'triangle', 0.04), 820); }
    else if (name === 'hit') { tone(880, 0.06, 'sine', 0.07); }
    else if (name === 'kill') { tone(690, 0.08, 'triangle', 0.11); setTimeout(() => tone(920, 0.1, 'triangle', 0.08), 65); }
    else if (name === 'hurt') { tone(95, 0.24, 'sawtooth', 0.16 * s, 42); }
    else if (name === 'plant') { tone(530, 0.12, 'square', 0.08); setTimeout(() => tone(780, 0.14, 'square', 0.085), 130); }
    else if (name === 'beep') { tone(880, 0.045, 'sine', 0.035); }
    else if (name === 'round') { tone(380, 0.24, 'triangle', 0.1); setTimeout(() => tone(570, 0.34, 'triangle', 0.09), 130); }
    else if (name === 'step') { hiss(0.04, 0.032 * s, 630); }
    else if (name === 'smoke') { hiss(0.45, 0.08, 870); tone(170, 0.5, 'sine', 0.04, 85); }
    else if (name === 'ui') { tone(610, 0.055, 'sine', 0.045); }
  }

  return {
    unlock() { ensure(); if (context?.state === 'suspended') context.resume().catch(() => {}); },
    play,
    setVolume(value) {
      volume = Math.max(0, Math.min(1, value));
      if (master) master.gain.setTargetAtTime(muted ? 0 : volume, context.currentTime, 0.04);
    },
    toggle() {
      muted = !muted;
      if (master) master.gain.setTargetAtTime(muted ? 0 : volume, context.currentTime, 0.04);
      return muted;
    },
    get muted() { return muted; },
  };
}

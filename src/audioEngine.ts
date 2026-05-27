import { SoundEffects } from "./types";

// Note frequencies map
export const NOTE_FREQS: Record<string, number> = {
  "C2": 65.41, "C#2": 69.30, "D2": 73.42, "D#2": 77.78, "E2": 82.41, "F2": 87.31, "F#2": 92.50, "G2": 98.00, "G#2": 103.83, "A2": 110.00, "A#2": 116.54, "B2": 123.47,
  "C3": 130.81, "C#3": 138.59, "D3": 146.83, "D#3": 155.56, "E3": 164.81, "F3": 174.61, "F#3": 185.00, "G3": 196.00, "G#3": 207.65, "A3": 220.00, "A#3": 233.08, "B3": 246.94,
  "C4": 261.63, "C#4": 277.18, "D4": 293.66, "D#4": 311.13, "E4": 329.63, "F4": 349.23, "F#4": 369.99, "G4": 392.00, "G#4": 415.30, "A4": 440.00, "A#4": 466.16, "B4": 493.88,
  "C5": 523.25, "C#5": 554.37, "D5": 587.33, "D#5": 622.25, "E5": 659.25, "F5": 698.46, "G5": 783.99, "A5": 880.00
};

// Global singletons for active routing
let activeCtx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;
let currentSoundStyle: "worship" | "cumbia" = "worship";

export function getSoundStyle() {
  return currentSoundStyle;
}

export function setSoundStyle(style: "worship" | "cumbia") {
  currentSoundStyle = style;
}

// Reusable effects nodes linked to current context
let delayNode: DelayNode | null = null;
let delayGain: GainNode | null = null;
let lowpassFilterNode: BiquadFilterNode | null = null;
let masterGainNode: GainNode | null = null;
let compressorNode: DynamicsCompressorNode | null = null;
let reverbNode: DelayNode | null = null;
let reverbFeedbackNode: GainNode | null = null;

export function getAudioContext(): AudioContext {
  if (!activeCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    activeCtx = new AudioContextClass();
    initializeFXBus(activeCtx);
  }
  if (activeCtx.state === "suspended") {
    activeCtx.resume();
  }
  return activeCtx;
}

// Generate a white noise buffer used for snares, high hats, claps and Cumbia Guiros
function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer;
  const bufferSize = ctx.sampleRate * 2; // 2 seconds of noise
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  noiseBuffer = buffer;
  return noiseBuffer;
}

// Initialize fully routeable FX rack tailored to Worship Ambient Spaces
function initializeFXBus(ctx: AudioContext) {
  // Master Compressor to blend wet pad tails and sharp timbal clicks cleanly
  compressorNode = ctx.createDynamicsCompressor();
  compressorNode.threshold.value = -14;
  compressorNode.knee.value = 24;
  compressorNode.ratio.value = 10;
  compressorNode.attack.value = 0.005;
  compressorNode.release.value = 0.3;

  // Masters
  masterGainNode = ctx.createGain();
  masterGainNode.gain.value = 0.90;

  // Master Lowpass Filter
  lowpassFilterNode = ctx.createBiquadFilter();
  lowpassFilterNode.type = "lowpass";
  lowpassFilterNode.frequency.value = 16000;

  // Stereo Delay for worship space and cumbia delay effects on timbal
  delayNode = ctx.createDelay(2.0);
  delayGain = ctx.createGain();
  delayNode.delayTime.value = 0.38; // Worship ping pong style timing
  delayGain.gain.value = 0.22; // Wet feedback level

  // Wire Delay
  delayNode.connect(delayGain);
  delayGain.connect(delayNode); // feedback loop

  // High end Reverb unit with longer decay for that celestial cathedral worship background
  reverbNode = ctx.createDelay(1.0);
  reverbNode.delayTime.value = 0.060; // pre-delay setting
  reverbFeedbackNode = ctx.createGain();
  reverbFeedbackNode.gain.value = 0.40; // High feedback for deep worship space!
  
  reverbNode.connect(reverbFeedbackNode);
  reverbFeedbackNode.connect(reverbNode); // reverb loop

  // Wire main Bus routes:
  // Synth audio -> compressorNode -> delayNode/reverbNode -> lowpassFilterNode -> masterGainNode -> destination
  compressorNode.connect(lowpassFilterNode);
  
  // Delay routing
  compressorNode.connect(delayNode);
  delayGain.connect(lowpassFilterNode);

  // Reverb routing
  compressorNode.connect(reverbNode);
  reverbFeedbackNode.connect(lowpassFilterNode);

  lowpassFilterNode.connect(masterGainNode);
  masterGainNode.connect(ctx.destination);
}

// Dynamically update effect params from knobs
export function updateFXSettings(fx: SoundEffects) {
  if (!activeCtx) return;
  
  if (delayNode) {
    const targetDelay = Math.max(0.05, Math.min(1.5, fx.delayTime));
    delayNode.delayTime.setValueAtTime(targetDelay, activeCtx.currentTime);
  }
  if (delayGain) {
    delayGain.gain.setValueAtTime(fx.delayFeedback, activeCtx.currentTime);
  }
  if (reverbFeedbackNode) {
    // Reverberation mix control
    reverbFeedbackNode.gain.setValueAtTime(fx.reverbWet, activeCtx.currentTime);
  }
  if (lowpassFilterNode) {
    const targetFreq = Math.max(100, Math.min(20000, fx.lowpassFilter));
    lowpassFilterNode.frequency.setValueAtTime(targetFreq, activeCtx.currentTime);
  }
}

// Play note trigger system
export function playNote(
  instrument: string,
  pitch: string,
  volume: number,
  timeOffset: number = 0,
  durationSteps: number = 4,
  bpm: number = 95
) {
  const ctx = getAudioContext();
  const time = ctx.currentTime + timeOffset;
  const stepDuration = 60 / bpm / 4; // 1 step = 16th note
  const durationSeconds = stepDuration * durationSteps;

  if (instrument === "drums" || instrument === "percussion") {
    triggerCumbiaPercussion(ctx, pitch, volume, time);
    return;
  }

  const freq = NOTE_FREQS[pitch];
  if (!freq) return;

  // Cumbia mode dynamic re-mapping
  if (currentSoundStyle === "cumbia") {
    if (instrument === "piano_pad") {
      triggerTecladoVilleroSynth(ctx, freq, volume, time, durationSeconds);
    } else if (instrument === "piano_strings") {
      triggerAcordeonCumbiero(ctx, freq, volume, time, durationSeconds);
    } else if (instrument === "celestial_pad" || instrument === "pad") {
      triggerCumbiaSubBass(ctx, freq, volume, time, durationSeconds);
    } else {
      triggerTecladoVilleroSynth(ctx, freq, volume, time, durationSeconds);
    }
    return;
  }

  // Switch sound according to requested Worship / Evangelical configurations
  if (instrument === "piano_pad") {
    // Worship Piano with integrated Pad background
    triggerWorshipPianoWithPad(ctx, freq, volume, time, durationSeconds);
  } else if (instrument === "piano_strings") {
    // Worship Piano with background Soft Strings/Violin
    triggerWorshipPianoWithStrings(ctx, freq, volume, time, durationSeconds);
  } else if (instrument === "celestial_pad" || instrument === "pad") {
    // Celestial Worship Pad atmosphere
    triggerCelestialPad(ctx, freq, volume, time, durationSeconds);
  } else {
    // Default fallback piano
    triggerWorshipPianoWithPad(ctx, freq, volume, time, durationSeconds);
  }
}

// 1. Piano de Adoracion Templada con Pad de Fondo integrado (Acoustic Multi-Osc Unisom + Hammer Strike + Slow Swell Pad)
function triggerWorshipPianoWithPad(ctx: AudioContext, freq: number, volume: number, start: number, duration: number) {
  // Unison detuning structure (simulating the 3 strings per key on an acoustic piano)
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const osc3 = ctx.createOscillator();
  
  // FM high chime modulator representing the metal hammer attack
  const mod = ctx.createOscillator();
  const modGain = ctx.createGain();

  const pianoGain = ctx.createGain();
  const pianoFilter = ctx.createBiquadFilter();

  osc1.type = "triangle";
  osc1.frequency.setValueAtTime(freq, start);
  osc1.detune.setValueAtTime(-6, start); // detune down slightly

  osc2.type = "triangle";
  osc2.frequency.setValueAtTime(freq, start);
  osc2.detune.setValueAtTime(6, start); // detune up slightly

  osc3.type = "sine"; // deep warm solid center string root
  osc3.frequency.setValueAtTime(freq, start);
  osc3.detune.setValueAtTime(0, start);

  // Wooden hammer strike click transient (uses noise)
  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "highpass";
  noiseFilter.frequency.setValueAtTime(1600, start);
  const noiseGain = ctx.createGain();
  
  noiseGain.gain.setValueAtTime(volume * 0.28, start);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, start + 0.024); // 24ms hammer click decay

  // High metal harmonic bell-ping multiplier
  mod.type = "sine";
  mod.frequency.setValueAtTime(freq * 5.0, start);
  modGain.gain.setValueAtTime(volume * 220, start);
  modGain.gain.exponentialRampToValueAtTime(0.01, start + 0.055); // quick metallic chime sweep

  // Harmonic damping envelope of the strings (highs decay much faster)
  pianoFilter.type = "lowpass";
  pianoFilter.Q.setValueAtTime(1.0, start);
  pianoFilter.frequency.setValueAtTime(4500, start);
  pianoFilter.frequency.exponentialRampToValueAtTime(700, start + 0.38);

  // Piano strike volume envelope (fast attack, natural strike curve)
  pianoGain.gain.setValueAtTime(0.001, start);
  pianoGain.gain.linearRampToValueAtTime(volume * 0.52, start + 0.006);
  pianoGain.gain.exponentialRampToValueAtTime(volume * 0.09, start + 0.45); // drop to resonance body level
  pianoGain.gain.exponentialRampToValueAtTime(0.001, start + duration * 1.5); // long ringout sustain

  // Connect modulation to recreate complex hammer mechanics
  mod.connect(modGain);
  modGain.connect(osc1.frequency);
  modGain.connect(osc2.frequency);

  osc1.connect(pianoFilter);
  osc2.connect(pianoFilter);
  osc3.connect(pianoFilter);

  pianoFilter.connect(pianoGain);
  pianoGain.connect(compressorNode!);

  // Connect click noise
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(compressorNode!);

  // Start keys
  osc1.start(start);
  osc2.start(start);
  osc3.start(start);
  mod.start(start);
  noise.start(start);

  osc1.stop(start + duration * 1.6);
  osc2.stop(start + duration * 1.6);
  osc3.stop(start + duration * 1.6);
  mod.stop(start + 0.08);
  noise.stop(start + 0.03);

  // Sustain slow rising pad backdrop
  triggerSwellPad(ctx, freq, volume * 0.36, start, duration);
}

// Lush ambient backing pad sweep helper
function triggerSwellPad(ctx: AudioContext, freq: number, volume: number, start: number, duration: number) {
  const padOsc1 = ctx.createOscillator();
  const padOsc2 = ctx.createOscillator();
  const padOsc3 = ctx.createOscillator();
  const padGain = ctx.createGain();
  const padFilter = ctx.createBiquadFilter();

  padOsc1.type = "sawtooth";
  padOsc1.frequency.setValueAtTime(freq / 2.0, start); // warm lower octave bass
  padOsc1.detune.setValueAtTime(-14, start);

  padOsc2.type = "triangle";
  padOsc2.frequency.setValueAtTime(freq, start);
  padOsc2.detune.setValueAtTime(12, start);

  padOsc3.type = "sine";
  padOsc3.frequency.setValueAtTime(freq * 1.5, start); // perfect fifth overlay
  padOsc3.detune.setValueAtTime(0, start);

  // Sweeping warm filter
  padFilter.type = "lowpass";
  padFilter.Q.setValueAtTime(1.5, start);
  padFilter.frequency.setValueAtTime(120, start);
  padFilter.frequency.exponentialRampToValueAtTime(780, start + 0.85); // slow sweeps
  padFilter.frequency.exponentialRampToValueAtTime(320, start + duration);

  // Swell envelope representing divine cathedral strings
  padGain.gain.setValueAtTime(0.001, start);
  padGain.gain.linearRampToValueAtTime(volume * 0.46, start + 0.40); // slow attack swell
  padGain.gain.setValueAtTime(volume * 0.46, start + duration - 0.2);
  padGain.gain.exponentialRampToValueAtTime(0.001, start + duration + 2.0); // celestial tail fade

  padOsc1.connect(padFilter);
  padOsc2.connect(padFilter);
  padOsc3.connect(padFilter);
  padFilter.connect(padGain);
  padGain.connect(compressorNode!);

  padOsc1.start(start);
  padOsc2.start(start);
  padOsc3.start(start);

  padOsc1.stop(start + duration + 2.4);
  padOsc2.stop(start + duration + 2.4);
  padOsc3.stop(start + duration + 2.4);
}

// 2. Piano Espiritual Adoración con Strings Suaves / Violines de fondo (Real Orchestra Ensemble Mode)
function triggerWorshipPianoWithStrings(ctx: AudioContext, freq: number, volume: number, start: number, duration: number) {
  // A. Professional Strike Piano Component
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const pianoGain = ctx.createGain();
  const pianoFilter = ctx.createBiquadFilter();

  osc1.type = "triangle";
  osc1.frequency.setValueAtTime(freq, start);
  osc1.detune.setValueAtTime(-5, start);

  osc2.type = "sine";
  osc2.frequency.setValueAtTime(freq, start);
  osc2.detune.setValueAtTime(5, start);

  pianoFilter.type = "lowpass";
  pianoFilter.frequency.setValueAtTime(3200, start);
  pianoFilter.frequency.exponentialRampToValueAtTime(800, start + 0.3);

  // Strike click
  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);
  const clickFilter = ctx.createBiquadFilter();
  clickFilter.type = "highpass";
  clickFilter.frequency.setValueAtTime(1900, start);
  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(volume * 0.22, start);
  clickGain.gain.exponentialRampToValueAtTime(0.001, start + 0.02);

  pianoGain.gain.setValueAtTime(0.001, start);
  pianoGain.gain.linearRampToValueAtTime(volume * 0.50, start + 0.005);
  pianoGain.gain.exponentialRampToValueAtTime(volume * 0.07, start + 0.4);
  pianoGain.gain.exponentialRampToValueAtTime(0.001, start + duration * 1.3);

  osc1.connect(pianoFilter);
  osc2.connect(pianoFilter);
  pianoFilter.connect(pianoGain);
  pianoGain.connect(compressorNode!);

  noise.connect(clickFilter);
  clickFilter.connect(clickGain);
  clickGain.connect(compressorNode!);

  osc1.start(start);
  osc2.start(start);
  noise.start(start);

  osc1.stop(start + duration * 1.4);
  osc2.stop(start + duration * 1.4);
  noise.stop(start + 0.03);

  // B. Rich Soft Violin Ensemble Strings Backdrop
  const sOsc1 = ctx.createOscillator();
  const sOsc2 = ctx.createOscillator();
  const sOsc3 = ctx.createOscillator();
  const stringsFilter = ctx.createBiquadFilter();
  const sGain = ctx.createGain();

  // Wide detuned saw oscillators for massive full orchestra feeling
  sOsc1.type = "sawtooth";
  sOsc1.frequency.setValueAtTime(freq, start);
  sOsc1.detune.setValueAtTime(-20, start); // Lower wing chorus

  sOsc2.type = "sawtooth";
  sOsc2.frequency.setValueAtTime(freq, start);
  sOsc2.detune.setValueAtTime(20, start);  // Upper wing chorus

  sOsc3.type = "triangle";
  sOsc3.frequency.setValueAtTime(freq / 2.0, start); // Soft cello base
  sOsc3.detune.setValueAtTime(0, start);

  // Warm, gorgeous strings shelving filter removing raw buzz synthesizer qualities
  stringsFilter.type = "lowpass";
  stringsFilter.Q.setValueAtTime(2.0, start);
  stringsFilter.frequency.setValueAtTime(450, start);
  stringsFilter.frequency.linearRampToValueAtTime(1050, start + 0.60);

  // String rise/decay
  sGain.gain.setValueAtTime(0.001, start);
  sGain.gain.linearRampToValueAtTime(volume * 0.28, start + 0.45); // elegant swell
  sGain.gain.setValueAtTime(volume * 0.28, start + duration - 0.2);
  sGain.gain.exponentialRampToValueAtTime(0.001, start + duration + 1.8); // beautiful symphonic decay

  sOsc1.connect(stringsFilter);
  sOsc2.connect(stringsFilter);
  sOsc3.connect(stringsFilter);
  stringsFilter.connect(sGain);
  sGain.connect(compressorNode!);

  sOsc1.start(start);
  sOsc2.start(start);
  sOsc3.start(start);

  sOsc1.stop(start + duration + 2.2);
  sOsc2.stop(start + duration + 2.2);
  sOsc3.stop(start + duration + 2.2);
}

// 3. Pads Suaves para la Atmósfera de Ministración (Breathable Evolving Cathedral Choir Pad)
function triggerCelestialPad(ctx: AudioContext, freq: number, volume: number, start: number, duration: number) {
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const osc3 = ctx.createOscillator();
  
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  
  const filter = ctx.createBiquadFilter();
  const gainNode = ctx.createGain();

  // Multi-harmonic layout for warmth and grand space alignment
  osc1.type = "sawtooth";
  osc1.frequency.setValueAtTime(freq, start);
  osc1.detune.setValueAtTime(-18, start);

  osc2.type = "triangle";
  osc2.frequency.setValueAtTime(freq * 2.0, start); // celestial upper register
  osc2.detune.setValueAtTime(15, start);

  osc3.type = "sine";
  osc3.frequency.setValueAtTime(freq / 2.0, start); // warm dense root
  osc3.detune.setValueAtTime(0, start);

  // Evolving cutoff sweep controlled by slow-moving analog-style LFO (ambient movement)
  lfo.frequency.setValueAtTime(0.35, start); // warm breeze cycle
  lfoGain.gain.setValueAtTime(280, start); // sweeper volume
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);

  filter.type = "lowpass";
  filter.Q.setValueAtTime(2.5, start);
  filter.frequency.setValueAtTime(600, start);

  gainNode.gain.setValueAtTime(0.001, start);
  gainNode.gain.linearRampToValueAtTime(volume * 0.48, start + 0.80); // very gentle fade-in
  gainNode.gain.setValueAtTime(volume * 0.48, start + duration - 0.3);
  gainNode.gain.exponentialRampToValueAtTime(0.001, start + duration + 2.4); // majestic trailing decay reverb tail

  osc1.connect(filter);
  osc2.connect(filter);
  osc3.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(compressorNode!);

  lfo.start(start);
  osc1.start(start);
  osc2.start(start);
  osc3.start(start);

  lfo.stop(start + duration + 3.0);
  osc1.stop(start + duration + 3.0);
  osc2.stop(start + duration + 3.0);
  osc3.stop(start + duration + 3.0);
}

// A. Bombo Villero: Punchy wood acoustic click hit + realistic heavy low end decay
function triggerBombo(ctx: AudioContext, volume: number, start: number) {
  const oscBody = ctx.createOscillator();
  const oscTransient = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gainNode = ctx.createGain();

  // Solid bass punch
  oscBody.type = "sine";
  oscBody.frequency.setValueAtTime(130, start);
  oscBody.frequency.exponentialRampToValueAtTime(45, start + 0.12);

  // Solid tick attack
  oscTransient.type = "triangle";
  oscTransient.frequency.setValueAtTime(600, start);
  oscTransient.frequency.exponentialRampToValueAtTime(100, start + 0.03);

  const transientGain = ctx.createGain();
  transientGain.gain.setValueAtTime(volume * 0.70, start);
  transientGain.gain.exponentialRampToValueAtTime(0.001, start + 0.015);

  // Beater head click using highpassed noise
  const clickSrc = ctx.createBufferSource();
  clickSrc.buffer = getNoiseBuffer(ctx);
  const clickFilter = ctx.createBiquadFilter();
  clickFilter.type = "highpass";
  clickFilter.frequency.setValueAtTime(1800, start);
  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(volume * 0.35, start);
  clickGain.gain.exponentialRampToValueAtTime(0.001, start + 0.008);

  // Filter sweep on low body
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(180, start);

  gainNode.gain.setValueAtTime(volume * 0.95, start);
  gainNode.gain.exponentialRampToValueAtTime(0.001, start + 0.18);

  oscBody.connect(filter);
  oscTransient.connect(transientGain);
  
  transientGain.connect(gainNode);
  filter.connect(gainNode);
  gainNode.connect(compressorNode!);

  clickSrc.connect(clickFilter);
  clickFilter.connect(clickGain);
  clickGain.connect(compressorNode!);

  oscBody.start(start);
  oscTransient.start(start);
  clickSrc.start(start);

  oscBody.stop(start + 0.2);
  oscTransient.stop(start + 0.05);
  clickSrc.stop(start + 0.02);
}

// B. Timbales Metalicos: Mathematical Steel Drum acoustics (Fundamental + Steel resonant partial ratios)
function triggerTimbal(ctx: AudioContext, isAgudo: boolean, volume: number, start: number) {
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const osc3 = ctx.createOscillator();

  const gain1 = ctx.createGain();
  const gain2 = ctx.createGain();
  const gain3 = ctx.createGain();

  const outGain = ctx.createGain();

  const fundamental = isAgudo ? 680 : 380;
  
  // Steel cylinder partials: fundamental, high metal overtone (1.63x), brass ringing ping (2.7x)
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(fundamental * 1.25, start); // dynamic pitch slide
  osc1.frequency.exponentialRampToValueAtTime(fundamental, start + 0.04);
  
  osc2.type = "triangle";
  osc2.frequency.setValueAtTime(fundamental * 1.63, start);
  
  osc3.type = "sine";
  osc3.frequency.setValueAtTime(fundamental * 2.7, start);

  // Individual decay envelopes capturing how lighter metallic overtones damp down rapidly
  gain1.gain.setValueAtTime(volume * 0.45, start);
  gain1.gain.exponentialRampToValueAtTime(0.001, start + (isAgudo ? 0.20 : 0.28));

  gain2.gain.setValueAtTime(volume * 0.35, start);
  gain2.gain.exponentialRampToValueAtTime(0.001, start + (isAgudo ? 0.09 : 0.14));

  gain3.gain.setValueAtTime(volume * 0.25, start);
  gain3.gain.exponentialRampToValueAtTime(0.001, start + (isAgudo ? 0.05 : 0.08));

  // Natural stick wood strike on shell rim click
  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);
  const clickFilter = ctx.createBiquadFilter();
  clickFilter.type = "bandpass";
  clickFilter.frequency.setValueAtTime(2800, start);
  clickFilter.Q.setValueAtTime(3.0, start);

  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(volume * 0.55, start);
  clickGain.gain.exponentialRampToValueAtTime(0.001, start + 0.015);

  osc1.connect(gain1);
  osc2.connect(gain2);
  osc3.connect(gain3);

  gain1.connect(outGain);
  gain2.connect(outGain);
  gain3.connect(outGain);

  outGain.connect(compressorNode!);

  noise.connect(clickFilter);
  clickFilter.connect(clickGain);
  clickGain.connect(compressorNode!);

  osc1.start(start);
  osc2.start(start);
  osc3.start(start);
  noise.start(start);

  osc1.stop(start + 0.35);
  osc2.stop(start + 0.2);
  osc3.stop(start + 0.15);
  noise.stop(start + 0.03);
}

// C. Raspador Güiro: Real hand-scraper speed-varying sweeps (Dual Parallel Filter architecture)
function triggerGuiro(ctx: AudioContext, volume: number, start: number) {
  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);

  // Parallel filter network: warm resonant cylinder bandpass + high-end rasp scratcheness
  const bandFilter = ctx.createBiquadFilter();
  bandFilter.type = "bandpass";
  bandFilter.Q.setValueAtTime(4.0, start); 
  // Sweep frequency down then up to capture scrape hand acceleration
  bandFilter.frequency.setValueAtTime(1300, start);
  bandFilter.frequency.linearRampToValueAtTime(2600, start + 0.04);
  bandFilter.frequency.linearRampToValueAtTime(1700, start + 0.11);

  const highFilter = ctx.createBiquadFilter();
  highFilter.type = "highpass";
  highFilter.frequency.setValueAtTime(4200, start);

  const gainBand = ctx.createGain();
  const gainHigh = ctx.createGain();

  // Multi-pulsed drag scrape amplitude curve mimicking natural human grip
  gainBand.gain.setValueAtTime(0.001, start);
  gainBand.gain.linearRampToValueAtTime(volume * 0.38, start + 0.015);
  gainBand.gain.linearRampToValueAtTime(volume * 0.15, start + 0.05);
  gainBand.gain.linearRampToValueAtTime(volume * 0.45, start + 0.08); // friction crest
  gainBand.gain.exponentialRampToValueAtTime(0.001, start + 0.14);

  gainHigh.gain.setValueAtTime(0.001, start);
  gainHigh.gain.linearRampToValueAtTime(volume * 0.28, start + 0.018);
  gainHigh.gain.exponentialRampToValueAtTime(0.001, start + 0.12);

  noise.connect(bandFilter);
  bandFilter.connect(gainBand);
  gainBand.connect(compressorNode!);

  noise.connect(highFilter);
  highFilter.connect(gainHigh);
  gainHigh.connect(compressorNode!);

  noise.start(start);
  noise.stop(start + 0.16);
}

// D. Cencerro: Heavy bronze cowbell (Tuned non-integer partial modes + Stick strike simulation)
function triggerCencerro(ctx: AudioContext, volume: number, start: number) {
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const osc3 = ctx.createOscillator();
  
  const oscGain1 = ctx.createGain();
  const oscGain2 = ctx.createGain();
  const oscGain3 = ctx.createGain();

  const bellFilter = ctx.createBiquadFilter();
  const outGain = ctx.createGain();

  osc1.type = "square";
  osc1.frequency.setValueAtTime(560 * 1.08, start);
  osc1.frequency.exponentialRampToValueAtTime(560, start + 0.02); // quick pitch landing

  osc2.type = "square";
  osc2.frequency.setValueAtTime(845, start);

  osc3.type = "triangle"; // metallic ring wave
  osc3.frequency.setValueAtTime(1420, start);

  bellFilter.type = "bandpass";
  bellFilter.frequency.setValueAtTime(1180, start);
  bellFilter.Q.setValueAtTime(2.5, start);

  oscGain1.gain.setValueAtTime(volume * 0.45, start);
  oscGain1.gain.exponentialRampToValueAtTime(0.001, start + 0.14);

  oscGain2.gain.setValueAtTime(volume * 0.35, start);
  oscGain2.gain.exponentialRampToValueAtTime(0.001, start + 0.12);

  oscGain3.gain.setValueAtTime(volume * 0.25, start);
  oscGain3.gain.exponentialRampToValueAtTime(0.001, start + 0.08);

  // Stick crack click
  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);
  const clickFilter = ctx.createBiquadFilter();
  clickFilter.type = "highpass";
  clickFilter.frequency.setValueAtTime(2200, start);
  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(volume * 0.32, start);
  clickGain.gain.exponentialRampToValueAtTime(0.001, start + 0.012);

  osc1.connect(oscGain1);
  osc2.connect(oscGain2);
  osc3.connect(oscGain3);

  oscGain1.connect(bellFilter);
  oscGain2.connect(bellFilter);
  oscGain3.connect(bellFilter);

  bellFilter.connect(outGain);
  outGain.connect(compressorNode!);

  noise.connect(clickFilter);
  clickFilter.connect(clickGain);
  clickGain.connect(compressorNode!);

  osc1.start(start);
  osc2.start(start);
  osc3.start(start);
  noise.start(start);

  osc1.stop(start + 0.15);
  osc2.stop(start + 0.15);
  osc3.stop(start + 0.15);
  noise.stop(start + 0.03);
}

// E. Clap Moderno: Human hands physical staggered hits (3 ultra-fast closely aligned transient spikes)
function triggerClap(ctx: AudioContext, volume: number, start: number) {
  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(1400, start);
  filter.Q.setValueAtTime(1.5, start);

  const gainNode = ctx.createGain();

  // Multi-person staggered hands clapping (3 distinct skin contact spikes within 24 milliseconds)
  gainNode.gain.setValueAtTime(volume * 0.45, start);
  gainNode.gain.setValueAtTime(0.005, start + 0.011);
  gainNode.gain.setValueAtTime(volume * 0.58, start + 0.012);
  gainNode.gain.setValueAtTime(0.005, start + 0.022);
  gainNode.gain.setValueAtTime(volume * 0.65, start + 0.023);
  gainNode.gain.exponentialRampToValueAtTime(0.001, start + 0.19); // organic room ring decay

  noise.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(compressorNode!);

  noise.start(start);
  noise.stop(start + 0.22);
}

// 4. Percusiones de Cumbia Villera Argentina (Bombo, Timbales, Raspador de Güiro, Cencerros, Clap)
function triggerCumbiaPercussion(ctx: AudioContext, instrumentPitch: string, volume: number, start: number) {
  const pitch = instrumentPitch.toLowerCase();

  if (pitch === "bombo" || pitch === "kick") {
    triggerBombo(ctx, volume, start);
  } else if (pitch === "timbal_agudo" || pitch === "hihat" || pitch === "timbal_a") {
    triggerTimbal(ctx, true, volume, start);
  } else if (pitch === "timbal_grave" || pitch === "snare" || pitch === "timbal_g") {
    triggerTimbal(ctx, false, volume, start);
  } else if (pitch === "guiro" || pitch === "raspador") {
    triggerGuiro(ctx, volume, start);
  } else if (pitch === "cencerro" || pitch === "cowbell") {
    triggerCencerro(ctx, volume, start);
  } else if (pitch === "clap") {
    triggerClap(ctx, volume, start);
  }
}

// Global active sampler reference for stopping overlapping triggers or loops cleanly
const activeSampleSources: Record<string, AudioBufferSourceNode[]> = {};

export function playCustomSample(
  sampleId: string,
  buffer: AudioBuffer,
  volume: number,
  startTrim: number,
  endTrim: number,
  playbackRate: number = 1.0,
  loop: boolean = false
) {
  const ctx = getAudioContext();
  if (!buffer) return null;

  // Stop previous instances to prevent painful metallic clutter
  stopCustomSample(sampleId);

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.setValueAtTime(playbackRate, ctx.currentTime);
  source.loop = loop;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, ctx.currentTime);

  source.connect(gain);
  if (compressorNode) {
    gain.connect(compressorNode);
  } else {
    gain.connect(ctx.destination);
  }

  // Double guard start offset and duration boundaries
  const startOffset = Math.max(0, Math.min(buffer.duration - 0.01, startTrim));
  const playDuration = Math.max(0.01, Math.min(buffer.duration, endTrim) - startOffset);

  if (loop) {
    source.loopStart = startOffset;
    source.loopEnd = Math.min(buffer.duration, endTrim);
    source.start(ctx.currentTime, startOffset);
  } else {
    source.start(ctx.currentTime, startOffset, playDuration);
  }

  if (!activeSampleSources[sampleId]) {
    activeSampleSources[sampleId] = [];
  }
  activeSampleSources[sampleId].push(source);

  source.onended = () => {
    if (activeSampleSources[sampleId]) {
      activeSampleSources[sampleId] = activeSampleSources[sampleId].filter(s => s !== source);
    }
  };

  return source;
}

export function stopCustomSample(sampleId: string) {
  if (activeSampleSources[sampleId]) {
    activeSampleSources[sampleId].forEach(source => {
      try {
        source.stop();
      } catch (e) {}
    });
    activeSampleSources[sampleId] = [];
  }
}

// ==========================================
// CUMBIA VILLERA SYNTHESIZED INSTRUMENTS
// ==========================================

// 1. Teclado Sintetizador Villero / Lead de Agite (6Hz Vibrato LFO, detuned Saw+Square chorus and fast resonance decay)
export function triggerTecladoVilleroSynth(ctx: AudioContext, freq: number, volume: number, start: number, duration: number) {
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gainNode = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  // Vibrant pitch vibrato (Signature Cumbia sound)
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.setValueAtTime(6.0, start); // 6 Hz rapid vibrato
  lfoGain.gain.setValueAtTime(14, start); // pleasant detuning range
  
  lfo.connect(lfoGain);
  lfoGain.connect(osc1.frequency);
  lfoGain.connect(osc2.frequency);

  osc1.type = "sawtooth";
  osc1.frequency.setValueAtTime(freq, start);
  osc1.detune.setValueAtTime(-8, start);

  osc2.type = "square";
  osc2.frequency.setValueAtTime(freq, start);
  osc2.detune.setValueAtTime(8, start);

  // Sharp filtering decay to bounce offbeats cleanly
  filter.type = "lowpass";
  filter.Q.setValueAtTime(2.0, start);
  filter.frequency.setValueAtTime(3200, start);
  filter.frequency.exponentialRampToValueAtTime(1000, start + 0.12);

  gainNode.gain.setValueAtTime(0.001, start);
  gainNode.gain.linearRampToValueAtTime(volume * 0.44, start + 0.004);
  
  // Decays fast like real retro keyboards of 'Damas Gratis'
  const staccatoTime = Math.min(0.20, duration * 0.8);
  gainNode.gain.exponentialRampToValueAtTime(volume * 0.04, start + staccatoTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, start + duration);

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gainNode);
  
  if (compressorNode) {
    gainNode.connect(compressorNode);
  } else {
    gainNode.connect(ctx.destination);
  }

  lfo.start(start);
  osc1.start(start);
  osc2.start(start);

  lfo.stop(start + duration + 0.1);
  osc1.stop(start + duration + 0.1);
  osc2.stop(start + duration + 0.1);
}

// 2. Acordeón Villero / Órgano Cumbiero (Detuned twin reeds, nasal key click, fast clean bellows release)
export function triggerAcordeonCumbiero(ctx: AudioContext, freq: number, volume: number, start: number, duration: number) {
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const osc3 = ctx.createOscillator();
  const gainNode = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  // Accordion triple reed configuration
  osc1.type = "triangle";
  osc1.frequency.setValueAtTime(freq, start);

  osc2.type = "sawtooth";
  osc2.frequency.setValueAtTime(freq * 1.012, start); // upper wet reed beat
  
  osc3.type = "sawtooth";
  osc3.frequency.setValueAtTime(freq * 0.988, start); // lower wet reed beat

  filter.type = "bandpass";
  filter.Q.setValueAtTime(1.2, start);
  filter.frequency.setValueAtTime(1150, start);

  gainNode.gain.setValueAtTime(0.001, start);
  gainNode.gain.linearRampToValueAtTime(volume * 0.35, start + 0.015); // soft breath bellows onset
  gainNode.gain.setValueAtTime(volume * 0.35, start + duration - 0.015);
  gainNode.gain.exponentialRampToValueAtTime(0.001, start + duration + 0.03); // sharp keybed cut-off

  osc1.connect(filter);
  osc2.connect(filter);
  osc3.connect(filter);
  filter.connect(gainNode);

  if (compressorNode) {
    gainNode.connect(compressorNode);
  } else {
    gainNode.connect(ctx.destination);
  }

  osc1.start(start);
  osc2.start(start);
  osc3.start(start);

  osc1.stop(start + duration + 0.08);
  osc2.stop(start + duration + 0.08);
  osc3.stop(start + duration + 0.08);
}

// 3. Bajo Eléctrico Villero / Sub-Bass Pluck (High transient string click with warm resonant triangle depth)
export function triggerCumbiaSubBass(ctx: AudioContext, freq: number, volume: number, start: number, duration: number) {
  const oscBody = ctx.createOscillator();
  const oscPluck = ctx.createOscillator();
  const gainBody = ctx.createGain();
  const gainPluck = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  const bassFreq = freq > 130 ? freq / 2.0 : freq; // Drop an octave for standard keyboard frequencies to keep subs heavy!

  oscBody.type = "triangle";
  oscBody.frequency.setValueAtTime(bassFreq, start);

  oscPluck.type = "sawtooth"; // high frequency transient growl
  oscPluck.frequency.setValueAtTime(bassFreq, start);

  gainPluck.gain.setValueAtTime(volume * 0.35, start);
  gainPluck.gain.exponentialRampToValueAtTime(0.001, start + 0.04); // short physical growl decay

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(160, start);

  gainBody.gain.setValueAtTime(0.001, start);
  gainBody.gain.linearRampToValueAtTime(volume * 0.60, start + 0.008);
  gainBody.gain.exponentialRampToValueAtTime(volume * 0.08, start + duration * 0.8);
  gainBody.gain.exponentialRampToValueAtTime(0.001, start + duration);

  oscBody.connect(filter);
  oscPluck.connect(gainPluck);
  gainPluck.connect(filter);

  filter.connect(gainBody);
  
  if (compressorNode) {
    gainBody.connect(compressorNode);
  } else {
    gainBody.connect(ctx.destination);
  }

  oscBody.start(start);
  oscPluck.start(start);

  oscBody.stop(start + duration + 0.08);
  oscPluck.stop(start + 0.05);
}


let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
const loadedSamples: Record<string, AudioBuffer> = {};

export function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);
  }
  return audioCtx;
}

// Rutas fijas para tu percusión en la carpeta public/sounds/
const PERCUSSION_URLS: Record<string, string> = {
  "bombo": "/sounds/bombo.wav",
  "timbal_agudo": "/sounds/timbal_alto.wav",
  "timbal_grave": "/sounds/timbal_bajo.wav",
  "guiro": "/sounds/guiro.wav",
  "cencerro": "/sounds/cencerro.wav"
};

// Carga los archivos cuando el usuario interactúa por primera vez
export async function preloadSamples(instrumentFolder: string = "nord-worship") {
  const ctx = getAudioContext();
  
  // 1. Cargar batería de cumbia
  for (const [key, url] of Object.entries(PERCUSSION_URLS)) {
    try {
      const res = await fetch(url);
      const arrayBuffer = await res.arrayBuffer();
      loadedSamples[key] = await ctx.decodeAudioData(arrayBuffer);
    } catch (e) {
      console.warn(`No se encontró el audio para: ${key}`);
    }
  }

  // 2. Cargar notas reales del teclado
  const notes = [
    "C3", "C#3", "D3", "D#3", "E3", "F3", "F#3", "G3", "G#3", "A3", "A#3", "B3",
    "C4", "C#4", "D4", "D#4", "E4", "F4", "F#4", "G4", "G#4", "A4", "A#4", "B4",
    "C5"
  ];

  for (const note of notes) {
    try {
      const res = await fetch(`/sounds/${instrumentFolder}/${note}.wav`);
      const arrayBuffer = await res.arrayBuffer();
      loadedSamples[note] = await ctx.decodeAudioData(arrayBuffer);
    } catch (e) {
      // Si falta alguna nota en tu carpeta, la app no se rompe
    }
  }
}

// Disparador de percusión
export function triggerPercussion(drum: string, volume: number, startTime: number) {
  const ctx = getAudioContext();
  const buffer = loadedSamples[drum];
  if (!buffer) return;

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, startTime);

  source.connect(gain);
  gain.connect(masterGain || ctx.destination);
  source.start(startTime);
}

// Disparador del teclado nota por nota real
export function triggerNote(noteName: string, volume: number, startTime: number) {
  const ctx = getAudioContext();
  const buffer = loadedSamples[noteName];
  if (!buffer) return;

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + 2.0); // Caída suave del piano

  source.connect(gain);
  gain.connect(masterGain || ctx.destination);
  source.start(startTime);
}

export interface TrackNote {
  pitch: string;
  step: number;
  duration: number;
}

export type InstrumentType = "piano_pad" | "piano_strings" | "celestial_pad" | "percussion";

export interface DAWTrack {
  id: string;
  instrument: InstrumentType;
  name: string;
  color: string; // Tailwind color class e.g. "violet-500", "emerald-400"
  muted: boolean;
  solo: boolean;
  volume: number; // 0 to 1
  notes: TrackNote[];
}

export interface SoundEffects {
  reverbWet: number; // 0 to 1
  delayFeedback: number; // 0 to 1
  delayTime: number; // 0.1 to 1.0 (s)
  lowpassFilter: number; // 200 to 20000 Hz
  distortionValue: number; // 0 to 1
}

export interface SequencerState {
  isPlaying: boolean;
  bpm: number;
  currentStep: number;
  totalSteps: number; // default 16
  selectedTrackId: string | null;
  selectedInstrument: InstrumentType;
  activeScale: string; // standard list of notes to play on the piano roll
}

export interface CustomSample {
  id: string;
  name: string;
  audioBuffer: AudioBuffer | null;
  duration: number; // in seconds
  startTrim: number; // in seconds
  endTrim: number; // in seconds
  volume: number; // 0.0 to 1.0
  playbackRate: number; // 0.5 to 2.0
  loop: boolean;
}


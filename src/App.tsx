import React, { useState, useEffect, useRef } from "react";
import { 
  Play, 
  Square, 
  Sparkles, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Sliders, 
  Music, 
  SlidersHorizontal, 
  Code,
  Smartphone,
  Info,
  Layers,
  Check,
  Disc,
  Upload,
  Scissors,
  Trash2,
  HelpCircle,
  AudioLines,
  Shuffle,
  Edit2,
  Pencil
} from "lucide-react";
import { DAWTrack, TrackNote, InstrumentType, SoundEffects, CustomSample } from "./types";
import { getAudioContext, playNote, updateFXSettings, NOTE_FREQS, playCustomSample, stopCustomSample, setSoundStyle } from "./audioEngine";

// Notes available in the Piano Roll Sequencer (Beautiful Christian Worship chord root / melodies)
const PIANO_ROLL_NOTES = [
  "E5", "D5", "C5", "B4", "A4", "G4", "F4", "E4", "D4", "C4", "B3", "A3", "G3", "F3", "E3"
];

// Pitches available for Cumbia Villera Percussion
const DRUM_ROLL_PITCHES = ["bombo", "timbal_agudo", "timbal_grave", "guiro", "cencerro", "clap"];

const INITIAL_EFFECTS: SoundEffects = {
  reverbWet: 0.40, // Deeper ambient space for evangelical atmosphere by default
  delayFeedback: 0.25,
  delayTime: 0.38,
  lowpassFilter: 16000,
  distortionValue: 0.0,
};

// Seeding standard beautiful Worship / Cumbia combinations to give immediate inspiration
const SEEDED_TRACKS: DAWTrack[] = [
  {
    id: "track-percussion",
    instrument: "percussion",
    name: "Percu Cumbia Villera",
    color: "rose-500",
    muted: false,
    solo: false,
    volume: 0.90,
    notes: [
      { pitch: "bombo", step: 0, duration: 1 },
      { pitch: "bombo", step: 4, duration: 1 },
      { pitch: "bombo", step: 8, duration: 1 },
      { pitch: "bombo", step: 12, duration: 1 },
      { pitch: "guiro", step: 0, duration: 1 },
      { pitch: "guiro", step: 2, duration: 1 },
      { pitch: "guiro", step: 4, duration: 1 },
      { pitch: "guiro", step: 6, duration: 1 },
      { pitch: "guiro", step: 8, duration: 1 },
      { pitch: "guiro", step: 10, duration: 1 },
      { pitch: "guiro", step: 12, duration: 1 },
      { pitch: "guiro", step: 14, duration: 1 },
      { pitch: "cencerro", step: 2, duration: 1 },
      { pitch: "cencerro", step: 6, duration: 1 },
      { pitch: "cencerro", step: 10, duration: 1 },
      { pitch: "cencerro", step: 14, duration: 1 },
    ]
  },
  {
    id: "track-piano-pad",
    instrument: "piano_pad",
    name: "Piano de Templo con Pad",
    color: "amber-400",
    muted: false,
    solo: false,
    volume: 0.85,
    notes: [
      { pitch: "A3", step: 0, duration: 4 },
      { pitch: "C4", step: 0, duration: 4 },
      { pitch: "E4", step: 0, duration: 4 },
      { pitch: "F3", step: 4, duration: 4 },
      { pitch: "A3", step: 4, duration: 4 },
      { pitch: "C4", step: 4, duration: 4 },
      { pitch: "C3", step: 8, duration: 4 },
      { pitch: "G3", step: 8, duration: 4 },
      { pitch: "C4", step: 8, duration: 4 },
      { pitch: "G3", step: 12, duration: 4 },
      { pitch: "B3", step: 12, duration: 4 },
      { pitch: "D4", step: 12, duration: 4 }
    ]
  },
  {
    id: "track-piano-strings",
    instrument: "piano_strings",
    name: "Piano con Strings Suaves",
    color: "emerald-400",
    muted: false,
    solo: false,
    volume: 0.75,
    notes: [
      { pitch: "E4", step: 2, duration: 2 },
      { pitch: "A4", step: 6, duration: 2 },
      { pitch: "G4", step: 10, duration: 2 },
      { pitch: "E4", step: 14, duration: 2 }
    ]
  },
  {
    id: "track-celestial-pad",
    instrument: "celestial_pad",
    name: "Atmósfera Celestial Pad",
    color: "indigo-400",
    muted: false,
    solo: false,
    volume: 0.80,
    notes: [
      { pitch: "A2", step: 0, duration: 8 },
      { pitch: "F2", step: 8, duration: 8 }
    ]
  }
];

export default function App() {
  const [tracks, setTracks] = useState<DAWTrack[]>(() => {
    try {
      const saved = localStorage.getItem("worship_cumbia_tracks_v2");
      return saved ? JSON.parse(saved) : SEEDED_TRACKS;
    } catch {
      return SEEDED_TRACKS;
    }
  });

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [bpm, setBpm] = useState<number>(() => {
    try {
      const savedBpm = localStorage.getItem("worship_cumbia_bpm");
      return savedBpm ? parseInt(savedBpm, 10) : 85; // default slow pleasant worship tempo
    } catch {
      return 85;
    }
  });

  const [currentStep, setCurrentStep] = useState<number>(0);
  const [selectedTrackId, setSelectedTrackId] = useState<string>("track-percussion");
  const [effects, setEffects] = useState<SoundEffects>(INITIAL_EFFECTS);

  // AI Prompt generation states
  const [aiPrompt, setAiPrompt] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [aiSuccessMessage, setAiSuccessMessage] = useState<string | null>(null);
  const [aiErrorMessage, setAiErrorMessage] = useState<string | null>(null);

  // Active playing visualizers pulsed on triggers
  const [playingPaddles, setPlayingPaddles] = useState<Record<string, boolean>>({});

  // Active Tab Controls
  const [activeTab, setActiveTab] = useState<"sequencer" | "instruments" | "exporter" | "sampler">("sequencer");

  const [customSamples, setCustomSamples] = useState<CustomSample[]>(() => {
    const defaultSlots = [
      {
        id: "sample-slot-1",
        name: "Ranura 1: Grito de Cumbia Villera / Intro Vox",
        audioBuffer: null,
        duration: 0,
        startTrim: 0,
        endTrim: 0,
        volume: 0.85,
        playbackRate: 1.0,
        loop: false
      },
      {
        id: "sample-slot-2",
        name: "Ranura 2: Pad Ambiental Celestial de Fondo",
        audioBuffer: null,
        duration: 0,
        startTrim: 0,
        endTrim: 0,
        volume: 0.80,
        playbackRate: 1.0,
        loop: true
      },
      {
        id: "sample-slot-3",
        name: "Ranura 3: Efectos de Transición / Sintetizador",
        audioBuffer: null,
        duration: 0,
        startTrim: 0,
        endTrim: 0,
        volume: 0.90,
        playbackRate: 1.0,
        loop: false
      }
    ];

    try {
      const savedNamesRaw = localStorage.getItem("worship_cumbia_sample_names");
      if (savedNamesRaw) {
        const savedNames = JSON.parse(savedNamesRaw);
        return defaultSlots.map(slot => {
          if (savedNames[slot.id]) {
            return { ...slot, name: savedNames[slot.id] };
          }
          return slot;
        });
      }
    } catch (e) {
      console.error("Error reading saved sample names:", e);
    }
    return defaultSlots;
  });

  const [selectedSampleId, setSelectedSampleId] = useState<string>("sample-slot-1");
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);
  const [currentlyPlayingSamples, setCurrentlyPlayingSamples] = useState<Record<string, boolean>>({});
  const [soundStyle, setSoundStyleState] = useState<"worship" | "cumbia">(() => {
    try {
      const saved = localStorage.getItem("worship_cumbia_sound_style");
      return (saved === "cumbia" || saved === "worship") ? saved : "worship";
    } catch {
      return "worship";
    }
  });
  const [sampleError, setSampleError] = useState<string | null>(null);

  useEffect(() => {
    setSoundStyle(soundStyle);
    try {
      localStorage.setItem("worship_cumbia_sound_style", soundStyle);
    } catch {}
  }, [soundStyle]);

  // Persist sample slot titles changes in localStorage
  useEffect(() => {
    try {
      const namesMap: Record<string, string> = {};
      customSamples.forEach(s => {
        namesMap[s.id] = s.name;
      });
      localStorage.setItem("worship_cumbia_sample_names", JSON.stringify(namesMap));
    } catch (e) {
      console.error("Error saving sample names:", e);
    }
  }, [customSamples]);

  const [activeHardwareSynth, setActiveHardwareSynth] = useState<InstrumentType>("piano_pad");
  const [octaveShift, setOctaveShift] = useState<number>(3); 

  // Refs for precise Web Audio schedule alignment
  const schedulerTimerRef = useRef<number | null>(null);
  const nextStepTimeRef = useRef<number>(0);
  const stepPointerRef = useRef<number>(0);
  const tracksRef = useRef<DAWTrack[]>(tracks);
  const bpmRef = useRef<number>(bpm);

  useEffect(() => {
    tracksRef.current = tracks;
    try {
      localStorage.setItem("worship_cumbia_tracks_v2", JSON.stringify(tracks));
    } catch {}
  }, [tracks]);

  useEffect(() => {
    bpmRef.current = bpm;
    try {
      localStorage.setItem("worship_cumbia_bpm", bpm.toString());
    } catch {}
  }, [bpm]);

  useEffect(() => {
    updateFXSettings(effects);
  }, [effects]);

  const pulseTrackVisual = (id: string) => {
    setPlayingPaddles(prev => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setPlayingPaddles(prev => ({ ...prev, [id]: false }));
    }, 110);
  };

  // High Precision MIDI notes triggers
  const scheduleNoteHits = (stepIndex: number, audioTime: number) => {
    const currentBpm = bpmRef.current;
    const currentTracks = tracksRef.current;
    const hasSolo = currentTracks.some(t => t.solo);

    currentTracks.forEach(track => {
      if (track.muted) return;
      if (hasSolo && !track.solo) return;

      const noteHits = track.notes.filter(n => n.step === stepIndex);
      
      noteHits.forEach(note => {
        const timeOffset = audioTime - getAudioContext().currentTime;
        
        playNote(
          track.instrument,
          note.pitch,
          track.volume,
          Math.max(0, timeOffset),
          note.duration || 1,
          currentBpm
        );

        setTimeout(() => {
          pulseTrackVisual(track.id);
        }, Math.max(0, timeOffset * 1000));
      });
    });
  };

  const startScheduler = () => {
    const ctx = getAudioContext();
    nextStepTimeRef.current = ctx.currentTime + 0.05;
    stepPointerRef.current = currentStep;

    const schedulerTick = () => {
      const lookahead = 0.1; 
      const currentTime = ctx.currentTime;

      while (nextStepTimeRef.current < currentTime + lookahead) {
        const scheduleTime = nextStepTimeRef.current;
        const stepToPlay = stepPointerRef.current;

        scheduleNoteHits(stepToPlay, scheduleTime);

        const visualStep = stepToPlay;
        setTimeout(() => {
          setCurrentStep(visualStep);
        }, (scheduleTime - ctx.currentTime) * 1000);

        const stepDuration = 60 / bpmRef.current / 4; 
        nextStepTimeRef.current += stepDuration;
        stepPointerRef.current = (stepPointerRef.current + 1) % 16;
      }
      schedulerTimerRef.current = window.setTimeout(schedulerTick, 25);
    };
    schedulerTick();
  };

  const stopScheduler = () => {
    if (schedulerTimerRef.current !== null) {
      clearTimeout(schedulerTimerRef.current);
      schedulerTimerRef.current = null;
    }
  };

  const togglePlayback = () => {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    if (isPlaying) {
      stopScheduler();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      startScheduler();
    }
  };

  const resetPlayback = () => {
    stopScheduler();
    setIsPlaying(false);
    setCurrentStep(0);
    stepPointerRef.current = 0;
  };

  const toggleSequencerCell = (trackId: string, pitch: string, step: number) => {
    const activeTrack = tracks.find(t => t.id === trackId);
    if (activeTrack) {
      playNote(activeTrack.instrument, pitch, activeTrack.volume, 0, 1, bpm);
    }

    setTracks(prevTracks => 
      prevTracks.map(t => {
        if (t.id !== trackId) return t;

        const existsIndex = t.notes.findIndex(n => n.pitch === pitch && n.step === step);
        let updatedNotes = [...t.notes];

        if (existsIndex > -1) {
          updatedNotes.splice(existsIndex, 1);
        } else {
          updatedNotes.push({
            pitch,
            step,
            duration: (t.instrument === "celestial_pad" || t.instrument === "piano_strings" || t.instrument === "piano_pad") ? 4 : 1
          });
        }
        return { ...t, notes: updatedNotes };
      })
    );
  };

  const handleAIGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!aiPrompt.trim()) return;

    setIsGenerating(true);
    setAiSuccessMessage(null);
    setAiErrorMessage(null);

    const wasPlaying = isPlaying;
    if (isPlaying) {
      stopScheduler();
      setIsPlaying(false);
    }

    try {
      const response = await fetch("/api/generate-music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt })
      });

      if (!response.ok) {
        throw new Error("Estudio de IA en mantenimiento, usando simulación instantánea.");
      }

      const data = await response.json();
      
      if (data.result && Array.isArray(data.result.tracks)) {
        const generatedBpm = data.result.bpm || bpm;
        setBpm(generatedBpm);

        const isCumbiaFromGenre = data.result.genre && data.result.genre.toLowerCase().includes("cumbia");
        const cleanPrompt = aiPrompt.toLowerCase();
        const isCumbia = cleanPrompt.includes("cumbia") || cleanPrompt.includes("villera") || cleanPrompt.includes("ritmo") || isCumbiaFromGenre;
        setSoundStyleState(isCumbia ? "cumbia" : "worship");

        const loadedTracks = tracks.map(localTrack => {
          const foundAiTrack = data.result.tracks.find(
            (t: any) => t.instrument === localTrack.instrument
          );

          if (foundAiTrack) {
            return {
              ...localTrack,
              notes: foundAiTrack.notes.map((n: any) => ({
                pitch: n.pitch,
                step: Number(n.step),
                duration: Number(n.duration) || 1
              }))
            };
          }
          // Clear notes so that old instruments (e.g. slow worship pads) do not bleed into dynamic cumbia rhythms!
          return { ...localTrack, notes: [] };
        });

        setTracks(loadedTracks);

        // Adjust master effect registers dynamically to fit cumbia vs worship characteristics perfectly
        if (data.result.effects) {
          setEffects({
            reverbWet: Number(data.result.effects.reverbWet) ?? 0.35,
            delayFeedback: Number(data.result.effects.delayFeedback) ?? 0.20,
            delayTime: Number(data.result.effects.delayTime) ?? 0.35,
            lowpassFilter: Number(data.result.effects.lowpassFilter) ?? 16000,
            distortionValue: Number(data.result.effects.distortionValue) ?? 0.0,
          });
        } else {
          const cleanPrompt = aiPrompt.toLowerCase();
          const isCumbia = cleanPrompt.includes("cumbia") || cleanPrompt.includes("villera") || cleanPrompt.includes("ritmo") || (data.result.genre && data.result.genre.toLowerCase().includes("cumbia"));
          if (isCumbia) {
            setEffects({
              reverbWet: 0.10,
              delayFeedback: 0.12,
              delayTime: 0.22,
              lowpassFilter: 16500,
              distortionValue: 0.12,
            });
          } else {
            setEffects({
              reverbWet: 0.65,
              delayFeedback: 0.35,
              delayTime: 0.45,
              lowpassFilter: 9000,
              distortionValue: 0.0,
            });
          }
        }
        
        let msg = `¡Creado con éxito! Género: ${data.result.genre || "Worship/Cumbia"} (${generatedBpm} BPM).`;
        if (data.source === "local-preset") {
          msg = `Composición inteligente cargada: ${data.result.genre}. (${generatedBpm} BPM).`;
        }
        setAiSuccessMessage(msg);
      } else {
        throw new Error("No se pudo descifrar la respuesta musical.");
      }

    } catch (err: any) {
      console.error(err);
      setAiErrorMessage(err.message || "Error al conectar con la IA de composición.");
    } finally {
      setIsGenerating(false);
      if (wasPlaying) {
        setTimeout(() => {
          setIsPlaying(true);
          startScheduler();
        }, 300);
      }
    }
  };

  const loadPresetGenre = async (presetName: string, displayLabel: string) => {
    setIsGenerating(true);
    setAiPrompt(displayLabel);
    
    try {
      const response = await fetch("/api/generate-music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: presetName })
      });
      const data = await response.json();
      if (data.result) {
        setBpm(data.result.bpm);
        const isCumbia = presetName === "cumbia" || presetName.toLowerCase().includes("cumbia") || (data.result.genre && data.result.genre.toLowerCase().includes("cumbia"));
        setSoundStyleState(isCumbia ? "cumbia" : "worship");

        setTracks(tracks.map(localTrack => {
          const aiTrack = data.result.tracks.find((t: any) => t.instrument === localTrack.instrument);
          
          if (aiTrack) {
            return {
              ...localTrack,
              notes: aiTrack.notes.map((n: any) => ({
                pitch: n.pitch,
                step: Number(n.step),
                duration: Number(n.duration) || 1
              }))
            };
          }
          // Clear notes so other atmospheres do not overlap
          return { ...localTrack, notes: [] };
        }));

        // Adjust effects
        if (data.result.effects) {
          setEffects({
            reverbWet: Number(data.result.effects.reverbWet) ?? 0.35,
            delayFeedback: Number(data.result.effects.delayFeedback) ?? 0.20,
            delayTime: Number(data.result.effects.delayTime) ?? 0.35,
            lowpassFilter: Number(data.result.effects.lowpassFilter) ?? 16000,
            distortionValue: Number(data.result.effects.distortionValue) ?? 0.0,
          });
        } else {
          const isCumbia = presetName === "cumbia" || presetName.toLowerCase().includes("cumbia") || (data.result.genre && data.result.genre.toLowerCase().includes("cumbia"));
          if (isCumbia) {
            setEffects({
              reverbWet: 0.10,
              delayFeedback: 0.12,
              delayTime: 0.22,
              lowpassFilter: 16500,
              distortionValue: 0.12,
            });
          } else {
            setEffects({
              reverbWet: 0.65,
              delayFeedback: 0.35,
              delayTime: 0.45,
              lowpassFilter: 9000,
              distortionValue: 0.0,
            });
          }
        }

        setAiSuccessMessage(`Atmósfera cargada: ${data.result.genre}`);
      }
    } catch (e: any) {
      setAiErrorMessage(`Fallo al cargar ambiente: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleMute = (trackId: string) => {
    setTracks(tracks.map(t => t.id === trackId ? { ...t, muted: !t.muted } : t));
  };

  const toggleSolo = (trackId: string) => {
    setTracks(tracks.map(t => {
      if (t.id === trackId) {
        return { ...t, solo: !t.solo, muted: false };
      }
      return t;
    }));
  };

  const changeVolume = (trackId: string, value: number) => {
    setTracks(tracks.map(t => t.id === trackId ? { ...t, volume: value } : t));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, sampleId: string) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleAudioBufferDecode(file, sampleId);
    }
  };

  const handleAudioBufferDecode = async (file: File, sampleId: string) => {
    setSampleError(null);
    try {
      let arrayBuffer: ArrayBuffer;
      if (typeof file.arrayBuffer === "function") {
        arrayBuffer = await file.arrayBuffer();
      } else {
        arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = () => reject(reader.error);
          reader.readAsArrayBuffer(file);
        });
      }

      const ctx = getAudioContext();
      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      let decodedBuffer: AudioBuffer;
      try {
        decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
      } catch (err) {
        // Fallback for older mobile browsers / specific Web Audio implementations
        decodedBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
          ctx.decodeAudioData(arrayBuffer, resolve, reject);
        });
      }
      
      setCustomSamples(prev => prev.map(sample => {
        if (sample.id === sampleId) {
          return {
            ...sample,
            name: file.name,
            audioBuffer: decodedBuffer,
            duration: decodedBuffer.duration,
            startTrim: 0,
            endTrim: decodedBuffer.duration,
          };
        }
        return sample;
      }));
    } catch (e: any) {
      console.error("Error al decodificar audio de forma nativa:", e);
      setSampleError(
        `Error al decodificar "${file.name}": ${e.message || "Formato no compatible"}. ` +
        `Intenta con un archivo .mp3 o .wav convencional.`
      );
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, slotId: string) => {
    e.preventDefault();
    setDragActiveId(slotId);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActiveId(null);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, slotId: string) => {
    e.preventDefault();
    setDragActiveId(null);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await handleAudioBufferDecode(file, slotId);
    }
  };

  const triggerCustomSamplePlayback = async (sampleId: string) => {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    const sample = customSamples.find(s => s.id === sampleId);
    if (!sample || !sample.audioBuffer) return;

    setCurrentlyPlayingSamples(prev => ({ ...prev, [sampleId]: true }));
    
    const source = playCustomSample(
      sampleId,
      sample.audioBuffer,
      sample.volume,
      sample.startTrim,
      sample.endTrim,
      sample.playbackRate,
      sample.loop
    );

    if (source) {
      source.onended = () => {
        setCurrentlyPlayingSamples(prev => ({ ...prev, [sampleId]: false }));
      };
    }
  };

  const stopCustomSamplePlayback = (sampleId: string) => {
    stopCustomSample(sampleId);
    setCurrentlyPlayingSamples(prev => ({ ...prev, [sampleId]: false }));
  };

  const updateSampleTrim = (sampleId: string, start: number, end: number) => {
    setCustomSamples(prev => prev.map(sample => {
      if (sample.id === sampleId) {
        return {
          ...sample,
          startTrim: Math.max(0, Math.min(sample.duration - 0.01, start)),
          endTrim: Math.max(start + 0.01, Math.min(sample.duration, end))
        };
      }
      return sample;
    }));
  };

  const deleteCustomSample = (sampleId: string) => {
    stopCustomSamplePlayback(sampleId);
    setCustomSamples(prev => prev.map(sample => {
      if (sample.id === sampleId) {
        return {
          ...sample,
          name: sampleId === "sample-slot-1" ? "Ranura 1: Grito de Cumbia Villera / Intro Vox" :
                sampleId === "sample-slot-2" ? "Ranura 2: Pad Ambiental Celestial de Fondo" :
                "Ranura 3: Efectos de Transición / Sintetizador",
          audioBuffer: null,
          duration: 0,
          startTrim: 0,
          endTrim: 0,
        };
      }
      return sample;
    }));
  };

  const handleLoadTestBuffer = async (sampleId: string, testType: "riser" | "shout" | "melody") => {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    const duration = 2.5;
    const sampleRate = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    if (testType === "riser") {
      // Warm chapel riser synth trigger - Professional stereo/mono sweep with beautiful rising curve
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        const envelope = Math.sin((Math.PI * t) / (2 * duration)); // slow swell
        const freq = 110 + 330 * Math.pow(t / duration, 2); // rising expo frequency
        // Mix two oscillators (Triangle and Sine) with a touch of sub-bass for a thick heavenly swell
        const osc1 = Math.sin(2 * Math.PI * freq * t);
        const osc2 = Math.asin(Math.sin(2 * Math.PI * (freq + 1.5) * t)) * (2 / Math.PI); // triangle wave
        data[i] = (osc1 * 0.6 + osc2 * 0.4) * envelope * 0.45;
      }
    } else if (testType === "shout") {
      // Classic cumbia grit vocal shout - Swept vocal formant with retro 6.5Hz cumbia pitch vibrato
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        const vibrato = Math.sin(2 * Math.PI * 6.5 * t);
        // Frequency sweep downwards representing vocals like "¡Esa!" / "¡Guacha!"
        const baseFreq = 260 * Math.exp(-2.2 * t); 
        const freq = baseFreq + 25 * vibrato; 
        
        // Formant synthesis (combine odd harmonics for a nasal, human-sounding retro vocal)
        const harm1 = Math.sin(2 * Math.PI * freq * t);
        const harm2 = Math.sin(2 * Math.PI * freq * 3.1 * t) * 0.45;
        const harm3 = Math.sin(2 * Math.PI * freq * 5.0 * t) * 0.25;
        const rawWave = harm1 + harm2 + harm3;
        
        // Fast decay envelope mimicking a rapid shout
        const env = Math.exp(-2.8 * t) * (1 - Math.exp(-30 * t));
        data[i] = rawWave * env * 0.55;
      }
    } else {
      // Evangelical organ ambiance - lush, fat, multiple perfect drawbars organ chords
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        // Perfect rich chord major (C + E + G + high C)
        const f1 = Math.sin(2 * Math.PI * 261.63 * t); // C4
        const f2 = Math.sin(2 * Math.PI * 329.63 * t) * 0.65; // E4
        const f3 = Math.sin(2 * Math.PI * 392.00 * t) * 0.5; // G4
        const f4 = Math.sin(2 * Math.PI * 523.25 * t) * 0.35; // C5
        const drawbars = f1 + f2 + f3 + f4;
        
        // Dynamic swelling tremolo
        const tremolo = 1.0 + 0.25 * Math.sin(2 * Math.PI * 4.5 * t);
        const env = Math.sin((Math.PI * t) / duration) * tremolo;
        data[i] = drawbars * env * 0.38;
      }
    }

    setCustomSamples(prev => prev.map(sample => {
      if (sample.id === sampleId) {
        return {
          ...sample,
          name: testType === "riser" ? "Efecto Riser Catedral (Prueba).wav" : 
                testType === "shout" ? "Grito Cumbiero Sintético (Prueba).wav" : "Acorde Celestial Organ (Prueba).wav",
          audioBuffer: buffer,
          duration: duration,
          startTrim: 0,
          endTrim: duration,
        };
      }
      return sample;
    }));
  };

  const clearAllNotes = () => {
    if (confirm("¿Limpiar todo el secuenciador para componer una nueva canción cristiana o cumbia villera?")) {
      setTracks(tracks.map(t => ({ ...t, notes: [] })));
    }
  };

  const activeTrack = tracks.find(t => t.id === selectedTrackId) || tracks[0];

  const generateDartFlutterCode = (): string => {
    const serializedNotes = tracks.map(t => {
      const notesArrayStr = t.notes.map(n => 
        `  TrackNote(pitch: "${n.pitch}", step: ${n.step}, duration: ${n.duration})`
      ).join(",\n");
      return `
    DAWTrack(
      instrumentType: "${t.instrument}",
      name: "${t.name}",
      volume: ${t.volume.toFixed(2)},
      notes: [
      ${notesArrayStr ? notesArrayStr : "  // Sin notas cargadas"}
      ]
    )`;
    }).join(",\n");

    return `// -- EVANGELICAL WORSHIP & CUMBIA VILLERA FLUTTER ENGINE --
// Código Autogenerado compatible con Flutter y Android Audio Synthesizer.

import 'dart:async';
import 'package:flutter/material.dart';

class TrackNote {
  final String pitch;
  final int step;
  final int duration;

  TrackNote({
    required this.pitch, 
    required this.step, 
    required this.duration
  });
}

class DAWTrack {
  final String instrumentType;
  final String name;
  final double volume;
  final List<TrackNote> notes;

  DAWTrack({
    required this.instrumentType,
    required this.name,
    required this.volume,
    required this.notes,
  });
}

class FlutterDAWMusicPlayer {
  final int bpm = ${bpm};
  
  final List<DAWTrack> activeTracks = [
    ${serializedNotes}
  ];

  Timer? _playbackTimer;
  int _currentStep = 0;

  void playSequencer({required Function(int currentStep) onStepTick}) {
    final double stepDurationMs = (60 / bpm / 4) * 1000;
    
    _playbackTimer?.cancel();
    _playbackTimer = Timer.periodic(
      Duration(milliseconds: stepDurationMs.toInt()), 
      (timer) {
        _triggerActiveAudioNotesForStep(_currentStep);
        onStepTick(_currentStep);
        _currentStep = (_currentStep + 1) % 16;
      }
    );
  }

  void _triggerActiveAudioNotesForStep(int step) {
    for (var track in activeTracks) {
      final matchedNotes = track.notes.where((note) => note.step == step);
      for (var note in matchedNotes) {
        // Enlaza aquí tu motor MIDI/Sintetizador de Android como SoundPool u Osciladores nativos
        print("Android Audio Play: \${track.instrumentType} [Note \${note.pitch}]");
      }
    }
  }

  void stop() {
    _playbackTimer?.cancel();
    _currentStep = 0;
  }
}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-rose-500 selection:text-white" id="main-ai-daw-container">
      
      {/* Soft Ambient Background Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-25">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/40 blur-[130px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-rose-900/40 blur-[130px]" />
      </div>

      {/* Header Panel */}
      <header className="border-b border-slate-800/80 bg-slate-900/75 backdrop-blur-md sticky top-0 z-50 px-4 py-3" id="daw-header">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-rose-600 via-indigo-600 to-amber-400 p-[2px] shadow-lg flex items-center justify-center">
              <div className="h-full w-full rounded-[10px] bg-slate-950 flex items-center justify-center">
                <Music className="h-5 w-5 text-rose-400 animate-pulse" />
              </div>
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="text-xl font-black bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent tracking-tight">
                  Worship & Cumbia Studio
                </span>
                <span className="px-2 py-[1px] text-[10px] font-bold rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/20">
                  Android DAW
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">Estudio de Adoración Worship, Ministración Celestial y Cumbia Villera</p>
            </div>
          </div>

          {/* Master Transport Controls */}
          <div className="bg-slate-950/90 rounded-2xl border border-slate-800/80 p-2 flex flex-wrap items-center gap-2 md:gap-4 shadow-inner">
            
            <button
              onClick={togglePlayback}
              className={`h-11 px-6 rounded-xl flex items-center gap-2 text-sm font-bold transition-all duration-200 active:scale-95 cursor-pointer ${
                isPlaying 
                ? "bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20" 
                : "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-lg"
              }`}
              id="transport-play-btn"
            >
              {isPlaying ? (
                <>
                  <Square className="h-4 w-4 fill-current stroke-none" />
                  <span>PAUSAR</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-current stroke-none" />
                  <span>REPRODUCIR</span>
                </>
              )}
            </button>

            <button
              onClick={resetPlayback}
              className="p-3 hover:bg-slate-900 text-slate-400 hover:text-white rounded-xl transition-colors active:scale-90 cursor-pointer"
              title="Reiniciar a Paso 0"
              id="transport-stop-btn"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            <div className="h-6 w-[1px] bg-slate-800 hidden sm:block" />

            <div className="flex items-center gap-2 px-2" id="bpm-transport-control">
              <span className="text-xs font-mono font-bold text-slate-400 w-12 text-right">
                {bpm} <span className="text-[10px] text-slate-500">BPM</span>
              </span>
              <input
                type="range"
                min="60"
                max="130"
                value={bpm}
                onChange={(e) => setBpm(parseInt(e.target.value))}
                className="w-24 sm:w-32 accent-rose-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Step Indicators */}
            <div className="hidden lg:flex items-center gap-1.5 px-3 border-l border-slate-800">
              {Array.from({ length: 16 }).map((_, step) => (
                <div
                  key={step}
                  className={`h-2.5 w-2.5 rounded-full transition-all duration-100 ${
                    step === currentStep 
                    ? "bg-rose-500 ring-4 ring-rose-500/30 scale-125 shadow-md shadow-rose-500" 
                    : step % 4 === 0 
                    ? "bg-slate-700 h-2 w-2" 
                    : "bg-slate-900 h-1.5 w-1.5"
                  }`}
                />
              ))}
            </div>

          </div>

        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 flex flex-col gap-6 relative z-10">

        {/* AI Producer Dashboard */}
        <section className="bg-gradient-to-b from-slate-900 to-slate-950 rounded-3xl p-5 md:p-6 border border-slate-800/80 shadow-2xl relative overflow-hidden" id="ai-producer-desk">
          <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-indigo-500/5 blur-[80px] pointer-events-none" />
          
          <div className="flex items-center gap-2.5 mb-3">
            <Sparkles className="h-5 w-5 text-amber-400 animate-pulse" />
            <h2 className="text-base font-bold text-slate-100 uppercase tracking-widest text-[13px]">
              AI Worship & Cumbia Producer
            </h2>
            <span className="text-[10px] bg-rose-550/10 text-rose-300 border border-rose-500/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
              Gemini Enabled
            </span>
          </div>

          <p className="text-sm text-slate-300 mb-4 max-w-4xl leading-relaxed text-left">
            Diseña secuencias de adoración profunda o ritmos del barrio de forma interactiva. Describe tu atmósfera ("un momento de ministración profunda", "acordes suaves con strings y pads", o "cumbia de agite villero") y deja que la IA organice el patrón ideal de 16 pasos.
          </p>

          <form onSubmit={handleAIGenerate} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Ejemplo: 'Pads celestiales para ministración de oración profunda' o 'Cumbia villera con timbales y cencerro'..."
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="w-full bg-slate-950/90 border border-slate-800 focus:border-rose-500 rounded-2xl py-3.5 pl-4 pr-10 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-all shadow-inner text-left"
              />
              <button
                type="button"
                onClick={() => setAiPrompt("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <button
              type="submit"
              disabled={isGenerating || !aiPrompt.trim()}
              className={`py-3.5 px-6 rounded-2xl font-bold flex items-center justify-center gap-2 text-sm transition-all shadow-md cursor-pointer ${
                isGenerating || !aiPrompt.trim()
                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                : "bg-gradient-to-r from-rose-500 via-indigo-600 to-indigo-700 hover:brightness-110 text-white shadow-rose-900/10 active:scale-95"
              }`}
              id="ai-generate-button"
            >
              {isGenerating ? (
                <>
                  <Disc className="h-4 w-4 animate-spin text-rose-400" />
                  <span>GENERANDO ATMÓSFERA...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  <span>COMPONER CON IA</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Shortcuts */}
          <div className="flex flex-wrap gap-2 mt-4 items-center">
            <span className="text-xs text-slate-500 font-semibold mr-1">Atmósferas Rápidas:</span>
            <button
              onClick={() => loadPresetGenre("worship", "Pads suaves de adoración celestial para ministración de oración")}
              className="text-xs bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-300 px-3.5 py-1.5 rounded-full border border-slate-800/80 transition-colors cursor-pointer"
            >
              🙏 Altar Worship (Lento)
            </button>
            <button
              onClick={() => loadPresetGenre("cumbia", "Cumbia villera argentina clásica de agite de barrio con timbales")}
              className="text-xs bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-indigo-300 px-3.5 py-1.5 rounded-full border border-slate-800/80 transition-colors cursor-pointer"
            >
              🥁 Cumbia Villera (Rápido)
            </button>
          </div>

          {/* Messages */}
          {aiSuccessMessage && (
            <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 flex items-start gap-2 text-left">
              <span className="font-bold">✓ Éxito:</span>
              <span>{aiSuccessMessage}</span>
            </div>
          )}

          {aiErrorMessage && (
            <div className="mt-4 p-3 bg-rose-500/5 border border-rose-500/25 rounded-xl text-xs text-rose-300 flex flex-col gap-1 text-left">
              <span className="font-semibold text-rose-400">Pista o Conexión Alternativa:</span>
              <p className="text-slate-400 text-[11px]">{aiErrorMessage} Cargando composición simulada del banco de recursos integrados.</p>
            </div>
          )}
        </section>

        {/* Synthesis Engine Indicator & Switcher */}
        <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-md">
          <div className="flex items-center gap-3 text-left w-full md:w-auto">
            <div className={`p-2.5 rounded-xl transition-colors ${soundStyle === 'cumbia' ? 'bg-indigo-505/10 text-indigo-400 border border-indigo-500/20' : 'bg-rose-505/10 text-rose-400 border border-rose-500/20'}`}>
              <Sparkles className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-200">Motor de Síntesis Activo</h4>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${soundStyle === 'cumbia' ? 'bg-indigo-600/20 text-indigo-300' : 'bg-rose-600/20 text-rose-300'}`}>
                  {soundStyle === 'cumbia' ? "CUMBIA REAL-TIME" : "WORSHIP ATMOSPHERE"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {soundStyle === "worship" 
                  ? "Tonos celestiales de adoración: pianos densos combinados con pads de ministración lenta y strings fluidos."
                  : "Música de barrio: sintetizadores de agite agudo (vibrato 6Hz), acordeón detuned real y bajos potentes de cumbia villera."
                }
              </p>
            </div>
          </div>
          
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-900 w-full md:w-auto justify-end self-stretch md:self-auto">
            <button
              onClick={() => setSoundStyleState("worship")}
              className={`flex-1 md:flex-none px-4.5 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                soundStyle === "worship"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/45"
              }`}
            >
              <span>🕊️ Adoración Altar</span>
            </button>
            <button
              onClick={() => setSoundStyleState("cumbia")}
              className={`flex-1 md:flex-none px-4.5 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                soundStyle === "cumbia"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/45"
              }`}
            >
              <span>🎹 Cumbia Villera</span>
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center justify-between border-b border-slate-800/60 pb-1" id="studio-tabs">
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-900">
            <button
              onClick={() => setActiveTab("sequencer")}
              className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all cursor-pointer ${
                activeTab === "sequencer" 
                ? "bg-slate-900 text-white" 
                : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5" />
                <span>Secuenciador de Canales</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab("instruments")}
              className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all cursor-pointer ${
                activeTab === "instruments" 
                ? "bg-slate-900 text-white" 
                : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Disc className="h-3.5 w-3.5 text-rose-400 animate-spin-slow" />
                <span>Instrumentos Grabador En Vivo</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab("sampler")}
              className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all cursor-pointer ${
                activeTab === "sampler" 
                ? "bg-slate-900 text-white animate-pulse" 
                : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <AudioLines className="h-3.5 w-3.5 text-indigo-400" />
                <span>Sámpler y Edición MP3</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab("exporter")}
              className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all cursor-pointer ${
                activeTab === "exporter" 
                ? "bg-slate-900 text-white" 
                : "text-slate-400 hover:text-slate-200"
              }`}
              id="dart-exporter-tab"
            >
              <div className="flex items-center gap-1.5">
                <Code className="h-3.5 w-3.5 text-amber-400" />
                <span>Exportar Android (Dart)</span>
              </div>
            </button>
          </div>

          <button
            onClick={clearAllNotes}
            className="text-xs text-slate-500 hover:text-rose-400 px-3 py-2 transition-colors flex items-center gap-1 font-semibold cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reiniciar DAW</span>
          </button>
        </div>

        {/* Tab 1: Pattern Matrix & Sequencer Roll */}
        {activeTab === "sequencer" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2" id="sequencer-workspace">
            
            {/* Mixer & Effects */}
            <div className="lg:col-span-4 flex flex-col gap-4 bg-slate-900/40 p-5 rounded-3xl border border-slate-800/60">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Mezcla General</h3>
                <span className="text-[10px] bg-indigo-900/30 text-indigo-300 border border-indigo-900/50 px-2.5 py-1 rounded-md font-mono font-bold">4 Pistas</span>
              </div>

              <div className="flex flex-col gap-3">
                {tracks.map(track => {
                  const isSelected = selectedTrackId === track.id;
                  const isPulsed = playingPaddles[track.id];

                  return (
                    <div
                      key={track.id}
                      onClick={() => setSelectedTrackId(track.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative text-left ${
                        isSelected 
                        ? "bg-slate-900/90 border-slate-705 shadow-md ring-1 ring-slate-850" 
                        : "bg-slate-950/40 border-slate-900/50 hover:bg-slate-900/20"
                      }`}
                    >
                      {/* Active level bar */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl ${
                        isPulsed ? "bg-rose-400" : `bg-${track.color}`
                      }`} />

                      <div className="flex items-center justify-between mb-2 pl-1.5">
                        <div className="flex items-center gap-2">
                          <div className={`h-2.5 w-2.5 rounded-full ${
                            isPulsed ? "bg-rose-400" : `bg-${track.color}`
                          }`} />
                          <div>
                            <h4 className="text-xs font-bold text-slate-100">{track.name}</h4>
                            <span className="text-[9px] uppercase font-mono text-slate-400">{track.instrument}</span>
                          </div>
                        </div>

                        {/* Mute/Solo */}
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => toggleMute(track.id)}
                            className={`px-1.5 py-1 rounded text-[9px] font-bold ${
                              track.muted ? "bg-rose-900/40 text-rose-400" : "bg-slate-800 text-slate-400"
                            } cursor-pointer`}
                          >
                            Mute
                          </button>
                          <button
                            onClick={() => toggleSolo(track.id)}
                            className={`px-1.5 py-1 rounded text-[9px] font-bold ${
                              track.solo ? "bg-amber-400/20 text-amber-300" : "bg-slate-800 text-slate-400"
                            } cursor-pointer`}
                          >
                            Solo
                          </button>
                        </div>
                      </div>

                      {/* Vol */}
                      <div className="flex items-center gap-2 px-1.5" onClick={(e) => e.stopPropagation()}>
                        <Volume2 className="h-3 w-3 text-slate-500" />
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={track.volume}
                          onChange={(e) => changeVolume(track.id, parseFloat(e.target.value))}
                          className="flex-1 accent-indigo-500 h-1 bg-slate-800 rounded cursor-pointer"
                        />
                        <span className="text-[10px] text-slate-400 font-mono w-5">
                          {Math.round(track.volume * 100)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Master Effects Rack */}
              <div className="mt-2 pt-4 border-t border-slate-850">
                <div className="flex items-center gap-2 mb-3">
                  <SlidersHorizontal className="h-4 w-4 text-indigo-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Soporte FX Rack
                  </h3>
                </div>

                <div className="flex flex-col gap-3 text-xs text-left">
                  {/* Reverb */}
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between font-medium text-slate-400">
                      <span>Cathedral Reverb (Atmósfera Worship)</span>
                      <span className="font-mono text-indigo-400">{Math.round(effects.reverbWet * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="0.95"
                      step="0.05"
                      value={effects.reverbWet}
                      onChange={(e) => setEffects(prev => ({ ...prev, reverbWet: parseFloat(e.target.value) }))}
                      className="accent-indigo-400 h-1 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Delay */}
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between font-medium text-slate-400">
                      <span>Delay Ping-Pong</span>
                      <span className="font-mono text-indigo-400">{effects.delayTime.toFixed(2)}s</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1.2"
                      step="0.05"
                      value={effects.delayTime}
                      onChange={(e) => setEffects(prev => ({ ...prev, delayTime: parseFloat(e.target.value) }))}
                      className="accent-indigo-400 h-1 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Filter */}
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between font-medium text-slate-400">
                      <span>Lowpass Filter Sweep</span>
                      <span className="font-mono text-indigo-400">{effects.lowpassFilter} Hz</span>
                    </div>
                    <input
                      type="range"
                      min="400"
                      max="18000"
                      step="200"
                      value={effects.lowpassFilter}
                      onChange={(e) => setEffects(prev => ({ ...prev, lowpassFilter: parseInt(e.target.value) }))}
                      className="accent-rose-550 h-1 bg-slate-800 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Matrix Sequencer */}
            <div className="lg:col-span-8 flex flex-col gap-4 bg-slate-900/40 p-5 rounded-3xl border border-slate-800/60">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/60 pb-3">
                <div className="text-left">
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <span className={`h-3 w-3 rounded-full bg-${activeTrack.color} inline-block`} />
                    Edición de Canal: {activeTrack.name}
                  </h3>
                  <p className="text-xs text-slate-400">Programa ritmos o acordes celestiales. Cada columna es un tiempo de 1/16.</p>
                </div>

                <div className="p-1 px-3 bg-slate-950 text-[11px] rounded-lg border border-slate-900 text-slate-400 font-bold uppercase tracking-wider">
                  Medida: 16 Pasos
                </div>
              </div>

              {/* Grid Scroll Area */}
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60 scrollbar-thin">
                <div className="min-w-[600px] p-4 flex flex-col gap-1 select-none">
                  
                  {/* Step headers */}
                  <div className="flex items-center gap-1 mb-2 text-slate-600 font-mono text-[10px]">
                    <div className="w-24 text-right pr-3 font-semibold text-slate-500">PASO:</div>
                    {Array.from({ length: 16 }).map((_, step) => (
                      <div 
                        key={step} 
                        className={`flex-1 text-center py-1 rounded transition-all ${
                          step === currentStep 
                          ? "bg-rose-550/20 text-rose-300 font-bold" 
                          : step % 4 === 0 
                          ? "text-slate-300 bg-slate-900/50" 
                          : ""
                        }`}
                      >
                        {step + 1}
                      </div>
                    ))}
                  </div>

                  {/* Drums Matrix rendering */}
                  {activeTrack.instrument === "percussion" ? (
                    DRUM_ROLL_PITCHES.map(drumPitch => (
                      <div key={drumPitch} className="flex items-center gap-1 h-10">
                        <div className="w-24 text-right pr-3 text-xs font-bold text-slate-200 capitalize truncate select-none">
                          {drumPitch === "bombo" ? "🥁 Bombo" :
                           drumPitch === "timbal_agudo" ? "🔔 Timbal A" :
                           drumPitch === "timbal_grave" ? "🥁 Timbal G" :
                           drumPitch === "guiro" ? "🥢 Güiro" :
                           drumPitch === "cencerro" ? "🛎 Cencerro" : "👏 Clap"}
                        </div>
                        {Array.from({ length: 16 }).map((_, step) => {
                          const isNoteOn = activeTrack.notes.some(n => n.pitch === drumPitch && n.step === step);
                          const isCurrentStep = step === currentStep;
                          const isQuarter = step % 4 === 0;

                          return (
                            <div
                              key={step}
                              onClick={() => toggleSequencerCell(activeTrack.id, drumPitch, step)}
                              className={`flex-1 h-full rounded transition-all duration-700 cursor-pointer border relative flex items-center justify-center ${
                                isNoteOn 
                                ? "bg-gradient-to-tr from-rose-500 to-rose-600 border-rose-400 shadow shadow-rose-500/20 scale-[0.97]" 
                                : isQuarter 
                                ? "bg-slate-900 border-slate-850 hover:bg-slate-800" 
                                : "bg-slate-950 border-slate-900/60 hover:bg-slate-900"
                              }`}
                            >
                              {isCurrentStep && (
                                <div className="absolute inset-x-0 bottom-0 h-1 bg-white animate-pulse" />
                              )}
                              {isNoteOn && <div className="h-1.5 w-1.5 rounded-full bg-white scale-125" />}
                            </div>
                          );
                        })}
                      </div>
                    ))
                  ) : (
                    /* Melodic Synth notes rendering */
                    PIANO_ROLL_NOTES.map(pianoPitch => (
                      <div key={pianoPitch} className="flex items-center gap-1 h-8">
                        <div className={`w-24 text-right pr-3 text-[10px] font-mono font-bold truncate select-none ${
                          pianoPitch.includes("#") ? "text-slate-400" : "text-slate-200"
                        }`}>
                          {pianoPitch}
                        </div>
                        {Array.from({ length: 16 }).map((_, step) => {
                          const isNoteOn = activeTrack.notes.some(n => n.pitch === pianoPitch && n.step === step);
                          const isCurrentStep = step === currentStep;
                          const isQuarter = step % 4 === 0;

                          return (
                            <div
                              key={step}
                              onClick={() => toggleSequencerCell(activeTrack.id, pianoPitch, step)}
                              className={`flex-1 h-full rounded-sm transition-all duration-700 cursor-pointer border relative flex items-center justify-center ${
                                isNoteOn 
                                ? "bg-indigo-600 border-indigo-405 shadow shadow-indigo-500/20 scale-[0.97]" 
                                : isQuarter 
                                ? "bg-slate-900 border-slate-850 hover:bg-slate-850" 
                                : "bg-slate-950 border-slate-90/40 hover:bg-slate-900"
                              }`}
                            >
                              {isCurrentStep && (
                                <div className="absolute inset-x-0 bottom-0 h-1 bg-white" />
                              )}
                              {isNoteOn && <div className="h-1 w-1 rounded-full bg-white" />}
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}

                  {/* Playhead indicators footer row */}
                  <div className="flex items-center gap-1 mt-2">
                    <div className="w-24" />
                    {Array.from({ length: 16 }).map((_, step) => (
                      <div 
                        key={step} 
                        className={`flex-1 h-1.5 rounded-full transition-all ${
                          step === currentStep 
                          ? "bg-rose-500 scale-110" 
                          : "bg-slate-900"
                        }`} 
                      />
                    ))}
                  </div>

                </div>
              </div>

              {/* Instructions Banner */}
              <div className="flex items-start gap-2.5 bg-slate-900/30 p-3.5 rounded-2xl border border-slate-800/50 text-left">
                <Info className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-400 leading-normal">
                  <span className="font-bold text-slate-200 block mb-0.5">Atmósfera de Oración y Ritmos:</span>
                  Programa tus acordes favoritos en los canales de <strong className="text-slate-300">Worship Piano</strong> y dales un toque cristiano. En la sección secundaria de percusión, activa el bombo y timbales para crear un ritmo de cumbia villera de inmediato.
                </div>
              </div>

            </div>

          </div>
        )}

        {/* Tab 2: Live Playable Hardware Instruments */}
        {activeTab === "instruments" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2" id="live-instruments-rack">
            
            {/* Live MPC Drumboard */}
            <div className="lg:col-span-6 bg-slate-900/40 p-5 md:p-6 rounded-3xl border border-slate-800/60 flex flex-col gap-4 text-left">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-1">Pads de Percusión Cumbiera</h3>
                <p className="text-xs text-slate-500 mb-4 font-medium">Pulsa los botones interactivos abajo para tirar samples y efectos del timbal y ritmos de cumbia villera en vivo.</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 flex-1">
                {DRUM_ROLL_PITCHES.map((drum, index) => {
                  const colors = [
                    "from-rose-500 to-rose-700 border-rose-400 focus:ring-rose-450",
                    "from-amber-400 to-amber-600 border-amber-300 focus:ring-amber-350",
                    "from-emerald-500 to-emerald-700 border-emerald-400 focus:ring-emerald-450",
                    "from-indigo-550 to-indigo-700 border-indigo-405 focus:ring-indigo-450",
                    "from-cyan-500 to-cyan-700 border-cyan-400 focus:ring-cyan-450",
                    "from-purple-550 to-purple-700 border-purple-400 focus:ring-purple-450",
                  ];
                  return (
                    <button
                      key={drum}
                      onMouseDown={() => playNote("percussion", drum, 1.0, 0, 1, bpm)}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        playNote("percussion", drum, 1.0, 0, 1, bpm);
                      }}
                      className={`h-24 rounded-2xl border-2 bg-gradient-to-br ${colors[index % colors.length]} flex flex-col items-center justify-between p-3.5 cursor-pointer active:scale-95 transition-all text-slate-950 font-black shadow-lg hover:brightness-110`}
                      id={`mpc-pad-${drum}`}
                    >
                      <div className="w-full flex justify-between items-center opacity-60">
                        <span className="text-[8px] uppercase tracking-wider font-extrabold">CUMBIA PAD</span>
                        <Disc className="h-3.5 w-3.5 text-slate-950" />
                      </div>
                      <span className="text-sm tracking-wider uppercase font-black">
                        {drum === "bombo" ? "🥁 BOMBO" :
                         drum === "timbal_agudo" ? "🔔 TIMBAL A" :
                         drum === "timbal_grave" ? "🥁 TIMBAL G" :
                         drum === "guiro" ? "🥢 GÜIRO" :
                         drum === "cencerro" ? "🛎 CENCERRO" : "👏 CLAP"}
                      </span>
                      <span className="text-[9px] opacity-75 font-mono">LIVE HD</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Interactive Hardware Keyboard Synth */}
            <div className="lg:col-span-6 bg-slate-900/40 p-5 md:p-6 rounded-3xl border border-slate-800/60 flex flex-col justify-between gap-4 text-left">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Teclado de Oración y Ministración</h3>
                  
                  {/* Octave change */}
                  <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-xs text-slate-400 font-bold">
                    <span>Octava:</span>
                    <button 
                      onClick={() => setOctaveShift(Math.max(2, octaveShift - 1))}
                      className="text-slate-200 hover:text-white px-1.5 bg-slate-900 rounded cursor-pointer"
                    >
                      -
                    </button>
                    <span className="text-white font-mono">{octaveShift}</span>
                    <button 
                      onClick={() => setOctaveShift(Math.min(5, octaveShift + 1))}
                      className="text-slate-200 hover:text-white px-1.5 bg-slate-900 rounded cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mb-4">Toca acordes celestiales o solos en tiempo real. Configura el sonido que gustes a continuación.</p>
              </div>

              {/* Instrument selection tags */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { id: "piano_pad", label: "🎹 Piano + Pad", color: "border-amber-400/40 text-amber-300" },
                  { id: "piano_strings", label: "🎻 Piano + Strings", color: "border-emerald-400/40 text-emerald-300" },
                  { id: "celestial_pad", label: "🌌 Celestial Pad", color: "border-indigo-400/40 text-indigo-300" }
                ].map(inst => (
                  <button
                    key={inst.id}
                    onClick={() => setActiveHardwareSynth(inst.id as InstrumentType)}
                    className={`p-3 rounded-xl border text-xs font-bold text-center transition-colors cursor-pointer ${
                      activeHardwareSynth === inst.id 
                      ? "bg-slate-900 text-white border-rose-500" 
                      : "bg-slate-950 hover:bg-slate-900/40 text-slate-400 border-slate-850"
                    }`}
                  >
                    {inst.label}
                  </button>
                ))}
              </div>

              {/* Piano keybed */}
              <div className="flex relative h-48 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl p-1 select-none">
                {["C", "D", "E", "F", "G", "A", "B", "C2"].map((keyChar, idx) => {
                  let visualLabel = keyChar === "C2" ? `C${octaveShift+1}` : `${keyChar}${octaveShift}`;
                  let targetPitch = visualLabel;
                  
                  return (
                    <button
                      key={keyChar + idx}
                      onMouseDown={() => playNote(activeHardwareSynth, targetPitch, 0.95, 0, 2.0, bpm)}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        playNote(activeHardwareSynth, targetPitch, 0.95, 0, 2.0, bpm);
                      }}
                      className="flex-1 bg-white hover:bg-slate-100 active:bg-slate-300 rounded-sm mr-1 last:mr-0 flex flex-col justify-end items-center pb-3 text-slate-950 font-black text-[11px] font-mono shadow-inner transition-colors duration-75 relative"
                      style={{ zIndex: 1 }}
                    >
                      <span>{visualLabel}</span>
                    </button>
                  );
                })}

                {/* Black notes */}
                <button
                  onMouseDown={() => playNote(activeHardwareSynth, `C#${octaveShift}`, 0.9, 0, 2.0, bpm)}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    playNote(activeHardwareSynth, `C#${octaveShift}`, 0.9, 0, 2.0, bpm);
                  }}
                  className="absolute bg-slate-950 hover:bg-slate-900 active:bg-slate-800 w-8 h-28 rounded-b-md flex flex-col justify-end items-center pb-2 text-white font-mono text-[9px] font-bold shadow-md transform -translate-x-1/2 cursor-pointer"
                  style={{ left: "13.5%", zIndex: 10 }}
                >
                  C#
                </button>

                <button
                  onMouseDown={() => playNote(activeHardwareSynth, `D#${octaveShift}`, 0.9, 0, 2.0, bpm)}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    playNote(activeHardwareSynth, `D#${octaveShift}`, 0.9, 0, 2.0, bpm);
                  }}
                  className="absolute bg-slate-950 hover:bg-slate-900 active:bg-slate-800 w-8 h-28 rounded-b-md flex flex-col justify-end items-center pb-2 text-white font-mono text-[9px] font-bold shadow-md transform -translate-x-1/2 cursor-pointer"
                  style={{ left: "26.5%", zIndex: 10 }}
                >
                  D#
                </button>

                <button
                  onMouseDown={() => playNote(activeHardwareSynth, `F#${octaveShift}`, 0.9, 0, 2.0, bpm)}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    playNote(activeHardwareSynth, `F#${octaveShift}`, 0.9, 0, 2.0, bpm);
                  }}
                  className="absolute bg-slate-950 hover:bg-slate-900 active:bg-slate-800 w-8 h-28 rounded-b-md flex flex-col justify-end items-center pb-2 text-white font-mono text-[9px] font-bold shadow-md transform -translate-x-1/2 cursor-pointer"
                  style={{ left: "51.5%", zIndex: 10 }}
                >
                  F#
                </button>

                <button
                  onMouseDown={() => playNote(activeHardwareSynth, `G#${octaveShift}`, 0.9, 0, 2.0, bpm)}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    playNote(activeHardwareSynth, `G#${octaveShift}`, 0.9, 0, 2.0, bpm);
                  }}
                  className="absolute bg-slate-950 hover:bg-slate-900 active:bg-slate-800 w-8 h-28 rounded-b-md flex flex-col justify-end items-center pb-2 text-white font-mono text-[9px] font-bold shadow-md transform -translate-x-1/2 cursor-pointer"
                  style={{ left: "64.5%", zIndex: 10 }}
                >
                  G#
                </button>

                <button
                  onMouseDown={() => playNote(activeHardwareSynth, `A#${octaveShift}`, 0.9, 0, 2.0, bpm)}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    playNote(activeHardwareSynth, `A#${octaveShift}`, 0.9, 0, 2.0, bpm);
                  }}
                  className="absolute bg-slate-950 hover:bg-slate-900 active:bg-slate-800 w-8 h-28 rounded-b-md flex flex-col justify-end items-center pb-2 text-white font-mono text-[9px] font-bold shadow-md transform -translate-x-1/2 cursor-pointer"
                  style={{ left: "77.5%", zIndex: 10 }}
                >
                  A#
                </button>
              </div>

            </div>

          </div>
        )}

        {/* Tab 3: Flutter Android Exporter */}
        {activeTab === "exporter" && (
          <div className="bg-slate-900/40 p-5 md:p-6 rounded-3xl border border-slate-800/60 flex flex-col gap-5 text-left" id="exporter-view-panel">
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-black text-slate-100 flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-amber-400 animate-bounce" />
                  <span>Sincronización con main.dart Android</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Copia esta estructura de arreglos nativa para importarla en tu aplicación de Android. Los pasos son compatibles con el motor nativo MIDI.
                </p>
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(generateDartFlutterCode());
                  alert("¡Código de exportación de batería y adoración para Flutter copiado con éxito!");
                }}
                className="py-2.5 px-5 bg-rose-550 hover:bg-rose-600 font-bold text-white rounded-xl text-xs transition-all shadow-md cursor-pointer"
              >
                Copiar Archivo Dart
              </button>
            </div>

            <div className="relative rounded-2xl border border-slate-800/90 overflow-hidden bg-slate-950">
              <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-slate-500 text-[10px] font-mono">
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-505" />
                  <span className="ml-2">music_composition_service.dart</span>
                </span>
                <span>Dart 3.0 compatible</span>
              </div>

              <pre className="p-4 overflow-x-auto text-[11px] font-mono text-amber-200/90 select-all leading-normal max-h-[380px] text-left">
                {generateDartFlutterCode()}
              </pre>
            </div>

            {/* Simulated instructions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-900">
                <span className="font-bold text-slate-300 block mb-1">1. Integra en main.dart</span>
                <p className="text-[11px] text-slate-500">Pega esta estructura de notas y usa un timer en Flutter para recorrer los pasos.</p>
              </div>
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-900">
                <span className="font-bold text-slate-300 block mb-1">2. Dispara Frecuencias</span>
                <p className="text-[11px] text-slate-500">Mapea cada nota como C3 o A4 al sintetizador de Flutter para sonido real.</p>
              </div>
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-900">
                <span className="font-bold text-slate-300 block mb-1">3. Cumbia y Ministración</span>
                <p className="text-[11px] text-slate-500">Todo lo que programes con la IA o por cuadrícula se actualiza aquí al instante.</p>
              </div>
            </div>

          </div>
        )}

        {/* Tab 4: Sampler y Edición de Audios MP3 */}
        {activeTab === "sampler" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2 select-none" id="custom-samples-workshop">
            
            {sampleError && (
              <div className="lg:col-span-12 p-4 bg-rose-500/15 border border-rose-500/25 rounded-2xl text-xs text-rose-300 flex flex-col gap-1 text-left relative shadow-inner">
                <button 
                  onClick={() => setSampleError(null)}
                  className="absolute right-3.5 top-3.5 text-rose-400 hover:text-white font-bold text-sm cursor-pointer"
                >
                  ✕
                </button>
                <div className="flex items-center gap-1.5 font-bold text-rose-450 uppercase tracking-wide">
                  <span>⚠️ No se pudo procesar el archivo de audio</span>
                </div>
                <p className="text-[11px] text-slate-300 mt-1 max-w-4xl">{sampleError}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] bg-rose-950/40 border border-rose-500/10 text-rose-300 rounded px-2 py-0.5 font-semibold">Consejo técnico:</span>
                  <span className="text-[10px] text-slate-400">Verifica que el archivo no contenga derechos DRM y se encuentre en estéreo de 44.1kHz / 48kHz estándar.</span>
                </div>
              </div>
            )}

            {/* Left side: Sample list & Slots */}
            <div className="lg:col-span-5 bg-slate-900/40 p-5 md:p-6 rounded-3xl border border-slate-800/60 flex flex-col gap-4 text-left">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-1">Tus Ranuras de Muestras (Pistas y Sonidos)</h3>
                <p className="text-xs text-slate-500 mb-4 font-medium">Carga audios en formato MP3 o WAV desde tu dispositivo. Los audios se procesan en la memoria local y pasan por el rack de efectos generales.</p>
              </div>

              <div className="flex flex-col gap-3.5">
                {customSamples.map((sample) => {
                  const isSelected = selectedSampleId === sample.id;
                  const hasBuffer = sample.audioBuffer !== null;
                  const isPlayingSample = currentlyPlayingSamples[sample.id];

                  return (
                    <div
                      key={sample.id}
                      onClick={() => setSelectedSampleId(sample.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col gap-2 ${
                        isSelected 
                        ? "bg-slate-900/90 border-indigo-500/50 shadow-lg ring-1 ring-indigo-500/20" 
                        : "bg-slate-950/40 border-slate-900/40 hover:bg-slate-900/25"
                      }`}
                    >
                      {/* Left color bar */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl ${
                        hasBuffer ? "bg-indigo-500" : "bg-slate-800"
                      }`} />

                      <div className="flex items-center justify-between pl-1">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <AudioLines className={`h-4 w-4 shrink-0 ${hasBuffer ? "text-indigo-400 animate-pulse" : "text-slate-600"}`} />
                          <div className="truncate min-w-0">
                            <h4 className="text-xs font-bold text-slate-200 truncate pr-2">{sample.name}</h4>
                            <span className="text-[10px] font-mono text-slate-500 block mt-0.5">
                              {hasBuffer 
                                ? `Duración: ${sample.duration.toFixed(2)}s | ${sample.loop ? "Loop activo" : "Un disparo"}`
                                : "Vacío (esperando archivo)"
                              }
                            </span>
                          </div>
                        </div>

                        {/* Action buttons (Rename & Delete) */}
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSampleId(sample.id);
                              const newName = prompt("Introduce el nuevo nombre para esta ranura:", sample.name);
                              if (newName !== null && newName.trim() !== "") {
                                setCustomSamples(prev => prev.map(s => s.id === sample.id ? { ...s, name: newName.trim() } : s));
                              }
                            }}
                            className="p-1.5 hover:bg-slate-950 text-slate-500 hover:text-indigo-400 rounded-lg transition-colors cursor-pointer"
                            title="Renombrar Ranura"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>

                          {hasBuffer && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteCustomSample(sample.id);
                              }}
                              className="p-1.5 hover:bg-slate-950 text-slate-500 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                              title="Vaciar Ranura"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Micro actions if loaded */}
                      {hasBuffer ? (
                        <div className="flex items-center justify-between gap-2 mt-2 bg-slate-950/45 p-2 rounded-xl border border-slate-900 pl-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Sámpler:</span>
                            {isPlayingSample ? (
                              <button
                                onClick={() => stopCustomSamplePlayback(sample.id)}
                                className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white font-bold text-[10px] rounded-lg transition-all cursor-pointer"
                              >
                                PARAR
                              </button>
                            ) : (
                              <button
                                onClick={() => triggerCustomSamplePlayback(sample.id)}
                                className="px-3 py-1 bg-indigo-550 hover:bg-indigo-650 text-white font-bold text-[10px] rounded-lg transition-all cursor-pointer"
                              >
                                DISPARAR
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                            <span>Vol: {Math.round(sample.volume * 100)}%</span>
                            <span>Rate: {sample.playbackRate.toFixed(1)}x</span>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 flex flex-col gap-2" onClick={e => e.stopPropagation()}>
                          {/* Main Upload Button inside the card for seamless desktop/mobile support */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedSampleId(sample.id);
                                document.getElementById(`direct-upload-input-${sample.id}`)?.click();
                              }}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/20 text-indigo-300 hover:text-white text-[10px] font-extrabold uppercase rounded-lg transition-all cursor-pointer font-mono"
                            >
                              <Upload className="h-3 w-3" />
                              <span>Subir Archivo Local (.mp3 / .wav)</span>
                            </button>
                            <input 
                              id={`direct-upload-input-${sample.id}`}
                              type="file" 
                              accept="audio/*, .mp3, .wav, .m4a, .aac, .ogg, .flac" 
                              onChange={(e) => handleFileChange(e, sample.id)}
                              className="hidden" 
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>

                          {/* Fallback synthetic demos */}
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <span className="text-[9px] text-slate-500 font-bold uppercase shrink-0">O probar demo:</span>
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleLoadTestBuffer(sample.id, "riser")}
                                className="text-[8px] font-bold bg-slate-950 hover:bg-slate-900 border border-slate-800 text-indigo-350 hover:text-white px-2 py-0.5 rounded cursor-pointer transition-colors"
                                title="Generar riser sintético"
                              >
                                ✨ Riser Fx
                              </button>
                              <button
                                onClick={() => handleLoadTestBuffer(sample.id, "shout")}
                                className="text-[8px] font-bold bg-slate-950 hover:bg-slate-900 border border-slate-800 text-rose-355 hover:text-white px-2 py-0.5 rounded cursor-pointer transition-colors"
                                title="Generar grito de cumbia"
                              >
                                🥁 Grito Cumbia
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>

              {/* General workflow info */}
              <div className="mt-2 text-xs text-slate-500 p-3.5 bg-slate-950/50 rounded-2xl border border-slate-900/50 flex items-start gap-2.5">
                <Info className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>
                  Los audios recortados y editados pasan inmediatamente por el 
                  <strong className="text-slate-400"> Filtro principal (Lowpass)</strong>, el 
                  <strong className="text-slate-300"> Reverb Ambientat de Oración</strong>, y el 
                  <strong className="text-slate-300"> Delay rítmico de Cumbia</strong>, permitiendo modular tus muestras en vivo con los potenciómetros superiores.
                </span>
              </div>
            </div>

            {/* Right side: Active Editor, Trimmer & Responsive Waveform visualizer */}
            <div className="lg:col-span-7 bg-slate-900/40 p-5 md:p-6 rounded-3xl border border-slate-800/60 text-left flex flex-col gap-4">
              
              {(() => {
                const focusedSample = customSamples.find(s => s.id === selectedSampleId);
                if (!focusedSample) return null;

                const hasBuffer = focusedSample.audioBuffer !== null;

                return (
                  <div className="flex flex-col gap-5 h-full justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-1.5">
                        <span className="text-[10px] font-bold uppercase bg-indigo-900/20 text-indigo-300 border border-indigo-900/40 px-2.5 py-0.5 rounded-full">
                          Editor de Recorte de Audio
                        </span>
                        <span className="text-xs text-slate-400 font-mono font-semibold">
                          {focusedSample.id === "sample-slot-1" ? "Ranura 1 / Efectos" :
                           focusedSample.id === "sample-slot-2" ? "Ranura 2 / Pad" : "Ranura 3 / Vocal"}
                        </span>
                      </div>
                      <div className="mt-3 bg-slate-950/80 p-3.5 rounded-2xl border border-indigo-500/10 shadow-inner flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase text-indigo-400 flex items-center gap-1.5 tracking-wider">
                          <Edit2 className="h-3 w-3" />
                          <span>Nombre de la Muestra / Ranura Activa</span>
                        </label>
                        <input 
                          type="text" 
                          value={focusedSample.name}
                          onChange={(e) => {
                            const newName = e.target.value;
                            setCustomSamples(prev => prev.map(s => s.id === focusedSample.id ? { ...s, name: newName } : s));
                          }}
                          className="bg-slate-900 border border-slate-800 focus:border-indigo-550 focus:ring-1 focus:ring-indigo-505 text-xs text-slate-100 px-3.5 py-2.5 rounded-xl w-full font-bold focus:outline-none placeholder-slate-600 shadow-sm"
                          placeholder="Ej: Grito Villero / Loops de Batería / Pista instrumental..."
                        />
                      </div>
                      <p className="text-xs text-slate-400 mt-2.5">Sube un archivo de tu dispositivo arrastrándolo a la caja de abajo, o usa el selector manual. Luego recorta la parte específica usando los deslizadores de tiempo.</p>
                    </div>

                    {/* Waveform Visualization section */}
                    <div className="flex flex-col gap-3">
                      {hasBuffer && focusedSample.audioBuffer ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between items-center text-xs font-mono text-slate-500 mb-1">
                            <span>0.00s</span>
                            <span className="text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/25">
                              Segmento de Recorte Activo (Rojo)
                            </span>
                            <span>{focusedSample.duration.toFixed(2)}s</span>
                          </div>

                          <WaveformVisualizer 
                            buffer={focusedSample.audioBuffer} 
                            startTrim={focusedSample.startTrim} 
                            endTrim={focusedSample.endTrim} 
                          />

                          <div className="flex justify-between items-center text-xs text-slate-400 mt-1 font-mono">
                            <span className="text-slate-350">Inicio: <strong className="text-rose-400">{focusedSample.startTrim.toFixed(2)}s</strong></span>
                            <span className="text-indigo-300 font-bold bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
                              Largo Útil: {(focusedSample.endTrim - focusedSample.startTrim).toFixed(2)}s
                            </span>
                            <span className="text-slate-350">Fin: <strong className="text-rose-400">{focusedSample.endTrim.toFixed(2)}s</strong></span>
                          </div>
                        </div>
                      ) : (
                        /* Drag and drop / file upload box */
                        <div 
                          onDragOver={(e) => handleDragOver(e, focusedSample.id)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, focusedSample.id)}
                          className={`border-2 border-dashed rounded-2xl h-44 flex flex-col justify-center items-center gap-3.5 transition-all p-4 ${
                            dragActiveId === focusedSample.id
                            ? "border-rose-500 bg-rose-500/5 text-slate-200"
                            : "border-slate-800 bg-slate-950/60 hover:bg-slate-950 text-slate-400"
                          }`}
                        >
                          <Upload className="h-9 w-9 text-indigo-500/80 animate-pulse" />
                          <div className="text-center">
                            <p className="text-xs font-bold text-slate-300 text-center">Arrastra y suelta tu pista MP3/WAV aquí</p>
                            <p className="text-[11px] text-slate-500 mt-1 text-center font-medium">o presiona el botón de abajo para seleccionar de tus archivos</p>
                          </div>

                          <button 
                            onClick={() => document.getElementById(`right-audio-upload-input-${focusedSample.id}`)?.click()}
                            className="py-2.5 px-4.5 bg-indigo-600 hover:bg-indigo-700 hover:border-indigo-550 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-sm font-mono"
                          >
                            Seleccionar Archivo de Audio
                          </button>
                          <input 
                            id={`right-audio-upload-input-${focusedSample.id}`}
                            type="file" 
                            accept="audio/*, .mp3, .wav, .m4a, .aac, .ogg, .flac" 
                            onChange={(e) => handleFileChange(e, focusedSample.id)}
                            className="hidden" 
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      )}
                    </div>

                    {/* Parameter edit slides */}
                    {hasBuffer ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950/50 p-4.5 rounded-2xl border border-slate-900 mt-2">
                        
                        <div className="flex flex-col gap-3">
                          <h4 className="text-[11px] font-extrabold uppercase text-slate-500 tracking-wider flex items-center gap-1.5 border-b border-slate-900 pb-1.5 mb-1">
                            <Scissors className="h-3 w-3 text-rose-400" />
                            <span>Ajustar Cortadores de Onda</span>
                          </h4>

                          {/* Start Trim Slider */}
                          <div className="flex flex-col gap-1.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-400 font-semibold">Recortar Inicio:</span>
                              <span className="font-mono text-slate-300 font-bold">{focusedSample.startTrim.toFixed(2)}s</span>
                            </div>
                            <input 
                              type="range"
                              min="0"
                              max={focusedSample.duration}
                              step="0.01"
                              value={focusedSample.startTrim}
                              onChange={(e) => updateSampleTrim(focusedSample.id, parseFloat(e.target.value), focusedSample.endTrim)}
                              className="accent-rose-500 h-1 bg-slate-800 rounded-lg cursor-pointer w-full"
                            />
                          </div>

                          {/* End Trim Slider */}
                          <div className="flex flex-col gap-1.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-400 font-semibold">Recortar Fin:</span>
                              <span className="font-mono text-slate-300 font-bold">{focusedSample.endTrim.toFixed(2)}s</span>
                            </div>
                            <input 
                              type="range"
                              min="0.01"
                              max={focusedSample.duration}
                              step="0.01"
                              value={focusedSample.endTrim}
                              onChange={(e) => updateSampleTrim(focusedSample.id, focusedSample.startTrim, parseFloat(e.target.value))}
                              className="accent-rose-500 h-1 bg-slate-800 rounded-lg cursor-pointer w-full"
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-3">
                          <h4 className="text-[11px] font-extrabold uppercase text-slate-500 tracking-wider flex items-center gap-1.5 border-b border-slate-900 pb-1.5 mb-1">
                            <SlidersHorizontal className="h-3 w-3 text-indigo-400" />
                            <span>Entonación y Volumen de Canal</span>
                          </h4>

                          {/* Playback rate speed shift */}
                          <div className="flex flex-col gap-1.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-400 font-semibold">Velocidad / Tono (Pitch):</span>
                              <span className="font-mono text-slate-300 font-bold">{focusedSample.playbackRate.toFixed(2)}x</span>
                            </div>
                            <input 
                              type="range"
                              min="0.5"
                              max="2.0"
                              step="0.05"
                              value={focusedSample.playbackRate}
                              onChange={(e) => {
                                const rate = parseFloat(e.target.value);
                                setCustomSamples(prev => prev.map(s => s.id === focusedSample.id ? { ...s, playbackRate: rate } : s));
                              }}
                              className="accent-indigo-500 h-1 bg-slate-800 rounded-lg cursor-pointer w-full"
                            />
                            <div className="flex justify-between text-[8px] text-slate-500 font-mono mt-0.5">
                              <span>0.5x (Lento/Grave)</span>
                              <span>1.0x (Regular)</span>
                              <span>2.0x (Rápido/Agudo)</span>
                            </div>
                          </div>

                          {/* Loop toggle & Individual Volume */}
                          <div className="flex items-center justify-between gap-4 py-1">
                            {/* Loop Checkbox */}
                            <label className="flex items-center gap-2.5 cursor-pointer select-none">
                              <input 
                                type="checkbox"
                                checked={focusedSample.loop}
                                onChange={(e) => {
                                  const loopVal = e.target.checked;
                                  setCustomSamples(prev => prev.map(s => s.id === focusedSample.id ? { ...s, loop: loopVal } : s));
                                }}
                                className="rounded bg-slate-950 border-slate-800 text-rose-500 focus:ring-0 cursor-pointer h-4 w-4"
                              />
                              <div className="text-left">
                                <span className="text-xs text-slate-300 font-semibold block leading-none">Repetir en Loop</span>
                                <span className="text-[9px] text-slate-500 leading-none mt-1">Para pads continuos</span>
                              </div>
                            </label>

                            {/* Volume fader */}
                            <div className="flex-1 flex flex-col gap-1">
                              <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                                <span>Volumen:</span>
                                <span>{Math.round(focusedSample.volume * 100)}%</span>
                              </div>
                              <input 
                                type="range"
                                min="0"
                                max="1.0"
                                step="0.05"
                                value={focusedSample.volume}
                                onChange={(e) => {
                                  const v = parseFloat(e.target.value);
                                  setCustomSamples(prev => prev.map(s => s.id === focusedSample.id ? { ...s, volume: v } : s));
                                }}
                                className="accent-indigo-550 h-1 bg-slate-800 rounded-lg cursor-pointer w-full"
                              />
                            </div>
                          </div>

                        </div>

                      </div>
                    ) : (
                      <div className="h-28 flex flex-col items-center justify-center border border-dashed border-slate-805 bg-slate-950/30 rounded-2xl p-4 text-center mt-2">
                        <HelpCircle className="h-5 w-5 text-slate-705 mb-1" />
                        <span className="text-[11px] text-slate-500 text-center">Carga un audio en este canal para habilitar los potenciómetros de recorte de onda, tono y loop.</span>
                      </div>
                    )}

                    {/* Trigger actions footer */}
                    {hasBuffer && (
                      <div className="flex gap-3 justify-end items-center border-t border-slate-900/60 pt-4 mt-2">
                        <span className="text-[10px] text-slate-500 font-bold uppercase mr-auto flex items-center gap-1.5 font-mono">
                          <Shuffle className="h-3.5 w-3.5 text-slate-600" />
                          <span>Muestra útil cargada</span>
                        </span>

                        <button
                          onClick={() => stopCustomSamplePlayback(focusedSample.id)}
                          className="py-2.5 px-4.5 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white text-xs font-bold rounded-xl transition-all border border-slate-800 cursor-pointer"
                        >
                          SILENCIAR
                        </button>

                        <button
                          onClick={() => triggerCustomSamplePlayback(focusedSample.id)}
                          className="py-2.5 px-6 bg-gradient-to-r from-rose-500 to-indigo-650 hover:from-rose-600 hover:to-indigo-750 text-white text-xs font-extrabold rounded-xl transition-all shadow-md active:scale-95 cursor-pointer animate-pulse"
                        >
                          PROBAR AUDIO RECORTADO
                        </button>
                      </div>
                    )}

                  </div>
                );
              })()}
            </div>

          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950/80 py-4 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>Worship & Cumbia Villera • Estudio de Grabación Digital y Arreglista MIDI AI</span>
          <span className="font-mono text-[10px] text-rose-400">Audio Engine Web Audio API v3.0 (Zero-latency Synthesizers)</span>
        </div>
      </footer>

    </div>
  );
}

export interface WaveformProps {
  buffer: AudioBuffer;
  startTrim: number;
  endTrim: number;
}

export function WaveformVisualizer({ buffer, startTrim, endTrim }: WaveformProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Grab channel PCM amplitude values
    const leftChannel = buffer.getChannelData(0);
    const step = Math.ceil(leftChannel.length / width);
    const amp = height / 2;

    // Background color matching tailwind dark palette
    ctx.fillStyle = "#020617"; // slate-950
    ctx.fillRect(0, 0, width, height);

    // Draw coordinate helper grids
    ctx.strokeStyle = "#0f172a"; // slate-900 grid lines
    ctx.lineWidth = 1;
    for (let i = 0; i < width; i += 30) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }

    const duration = buffer.duration;
    const startPx = (startTrim / duration) * width;
    const endPx = (endTrim / duration) * width;

    // Highlight crop limits section
    ctx.fillStyle = "rgba(99, 102, 241, 0.12)"; // indigo-500 tint
    ctx.fillRect(startPx, 0, endPx - startPx, height);

    // Middle signal separation line
    ctx.strokeStyle = "#1e293b"; // slate-800
    ctx.beginPath();
    ctx.moveTo(0, amp);
    ctx.lineTo(width, amp);
    ctx.stroke();

    // Loop through pixels drawing sample amplitude shapes
    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = leftChannel[(i * step) + j];
        if (datum === undefined) continue;
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }

      const inSelection = i >= startPx && i <= endPx;
      ctx.strokeStyle = inSelection ? "#f43f5e" : "#475569"; // rose-500 if inside crop region, slate-600 extra outside
      ctx.lineWidth = 1.8;

      ctx.beginPath();
      ctx.moveTo(i, amp + min * amp * 0.92);
      ctx.lineTo(i, amp + max * amp * 0.92);
      ctx.stroke();
    }

    // Border line boundaries
    ctx.strokeStyle = "#f43f5e"; // rose-500
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(startPx, 0);
    ctx.lineTo(startPx, height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(endPx, 0);
    ctx.lineTo(endPx, height);
    ctx.stroke();

  }, [buffer, startTrim, endTrim]);

  return (
    <div className="relative rounded-2xl overflow-hidden shadow-inner border border-slate-800/80 bg-slate-950">
      <canvas 
        ref={canvasRef} 
        width={650} 
        height={95} 
        className="w-full h-24 object-cover"
      />
    </div>
  );
}

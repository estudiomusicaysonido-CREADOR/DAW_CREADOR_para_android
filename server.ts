import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

let aiClient: any = null;

function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === "MY_GEMINI_API_KEY") {
    throw new Error("Missing GEMINI_API_KEY. Please set your key in AI Studio > Settings > Secrets.");
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Fallback high-quality presets tailored exactly to user requirements
const PRESENTS: Record<string, any> = {
  worship: {
    bpm: 80,
    genre: "Soberano Worship",
    effects: {
      reverbWet: 0.65,
      delayFeedback: 0.35,
      delayTime: 0.45,
      lowpassFilter: 9000,
      distortionValue: 0.0
    },
    tracks: [
      {
        instrument: "piano_pad",
        name: "Piano de Templo con Pad",
        color: "amber-400",
        volume: 0.85,
        notes: [
          // Am chord
          { pitch: "A3", step: 0, duration: 4 },
          { pitch: "C4", step: 0, duration: 4 },
          { pitch: "E4", step: 0, duration: 4 },
          // F chord
          { pitch: "F3", step: 4, duration: 4 },
          { pitch: "A3", step: 4, duration: 4 },
          { pitch: "C4", step: 4, duration: 4 },
          // C chord
          { pitch: "C3", step: 8, duration: 4 },
          { pitch: "G3", step: 8, duration: 4 },
          { pitch: "C4", step: 8, duration: 4 },
          // G chord
          { pitch: "G3", step: 12, duration: 4 },
          { pitch: "B3", step: 12, duration: 4 },
          { pitch: "D4", step: 12, duration: 4 }
        ]
      },
      {
        instrument: "piano_strings",
        name: "Teclado con Strings Suaves",
        color: "emerald-400",
        volume: 0.75,
        notes: [
          { pitch: "E4", step: 2, duration: 2 },
          { pitch: "A4", step: 6, duration: 2 },
          { pitch: "G4", step: 10, duration: 2 },
          { pitch: "E4", step: 14, duration: 2 }
        ]
      },
      {
        instrument: "celestial_pad",
        name: "Atmósfera Celestial Pad",
        color: "indigo-400",
        volume: 0.8,
        notes: [
          { pitch: "A2", step: 0, duration: 8 },
          { pitch: "F2", step: 8, duration: 8 }
        ]
      }
    ]
  },
  cumbia: {
    bpm: 96,
    genre: "Cumbia Villera Argentina",
    effects: {
      reverbWet: 0.10,
      delayFeedback: 0.12,
      delayTime: 0.22,
      lowpassFilter: 16500,
      distortionValue: 0.12
    },
    tracks: [
      {
        instrument: "percussion",
        name: "Percusión Cumbiera",
        color: "rose-500",
        volume: 0.95,
        notes: [
          // Bombo Villero en negras
          { pitch: "bombo", step: 0, duration: 1 },
          { pitch: "bombo", step: 4, duration: 1 },
          { pitch: "bombo", step: 8, duration: 1 },
          { pitch: "bombo", step: 12, duration: 1 },
          // Guiro raspador constante (básico de cumbia)
          { pitch: "guiro", step: 0, duration: 1 },
          { pitch: "guiro", step: 1, duration: 1 },
          { pitch: "guiro", step: 2, duration: 1 },
          { pitch: "guiro", step: 3, duration: 1 },
          { pitch: "guiro", step: 4, duration: 1 },
          { pitch: "guiro", step: 5, duration: 1 },
          { pitch: "guiro", step: 6, duration: 1 },
          { pitch: "guiro", step: 7, duration: 1 },
          { pitch: "guiro", step: 8, duration: 1 },
          { pitch: "guiro", step: 9, duration: 1 },
          { pitch: "guiro", step: 10, duration: 1 },
          { pitch: "guiro", step: 11, duration: 1 },
          { pitch: "guiro", step: 12, duration: 1 },
          { pitch: "guiro", step: 13, duration: 1 },
          { pitch: "guiro", step: 14, duration: 1 },
          { pitch: "guiro", step: 15, duration: 1 },
          // Cencerro "¡Tin, tin!" clave
          { pitch: "cencerro", step: 2, duration: 1 },
          { pitch: "cencerro", step: 6, duration: 1 },
          { pitch: "cencerro", step: 10, duration: 1 },
          { pitch: "cencerro", step: 14, duration: 1 },
          // Redoble de Timbal final
          { pitch: "timbal_agudo", step: 0, duration: 1 },
          { pitch: "timbal_grave", step: 2, duration: 1 },
          { pitch: "timbal_agudo", step: 12, duration: 1 },
          { pitch: "timbal_agudo", step: 13, duration: 1 },
          { pitch: "timbal_grave", step: 14, duration: 1 },
          { pitch: "timbal_agudo", step: 15, duration: 1 }
        ]
      },
      {
        instrument: "piano_pad",
        name: "Teclado Villero Offbeats",
        color: "cyan-400",
        volume: 0.8,
        notes: [
          // A minor offbeat chops (Cumbia style, hitting on steps 2, 6, 10, 14)
          { pitch: "A3", step: 2, duration: 1 },
          { pitch: "C4", step: 2, duration: 1 },
          { pitch: "E4", step: 2, duration: 1 },
          // F major
          { pitch: "F3", step: 6, duration: 1 },
          { pitch: "A3", step: 6, duration: 1 },
          { pitch: "C4", step: 6, duration: 1 },
          // C major
          { pitch: "C4", step: 10, duration: 1 },
          { pitch: "E4", step: 10, duration: 1 },
          { pitch: "G4", step: 10, duration: 1 },
          // G major
          { pitch: "G3", step: 14, duration: 1 },
          { pitch: "B3", step: 14, duration: 1 },
          { pitch: "D4", step: 14, duration: 1 }
        ]
      }
    ]
  }
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health probe API
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Music creation AI Endpoint using Gemini API
  app.post("/api/generate-music", async (req, res) => {
    const { prompt } = req.body;
    
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing or invalid prompt string." });
    }

    const cleanPrompt = prompt.toLowerCase();
    
    try {
      // Lazy get client
      const ai = getGeminiClient();

      const systemInstruction = `You are a high-end Christian Worship Music Producer and Argentine Cumbia Villera MIDI Arranger inside an advanced DAW.
Your goal is to parse the user's music generation request and compose a musically pleasant 16-step loop.
The loop has 16 sixteenth-note steps indexed from 0 to 15.

There are four primary, incredibly realistic synthesized instruments available in this DAW:
1. "piano_pad": Electric Piano voice layered with an integrated, slow-rising celestial Pad background of worship temple atmosphere. Ideal for playing lush chords (e.g., A3, C4, E4 for beautiful Am). Highly suitable for Christian worship.
2. "piano_strings": Electric Piano voice layered with a gorgeous background of slow violin strings. Perfect for temple and ministration vibes.
3. "celestial_pad": Deep warm ambient string wash pad with long, cozy release times to sustain atmospheric prayer and ministry moments.
4. "percussion": Drums & Latin rhythm engine. Pitch MUST be exactly one or more of these Cumbia Villera elements:
   - "bombo" (low heavy punchy kick)
   - "timbal_agudo" (high energetic metallic rimshot ring click)
   - "timbal_grave" (mid-low fat resonant tom timbale)
   - "guiro" (scrape rhythm scrapers)
   - "cencerro" (traditional high cowbell ringing "tin tin" accents)
   - "clap" (modern hand clap sample)

Rules for melodies ("piano_pad", "piano_strings", "celestial_pad"):
- Use notes between C2 and C5 (e.g., A2, C3, E3, A3, C4, E4).
- For spiritual/ministerial ambient loops, prefer slow BPMs (65 to 85) and lush progressions.
- For Argentine Cumbia Villera, prefer BPMs between 90 and 105, and compose fast "percussion" rolls (bombo on 0, 4, 8, 12; guiro on all sixteenth notes; cencerro on counts like 2, 6, 10, 14) along with rapid "piano_pad" chords played briefly on key cumbia offbeats (e.g. steps 2, 6, 10, 14).

The returned JSON must exactly follow the provided schema. Justify values cleanly inside JSON.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash", // Use standard recommended flash model
        contents: `Create a 16-step instrumental loop matching the instruction: "${prompt}". Provide high-quality MIDI arrangements matching the Christian/Worship or Argentine Cumbia Villera style. Use only correct instruments ('piano_pad', 'piano_strings', 'celestial_pad', 'percussion') and notes.`,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              bpm: {
                type: Type.INTEGER,
                description: "The ideal BPM of this musical piece, usually 65-85 for worship or 90-105 for cumbia."
              },
              genre: {
                type: Type.STRING,
                description: "Name of the sub-genre e.g. Worship Atmosfera, Cumbia de Barrio, Ministracion Suave, Agite Villero"
              },
              effects: {
                type: Type.OBJECT,
                description: "Soporte FX Rack settings for this specific music genre style.",
                properties: {
                  reverbWet: {
                    type: Type.NUMBER,
                    description: "Reverb wet factor, 0.0 to 0.90. (High for worship atmospheres like 0.65, low for dry bouncy cumbia like 0.10)."
                  },
                  delayFeedback: {
                    type: Type.NUMBER,
                    description: "Delay feedback level, typically 0.0 to 0.80."
                  },
                  delayTime: {
                    type: Type.NUMBER,
                    description: "Delay timing in seconds, 0.1 to 1.2."
                  },
                  lowpassFilter: {
                    type: Type.INTEGER,
                    description: "Filter cutoff in Hz. Set low (e.g. 8000) for deep warm worship chords, high (e.g. 16500) for bright crispy cumbia timbales and percussion."
                  },
                  distortionValue: {
                    type: Type.NUMBER,
                    description: "Distortion level, 0.0 to 0.40. Usually 0.0 for pure clean worship, or slightly higher (e.g. 0.12) for typical gritty cumbia keyboard chords."
                  }
                },
                required: ["reverbWet", "delayFeedback", "delayTime", "lowpassFilter", "distortionValue"]
              },
              tracks: {
                type: Type.ARRAY,
                description: "Array of music tracks backing this custom loop.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    instrument: {
                      type: Type.STRING,
                      description: "Must be exactly one of: 'piano_pad', 'piano_strings', 'celestial_pad', 'percussion'"
                    },
                    name: {
                      type: Type.STRING,
                      description: "A human-friendly label for this track, in Spanish e.g. 'Piano con Pad de Fondo', 'Cencerro y Timbales'."
                    },
                    color: {
                      type: Type.STRING,
                      description: "A Tailwind color class name, e.g. 'amber-400', 'indigo-400' or 'rose-500'."
                    },
                    volume: {
                      type: Type.NUMBER,
                      description: "Default volume level (0.0 to 1.0)"
                    },
                    notes: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          pitch: {
                            type: Type.STRING,
                            description: "Pitch. If instrument is 'percussion', must be one of: 'bombo', 'timbal_agudo', 'timbal_grave', 'guiro', 'cencerro', 'clap'. For melodic instruments, use standard keyboard notations e.g. A3, C#4, E4."
                          },
                          step: {
                            type: Type.INTEGER,
                            description: "The sixteenth-step marker indices, from 0 to 15 inclusive."
                          },
                          duration: {
                            type: Type.INTEGER,
                            description: "Duration of note in sixteenth-steps, typically 1 to 16 steps (pads should be longer; percussion 1 step)."
                          }
                        },
                        required: ["pitch", "step", "duration"]
                      }
                    }
                  },
                  required: ["instrument", "notes", "name", "color", "volume"]
                }
              }
            },
            required: ["bpm", "genre", "effects", "tracks"]
          }
        }
      });

      const text = response.text ? response.text.trim() : "";
      const resultObj = JSON.parse(text);
      return res.json({ result: resultObj, source: "ai" });

    } catch (err: any) {
      console.warn("Using preset fallback. Reason: ", err.message);
      
      let matchedPreset = PRESENTS.worship; // Default worship fallback
      if (cleanPrompt.includes("cumbia") || cleanPrompt.includes("villera") || cleanPrompt.includes("argentina") || cleanPrompt.includes("percu") || cleanPrompt.includes("ritmo")) {
        matchedPreset = PRESENTS.cumbia;
      }

      return res.json({
        result: matchedPreset,
        source: "local-preset",
        info: "Using high-quality offline sequencer engine designed with Worship / Cumbia presets."
      });
    }
  });

  // Enable static asset compilation depending on environment
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

import { env } from "../config/env.js";

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1";

export interface TTSInput {
  text: string;
  voiceId?: string;
  stability?: number;
  similarityBoost?: number;
  modelId?: string;
}

export interface SFXInput {
  prompt: string;
  durationSeconds?: number;
}

export interface Voice {
  voiceId: string;
  name: string;
  category: string;
  labels: Record<string, string>;
  previewUrl: string;
}

export interface AudioResult {
  audioUrl: string;
  duration?: number;
}

export interface TranscriptionWord {
  text: string;
  start: number;
  end: number;
  type: "word" | "spacing" | "punctuation";
}

export interface TranscriptionResult {
  text: string;
  words: TranscriptionWord[];
  language_code: string;
}

// Built-in ElevenLabs voice presets — maps descriptive names/keywords to real voice IDs
const VOICE_PRESETS: Record<string, { id: string; name: string }> = {
  // Male voices
  "male":          { id: "pNInz6obpgDQGcFmaJgB", name: "Adam" },
  "adam":          { id: "pNInz6obpgDQGcFmaJgB", name: "Adam" },
  "deep male":    { id: "ErXwobaYiN019PkySvjV", name: "Antoni" },
  "antoni":       { id: "ErXwobaYiN019PkySvjV", name: "Antoni" },
  "narrator":     { id: "VR6AewLTigWG4xSOukaG", name: "Arnold" },
  "arnold":       { id: "VR6AewLTigWG4xSOukaG", name: "Arnold" },
  "josh":         { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh" },
  "young male":   { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh" },
  "sam":          { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam" },
  "clyde":        { id: "2EiwWnXFnvU5JabPnv8n", name: "Clyde" },
  "deep":         { id: "2EiwWnXFnvU5JabPnv8n", name: "Clyde" },
  "james":        { id: "ZQe5CZNOzWyzPSCn5a3c", name: "James" },
  "british male": { id: "ZQe5CZNOzWyzPSCn5a3c", name: "James" },
  "callum":       { id: "N2lVS1w4EtoT3dr4eOWO", name: "Callum" },
  "charlie":      { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie" },
  "daniel":       { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel" },
  "british":      { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel" },
  "ethan":        { id: "g5CIjZEefAph4nQFvHAz", name: "Ethan" },
  "fin":          { id: "D38z5RcWu1voky8WS1ja", name: "Fin" },
  "liam":         { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam" },
  "patrick":      { id: "ODq5zmih8GrVes37Dizd", name: "Patrick" },
  // Female voices
  "female":       { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel" },
  "rachel":       { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel" },
  "domi":         { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi" },
  "bella":        { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella" },
  "young female": { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella" },
  "elli":         { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli" },
  "soft female":  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli" },
  "charlotte":    { id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte" },
  "dorothy":      { id: "ThT5KcBeYPX3keUQqHPh", name: "Dorothy" },
  "emily":        { id: "LcfcDJNUP1GQjkzn1xUU", name: "Emily" },
  "glinda":       { id: "z9fAnlkpzviPz146aGWa", name: "Glinda" },
  "grace":        { id: "oWAxZDx7w5VEj9dCyTzz", name: "Grace" },
  "lily":         { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily" },
  "nicole":       { id: "piTKgcLEGmPE4e6mEKli", name: "Nicole" },
  "serena":       { id: "pMsXgVXv3BLzUgSXRplE", name: "Serena" },
  // Neutral / special
  "child":        { id: "jBpfuIE2acCO8z3wKNLl", name: "Gigi" },
  "gigi":         { id: "jBpfuIE2acCO8z3wKNLl", name: "Gigi" },
};

/** Resolve a voice descriptor (name, keyword, or actual ID) to a real ElevenLabs voice ID */
function resolveVoiceId(voiceIdOrName?: string): string {
  if (!voiceIdOrName) return "21m00Tcm4TlvDq8ikWAM"; // Default: Rachel

  // If it looks like an actual ElevenLabs voice ID (20+ char alphanumeric), use it directly
  if (/^[a-zA-Z0-9]{20,}$/.test(voiceIdOrName)) {
    return voiceIdOrName;
  }

  // Try to match by name/keyword (case-insensitive)
  const key = voiceIdOrName.toLowerCase().trim();
  if (VOICE_PRESETS[key]) {
    return VOICE_PRESETS[key].id;
  }

  // Partial match: check if any preset key is contained in the input
  for (const [preset, voice] of Object.entries(VOICE_PRESETS)) {
    if (key.includes(preset) || preset.includes(key)) {
      return voice.id;
    }
  }

  // Last resort: default to Rachel
  console.warn(`[ElevenLabs] Unknown voice "${voiceIdOrName}", defaulting to Rachel`);
  return "21m00Tcm4TlvDq8ikWAM";
}

export class ElevenLabsService {
  private apiKey = env.ELEVENLABS_API_KEY;
  private defaultVoiceId = "21m00Tcm4TlvDq8ikWAM"; // Rachel

  private async fetch(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const response = await fetch(`${ELEVENLABS_API_URL}${endpoint}`, {
      ...options,
      headers: {
        "xi-api-key": this.apiKey,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
    }

    return response;
  }

  async textToSpeech(input: TTSInput): Promise<AudioResult> {
    const voiceId = resolveVoiceId(input.voiceId);
    const modelId = input.modelId || "eleven_multilingual_v2";

    const response = await this.fetch(`/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: input.text,
        model_id: modelId,
        voice_settings: {
          stability: input.stability ?? 0.5,
          similarity_boost: input.similarityBoost ?? 0.75,
        },
      }),
    });

    // Response is audio bytes
    const audioBuffer = await response.arrayBuffer();

    // For now, return as base64 data URL
    // In production, upload to Supabase storage
    const base64 = Buffer.from(audioBuffer).toString("base64");
    const audioUrl = `data:audio/mpeg;base64,${base64}`;

    return { audioUrl };
  }

  async generateSFX(input: SFXInput): Promise<AudioResult> {
    const response = await this.fetch("/sound-generation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: input.prompt,
        duration_seconds: input.durationSeconds ?? 5,
        prompt_influence: 0.3,
      }),
    });

    const audioBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(audioBuffer).toString("base64");
    const audioUrl = `data:audio/mpeg;base64,${base64}`;

    return { audioUrl };
  }

  async listVoices(): Promise<Voice[]> {
    const response = await this.fetch("/voices");
    const data = await response.json() as { voices?: Array<Record<string, unknown>> };

    return (data.voices || []).map((v) => ({
      voiceId: v.voice_id as string,
      name: v.name as string,
      category: (v.category || "premade") as string,
      labels: (v.labels || {}) as Record<string, string>,
      previewUrl: v.preview_url as string,
    }));
  }

  async getVoice(voiceId: string): Promise<Voice> {
    const response = await this.fetch(`/voices/${voiceId}`);
    const v = await response.json() as Record<string, unknown>;

    return {
      voiceId: v.voice_id as string,
      name: v.name as string,
      category: (v.category || "premade") as string,
      labels: (v.labels || {}) as Record<string, string>,
      previewUrl: v.preview_url as string,
    };
  }

  async cloneVoice(
    name: string,
    audioFiles: Buffer[],
    description?: string
  ): Promise<Voice> {
    const formData = new FormData();
    formData.append("name", name);
    if (description) {
      formData.append("description", description);
    }

    audioFiles.forEach((file, i) => {
      formData.append("files", new Blob([file]), `sample_${i}.mp3`);
    });

    const response = await this.fetch("/voices/add", {
      method: "POST",
      body: formData,
    });

    const data = await response.json() as Record<string, unknown>;

    return {
      voiceId: data.voice_id as string,
      name,
      category: "cloned",
      labels: {},
      previewUrl: "",
    };
  }

  async transcribe(audioUrl: string): Promise<TranscriptionResult> {
    // Fetch the audio file
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to fetch audio from URL: ${audioResponse.status}`);
    }
    const audioBuffer = await audioResponse.arrayBuffer();

    const formData = new FormData();
    formData.append("file", new Blob([audioBuffer], { type: "audio/mpeg" }), "audio.mp3");
    formData.append("model_id", "scribe_v1");

    const response = await this.fetch("/speech-to-text", {
      method: "POST",
      body: formData,
    });

    const data = await response.json() as TranscriptionResult;
    return data;
  }

  async speechToSpeech(
    audioUrl: string,
    targetVoiceId: string
  ): Promise<AudioResult> {
    // Fetch source audio
    const audioResponse = await fetch(audioUrl);
    const audioBuffer = await audioResponse.arrayBuffer();

    const formData = new FormData();
    formData.append("audio", new Blob([audioBuffer]), "source.mp3");
    formData.append("model_id", "eleven_english_sts_v2");

    const response = await this.fetch(`/speech-to-speech/${targetVoiceId}`, {
      method: "POST",
      body: formData,
    });

    const resultBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(resultBuffer).toString("base64");

    return {
      audioUrl: `data:audio/mpeg;base64,${base64}`,
    };
  }
}

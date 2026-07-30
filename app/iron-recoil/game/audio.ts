import type { Settings } from "./types";

type SoundName =
  | "shoot"
  | "scatter"
  | "hit"
  | "explosion"
  | "pickup"
  | "hurt"
  | "death"
  | "alarm"
  | "victory";

const SOUND: Record<
  SoundName,
  { frequency: number; duration: number; wave: OscillatorType; end?: number }
> = {
  shoot: { frequency: 185, duration: 0.055, wave: "square", end: 105 },
  scatter: { frequency: 125, duration: 0.11, wave: "sawtooth", end: 70 },
  hit: { frequency: 420, duration: 0.045, wave: "square", end: 260 },
  explosion: { frequency: 84, duration: 0.32, wave: "sawtooth", end: 28 },
  pickup: { frequency: 520, duration: 0.18, wave: "triangle", end: 880 },
  hurt: { frequency: 160, duration: 0.2, wave: "sawtooth", end: 75 },
  death: { frequency: 120, duration: 0.27, wave: "square", end: 36 },
  alarm: { frequency: 240, duration: 0.38, wave: "square", end: 180 },
  victory: { frequency: 440, duration: 0.55, wave: "triangle", end: 880 },
};

export class SynthAudio {
  private context: AudioContext | null = null;
  private settings: Settings;

  constructor(settings: Settings) {
    this.settings = settings;
  }

  updateSettings(settings: Settings): void {
    this.settings = settings;
  }

  async unlock(): Promise<void> {
    if (this.context === null) {
      this.context = new AudioContext();
    }
    if (this.context.state === "suspended") {
      await this.context.resume();
    }
  }

  play(name: SoundName): void {
    if (this.settings.muted || this.settings.volume <= 0) return;
    const context = this.context;
    if (!context || context.state !== "running") return;

    const preset = SOUND[name];
    const start = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = preset.wave;
    oscillator.frequency.setValueAtTime(preset.frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(20, preset.end ?? preset.frequency),
      start + preset.duration,
    );
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, this.settings.volume * 0.11),
      start + 0.008,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, start + preset.duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + preset.duration + 0.02);
  }

  destroy(): void {
    const context = this.context;
    this.context = null;
    if (context) void context.close();
  }
}

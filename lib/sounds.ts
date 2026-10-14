export type SoundEffect = 'click' | 'accepted' | 'invalid' | 'turn' | 'finish';
const cues: Record<SoundEffect, { notes: number[]; step: number; volume: number }> = {
  click: { notes: [720], step: 0.035, volume: 0.018 },
  accepted: { notes: [523, 659, 784], step: 0.065, volume: 0.033 },
  invalid: { notes: [294, 220], step: 0.085, volume: 0.028 },
  turn: { notes: [440, 554], step: 0.06, volume: 0.024 },
  finish: { notes: [523, 659, 784, 1047], step: 0.12, volume: 0.038 },
};
export class GameSounds {
  private context: AudioContext | null = null;
  private enabled = true;
  private voices = new Set<OscillatorNode>();
  private lastPlayed = new Map<SoundEffect, number>();
  private playingUntil = 0;
  private currentEffect: SoundEffect | null = null;
  constructor(private createContext = () => new AudioContext()) {}
  // Unlock on a gesture; do not queue historical cues while audio is blocked.
  unlock() {
    if (!this.enabled) return;
    try {
      this.context ??= this.createContext();
      void this.context.resume().catch(() => {});
    } catch {
      /* Audio is optional. */
    }
  }
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) this.stop();
  }
  private stop() {
    for (const voice of this.voices) {
      try {
        voice.stop();
      } catch {
        /* Already ended. */
      }
    }
    this.voices.clear();
    this.playingUntil = 0;
    this.currentEffect = null;
  }
  play(effect: SoundEffect): boolean {
    if (!this.enabled) return false;
    try {
      const ctx = (this.context ??= this.createContext());
      if (ctx.state !== 'running') return false;
      const now = ctx.currentTime;
      if (now - (this.lastPlayed.get(effect) ?? -Infinity) < 0.16) return false;
      // Buttons and turn cues cannot talk over answers or the ending melody.
      if (
        now < this.playingUntil &&
        (effect === 'click' || effect === 'turn' || this.currentEffect === 'finish')
      )
        return false;
      this.stop();
      this.lastPlayed.set(effect, now);
      this.currentEffect = effect;
      const cue = cues[effect];
      this.playingUntil = now + (cue.notes.length + 0.6) * cue.step;
      for (const [index, frequency] of cue.notes.entries()) {
        const start = now + index * cue.step;
        const oscillator = ctx.createOscillator(),
          gain = ctx.createGain();
        oscillator.type = effect === 'click' ? 'triangle' : 'sine';
        oscillator.frequency.value = frequency;
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(cue.volume, start + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + cue.step * 1.5);
        this.voices.add(oscillator);
        oscillator.onended = () => {
          this.voices.delete(oscillator);
          oscillator.disconnect();
          gain.disconnect();
        };
        oscillator.start(start);
        oscillator.stop(start + cue.step * 1.6);
      }
      return true;
    } catch {
      return false;
    }
  }
  close() {
    this.stop();
    try {
      void this.context?.close().catch(() => {});
    } catch {
      /* Already closed. */
    }
    this.context = null;
    this.lastPlayed.clear();
  }
}

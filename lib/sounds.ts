export type SoundEffect = 'click' | 'accepted' | 'invalid' | 'finish';
const melodies: Record<SoundEffect, number[]> = {
  click: [900],
  accepted: [660, 880, 1108],
  invalid: [220, 165],
  finish: [523, 659, 784, 1047],
};
export class GameSounds {
  private context: AudioContext | null = null;
  play(effect: SoundEffect) {
    try {
      const ctx = this.context ?? new AudioContext();
      this.context = ctx;
      void ctx.resume().catch(() => {});
      const step = effect === 'click' ? 0.045 : effect === 'finish' ? 0.15 : 0.09;
      melodies[effect].forEach((frequency, index) => {
        const start = ctx.currentTime + index * step + (effect === 'finish' ? 0.18 : 0);
        const oscillator = ctx.createOscillator(),
          gain = ctx.createGain();
        oscillator.type = effect === 'click' ? 'triangle' : 'sine';
        oscillator.frequency.value = frequency;
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(effect === 'click' ? 0.025 : 0.045, start + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.001, start + step * 1.7);
        oscillator.start(start);
        oscillator.stop(start + step * 1.8);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
        };
      });
    } catch {
      /* Audio is optional and may be blocked until the first gesture. */
    }
  }
  close() {
    void this.context?.close();
    this.context = null;
  }
}

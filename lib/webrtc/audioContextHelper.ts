/**
 * Synthesizes ringtones and call feedback sounds using Web Audio API.
 * 100% client-side, zero network dependencies or external audio files needed.
 */

class SoundEffectsManager {
  private ctx: AudioContext | null = null;
  private ringInterval: NodeJS.Timeout | null = null;
  private dialInterval: NodeJS.Timeout | null = null;

  private getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Starts playing a telephone ringing sound for incoming calls
   */
  public startIncomingRingtone(): void {
    this.stopAllSounds();

    const playRingCycle = () => {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      try {
        const now = ctx.currentTime;

        // Two frequencies for standard pleasant phone ring (440Hz + 480Hz)
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = "sine";
        osc1.frequency.setValueAtTime(440, now);
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(480, now);

        // Ring 1s, pause 0.3s, ring 1s, pause 1.7s (3s total)
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
        gain.gain.setValueAtTime(0.15, now + 0.8);
        gain.gain.linearRampToValueAtTime(0, now + 0.85);

        gain.gain.setValueAtTime(0, now + 1.1);
        gain.gain.linearRampToValueAtTime(0.15, now + 1.15);
        gain.gain.setValueAtTime(0.15, now + 1.95);
        gain.gain.linearRampToValueAtTime(0, now + 2.0);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 2.05);
        osc2.stop(now + 2.05);
      } catch (_) {}
    };

    playRingCycle();
    this.ringInterval = setInterval(playRingCycle, 3200);
  }

  /**
   * Starts playing outgoing dial tone (calling...)
   */
  public startOutgoingDialTone(): void {
    this.stopAllSounds();

    const playDialTone = () => {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      try {
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = "sine";
        osc1.frequency.setValueAtTime(440, now);
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(480, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.05);
        gain.gain.setValueAtTime(0.08, now + 1.2);
        gain.gain.linearRampToValueAtTime(0, now + 1.25);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1.3);
        osc2.stop(now + 1.3);
      } catch (_) {}
    };

    playDialTone();
    this.dialInterval = setInterval(playDialTone, 3000);
  }

  /**
   * Plays a pleasant chime when the call connects
   */
  public playConnectedChime(): void {
    this.stopAllSounds();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.15); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.3); // G5

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.65);
    } catch (_) {}
  }

  /**
   * Plays a descending beep when call ends or is declined
   */
  public playEndCallTone(): void {
    this.stopAllSounds();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.linearRampToValueAtTime(260, now + 0.3);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.36);
    } catch (_) {}
  }

  /**
   * Stops all running sound loops (ringtone, dial tone)
   */
  public stopAllSounds(): void {
    if (this.ringInterval) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }
    if (this.dialInterval) {
      clearInterval(this.dialInterval);
      this.dialInterval = null;
    }
  }
}

export const callSounds = new SoundEffectsManager();

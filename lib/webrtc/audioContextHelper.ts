/**
 * Synthesizes ringtones and call feedback sounds using Web Audio API.
 * 100% client-side, zero network dependencies or external audio files needed.
 */

class SoundEffectsManager {
  private ctx: AudioContext | null = null;
  private ringInterval: NodeJS.Timeout | null = null;
  private dialInterval: NodeJS.Timeout | null = null;
  private incomingAudio: HTMLAudioElement | null = null;
  private gestureCleanup: (() => void) | null = null;

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

  private removeGestureListener(): void {
    if (this.gestureCleanup) {
      this.gestureCleanup();
      this.gestureCleanup = null;
    }
  }

  /**
   * Starts playing the custom ringtone audio file for incoming calls
   * Uses public/assets/ringtone.mpeg with Web Audio fallback if autoplay is restricted
   */
  public startIncomingRingtone(): void {
    this.stopAllSounds();

    if (typeof window !== "undefined") {
      try {
        const audio = new Audio("/assets/ringtone.mpeg");
        audio.loop = true;
        audio.volume = 1.0;
        audio.preload = "auto";
        this.incomingAudio = audio;

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              // Custom MPEG ringtone playing successfully
            })
            .catch((err) => {
              console.warn("MPEG ringtone autoplay blocked by browser, waiting for user gesture:", err);
              // Fallback to synthesized ring while waiting for user interaction
              this.playSyntheticRingLoop();

              // As soon as user touches or clicks anywhere, start the custom MPEG ringtone
              const onUserGesture = () => {
                if (this.incomingAudio) {
                  this.incomingAudio.play().then(() => {
                    // Custom MPEG ringtone started, cancel synthetic fallback
                    if (this.ringInterval) {
                      clearInterval(this.ringInterval);
                      this.ringInterval = null;
                    }
                  }).catch(() => {});
                }
                this.removeGestureListener();
              };

              window.addEventListener("click", onUserGesture, { once: true });
              window.addEventListener("touchstart", onUserGesture, { once: true });
              window.addEventListener("keydown", onUserGesture, { once: true });

              this.gestureCleanup = () => {
                window.removeEventListener("click", onUserGesture);
                window.removeEventListener("touchstart", onUserGesture);
                window.removeEventListener("keydown", onUserGesture);
              };
            });
        }
        return;
      } catch (err) {
        console.warn("Failed to initialize custom ringtone audio:", err);
      }
    }

    // Fallback to Web Audio API synthesized ringing if audio element fails
    this.playSyntheticRingLoop();
  }

  /**
   * Web Audio API synthesized phone ring fallback
   */
  private playSyntheticRingLoop(): void {
    if (this.ringInterval) return;

    const playRingCycle = () => {
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
    this.removeGestureListener();
    if (this.incomingAudio) {
      try {
        this.incomingAudio.pause();
        this.incomingAudio.currentTime = 0;
      } catch (_) {}
      this.incomingAudio = null;
    }
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

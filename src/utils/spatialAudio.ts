import { FloorHotspot, TowerZone } from '../types/architecture';

const SOUND_STORAGE_KEY = 'tower_spatial_audio_enabled';

/**
 * Architectural Pentatonic frequencies across tower elevation (Level 01 -> Level 26)
 * Warm mid-low register tuned to sound like resonant brushed brass & acoustic glass.
 */
const ALTITUDE_SCALE_HZ = [
  196.0, // G3  - Ground Podium
  220.0, // A3  - Lower Office
  246.94, // B3
  261.63, // C4
  293.66, // D4
  329.63, // E4 - Mid Amenity
  369.99, // F#4
  392.0, // G4
  440.0, // A4 - Upper Residential
  493.88, // B4
  523.25, // C5 - Crown Level 26
];

class SpatialAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private roomSend: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private enabled: boolean = true;
  private lastHoverAt = 0;
  private listeners: Set<(enabled: boolean) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const stored = window.localStorage.getItem(SOUND_STORAGE_KEY);
        if (stored === 'false') {
          this.enabled = false;
        }
      } catch {
        // Ignore storage errors
      }
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(next: boolean): void {
    this.enabled = next;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(SOUND_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage errors
      }
    }

    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(next ? 0.65 : 0.0, now, 0.04);
    }

    if (next) {
      this.unlock();
    }

    this.listeners.forEach((cb) => cb(next));
  }

  public toggle(): boolean {
    const next = !this.enabled;
    this.setEnabled(next);
    if (next) {
      // Subtle confirmation chime when turning audio on
      this.playConfirmationChime();
    }
    return next;
  }

  public subscribe(cb: (enabled: boolean) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  public unlock(): void {
    if (typeof window === 'undefined') return;
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {
        // Autoplay policy will retry on next gesture
      });
    }
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (this.ctx) return this.ctx;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioCtx) return null;

    try {
      const ctx = new AudioCtx();

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 18;
      compressor.ratio.value = 3;
      compressor.attack.value = 0.008;
      compressor.release.value = 0.25;

      const master = ctx.createGain();
      master.gain.value = this.enabled ? 0.65 : 0.0;

      // Subtle architectural cross-delay room space (stone & glass hall ambience)
      const delayL = ctx.createDelay(0.5);
      const delayR = ctx.createDelay(0.5);
      delayL.delayTime.value = 0.095;
      delayR.delayTime.value = 0.145;

      const fbL = ctx.createGain();
      const fbR = ctx.createGain();
      fbL.gain.value = 0.22;
      fbR.gain.value = 0.18;

      const roomFilter = ctx.createBiquadFilter();
      roomFilter.type = 'lowpass';
      roomFilter.frequency.value = 1800;

      const roomSend = ctx.createGain();
      roomSend.gain.value = 0.28;

      const merger = ctx.createChannelMerger(2);

      roomSend.connect(roomFilter);
      roomFilter.connect(delayL);
      roomFilter.connect(delayR);

      delayL.connect(fbR);
      fbR.connect(delayR);
      delayR.connect(fbL);
      fbL.connect(delayL);

      delayL.connect(merger, 0, 0);
      delayR.connect(merger, 0, 1);

      merger.connect(master);
      master.connect(compressor);
      compressor.connect(ctx.destination);

      this.ctx = ctx;
      this.masterGain = master;
      this.roomSend = roomSend;
      this.noiseBuffer = this.buildWarmNoiseBuffer(ctx);

      return ctx;
    } catch {
      return null;
    }
  }

  private buildWarmNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      // Soft pink/brown roll-off for velvet atmospheric air noise
      lastOut = (lastOut + 0.045 * white) / 1.045;
      data[i] = lastOut * 2.4;
    }
    return buffer;
  }

  private canPlay(): AudioContext | null {
    if (!this.enabled) return null;
    const ctx = this.ensureContext();
    if (!ctx) return null;
    if (ctx.state === 'suspended') {
      // Do not queue stale sounds while AudioContext awaits first gesture
      return null;
    }
    return ctx;
  }

  private createSpatialBranch(ctx: AudioContext, pan: number, sendWet = true): GainNode | null {
    if (!this.masterGain) return null;
    const nodeGain = ctx.createGain();
    const clampedPan = Math.max(-0.8, Math.min(0.8, pan));

    if (typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.value = clampedPan;
      nodeGain.connect(panner);
      panner.connect(this.masterGain);
    } else {
      nodeGain.connect(this.masterGain);
    }

    if (sendWet && this.roomSend) {
      nodeGain.connect(this.roomSend);
    }

    return nodeGain;
  }

  private getFloorFrequency(floorNumber: number): number {
    const norm = Math.max(0, Math.min(1, (floorNumber - 1) / 25));
    const idx = Math.min(
      ALTITUDE_SCALE_HZ.length - 1,
      Math.round(norm * (ALTITUDE_SCALE_HZ.length - 1))
    );
    return ALTITUDE_SCALE_HZ[idx];
  }

  private getFloorPan(floor: Pick<FloorHotspot, 'zoomTargetX' | 'x' | 'width'>): number {
    const cx = floor.zoomTargetX ?? floor.x + floor.width / 2;
    return Math.max(-0.55, Math.min(0.55, (cx - 0.5) * 2.2));
  }

  public playConfirmationChime(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.enabled) return;
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => this.triggerSoftHarmonic(ctx, 329.63, 0, 0.045, 0.28)).catch(() => {});
      return;
    }
    this.triggerSoftHarmonic(ctx, 329.63, 0, 0.045, 0.28);
  }

  private triggerSoftHarmonic(
    ctx: AudioContext,
    freq: number,
    pan: number,
    peakGain: number,
    durationSec: number
  ): void {
    const out = this.createSpatialBranch(ctx, pan, true);
    if (!out) return;

    const now = ctx.currentTime;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(1800, freq * 3.2), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(260, freq * 1.4), now + durationSec);

    const oscFundamental = ctx.createOscillator();
    oscFundamental.type = 'sine';
    oscFundamental.frequency.setValueAtTime(freq, now);

    const oscOvertone = ctx.createOscillator();
    oscOvertone.type = 'triangle';
    oscOvertone.frequency.setValueAtTime(freq * 1.5, now); // Pure fifth shimmer

    const overtoneGain = ctx.createGain();
    overtoneGain.gain.setValueAtTime(0.16, now);

    out.gain.setValueAtTime(0.0001, now);
    out.gain.linearRampToValueAtTime(peakGain, now + 0.016);
    out.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    oscFundamental.connect(filter);
    oscOvertone.connect(overtoneGain);
    overtoneGain.connect(filter);
    filter.connect(out);

    oscFundamental.start(now);
    oscOvertone.start(now);
    oscFundamental.stop(now + durationSec + 0.02);
    oscOvertone.stop(now + durationSec + 0.02);
  }

  /**
   * Subtle spatial glass-and-brass resonance when hovering over any tower level
   */
  public playFloorHover(floor: Pick<FloorHotspot, 'floorNumber' | 'zoomTargetX' | 'x' | 'width'>): void {
    const ctx = this.canPlay();
    if (!ctx) return;

    const nowMs = performance.now();
    if (nowMs - this.lastHoverAt < 65) return;
    this.lastHoverAt = nowMs;

    const freq = this.getFloorFrequency(floor.floorNumber);
    const pan = this.getFloorPan(floor);
    this.triggerSoftHarmonic(ctx, freq, pan, 0.036, 0.22);
  }

  /**
   * Subtle tactile precision trigger when selecting zones on CAD floor plan
   */
  public playBlueprintSelect(panOffset = 0): void {
    const ctx = this.canPlay();
    if (!ctx) return;
    this.triggerSoftHarmonic(ctx, 392.0, panOffset, 0.034, 0.18);
  }

  /**
   * Architectural camera portal swell when zooming into a selected tower floor
   */
  public playZoomEnter(floor: Pick<FloorHotspot, 'floorNumber' | 'zoomTargetX' | 'x' | 'width'>): void {
    const ctx = this.canPlay();
    if (!ctx) return;

    const now = ctx.currentTime;
    const freq = this.getFloorFrequency(floor.floorNumber);
    const pan = this.getFloorPan(floor);

    // 1. Soft atmospheric air-glide whoosh
    if (this.noiseBuffer) {
      const airOut = this.createSpatialBranch(ctx, pan * 0.5, true);
      if (airOut) {
        const noise = ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;

        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = 1.4;
        bp.frequency.setValueAtTime(160, now);
        bp.frequency.exponentialRampToValueAtTime(520, now + 0.55);
        bp.frequency.exponentialRampToValueAtTime(210, now + 1.15);

        airOut.gain.setValueAtTime(0.0001, now);
        airOut.gain.linearRampToValueAtTime(0.055, now + 0.28);
        airOut.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

        noise.connect(bp);
        bp.connect(airOut);
        noise.start(now);
        noise.stop(now + 1.25);
      }
    }

    // 2. Warm ascending destination harmonic
    const toneOut = this.createSpatialBranch(ctx, pan, true);
    if (toneOut) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * 0.75, now);
      osc.frequency.exponentialRampToValueAtTime(freq, now + 0.65);

      toneOut.gain.setValueAtTime(0.0001, now);
      toneOut.gain.linearRampToValueAtTime(0.048, now + 0.15);
      toneOut.gain.exponentialRampToValueAtTime(0.0001, now + 1.05);

      osc.connect(toneOut);
      osc.start(now);
      osc.stop(now + 1.1);
    }
  }

  /**
   * Spacious acoustic room bloom when the interior stage opens
   */
  public playInteriorReveal(zone: TowerZone = 'residential'): void {
    const ctx = this.canPlay();
    if (!ctx) return;

    const rootHz = zone === 'residential' ? 293.66 : zone === 'office' ? 261.63 : 220.0;
    this.triggerSoftHarmonic(ctx, rootHz, -0.22, 0.032, 0.65);

    window.setTimeout(() => {
      const innerCtx = this.canPlay();
      if (innerCtx) {
        this.triggerSoftHarmonic(innerCtx, rootHz * 1.5, 0.24, 0.026, 0.75);
      }
    }, 95);
  }

  /**
   * Soft decompressing pull-back gesture when returning to the exterior elevation
   */
  public playReturnToTower(): void {
    const ctx = this.canPlay();
    if (!ctx) return;

    const now = ctx.currentTime;
    const out = this.createSpatialBranch(ctx, 0, true);
    if (!out) return;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(293.66, now);
    osc.frequency.exponentialRampToValueAtTime(196.0, now + 0.72);

    out.gain.setValueAtTime(0.0001, now);
    out.gain.linearRampToValueAtTime(0.04, now + 0.08);
    out.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

    osc.connect(out);
    osc.start(now);
    osc.stop(now + 0.85);
  }

  /**
   * Subtle spatial glass slide when stepping between interior room views
   */
  public playSceneStep(panDirection: number = 0): void {
    const ctx = this.canPlay();
    if (!ctx) return;

    const now = ctx.currentTime;
    const pan = Math.max(-0.45, Math.min(0.45, panDirection));

    this.triggerSoftHarmonic(ctx, 440.0, pan, 0.024, 0.14);

    if (this.noiseBuffer) {
      const air = this.createSpatialBranch(ctx, pan, false);
      if (air) {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.value = 2.0;
        filter.frequency.setValueAtTime(750, now);

        air.gain.setValueAtTime(0.0001, now);
        air.gain.linearRampToValueAtTime(0.02, now + 0.015);
        air.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

        src.connect(filter);
        filter.connect(air);
        src.start(now);
        src.stop(now + 0.13);
      }
    }
  }
}

export const spatialAudio = new SpatialAudioEngine();

import { createSystem } from '@iwsdk/core';

export class AudioSystem extends createSystem({}) {
  private initialized = false;
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  init() {}

  private ensureAudio() {
    if (this.initialized) return;
    this.initialized = true;
    try {
      this.audioCtx = new AudioContext();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = 0.7;
      this.masterGain.connect(this.audioCtx.destination);

      // Ambient drone
      const drone = this.audioCtx.createOscillator();
      drone.type = 'sine';
      drone.frequency.value = 55;
      const droneGain = this.audioCtx.createGain();
      droneGain.gain.value = 0.04;
      drone.connect(droneGain);
      droneGain.connect(this.masterGain);
      drone.start();

      const drone2 = this.audioCtx.createOscillator();
      drone2.type = 'triangle';
      drone2.frequency.value = 82.5;
      const drone2Gain = this.audioCtx.createGain();
      drone2Gain.gain.value = 0.02;
      drone2.connect(drone2Gain);
      drone2Gain.connect(this.masterGain);
      drone2.start();
    } catch {}
  }

  playDrop(colorIdx: number) {
    this.ensureAudio();
    if (!this.audioCtx || !this.masterGain) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const freqs = [523, 587, 659, 698, 784];
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freqs[colorIdx % freqs.length];
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25, now);
    g.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  playMatch(count: number) {
    this.ensureAudio();
    if (!this.audioCtx || !this.masterGain) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const baseFreq = 440 + count * 80;
    for (let i = 0; i < Math.min(count, 5); i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = baseFreq + i * 110;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.3, now + i * 0.06);
      g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.06 + 0.25);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.3);
    }
  }

  playMiss() {
    this.ensureAudio();
    if (!this.audioCtx || !this.masterGain) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.linearRampToValueAtTime(80, now + 0.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.15, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  playClick() {
    this.ensureAudio();
    if (!this.audioCtx || !this.masterGain) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 1000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.15, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  playCombo() {
    this.ensureAudio();
    if (!this.audioCtx || !this.masterGain) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const notes = [523, 659, 784, 1047];
    for (let i = 0; i < notes.length; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = notes[i];
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.2, now + i * 0.08);
      g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.3);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.35);
    }
  }

  playGameOver() {
    this.ensureAudio();
    if (!this.audioCtx || !this.masterGain) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const notes = [392, 330, 262, 196];
    for (let i = 0; i < notes.length; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = notes[i];
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.2, now + i * 0.2);
      g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.2 + 0.4);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(now + i * 0.2);
      osc.stop(now + i * 0.2 + 0.45);
    }
  }

  setVolume(vol: number) {
    if (this.masterGain) this.masterGain.gain.value = vol;
  }

  update() {}
}

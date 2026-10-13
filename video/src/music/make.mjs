// Procedural ambient/electronic bed, rendered offline with Tone.js in headless
// Chromium. Am–F–C–G at 100 bpm: soft pad, sub bass, arpeggiated pulse, gentle
// kick build, fades. No samples, no copyrighted material.
// usage: node src/music/make.mjs <seconds> <out.wav> [--build=<sec>] [--drop=<sec>] [--duck=t1,t2,...] [--seed=n]
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const [, , secArg, out, ...rest] = process.argv;
const opts = Object.fromEntries(rest.map((a) => a.replace(/^--/, '').split('=')));
const seconds = parseFloat(secArg || '60');
const cfg = {
  seconds,
  build: parseFloat(opts.build ?? Math.min(12, seconds * 0.12)), // when the pulse starts
  kick: parseFloat(opts.kick ?? seconds * 0.3), // when the kick comes in
  drop: parseFloat(opts.drop ?? Math.max(0, seconds - 9)), // kick/pulse stop, pad rings out
  duck: (opts.duck ? opts.duck.split(',').map(Number) : []),
  bpm: parseFloat(opts.bpm ?? 100),
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');
await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js' });
const b64 = await page.evaluate(async (cfg) => {
  const T = window.Tone;
  const buf = await T.Offline(async ({ transport }) => {
    transport.bpm.value = cfg.bpm;
    const master = new T.Gain(0).toDestination();
    // fade in / fade out
    master.gain.setValueAtTime(0, 0);
    master.gain.linearRampToValueAtTime(0.9, 3.5);
    master.gain.setValueAtTime(0.9, cfg.seconds - 4);
    master.gain.linearRampToValueAtTime(0, cfg.seconds - 0.05);
    // ducking
    const duck = new T.Gain(1).connect(master);
    for (const t of cfg.duck) {
      duck.gain.setValueAtTime(1, Math.max(0, t - 0.3));
      duck.gain.linearRampToValueAtTime(0.45, t);
      duck.gain.setValueAtTime(0.45, t + 1.2);
      duck.gain.linearRampToValueAtTime(1, t + 2.2);
    }
    const comp = new T.Compressor(-18, 3).connect(duck);
    const reverb = new T.Reverb({ decay: 7, wet: 0.45, preDelay: 0.03 }).connect(comp);
    await reverb.ready;
    const delay = new T.FeedbackDelay({ delayTime: '8n.', feedback: 0.32, wet: 0.25 }).connect(reverb);

    // Pad
    const padFilter = new T.Filter(900, 'lowpass', -24).connect(reverb);
    const padLfo = new T.LFO(0.07, 600, 1500).start(0);
    padLfo.connect(padFilter.frequency);
    const pad = new T.PolySynth(T.Synth, {
      oscillator: { type: 'fatsawtooth', count: 3, spread: 28 },
      envelope: { attack: 1.6, decay: 0.5, sustain: 0.8, release: 3.5 },
      volume: -19,
    }).connect(padFilter);
    // Sub bass
    const bass = new T.MonoSynth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.3, decay: 0.4, sustain: 0.7, release: 1.5 },
      filterEnvelope: { attack: 0.1, baseFrequency: 120, octaves: 1 },
      volume: -25,
    }).connect(comp);
    // Pulse / arp
    const arpFilter = new T.Filter(700, 'lowpass').connect(delay);
    const arp = new T.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.18, sustain: 0.0, release: 0.2 }, volume: -18 }).connect(arpFilter);
    arpFilter.frequency.setValueAtTime(500, cfg.build);
    arpFilter.frequency.linearRampToValueAtTime(2600, Math.min(cfg.drop, cfg.kick + 20));
    // Kick
    const kick = new T.MembraneSynth({ pitchDecay: 0.03, octaves: 5, envelope: { attack: 0.001, decay: 0.35, sustain: 0 }, volume: -17 }).connect(comp);
    const hat = new T.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0 }, volume: -36 });
    hat.connect(new T.Filter(7000, 'highpass').connect(reverb));

    const chords = [
      ['A3', 'C4', 'E4', 'B4'], // Am(add9)
      ['F3', 'A3', 'C4', 'E4'], // Fmaj7
      ['C4', 'E4', 'G4', 'D5'], // C(add9)
      ['G3', 'B3', 'D4', 'A4'], // G(add9)/sus
    ];
    const roots = ['A1', 'F1', 'C2', 'G1'];
    const beat = 60 / cfg.bpm, bar = beat * 4;
    const nBars = Math.ceil(cfg.seconds / bar);
    for (let i = 0; i < nBars; i++) {
      const t0 = i * bar, c = chords[i % 4];
      pad.triggerAttackRelease(c, bar * 0.98, t0, 0.55);
      if (t0 >= cfg.build * 0.5 && t0 < cfg.seconds - bar) bass.triggerAttackRelease(roots[i % 4], bar * 1.02, t0, 0.7);
      for (let s = 0; s < 8; s++) {
        const t = t0 + s * beat / 2;
        if (t >= cfg.build && t < cfg.drop) {
          const notes = [c[0], c[2], c[1], c[3], c[2], c[1], c[3], c[2]];
          const n = T.Frequency(notes[s]).transpose(12);
          arp.triggerAttackRelease(n, '16n', t, s % 2 ? 0.45 : 0.7);
        }
        if (t >= cfg.kick && t < cfg.drop) {
          if (s % 2 === 0) kick.triggerAttackRelease('A1', '8n', t, 0.8);
          if (s % 2 === 1) hat.triggerAttackRelease('32n', t, 0.6);
        }
      }
    }
  }, cfg.seconds, 2, 44100);
  // encode WAV 16-bit stereo
  const ch = [buf.getChannelData(0), buf.getChannelData(1)];
  const n = ch[0].length, data = new DataView(new ArrayBuffer(44 + n * 4));
  const w = (o, s) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); data.setUint32(4, 36 + n * 4, true); w(8, 'WAVE'); w(12, 'fmt ');
  data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, 2, true);
  data.setUint32(24, 44100, true); data.setUint32(28, 44100 * 4, true); data.setUint16(32, 4, true); data.setUint16(34, 16, true);
  w(36, 'data'); data.setUint32(40, n * 4, true);
  let peak = 0; for (const c of ch) for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(c[i]));
  const g = peak > 0 ? 0.89 / peak : 1;
  for (let i = 0; i < n; i++) for (let k = 0; k < 2; k++) data.setInt16(44 + i * 4 + k * 2, Math.max(-1, Math.min(1, ch[k][i] * g)) * 32767, true);
  const bytes = new Uint8Array(data.buffer); let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}, cfg);
writeFileSync(out, Buffer.from(b64, 'base64'));
await browser.close();
console.log('wrote', out, JSON.stringify(cfg));

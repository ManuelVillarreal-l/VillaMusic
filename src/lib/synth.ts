/**
 * Sintetizador de canciones: compone y renderiza audio WAV directo en el navegador.
 * Así VillaMusic funciona sin archivos de audio y sin problemas de derechos de autor.
 * Mismo "seed" → misma canción, siempre.
 *
 * Solo sintaxis borrable de TypeScript (se puede probar con Node sin compilar).
 */
import type { ScaleName, StyleName, SynthSpec, WaveForm } from '../types';

export const SAMPLE_RATE = 22050;
const TWO_PI = Math.PI * 2;

const SCALES: Record<ScaleName, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
};

const PROGRESSIONS: number[][] = [
  [0, 5, 3, 4],
  [0, 3, 4, 3],
  [5, 3, 0, 4],
  [0, 4, 5, 3],
  [0, 2, 3, 4],
  [3, 4, 0, 0],
];

/** Duración exacta en segundos (se conoce sin tener que renderizar). */
export function durationOf(spec: SynthSpec): number {
  return Math.round((spec.bars * 240) / spec.bpm + 2);
}

// ───────────────────────── utilidades ─────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function degreeToMidi(root: number, scale: number[], degree: number): number {
  const len = scale.length;
  const octave = Math.floor(degree / len);
  const idx = ((degree % len) + len) % len;
  return root + 12 * octave + scale[idx];
}

function osc(wave: WaveForm, phase: number): number {
  const x = phase - Math.floor(phase);
  switch (wave) {
    case 'sine':
      return Math.sin(TWO_PI * x);
    case 'triangle':
      return 4 * Math.abs(x - 0.5) - 1;
    case 'square':
      return Math.tanh(4 * Math.sin(TWO_PI * x));
    case 'saw': {
      const a = TWO_PI * x;
      return 0.6 * (Math.sin(a) + 0.5 * Math.sin(2 * a) + 0.33 * Math.sin(3 * a) + 0.25 * Math.sin(4 * a));
    }
  }
}

interface NoteOpts {
  wave: WaveForm;
  attack?: number;
  release?: number;
  /** Decaimiento exponencial (pluck). 0 = sostenido. */
  decay?: number;
  vibrato?: number;
}

function note(buf: Float32Array, startSec: number, durSec: number, hz: number, amp: number, o: NoteOpts): void {
  const start = Math.floor(startSec * SAMPLE_RATE);
  const attack = o.attack ?? 0.01;
  const release = o.release ?? 0.12;
  const decay = o.decay ?? 0;
  const vib = o.vibrato ?? 0;
  const len = Math.floor((durSec + release) * SAMPLE_RATE);
  const inc = hz / SAMPLE_RATE;
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const idx = start + i;
    if (idx >= buf.length) break;
    if (idx < 0) continue;
    const t = i / SAMPLE_RATE;
    let env = t < attack ? t / attack : 1;
    if (t > durSec) env *= Math.max(0, 1 - (t - durSec) / release);
    if (decay > 0) env *= Math.exp(-decay * t);
    phase += vib ? inc * (1 + vib * Math.sin(TWO_PI * 5.2 * t)) : inc;
    buf[idx] += osc(o.wave, phase) * env * amp;
  }
}

function kick(buf: Float32Array, startSec: number, amp: number): void {
  const start = Math.floor(startSec * SAMPLE_RATE);
  const len = Math.floor(0.24 * SAMPLE_RATE);
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const idx = start + i;
    if (idx >= buf.length) break;
    const t = i / SAMPLE_RATE;
    phase += (58 + 120 * Math.exp(-t * 30)) / SAMPLE_RATE;
    buf[idx] += Math.sin(TWO_PI * phase) * Math.exp(-t * 10) * amp;
  }
}

function snare(buf: Float32Array, startSec: number, amp: number, rand: () => number): void {
  const start = Math.floor(startSec * SAMPLE_RATE);
  const len = Math.floor(0.2 * SAMPLE_RATE);
  for (let i = 0; i < len; i++) {
    const idx = start + i;
    if (idx >= buf.length) break;
    const t = i / SAMPLE_RATE;
    const n = rand() * 2 - 1;
    buf[idx] += (n * 0.7 + Math.sin(TWO_PI * 190 * t) * 0.5) * Math.exp(-t * 20) * amp;
  }
}

function hat(buf: Float32Array, startSec: number, amp: number, rand: () => number): void {
  const start = Math.floor(startSec * SAMPLE_RATE);
  const len = Math.floor(0.05 * SAMPLE_RATE);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const idx = start + i;
    if (idx >= buf.length) break;
    const t = i / SAMPLE_RATE;
    const n = rand() * 2 - 1;
    buf[idx] += (n - last) * 0.5 * Math.exp(-t * 90) * amp;
    last = n;
  }
}

// ───────────────────────── estilos ─────────────────────────

interface StyleCfg {
  kick: number[];
  snare: number[];
  hat: number[];
  kickAmp: number;
  snareAmp: number;
  hatAmp: number;
  /** Retraso de los pasos impares (fracción de paso de semicorchea). */
  swing: number;
  pad: { wave: WaveForm; amp: number; attack: number; release: number; voices: number } | null;
  stab: { steps: number[]; wave: WaveForm; amp: number; decay: number } | null;
  arp: { every: number; wave: WaveForm; amp: number; decay: number; octave: number } | null;
  bass: { steps: number[]; wave: WaveForm; amp: number; len: number; fifthSteps: number[] };
  melody: { density: number; amp: number; octave: number; vibrato: number; decay: number; release: number } | null;
  echo: { time: number; feedback: number };
}

const STEPS_8TH = [0, 2, 4, 6, 8, 10, 12, 14];
const STEPS_4TH = [0, 4, 8, 12];

const STYLES: Record<StyleName, StyleCfg> = {
  lofi: {
    kick: [0, 10], snare: [4, 12], hat: STEPS_8TH, kickAmp: 0.6, snareAmp: 0.22, hatAmp: 0.14, swing: 0.25,
    pad: { wave: 'triangle', amp: 0.1, attack: 0.08, release: 0.5, voices: 4 },
    stab: null,
    arp: null,
    bass: { steps: [0, 7, 8], wave: 'triangle', amp: 0.5, len: 4, fifthSteps: [] },
    melody: { density: 0.55, amp: 0.17, octave: 12, vibrato: 0.004, decay: 2.4, release: 0.2 },
    echo: { time: 0.375, feedback: 0.35 },
  },
  cumbia: {
    kick: [0, 8], snare: [4, 12], hat: STEPS_8TH, kickAmp: 0.55, snareAmp: 0.2, hatAmp: 0.16, swing: 0.1,
    pad: null,
    stab: { steps: [2, 6, 10, 14], wave: 'triangle', amp: 0.13, decay: 7 },
    arp: null,
    bass: { steps: [0, 6, 8, 14], wave: 'triangle', amp: 0.55, len: 3, fifthSteps: [8, 14] },
    melody: { density: 0.6, amp: 0.13, octave: 12, vibrato: 0.006, decay: 0, release: 0.08 },
    echo: { time: 0.22, feedback: 0.25 },
  },
  ambient: {
    kick: [], snare: [], hat: [], kickAmp: 0, snareAmp: 0, hatAmp: 0, swing: 0,
    pad: { wave: 'sine', amp: 0.15, attack: 0.9, release: 1.6, voices: 3 },
    stab: null,
    arp: { every: 4, wave: 'sine', amp: 0.09, decay: 1.6, octave: 12 },
    bass: { steps: [0], wave: 'sine', amp: 0.45, len: 16, fifthSteps: [] },
    melody: { density: 0.22, amp: 0.1, octave: 12, vibrato: 0.003, decay: 1.2, release: 0.6 },
    echo: { time: 0.55, feedback: 0.5 },
  },
  synthwave: {
    kick: STEPS_4TH, snare: [4, 12], hat: [2, 6, 10, 14], kickAmp: 0.55, snareAmp: 0.22, hatAmp: 0.1, swing: 0,
    pad: { wave: 'saw', amp: 0.07, attack: 0.1, release: 0.4, voices: 3 },
    stab: null,
    arp: { every: 1, wave: 'saw', amp: 0.07, decay: 9, octave: 12 },
    bass: { steps: STEPS_8TH, wave: 'saw', amp: 0.2, len: 1.6, fifthSteps: [] },
    melody: { density: 0.45, amp: 0.12, octave: 12, vibrato: 0.005, decay: 1.5, release: 0.15 },
    echo: { time: 0.3, feedback: 0.4 },
  },
  pop: {
    kick: [0, 8, 10], snare: [4, 12], hat: STEPS_8TH, kickAmp: 0.55, snareAmp: 0.22, hatAmp: 0.12, swing: 0,
    pad: { wave: 'triangle', amp: 0.07, attack: 0.05, release: 0.3, voices: 3 },
    stab: { steps: [0, 6, 8, 14], wave: 'triangle', amp: 0.1, decay: 4 },
    arp: null,
    bass: { steps: [0, 3, 8, 11], wave: 'triangle', amp: 0.5, len: 3, fifthSteps: [] },
    melody: { density: 0.6, amp: 0.15, octave: 12, vibrato: 0.004, decay: 1.2, release: 0.12 },
    echo: { time: 0.25, feedback: 0.25 },
  },
};

interface MotifNote {
  step: number;
  offset: number;
  len: number;
}

/** Motivo melódico de 2 compases (32 semicorcheas) expresado relativo a la raíz del acorde. */
function makeMotif(rand: () => number, density: number): MotifNote[] {
  const notes: MotifNote[] = [];
  let offset = [0, 2, 4][Math.floor(rand() * 3)];
  for (let step = 0; step < 32; step += 2) {
    const strong = step % 8 === 0;
    if (rand() < (strong ? Math.min(1, density + 0.3) : density)) {
      const choices = strong ? [0, 2, 4, 7] : [-1, 0, 1, 2, 3, 4, 5];
      offset =
        rand() < 0.55
          ? choices[Math.floor(rand() * choices.length)]
          : offset + (rand() < 0.5 ? -1 : 1);
      offset = Math.max(-2, Math.min(8, offset));
      const len = [2, 2, 4, 6][Math.floor(rand() * 4)];
      notes.push({ step, offset, len });
      step += len - 2;
    }
  }
  return notes;
}

// ───────────────────────── render ─────────────────────────

export function renderSamples(spec: SynthSpec): Float32Array {
  const rand = mulberry32(spec.seed);
  const cfg = STYLES[spec.style];
  const scale = SCALES[spec.scale];
  const total = durationOf(spec) * SAMPLE_RATE;
  const main = new Float32Array(total);
  const lead = new Float32Array(total);

  const barSec = 240 / spec.bpm;
  const stepSec = barSec / 16;
  const prog = PROGRESSIONS[Math.floor(rand() * PROGRESSIONS.length)];
  const motifA = cfg.melody ? makeMotif(rand, cfg.melody.density) : [];
  const motifB = cfg.melody ? makeMotif(rand, cfg.melody.density) : [];
  const form = [motifA, motifA, motifB, motifA];

  for (let bar = 0; bar < spec.bars; bar++) {
    const t0 = bar * barSec;
    const deg = prog[bar % prog.length];
    const chordMidi = [0, 2, 4, 6].map((o) => degreeToMidi(spec.root, scale, deg + o));
    const at = (step: number) => t0 + step * stepSec + (step % 2 === 1 ? cfg.swing * stepSec : 0);

    // Pads
    if (cfg.pad) {
      for (let v = 0; v < cfg.pad.voices; v++) {
        note(main, t0, barSec * 0.98, midiToHz(chordMidi[v]), cfg.pad.amp, {
          wave: cfg.pad.wave, attack: cfg.pad.attack, release: cfg.pad.release,
        });
      }
    }

    // Bajo
    const bassRoot = degreeToMidi(spec.root - 12, scale, deg);
    const bassFifth = degreeToMidi(spec.root - 12, scale, deg + 4);
    for (const step of cfg.bass.steps) {
      const m = cfg.bass.fifthSteps.includes(step) ? bassFifth : bassRoot;
      note(main, at(step), cfg.bass.len * stepSec, midiToHz(m), cfg.bass.amp, {
        wave: cfg.bass.wave, attack: 0.008, release: 0.08, decay: cfg.bass.wave === 'saw' ? 3 : 0,
      });
    }

    // Acordes cortos (guitarra / piano)
    if (cfg.stab) {
      for (const step of cfg.stab.steps) {
        for (let v = 0; v < 3; v++) {
          note(main, at(step) + v * 0.006, stepSec * 3, midiToHz(chordMidi[v] + 12), cfg.stab.amp, {
            wave: cfg.stab.wave, attack: 0.004, release: 0.1, decay: cfg.stab.decay,
          });
        }
      }
    }

    // Arpegio
    if (cfg.arp) {
      const order = [0, 1, 2, 1];
      for (let step = 0, n = 0; step < 16; step += cfg.arp.every, n++) {
        const m = chordMidi[order[n % order.length]] + cfg.arp.octave;
        note(lead, at(step), stepSec * cfg.arp.every * 0.9, midiToHz(m), cfg.arp.amp, {
          wave: cfg.arp.wave, attack: 0.004, release: 0.08, decay: cfg.arp.decay,
        });
      }
    }

    // Melodía (el primer compás es introducción)
    if (cfg.melody && bar > 0) {
      const motif = form[Math.floor(bar / 2) % form.length];
      const half = bar % 2;
      for (const n of motif) {
        if (Math.floor(n.step / 16) !== half) continue;
        const step = n.step % 16;
        const m = degreeToMidi(spec.root + cfg.melody.octave, scale, deg + n.offset);
        note(lead, at(step), n.len * stepSec * 0.92, midiToHz(m), cfg.melody.amp, {
          wave: spec.lead, attack: 0.012, release: cfg.melody.release,
          decay: cfg.melody.decay, vibrato: cfg.melody.vibrato,
        });
      }
    }

    // Batería
    for (const step of cfg.kick) kick(main, at(step), cfg.kickAmp);
    for (const step of cfg.snare) snare(main, at(step), cfg.snareAmp, rand);
    for (const step of cfg.hat) hat(main, at(step), cfg.hatAmp, rand);
  }

  // Eco sobre el canal "lead" (retroalimentación)
  const delay = Math.floor(cfg.echo.time * SAMPLE_RATE);
  for (let i = delay; i < total; i++) lead[i] += lead[i - delay] * cfg.echo.feedback;

  // Mezcla, normalización y fundidos
  const out = new Float32Array(total);
  let peak = 0;
  for (let i = 0; i < total; i++) {
    const v = main[i] + lead[i];
    out[i] = v;
    const a = Math.abs(v);
    if (a > peak) peak = a;
  }
  const gain = peak > 0 ? 0.85 / peak : 1;
  const fadeIn = Math.floor(0.02 * SAMPLE_RATE);
  const fadeOutLen = Math.floor(1.5 * SAMPLE_RATE);
  for (let i = 0; i < total; i++) {
    let v = Math.tanh(out[i] * gain * 1.15);
    if (i < fadeIn) v *= i / fadeIn;
    const fromEnd = total - i;
    if (fromEnd < fadeOutLen) v *= fromEnd / fadeOutLen;
    out[i] = v;
  }
  return out;
}

export function encodeWav(samples: Float32Array): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  write(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.round(s * 32767), true);
  }
  return bytes;
}

/** Compone y devuelve la canción como Blob WAV listo para un <audio>. */
export function renderSong(spec: SynthSpec): Blob {
  return new Blob([encodeWav(renderSamples(spec)) as BlobPart], { type: 'audio/wav' });
}

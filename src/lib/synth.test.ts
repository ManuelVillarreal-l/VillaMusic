// Ejecutar con:  npm test   (Node 22+, sin instalar nada extra)
import assert from 'node:assert/strict';
import { SAMPLE_RATE, durationOf, encodeWav, renderSamples } from './synth.ts';
import type { SynthSpec } from '../types';

console.log('Sintetizador');

const base: SynthSpec = { seed: 42, bpm: 90, root: 57, scale: 'dorian', style: 'lofi', lead: 'triangle', bars: 8 };
const styles = ['lofi', 'cumbia', 'ambient', 'synthwave', 'pop'] as const;
let passed = 0;

for (const style of styles) {
  const spec: SynthSpec = { ...base, style, lead: style === 'synthwave' ? 'saw' : 'square' };
  const samples = renderSamples(spec);
  let peak = 0;
  let energy = 0;
  let bad = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i];
    if (!Number.isFinite(v)) bad++;
    peak = Math.max(peak, Math.abs(v));
    energy += v * v;
  }
  assert.equal(samples.length, durationOf(spec) * SAMPLE_RATE, `${style}: duración exacta`);
  assert.equal(bad, 0, `${style}: sin NaN/Infinity`);
  assert.ok(peak <= 1 && peak > 0.3, `${style}: nivel sano (pico ${peak.toFixed(2)})`);
  assert.ok(Math.sqrt(energy / samples.length) > 0.03, `${style}: no es silencio`);
  passed++;
  console.log(`  ✓ ${style}: ${durationOf(spec)} s, pico ${peak.toFixed(2)}`);
}

{
  const a = renderSamples(base);
  const b = renderSamples(base);
  const c = renderSamples({ ...base, seed: 43 });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  passed++;
  console.log('  ✓ mismo seed = misma canción · otro seed = otra canción');
}

{
  const wav = encodeWav(renderSamples(base));
  const text = (o: number, n: number) => String.fromCharCode(...wav.slice(o, o + n));
  const view = new DataView(wav.buffer);
  assert.equal(text(0, 4), 'RIFF');
  assert.equal(text(8, 4), 'WAVE');
  assert.equal(view.getUint32(24, true), SAMPLE_RATE);
  assert.equal(view.getUint32(40, true), wav.length - 44);
  passed++;
  console.log('  ✓ cabecera WAV válida');
}

console.log(`\n${passed} pruebas OK`);

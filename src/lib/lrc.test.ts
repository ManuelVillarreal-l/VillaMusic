import assert from 'node:assert/strict';
import { activeLine, cleanTrack, parseLrc } from './lrc.ts';

console.log('Letras (LRC)');
let passed = 0;
const ok = (n: string) => { passed++; console.log(`  ✓ ${n}`); };

const lines = parseLrc('[ar:Alguien]\n[00:12.50] Hola mundo\n[00:05.00]Primera\n[01:02.3][02:00.00] Coro\n[03:00]\nbasura sin tiempo');
assert.deepEqual(lines.map((l) => l.t), [5, 12.5, 62.3, 120, 180]);
assert.equal(lines[0].text, 'Primera');
assert.equal(lines[2].text, 'Coro');
assert.equal(lines[3].text, 'Coro');
ok('lee tiempos, ordena, repite sellos múltiples e ignora metadatos');

assert.equal(activeLine(lines, 0), -1);
assert.equal(activeLine(lines, 5), 0);
assert.equal(activeLine(lines, 12.49), 0);
assert.equal(activeLine(lines, 12.5), 1);
assert.equal(activeLine(lines, 9999), 4);
assert.equal(activeLine([], 3), -1);
ok('línea activa por búsqueda binaria (bordes incluidos)');

let big = ''; for (let i = 0; i < 5000; i++) big += `[${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}.00] l${i}\n`;
const L = parseLrc(big);
const t0 = performance.now();
for (let i = 0; i < 20000; i++) activeLine(L, (i * 7) % 5000);
assert.ok(performance.now() - t0 < 200);
ok('rápida incluso con 5000 líneas');

assert.deepEqual(cleanTrack('Karol G - Tusa (Official Video)', 'KarolGVEVO'), { artist: 'Karol G', title: 'Tusa' });
assert.deepEqual(cleanTrack('Vivir Mi Vida [Letra/Lyrics]', 'Marc Anthony - Topic'), { artist: 'Marc Anthony', title: 'Vivir Mi Vida' });
assert.deepEqual(cleanTrack('La Bicicleta', 'Carlos Vives'), { artist: 'Carlos Vives', title: 'La Bicicleta' });
ok('limpia títulos de YouTube');
console.log(`\n${passed} pruebas OK`);

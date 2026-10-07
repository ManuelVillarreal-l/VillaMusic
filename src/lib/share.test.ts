import assert from 'node:assert/strict';
import { compact, decodeShare, encodeShare, sanitizeEntry } from './share.ts';
import type { Song } from '../types';

console.log('Compartir por enlace');
let passed = 0;
const ok = (name: string) => { passed++; console.log(`  ✓ ${name}`); };
const hue = () => 10;

const yt: Song = { id: 'y-dQw4w9WgXcQ', title: 'Canción ñandú', artist: 'Canal', album: 'YouTube', genre: 'YouTube', duration: 213, hue: 5, kind: 'youtube', videoId: 'dQw4w9WgXcQ', artwork: 'https://i.ytimg.com/vi/x/mq.jpg' };
const upl: Song = { id: 'u-1', title: 'Mía', artist: 'x', album: 'x', genre: 'x', duration: 5, hue: 1, kind: 'upload' };
const cat = new Set(['c01']);

assert.equal(compact({ ...yt, id: 'c01', kind: 'synth' } as Song, cat), 'c01');
assert.equal(compact(upl, cat), null);
ok('catálogo viaja solo con su id; las subidas no se comparten');

{
  const payload = { n: 'Mi lista ✨', e: ['c01', compact(yt, cat)!] };
  const text = await encodeShare(payload);
  assert.match(text, /^[zr][\w-]+$/);
  assert.ok(!/[+/=#]/.test(text), 'seguro para URL');
  assert.deepEqual(await decodeShare(text), payload);
  ok('ida y vuelta con tildes y emojis');
}
{
  const big = { n: 'x', e: Array.from({ length: 40 }, (_, i) => compact({ ...yt, id: `y-${i}${'a'.repeat(9)}`, videoId: `${String(i).padStart(2, '0')}abcdefghi`, title: `Canción número ${i} de la lista` }, cat)!) };
  const t = await encodeShare(big);
  assert.ok(t.length < 6000, `enlace razonable (${t.length})`);
  ok(`40 canciones caben en ${t.length} caracteres`);
}
assert.equal(await decodeShare('zxxxx'), null);
assert.equal(await decodeShare(''), null);
assert.equal(await decodeShare('q' + 'A'.repeat(30)), null);
assert.equal(await decodeShare('r' + btoa('"hola"')), null);
ok('enlaces dañados o ajenos se rechazan sin romper');

{
  const bad = sanitizeEntry({ i: 'x1', t: 'T', a: 'A', k: 'web', s: 'https://evil.example/malo.mp3', p: 'http://audio-ssl.itunes.apple.com/x.m4a', w: 'javascript:alert(1)' }, hue);
  assert.equal(bad, null, 'sin fuente válida no hay canción');
  const mix = sanitizeEntry({ i: 'x2', t: 'T', a: 'A', k: 'web', s: 'https://evil.example/malo.mp3', p: 'https://audio-ssl.itunes.apple.com/x.m4a', w: 'https://evil.example/x.png' }, hue)!;
  assert.equal(mix.streamUrl, undefined);
  assert.equal(mix.artwork, undefined);
  assert.equal(mix.previewUrl, 'https://audio-ssl.itunes.apple.com/x.m4a');
  const good = sanitizeEntry({ i: 'abc', t: 'Bien', a: 'A', k: 'web', s: 'https://api.audius.co/v1/tracks/abc/stream?app_name=VillaMusic' }, hue)!;
  assert.ok(good.streamUrl);
  assert.equal(sanitizeEntry({ i: 'q', t: 'T', k: 'youtube', v: 'corto' }, hue), null);
  assert.equal(sanitizeEntry({ i: 'q', t: 'T', k: 'youtube', v: 'dQw4w9WgXcQ' }, hue)!.videoId, 'dQw4w9WgXcQ');
  assert.equal(sanitizeEntry({ i: 'q', t: '<img onerror=x>', k: 'youtube', v: 'dQw4w9WgXcQ' }, hue)!.title, '<img onerror=x>', 'el texto se guarda tal cual (React lo escapa)');
  assert.equal(sanitizeEntry({ k: 'web' }, hue), null);
  assert.equal(sanitizeEntry('c01', hue), null);
  ok('URLs ajenas, http y javascript: se descartan; ids de video malformados también');
}
console.log(`\n${passed} pruebas OK`);

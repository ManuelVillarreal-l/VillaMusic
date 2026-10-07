import type { Song } from '../types';

/**
 * Compartir una playlist por enlace: todo viaja dentro de la URL (#share=…), sin servidor.
 * Las canciones del catálogo viajan solo con su id; las de la web, con sus datos mínimos.
 * Lo que llega por un enlace NO es de confianza: cada campo se valida antes de usarse.
 */
export interface CompactSong {
  i: string; // id
  t: string; // título
  a: string; // artista
  b?: string; // álbum
  g?: string; // género
  d?: number; // duración
  k: 'web' | 'youtube';
  v?: string; // videoId
  s?: string; // streamUrl
  p?: string; // previewUrl
  w?: string; // portada
  q?: string; // ytQuery
}
export type ShareEntry = string | CompactSong;
export interface SharePayload {
  n: string;
  e: ShareEntry[];
}

const MAX_SONGS = 100;

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

export function compact(song: Song, catalogIds: Set<string>): ShareEntry | null {
  if (catalogIds.has(song.id)) return song.id;
  if (song.kind !== 'web' && song.kind !== 'youtube') return null; // las subidas viven solo en tu navegador
  const c: CompactSong = { i: song.id, t: song.title, a: song.artist, k: song.kind };
  if (song.album) c.b = song.album;
  if (song.genre) c.g = song.genre;
  if (song.duration) c.d = song.duration;
  if (song.videoId) c.v = song.videoId;
  if (song.streamUrl) c.s = song.streamUrl;
  if (song.previewUrl) c.p = song.previewUrl;
  if (song.artwork) c.w = song.artwork;
  if (song.ytQuery) c.q = song.ytQuery;
  return c;
}

export async function encodeShare(payload: SharePayload): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(payload));
  if (typeof CompressionStream === 'undefined') return 'r' + toBase64Url(raw);
  return 'z' + toBase64Url(await pipe(raw, new CompressionStream('deflate-raw')));
}

export async function decodeShare(text: string): Promise<SharePayload | null> {
  try {
    if (text.length > 60_000) return null;
    const mode = text[0];
    const bytes = fromBase64Url(text.slice(1));
    const raw = mode === 'z' ? await pipe(bytes, new DecompressionStream('deflate-raw')) : mode === 'r' ? bytes : null;
    if (!raw) return null;
    const data = JSON.parse(new TextDecoder().decode(raw)) as unknown;
    if (!data || typeof data !== 'object') return null;
    const { n, e } = data as { n?: unknown; e?: unknown };
    if (typeof n !== 'string' || !Array.isArray(e)) return null;
    return { n: n.slice(0, 60), e: e.slice(0, MAX_SONGS) as ShareEntry[] };
  } catch {
    return null;
  }
}

// ───────── validación de lo que llega por el enlace ─────────

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');

function safeUrl(v: unknown, hosts: RegExp): string | undefined {
  if (typeof v !== 'string' || v.length > 600) return undefined;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && hosts.test(u.hostname) ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

const STREAM_HOSTS = /^api\.audius\.co$/;
const PREVIEW_HOSTS = /(^|\.)(mzstatic\.com|itunes\.apple\.com)$/;
const ART_HOSTS = /(^|\.)(mzstatic\.com|ytimg\.com|audius\.co|audius\.org|googleusercontent\.com|cloudflare-ipfs\.com|ipfs\.io)$/;

/** Convierte una entrada del enlace en una canción segura, o null si no sirve. */
export function sanitizeEntry(entry: unknown, hue: (id: string) => number): Song | null {
  if (!entry || typeof entry !== 'object') return null;
  const c = entry as Partial<CompactSong>;
  const id = str(c.i, 60);
  const title = str(c.t, 140).trim();
  if (!id || !title || (c.k !== 'web' && c.k !== 'youtube')) return null;
  const videoId = typeof c.v === 'string' && /^[\w-]{11}$/.test(c.v) ? c.v : undefined;
  const streamUrl = safeUrl(c.s, STREAM_HOSTS);
  const previewUrl = safeUrl(c.p, PREVIEW_HOSTS);
  const ytQuery = str(c.q, 160) || undefined;
  if (c.k === 'youtube' && !videoId) return null;
  if (c.k === 'web' && !streamUrl && !previewUrl && !videoId && !ytQuery) return null;
  const d = Number(c.d);
  return {
    id: `${c.k === 'youtube' ? 'y' : 'w'}-${id.replace(/[^\w-]/g, '').slice(0, 40)}`,
    title,
    artist: str(c.a, 100) || 'Artista desconocido',
    album: str(c.b, 100) || 'Compartida',
    genre: str(c.g, 40) || 'Música',
    duration: Number.isFinite(d) && d > 0 && d < 36000 ? Math.round(d) : 0,
    hue: hue(id),
    kind: c.k,
    videoId,
    streamUrl,
    previewUrl,
    artwork: safeUrl(c.w, ART_HOSTS),
    ytQuery,
  };
}

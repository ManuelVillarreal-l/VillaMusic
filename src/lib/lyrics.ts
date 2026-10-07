import type { Song } from '../types';
import { cleanTrack, parseLrc } from './lrc';
import type { LyricLine } from './lrc';

/** Letras desde LRCLIB (https://lrclib.net): gratis, sin llave, con letras sincronizadas. */
export type Lyrics =
  | { kind: 'synced'; lines: LyricLine[] }
  | { kind: 'plain'; text: string }
  | { kind: 'none' }
  | { kind: 'instrumental' };

interface Hit {
  trackName?: string;
  artistName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

const cache = new Map<string, Lyrics>();

async function search(params: Record<string, string>, signal?: AbortSignal): Promise<Hit[]> {
  const res = await fetch(`https://lrclib.net/api/search?${new URLSearchParams(params).toString()}`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as Hit[];
}

function pick(hits: Hit[], duration: number): Hit | undefined {
  const usable = hits.filter((h) => h.syncedLyrics || h.plainLyrics);
  if (duration > 60) {
    const close = usable.find((h) => h.syncedLyrics && Math.abs((h.duration ?? 0) - duration) <= 6);
    if (close) return close;
  }
  return usable.find((h) => h.syncedLyrics) ?? usable[0];
}

export async function fetchLyrics(song: Song, signal?: AbortSignal): Promise<Lyrics> {
  if (song.kind === 'synth') return { kind: 'instrumental' };
  const hit0 = cache.get(song.id);
  if (hit0) return hit0;

  const isUpload = song.kind === 'upload';
  const named = song.videoId ? cleanTrack(song.title, song.artist) : { artist: isUpload ? '' : song.artist, title: song.title };
  const title = named.title;
  const artist = named.artist;
  const duration = song.videoId || isUpload ? song.duration : song.kind === 'web' && song.previewUrl && !song.streamUrl ? 0 : song.duration;

  let hits = await search(artist ? { track_name: title, artist_name: artist } : { track_name: title }, signal);
  if (hits.length === 0) hits = await search({ q: `${artist} ${title}`.trim() }, signal);

  const best = pick(hits, duration);
  let out: Lyrics = { kind: 'none' };
  if (best?.syncedLyrics) {
    const lines = parseLrc(best.syncedLyrics);
    if (lines.length) out = { kind: 'synced', lines };
  }
  if (out.kind === 'none' && best?.plainLyrics) out = { kind: 'plain', text: best.plainLyrics };
  if (out.kind === 'none' && hits.some((h) => h.instrumental)) out = { kind: 'instrumental' };
  cache.set(song.id, out);
  return out;
}

import type { Song } from '../types';
import { searchSongs } from './itunes';
import { hash } from './utils';

export class DjUnavailable extends Error {}
export class DjBusy extends Error {}

export interface DjPlan {
  name: string;
  description: string;
  tracks: { artist: string; title: string }[];
}

/** Pide al servidor (Claude) una lista de canciones reales para lo que escribió la persona. */
export async function askDj(prompt: string, signal?: AbortSignal): Promise<DjPlan> {
  let res: Response;
  try {
    res = await fetch('/api/dj', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt }),
      signal,
    });
  } catch (err) {
    if ((err as { name?: string }).name === 'AbortError') throw err;
    throw new DjUnavailable('sin servidor');
  }
  const isJson = (res.headers.get('content-type') ?? '').includes('json');
  if (!isJson || res.status === 404 || res.status === 405 || res.status === 500) throw new DjUnavailable('sin servidor');
  if (res.status === 429) throw new DjBusy('límite');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as Partial<DjPlan>;
  if (!Array.isArray(data.tracks) || data.tracks.length === 0) throw new Error('vacío');
  return { name: String(data.name ?? 'Playlist del DJ'), description: String(data.description ?? ''), tracks: data.tracks };
}

/**
 * Convierte cada canción sugerida en una canción de VillaMusic: portada y datos desde iTunes
 * (gratis, sin cuota) y `ytQuery` para que se reproduzca completa desde YouTube al darle play.
 */
export async function resolveTracks(tracks: DjPlan['tracks'], signal?: AbortSignal): Promise<Song[]> {
  const found = await Promise.all(
    tracks.map(async (t) => {
      const query = `${t.artist} ${t.title}`;
      let base: Song | undefined;
      try {
        base = (await searchSongs(query, signal, 1))[0];
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') throw err;
      }
      if (base) return { ...base, title: base.title || t.title, ytQuery: query, duration: 0 };
      const id = `w-dj-${hash(query).toString(36)}`;
      const fallback: Song = {
        id,
        title: t.title,
        artist: t.artist,
        album: 'DJ VillaMusic',
        genre: 'Música',
        duration: 0,
        hue: hash(id) % 360,
        kind: 'web',
        ytQuery: query,
      };
      return fallback;
    }),
  );
  const seen = new Set<string>();
  return found.filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));
}

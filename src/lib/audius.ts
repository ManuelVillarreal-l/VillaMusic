import type { Song } from '../types';
import { hash } from './utils';

/**
 * Audius: plataforma abierta de música con canciones COMPLETAS, gratis y sin llave.
 * Documentación: https://docs.audius.org
 */
const API = 'https://api.audius.co/v1';
const APP = 'VillaMusic';

interface AudiusTrack {
  id?: string;
  title?: string;
  duration?: number;
  genre?: string;
  is_streamable?: boolean;
  artwork?: Record<string, string> | null;
  user?: { name?: string };
}

export function toSong(t: AudiusTrack): Song | null {
  if (!t.id || !t.title || t.is_streamable === false) return null;
  const id = `a-${t.id}`;
  return {
    id,
    title: t.title,
    artist: t.user?.name ?? 'Artista independiente',
    album: 'Audius',
    genre: t.genre || 'Música',
    duration: Math.round(t.duration ?? 0),
    hue: hash(id) % 360,
    kind: 'web',
    streamUrl: `${API}/tracks/${t.id}/stream?app_name=${APP}`,
    artwork: t.artwork?.['480x480'] ?? t.artwork?.['150x150'],
  };
}

export async function searchAudius(term: string, signal?: AbortSignal): Promise<Song[]> {
  const q = new URLSearchParams({ query: term, app_name: APP, limit: '30' });
  const res = await fetch(`${API}/tracks/search?${q.toString()}`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { data?: AudiusTrack[] };
  const out: Song[] = [];
  for (const t of json.data ?? []) {
    const s = toSong(t);
    if (s) out.push(s);
  }
  return out;
}

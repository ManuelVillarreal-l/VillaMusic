import type { Song } from '../types';
import { hash } from './utils';

/**
 * Búsqueda de música real con la API pública de iTunes (sin llave, gratis).
 * Devuelve portada, artista, álbum y un fragmento de audio de 30 s por canción.
 */
const ENDPOINT = 'https://itunes.apple.com/search';

interface ITunesTrack {
  kind?: string;
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  primaryGenreName?: string;
  previewUrl?: string;
  artworkUrl100?: string;
}

function url(term: string, extra = ''): string {
  const q = new URLSearchParams({ term, media: 'music', entity: 'song', limit: '30', country: 'CO' });
  return `${ENDPOINT}?${q.toString()}${extra}`;
}

/** Respaldo por si el navegador bloquea el fetch (iTunes soporta JSONP). */
function jsonp(src: string, signal?: AbortSignal): Promise<{ results?: ITunesTrack[] }> {
  return new Promise((resolve, reject) => {
    const cb = `__vm_${Math.random().toString(36).slice(2)}`;
    const w = window as unknown as Record<string, unknown>;
    const script = document.createElement('script');
    const done = () => {
      clearTimeout(timer);
      delete w[cb];
      script.remove();
    };
    const timer = setTimeout(() => {
      done();
      reject(new Error('Tiempo agotado'));
    }, 9000);
    w[cb] = (data: { results?: ITunesTrack[] }) => {
      done();
      resolve(data);
    };
    script.onerror = () => {
      done();
      reject(new Error('No se pudo conectar'));
    };
    signal?.addEventListener('abort', () => {
      done();
      reject(new DOMException('Cancelado', 'AbortError'));
    });
    script.src = `${src}&callback=${cb}`;
    document.head.appendChild(script);
  });
}

export function toSong(t: ITunesTrack): Song | null {
  if (!t.trackId || !t.previewUrl || !t.trackName) return null;
  const id = `w-${t.trackId}`;
  return {
    id,
    title: t.trackName,
    artist: t.artistName ?? 'Artista desconocido',
    album: t.collectionName ?? 'Sencillo',
    genre: t.primaryGenreName ?? 'Música',
    duration: 30,
    hue: hash(id) % 360,
    kind: 'web',
    previewUrl: t.previewUrl,
    artwork: t.artworkUrl100?.replace('100x100', '300x300'),
  };
}

export async function searchSongs(term: string, signal?: AbortSignal): Promise<Song[]> {
  let data: { results?: ITunesTrack[] };
  try {
    const res = await fetch(url(term), { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = (await res.json()) as { results?: ITunesTrack[] };
  } catch (err) {
    if ((err as { name?: string }).name === 'AbortError') throw err;
    data = await jsonp(url(term), signal);
  }
  const seen = new Set<string>();
  const out: Song[] = [];
  for (const t of data.results ?? []) {
    const s = toSong(t);
    if (s && !seen.has(s.id)) {
      seen.add(s.id);
      out.push(s);
    }
  }
  return out;
}

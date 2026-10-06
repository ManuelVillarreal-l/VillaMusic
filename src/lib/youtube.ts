import type { Song } from '../types';
import { hash } from './utils';

/**
 * Búsqueda en YouTube con la API oficial (YouTube Data API v3).
 * Necesita una llave gratuita que cada persona pega en la app; se guarda solo en su navegador.
 */
const KEY_STORAGE = 'villamusic:yt-key';

export function getYouTubeKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

export function setYouTubeKey(key: string): void {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key);
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* sin almacenamiento */
  }
}

export class YouTubeKeyError extends Error {}
/** El servidor de la app no está disponible (por ejemplo, en desarrollo local sin Vercel). */
export class YouTubeNoServer extends Error {}
/** Se agotó la cuota diaria de búsquedas de YouTube. */
export class YouTubeQuota extends Error {}

/** "PT1H2M3S" → segundos. */
export function parseIsoDuration(iso: string): number {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return 0;
  const [d, h, min, s] = [m[1], m[2], m[3], m[4]].map((x) => Number(x ?? 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}

function decode(html: string): string {
  const el = document.createElement('textarea');
  el.innerHTML = html;
  return el.value;
}

interface SearchItem {
  id?: { videoId?: string };
  snippet?: { title?: string; channelTitle?: string; thumbnails?: Record<string, { url: string }> };
}

async function call<T>(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`https://www.googleapis.com/youtube/v3/${path}?${new URLSearchParams(params).toString()}`, { signal });
  if (!res.ok) {
    if (res.status === 400 || res.status === 403) throw new YouTubeKeyError(`HTTP ${res.status}`);
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

interface ServerItem {
  videoId: string;
  title: string;
  channel: string;
  thumb?: string;
  duration: number;
}

function toSong(i: { videoId: string; title: string; channel: string; thumb?: string; duration: number }): Song {
  const id = `y-${i.videoId}`;
  return {
    id,
    title: decode(i.title),
    artist: decode(i.channel).replace(/ - Topic$/, ''),
    album: 'YouTube',
    genre: 'YouTube',
    duration: i.duration,
    hue: hash(id) % 360,
    kind: 'youtube',
    videoId: i.videoId,
    artwork: i.thumb,
  };
}

/** Búsqueda a través del servidor de la app (la clave nunca sale del servidor). */
async function searchViaServer(term: string, signal?: AbortSignal): Promise<Song[]> {
  let res: Response;
  try {
    res = await fetch(`/api/youtube-search?q=${encodeURIComponent(term)}`, { signal });
  } catch (err) {
    if ((err as { name?: string }).name === 'AbortError') throw err;
    throw new YouTubeNoServer('sin servidor');
  }
  const isJson = (res.headers.get('content-type') ?? '').includes('json');
  if (!isJson || res.status === 404 || res.status === 500) throw new YouTubeNoServer('sin servidor');
  if (res.status === 503) throw new YouTubeQuota('cuota');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { items?: ServerItem[] };
  return (data.items ?? []).map(toSong);
}

export async function searchYouTube(term: string, key: string, signal?: AbortSignal): Promise<Song[]> {
  if (!key) return searchViaServer(term, signal);
  const found = await call<{ items?: SearchItem[] }>(
    'search',
    { part: 'snippet', type: 'video', videoCategoryId: '10', videoEmbeddable: 'true', maxResults: '25', q: term, key },
    signal,
  );
  const items = (found.items ?? []).filter((i) => i.id?.videoId && i.snippet?.title);
  if (items.length === 0) return [];
  const ids = items.map((i) => i.id?.videoId as string);
  const details = await call<{ items?: { id: string; contentDetails?: { duration?: string } }[] }>(
    'videos',
    { part: 'contentDetails', id: ids.join(','), key },
    signal,
  );
  const dur = new Map((details.items ?? []).map((v) => [v.id, parseIsoDuration(v.contentDetails?.duration ?? '')]));
  return items.map((i) => {
    const videoId = i.id?.videoId as string;
    const id = `y-${videoId}`;
    const thumbs = i.snippet?.thumbnails ?? {};
    return {
      id,
      title: decode(i.snippet?.title ?? ''),
      artist: decode(i.snippet?.channelTitle ?? 'YouTube').replace(/ - Topic$/, ''),
      album: 'YouTube',
      genre: 'YouTube',
      duration: dur.get(videoId) ?? 0,
      hue: hash(id) % 360,
      kind: 'youtube' as const,
      videoId,
      artwork: (thumbs.medium ?? thumbs.default)?.url,
    };
  });
}

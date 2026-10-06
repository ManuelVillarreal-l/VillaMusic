import type { Song } from '../types';
import { renderSong } from './synth';
import { loadBlob } from './db';

const MAX_CACHED = 14;
/** Orden de inserción = orden de uso reciente (LRU simple). */
const urls = new Map<string, string>();

function remember(id: string, url: string) {
  urls.delete(id);
  urls.set(id, url);
  while (urls.size > MAX_CACHED) {
    const oldest = urls.keys().next().value as string;
    URL.revokeObjectURL(urls.get(oldest) as string);
    urls.delete(oldest);
  }
}

/** Devuelve una URL reproducible para la canción (la compone o la lee de IndexedDB). */
export async function getSongUrl(song: Song): Promise<string> {
  // Canciones completas de la web: el navegador las transmite directo (sin descargarlas enteras).
  if (song.kind === 'web' && song.streamUrl) return song.streamUrl;
  const hit = urls.get(song.id);
  if (hit) {
    remember(song.id, hit);
    return hit;
  }
  let blob: Blob | undefined;
  if (song.kind === 'synth' && song.spec) {
    // Cede el hilo un instante para que la interfaz pinte el estado "cargando".
    await new Promise((r) => setTimeout(r, 16));
    blob = renderSong(song.spec);
  } else if (song.kind === 'web' && song.previewUrl) {
    const res = await fetch(song.previewUrl);
    if (!res.ok) throw new Error('No se pudo descargar la vista previa');
    blob = await res.blob();
  } else {
    blob = await loadBlob(song.id);
  }
  if (!blob) throw new Error('No se encontró el audio de esta canción');
  const url = URL.createObjectURL(blob);
  remember(song.id, url);
  return url;
}

/** Prepara en segundo plano la siguiente canción para que arranque al instante. */
export function prefetchSong(song: Song): void {
  if (song.kind === 'youtube') return;
  if (urls.has(song.id)) return;
  const run = () => void getSongUrl(song).catch(() => undefined);
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 2500 });
  else setTimeout(run, 400);
}

export function forgetSongUrl(id: string): void {
  const url = urls.get(id);
  if (url) URL.revokeObjectURL(url);
  urls.delete(id);
}

import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import type { Song } from '../types';
import { CATALOG } from '../lib/catalog';
import { decodeShare, sanitizeEntry } from '../lib/share';
import { hash } from '../lib/utils';
import { Dialog } from './Dialog';
import { Cover } from './Cover';

/** Si alguien abre un enlace «#share=…», ofrece agregar esa playlist a su biblioteca. */
export function ShareImport() {
  const s = useStore();
  const toast = useRef(s.showToast);
  toast.current = s.showToast;
  const [pending, setPending] = useState<{ name: string; songs: Song[] } | null>(null);

  useEffect(() => {
    const read = async () => {
      const m = /^#share=(.+)$/.exec(location.hash);
      if (!m) return;
      history.replaceState(null, '', location.pathname + location.search);
      const data = await decodeShare(m[1]);
      if (!data) {
        toast.current('El enlace de la playlist no es válido o está incompleto');
        return;
      }
      const songs: Song[] = [];
      for (const entry of data.e) {
        if (typeof entry === 'string') {
          const found = CATALOG.find((c) => c.id === entry);
          if (found) songs.push(found);
        } else {
          const safe = sanitizeEntry(entry, (id) => hash(id) % 360);
          if (safe) songs.push(safe);
        }
      }
      if (songs.length === 0) {
        toast.current('Esa playlist no tiene canciones que se puedan abrir');
        return;
      }
      setPending({ name: data.n.trim() || 'Playlist compartida', songs });
    };
    void read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);

  const close = () => setPending(null);
  return (
    <Dialog open={!!pending} title="Te compartieron una playlist" onClose={close}>
      {pending && (
        <>
          <p className="dialog-lead">
            <b>«{pending.name}»</b> · {pending.songs.length} {pending.songs.length === 1 ? 'canción' : 'canciones'}
          </p>
          <ul className="dialog-list">
            {pending.songs.slice(0, 5).map((song, i) => (
              <li key={`${song.id}-${i}`}>
                <Cover song={song} size={38} radius={11} />
                <span>
                  <b>{song.title}</b>
                  <small>{song.artist}</small>
                </span>
              </li>
            ))}
            {pending.songs.length > 5 && <li className="dialog-more">y {pending.songs.length - 5} más…</li>}
          </ul>
          <div className="dialog-actions">
            <button className="btn btn-soft" onClick={close}>
              Descartar
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                const pid = s.importPlaylist(pending.name, pending.songs);
                s.showToast(`«${pending.name}» agregada a tu biblioteca`);
                setPending(null);
                void pid;
              }}
            >
              Agregar a mi biblioteca
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
}

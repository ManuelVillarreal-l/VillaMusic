import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import type { Song } from '../types';
import { DjBusy, DjUnavailable, askDj, resolveTracks } from '../lib/dj';
import { Dialog } from './Dialog';
import { Cover } from './Cover';
import { IconPlay, IconSpark } from './Icons';

const IDEAS = [
  'Música para estudiar con lluvia',
  'Fiesta de Carnaval de Negros y Blancos',
  'Salsa para cocinar un domingo',
  'Vallenato clásico para una tarde tranquila',
  'Reggaetón para entrenar',
  'Románticas para un viaje por carretera',
];

type Status = 'idle' | 'thinking' | 'searching' | 'done' | 'unavailable' | 'busy' | 'error';

export function DjDialog() {
  const s = useStore();
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<{ pid: string; name: string; description: string; songs: Song[] } | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!s.djOpen) {
      ctrl.current?.abort();
      setStatus('idle');
      setResult(null);
    }
  }, [s.djOpen]);

  const run = async (text: string) => {
    const wish = text.trim();
    if (wish.length < 3) return;
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setResult(null);
    try {
      setStatus('thinking');
      const plan = await askDj(wish, c.signal);
      setStatus('searching');
      const songs = await resolveTracks(plan.tracks, c.signal);
      if (songs.length === 0) throw new Error('sin canciones');
      const pid = s.importPlaylist(plan.name, songs);
      setResult({ pid, name: plan.name, description: plan.description, songs });
      setStatus('done');
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return;
      setStatus(err instanceof DjUnavailable ? 'unavailable' : err instanceof DjBusy ? 'busy' : 'error');
    }
  };

  const busy = status === 'thinking' || status === 'searching';
  const close = () => s.setDjOpen(false);

  return (
    <Dialog open={s.djOpen} title="DJ con IA" onClose={close}>
      {status !== 'done' && (
        <form
          className="dj-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(prompt);
          }}
        >
          <p className="dialog-lead">Cuéntame qué quieres escuchar y armo la playlist con canciones reales.</p>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            maxLength={200}
            rows={3}
            placeholder="Ej: música para estudiar con lluvia…"
            aria-label="Qué quieres escuchar"
            disabled={busy}
            autoFocus
          />
          <div className="chips" role="group" aria-label="Ideas">
            {IDEAS.map((idea) => (
              <button
                type="button"
                key={idea}
                className="chip chip-btn"
                disabled={busy}
                onClick={() => {
                  setPrompt(idea);
                  void run(idea);
                }}
              >
                {idea}
              </button>
            ))}
          </div>
          {status === 'unavailable' && (
            <p className="dj-note">
              El DJ con IA funciona en la versión publicada, donde el servidor guarda la clave de la IA. En tu
              computador con <code>npm run dev</code> no está disponible.
            </p>
          )}
          {status === 'busy' && <p className="dj-note">Has pedido muchas playlists seguidas. Espera un rato e inténtalo de nuevo.</p>}
          {status === 'error' && <p className="dj-note">El DJ no pudo armar la playlist esta vez. Inténtalo de nuevo con otras palabras.</p>}
          <button className="btn btn-primary btn-lg dj-go" type="submit" disabled={busy || prompt.trim().length < 3}>
            {busy ? <span className="spinner" /> : <IconSpark size={18} />}
            {status === 'thinking' ? 'El DJ está eligiendo…' : status === 'searching' ? 'Buscando las canciones…' : 'Crear playlist'}
          </button>
        </form>
      )}

      {status === 'done' && result && (
        <div className="dj-result">
          <p className="dialog-lead">
            <b>«{result.name}»</b> · {result.songs.length} canciones
          </p>
          {result.description && <p className="dj-desc">{result.description}</p>}
          <ul className="dialog-list">
            {result.songs.map((song) => (
              <li key={song.id}>
                <Cover song={song} size={38} radius={11} />
                <span>
                  <b>{song.title}</b>
                  <small>{song.artist}</small>
                </span>
              </li>
            ))}
          </ul>
          <div className="dialog-actions">
            <button className="btn btn-soft" onClick={() => setStatus('idle')}>
              Pedir otra
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                s.playPlaylist(result.pid);
                close();
              }}
            >
              <IconPlay size={16} /> Reproducir ahora
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

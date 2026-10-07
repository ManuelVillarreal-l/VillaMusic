import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { fetchLyrics } from '../lib/lyrics';
import type { Lyrics } from '../lib/lyrics';
import { activeLine } from '../lib/lrc';
import { cls } from '../lib/utils';
import { IconClose } from './Icons';

type State = { status: 'idle' | 'loading' | 'error' } | { status: 'ready'; lyrics: Lyrics };

/** Letras sincronizadas: cubre solo la columna principal, nunca los controles. */
export function LyricsPanel() {
  const s = useStore();
  const song = s.current?.node.value ?? null;
  const [state, setState] = useState<State>({ status: 'idle' });
  const [line, setLine] = useState(-1);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!s.lyricsOpen || !song) return;
    const c = new AbortController();
    setState({ status: 'loading' });
    setLine(-1);
    fetchLyrics(song, c.signal)
      .then((lyrics) => setState({ status: 'ready', lyrics }))
      .catch((err: unknown) => {
        if ((err as { name?: string }).name !== 'AbortError') setState({ status: 'error' });
      });
    return () => c.abort();
  }, [s.lyricsOpen, song?.id]);

  const lines = state.status === 'ready' && state.lyrics.kind === 'synced' ? state.lyrics.lines : null;

  // Sigue la canción: lee el reloj del reproductor y marca la línea que suena.
  useEffect(() => {
    if (!s.lyricsOpen || !lines) return;
    let raf = 0;
    const tick = () => {
      const i = activeLine(lines, s.audio.currentTime + 0.25);
      setLine((prev) => (prev === i ? prev : i));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [s.lyricsOpen, lines, s.audio]);

  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>(`[data-i="${line}"]`);
    const parent = box.current;
    if (!el || !parent) return;
    parent.scrollTo({ top: el.offsetTop - parent.clientHeight / 2 + el.offsetHeight / 2, behavior: 'smooth' });
  }, [line]);

  useEffect(() => {
    if (!s.lyricsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') s.toggleLyrics();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [s.lyricsOpen, s.toggleLyrics]);

  if (!s.lyricsOpen) return null;

  let body;
  if (!song) body = <p className="lyrics-note">Pon una canción y aquí aparece su letra.</p>;
  else if (state.status !== 'ready')
    body = (
      <p className="lyrics-note">
        {state.status === 'error' ? 'No pude conectar con el servicio de letras. Inténtalo de nuevo en un momento.' : 'Buscando la letra…'}
      </p>
    );
  else if (state.lyrics.kind === 'instrumental') body = <p className="lyrics-note">Instrumental · esta canción no tiene letra ♪</p>;
  else if (state.lyrics.kind === 'none') body = <p className="lyrics-note">No encontré la letra de esta canción.</p>;
  else if (state.lyrics.kind === 'plain') body = <pre className="lyrics-plain">{state.lyrics.text}</pre>;
  else
    body = (
      <ol className="lyrics-lines">
        {state.lyrics.lines.map((l, i) => (
          <li key={i} data-i={i} className={cls(i === line && 'is-now', i < line && 'is-past')}>
            <button onClick={() => s.seekTo(l.t)} tabIndex={-1} title="Ir a esta parte">
              {l.text || '♪'}
            </button>
          </li>
        ))}
      </ol>
    );

  return (
    <section className="lyrics-panel card" aria-label="Letra de la canción">
      <header>
        <div>
          <b>{song ? song.title : 'Letras'}</b>
          <small>{song ? song.artist : ''}</small>
        </div>
        <button className="icon-btn" onClick={s.toggleLyrics} aria-label="Cerrar letras">
          <IconClose size={18} />
        </button>
      </header>
      <div className="lyrics-body" ref={box}>
        {body}
      </div>
      <footer>Letras de LRCLIB</footer>
    </section>
  );
}

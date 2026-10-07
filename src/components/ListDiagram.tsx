import { Fragment, useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import type { Playlist } from '../store';
import { Cover } from './Cover';
import { IconChevronDown, IconLink } from './Icons';
import { cls } from '../lib/utils';

function ChainLink({ live }: { live?: boolean }) {
  return (
    <svg className={cls('chain-link', live && 'is-live')} width="42" height="30" viewBox="0 0 42 30" aria-hidden="true">
      <g className="l-next">
        <path d="M4 10H35" />
        <path d="M30 5.5 36 10l-6 4.5" />
        {live && <path className="l-fill" d="M4 10H35" pathLength="1" />}
      </g>
      <g className="l-prev">
        <path d="M38 21H7" />
        <path d="M12 16.5 6 21l6 4.5" />
      </g>
    </svg>
  );
}

function NullCap({ side }: { side: 'left' | 'right' }) {
  return (
    <>
      {side === 'right' && (
        <svg className="chain-link chain-link-half" width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
          <g className="l-next">
            <path d="M3 15H24" />
            <path d="M19 10.5 25 15l-6 4.5" />
          </g>
        </svg>
      )}
      <span className="chain-null">null</span>
      {side === 'left' && (
        <svg className="chain-link chain-link-half" width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
          <g className="l-prev">
            <path d="M27 15H6" />
            <path d="M11 10.5 5 15l6 4.5" />
          </g>
        </svg>
      )}
    </>
  );
}

/** Dibuja la playlist tal como vive en memoria: nodos con punteros prev y next. */
export function ListDiagram({ playlist }: { playlist: Playlist }) {
  const s = useStore();
  // En pantallas pequeñas arranca plegada para dejar espacio a la lista de canciones.
  const [open, setOpen] = useState(() => !window.matchMedia('(max-width: 820px)').matches);
  const trackRef = useRef<HTMLDivElement>(null);
  const nodes = playlist.list.nodeArray();
  const cur = s.current && s.current.pid === playlist.id ? s.current.node : null;

  useEffect(() => {
    const track = trackRef.current;
    if (!open || !cur || !track) return;
    const el = track.querySelector<HTMLElement>(`[data-node="${cur.id}"]`);
    if (!el) return;
    track.scrollTo({ left: el.offsetLeft - track.clientWidth / 2 + el.offsetWidth / 2, behavior: 'smooth' });
  }, [cur?.id, open, nodes.length]);

  // Progreso de la canción actual → variable CSS que llena la flecha hacia el siguiente nodo.
  useEffect(() => {
    const track = trackRef.current;
    if (!open || !cur || !track) return;
    let raf = 0;
    const tick = () => {
      const d = s.audio.duration;
      const p = Number.isFinite(d) && d > 0 ? Math.min(1, s.audio.currentTime / d) : 0;
      track.style.setProperty('--prog', p.toFixed(4));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cur?.id, open, s.audio]);

  return (
    <section className={cls('chain', !open && 'is-closed')}>
      <header className="chain-head">
        <div className="chain-title">
          <IconLink size={18} />
          <div>
            <b>La cadena de tu playlist</b>
            <small>
              Lista doblemente enlazada · {playlist.list.size} {playlist.list.size === 1 ? 'nodo' : 'nodos'}
            </small>
          </div>
        </div>
        {cur && open && (
          <div className="chain-now" aria-live="polite">
            <span className="ptr ptr-prev" title="current.prev">
              prev · {cur.prev ? cur.prev.value.title : 'null'}
            </span>
            <span className="ptr ptr-cur" title="current">
              {cur.value.title}
            </span>
            <span className="ptr ptr-next" title="current.next">
              next · {cur.next ? cur.next.value.title : 'null'}
            </span>
          </div>
        )}
        <button
          className={cls('icon-btn', open && 'is-flipped')}
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Ocultar cadena' : 'Mostrar cadena'}
          aria-expanded={open}
        >
          <IconChevronDown size={18} />
        </button>
      </header>

      {open && (
        <div className="chain-track" ref={trackRef}>
          {nodes.length === 0 ? (
            <p className="chain-empty">
              La lista está vacía: <code>head = null</code> y <code>tail = null</code>. Agrega una canción y mira cómo
              nace el primer nodo.
            </p>
          ) : (
            <>
              <NullCap side="left" />
              {nodes.map((n, i) => {
                const isCur = cur === n;
                return (
                  <Fragment key={n.id}>
                    {i > 0 && <ChainLink live={!!cur && nodes[i - 1] === cur} />}
                    <button
                      data-node={n.id}
                      className={cls('node', isCur && 'is-current', s.lastAdded === n.id && 'just-added')}
                      onClick={() => s.playNode(playlist.id, n)}
                      title={`Reproducir «${n.value.title}»`}
                    >
                      <span className="node-badges">
                        {i === 0 && <span className="badge">head</span>}
                        {i === nodes.length - 1 && <span className="badge badge-tail">tail</span>}
                        {isCur && <span className="badge badge-now">{s.isPlaying ? 'sonando' : 'actual'}</span>}
                      </span>
                      <span className="node-body">
                        <Cover song={n.value} size={34} radius={10} />
                        <span className="node-text">
                          <b>{n.value.title}</b>
                          <small>nodo {i}</small>
                        </span>
                      </span>
                      <span className="node-ptrs">
                        <span className="ptr ptr-prev">◀ {n.prev ? i - 1 : '∅'}</span>
                        <span className="ptr ptr-next">{n.next ? i + 1 : '∅'} ▶</span>
                      </span>
                    </button>
                  </Fragment>
                );
              })}
              <NullCap side="right" />
            </>
          )}
        </div>
      )}
    </section>
  );
}

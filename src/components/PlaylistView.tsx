import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, DragEvent } from 'react';
import { useStore } from '../store';
import type { SortKey } from '../store';
import type { ListNode, Placement } from '../lib/DoublyLinkedList';
import type { Song } from '../types';
import { Cover, Equalizer, PlaylistCover } from './Cover';
import { ListDiagram } from './ListDiagram';
import {
  IconGrip,
  IconPause,
  IconPencil,
  IconPlay,
  IconPlus,
  IconShuffle,
  IconSort,
  IconSwap,
  IconQueue,
  IconShare,
  IconTrash,
} from './Icons';
import { cls, fmtLong, fmtTime } from '../lib/utils';
import { hasFiles, setDragGhost } from '../lib/dnd';

type DropTarget = { nodeId: number | 'tail'; pos: Placement } | null;

interface RowProps {
  node: ListNode<Song>;
  index: number;
  isCurrent: boolean;
  isPlaying: boolean;
  dropPos: Placement | null;
  dragging: boolean;
  flash: boolean;
  onPlay: () => void;
  onRemove: () => void;
  onQueue: () => void;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
}

function SongRow(p: RowProps) {
  const song = p.node.value;
  const showEq = p.isCurrent && p.isPlaying;
  return (
    <div
      className={cls(
        'row',
        p.isCurrent && 'is-current',
        p.dragging && 'is-dragging',
        p.flash && 'just-added',
        p.dropPos === 'before' && 'drop-before',
        p.dropPos === 'after' && 'drop-after',
      )}
      draggable
      data-node={p.node.id}
      onDragStart={p.onDragStart}
      onDragEnd={p.onDragEnd}
      onDragOver={p.onDragOver}
      onDrop={p.onDrop}
      onDoubleClick={p.onPlay}
    >
      <IconGrip size={16} className="grip" />
      <div className="row-idx">
        {showEq ? <Equalizer /> : <span className="row-num">{p.index + 1}</span>}
        <button
          className="row-play"
          onClick={p.onPlay}
          aria-label={showEq ? `Pausar ${song.title}` : `Reproducir ${song.title}`}
        >
          {showEq ? <IconPause size={16} /> : <IconPlay size={16} />}
        </button>
      </div>
      <div className="row-main">
        <Cover song={song} size={44} radius={12} />
        <div className="row-text">
          <b className="row-title">{song.title}</b>
          <span className="row-artist">{song.artist}</span>
        </div>
      </div>
      <span className="row-album">{song.album}</span>
      <span className="row-genre">
        <span className="chip">{song.genre}</span>
      </span>
      <span className="row-dur">{song.duration ? fmtTime(song.duration) : '—'}</span>
      <span className="row-actions">
        <button className="icon-btn row-queue" onClick={p.onQueue} title="Sonará después" aria-label={`Reproducir ${song.title} a continuación`}>
          <IconQueue size={17} />
        </button>
        <button className="icon-btn row-remove" onClick={p.onRemove} title="Quitar de la playlist" aria-label={`Quitar ${song.title}`}>
          <IconTrash size={17} />
        </button>
      </span>
    </div>
  );
}

export function PlaylistView({ onOpenDiscover }: { onOpenDiscover: () => void }) {
  const s = useStore();
  const pl = s.active;
  const nodes = pl.list.nodeArray();

  const [drop, setDrop] = useState<DropTarget>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [menu, setMenu] = useState(false);
  const scroller = useRef<HTMLElement>(null);

  useEffect(() => {
    setEditing(false);
    setMenu(false);
  }, [pl.id]);

  // Limpia indicadores cuando termina cualquier arrastre (suelte donde suelte).
  useEffect(() => {
    const clear = () => {
      setDrop(null);
      setDraggingId(null);
      s.dragRef.current = null;
    };
    window.addEventListener('dragend', clear);
    return () => window.removeEventListener('dragend', clear);
  }, [s.dragRef]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menu]);

  const accepts = (e: DragEvent) => !!s.dragRef.current || hasFiles(e);

  const autoScroll = (e: DragEvent) => {
    const el = scroller.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (e.clientY < r.top + 90) el.scrollTop -= 16;
    else if (e.clientY > r.bottom - 90) el.scrollTop += 16;
  };

  const overRow = (e: DragEvent, node: ListNode<Song>) => {
    if (!accepts(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = s.dragRef.current?.kind === 'node' ? 'move' : 'copy';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    // Mitad superior de la fila = antes · mitad inferior = después. Nunca se pregunta nada.
    const pos: Placement = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    setDrop((prev) => (prev && prev.nodeId === node.id && prev.pos === pos ? prev : { nodeId: node.id, pos }));
    autoScroll(e);
  };

  const overTail = (e: DragEvent) => {
    if (!accepts(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = s.dragRef.current?.kind === 'node' ? 'move' : 'copy';
    setDrop((prev) => (prev && prev.nodeId === 'tail' ? prev : { nodeId: 'tail', pos: 'after' }));
    autoScroll(e);
  };

  const handleDrop = async (e: DragEvent, target: ListNode<Song> | null, pos: Placement) => {
    e.preventDefault();
    e.stopPropagation();
    setDrop(null);
    setDraggingId(null);
    const payload = s.dragRef.current;
    s.dragRef.current = null;

    if (payload?.kind === 'catalog') {
      s.insertSong(pl.id, payload.song, target, pos);
      return;
    }
    if (payload?.kind === 'node') {
      if (payload.pid === pl.id) s.moveNode(pl.id, payload.node, target, pos);
      return;
    }
    // Archivos de audio arrastrados desde el computador: se suben y se insertan en ese mismo lugar.
    const files = Array.from(e.dataTransfer.files);
    if (files.length) {
      const songs = await s.addUploads(files);
      let ref = target;
      let place = pos;
      for (const song of songs) {
        const node = s.insertSong(pl.id, song, ref, place);
        if (node) {
          ref = node;
          place = 'after';
        }
      }
    }
  };

  const playingHere = s.current?.pid === pl.id;
  const heroPlay = () => {
    if (playingHere) s.togglePlay();
    else s.playPlaylist(pl.id);
  };

  const commitName = () => {
    s.renamePlaylist(pl.id, draft);
    setEditing(false);
  };

  const sortBy = (key: SortKey) => {
    s.sortPlaylist(pl.id, key);
    setMenu(false);
  };

  const heroStyle = { '--h': pl.hue } as CSSProperties;
  const count = nodes.length;

  return (
    <main className="main card" ref={scroller}>
      <header className="hero" style={heroStyle}>
        <div className="hero-cover">
          <PlaylistCover playlist={pl} size={148} radius={26} />
        </div>
        <div className="hero-info">
          <span className="eyebrow">Playlist</span>
          {editing ? (
            <input
              className="hero-title-input"
              autoFocus
              value={draft}
              maxLength={60}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitName();
                if (e.key === 'Escape') setEditing(false);
              }}
              aria-label="Nombre de la playlist"
            />
          ) : (
            <h1
              className="hero-title"
              onClick={() => {
                setDraft(pl.name);
                setEditing(true);
              }}
              title="Clic para cambiar el nombre"
            >
              {pl.name}
              <IconPencil size={18} className="hero-pencil" />
            </h1>
          )}
          <p className="hero-meta">
            <b>{count === 1 ? '1 canción' : `${count} canciones`}</b>
            <span>·</span>
            {fmtLong(pl.totalSeconds)}
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-lg" onClick={heroPlay} disabled={count === 0}>
              {playingHere && s.isPlaying ? <IconPause size={18} /> : <IconPlay size={18} />}
              {playingHere && s.isPlaying ? 'Pausar' : playingHere ? 'Continuar' : 'Reproducir'}
            </button>
            <button
              className={cls('icon-btn icon-btn-lg', s.shuffle && 'is-on')}
              onClick={s.toggleShuffle}
              title={s.shuffle ? 'Aleatorio: activado' : 'Aleatorio: apagado'}
              aria-pressed={s.shuffle}
            >
              <IconShuffle size={20} />
            </button>
            <button className="icon-btn icon-btn-lg" onClick={() => void s.sharePlaylist(pl.id)} disabled={count === 0} title="Compartir por enlace" aria-label="Compartir playlist">
              <IconShare size={20} />
            </button>
            <div className="menu-wrap">
              <button
                className="btn btn-soft"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenu((m) => !m);
                }}
                aria-haspopup="menu"
                aria-expanded={menu}
                disabled={count < 2}
              >
                <IconSort size={18} /> Ordenar
              </button>
              {menu && (
                <div className="menu" role="menu">
                  <button role="menuitem" onClick={() => sortBy('title')}>
                    Por título (A–Z)
                  </button>
                  <button role="menuitem" onClick={() => sortBy('artist')}>
                    Por artista (A–Z)
                  </button>
                  <button role="menuitem" onClick={() => sortBy('duration')}>
                    Por duración
                  </button>
                  <hr />
                  <button
                    role="menuitem"
                    onClick={() => {
                      s.reversePlaylist(pl.id);
                      setMenu(false);
                    }}
                  >
                    <IconSwap size={16} /> Invertir la lista
                  </button>
                </div>
              )}
            </div>
            <button className="btn btn-soft only-compact" onClick={onOpenDiscover}>
              <IconPlus size={18} /> Agregar canciones
            </button>
            <button
              className="icon-btn icon-btn-lg danger"
              title="Eliminar playlist"
              aria-label="Eliminar playlist"
              onClick={() => {
                if (window.confirm(`¿Eliminar la playlist «${pl.name}»?`)) s.deletePlaylist(pl.id);
              }}
            >
              <IconTrash size={19} />
            </button>
          </div>
        </div>
      </header>

      <ListDiagram playlist={pl} />

      <div
        className="rows"
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDrop(null);
        }}
      >
        {count > 0 && (
          <div className="rows-head" aria-hidden="true">
            <span>#</span>
            <span>Título</span>
            <span className="row-album">Álbum</span>
            <span className="row-genre">Género</span>
            <span className="row-dur">Duración</span>
            <span />
          </div>
        )}

        {nodes.map((node, i) => (
          <SongRow
            key={node.id}
            node={node}
            index={i}
            isCurrent={s.current?.node === node}
            isPlaying={s.isPlaying}
            dropPos={drop && drop.nodeId === node.id ? drop.pos : null}
            dragging={draggingId === node.id}
            flash={s.lastAdded === node.id}
            onPlay={() => (s.current?.node === node ? s.togglePlay() : s.playNode(pl.id, node))}
            onRemove={() => s.removeNode(pl.id, node)}
            onQueue={() => s.moveNext(pl.id, node)}
            onDragStart={(e) => {
              s.dragRef.current = { kind: 'node', pid: pl.id, node };
              e.dataTransfer.effectAllowed = 'copyMove';
              e.dataTransfer.setData('text/plain', node.value.title);
              setDragGhost(e, node.value);
              window.setTimeout(() => setDraggingId(node.id), 0);
            }}
            onDragEnd={() => {
              s.dragRef.current = null;
              setDraggingId(null);
              setDrop(null);
            }}
            onDragOver={(e) => overRow(e, node)}
            onDrop={(e) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const pos: Placement = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
              void handleDrop(e, node, pos);
            }}
          />
        ))}

        {count === 0 ? (
          <div
            className={cls('empty-drop', drop?.nodeId === 'tail' && 'is-over')}
            onDragOver={overTail}
            onDrop={(e) => void handleDrop(e, null, 'after')}
          >
            <svg viewBox="0 0 120 80" width="120" height="80" aria-hidden="true">
              <polygon points="6,76 60,12 114,76" fill="var(--accent-soft)" />
              <polygon points="60,12 48,30 60,26 72,32" fill="#fff" />
              <circle cx="92" cy="20" r="9" fill="var(--accent-2)" opacity=".7" />
            </svg>
            <b>Tu playlist está vacía</b>
            <span>Arrastra canciones desde «Descubrir» y suéltalas aquí.</span>
            <button className="btn btn-soft only-compact" onClick={onOpenDiscover}>
              <IconPlus size={18} /> Agregar canciones
            </button>
          </div>
        ) : (
          <div
            className={cls('tail-drop', drop?.nodeId === 'tail' && 'is-over')}
            onDragOver={overTail}
            onDrop={(e) => void handleDrop(e, null, 'after')}
          >
            Suelta aquí para agregar al final
          </div>
        )}
      </div>
    </main>
  );
}

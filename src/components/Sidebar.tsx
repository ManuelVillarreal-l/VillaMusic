import { useRef, useState } from 'react';
import { useStore } from '../store';
import type { AccentName } from '../store';
import { Logo, Wordmark } from './Logo';
import { Equalizer, PlaylistCover } from './Cover';
import { IconDownload, IconPlus, IconSearch, IconSpark, IconUpload } from './Icons';
import { useInstall } from '../lib/pwa';
import { cls } from '../lib/utils';

const ACCENTS: { id: AccentName; label: string; a: string; b: string }[] = [
  { id: 'galeras', label: 'Galeras', a: '#FF6B35', b: '#FFB627' },
  { id: 'cocha', label: 'La Cocha', a: '#0EA5A0', b: '#6EE7C8' },
  { id: 'carnaval', label: 'Carnaval', a: '#7C5CFF', b: '#FF7AC6' },
];

export function Sidebar({ onOpenDiscover }: { onOpenDiscover: () => void }) {
  const s = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState<string | null>(null);
  const install = useInstall();
  const onInstall = () => {
    if (install.needsHint) s.showToast('En iPhone: toca Compartir y luego «Añadir a pantalla de inicio»');
    else void install.install();
  };

  return (
    <aside className="sidebar card">
      <div className="brand">
        <Logo size={42} />
        <Wordmark />
      </div>

      <div className="side-head">
        <span>Tus playlists</span>
        <button className="icon-btn" onClick={() => s.createPlaylist()} title="Nueva playlist" aria-label="Nueva playlist">
          <IconPlus size={18} />
        </button>
      </div>

      <nav className="side-list">
        {s.playlists.map((p) => {
          const playingHere = s.current?.pid === p.id;
          return (
            <button
              key={p.id}
              className={cls('side-item', p.id === s.active.id && 'is-active', over === p.id && 'is-over')}
              onClick={() => s.setActive(p.id)}
              onDragOver={(e) => {
                if (!s.dragRef.current) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                setOver(p.id);
              }}
              onDragLeave={() => setOver((o) => (o === p.id ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const d = s.dragRef.current;
                s.dragRef.current = null;
                if (d) s.addToPlaylist(p.id, d.kind === 'catalog' ? d.song : d.node.value);
              }}
            >
              <PlaylistCover playlist={p} size={44} radius={12} />
              <span className="side-text">
                <b>{p.name}</b>
                <small>{p.list.size === 1 ? '1 canción' : `${p.list.size} canciones`}</small>
              </span>
              {playingHere && <Equalizer paused={!s.isPlaying} />}
            </button>
          );
        })}
      </nav>

      <div className="side-quick">
        <button className="btn btn-primary" onClick={() => s.setDjOpen(true)} aria-label="DJ con IA">
          <IconSpark size={17} /> DJ
        </button>
        <button className="btn btn-soft" onClick={onOpenDiscover} aria-label="Buscar canciones">
          <IconSearch size={17} /> Buscar
        </button>
        {install.canInstall && (
          <button className="btn btn-soft" onClick={onInstall} aria-label="Instalar app">
            <IconDownload size={17} />
          </button>
        )}
      </div>

      <div className="side-foot">
        <button className="btn btn-primary btn-block dj-btn" onClick={() => s.setDjOpen(true)}>
          <IconSpark size={18} /> DJ con IA
        </button>
        <button className="btn btn-soft btn-block" onClick={() => fileRef.current?.click()}>
          <IconUpload size={18} /> Subir mi música
        </button>
        {install.canInstall && (
          <button className="btn btn-soft btn-block" onClick={onInstall}>
            <IconDownload size={18} /> Instalar app
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []) as File[];
            e.target.value = '';
            if (files.length) void s.addUploads(files);
          }}
        />

        <div className="accent-picker" role="radiogroup" aria-label="Color de la app">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              role="radio"
              aria-checked={s.accent === a.id}
              className={cls('accent-dot', s.accent === a.id && 'is-on')}
              style={{ background: `linear-gradient(135deg, ${a.a}, ${a.b})` }}
              onClick={() => s.setAccent(a.id)}
              title={a.label}
            />
          ))}
        </div>
        <p className="signature">Hecho en Pasto con ♥ · Manuel Villarreal</p>
      </div>
    </aside>
  );
}

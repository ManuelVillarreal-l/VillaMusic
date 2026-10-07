import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import type { Song } from '../types';
import { GENRES } from '../lib/catalog';
import { Cover } from './Cover';
import { IconClose, IconQueue, IconMusic, IconPause, IconPlay, IconPlus, IconSearch, IconTrash, IconUpload } from './Icons';
import { searchSongs } from '../lib/itunes';
import { searchAudius } from '../lib/audius';
import { YouTubeKeyError, YouTubeNoServer, YouTubeQuota, getYouTubeKey, searchYouTube, setYouTubeKey } from '../lib/youtube';
import { cls, fmtTime } from '../lib/utils';
import { hasFiles, setDragGhost } from '../lib/dnd';

type Tab = 'catalog' | 'web' | 'mine';
type WebSource = 'youtube' | 'audius' | 'itunes';
type WebStatus = 'idle' | 'loading' | 'ok' | 'error' | 'badkey' | 'quota' | 'needkey';

const SUGGESTIONS = ['Carlos Vives', 'Karol G', 'Feid', 'Shakira', 'Bad Bunny', 'Juanes', 'Silvestre Dangond', 'Bomba Estéreo'];

export function Discover({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore();
  const [tab, setTab] = useState<Tab>('catalog');
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('Todos');
  const [fileOver, setFileOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<WebSource>('youtube');
  const [ytKey, setYtKey] = useState(getYouTubeKey);
  const [keyDraft, setKeyDraft] = useState('');
  const [webItems, setWebItems] = useState<Song[]>([]);
  const [webStatus, setWebStatus] = useState<WebStatus>('idle');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);

  // Búsqueda en iTunes con espera de 400 ms y cancelación de la anterior.
  useEffect(() => {
    if (tab !== 'web') return;
    const term = query.trim();
    if (term.length < 2) {
      setWebItems([]);
      setWebStatus('idle');
      return;
    }
    setWebStatus('loading');
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      (source === 'youtube'
        ? searchYouTube(term, ytKey, ctrl.signal)
        : source === 'audius'
          ? searchAudius(term, ctrl.signal)
          : searchSongs(term, ctrl.signal)
      )
        .then((r) => {
          setWebItems(r);
          setWebStatus('ok');
        })
        .catch((err: unknown) => {
          if ((err as { name?: string }).name === 'AbortError') return;
          setWebStatus(
            err instanceof YouTubeKeyError
              ? 'badkey'
              : err instanceof YouTubeNoServer
                ? 'needkey'
                : err instanceof YouTubeQuota
                  ? 'quota'
                  : 'error',
          );
        });
    }, 400);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [tab, query, source, ytKey]);

  const stopPreview = () => {
    previewRef.current?.pause();
    previewRef.current = null;
    setPreviewId(null);
  };
  useEffect(() => () => previewRef.current?.pause(), []);
  useEffect(() => {
    if (tab !== 'web') stopPreview();
  }, [tab]);

  const playNow = (song: Song) => {
    stopPreview();
    const pl = s.active;
    const node = s.insertSong(pl.id, song, pl.list.tail, 'after');
    if (node) s.playNode(pl.id, node);
  };

  const togglePreview = (song: Song) => {
    if (song.kind === 'youtube') return playNow(song);
    if (previewId === song.id) return stopPreview();
    stopPreview();
    const src = song.streamUrl ?? song.previewUrl;
    if (!src) return;
    if (s.isPlaying) s.togglePlay();
    const a = new Audio(src);
    a.volume = 0.85;
    a.onended = () => setPreviewId((id) => (id === song.id ? null : id));
    a.onerror = () => stopPreview();
    previewRef.current = a;
    setPreviewId(song.id);
    void a.play().catch(() => stopPreview());
  };

  const q = query.trim().toLowerCase();
  const items = useMemo(() => {
    if (tab === 'web') return webItems;
    const pool = tab === 'catalog' ? s.catalog : s.uploads;
    return pool.filter((song) => {
      if (tab === 'catalog' && genre !== 'Todos' && song.genre !== genre) return false;
      if (!q) return true;
      return `${song.title} ${song.artist} ${song.album} ${song.genre}`.toLowerCase().includes(q);
    });
  }, [tab, webItems, s.catalog, s.uploads, genre, q]);

  const pickFiles = (files: File[]) => {
    if (files.length) void s.addUploads(files);
  };

  const renderItem = (song: Song) => (
    <li
      key={song.id}
      className={cls('d-item', previewId === song.id && 'is-previewing')}
      draggable
      onDragStart={(e) => {
        s.dragRef.current = { kind: 'catalog', song };
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', song.title);
        setDragGhost(e, song);
      }}
      onDragEnd={() => {
        s.dragRef.current = null;
      }}
    >
      <Cover song={song} size={46} radius={13} />
      <div className="d-text">
        <b>{song.title}</b>
        <small>
          {song.artist} · {song.genre}
        </small>
      </div>
      <span className="d-dur">{song.duration ? fmtTime(song.duration) : '—'}</span>
      {tab === 'web' && (
        <button
          className="icon-btn d-play"
          title={previewId === song.id ? 'Detener' : song.kind === 'youtube' ? 'Agregar y reproducir' : song.streamUrl ? 'Escuchar canción completa' : 'Escuchar vista previa (30 s)'}
          aria-label={`${previewId === song.id ? 'Detener' : 'Escuchar'} ${song.title}`}
          onClick={() => togglePreview(song)}
        >
          {previewId === song.id ? <IconPause size={17} /> : <IconPlay size={17} />}
        </button>
      )}
      {tab === 'mine' && (
        <button
          className="icon-btn danger"
          title="Quitar de mi música"
          aria-label={`Quitar ${song.title} de mi música`}
          onClick={() => {
            if (window.confirm(`¿Quitar «${song.title}» de tu música? También saldrá de tus playlists.`)) {
              s.deleteUpload(song.id);
            }
          }}
        >
          <IconTrash size={17} />
        </button>
      )}
      <button className="icon-btn d-next" title="Sonará después" aria-label={`Reproducir ${song.title} a continuación`} onClick={() => s.playNext(song)}>
        <IconQueue size={17} />
      </button>
      <button
        className="icon-btn d-add"
        title={`Agregar al final de «${s.active.name}»`}
        aria-label={`Agregar ${song.title} a ${s.active.name}`}
        onClick={() => s.addToPlaylist(s.active.id, song)}
      >
        <IconPlus size={18} />
      </button>
    </li>
  );

  return (
    <aside
      className={cls('discover card', open && 'is-open', fileOver && 'is-file-over')}
      onDragOver={(e) => {
        if (hasFiles(e)) {
          e.preventDefault();
          setFileOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFileOver(false);
      }}
      onDrop={(e) => {
        setFileOver(false);
        if (hasFiles(e)) {
          e.preventDefault();
          setTab('mine');
          pickFiles(Array.from(e.dataTransfer.files));
        }
      }}
    >
      <header className="d-head">
        <div>
          <h2>Descubrir</h2>
          <p>Arrastra una canción y suéltala en cualquier parte de tu playlist.</p>
        </div>
        <button className="icon-btn only-compact" onClick={onClose} aria-label="Cerrar">
          <IconClose size={18} />
        </button>
      </header>

      <label className="search">
        <IconSearch size={18} />
        <input
          type="search"
          placeholder={tab === 'web' ? 'Busca cualquier canción o artista del mundo…' : 'Busca canciones, artistas, géneros…'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'catalog'} className={cls('tab', tab === 'catalog' && 'is-on')} onClick={() => setTab('catalog')}>
          Catálogo <span>{s.catalog.length}</span>
        </button>
        <button role="tab" aria-selected={tab === 'web'} className={cls('tab', tab === 'web' && 'is-on')} onClick={() => setTab('web')}>
          Todo el mundo
        </button>
        <button role="tab" aria-selected={tab === 'mine'} className={cls('tab', tab === 'mine' && 'is-on')} onClick={() => setTab('mine')}>
          Mi música <span>{s.uploads.length}</span>
        </button>
      </div>

      {tab === 'catalog' && (
        <div className="chips" role="group" aria-label="Filtrar por género">
          {['Todos', ...GENRES].map((g) => (
            <button key={g} className={cls('chip chip-btn', genre === g && 'is-on')} onClick={() => setGenre(g)}>
              {g}
            </button>
          ))}
        </div>
      )}

      {tab === 'web' && (
        <>
          <div className="chips" role="group" aria-label="Fuente">
            <button className={cls('chip chip-btn', source === 'youtube' && 'is-on')} onClick={() => setSource('youtube')}>
              YouTube · completas
            </button>
            <button className={cls('chip chip-btn', source === 'audius' && 'is-on')} onClick={() => setSource('audius')}>
              Independientes
            </button>
            <button className={cls('chip chip-btn', source === 'itunes' && 'is-on')} onClick={() => setSource('itunes')}>
              Éxitos · vista previa 30 s
            </button>
          </div>
          <p className="web-hint">
            {source === 'youtube'
              ? 'Cualquier canción del mundo, completa. El video se ve en su propio panel, sin tapar nada.'
              : source === 'audius'
                ? 'Música completa de artistas independientes (Audius), gratis y legal.'
                : 'Los éxitos comerciales solo permiten 30 s por derechos de autor. Para oírlos completos, sube tus MP3 en «Mi música».'}
          </p>
          {source === 'youtube' && !ytKey && (webStatus === 'needkey' || webStatus === 'quota') && (
            <form
              className="yt-key"
              onSubmit={(e) => {
                e.preventDefault();
                const k = keyDraft.trim();
                if (k) {
                  setYouTubeKey(k);
                  setYtKey(k);
                  setKeyDraft('');
                }
              }}
            >
              <b>{webStatus === 'quota' ? 'Se agotó la cuota de hoy. Usa tu propia clave:' : 'Conecta tu clave de YouTube (gratis, 2 minutos)'}</b>
              <ol>
                <li>
                  Entra a <a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noreferrer">Google Cloud</a> y activa «YouTube Data API v3».
                </li>
                <li>
                  En «Credenciales» crea una <i>clave de API</i> y pégala aquí.
                </li>
              </ol>
              <div className="yt-key-row">
                <input type="password" placeholder="Pega tu clave de API" value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} aria-label="Clave de API de YouTube" />
                <button type="submit" className="chip chip-btn is-on">
                  Guardar
                </button>
              </div>
            </form>
          )}
          {source === 'youtube' && !!ytKey && (
            <button
              className="yt-forget"
              onClick={() => {
                setYouTubeKey('');
                setYtKey('');
              }}
            >
              Cambiar clave de YouTube
            </button>
          )}
        </>
      )}
      {tab === 'web' && webStatus === 'idle' && (
        <div className="chips" role="group" aria-label="Sugerencias">
          {SUGGESTIONS.map((g) => (
            <button key={g} className="chip chip-btn" onClick={() => setQuery(g)}>
              {g}
            </button>
          ))}
        </div>
      )}

      {tab === 'mine' && (
        <button className="upload-zone" onClick={() => fileRef.current?.click()}>
          <IconUpload size={22} />
          <b>Sube tus MP3</b>
          <span>Haz clic o arrástralos aquí. Quedan guardados en tu navegador.</span>
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
          pickFiles(files);
        }}
      />

      <ul className="d-list">
        {items.map(renderItem)}
        {tab === 'web' && webStatus === 'loading' && (
          <li className="d-loading">
            <i /> Buscando…
          </li>
        )}
        {!(tab === 'web' && webStatus === 'loading') && items.length === 0 && (
          <li className="d-empty">
            <IconMusic size={28} />
            {tab === 'web'
              ? webStatus === 'needkey' || webStatus === 'quota'
                ? 'La búsqueda de YouTube no está disponible ahora. Prueba «Independientes» o pega tu clave arriba.'
                : webStatus === 'badkey'
                ? 'YouTube rechazó la clave o se agotó la cuota diaria. Revisa la clave o inténtalo mañana.'
                : webStatus === 'error'
                ? 'No pude conectar con el buscador. Revisa tu internet e inténtalo de nuevo.'
                : webStatus === 'ok'
                  ? 'No encontré resultados. Prueba con otro nombre.'
                  : 'Escribe el nombre de una canción o artista.'
              : tab === 'mine' && s.uploads.length === 0
                ? 'Aún no has subido música.'
                : 'No encontré canciones con ese filtro.'}
          </li>
        )}
      </ul>
    </aside>
  );
}

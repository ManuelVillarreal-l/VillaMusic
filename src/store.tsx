import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { DoublyLinkedList } from './lib/DoublyLinkedList';
import type { ListNode, Placement } from './lib/DoublyLinkedList';
import type { Song } from './types';
import { CATALOG, DEFAULT_PLAYLISTS } from './lib/catalog';
import { Engine } from './lib/engine';
import { forgetSongUrl, getSongUrl, prefetchSong } from './lib/audio';
import { deleteBlob, saveBlob } from './lib/db';
import { hash, isAudioFile, readAudioDuration, titleFromFilename, uid } from './lib/utils';

export type RepeatMode = 'off' | 'all' | 'one';
export type AccentName = 'galeras' | 'cocha' | 'carnaval';
export type SortKey = 'title' | 'artist' | 'duration';

/** Una playlist ES una lista doblemente enlazada de canciones. */
export class Playlist {
  readonly id: string;
  name: string;
  hue: number;
  readonly list: DoublyLinkedList<Song>;

  constructor(id: string, name: string, hue: number) {
    this.id = id;
    this.name = name;
    this.hue = hue;
    this.list = new DoublyLinkedList<Song>();
  }

  get totalSeconds(): number {
    let total = 0;
    for (const song of this.list) total += song.duration;
    return total;
  }
}

export interface Current {
  pid: string;
  node: ListNode<Song>;
}

export type DragPayload =
  | { kind: 'catalog'; song: Song }
  | { kind: 'node'; pid: string; node: ListNode<Song> };

export interface Toast {
  id: number;
  message: string;
  undo?: () => void;
}

interface Saved {
  playlists: { id: string; name: string; hue: number; songIds: string[] }[];
  activeId: string;
  uploads: Song[];
  /** Canciones encontradas en la web que están en alguna playlist. */
  web?: Song[];
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  accent: AccentName;
}

const STORAGE_KEY = 'villamusic:v1';
const HUES = [28, 340, 262, 188, 96, 12, 206, 52];

// ───────────────────────── estado inicial ─────────────────────────

function loadInitial() {
  let saved: Partial<Saved> | null = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) saved = JSON.parse(raw) as Partial<Saved>;
  } catch {
    saved = null;
  }

  const uploads: Song[] = Array.isArray(saved?.uploads) ? (saved?.uploads as Song[]) : [];
  const byId = new Map<string, Song>();
  for (const s of CATALOG) byId.set(s.id, s);
  for (const s of uploads) byId.set(s.id, s);
  if (Array.isArray(saved?.web)) for (const s of saved.web) byId.set(s.id, s);

  const build = (id: string, name: string, hue: number, songIds: string[]) => {
    const pl = new Playlist(id, name, hue);
    for (const sid of songIds) {
      const song = byId.get(sid);
      if (song) pl.list.append(song);
    }
    return pl;
  };

  const source =
    saved && Array.isArray(saved.playlists) && saved.playlists.length > 0
      ? saved.playlists
      : DEFAULT_PLAYLISTS;
  const playlists = source.map((p) => build(p.id, p.name, p.hue, p.songIds));

  const accent: AccentName =
    saved?.accent === 'cocha' || saved?.accent === 'carnaval' ? saved.accent : 'galeras';
  document.documentElement.dataset.accent = accent;

  const activeId =
    saved?.activeId && playlists.some((p) => p.id === saved?.activeId) ? saved.activeId : playlists[0].id;

  return {
    playlists,
    activeId,
    uploads,
    volume: typeof saved?.volume === 'number' ? saved.volume : 0.8,
    shuffle: !!saved?.shuffle,
    repeat: (saved?.repeat === 'all' || saved?.repeat === 'one' ? saved.repeat : 'off') as RepeatMode,
    accent,
  };
}

function useLatest<T>(value: T): { current: T } {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

function randomNode(list: DoublyLinkedList<Song>, exclude: ListNode<Song> | null): ListNode<Song> | null {
  if (list.size === 0) return null;
  if (list.size === 1) return list.head;
  for (let tries = 0; tries < 8; tries++) {
    const node = list.getNodeAt(Math.floor(Math.random() * list.size));
    if (node && node !== exclude) return node;
  }
  return exclude?.next ?? list.head;
}

// ───────────────────────── contexto ─────────────────────────

export interface Store {
  version: number;
  playlists: Playlist[];
  active: Playlist;
  setActive: (id: string) => void;
  createPlaylist: () => string;
  renamePlaylist: (id: string, name: string) => void;
  deletePlaylist: (id: string) => void;

  insertSong: (pid: string, song: Song, ref: ListNode<Song> | null, placement: Placement) => ListNode<Song> | null;
  addToPlaylist: (pid: string, song: Song) => void;
  moveNode: (pid: string, node: ListNode<Song>, ref: ListNode<Song> | null, placement: Placement) => void;
  removeNode: (pid: string, node: ListNode<Song>) => void;
  reversePlaylist: (pid: string) => void;
  sortPlaylist: (pid: string, key: SortKey) => void;

  catalog: Song[];
  uploads: Song[];
  addUploads: (files: File[]) => Promise<Song[]>;
  deleteUpload: (id: string) => void;

  current: Current | null;
  isPlaying: boolean;
  isLoading: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  volume: number;
  muted: boolean;
  audio: Engine;
  getAnalyser: () => AnalyserNode | null;
  playNode: (pid: string, node: ListNode<Song>) => void;
  playPlaylist: (pid: string) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seekBy: (seconds: number) => void;
  seekTo: (seconds: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;

  dragRef: { current: DragPayload | null };
  lastAdded: number | null;
  toast: Toast | null;
  showToast: (message: string, undo?: () => void) => void;
  dismissToast: () => void;
  accent: AccentName;
  setAccent: (a: AccentName) => void;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const store = useContext(Ctx);
  if (!store) throw new Error('useStore debe usarse dentro de <StoreProvider>');
  return store;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [init] = useState(loadInitial);
  const [playlists, setPlaylists] = useState<Playlist[]>(init.playlists);
  const [activeId, setActiveId] = useState(init.activeId);
  const [uploads, setUploads] = useState<Song[]>(init.uploads);
  const [version, setVersion] = useState(0);
  const [volume, setVolumeState] = useState(init.volume);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(init.shuffle);
  const [repeat, setRepeat] = useState<RepeatMode>(init.repeat);
  const [accent, setAccentState] = useState<AccentName>(init.accent);
  const [current, setCurrentState] = useState<Current | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [lastAdded, setLastAdded] = useState<number | null>(null);

  const audio = useMemo(() => new Engine(), []);

  const active = playlists.find((p) => p.id === activeId) ?? playlists[0];

  const playlistsRef = useLatest(playlists);
  const activeRef = useLatest(active);
  const shuffleRef = useLatest(shuffle);
  const repeatRef = useLatest(repeat);
  const currentRef = useRef<Current | null>(null);
  const historyRef = useRef<Current[]>([]);
  const loadToken = useRef(0);
  const loadedNodeId = useRef<number | null>(null);
  const dragRef = useRef<DragPayload | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const flashTimer = useRef<number | undefined>(undefined);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const touch = useCallback(() => setVersion((v) => v + 1), []);
  const getPlaylist = useCallback(
    (pid: string) => playlistsRef.current.find((p) => p.id === pid),
    [playlistsRef],
  );

  const setCurrent = useCallback((c: Current | null) => {
    currentRef.current = c;
    setCurrentState(c);
  }, []);

  // ───────────── avisos ─────────────

  const dismissToast = useCallback(() => {
    window.clearTimeout(toastTimer.current);
    setToast(null);
  }, []);

  const showToast = useCallback((message: string, undo?: () => void) => {
    window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message, undo });
    toastTimer.current = window.setTimeout(() => setToast(null), undo ? 6500 : 3200);
  }, []);

  const flash = useCallback((nodeId: number) => {
    setLastAdded(nodeId);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setLastAdded(null), 1300);
  }, []);

  // ───────────── motor de audio ─────────────

  const ensureGraph = useCallback(() => {
    const ctx = ctxRef.current;
    if (ctx) {
      if (ctx.state === 'suspended') void ctx.resume();
      return;
    }
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const created = new Ctor();
      const source = created.createMediaElementSource(audio.el);
      const analyser = created.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.78;
      source.connect(analyser);
      analyser.connect(created.destination);
      ctxRef.current = created;
      analyserRef.current = analyser;
    } catch {
      /* sin visualizador: el audio sigue funcionando */
    }
  }, [audio]);

  const getAnalyser = useCallback(() => analyserRef.current, []);

  const stopAudio = useCallback(() => {
    loadToken.current++;
    audio.stop();
    loadedNodeId.current = null;
    setIsPlaying(false);
    setIsLoading(false);
  }, [audio]);

  const startNode = useCallback(
    async (pid: string, node: ListNode<Song>) => {
      const token = ++loadToken.current;
      setCurrent({ pid, node });
      setIsLoading(true);
      try {
        if (node.value.kind === 'youtube' && node.value.videoId) {
          loadedNodeId.current = node.id;
          await audio.playYouTube(node.value.videoId);
        } else {
          const url = await getSongUrl(node.value);
          if (token !== loadToken.current) return;
          await audio.playUrl(url);
          loadedNodeId.current = node.id;
          ensureGraph();
          await audio.play();
        }
        if (token !== loadToken.current) return;
        setIsPlaying(true);
        if (node.next) prefetchSong(node.next.value);
      } catch (err) {
        if (token !== loadToken.current) return;
        console.error(err);
        setIsPlaying(false);
        showToast('No se pudo reproducir esta canción');
      } finally {
        if (token === loadToken.current) setIsLoading(false);
      }
    },
    [audio, ensureGraph, setCurrent, showToast],
  );

  const playNode = useCallback(
    (pid: string, node: ListNode<Song>) => {
      const cur = currentRef.current;
      if (cur && cur.node !== node) {
        historyRef.current.push(cur);
        if (historyRef.current.length > 60) historyRef.current.shift();
      }
      void startNode(pid, node);
    },
    [startNode],
  );

  const playPlaylist = useCallback(
    (pid: string) => {
      const pl = getPlaylist(pid);
      if (!pl || pl.list.isEmpty) return;
      const first = shuffleRef.current ? randomNode(pl.list, null) : pl.list.head;
      if (first) playNode(pid, first);
    },
    [getPlaylist, playNode, shuffleRef],
  );

  const togglePlay = useCallback(() => {
    const cur = currentRef.current;
    if (!cur) {
      const pl = activeRef.current;
      if (pl.list.head) playPlaylist(pl.id);
      else showToast('Arrastra canciones a tu playlist para empezar');
      return;
    }
    if (loadedNodeId.current !== cur.node.id) {
      void startNode(cur.pid, cur.node);
      return;
    }
    if (audio.paused) {
      ensureGraph();
      audio.play().catch(() => undefined);
    } else {
      audio.pause();
    }
  }, [activeRef, audio, ensureGraph, playPlaylist, showToast, startNode]);

  /** Avanza al siguiente nodo: cur.node.next — la ventaja de la lista doblemente enlazada. */
  const goNext = useCallback(
    (auto: boolean) => {
      const cur = currentRef.current;
      if (!cur) return;
      const pl = getPlaylist(cur.pid);
      if (!pl || cur.node.owner !== pl.list) {
        stopAudio();
        setCurrent(null);
        return;
      }
      let target: ListNode<Song> | null;
      if (shuffleRef.current && pl.list.size > 1) {
        target = randomNode(pl.list, cur.node);
        historyRef.current.push(cur);
        if (historyRef.current.length > 60) historyRef.current.shift();
      } else {
        target = cur.node.next ?? (repeatRef.current === 'all' || !auto ? pl.list.head : null);
      }
      if (!target) {
        // Fin de la lista con "repetir" apagado: se detiene y deja la canción lista.
        audio.pause();
        audio.currentTime = 0;
        setIsPlaying(false);
        return;
      }
      void startNode(cur.pid, target);
    },
    [audio, getPlaylist, repeatRef, setCurrent, shuffleRef, startNode, stopAudio],
  );

  /** Retrocede al nodo anterior: cur.node.prev. Si ya avanzó >3 s, reinicia la canción. */
  const goPrev = useCallback(() => {
    const cur = currentRef.current;
    if (!cur) return;
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    const pl = getPlaylist(cur.pid);
    if (!pl || cur.node.owner !== pl.list) {
      audio.currentTime = 0;
      return;
    }
    if (shuffleRef.current) {
      while (historyRef.current.length) {
        const h = historyRef.current.pop() as Current;
        if (h.node.owner && h.node !== cur.node) {
          void startNode(h.pid, h.node);
          return;
        }
      }
    }
    const target = cur.node.prev ?? (repeatRef.current === 'all' ? pl.list.tail : null);
    if (target) void startNode(cur.pid, target);
    else audio.currentTime = 0;
  }, [audio, getPlaylist, repeatRef, shuffleRef, startNode]);

  const next = useCallback(() => goNext(false), [goNext]);
  const prev = useCallback(() => goPrev(), [goPrev]);
  const goNextRef = useLatest(goNext);

  const seekTo = useCallback(
    (seconds: number) => {
      if (!Number.isFinite(audio.duration)) return;
      audio.currentTime = Math.max(0, Math.min(audio.duration, seconds));
    },
    [audio],
  );

  const seekBy = useCallback(
    (seconds: number) => {
      if (!Number.isFinite(audio.duration)) return;
      seekTo(audio.currentTime + seconds);
    },
    [audio, seekTo],
  );

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    setMuted(false);
  }, []);
  const toggleMute = useCallback(() => setMuted((m) => !m), []);
  const toggleShuffle = useCallback(() => setShuffle((s) => !s), []);
  const cycleRepeat = useCallback(
    () => setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off')),
    [],
  );

  // ───────────── playlists ─────────────

  const setActive = useCallback((id: string) => setActiveId(id), []);

  const createPlaylist = useCallback(() => {
    const id = uid();
    const count = playlistsRef.current.length;
    const pl = new Playlist(id, `Mi playlist ${count + 1}`, HUES[count % HUES.length]);
    setPlaylists((prev) => [...prev, pl]);
    setActiveId(id);
    return id;
  }, [playlistsRef]);

  const renamePlaylist = useCallback(
    (id: string, name: string) => {
      const pl = getPlaylist(id);
      const clean = name.trim();
      if (!pl || !clean) return;
      pl.name = clean.slice(0, 60);
      touch();
    },
    [getPlaylist, touch],
  );

  const deletePlaylist = useCallback(
    (id: string) => {
      if (currentRef.current?.pid === id) {
        stopAudio();
        setCurrent(null);
      }
      const remaining = playlistsRef.current.filter((p) => p.id !== id);
      const nextList = remaining.length ? remaining : [new Playlist(uid(), 'Mi primera playlist', 28)];
      setPlaylists(nextList);
      if (activeRef.current.id === id) setActiveId(nextList[0].id);
    },
    [activeRef, playlistsRef, setCurrent, stopAudio],
  );

  // ───────────── canciones dentro de una playlist ─────────────

  /** Inserta una canción junto a `ref` (antes o después). Sin `ref`, va al final. */
  const insertSong = useCallback(
    (pid: string, song: Song, ref: ListNode<Song> | null, placement: Placement) => {
      const pl = getPlaylist(pid);
      if (!pl) return null;
      const node = ref && ref.owner === pl.list ? pl.list.insertRelative(ref, song, placement) : pl.list.append(song);
      touch();
      flash(node.id);
      return node;
    },
    [flash, getPlaylist, touch],
  );

  const addToPlaylist = useCallback(
    (pid: string, song: Song) => {
      const pl = getPlaylist(pid);
      if (!pl) return;
      insertSong(pid, song, null, 'after');
      showToast(`«${song.title}» agregada a ${pl.name}`);
    },
    [getPlaylist, insertSong, showToast],
  );

  const moveNode = useCallback(
    (pid: string, node: ListNode<Song>, ref: ListNode<Song> | null, placement: Placement) => {
      const pl = getPlaylist(pid);
      if (!pl || node.owner !== pl.list) return;
      const target = ref ?? pl.list.tail;
      if (!target) return;
      const place: Placement = ref ? placement : 'after';
      if (pl.list.moveNode(node, target, place)) {
        touch();
        flash(node.id);
      }
    },
    [flash, getPlaylist, touch],
  );

  const removeNodeInternal = useCallback(
    (pid: string, node: ListNode<Song>, withUndo: boolean) => {
      const pl = getPlaylist(pid);
      if (!pl || node.owner !== pl.list) return;
      const index = pl.list.indexOf(node);
      const song = node.value;
      const wasCurrent = currentRef.current?.node === node;
      const wasPlaying = !audio.paused;
      // Guardamos el vecino ANTES de desenlazar: después prev/next quedan en null.
      const replacement = node.next ?? node.prev;

      pl.list.removeNode(node);
      touch();

      if (wasCurrent) {
        if (replacement) {
          if (wasPlaying) void startNode(pid, replacement);
          else setCurrent({ pid, node: replacement });
        } else {
          stopAudio();
          setCurrent(null);
        }
      }

      if (withUndo) {
        showToast(`«${song.title}» eliminada`, () => {
          const restored = pl.list.insertAt(index, song);
          touch();
          flash(restored.id);
        });
      }
    },
    [audio, flash, getPlaylist, setCurrent, showToast, startNode, stopAudio, touch],
  );

  const removeNode = useCallback(
    (pid: string, node: ListNode<Song>) => removeNodeInternal(pid, node, true),
    [removeNodeInternal],
  );

  const reversePlaylist = useCallback(
    (pid: string) => {
      const pl = getPlaylist(pid);
      if (!pl) return;
      pl.list.reverse();
      touch();
    },
    [getPlaylist, touch],
  );

  const sortPlaylist = useCallback(
    (pid: string, key: SortKey) => {
      const pl = getPlaylist(pid);
      if (!pl) return;
      pl.list.sort((a, b) =>
        key === 'duration' ? a.duration - b.duration : a[key].localeCompare(b[key], 'es', { sensitivity: 'base' }),
      );
      touch();
    },
    [getPlaylist, touch],
  );

  // ───────────── música subida por el usuario ─────────────

  const addUploads = useCallback(
    async (files: File[]): Promise<Song[]> => {
      const audioFiles = files.filter(isAudioFile);
      if (audioFiles.length === 0) {
        showToast('Solo puedo agregar archivos de audio (MP3, WAV, M4A…)');
        return [];
      }
      const added: Song[] = [];
      for (const file of audioFiles) {
        const id = `u-${uid()}`;
        try {
          await saveBlob(id, file);
        } catch {
          showToast('Tu navegador no permite guardar archivos aquí');
          continue;
        }
        const duration = await readAudioDuration(file);
        added.push({
          id,
          title: titleFromFilename(file.name),
          artist: 'Mi música',
          album: 'Subidas',
          genre: 'Mi música',
          duration,
          hue: hash(id) % 360,
          kind: 'upload',
        });
      }
      if (added.length) {
        setUploads((prev) => [...prev, ...added]);
        showToast(added.length === 1 ? `«${added[0].title}» lista para usar` : `${added.length} canciones nuevas en Mi música`);
      }
      return added;
    },
    [showToast],
  );

  const deleteUpload = useCallback(
    (id: string) => {
      for (const pl of playlistsRef.current) {
        for (const node of pl.list.nodeArray()) {
          if (node.value.id === id) removeNodeInternal(pl.id, node, false);
        }
      }
      forgetSongUrl(id);
      void deleteBlob(id).catch(() => undefined);
      setUploads((prev) => prev.filter((s) => s.id !== id));
    },
    [playlistsRef, removeNodeInternal],
  );

  const setAccent = useCallback((a: AccentName) => {
    document.documentElement.dataset.accent = a;
    setAccentState(a);
  }, []);

  // ───────────── efectos ─────────────

  useEffect(() => {
    const onEnded = () => {
      if (repeatRef.current === 'one') {
        audio.currentTime = 0;
        audio.play().catch(() => undefined);
      } else {
        goNextRef.current(true);
      }
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onYtError = () => {
      showToast('Ese video no permite reproducirse fuera de YouTube. Paso al siguiente.');
      goNextRef.current(true);
    };
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('yterror', onYtError);
    return () => {
      audio.removeEventListener('yterror', onYtError);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, [audio, goNextRef, repeatRef, showToast]);

  useEffect(() => {
    audio.volume = muted ? 0 : volume;
  }, [audio, muted, volume]);

  // Persistencia
  useEffect(() => {
    const web = new Map<string, Song>();
    for (const p of playlists) for (const s of p.list) if (s.kind === 'web' || s.kind === 'youtube') web.set(s.id, s);
    const data: Saved = {
      web: [...web.values()],
      playlists: playlists.map((p) => ({
        id: p.id,
        name: p.name,
        hue: p.hue,
        songIds: p.list.toArray().map((s) => s.id),
      })),
      activeId: active.id,
      uploads,
      volume,
      shuffle,
      repeat,
      accent,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* almacenamiento lleno o bloqueado */
    }
  }, [version, playlists, active.id, uploads, volume, shuffle, repeat, accent]);

  // Título de la pestaña + controles del sistema (teclas multimedia, pantalla de bloqueo)
  const song = current?.node.value ?? null;
  useEffect(() => {
    document.title = song && isPlaying ? `▶ ${song.title} · VillaMusic` : 'VillaMusic · Música con alma de Pasto';
    if ('mediaSession' in navigator && song && typeof MediaMetadata !== 'undefined') {
      navigator.mediaSession.metadata = new MediaMetadata({ title: song.title, artist: song.artist, album: song.album });
    }
  }, [song, isPlaying]);

  const controls = useLatest({ togglePlay, next, prev, seekBy });
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    const set = (action: MediaSessionAction, handler: MediaSessionActionHandler) => {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        /* acción no soportada */
      }
    };
    set('play', () => controls.current.togglePlay());
    set('pause', () => controls.current.togglePlay());
    set('nexttrack', () => controls.current.next());
    set('previoustrack', () => controls.current.prev());
    set('seekbackward', () => controls.current.seekBy(-10));
    set('seekforward', () => controls.current.seekBy(10));
  }, [controls]);

  const store: Store = {
    version,
    playlists,
    active,
    setActive,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
    insertSong,
    addToPlaylist,
    moveNode,
    removeNode,
    reversePlaylist,
    sortPlaylist,
    catalog: CATALOG,
    uploads,
    addUploads,
    deleteUpload,
    current,
    isPlaying,
    isLoading,
    shuffle,
    repeat,
    volume,
    muted,
    audio,
    getAnalyser,
    playNode,
    playPlaylist,
    togglePlay,
    next,
    prev,
    seekBy,
    seekTo,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    dragRef,
    lastAdded,
    toast,
    showToast,
    dismissToast,
    accent,
    setAccent,
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

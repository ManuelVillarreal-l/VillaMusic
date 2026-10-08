import { useEffect, useRef, useState } from 'react';
import { useStore } from './store';
import { Sidebar } from './components/Sidebar';
import { PlaylistView } from './components/PlaylistView';
import { Discover } from './components/Discover';
import { PlayerBar } from './components/PlayerBar';
import { VideoPanel } from './components/VideoPanel';
import { LyricsPanel } from './components/LyricsPanel';
import { DjDialog } from './components/DjDialog';
import { ShareImport } from './components/ShareImport';
import { isVideoSong } from './types';
import { ToastHost } from './components/Toast';
import { cls } from './lib/utils';
import { useBackClose } from './lib/useBackClose';

/**
 * Con el teclado (Tab) un botón enfocado se activa con Espacio, como siempre.
 * Si el foco llegó por un clic de mouse, Espacio sigue siendo play/pausa.
 */
function spaceBelongsToElement(el: HTMLElement | null, focusedByKeyboard: boolean): boolean {
  const tag = el?.tagName;
  if (tag === 'A' || tag === 'SUMMARY') return true;
  if (tag === 'BUTTON') return focusedByKeyboard;
  return false;
}

/** Atajos: Espacio play/pausa · ←/→ ±10 s · Shift+←/→ anterior/siguiente · M silencio · S aleatorio · R repetir */
function useShortcuts() {
  const s = useStore();
  const byKeyboard = useRef(false);
  useEffect(() => {
    const isTyping = (el: HTMLElement | null) => {
      const tag = el?.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!el?.isContentEditable;
    };

    const onPointer = () => {
      byKeyboard.current = false;
    };

    // El navegador "hace clic" en el botón enfocado al soltar Espacio: lo evitamos.
    const onKeyUp = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key === ' ' && el?.tagName === 'BUTTON' && !spaceBelongsToElement(el, byKeyboard.current)) e.preventDefault();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') byKeyboard.current = true;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (isTyping(el)) return;

      switch (e.key) {
        case ' ':
          if (spaceBelongsToElement(el, byKeyboard.current)) return;
          e.preventDefault();
          if (!e.repeat) s.togglePlay();
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) s.next();
          else s.seekBy(10);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) s.prev();
          else s.seekBy(-10);
          break;
        case 'm':
        case 'M':
          s.toggleMute();
          break;
        case 's':
        case 'S':
          s.toggleShuffle();
          break;
        case 'r':
        case 'R':
          s.cycleRepeat();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('pointerdown', onPointer, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('pointerdown', onPointer, true);
    };
  }, [s]);
}

export default function App() {
  const s = useStore();
  const [discoverOpen, setDiscoverOpen] = useState(false);
  useShortcuts();
  useBackClose(discoverOpen, () => setDiscoverOpen(false));
  useBackClose(s.lyricsOpen, s.toggleLyrics);
  useBackClose(s.djOpen, () => s.setDjOpen(false));
  const hasVideo = isVideoSong(s.current?.node.value);

  return (
    <div className={cls('app', discoverOpen && 'discover-open', hasVideo && 'has-video')}>
      <Sidebar onOpenDiscover={() => setDiscoverOpen(true)} />
      <PlaylistView onOpenDiscover={() => setDiscoverOpen(true)} />
      <VideoPanel />
      <Discover open={discoverOpen} onClose={() => setDiscoverOpen(false)} />
      <LyricsPanel />
      <PlayerBar />
      <DjDialog />
      <ShareImport />
      <ToastHost />
    </div>
  );
}

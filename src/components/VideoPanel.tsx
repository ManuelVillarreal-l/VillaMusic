import { useEffect, useRef } from 'react';
import { useStore } from '../store';

/** Panel propio para el video de YouTube: vive dentro del diseño, no tapa ningún botón. */
export function VideoPanel() {
  const s = useStore();
  const slot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (slot.current) s.audio.attachStage(slot.current);
  }, [s.audio]);

  const song = s.current?.node.value;
  return (
    <section className="video-panel card" aria-label="Video de YouTube">
      <header>
        <b>{song?.kind === 'youtube' ? song.title : 'Video'}</b>
        <small>{song?.kind === 'youtube' ? `${song.artist} · YouTube` : ''}</small>
      </header>
      <div className="video-slot" ref={slot} />
    </section>
  );
}

import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useStore } from '../store';
import { Cover } from './Cover';
import { Visualizer } from './Visualizer';
import {
  IconForward,
  IconLyrics,
  IconMusic,
  IconPause,
  IconPlay,
  IconRepeat,
  IconRepeatOne,
  IconRewind,
  IconShuffle,
  IconSkipNext,
  IconSkipPrev,
  IconVolume,
  IconVolumeMute,
} from './Icons';
import { cls, fmtTime } from '../lib/utils';
import type { Engine } from '../lib/engine';

/** Tiempo actual y duración leídos del <audio> (con rAF mientras suena para que la barra fluya). */
function useAudioTime(audio: Engine, playing: boolean) {
  const [time, setTime] = useState({ cur: 0, dur: 0 });

  useEffect(() => {
    const read = () => {
      const dur = Number.isFinite(audio.duration) ? audio.duration : 0;
      setTime((p) => (Math.abs(p.cur - audio.currentTime) < 0.04 && p.dur === dur ? p : { cur: audio.currentTime, dur }));
    };
    const events = ['timeupdate', 'seeked', 'loadedmetadata', 'durationchange', 'emptied'];
    events.forEach((ev) => audio.addEventListener(ev, read));
    read();
    let raf = 0;
    if (playing) {
      const loop = () => {
        read();
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    return () => {
      events.forEach((ev) => audio.removeEventListener(ev, read));
      cancelAnimationFrame(raf);
    };
  }, [audio, playing]);

  return time;
}

function TenSeconds({ children }: { children: ReactNode }) {
  return (
    <span className="ten">
      {children}
      <i>10</i>
    </span>
  );
}

export function PlayerBar() {
  const s = useStore();
  const song = s.current?.node.value ?? null;
  const { cur, dur } = useAudioTime(s.audio, s.isPlaying);
  const total = dur || song?.duration || 0;
  const pct = total ? Math.min(100, (cur / total) * 100) : 0;
  const level = s.muted ? 0 : s.volume;
  const fromList = s.current ? s.playlists.find((p) => p.id === s.current?.pid) : undefined;
  const pctStyle = (value: number) => ({ '--p': `${value}%` }) as CSSProperties;

  return (
    <footer className="player card">
      <div className="np">
        {song ? (
          <Cover song={song} size={60} radius={16} />
        ) : (
          <div className="np-empty">
            <IconMusic size={24} />
          </div>
        )}
        <div className="np-text">
          <b className="np-title">{song ? song.title : 'Nada sonando todavía'}</b>
          <span className="np-artist">{song ? `${song.artist} · ${song.album}` : 'Elige una canción de tu playlist'}</span>
          {fromList && (
            <button className="np-from" onClick={() => s.setActive(fromList.id)} title="Ir a la playlist que está sonando">
              Sonando desde <b>{fromList.name}</b>
            </button>
          )}
        </div>
        <button
          className={cls('icon-btn lyrics-btn', s.lyricsOpen && 'is-on')}
          onClick={s.toggleLyrics}
          disabled={!song}
          title="Letra sincronizada"
          aria-label="Letra de la canción"
          aria-pressed={s.lyricsOpen}
        >
          <IconLyrics size={20} />
        </button>
      </div>

      <div className="transport">
        <div className="controls">
          <button
            className={cls('icon-btn', s.shuffle && 'is-on')}
            onClick={s.toggleShuffle}
            title="Aleatorio (S)"
            aria-label="Aleatorio"
            aria-pressed={s.shuffle}
          >
            <IconShuffle size={19} />
          </button>
          <button className="icon-btn icon-btn-lg" onClick={s.prev} disabled={!song} title="Anterior (Shift + ←)" aria-label="Canción anterior">
            <IconSkipPrev size={22} />
          </button>
          <button className="icon-btn seek-btn" onClick={() => s.seekBy(-10)} disabled={!song} title="Retroceder 10 s (←)" aria-label="Retroceder 10 segundos">
            <TenSeconds>
              <IconRewind size={28} strokeWidth={1.6} />
            </TenSeconds>
          </button>
          <button
            className={cls('play-btn', s.isLoading && 'is-loading')}
            onClick={s.togglePlay}
            title="Reproducir / pausar (Espacio)"
            aria-label={s.isPlaying ? 'Pausar' : 'Reproducir'}
          >
            {s.isLoading ? <span className="spinner" /> : s.isPlaying ? <IconPause size={24} /> : <IconPlay size={24} />}
          </button>
          <button className="icon-btn seek-btn" onClick={() => s.seekBy(10)} disabled={!song} title="Adelantar 10 s (→)" aria-label="Adelantar 10 segundos">
            <TenSeconds>
              <IconForward size={28} strokeWidth={1.6} />
            </TenSeconds>
          </button>
          <button className="icon-btn icon-btn-lg" onClick={s.next} disabled={!song} title="Siguiente (Shift + →)" aria-label="Siguiente canción">
            <IconSkipNext size={22} />
          </button>
          <button
            className={cls('icon-btn', s.repeat !== 'off' && 'is-on')}
            onClick={s.cycleRepeat}
            title={s.repeat === 'off' ? 'Repetir: apagado (R)' : s.repeat === 'all' ? 'Repetir toda la playlist (R)' : 'Repetir esta canción (R)'}
            aria-label="Repetir"
          >
            {s.repeat === 'one' ? <IconRepeatOne size={19} /> : <IconRepeat size={19} />}
          </button>
        </div>

        <div className="seek">
          <span className="time">{fmtTime(cur)}</span>
          <input
            type="range"
            className="range"
            min={0}
            max={total || 1}
            step={0.1}
            value={Math.min(cur, total || 1)}
            style={pctStyle(pct)}
            disabled={!song || !dur}
            onChange={(e) => s.seekTo(Number(e.target.value))}
            aria-label="Progreso de la canción"
          />
          <span className="time">{fmtTime(total)}</span>
        </div>
      </div>

      <div className="extras">
        <Visualizer />
        <div className="volume">
          <button className="icon-btn" onClick={s.toggleMute} title="Silenciar (M)" aria-label={s.muted ? 'Quitar silencio' : 'Silenciar'}>
            {level === 0 ? <IconVolumeMute size={20} /> : <IconVolume size={20} />}
          </button>
          <input
            type="range"
            className="range range-sm"
            min={0}
            max={1}
            step={0.01}
            value={level}
            style={pctStyle(level * 100)}
            onChange={(e) => s.setVolume(Number(e.target.value))}
            aria-label="Volumen"
          />
        </div>
      </div>
    </footer>
  );
}

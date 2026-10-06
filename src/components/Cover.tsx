import type { CSSProperties } from 'react';
import type { Song } from '../types';
import type { Playlist } from '../store';
import { hash } from '../lib/utils';
import { IconList } from './Icons';

/** Portada generada: degradado según el matiz de la canción + un motivo de Pasto. */
export function Cover({ song, size = 44, radius = 12 }: { song: Song; size?: number; radius?: number }) {
  const h = song.hue;
  const variant = hash(song.id) % 4;
  const style: CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius,
    background: `linear-gradient(135deg, hsl(${h} 86% 58%), hsl(${(h + 46) % 360} 92% 72%))`,
  };
  const dark = `hsl(${h} 55% 30% / .28)`;
  return (
    <div className="cover" style={style} aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        {variant === 0 && (
          <>
            <circle cx="74" cy="28" r="14" fill="#fff" opacity=".6" />
            <polygon points="-6,104 50,34 106,104" fill={dark} />
            <polygon points="50,34 40,50 50,46 60,52" fill="#fff" opacity=".85" />
          </>
        )}
        {variant === 1 && (
          <>
            <path d="M-4 62 Q 14 44 32 62 T 68 62 T 104 62" fill="none" stroke="#fff" strokeWidth="7" opacity=".6" />
            <path d="M-4 82 Q 14 64 32 82 T 68 82 T 104 82" fill="none" stroke="#fff" strokeWidth="7" opacity=".38" />
            <circle cx="30" cy="26" r="11" fill="#fff" opacity=".55" />
          </>
        )}
        {variant === 2 && (
          <>
            <circle cx="22" cy="86" r="62" fill="none" stroke="#fff" strokeWidth="6" opacity=".28" />
            <circle cx="22" cy="86" r="42" fill="none" stroke="#fff" strokeWidth="6" opacity=".4" />
            <circle cx="22" cy="86" r="22" fill="#fff" opacity=".55" />
            <circle cx="80" cy="22" r="7" fill={dark} />
          </>
        )}
        {variant === 3 && (
          <>
            <polygon points="0,0 22,0 11,26" fill="#fff" opacity=".7" />
            <polygon points="22,0 44,0 33,26" fill={dark} />
            <polygon points="44,0 66,0 55,26" fill="#fff" opacity=".7" />
            <polygon points="66,0 88,0 77,26" fill={dark} />
            <polygon points="88,0 110,0 99,26" fill="#fff" opacity=".7" />
            <circle cx="50" cy="72" r="20" fill="#fff" opacity=".5" />
            <rect x="42" y="64" width="16" height="16" rx="8" fill={dark} />
          </>
        )}
      </svg>
      {song.artwork && (
        <img src={song.artwork} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = 'none')} />
      )}
    </div>
  );
}

/** Portada de playlist: mosaico de 4, una portada, o degradado con ícono si está vacía. */
export function PlaylistCover({ playlist, size = 44, radius = 12 }: { playlist: Playlist; size?: number; radius?: number }) {
  const songs: Song[] = [];
  for (const s of playlist.list) {
    songs.push(s);
    if (songs.length === 4) break;
  }
  if (songs.length >= 4) {
    const half = size / 2;
    return (
      <div className="cover-mosaic" style={{ width: size, height: size, borderRadius: radius }}>
        {songs.map((s, i) => (
          <Cover key={i} song={s} size={half} radius={0} />
        ))}
      </div>
    );
  }
  if (songs.length > 0) return <Cover song={songs[0]} size={size} radius={radius} />;
  return (
    <div
      className="cover cover-empty"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: `linear-gradient(135deg, hsl(${playlist.hue} 80% 90%), hsl(${(playlist.hue + 40) % 360} 85% 82%))`,
        color: `hsl(${playlist.hue} 60% 38%)`,
      }}
    >
      <IconList size={Math.round(size * 0.42)} />
    </div>
  );
}

export function Equalizer({ paused = false }: { paused?: boolean }) {
  return (
    <span className={`eq${paused ? ' is-paused' : ''}`} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

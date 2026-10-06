import type { ScaleName, Song, StyleName, SynthSpec, WaveForm } from '../types';
import { durationOf } from './synth';

interface Def {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  hue: number;
  bpm: number;
  root: number;
  scale: ScaleName;
  style: StyleName;
  lead: WaveForm;
  bars: number;
}

const DEFS: Def[] = [
  { id: 'c01', title: 'Galeras al Amanecer', artist: 'Manuel Villarreal', album: 'Volcán', genre: 'Ambient', hue: 18, bpm: 66, root: 57, scale: 'dorian', style: 'ambient', lead: 'sine', bars: 14 },
  { id: 'c02', title: 'Carnaval de Negros y Blancos', artist: 'Los del Galeras', album: 'Pasto en Fiesta', genre: 'Cumbia', hue: 340, bpm: 96, root: 60, scale: 'major', style: 'cumbia', lead: 'square', bars: 18 },
  { id: 'c03', title: 'Laguna de la Cocha', artist: 'Cocha Lofi', album: 'Agua Quieta', genre: 'Lofi', hue: 188, bpm: 76, root: 55, scale: 'dorian', style: 'lofi', lead: 'triangle', bars: 16 },
  { id: 'c04', title: 'Barniz de Pasto', artist: 'Villa Beats', album: 'Mopa-Mopa', genre: 'Pop', hue: 42, bpm: 108, root: 62, scale: 'major', style: 'pop', lead: 'square', bars: 20 },
  { id: 'c05', title: 'Plaza de Nariño', artist: 'Nariño Synth', album: 'Centro', genre: 'Synthwave', hue: 282, bpm: 104, root: 57, scale: 'minor', style: 'synthwave', lead: 'saw', bars: 18 },
  { id: 'c06', title: 'Páramo Nocturno', artist: 'Cocha Lofi', album: 'Agua Quieta', genre: 'Ambient', hue: 232, bpm: 62, root: 52, scale: 'minor', style: 'ambient', lead: 'sine', bars: 14 },
  { id: 'c07', title: 'Tardes en Sandoná', artist: 'Villa Beats', album: 'Mopa-Mopa', genre: 'Lofi', hue: 96, bpm: 82, root: 58, scale: 'major', style: 'lofi', lead: 'triangle', bars: 16 },
  { id: 'c08', title: 'Santuario de Las Lajas', artist: 'Manuel Villarreal', album: 'Volcán', genre: 'Ambient', hue: 206, bpm: 60, root: 55, scale: 'pentatonic', style: 'ambient', lead: 'sine', bars: 14 },
  { id: 'c09', title: 'Cumbia del Cuy', artist: 'Los del Galeras', album: 'Pasto en Fiesta', genre: 'Cumbia', hue: 26, bpm: 100, root: 57, scale: 'dorian', style: 'cumbia', lead: 'square', bars: 20 },
  { id: 'c10', title: 'Neón en la Panamericana', artist: 'Nariño Synth', album: 'Centro', genre: 'Synthwave', hue: 312, bpm: 112, root: 53, scale: 'minor', style: 'synthwave', lead: 'saw', bars: 20 },
  { id: 'c11', title: 'Ñapanga Pop', artist: 'Manuel Villarreal', album: 'Volcán', genre: 'Pop', hue: 160, bpm: 118, root: 64, scale: 'major', style: 'pop', lead: 'triangle', bars: 22 },
  { id: 'c12', title: 'Morasurco al Atardecer', artist: 'Cocha Lofi', album: 'Agua Quieta', genre: 'Lofi', hue: 12, bpm: 78, root: 60, scale: 'pentatonic', style: 'lofi', lead: 'sine', bars: 16 },
  { id: 'c13', title: 'Brisa de Tumaco', artist: 'Los del Galeras', album: 'Pasto en Fiesta', genre: 'Cumbia', hue: 198, bpm: 94, root: 59, scale: 'major', style: 'cumbia', lead: 'triangle', bars: 18 },
  { id: 'c14', title: 'Río Guáitara', artist: 'Cocha Lofi', album: 'Agua Quieta', genre: 'Lofi', hue: 150, bpm: 72, root: 50, scale: 'dorian', style: 'lofi', lead: 'triangle', bars: 16 },
  { id: 'c15', title: 'Empanadas de Pipián', artist: 'Villa Beats', album: 'Mopa-Mopa', genre: 'Pop', hue: 52, bpm: 110, root: 62, scale: 'major', style: 'pop', lead: 'square', bars: 22 },
  { id: 'c16', title: 'Domingo en Pasto', artist: 'Manuel Villarreal', album: 'Volcán', genre: 'Lofi', hue: 70, bpm: 88, root: 56, scale: 'phrygian', style: 'lofi', lead: 'sine', bars: 16 },
];

function toSong(d: Def, index: number): Song {
  const spec: SynthSpec = {
    seed: 7919 * (index + 3) + d.bpm,
    bpm: d.bpm,
    root: d.root,
    scale: d.scale,
    style: d.style,
    lead: d.lead,
    bars: d.bars,
  };
  return {
    id: d.id,
    title: d.title,
    artist: d.artist,
    album: d.album,
    genre: d.genre,
    hue: d.hue,
    kind: 'synth',
    spec,
    duration: durationOf(spec),
  };
}

export const CATALOG: Song[] = DEFS.map(toSong);

export const GENRES: string[] = Array.from(new Set(CATALOG.map((s) => s.genre)));

/** Playlists con las que arranca la app la primera vez. */
export const DEFAULT_PLAYLISTS: { id: string; name: string; hue: number; songIds: string[] }[] = [
  { id: 'p-mananas', name: 'Mañanas en Pasto', hue: 28, songIds: ['c01', 'c03', 'c07', 'c12', 'c14'] },
  { id: 'p-carnaval', name: 'Fiesta de Carnaval', hue: 340, songIds: ['c02', 'c09', 'c04', 'c13', 'c15'] },
  { id: 'p-noches', name: 'Noches de Galeras', hue: 262, songIds: ['c06', 'c05', 'c10', 'c08'] },
];

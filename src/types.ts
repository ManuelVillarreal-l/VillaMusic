export type WaveForm = 'sine' | 'triangle' | 'square' | 'saw';
export type ScaleName = 'major' | 'minor' | 'dorian' | 'phrygian' | 'pentatonic';
export type StyleName = 'lofi' | 'cumbia' | 'ambient' | 'synthwave' | 'pop';

/** Receta para que el sintetizador componga una canción de forma determinista. */
export interface SynthSpec {
  seed: number;
  bpm: number;
  /** Nota MIDI raíz (60 = Do central). */
  root: number;
  scale: ScaleName;
  style: StyleName;
  lead: WaveForm;
  /** Compases de 4/4. */
  bars: number;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  /** Segundos. */
  duration: number;
  /** Matiz 0–360 para generar la portada. */
  hue: number;
  /** synth = compuesta al vuelo · upload = archivo del usuario · web = vista previa encontrada en iTunes. */
  kind: 'synth' | 'upload' | 'web' | 'youtube';
  spec?: SynthSpec;
  /** Solo kind 'web': URL del fragmento de 30 s (iTunes). */
  previewUrl?: string;
  /** Solo kind 'web': URL de la canción completa (Audius). */
  streamUrl?: string;
  /** Solo kind 'youtube': id del video. */
  videoId?: string;
  /** Solo kind 'web' o 'youtube': portada real. */
  artwork?: string;
}

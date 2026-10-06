export function cls(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** 83 → "1:23" */
export function fmtTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/** 3725 → "1 h 2 min" · 540 → "9 min" */
export function fmtLong(seconds: number): string {
  const total = Math.round(seconds / 60);
  if (total < 1) return seconds > 0 ? 'menos de 1 min' : '0 min';
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? `${h} h ${m} min` : `${m} min`;
}

export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const AUDIO_EXT = /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|webm)$/i;

export function isAudioFile(file: File): boolean {
  return file.type.startsWith('audio/') || AUDIO_EXT.test(file.name);
}

export function titleFromFilename(name: string): string {
  return name.replace(AUDIO_EXT, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Sin título';
}

export function readAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const probe = new Audio();
    probe.preload = 'metadata';
    const done = (d: number) => {
      URL.revokeObjectURL(url);
      resolve(d);
    };
    probe.onloadedmetadata = () => done(Number.isFinite(probe.duration) ? Math.round(probe.duration) : 0);
    probe.onerror = () => done(0);
    probe.src = url;
  });
}

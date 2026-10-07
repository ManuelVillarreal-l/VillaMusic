/** Letras sincronizadas en formato LRC: "[01:23.45] texto". */
export interface LyricLine {
  t: number;
  text: string;
}

export function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    if (stamps.length === 0) continue;
    const text = raw.replace(/\[[^\]]*\]/g, '').trim();
    for (const m of stamps) {
      const frac = m[3] ? Number(`0.${m[3]}`) : 0;
      lines.push({ t: Number(m[1]) * 60 + Number(m[2]) + frac, text });
    }
  }
  return lines.sort((a, b) => a.t - b.t);
}

/** Índice de la línea que suena en el segundo `t` (-1 si aún no empieza). Búsqueda binaria. */
export function activeLine(lines: LyricLine[], t: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].t <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

/** Limpia títulos típicos de YouTube: "Artista - Tema (Official Video) [HD]" → { artist, title }. */
export function cleanTrack(title: string, channel: string): { artist: string; title: string } {
  let t = title
    .replace(/[([{][^)\]}]*(official|oficial|video|lyric|letra|audio|hd|4k|visualizer|remaster|en vivo|live|clip)[^)\]}]*[)\]}]/gi, '')
    .replace(/\b(official|oficial)\s+(music\s+)?(video|audio|lyric video)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  let artist = channel.replace(/\s*-\s*topic$/i, '').replace(/vevo$/i, '').trim();
  const m = /^(.{1,60}?)\s+[-–—]\s+(.{1,100})$/.exec(t);
  if (m) {
    artist = m[1].trim();
    t = m[2].trim();
  }
  return { artist, title: t.replace(/\s*[-–—|]\s*$/, '') };
}

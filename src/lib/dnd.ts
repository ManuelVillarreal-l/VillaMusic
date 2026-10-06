import type { DragEvent } from 'react';
import type { Song } from '../types';

/** Imagen que acompaña al cursor mientras arrastras una canción. */
export function setDragGhost(e: DragEvent, song: Song): void {
  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  const dot = document.createElement('span');
  dot.className = 'drag-ghost-dot';
  dot.style.background = `linear-gradient(135deg, hsl(${song.hue} 86% 58%), hsl(${(song.hue + 46) % 360} 92% 72%))`;
  const label = document.createElement('span');
  label.textContent = song.title;
  ghost.append(dot, label);
  document.body.appendChild(ghost);
  e.dataTransfer.setDragImage(ghost, 20, 20);
  window.setTimeout(() => ghost.remove(), 0);
}

/** ¿Se están arrastrando archivos desde el computador? */
export function hasFiles(e: DragEvent): boolean {
  return Array.from(e.dataTransfer.types).includes('Files');
}

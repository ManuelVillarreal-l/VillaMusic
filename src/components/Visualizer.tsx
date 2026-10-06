import { useEffect, useRef } from 'react';
import { useStore } from '../store';

const W = 132;
const H = 40;
const BARS = 22;
const F_MIN = 70;
const F_MAX = 9000;

/** Ecualizador en vivo: lee las frecuencias reales del audio con un AnalyserNode (escala logarítmica). */
export function Visualizer() {
  const { getAnalyser, isPlaying, accent } = useStore();
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const css = getComputedStyle(document.documentElement);
    const a = css.getPropertyValue('--accent').trim() || '#FF6B35';
    const b = css.getPropertyValue('--accent-2').trim() || '#FFB627';
    const grad = ctx.createLinearGradient(0, H, 0, 0);
    grad.addColorStop(0, a);
    grad.addColorStop(1, b);

    const slot = W / BARS;
    const newBuffer = (n: number) => new Uint8Array(n);
    let data: ReturnType<typeof newBuffer> = newBuffer(0);
    let ranges: [number, number][] = [];
    let raf = 0;

    const prepare = (analyser: AnalyserNode) => {
      data = newBuffer(analyser.frequencyBinCount);
      const size = data.length;
      const binHz = analyser.context.sampleRate / analyser.fftSize;
      const edge = (i: number) => F_MIN * Math.pow(F_MAX / F_MIN, i / BARS);
      ranges = Array.from({ length: BARS }, (_, i) => {
        const from = Math.max(1, Math.round(edge(i) / binHz));
        const to = Math.max(from + 1, Math.round(edge(i + 1) / binHz));
        return [from, Math.min(to, size)] as [number, number];
      });
    };

    const draw = (live: boolean) => {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = grad;
      const analyser = live ? getAnalyser() : null;
      if (analyser) {
        if (data.length === 0) prepare(analyser);
        analyser.getByteFrequencyData(data);
      }
      for (let i = 0; i < BARS; i++) {
        let v = 0.1 + 0.04 * Math.sin(i * 0.9);
        if (analyser && data.length > 0) {
          const [from, to] = ranges[i];
          let sum = 0;
          for (let k = from; k < to; k++) sum += data[k];
          const avg = sum / (to - from) / 255;
          // Las frecuencias altas traen menos energía: se compensa para que toda la barra se mueva.
          v = Math.min(1, Math.pow(avg, 1.15) * (1 + (i / BARS) * 1.4));
        }
        const h = Math.max(3, v * H);
        const x = i * slot + 1;
        const r = Math.min(2, (slot - 2) / 2);
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') ctx.roundRect(x, H - h, slot - 2, h, r);
        else ctx.rect(x, H - h, slot - 2, h);
        ctx.fill();
      }
    };

    if (!isPlaying) {
      draw(false);
      return;
    }
    const loop = () => {
      draw(true);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // `accent` fuerza a releer los colores del tema cuando cambian.
  }, [getAnalyser, isPlaying, accent]);

  return <canvas ref={ref} className="viz" style={{ width: W, height: H }} aria-hidden="true" />;
}

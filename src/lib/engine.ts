/**
 * Motor de reproducción: presenta una sola "interfaz de <audio>" (currentTime, duration,
 * play, pause, eventos…) y por dentro usa un <audio> real o el reproductor oficial de YouTube.
 * Así el resto de la app no necesita saber de dónde viene cada canción.
 */
interface YTPlayer {
  loadVideoById(id: string): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  setVolume(v: number): void;
  getPlayerState(): number;
}

interface YTApi {
  Player: new (
    el: HTMLElement,
    opts: {
      width: string;
      height: string;
      playerVars: Record<string, number>;
      events: {
        onReady: () => void;
        onStateChange: (e: { data: number }) => void;
        onError: (e: { data: number }) => void;
      };
    },
  ) => YTPlayer;
}

type YTWindow = { YT?: YTApi; onYouTubeIframeAPIReady?: () => void };

let apiPromise: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  const w = window as unknown as YTWindow;
  if (w.YT?.Player) return Promise.resolve();
  if (!apiPromise) {
    apiPromise = new Promise<void>((resolve, reject) => {
      const prev = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve();
      };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.onerror = () => {
        apiPromise = null;
        reject(new Error('No se pudo cargar YouTube'));
      };
      document.head.appendChild(script);
    });
  }
  return apiPromise;
}

const FORWARDED = ['timeupdate', 'seeked', 'loadedmetadata', 'durationchange', 'emptied', 'ended', 'play', 'pause'];

export class Engine extends EventTarget {
  /** El <audio> real (el visualizador se conecta a este). */
  readonly el: HTMLAudioElement;
  private mode: 'audio' | 'youtube' = 'audio';
  private yt: YTPlayer | null = null;
  private ytReady: Promise<YTPlayer> | null = null;
  private stage: HTMLDivElement | null = null;
  private host: HTMLDivElement | null = null;
  private vol = 1;

  constructor() {
    super();
    this.el = new Audio();
    this.el.crossOrigin = 'anonymous'; // el visualizador necesita leer audio remoto
    this.el.preload = 'auto';
    for (const ev of FORWARDED) {
      this.el.addEventListener(ev, () => {
        if (this.mode === 'audio') this.dispatchEvent(new Event(ev));
      });
    }
  }

  /** Coloca el reproductor de YouTube dentro de un panel de la app (su propio espacio, sin flotar). */
  attachStage(container: HTMLElement): void {
    const stage = this.ensureStage();
    if (stage.parentElement !== container) container.appendChild(stage);
  }

  /** El contenedor del video se crea solo cuando hace falta (así el constructor no deja nada suelto). */
  private ensureStage(): HTMLDivElement {
    if (!this.stage) {
      this.stage = document.createElement('div');
      this.stage.className = 'yt-stage';
      this.stage.hidden = true;
      this.host = document.createElement('div');
      this.stage.appendChild(this.host);
      window.setInterval(() => {
        if (this.mode === 'youtube' && !this.paused) this.dispatchEvent(new Event('timeupdate'));
      }, 250);
    }
    return this.stage;
  }

  // ───────── lo mismo que un <audio> ─────────

  get currentTime(): number {
    if (this.mode === 'audio') return this.el.currentTime;
    const t = this.yt?.getCurrentTime?.() ?? 0;
    return Number.isFinite(t) ? t : 0;
  }
  set currentTime(v: number) {
    if (this.mode === 'audio') this.el.currentTime = v;
    else {
      this.yt?.seekTo?.(v, true);
      this.dispatchEvent(new Event('seeked'));
    }
  }

  get duration(): number {
    if (this.mode === 'audio') return this.el.duration;
    const d = this.yt?.getDuration?.() ?? 0;
    return d > 0 ? d : NaN;
  }

  get paused(): boolean {
    if (this.mode === 'audio') return this.el.paused;
    const s = this.yt?.getPlayerState?.();
    return !(s === 1 || s === 3);
  }

  set volume(v: number) {
    this.vol = v;
    this.el.volume = v;
    this.yt?.setVolume?.(Math.round(v * 100));
  }
  get volume(): number {
    return this.vol;
  }

  play(): Promise<void> {
    if (this.mode === 'audio') return this.el.play();
    this.yt?.playVideo?.();
    return Promise.resolve();
  }

  pause(): void {
    if (this.mode === 'audio') this.el.pause();
    else this.yt?.pauseVideo?.();
  }

  // ───────── fuentes ─────────

  /** Reproduce una URL de audio (sintetizada, subida o remota). */
  async playUrl(url: string): Promise<void> {
    this.leaveYouTube();
    this.mode = 'audio';
    this.el.src = url;
    this.el.currentTime = 0;
  }

  /** Reproduce un video de YouTube con el reproductor oficial (visible, como exigen sus reglas). */
  async playYouTube(videoId: string): Promise<void> {
    this.el.pause();
    this.mode = 'youtube';
    const stage = this.ensureStage();
    stage.hidden = false;
    if (!stage.isConnected) document.body.appendChild(stage); // respaldo si aún no hay panel
    // Un instante para que el panel del video aparezca antes de cargar el video.
    await new Promise((r) => setTimeout(r, 60));
    if (this.mode !== 'youtube') return;
    const player = await this.getYouTube();
    if (this.mode !== 'youtube') return;
    player.setVolume(Math.round(this.vol * 100));
    player.loadVideoById(videoId);
  }

  stop(): void {
    this.leaveYouTube();
    this.mode = 'audio';
    this.el.pause();
    this.el.removeAttribute('src');
    this.el.load();
  }

  private leaveYouTube(): void {
    if (this.mode === 'youtube') this.yt?.stopVideo?.();
    if (this.stage) this.stage.hidden = true;
  }

  private getYouTube(): Promise<YTPlayer> {
    if (!this.ytReady) {
      this.ytReady = loadYouTubeApi()
        .then(
          () =>
            new Promise<YTPlayer>((resolve) => {
              const Api = (window as unknown as YTWindow).YT as YTApi;
              const player: YTPlayer = new Api.Player(this.host as HTMLElement, {
                width: '100%',
                height: '100%',
                playerVars: { playsinline: 1, rel: 0, modestbranding: 1, controls: 1 },
                events: {
                  onReady: () => {
                    this.yt = player;
                    resolve(player);
                  },
                  onStateChange: (e) => this.onYouTubeState(e.data),
                  onError: (e) => this.dispatchEvent(new CustomEvent('yterror', { detail: e.data })),
                },
              });
            }),
        )
        .catch((err: unknown) => {
          this.ytReady = null;
          throw err;
        });
    }
    return this.ytReady;
  }

  private onYouTubeState(state: number): void {
    if (this.mode !== 'youtube') return;
    if (state === 1) {
      this.dispatchEvent(new Event('durationchange'));
      this.dispatchEvent(new Event('loadedmetadata'));
      this.dispatchEvent(new Event('play'));
    } else if (state === 2) this.dispatchEvent(new Event('pause'));
    else if (state === 0) this.dispatchEvent(new Event('ended'));
  }
}

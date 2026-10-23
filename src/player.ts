import { Track } from './audius.ts';
import { library } from './library.ts';

export type RepeatMode = 'off' | 'all' | 'one';

export interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  queue: Track[];
  queueIndex: number;
  isLoading: boolean;
  hasError: boolean;
  errorMessage?: string;
}

export class PlayerService {
  private static instance: PlayerService;
  private audio: HTMLAudioElement;
  private state: PlayerState = {
    currentTrack: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    isMuted: false,
    isShuffle: false,
    repeatMode: 'off',
    queue: [],
    queueIndex: -1,
    isLoading: false,
    hasError: false,
  };

  private listeners: Array<(state: PlayerState) => void> = [];
  private playTimer: any = null;
  private recordedCurrentPlay = false;

  private constructor() {
    this.audio = new Audio();
    this.audio.volume = this.state.volume;
    this.setupAudioListeners();
  }

  public static getInstance(): PlayerService {
    if (!PlayerService.instance) {
      PlayerService.instance = new PlayerService();
    }
    return PlayerService.instance;
  }

  public subscribe(cb: (state: PlayerState) => void) {
    this.listeners.push(cb);
    cb({ ...this.state });
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  private notify() {
    const copy = { ...this.state };
    this.listeners.forEach(cb => cb(copy));
  }

  private setupAudioListeners() {
    this.audio.addEventListener('play', () => {
      this.state.isPlaying = true;
      this.state.isLoading = false;
      this.notify();
    });

    this.audio.addEventListener('pause', () => {
      this.state.isPlaying = false;
      this.notify();
    });

    this.audio.addEventListener('timeupdate', () => {
      this.state.currentTime = this.audio.currentTime || 0;
      this.notify();

      // Record play after 5 seconds of active playback
      if (!this.recordedCurrentPlay && this.state.currentTime > 5 && this.state.currentTrack) {
        this.recordedCurrentPlay = true;
        library.recordPlay(this.state.currentTrack);
      }
    });

    this.audio.addEventListener('loadedmetadata', () => {
      this.state.duration = this.audio.duration || this.state.currentTrack?.duration || 0;
      this.state.isLoading = false;
      this.notify();
    });

    this.audio.addEventListener('waiting', () => {
      this.state.isLoading = true;
      this.notify();
    });

    this.audio.addEventListener('playing', () => {
      this.state.isLoading = false;
      this.notify();
    });

    this.audio.addEventListener('ended', () => {
      if (this.state.repeatMode === 'one') {
        this.audio.currentTime = 0;
        this.audio.play().catch(console.warn);
      } else {
        this.next();
      }
    });

    this.audio.addEventListener('error', (e) => {
      console.warn('Audio playback error encountered:', e);
      this.state.isLoading = false;
      this.state.isPlaying = false;
      this.state.hasError = true;
      this.state.errorMessage = 'Esta pista no está disponible para reproducción en este momento.';
      this.notify();
    });
  }

  public playTrack(track: Track, queueContext: Track[] = []) {
    this.state.hasError = false;
    this.state.errorMessage = undefined;
    this.recordedCurrentPlay = false;

    if (queueContext.length > 0) {
      this.state.queue = [...queueContext];
      this.state.queueIndex = this.state.queue.findIndex(t => String(t.id) === String(track.id));
      if (this.state.queueIndex === -1) {
        this.state.queue.unshift(track);
        this.state.queueIndex = 0;
      }
    } else {
      if (!this.state.queue.some(t => String(t.id) === String(track.id))) {
        this.state.queue.push(track);
      }
      this.state.queueIndex = this.state.queue.findIndex(t => String(t.id) === String(track.id));
    }

    this.state.currentTrack = track;
    this.state.currentTime = 0;
    this.state.duration = track.duration || 0;
    this.state.isLoading = true;
    this.notify();

    // Stream URL
    const streamUrl = track.stream_url || `https://api.audius.co/v1/tracks/${track.id}/stream?app_name=VynoxPlay&client_id=2cc593fc814461263d282a84286fd4f72c79562e`;
    this.audio.src = streamUrl;
    this.audio.load();

    const playPromise = this.audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => {
        console.warn('Auto-play prevented or stream failed:', err);
        this.state.isPlaying = false;
        this.state.isLoading = false;
        this.notify();
      });
    }
  }

  public togglePlay() {
    if (!this.state.currentTrack) {
      if (this.state.queue.length > 0) {
        this.playTrack(this.state.queue[0], this.state.queue);
      }
      return;
    }

    if (this.state.isPlaying) {
      this.audio.pause();
    } else {
      this.audio.play().catch(e => {
        console.warn('Play error:', e);
      });
    }
  }

  public pause() {
    this.audio.pause();
  }

  public resume() {
    if (this.state.currentTrack) {
      this.audio.play().catch(console.warn);
    }
  }

  public seek(seconds: number) {
    if (!Number.isFinite(seconds)) return;
    this.audio.currentTime = Math.max(0, Math.min(seconds, this.audio.duration || this.state.duration));
  }

  public seekPercentage(percent: number) {
    const dur = this.audio.duration || this.state.duration;
    if (dur > 0) {
      this.seek((percent / 100) * dur);
    }
  }

  public setVolume(val: number) {
    const clamped = Math.max(0, Math.min(1, val));
    this.state.volume = clamped;
    this.audio.volume = clamped;
    this.state.isMuted = clamped === 0;
    this.notify();
  }

  public toggleMute() {
    this.state.isMuted = !this.state.isMuted;
    this.audio.muted = this.state.isMuted;
    this.notify();
  }

  public toggleShuffle() {
    this.state.isShuffle = !this.state.isShuffle;
    this.notify();
  }

  public cycleRepeat() {
    const modes: RepeatMode[] = ['off', 'all', 'one'];
    const currentIdx = modes.indexOf(this.state.repeatMode);
    this.state.repeatMode = modes[(currentIdx + 1) % modes.length];
    this.notify();
  }

  public next() {
    if (this.state.queue.length === 0) return;

    if (this.state.isShuffle) {
      const randIdx = Math.floor(Math.random() * this.state.queue.length);
      this.state.queueIndex = randIdx;
      this.playTrack(this.state.queue[randIdx], this.state.queue);
      return;
    }

    const nextIndex = this.state.queueIndex + 1;
    if (nextIndex < this.state.queue.length) {
      this.state.queueIndex = nextIndex;
      this.playTrack(this.state.queue[nextIndex], this.state.queue);
    } else if (this.state.repeatMode === 'all') {
      this.state.queueIndex = 0;
      this.playTrack(this.state.queue[0], this.state.queue);
    } else {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.state.isPlaying = false;
      this.notify();
    }
  }

  public prev() {
    if (this.state.queue.length === 0) return;

    // If more than 3 seconds in, restart track
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }

    const prevIndex = this.state.queueIndex - 1;
    if (prevIndex >= 0) {
      this.state.queueIndex = prevIndex;
      this.playTrack(this.state.queue[prevIndex], this.state.queue);
    } else {
      this.audio.currentTime = 0;
    }
  }

  public getState(): PlayerState {
    return { ...this.state };
  }

  public static formatTime(sec: number): string {
    if (!Number.isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }
}

export const player = PlayerService.getInstance();

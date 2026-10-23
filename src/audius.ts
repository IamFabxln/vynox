export interface Track {
  id: string;
  title: string;
  artist: string;
  artist_handle?: string;
  artwork: string;
  duration: number;
  genre?: string;
  stream_url?: string;
}

export class AudiusService {
  private static instance: AudiusService;

  private constructor() {}

  public static getInstance(): AudiusService {
    if (!AudiusService.instance) {
      AudiusService.instance = new AudiusService();
    }
    return AudiusService.instance;
  }

  /**
   * Fetch real trending tracks from Audius API (via our proxy server)
   */
  public async getTrendingTracks(genre?: string, limit = 24): Promise<Track[]> {
    try {
      let url = `/api/audius/trending?limit=${limit}`;
      if (genre && genre !== 'Todos' && genre !== 'All') {
        url += `&genre=${encodeURIComponent(genre)}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Error en servidor: ${res.status}`);
      }
      const data = await res.json();
      return (data.tracks || []).map((t: any) => this.normalizeTrack(t));
    } catch (err) {
      console.error('Error fetching trending tracks:', err);
      // Fallback direct to Audius if server proxy had an issue
      return this.fetchDirectAudiusTrending(genre, limit);
    }
  }

  /**
   * Direct fallback to Audius official API in case server proxy is unavailable
   */
  private async fetchDirectAudiusTrending(genre?: string, limit = 20): Promise<Track[]> {
    try {
      let url = `https://api.audius.co/v1/tracks/trending?app_name=VynoxPlay&client_id=2cc593fc814461263d282a84286fd4f72c79562e&limit=${limit}`;
      if (genre && genre !== 'Todos' && genre !== 'All') {
        url += `&genre=${encodeURIComponent(genre)}`;
      }
      const res = await fetch(url);
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data || []).map((t: any) => this.normalizeTrack(t));
    } catch (e) {
      console.warn('Direct Audius fallback also encountered error:', e);
      return [];
    }
  }

  /**
   * Search real songs, artists and tracks
   */
  public async search(query: string): Promise<Track[]> {
    if (!query || !query.trim()) return [];
    try {
      const res = await fetch(`/api/audius/search?query=${encodeURIComponent(query.trim())}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      return (data.tracks || []).map((t: any) => this.normalizeTrack(t));
    } catch (err) {
      console.error('Search error:', err);
      // Fallback direct
      try {
        const directUrl = `https://api.audius.co/v1/tracks/search?query=${encodeURIComponent(query.trim())}&app_name=VynoxPlay&client_id=2cc593fc814461263d282a84286fd4f72c79562e`;
        const directRes = await fetch(directUrl);
        const json = await directRes.json();
        return (json.data || []).map((t: any) => this.normalizeTrack(t));
      } catch (e) {
        return [];
      }
    }
  }

  /**
   * Get Audius official genre list
   */
  public async getGenres(): Promise<string[]> {
    try {
      const res = await fetch('/api/audius/genres');
      if (res.ok) {
        const data = await res.json();
        return data.genres || [];
      }
    } catch (e) {
      // ignore
    }
    return [
      'Electronic',
      'Hip-Hop/Rap',
      'Pop',
      'R&B/Soul',
      'Rock',
      'Latin',
      'House',
      'Techno',
      'Trap',
      'Indie',
      'Lo-Fi',
      'Ambient',
      'Dubstep',
      'Jazz',
    ];
  }

  public getStreamUrl(trackId: string): string {
    return `https://api.audius.co/v1/tracks/${trackId}/stream?app_name=VynoxPlay&client_id=2cc593fc814461263d282a84286fd4f72c79562e`;
  }

  private normalizeTrack(t: any): Track {
    const id = String(t.id || t.track_id);
    let artwork = '/assets/default-cover.svg';

    if (typeof t.artwork === 'string' && t.artwork) {
      artwork = t.artwork;
    } else if (t.artwork) {
      artwork = t.artwork['480x480'] || t.artwork['1000x1000'] || t.artwork['150x150'] || artwork;
    }

    return {
      id,
      title: t.title || 'Pista de Música',
      artist: t.artist || t.user?.name || t.user?.handle || 'Artista Audius',
      artist_handle: t.artist_handle || t.user?.handle,
      artwork,
      duration: typeof t.duration === 'number' ? t.duration : 0,
      genre: t.genre || 'Electronic',
      stream_url: t.stream_url || this.getStreamUrl(id),
    };
  }
}

export const audius = AudiusService.getInstance();

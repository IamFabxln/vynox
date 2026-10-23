import { Track } from './audius.ts';
import { auth } from './auth.ts';

export interface PlaylistData {
  id: string;
  user_id: string;
  name: string;
  description: string;
  tracks: Track[];
  created_at: string;
  updated_at: string;
}

export interface FavoriteItem {
  id: string;
  user_id: string;
  track_id: string;
  track: Track;
  created_at: string;
}

const FAV_STORAGE_KEY = 'vynox_local_favorites_v1';

export class LibraryService {
  private static instance: LibraryService;
  private favoriteIds = new Set<string>();
  private localFavoriteTracks: Track[] = [];

  private constructor() {
    this.loadFromLocalStorage();
  }

  public static getInstance(): LibraryService {
    if (!LibraryService.instance) {
      LibraryService.instance = new LibraryService();
    }
    return LibraryService.instance;
  }

  private loadFromLocalStorage(): void {
    try {
      const saved = localStorage.getItem(FAV_STORAGE_KEY);
      if (saved) {
        const parsed: Track[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          this.localFavoriteTracks = parsed;
          this.favoriteIds = new Set(parsed.map(t => String(t.id)));
        }
      }
    } catch (e) {
      // Local storage inaccessible in some strict sandboxes
    }
  }

  private saveToLocalStorage(tracks: Track[]): void {
    try {
      this.localFavoriteTracks = tracks;
      this.favoriteIds = new Set(tracks.map(t => String(t.id)));
      localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(tracks));
    } catch (e) {
      // Quota or sandbox restrictions
    }
  }

  public async getFavorites(): Promise<Track[]> {
    try {
      const res = await fetch('/api/favorites', {
        headers: {
          'Accept': 'application/json',
          ...auth.getAuthHeaders(),
        },
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        const favs: FavoriteItem[] = data.favorites || [];
        const tracks = favs.map(f => f.track);
        this.saveToLocalStorage(tracks);
        return tracks;
      }
    } catch (e) {
      console.warn('Failed to load favorites from server, using local favorites:', e);
    }
    return this.localFavoriteTracks;
  }

  public isFavorite(trackId: string): boolean {
    return this.favoriteIds.has(String(trackId));
  }

  public async toggleFavorite(track: Track): Promise<boolean> {
    const trackIdStr = String(track.id);
    const wasFavorite = this.isFavorite(trackIdStr);
    const newFavoriteState = !wasFavorite;

    // Optimistically update local cache
    let updatedTracks = [...this.localFavoriteTracks];
    if (newFavoriteState) {
      if (!updatedTracks.some(t => String(t.id) === trackIdStr)) {
        updatedTracks.unshift(track);
      }
    } else {
      updatedTracks = updatedTracks.filter(t => String(t.id) !== trackIdStr);
    }
    this.saveToLocalStorage(updatedTracks);

    // Synchronize with server
    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...auth.getAuthHeaders(),
        },
        body: JSON.stringify({ track }),
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        if (typeof data.isFavorite === 'boolean') {
          if (data.isFavorite !== newFavoriteState) {
            if (data.isFavorite) {
              if (!updatedTracks.some(t => String(t.id) === trackIdStr)) {
                updatedTracks.unshift(track);
              }
            } else {
              updatedTracks = updatedTracks.filter(t => String(t.id) !== trackIdStr);
            }
            this.saveToLocalStorage(updatedTracks);
            return data.isFavorite;
          }
        }
      }
    } catch (e) {
      console.warn('Network issue syncing favorite with backend; persisted locally:', e);
    }

    return newFavoriteState;
  }

  public async getPlaylists(): Promise<PlaylistData[]> {
    try {
      const res = await fetch('/api/playlists', {
        headers: {
          'Accept': 'application/json',
          ...auth.getAuthHeaders(),
        },
        credentials: 'include',
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.playlists || [];
    } catch (e) {
      console.warn('Failed to load playlists:', e);
      return [];
    }
  }

  public async createPlaylist(name: string, description = ''): Promise<PlaylistData | null> {
    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...auth.getAuthHeaders(),
        },
        body: JSON.stringify({ name, description }),
        credentials: 'include',
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.playlist || null;
    } catch (e) {
      console.warn('Error creating playlist:', e);
      return null;
    }
  }

  public async deletePlaylist(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/playlists/${id}`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
          ...auth.getAuthHeaders(),
        },
        credentials: 'include',
      });
      return res.ok;
    } catch (e) {
      console.warn('Error deleting playlist:', e);
      return false;
    }
  }

  public async addTrackToPlaylist(playlistId: string, track: Track): Promise<boolean> {
    try {
      const res = await fetch(`/api/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...auth.getAuthHeaders(),
        },
        body: JSON.stringify({ track }),
        credentials: 'include',
      });
      return res.ok;
    } catch (e) {
      console.warn('Error adding track to playlist:', e);
      return false;
    }
  }

  public async removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/playlists/${playlistId}/tracks/${trackId}`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
          ...auth.getAuthHeaders(),
        },
        credentials: 'include',
      });
      return res.ok;
    } catch (e) {
      console.warn('Error removing track from playlist:', e);
      return false;
    }
  }

  public async recordPlay(track: Track): Promise<void> {
    try {
      await fetch('/api/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...auth.getAuthHeaders(),
        },
        body: JSON.stringify({ track }),
        credentials: 'include',
      });
    } catch (e) {
      // ignore
    }
  }

  public async getHistory(): Promise<Track[]> {
    try {
      const res = await fetch('/api/history', {
        headers: {
          'Accept': 'application/json',
          ...auth.getAuthHeaders(),
        },
        credentials: 'include',
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.history || []).map((h: any) => h.track);
    } catch (e) {
      console.warn('Error getting history:', e);
      return [];
    }
  }
}

export const library = LibraryService.getInstance();

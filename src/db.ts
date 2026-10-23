import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

export type UserRole = 'superadmin' | 'admin' | 'moderator' | 'user';
export type UserStatus = 'active' | 'suspended';

export interface User {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  status: UserStatus;
  suspension_reason?: string;
  avatar?: string;
  created_at: string;
  last_login?: string;
}

export interface TrackData {
  id: string;
  title: string;
  artist: string;
  artist_handle?: string;
  artwork: string;
  duration: number;
  stream_url?: string;
  genre?: string;
  album?: string;
}

export interface Playlist {
  id: string;
  user_id: string;
  name: string;
  description: string;
  cover_url?: string;
  tracks: TrackData[];
  created_at: string;
  updated_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  track_id: string;
  track: TrackData;
  created_at: string;
}

export interface HistoryItem {
  id: string;
  user_id: string;
  track_id: string;
  track: TrackData;
  played_at: string;
}

export interface Ad {
  id: string;
  title: string;
  description?: string;
  media_url: string; // Base64 data or standard URL
  media_type: 'image' | 'video';
  placement: 'home_banner' | 'pre_roll_audio';
  target_url?: string;
  duration: number; // duration in seconds
  can_skip: boolean;
  skip_after: number; // in seconds
  order: number;
  start_date?: string;
  end_date?: string;
  active: boolean;
  views: number;
  clicks: number;
  created_at: string;
  updated_at: string;
}

export interface PlatformNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'update';
  active: boolean;
  created_at: string;
  expires_at?: string;
}

export interface Report {
  id: string;
  reporter_id: string;
  reporter_name: string;
  reported_type: 'track' | 'user';
  target_id: string;
  target_title: string;
  reason: string;
  status: 'pending' | 'resolved' | 'dismissed';
  created_at: string;
  resolved_at?: string;
  admin_note?: string;
}

export interface AuditLog {
  id: string;
  admin_id: string;
  admin_name: string;
  action: string;
  target: string;
  details: string;
  timestamp: string;
}

export interface SecurityLog {
  id: string;
  event: 'login_success' | 'login_failed' | 'suspicious' | 'blocked_attempt';
  email: string;
  ip: string;
  user_agent: string;
  timestamp: string;
  details?: string;
}

export interface PlatformSettings {
  platform_name: string;
  logo_url: string;
  welcome_text: string;
  info_text: string;
  legal_text: string;
  maintenance_mode: boolean;
  updated_at: string;
}

export interface CustomTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  artwork: string;
  duration: number;
  stream_url: string;
  genre: string;
  is_promoted: boolean;
  created_at: string;
}

export interface SystemErrorLog {
  id: string;
  level: 'error' | 'warn';
  message: string;
  stack?: string;
  source: string;
  timestamp: string;
}

interface DatabaseSchema {
  users: User[];
  playlists: Playlist[];
  favorites: Favorite[];
  history: HistoryItem[];
  ads: Ad[];
  notifications: PlatformNotification[];
  reports: Report[];
  audit_logs: AuditLog[];
  security_logs: SecurityLog[];
  settings: PlatformSettings;
  custom_tracks: CustomTrack[];
  system_errors: SystemErrorLog[];
}

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'vynox_play.json');

const DEFAULT_SETTINGS: PlatformSettings = {
  platform_name: 'Vynox Play',
  logo_url: '/assets/vynox-logo.svg',
  welcome_text: 'Bienvenido a Vynox Play. Streaming musical de alta fidelidad.',
  info_text: 'Vynox Play combina el catálogo oficial de Audius con curaduría independiente.',
  legal_text: 'Todos los derechos reservados © 2026 Vynox Play.',
  maintenance_mode: false,
  updated_at: new Date().toISOString(),
};

class Database {
  private data: DatabaseSchema = {
    users: [],
    playlists: [],
    favorites: [],
    history: [],
    ads: [],
    notifications: [],
    reports: [],
    audit_logs: [],
    security_logs: [],
    settings: { ...DEFAULT_SETTINGS },
    custom_tracks: [],
    system_errors: [],
  };

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = {
          users: parsed.users || [],
          playlists: parsed.playlists || [],
          favorites: parsed.favorites || [],
          history: parsed.history || [],
          ads: parsed.ads || [],
          notifications: parsed.notifications || [],
          reports: parsed.reports || [],
          audit_logs: parsed.audit_logs || [],
          security_logs: parsed.security_logs || [],
          settings: parsed.settings ? { ...DEFAULT_SETTINGS, ...parsed.settings } : { ...DEFAULT_SETTINGS },
          custom_tracks: parsed.custom_tracks || [],
          system_errors: parsed.system_errors || [],
        };

        // Normalize users to have status and correct roles
        for (const u of this.data.users) {
          if (!u.status) u.status = 'active';
        }
      } else {
        this.save();
      }
    } catch (err) {
      console.warn('Using in-memory DB due to file system constraint:', err);
    }

    this.seedAdminAccount();
  }

  private save() {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.warn('DB save warning:', err);
    }
  }

  private async seedAdminAccount() {
    const adminEmail = (process.env.ADMIN_EMAIL || 'fedezyljx@gmail.com').toLowerCase().trim();
    const adminPassword = process.env.ADMIN_PASSWORD || 'fedexd67';

    const existingAdmin = this.data.users.find(u => u.email.toLowerCase() === adminEmail);
    if (!existingAdmin) {
      const salt = bcrypt.genSaltSync(10);
      const password_hash = bcrypt.hashSync(adminPassword, salt);
      const adminUser: User = {
        id: 'user_admin_001',
        name: 'Administrador Principal',
        email: adminEmail,
        password_hash,
        role: 'superadmin',
        status: 'active',
        avatar: '/assets/default-cover.svg',
        created_at: new Date().toISOString(),
      };
      this.data.users.push(adminUser);
      this.save();
      console.log(`[Vynox Play] Superadmin account seeded: ${adminEmail}`);
    } else {
      // Guarantee superadmin role and active status
      if (existingAdmin.role !== 'superadmin' || existingAdmin.status !== 'active') {
        existingAdmin.role = 'superadmin';
        existingAdmin.status = 'active';
        this.save();
      }
    }
  }

  // ==========================================
  // USERS
  // ==========================================
  public findUserByEmail(email: string): User | undefined {
    return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
  }

  public findUserById(id: string): User | undefined {
    return this.data.users.find(u => u.id === id);
  }

  public createUser(userData: { name: string; email: string; password: string }): User {
    const salt = bcrypt.genSaltSync(10);
    const password_hash = bcrypt.hashSync(userData.password, salt);
    const id = 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const normalizedEmail = userData.email.toLowerCase().trim();
    const isSuperAdminEmail = normalizedEmail === 'fedezyljx@gmail.com' || normalizedEmail === 'fabiansh50@gmail.com';
    const newUser: User = {
      id,
      name: userData.name.trim(),
      email: normalizedEmail,
      password_hash,
      role: isSuperAdminEmail ? 'superadmin' : 'user',
      status: 'active',
      created_at: new Date().toISOString(),
    };
    this.data.users.push(newUser);
    this.save();
    return newUser;
  }

  public updateUserLogin(userId: string) {
    const user = this.findUserById(userId);
    if (user) {
      user.last_login = new Date().toISOString();
      this.save();
    }
  }

  public getAllUsers(): Omit<User, 'password_hash'>[] {
    return this.data.users.map(({ password_hash, ...rest }) => rest);
  }

  public updateUserRole(userId: string, role: UserRole): boolean {
    const user = this.findUserById(userId);
    if (user) {
      user.role = role;
      this.save();
      return true;
    }
    return false;
  }

  public updateUserStatus(userId: string, status: UserStatus, reason?: string): boolean {
    const user = this.findUserById(userId);
    if (user) {
      user.status = status;
      if (reason !== undefined) {
        user.suspension_reason = reason;
      }
      this.save();
      return true;
    }
    return false;
  }

  public deleteUser(userId: string): boolean {
    const userIndex = this.data.users.findIndex(u => u.id === userId);
    if (userIndex === -1) return false;
    this.data.users.splice(userIndex, 1);
    this.data.playlists = this.data.playlists.filter(p => p.user_id !== userId);
    this.data.favorites = this.data.favorites.filter(f => f.user_id !== userId);
    this.data.history = this.data.history.filter(h => h.user_id !== userId);
    this.save();
    return true;
  }

  // ==========================================
  // PLAYLISTS
  // ==========================================
  public getUserPlaylists(userId: string): Playlist[] {
    return this.data.playlists.filter(p => p.user_id === userId);
  }

  public getAllPlaylists(): Playlist[] {
    return this.data.playlists;
  }

  public getPlaylistById(playlistId: string): Playlist | undefined {
    return this.data.playlists.find(p => p.id === playlistId);
  }

  public createPlaylist(userId: string, name: string, description: string): Playlist {
    const id = 'pl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const playlist: Playlist = {
      id,
      user_id: userId,
      name: name.trim() || 'Mi Playlist Vynox',
      description: description.trim() || '',
      tracks: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.data.playlists.push(playlist);
    this.save();
    return playlist;
  }

  public updatePlaylist(userId: string, playlistId: string, name: string, description: string): Playlist | null {
    const pl = this.data.playlists.find(p => p.id === playlistId && p.user_id === userId);
    if (!pl) return null;
    pl.name = name.trim();
    pl.description = description.trim();
    pl.updated_at = new Date().toISOString();
    this.save();
    return pl;
  }

  public deletePlaylist(userId: string, playlistId: string): boolean {
    const idx = this.data.playlists.findIndex(p => p.id === playlistId && p.user_id === userId);
    if (idx !== -1) {
      this.data.playlists.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  public addTrackToPlaylist(userId: string, playlistId: string, track: TrackData): boolean {
    const pl = this.data.playlists.find(p => p.id === playlistId && p.user_id === userId);
    if (!pl) return false;
    const exists = pl.tracks.some(t => String(t.id) === String(track.id));
    if (!exists) {
      pl.tracks.push(track);
      pl.updated_at = new Date().toISOString();
      this.save();
    }
    return true;
  }

  public removeTrackFromPlaylist(userId: string, playlistId: string, trackId: string): boolean {
    const pl = this.data.playlists.find(p => p.id === playlistId && p.user_id === userId);
    if (!pl) return false;
    pl.tracks = pl.tracks.filter(t => String(t.id) !== String(trackId));
    pl.updated_at = new Date().toISOString();
    this.save();
    return true;
  }

  // ==========================================
  // FAVORITES
  // ==========================================
  public getUserFavorites(userId: string): Favorite[] {
    return this.data.favorites.filter(f => f.user_id === userId);
  }

  public toggleFavorite(userId: string, track: TrackData): { isFavorite: boolean; favorite?: Favorite } {
    const idx = this.data.favorites.findIndex(f => f.user_id === userId && String(f.track_id) === String(track.id));
    if (idx !== -1) {
      this.data.favorites.splice(idx, 1);
      this.save();
      return { isFavorite: false };
    } else {
      const fav: Favorite = {
        id: 'fav_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        user_id: userId,
        track_id: String(track.id),
        track,
        created_at: new Date().toISOString(),
      };
      this.data.favorites.push(fav);
      this.save();
      return { isFavorite: true, favorite: fav };
    }
  }

  public removeFavorite(userId: string, trackId: string): boolean {
    const idx = this.data.favorites.findIndex(f => f.user_id === userId && String(f.track_id) === String(trackId));
    if (idx !== -1) {
      this.data.favorites.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  // ==========================================
  // HISTORY / PLAYS
  // ==========================================
  public recordPlay(userId: string, track: TrackData) {
    const item: HistoryItem = {
      id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      user_id: userId,
      track_id: String(track.id),
      track,
      played_at: new Date().toISOString(),
    };
    this.data.history.unshift(item);
    if (this.data.history.length > 500) {
      this.data.history = this.data.history.slice(0, 500);
    }
    this.save();
  }

  public getUserHistory(userId: string, limit = 50): HistoryItem[] {
    return this.data.history.filter(h => h.user_id === userId).slice(0, limit);
  }

  public getAllHistory(limit = 100): HistoryItem[] {
    return this.data.history.slice(0, limit);
  }

  // ==========================================
  // GLOBAL PROMOTIONAL ADS
  // ==========================================
  public getAllAds(): Ad[] {
    return [...this.data.ads].sort((a, b) => a.order - b.order);
  }

  public getActiveAds(placement?: 'home_banner' | 'pre_roll_audio'): Ad[] {
    const now = new Date().toISOString();
    return this.data.ads
      .filter(ad => {
        if (!ad.active) return false;
        if (placement && ad.placement !== placement) return false;
        if (ad.start_date && ad.start_date > now) return false;
        if (ad.end_date && ad.end_date < now) return false;
        return true;
      })
      .sort((a, b) => a.order - b.order);
  }

  public getAdById(id: string): Ad | undefined {
    return this.data.ads.find(a => a.id === id);
  }

  public createAd(adData: Omit<Ad, 'id' | 'views' | 'clicks' | 'created_at' | 'updated_at'>): Ad {
    const id = 'ad_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const newAd: Ad = {
      ...adData,
      id,
      views: 0,
      clicks: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.data.ads.push(newAd);
    this.save();
    return newAd;
  }

  public updateAd(id: string, adData: Partial<Ad>): Ad | null {
    const ad = this.getAdById(id);
    if (!ad) return null;
    Object.assign(ad, adData, { updated_at: new Date().toISOString() });
    this.save();
    return ad;
  }

  public deleteAd(id: string): boolean {
    const idx = this.data.ads.findIndex(a => a.id === id);
    if (idx !== -1) {
      this.data.ads.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  public incrementAdView(id: string): boolean {
    const ad = this.getAdById(id);
    if (ad) {
      ad.views = (ad.views || 0) + 1;
      this.save();
      return true;
    }
    return false;
  }

  public incrementAdClick(id: string): boolean {
    const ad = this.getAdById(id);
    if (ad) {
      ad.clicks = (ad.clicks || 0) + 1;
      this.save();
      return true;
    }
    return false;
  }

  // ==========================================
  // NOTIFICATIONS / BROADCASTS
  // ==========================================
  public getAllNotifications(): PlatformNotification[] {
    return [...this.data.notifications].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  public getActiveNotifications(): PlatformNotification[] {
    const now = new Date().toISOString();
    return this.data.notifications.filter(n => {
      if (!n.active) return false;
      if (n.expires_at && n.expires_at < now) return false;
      return true;
    });
  }

  public createNotification(data: { title: string; message: string; type: 'info' | 'warning' | 'update'; expires_at?: string }): PlatformNotification {
    const id = 'notif_' + Date.now();
    const notif: PlatformNotification = {
      id,
      title: data.title.trim(),
      message: data.message.trim(),
      type: data.type || 'info',
      active: true,
      created_at: new Date().toISOString(),
      expires_at: data.expires_at,
    };
    this.data.notifications.unshift(notif);
    this.save();
    return notif;
  }

  public deleteNotification(id: string): boolean {
    const idx = this.data.notifications.findIndex(n => n.id === id);
    if (idx !== -1) {
      this.data.notifications.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  public toggleNotification(id: string): boolean {
    const notif = this.data.notifications.find(n => n.id === id);
    if (notif) {
      notif.active = !notif.active;
      this.save();
      return true;
    }
    return false;
  }

  // ==========================================
  // REPORTS & MODERATION
  // ==========================================
  public getAllReports(): Report[] {
    return [...this.data.reports].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  public createReport(data: { reporter_id: string; reporter_name: string; reported_type: 'track' | 'user'; target_id: string; target_title: string; reason: string }): Report {
    const id = 'rep_' + Date.now();
    const report: Report = {
      id,
      reporter_id: data.reporter_id,
      reporter_name: data.reporter_name,
      reported_type: data.reported_type,
      target_id: data.target_id,
      target_title: data.target_title,
      reason: data.reason,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    this.data.reports.unshift(report);
    this.save();
    return report;
  }

  public updateReportStatus(id: string, status: 'pending' | 'resolved' | 'dismissed', adminNote?: string): boolean {
    const rep = this.data.reports.find(r => r.id === id);
    if (rep) {
      rep.status = status;
      rep.resolved_at = new Date().toISOString();
      if (adminNote) rep.admin_note = adminNote;
      this.save();
      return true;
    }
    return false;
  }

  // ==========================================
  // AUDIT LOGS
  // ==========================================
  public recordAuditLog(adminId: string, adminName: string, action: string, target: string, details: string) {
    const item: AuditLog = {
      id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      admin_id: adminId,
      admin_name: adminName,
      action,
      target,
      details,
      timestamp: new Date().toISOString(),
    };
    this.data.audit_logs.unshift(item);
    if (this.data.audit_logs.length > 500) {
      this.data.audit_logs = this.data.audit_logs.slice(0, 500);
    }
    this.save();
  }

  public getAuditLogs(limit = 100): AuditLog[] {
    return this.data.audit_logs.slice(0, limit);
  }

  // ==========================================
  // SECURITY LOGS
  // ==========================================
  public recordSecurityLog(event: 'login_success' | 'login_failed' | 'suspicious' | 'blocked_attempt', email: string, ip: string, userAgent: string, details?: string) {
    const item: SecurityLog = {
      id: 'sec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      event,
      email,
      ip,
      user_agent: userAgent,
      timestamp: new Date().toISOString(),
      details,
    };
    this.data.security_logs.unshift(item);
    if (this.data.security_logs.length > 500) {
      this.data.security_logs = this.data.security_logs.slice(0, 500);
    }
    this.save();
  }

  public getSecurityLogs(limit = 100): SecurityLog[] {
    return this.data.security_logs.slice(0, limit);
  }

  // ==========================================
  // PLATFORM SETTINGS
  // ==========================================
  public getSettings(): PlatformSettings {
    return { ...this.data.settings };
  }

  public updateSettings(settings: Partial<PlatformSettings>): PlatformSettings {
    this.data.settings = {
      ...this.data.settings,
      ...settings,
      updated_at: new Date().toISOString(),
    };
    this.save();
    return this.data.settings;
  }

  // ==========================================
  // CUSTOM & CURATED TRACKS
  // ==========================================
  public getCustomTracks(): CustomTrack[] {
    return this.data.custom_tracks || [];
  }

  public createCustomTrack(track: Omit<CustomTrack, 'id' | 'created_at'>): CustomTrack {
    const id = 'custom_' + Date.now();
    const newTrack: CustomTrack = {
      ...track,
      id,
      created_at: new Date().toISOString(),
    };
    this.data.custom_tracks.push(newTrack);
    this.save();
    return newTrack;
  }

  public deleteCustomTrack(id: string): boolean {
    const idx = this.data.custom_tracks.findIndex(t => t.id === id);
    if (idx !== -1) {
      this.data.custom_tracks.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  // ==========================================
  // SYSTEM ERROR LOGS
  // ==========================================
  public recordSystemError(level: 'error' | 'warn', message: string, source: string, stack?: string) {
    const log: SystemErrorLog = {
      id: 'err_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      level,
      message,
      source,
      stack,
      timestamp: new Date().toISOString(),
    };
    this.data.system_errors.unshift(log);
    if (this.data.system_errors.length > 200) {
      this.data.system_errors = this.data.system_errors.slice(0, 200);
    }
    this.save();
  }

  public getSystemErrors(limit = 100): SystemErrorLog[] {
    return this.data.system_errors.slice(0, limit);
  }

  // ==========================================
  // BACKUP & RESTORE
  // ==========================================
  public exportFullBackup(): DatabaseSchema {
    return JSON.parse(JSON.stringify(this.data));
  }

  public importFullBackup(backupData: any): { success: boolean; error?: string } {
    try {
      if (!backupData || !Array.isArray(backupData.users)) {
        return { success: false, error: 'Formato de respaldo JSON no válido (faltan usuarios).' };
      }

      this.data = {
        users: backupData.users || [],
        playlists: backupData.playlists || [],
        favorites: backupData.favorites || [],
        history: backupData.history || [],
        ads: backupData.ads || [],
        notifications: backupData.notifications || [],
        reports: backupData.reports || [],
        audit_logs: backupData.audit_logs || [],
        security_logs: backupData.security_logs || [],
        settings: backupData.settings ? { ...DEFAULT_SETTINGS, ...backupData.settings } : { ...DEFAULT_SETTINGS },
        custom_tracks: backupData.custom_tracks || [],
        system_errors: backupData.system_errors || [],
      };

      // Ensure superadmin still exists
      this.seedAdminAccount();
      this.save();
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Error al procesar archivo de copia de seguridad.' };
    }
  }

  // ==========================================
  // AGGREGATE ADMIN STATS
  // ==========================================
  public getAdminStats() {
    const totalUsers = this.data.users.length;
    const activeUsers = this.data.users.filter(u => u.status === 'active').length;
    const suspendedUsers = this.data.users.filter(u => u.status === 'suspended').length;
    const totalPlaylists = this.data.playlists.length;
    const totalFavorites = this.data.favorites.length;
    const totalPlays = this.data.history.length;
    const totalAds = this.data.ads.length;
    const activeAds = this.data.ads.filter(a => a.active).length;
    const totalAdViews = this.data.ads.reduce((acc, a) => acc + (a.views || 0), 0);
    const totalAdClicks = this.data.ads.reduce((acc, a) => acc + (a.clicks || 0), 0);
    const pendingReports = this.data.reports.filter(r => r.status === 'pending').length;

    // Track play counts
    const playMap: Record<string, { title: string; artist: string; count: number }> = {};
    for (const h of this.data.history) {
      const key = h.track_id;
      if (!playMap[key]) {
        playMap[key] = { title: h.track?.title || 'Unknown', artist: h.track?.artist || 'Unknown', count: 0 };
      }
      playMap[key].count++;
    }

    const topTracks = Object.entries(playMap)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const recentAudit = this.data.audit_logs.slice(0, 6);
    const recentSecurity = this.data.security_logs.slice(0, 6);

    return {
      totalUsers,
      activeUsers,
      suspendedUsers,
      totalPlaylists,
      totalFavorites,
      totalPlays,
      totalAds,
      activeAds,
      totalAdViews,
      totalAdClicks,
      pendingReports,
      topTracks,
      recentAudit,
      recentSecurity,
    };
  }
}

export const db = new Database();

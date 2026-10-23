import { auth } from './auth.ts';
import { UserRole, UserStatus, Ad, PlatformNotification, Report, AuditLog, SecurityLog, PlatformSettings, CustomTrack, SystemErrorLog } from './db.ts';

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  totalPlaylists: number;
  totalFavorites: number;
  totalPlays: number;
  totalAds: number;
  activeAds: number;
  totalAdViews: number;
  totalAdClicks: number;
  pendingReports: number;
  topTracks: Array<{
    id: string;
    title: string;
    artist: string;
    count: number;
  }>;
  recentAudit: AuditLog[];
  recentSecurity: SecurityLog[];
}

export interface AdminUserItem {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  suspension_reason?: string;
  avatar?: string;
  created_at: string;
  last_login?: string;
  playlistsCount: number;
  favoritesCount: number;
  historyCount: number;
}

export interface SystemStatusData {
  node_version: string;
  platform: string;
  uptime_seconds: number;
  memory_rss_mb: string;
  memory_heap_mb: string;
  errors: SystemErrorLog[];
}

export class AdminService {
  private static instance: AdminService;

  private constructor() {}

  public static getInstance(): AdminService {
    if (!AdminService.instance) {
      AdminService.instance = new AdminService();
    }
    return AdminService.instance;
  }

  private async request(url: string, options: RequestInit = {}) {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Accept': 'application/json',
        ...auth.getAuthHeaders(),
        ...(options.headers || {}),
      },
      credentials: 'include',
    });
    return res;
  }

  // 1. Panel Principal: Overview & Stats
  public async getOverview(): Promise<AdminStats | null> {
    try {
      const res = await this.request('/api/admin/overview');
      if (!res.ok) throw new Error('No autorizado');
      const data = await res.json();
      return data.stats;
    } catch (e) {
      console.warn('Failed to get admin overview:', e);
      return null;
    }
  }

  public async getStats(): Promise<AdminStats | null> {
    return this.getOverview();
  }

  // 2. Gestión de Usuarios
  public async getUsers(search = '', role = 'all', status = 'all'): Promise<AdminUserItem[]> {
    try {
      const params = new URLSearchParams();
      if (search) params.append('q', search);
      if (role !== 'all') params.append('role', role);
      if (status !== 'all') params.append('status', status);

      const res = await this.request(`/api/admin/users?${params.toString()}`);
      if (!res.ok) throw new Error('No autorizado');
      const data = await res.json();
      return data.users || [];
    } catch (e) {
      console.warn('Failed to get users:', e);
      return [];
    }
  }

  public async getUserDetail(userId: string): Promise<any | null> {
    try {
      const res = await this.request(`/api/admin/users/${userId}`);
      if (!res.ok) throw new Error('Usuario no encontrado');
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  public async setUserStatus(userId: string, status: UserStatus, reason?: string): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await this.request(`/api/admin/users/${userId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reason }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, message: data.error };
      return { success: true, message: data.message };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  public async setRole(userId: string, role: UserRole): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await this.request(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, message: data.error };
      return { success: true, message: data.message };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  public async deleteUser(userId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await this.request(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) return { success: false, message: data.error };
      return { success: true, message: data.message };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // 3. Gestión Musical
  public async getMusicData(): Promise<{ customTracks: CustomTrack[]; reports: Report[] }> {
    try {
      const res = await this.request('/api/admin/music');
      if (!res.ok) throw new Error('Error al cargar música');
      const data = await res.json();
      return { customTracks: data.customTracks || [], reports: data.reports || [] };
    } catch (e) {
      return { customTracks: [], reports: [] };
    }
  }

  public async createCustomTrack(trackData: any): Promise<{ success: boolean; track?: CustomTrack; message?: string }> {
    try {
      const res = await this.request('/api/admin/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trackData),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, message: data.error };
      return { success: true, track: data.track };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  public async deleteCustomTrack(id: string): Promise<boolean> {
    try {
      const res = await this.request(`/api/admin/music/${id}`, { method: 'DELETE' });
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  // 4. Seguridad
  public async getSecurityLogs(limit = 100): Promise<{ logs: SecurityLog[]; failedCount: number }> {
    try {
      const res = await this.request(`/api/admin/security?limit=${limit}`);
      if (!res.ok) throw new Error('No autorizado');
      const data = await res.json();
      return { logs: data.logs || [], failedCount: data.failedCount || 0 };
    } catch (e) {
      return { logs: [], failedCount: 0 };
    }
  }

  // 5. Notificaciones
  public async getNotifications(): Promise<PlatformNotification[]> {
    try {
      const res = await this.request('/api/admin/notifications');
      if (!res.ok) return [];
      const data = await res.json();
      return data.notifications || [];
    } catch (e) {
      return [];
    }
  }

  public async createNotification(notif: { title: string; message: string; type: string; expires_at?: string }): Promise<boolean> {
    try {
      const res = await this.request('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notif),
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  public async toggleNotification(id: string): Promise<boolean> {
    try {
      const res = await this.request(`/api/admin/notifications/${id}/toggle`, { method: 'PUT' });
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  public async deleteNotification(id: string): Promise<boolean> {
    try {
      const res = await this.request(`/api/admin/notifications/${id}`, { method: 'DELETE' });
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  // 6. Configuración
  public async getSettings(): Promise<PlatformSettings | null> {
    try {
      const res = await this.request('/api/admin/settings');
      if (!res.ok) return null;
      const data = await res.json();
      return data.settings;
    } catch (e) {
      return null;
    }
  }

  public async updateSettings(settings: Partial<PlatformSettings>): Promise<boolean> {
    try {
      const res = await this.request('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  public async getPublicSettings(): Promise<PlatformSettings | null> {
    try {
      const res = await fetch('/api/settings/public');
      if (!res.ok) return null;
      const data = await res.json();
      return data.settings;
    } catch (e) {
      return null;
    }
  }

  // 7. Historial y Moderación
  public async getAuditLogs(limit = 100): Promise<AuditLog[]> {
    try {
      const res = await this.request(`/api/admin/audit?limit=${limit}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.logs || [];
    } catch (e) {
      return [];
    }
  }

  public async getReports(): Promise<Report[]> {
    try {
      const res = await this.request('/api/admin/reports');
      if (!res.ok) return [];
      const data = await res.json();
      return data.reports || [];
    } catch (e) {
      return [];
    }
  }

  public async updateReport(id: string, status: 'pending' | 'resolved' | 'dismissed', adminNote?: string): Promise<boolean> {
    try {
      const res = await this.request(`/api/admin/reports/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_note: adminNote }),
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  public async submitReport(reportData: { reported_type: 'track' | 'user'; target_id: string; target_title: string; reason: string }): Promise<boolean> {
    try {
      const res = await this.request('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportData),
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  // 8. Anuncios Promocionales Globales
  public async getAllAds(): Promise<Ad[]> {
    try {
      const res = await this.request('/api/admin/ads');
      if (!res.ok) return [];
      const data = await res.json();
      return data.ads || [];
    } catch (e) {
      return [];
    }
  }

  public async createAd(adData: Partial<Ad>): Promise<{ success: boolean; ad?: Ad; message?: string }> {
    try {
      const res = await this.request('/api/admin/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adData),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, message: data.error };
      return { success: true, ad: data.ad };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  public async updateAd(id: string, adData: Partial<Ad>): Promise<boolean> {
    try {
      const res = await this.request(`/api/admin/ads/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adData),
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  public async deleteAd(id: string): Promise<boolean> {
    try {
      const res = await this.request(`/api/admin/ads/${id}`, { method: 'DELETE' });
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  public async getActiveAds(placement?: 'home_banner' | 'pre_roll_audio'): Promise<Ad[]> {
    try {
      const url = placement ? `/api/ads/active?placement=${placement}` : '/api/ads/active';
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      return data.ads || [];
    } catch (e) {
      return [];
    }
  }

  public async recordAdView(id: string): Promise<void> {
    try {
      await fetch(`/api/ads/${id}/view`, { method: 'POST' });
    } catch (e) {}
  }

  public async recordAdClick(id: string): Promise<void> {
    try {
      await fetch(`/api/ads/${id}/click`, { method: 'POST' });
    } catch (e) {}
  }

  // 9. Sistema y Copias de Seguridad
  public async getSystemStatus(): Promise<SystemStatusData | null> {
    try {
      const res = await this.request('/api/admin/system');
      if (!res.ok) return null;
      const data = await res.json();
      return data.system;
    } catch (e) {
      return null;
    }
  }

  public async downloadBackup(): Promise<void> {
    try {
      const res = await this.request('/api/admin/system/backup');
      if (!res.ok) throw new Error('No autorizado');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vynox_play_backup_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Backup download error:', e);
      throw e;
    }
  }

  public async restoreBackup(jsonData: any): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await this.request('/api/admin/system/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jsonData),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, message: data.error };
      return { success: true, message: data.message };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }
}

export const adminService = AdminService.getInstance();

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'superadmin' | 'admin' | 'moderator' | 'user';
  status?: 'active' | 'suspended';
  avatar?: string;
  created_at?: string;
}

export class AuthService {
  private static instance: AuthService;
  private currentUser: UserProfile | null = null;
  private token: string | null = null;
  private initialized = false;
  private listeners: Array<(user: UserProfile | null) => void> = [];

  private constructor() {
    try {
      this.token = localStorage.getItem('vynox_token') || sessionStorage.getItem('vynox_token') || null;
    } catch (e) {
      this.token = null;
    }
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  public getToken(): string | null {
    if (!this.token) {
      try {
        this.token = localStorage.getItem('vynox_token') || sessionStorage.getItem('vynox_token') || null;
      } catch (e) {
        this.token = null;
      }
    }
    return this.token;
  }

  public getAuthHeaders(): Record<string, string> {
    const token = this.getToken();
    if (token) {
      return { 'Authorization': `Bearer ${token}` };
    }
    return {};
  }

  public subscribe(cb: (user: UserProfile | null) => void) {
    this.listeners.push(cb);
    if (this.initialized) {
      cb(this.currentUser);
    }
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  private notify() {
    this.listeners.forEach(cb => cb(this.currentUser));
  }

  /**
   * Check authenticated session with server (supports both Bearer token & HTTP-only cookie)
   */
  public async checkSession(): Promise<UserProfile | null> {
    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        ...this.getAuthHeaders(),
      };

      const res = await fetch('/api/auth/me', {
        method: 'GET',
        headers,
        credentials: 'include',
      });

      if (res.ok) {
        const user = await res.json();
        this.currentUser = user;
      } else {
        // If server says unauthorized, clear stored invalid token
        if (res.status === 401 || res.status === 403) {
          this.token = null;
          try {
            localStorage.removeItem('vynox_token');
            sessionStorage.removeItem('vynox_token');
          } catch (e) {}
        }
        this.currentUser = null;
      }
    } catch (e) {
      console.warn('Session check failed:', e);
      this.currentUser = null;
    } finally {
      this.initialized = true;
      this.notify();
    }
    return this.currentUser;
  }

  public async login(email: string, password: string): Promise<{ success: boolean; user?: UserProfile; token?: string; error?: string }> {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Error al iniciar sesión' };
      }

      if (data.token) {
        this.token = data.token;
        try {
          localStorage.setItem('vynox_token', data.token);
          sessionStorage.setItem('vynox_token', data.token);
        } catch (e) {}
      }

      this.currentUser = data.user;
      this.initialized = true;
      this.notify();
      return { success: true, user: data.user, token: data.token };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error de conexión con el servidor' };
    }
  }

  public async register(name: string, email: string, password: string): Promise<{ success: boolean; user?: UserProfile; token?: string; error?: string }> {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Error al registrar usuario' };
      }

      if (data.token) {
        this.token = data.token;
        try {
          localStorage.setItem('vynox_token', data.token);
          sessionStorage.setItem('vynox_token', data.token);
        } catch (e) {}
      }

      this.currentUser = data.user;
      this.initialized = true;
      this.notify();
      return { success: true, user: data.user, token: data.token };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error de conexión con el servidor' };
    }
  }

  public async logout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
        },
        credentials: 'include',
      });
    } catch (e) {
      // ignore
    }
    this.token = null;
    try {
      localStorage.removeItem('vynox_token');
      sessionStorage.removeItem('vynox_token');
    } catch (e) {}
    this.currentUser = null;
    this.notify();
    window.location.href = '/html/login.html';
  }

  public getUser(): UserProfile | null {
    return this.currentUser;
  }

  public isAdmin(): boolean {
    return this.currentUser?.role === 'admin';
  }
}

export const auth = AuthService.getInstance();

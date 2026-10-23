import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { db, TrackData, UserRole, UserStatus } from './src/db.ts';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'vynox_play_ultra_secret_jwt_key_2026';
const AUDIUS_CLIENT_ID = process.env.AUDIUS_CLIENT_ID || '2cc593fc814461263d282a84286fd4f72c79562e';
const AUDIUS_APP_NAME = process.env.AUDIUS_APP_NAME || 'VynoxPlay';

// Increase payload limit to support ad media uploads and DB JSON backup restores
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ limit: '60mb', extended: true }));

// Enable robust CORS and handle preflight requests for API endpoints & preview iframe
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// Dynamic Audius Host Discovery cache
let cachedAudiusHost = 'https://api.audius.co';
let lastHostCheck = 0;

async function getAudiusHost(): Promise<string> {
  const now = Date.now();
  if (now - lastHostCheck < 1000 * 60 * 10 && cachedAudiusHost) {
    return cachedAudiusHost;
  }
  try {
    const res = await fetch('https://api.audius.co', { headers: { 'Accept': 'application/json' } });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.data) && data.data.length > 0) {
        cachedAudiusHost = data.data[0];
        lastHostCheck = now;
        return cachedAudiusHost;
      }
    }
  } catch (err) {
    console.warn('Could not refresh Audius host, using default host:', err);
  }
  return cachedAudiusHost;
}

// Authentication Middleware
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    status: UserStatus;
  };
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];

  if (!token && req.headers.cookie) {
    const match = req.headers.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('vynox_token='));
    if (match) {
      token = match.split('=')[1];
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'No autorizado. Inicie sesión para continuar.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = db.findUserById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'Sesión inválida o expirada.' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({
        error: `Tu cuenta ha sido suspendida por el equipo de moderación. Motivo: ${user.suspension_reason || 'Infracción de normas.'}`,
        suspended: true,
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
    };
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token de acceso inválido o expirado.' });
  }
}

function requireModerator(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || (req.user.role !== 'moderator' && req.user.role !== 'admin' && req.user.role !== 'superadmin')) {
    return res.status(403).json({ error: 'Acceso restringido. Requiere permisos de moderación o superior.' });
  }
  next();
}

function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'superadmin')) {
    return res.status(403).json({ error: 'Acceso restringido. Solo administradores autorizados.' });
  }
  next();
}

function requireSuperAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Acceso restringido. Acción exclusiva del Administrador Principal (Superadmin).' });
  }
  next();
}

// ==========================================
// PUBLIC SETTINGS & NOTIFICATIONS & ADS
// ==========================================

app.get('/api/settings/public', (_req: Request, res: Response) => {
  const settings = db.getSettings();
  res.json({ success: true, settings });
});

app.get('/api/notifications/active', (_req: Request, res: Response) => {
  const notifications = db.getActiveNotifications();
  res.json({ success: true, notifications });
});

app.get('/api/ads/active', (req: Request, res: Response) => {
  const placement = req.query.placement as 'home_banner' | 'pre_roll_audio' | undefined;
  const ads = db.getActiveAds(placement);
  res.json({ success: true, ads });
});

app.post('/api/ads/:id/view', (req: Request, res: Response) => {
  const { id } = req.params;
  const ok = db.incrementAdView(id);
  res.json({ success: ok });
});

app.post('/api/ads/:id/click', (req: Request, res: Response) => {
  const { id } = req.params;
  const ok = db.incrementAdClick(id);
  res.json({ success: ok });
});

// User reports endpoint
app.post('/api/reports', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { reported_type, target_id, target_title, reason } = req.body;
    if (!reported_type || !target_id || !reason) {
      return res.status(400).json({ error: 'Datos de denuncia incompletos.' });
    }
    const report = db.createReport({
      reporter_id: req.user!.id,
      reporter_name: req.user!.name,
      reported_type,
      target_id,
      target_title: target_title || 'Elemento',
      reason,
    });
    return res.status(201).json({ success: true, report, message: 'Denuncia registrada correctamente.' });
  } catch (e: any) {
    db.recordSystemError('error', e.message, 'POST /api/reports', e.stack);
    return res.status(500).json({ error: 'Error al enviar reporte.' });
  }
});

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

// Register
app.post('/api/auth/register', (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const userAgent = req.headers['user-agent'] || 'Desconocido';

  try {
    const { name, email, password } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'El nombre debe tener al menos 2 caracteres.' });
    }
    if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      return res.status(400).json({ error: 'Por favor ingresa un correo electrónico válido.' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = db.findUserByEmail(cleanEmail);
    if (existing) {
      db.recordSecurityLog('suspicious', cleanEmail, ip, userAgent, 'Intento de registro con correo ya existente');
      return res.status(409).json({ error: 'Ya existe una cuenta registrada con este correo electrónico.' });
    }

    const newUser = db.createUser({ name, email: cleanEmail, password });
    db.recordSecurityLog('login_success', cleanEmail, ip, userAgent, 'Usuario registrado exitosamente');

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
    res.cookie('vynox_token', token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: isSecure ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({
      success: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
        avatar: newUser.avatar,
        created_at: newUser.created_at,
      },
      token,
    });
  } catch (err: any) {
    db.recordSystemError('error', err.message, 'POST /api/auth/register', err.stack);
    return res.status(500).json({ error: 'Error interno al registrar usuario.' });
  }
});

// Login
app.post('/api/auth/login', (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const userAgent = req.headers['user-agent'] || 'Desconocido';

  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Correo electrónico y contraseña requeridos.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = db.findUserByEmail(cleanEmail);
    if (!user) {
      db.recordSecurityLog('login_failed', cleanEmail, ip, userAgent, 'Usuario no encontrado');
      return res.status(401).json({ error: 'Credenciales inválidas. Revisa correo y contraseña.' });
    }

    if (user.status === 'suspended') {
      db.recordSecurityLog('blocked_attempt', cleanEmail, ip, userAgent, 'Intento de inicio de sesión con cuenta suspendida');
      return res.status(403).json({
        error: `Tu cuenta ha sido suspendida. Motivo: ${user.suspension_reason || 'Infracción de normas.'}`,
        suspended: true,
      });
    }

    const isValid = bcrypt.compareSync(password, user.password_hash);
    if (!isValid) {
      db.recordSecurityLog('login_failed', cleanEmail, ip, userAgent, 'Contraseña incorrecta');
      return res.status(401).json({ error: 'Credenciales inválidas. Revisa correo y contraseña.' });
    }

    db.updateUserLogin(user.id);
    db.recordSecurityLog('login_success', cleanEmail, ip, userAgent, 'Inicio de sesión correcto');

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
    res.cookie('vynox_token', token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: isSecure ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        avatar: user.avatar,
        created_at: user.created_at,
      },
      token,
    });
  } catch (err: any) {
    db.recordSystemError('error', err.message, 'POST /api/auth/login', err.stack);
    return res.status(500).json({ error: 'Error interno al iniciar sesión.' });
  }
});

// Current User Profile
app.get('/api/auth/me', authenticateToken, (req: AuthRequest, res: Response) => {
  const user = db.findUserById(req.user!.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
  return res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    avatar: user.avatar,
    created_at: user.created_at,
  });
});

// Logout
app.post('/api/auth/logout', (_req: Request, res: Response) => {
  res.clearCookie('vynox_token');
  return res.json({ success: true, message: 'Sesión cerrada correctamente.' });
});

// ==========================================
// AUDIUS MUSIC API PROXY & ENDPOINTS
// ==========================================

function formatAudiusTrack(t: any): TrackData {
  const artwork = t.artwork?.['480x480'] || t.artwork?.['1000x1000'] || t.artwork?.['150x150'] || '/assets/default-cover.svg';
  const trackId = String(t.id || t.track_id);
  return {
    id: trackId,
    title: t.title || 'Pista de Audio',
    artist: t.user?.name || t.user?.handle || 'Artista Audius',
    artist_handle: t.user?.handle,
    artwork,
    duration: typeof t.duration === 'number' ? t.duration : 0,
    genre: t.genre || 'Desconocido',
    stream_url: `https://api.audius.co/v1/tracks/${trackId}/stream?app_name=${AUDIUS_APP_NAME}&client_id=${AUDIUS_CLIENT_ID}`,
  };
}

// Trending tracks
app.get('/api/audius/trending', async (req: Request, res: Response) => {
  try {
    const host = await getAudiusHost();
    const genre = req.query.genre as string;
    const limit = parseInt(req.query.limit as string) || 24;

    let url = `${host}/v1/tracks/trending?app_name=${AUDIUS_APP_NAME}&client_id=${AUDIUS_CLIENT_ID}&limit=${limit}`;
    if (genre && genre !== 'All' && genre !== 'Todos') {
      url += `&genre=${encodeURIComponent(genre)}`;
    }

    const audiusRes = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!audiusRes.ok) {
      throw new Error(`Audius API returned status ${audiusRes.status}`);
    }

    const json = await audiusRes.json();
    const tracks = (json.data || []).map(formatAudiusTrack);

    // Also include custom promoted tracks from admin if matching genre or 'Todos'
    const customTracks = db.getCustomTracks().filter(ct => ct.is_promoted);
    const mappedCustom: TrackData[] = customTracks.map(ct => ({
      id: ct.id,
      title: ct.title,
      artist: ct.artist,
      artwork: ct.artwork || '/assets/default-cover.svg',
      duration: ct.duration,
      genre: ct.genre,
      stream_url: ct.stream_url,
      album: ct.album,
    }));

    return res.json({ success: true, tracks: [...mappedCustom, ...tracks] });
  } catch (err: any) {
    db.recordSystemError('warn', err.message, 'GET /api/audius/trending');
    return res.status(502).json({ error: 'Error al conectar con la red de Audius.', tracks: [] });
  }
});

// Search tracks
app.get('/api/audius/search', async (req: Request, res: Response) => {
  try {
    const q = (req.query.query || req.query.q) as string;
    if (!q || !q.trim()) {
      return res.json({ success: true, tracks: [] });
    }

    const host = await getAudiusHost();
    const url = `${host}/v1/tracks/search?query=${encodeURIComponent(q.trim())}&app_name=${AUDIUS_APP_NAME}&client_id=${AUDIUS_CLIENT_ID}`;
    const audiusRes = await fetch(url, { headers: { 'Accept': 'application/json' } });
    
    if (!audiusRes.ok) {
      throw new Error(`Audius API search returned ${audiusRes.status}`);
    }

    const json = await audiusRes.json();
    const tracks = (json.data || []).map(formatAudiusTrack);

    // Search custom tracks as well
    const custom = db.getCustomTracks().filter(ct => 
      ct.title.toLowerCase().includes(q.toLowerCase()) || 
      ct.artist.toLowerCase().includes(q.toLowerCase())
    );
    const customFormatted: TrackData[] = custom.map(ct => ({
      id: ct.id,
      title: ct.title,
      artist: ct.artist,
      artwork: ct.artwork,
      duration: ct.duration,
      genre: ct.genre,
      stream_url: ct.stream_url,
      album: ct.album,
    }));

    return res.json({ success: true, tracks: [...customFormatted, ...tracks], query: q });
  } catch (err: any) {
    db.recordSystemError('warn', err.message, 'GET /api/audius/search');
    return res.status(502).json({ error: 'Error en la búsqueda de Audius.', tracks: [] });
  }
});

// Stream URL resolver
app.get('/api/audius/stream/:trackId', async (req: Request, res: Response) => {
  const { trackId } = req.params;
  const custom = db.getCustomTracks().find(t => t.id === trackId);
  if (custom && custom.stream_url) {
    return res.redirect(custom.stream_url);
  }
  const streamUrl = `https://api.audius.co/v1/tracks/${trackId}/stream?app_name=${AUDIUS_APP_NAME}&client_id=${AUDIUS_CLIENT_ID}`;
  return res.redirect(streamUrl);
});

// Official Audius Genres List
app.get('/api/audius/genres', (_req: Request, res: Response) => {
  const genres = [
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
  return res.json({ success: true, genres });
});

// ==========================================
// USER PLAYLISTS, FAVORITES, HISTORY
// ==========================================

// Favorites
app.get('/api/favorites', authenticateToken, (req: AuthRequest, res: Response) => {
  const favs = db.getUserFavorites(req.user!.id);
  res.json({ success: true, favorites: favs });
});

app.post('/api/favorites', authenticateToken, (req: AuthRequest, res: Response) => {
  const { track } = req.body;
  if (!track || !track.id) {
    return res.status(400).json({ error: 'Información de canción requerida.' });
  }
  const result = db.toggleFavorite(req.user!.id, track);
  return res.json({ success: true, ...result });
});

app.delete('/api/favorites/:trackId', authenticateToken, (req: AuthRequest, res: Response) => {
  const { trackId } = req.params;
  const removed = db.removeFavorite(req.user!.id, trackId);
  return res.json({ success: true, removed });
});

// Playlists
app.get('/api/playlists', authenticateToken, (req: AuthRequest, res: Response) => {
  const playlists = db.getUserPlaylists(req.user!.id);
  res.json({ success: true, playlists });
});

app.post('/api/playlists', authenticateToken, (req: AuthRequest, res: Response) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'El nombre de la playlist es obligatorio.' });
  }
  const pl = db.createPlaylist(req.user!.id, name, description || '');
  res.status(201).json({ success: true, playlist: pl });
});

app.put('/api/playlists/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, description } = req.body;
  const updated = db.updatePlaylist(req.user!.id, id, name, description || '');
  if (!updated) {
    return res.status(404).json({ error: 'Playlist no encontrada o no autorizada.' });
  }
  res.json({ success: true, playlist: updated });
});

app.delete('/api/playlists/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const ok = db.deletePlaylist(req.user!.id, id);
  if (!ok) return res.status(404).json({ error: 'Playlist no encontrada o no autorizada.' });
  res.json({ success: true, message: 'Playlist eliminada.' });
});

app.post('/api/playlists/:id/tracks', authenticateToken, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { track } = req.body;
  if (!track || !track.id) return res.status(400).json({ error: 'Pista no válida.' });
  const ok = db.addTrackToPlaylist(req.user!.id, id, track);
  if (!ok) return res.status(404).json({ error: 'Playlist no encontrada.' });
  res.json({ success: true, message: 'Pista añadida a playlist.' });
});

app.delete('/api/playlists/:id/tracks/:trackId', authenticateToken, (req: AuthRequest, res: Response) => {
  const { id, trackId } = req.params;
  const ok = db.removeTrackFromPlaylist(req.user!.id, id, trackId);
  if (!ok) return res.status(404).json({ error: 'Pista o playlist no encontrada.' });
  res.json({ success: true, message: 'Pista removida de la playlist.' });
});

// History / Tracking
app.post('/api/history', authenticateToken, (req: AuthRequest, res: Response) => {
  const { track } = req.body;
  if (track && track.id) {
    db.recordPlay(req.user!.id, track);
  }
  res.json({ success: true });
});

app.get('/api/history', authenticateToken, (req: AuthRequest, res: Response) => {
  const history = db.getUserHistory(req.user!.id);
  res.json({ success: true, history });
});

// ==========================================
// 1. PANEL PRINCIPAL: OVERVIEW & LIVE STATS
// ==========================================

app.get('/api/admin/overview', authenticateToken, requireModerator, (_req: AuthRequest, res: Response) => {
  const stats = db.getAdminStats();
  res.json({ success: true, stats });
});

// Maintain backwards compatibility with /api/admin/stats
app.get('/api/admin/stats', authenticateToken, requireModerator, (_req: AuthRequest, res: Response) => {
  const stats = db.getAdminStats();
  res.json({ success: true, stats });
});

// ==========================================
// 2. GESTIÓN DE USUARIOS
// ==========================================

app.get('/api/admin/users', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
  const query = ((req.query.q || '') as string).toLowerCase().trim();
  const roleFilter = req.query.role as string;
  const statusFilter = req.query.status as string;

  let users = db.getAllUsers();

  if (query) {
    users = users.filter(u => u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query));
  }
  if (roleFilter && roleFilter !== 'all') {
    users = users.filter(u => u.role === roleFilter);
  }
  if (statusFilter && statusFilter !== 'all') {
    users = users.filter(u => u.status === statusFilter);
  }

  const enriched = users.map(u => ({
    ...u,
    playlistsCount: db.getUserPlaylists(u.id).length,
    favoritesCount: db.getUserFavorites(u.id).length,
    historyCount: db.getUserHistory(u.id, 500).length,
  }));

  res.json({ success: true, users: enriched });
});

// Consultar perfil de usuario completo
app.get('/api/admin/users/:id', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const user = db.findUserById(id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

  const { password_hash, ...safeUser } = user;
  const playlists = db.getUserPlaylists(id);
  const favorites = db.getUserFavorites(id);
  const history = db.getUserHistory(id, 25);
  const reportsAgainstUser = db.getAllReports().filter(r => r.reported_type === 'user' && r.target_id === id);

  res.json({
    success: true,
    user: safeUser,
    playlists,
    favoritesCount: favorites.length,
    history,
    reports: reportsAgainstUser,
  });
});

// Suspender o reactivar cuenta
app.put('/api/admin/users/:id/status', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status, reason } = req.body;

  if (status !== 'active' && status !== 'suspended') {
    return res.status(400).json({ error: 'Estado de usuario no válido.' });
  }

  const targetUser = db.findUserById(id);
  if (!targetUser) {
    return res.status(404).json({ error: 'Usuario no encontrado.' });
  }

  // Protect superadmin from being suspended
  if (targetUser.role === 'superadmin') {
    return res.status(403).json({ error: 'No es posible suspender al Administrador Principal.' });
  }

  // Only superadmin can suspend an admin
  if (targetUser.role === 'admin' && req.user!.role !== 'superadmin') {
    return res.status(403).json({ error: 'Solo el Administrador Principal puede suspender a otro administrador.' });
  }

  db.updateUserStatus(id, status, reason);
  db.recordAuditLog(
    req.user!.id,
    req.user!.name,
    status === 'suspended' ? 'user_suspend' : 'user_reactivate',
    targetUser.email,
    `Estado cambiado a ${status}. Motivo: ${reason || 'N/A'}`
  );

  res.json({ success: true, message: `Usuario ${status === 'suspended' ? 'suspendido' : 'reactivado'} correctamente.` });
});

// Roles y permisos
app.put('/api/admin/users/:id/role', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { role } = req.body;

  const validRoles: UserRole[] = ['superadmin', 'admin', 'moderator', 'user'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Rol no válido.' });
  }

  const targetUser = db.findUserById(id);
  if (!targetUser) return res.status(404).json({ error: 'Usuario no encontrado.' });

  // Only superadmin can assign admin or superadmin roles
  if ((role === 'admin' || role === 'superadmin' || targetUser.role === 'superadmin') && req.user!.role !== 'superadmin') {
    return res.status(403).json({ error: 'Solo el Administrador Principal puede otorgar o revocar privilegios de administrador.' });
  }

  db.updateUserRole(id, role);
  db.recordAuditLog(
    req.user!.id,
    req.user!.name,
    'user_role_change',
    targetUser.email,
    `Rol modificado de ${targetUser.role} a ${role}`
  );

  res.json({ success: true, message: `Rol de usuario actualizado a ${role}.` });
});

// Eliminar usuario permanentemente
app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const targetUser = db.findUserById(id);
  if (!targetUser) return res.status(404).json({ error: 'Usuario no encontrado.' });
  
  if (targetUser.role === 'superadmin') {
    return res.status(403).json({ error: 'No es posible eliminar al Administrador Principal.' });
  }

  if (targetUser.role === 'admin' && req.user!.role !== 'superadmin') {
    return res.status(403).json({ error: 'Solo el Administrador Principal puede eliminar a otro administrador.' });
  }

  const email = targetUser.email;
  db.deleteUser(id);
  db.recordAuditLog(
    req.user!.id,
    req.user!.name,
    'user_delete',
    email,
    `Cuenta de usuario eliminada permanentemente (${email})`
  );

  res.json({ success: true, message: `Usuario ${email} eliminado correctamente.` });
});

// ==========================================
// 3. GESTIÓN MUSICAL (CURATED & REPORTED)
// ==========================================

app.get('/api/admin/music', authenticateToken, requireModerator, (_req: AuthRequest, res: Response) => {
  const customTracks = db.getCustomTracks();
  const musicReports = db.getAllReports().filter(r => r.reported_type === 'track');
  res.json({ success: true, customTracks, reports: musicReports });
});

app.post('/api/admin/music', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
  const { title, artist, album, artwork, duration, stream_url, genre, is_promoted } = req.body;
  if (!title || !artist || !stream_url) {
    return res.status(400).json({ error: 'Título, artista y enlace de stream son obligatorios.' });
  }

  const track = db.createCustomTrack({
    title: title.trim(),
    artist: artist.trim(),
    album: album?.trim() || '',
    artwork: artwork?.trim() || '/assets/default-cover.svg',
    duration: parseInt(duration) || 180,
    stream_url: stream_url.trim(),
    genre: genre?.trim() || 'Custom',
    is_promoted: Boolean(is_promoted),
  });

  db.recordAuditLog(req.user!.id, req.user!.name, 'music_add', track.title, `Canción añadida por el admin`);
  res.status(201).json({ success: true, track });
});

app.delete('/api/admin/music/:id', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const ok = db.deleteCustomTrack(id);
  if (!ok) return res.status(404).json({ error: 'Pista no encontrada.' });

  db.recordAuditLog(req.user!.id, req.user!.name, 'music_delete', id, 'Pista musical eliminada');
  res.json({ success: true, message: 'Pista eliminada de la plataforma.' });
});

// ==========================================
// 4. SEGURIDAD
// ==========================================

app.get('/api/admin/security', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const logs = db.getSecurityLogs(limit);
  const failedAttempts = logs.filter(l => l.event === 'login_failed' || l.event === 'blocked_attempt');
  res.json({ success: true, logs, failedCount: failedAttempts.length });
});

// ==========================================
// 5. NOTIFICACIONES
// ==========================================

app.get('/api/admin/notifications', authenticateToken, requireAdmin, (_req: AuthRequest, res: Response) => {
  const notifications = db.getAllNotifications();
  res.json({ success: true, notifications });
});

app.post('/api/admin/notifications', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
  const { title, message, type, expires_at } = req.body;
  if (!title || !message) {
    return res.status(400).json({ error: 'Título y mensaje son obligatorios.' });
  }

  const notif = db.createNotification({
    title,
    message,
    type: type || 'info',
    expires_at,
  });

  db.recordAuditLog(req.user!.id, req.user!.name, 'notification_create', notif.title, `Aviso emitido: ${type}`);
  res.status(201).json({ success: true, notification: notif });
});

app.put('/api/admin/notifications/:id/toggle', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const ok = db.toggleNotification(id);
  if (!ok) return res.status(404).json({ error: 'Aviso no encontrado.' });
  res.json({ success: true, message: 'Estado del aviso actualizado.' });
});

app.delete('/api/admin/notifications/:id', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const ok = db.deleteNotification(id);
  if (!ok) return res.status(404).json({ error: 'Aviso no encontrado.' });
  res.json({ success: true, message: 'Aviso eliminado.' });
});

// ==========================================
// 6. CONFIGURACIÓN DE LA PLATAFORMA
// ==========================================

app.get('/api/admin/settings', authenticateToken, requireAdmin, (_req: AuthRequest, res: Response) => {
  const settings = db.getSettings();
  res.json({ success: true, settings });
});

app.put('/api/admin/settings', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
  const { platform_name, logo_url, welcome_text, info_text, legal_text, maintenance_mode } = req.body;

  const updated = db.updateSettings({
    ...(platform_name !== undefined && { platform_name: String(platform_name).trim() }),
    ...(logo_url !== undefined && { logo_url: String(logo_url).trim() }),
    ...(welcome_text !== undefined && { welcome_text: String(welcome_text).trim() }),
    ...(info_text !== undefined && { info_text: String(info_text).trim() }),
    ...(legal_text !== undefined && { legal_text: String(legal_text).trim() }),
    ...(maintenance_mode !== undefined && { maintenance_mode: Boolean(maintenance_mode) }),
  });

  db.recordAuditLog(req.user!.id, req.user!.name, 'settings_update', 'platform_settings', 'Configuración de la plataforma actualizada');
  res.json({ success: true, settings: updated, message: 'Configuración actualizada correctamente.' });
});

// ==========================================
// 7. HISTORIAL Y MODERACIÓN
// ==========================================

app.get('/api/admin/audit', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const logs = db.getAuditLogs(limit);
  res.json({ success: true, logs });
});

app.get('/api/admin/reports', authenticateToken, requireModerator, (_req: AuthRequest, res: Response) => {
  const reports = db.getAllReports();
  res.json({ success: true, reports });
});

app.put('/api/admin/reports/:id', authenticateToken, requireModerator, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status, admin_note } = req.body;

  if (status !== 'pending' && status !== 'resolved' && status !== 'dismissed') {
    return res.status(400).json({ error: 'Estado de denuncia no válido.' });
  }

  const ok = db.updateReportStatus(id, status, admin_note);
  if (!ok) return res.status(404).json({ error: 'Reporte no encontrado.' });

  db.recordAuditLog(req.user!.id, req.user!.name, 'report_moderate', id, `Reporte marcado como ${status}`);
  res.json({ success: true, message: `Reporte ${status} con éxito.` });
});

// ==========================================
// 8. ANUNCIOS PROMOCIONALES GLOBALES
// ==========================================

app.get('/api/admin/ads', authenticateToken, requireAdmin, (_req: AuthRequest, res: Response) => {
  const ads = db.getAllAds();
  res.json({ success: true, ads });
});

app.post('/api/admin/ads', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
  try {
    const {
      title,
      description,
      media_url,
      media_type,
      placement,
      target_url,
      duration,
      can_skip,
      skip_after,
      order,
      start_date,
      end_date,
      active,
    } = req.body;

    if (!title || !media_url) {
      return res.status(400).json({ error: 'El título y el medio publicitario (imagen o vídeo) son obligatorios.' });
    }

    const newAd = db.createAd({
      title: title.trim(),
      description: description?.trim() || '',
      media_url: media_url.trim(),
      media_type: media_type === 'video' ? 'video' : 'image',
      placement: placement === 'pre_roll_audio' ? 'pre_roll_audio' : 'home_banner',
      target_url: target_url?.trim() || '',
      duration: Math.max(1, parseInt(duration) || 8),
      can_skip: can_skip !== undefined ? Boolean(can_skip) : true,
      skip_after: Math.max(0, parseInt(skip_after) || 3),
      order: parseInt(order) || 1,
      start_date: start_date || undefined,
      end_date: end_date || undefined,
      active: active !== undefined ? Boolean(active) : true,
    });

    db.recordAuditLog(req.user!.id, req.user!.name, 'ad_create', newAd.title, `Anuncio creado (${newAd.placement})`);
    return res.status(201).json({ success: true, ad: newAd });
  } catch (err: any) {
    db.recordSystemError('error', err.message, 'POST /api/admin/ads', err.stack);
    return res.status(500).json({ error: 'Error al crear el anuncio publicitario.' });
  }
});

app.put('/api/admin/ads/:id', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const updated = db.updateAd(id, req.body);
  if (!updated) return res.status(404).json({ error: 'Anuncio no encontrado.' });

  db.recordAuditLog(req.user!.id, req.user!.name, 'ad_update', updated.title, 'Anuncio actualizado');
  res.json({ success: true, ad: updated });
});

app.delete('/api/admin/ads/:id', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const ad = db.getAdById(id);
  const ok = db.deleteAd(id);
  if (!ok) return res.status(404).json({ error: 'Anuncio no encontrado.' });

  db.recordAuditLog(req.user!.id, req.user!.name, 'ad_delete', ad?.title || id, 'Anuncio eliminado');
  res.json({ success: true, message: 'Anuncio eliminado correctamente.' });
});

// ==========================================
// 9. SISTEMA Y COPIAS DE SEGURIDAD
// ==========================================

app.get('/api/admin/system', authenticateToken, requireAdmin, (_req: AuthRequest, res: Response) => {
  const errors = db.getSystemErrors(50);
  const memory = process.memoryUsage();
  const uptime = process.uptime();

  res.json({
    success: true,
    system: {
      node_version: process.version,
      platform: process.platform,
      uptime_seconds: Math.floor(uptime),
      memory_rss_mb: (memory.rss / (1024 * 1024)).toFixed(1),
      memory_heap_mb: (memory.heapUsed / (1024 * 1024)).toFixed(1),
      errors,
    },
  });
});

// Backup download (JSON)
app.get('/api/admin/system/backup', authenticateToken, requireAdmin, (req: AuthRequest, res: Response) => {
  const backup = db.exportFullBackup();
  const filename = `vynox_play_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

  db.recordAuditLog(req.user!.id, req.user!.name, 'system_backup_export', filename, 'Descarga de copia de seguridad del sistema');

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(JSON.stringify(backup, null, 2));
});

// Restore backup from JSON (SUPERADMIN ONLY)
app.post('/api/admin/system/restore', authenticateToken, requireSuperAdmin, (req: AuthRequest, res: Response) => {
  try {
    const backupData = req.body;
    const result = db.importFullBackup(backupData);

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Copia de seguridad no válida.' });
    }

    db.recordAuditLog(req.user!.id, req.user!.name, 'system_backup_restore', 'db.json', 'Restauración completa de base de datos desde copia');
    return res.json({ success: true, message: 'Copia de seguridad restaurada correctamente en el sistema.' });
  } catch (err: any) {
    db.recordSystemError('error', err.message, 'POST /api/admin/system/restore', err.stack);
    return res.status(500).json({ error: 'Error al restaurar los datos del sistema.' });
  }
});

// ==========================================
// VITE DEV & STATIC SERVING INTEGRATION
// ==========================================

async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  app.get('/', (_req: Request, res: Response) => {
    res.redirect('/html/login.html');
  });

  app.get('/dash', (_req: Request, res: Response) => {
    res.redirect('/html/dash.html');
  });

  app.get('/login', (_req: Request, res: Response) => {
    res.redirect('/html/login.html');
  });

  // Serve static assets directory
  app.use('/assets', express.static(path.resolve(process.cwd(), 'assets')));

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'custom',
    });

    app.use(vite.middlewares);

    // Serve html files with Vite index transform
    app.get('/html/:page', async (req: Request, res: Response, next: NextFunction) => {
      const pageName = req.params.page;
      const filePath = path.resolve(process.cwd(), 'html', pageName);

      if (fs.existsSync(filePath)) {
        try {
          const rawHtml = fs.readFileSync(filePath, 'utf-8');
          const transformed = await vite.transformIndexHtml(req.originalUrl, rawHtml);
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          return res.send(transformed);
        } catch (e: any) {
          vite.ssrFixStacktrace(e);
          return next(e);
        }
      }
      return next();
    });
  } else {
    // Production static serving
    app.use('/css', express.static(path.resolve(process.cwd(), 'css')));
    app.use('/html', express.static(path.resolve(process.cwd(), 'html')));
    app.use(express.static(path.resolve(process.cwd(), 'dist')));

    app.get('/html/:page', (req: Request, res: Response) => {
      const filePath = path.resolve(process.cwd(), 'html', req.params.page);
      if (fs.existsSync(filePath)) {
        return res.sendFile(filePath);
      }
      return res.status(404).send('Página no encontrada');
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Vynox Play] Running on http://localhost:${PORT}`);
    console.log(`[Vynox Play] Main dashboard: http://localhost:${PORT}/html/dash.html`);
    console.log(`[Vynox Play] Login page: http://localhost:${PORT}/html/login.html`);
  });
}

startServer().catch(err => {
  console.error('Failed to start Vynox server:', err);
});

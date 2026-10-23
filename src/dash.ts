import '../css/vynox.css';
import { audius, Track } from './audius.ts';
import { auth, UserProfile } from './auth.ts';
import { player, PlayerState, PlayerService } from './player.ts';
import { library, PlaylistData } from './library.ts';
import { adminService, AdminStats, AdminUserItem } from './admin.ts';
import { Ad, CustomTrack, Report, UserRole, UserStatus } from './db.ts';

// Application State
interface AppState {
  currentView: 'home' | 'explore' | 'search' | 'favorites' | 'playlists' | 'playlist-detail' | 'history' | 'admin';
  currentAdminTab: 'overview' | 'users' | 'music' | 'ads' | 'security' | 'notifications' | 'reports' | 'settings' | 'system';
  selectedGenre: string;
  selectedPlaylist: PlaylistData | null;
  trendingTracks: Track[];
  searchResults: Track[];
  searchQuery: string;
  userPlaylists: PlaylistData[];
  userFavorites: Track[];
  historyTracks: Track[];
  adminStats: AdminStats | null;
  adminUsers: AdminUserItem[];
  currentUser: UserProfile | null;
  isLoading: boolean;
  selectedTrackForPlaylist: Track | null;
  selectedUserForDetail: AdminUserItem | null;
}

const state: AppState = {
  currentView: 'home',
  currentAdminTab: 'overview',
  selectedGenre: 'Todos',
  selectedPlaylist: null,
  trendingTracks: [],
  searchResults: [],
  searchQuery: '',
  userPlaylists: [],
  userFavorites: [],
  historyTracks: [],
  adminStats: null,
  adminUsers: [],
  currentUser: null,
  isLoading: false,
  selectedTrackForPlaylist: null,
  selectedUserForDetail: null,
};

// Toast notification helper
function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bg = type === 'success' ? 'bg-[#1C2618]/95 border-emerald-500/50 text-emerald-200' :
             type === 'error' ? 'bg-[#2E1815]/95 border-rose-500/50 text-rose-200' :
             'bg-[#221F1C]/95 border-amber-500/40 text-[#FAF7F2]';

  toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-xl text-xs font-medium transform transition-all duration-300 translate-y-2 opacity-0 ${bg}`;
  toast.innerHTML = `<span>${message}</span>`;

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// DOM Elements
let elViews: Record<string, HTMLElement | null> = {};
let searchTimeout: any = null;

// ==========================================
// PRE-ROLL GLOBAL ADS LOGIC
// ==========================================
let lastPrerollTime = 0;
let prerollTimerInterval: any = null;
let currentPrerollAd: Ad | null = null;
let uploadedAdMediaBase64: string = '';

async function playTrackWithAdCheck(track: Track, queue: Track[] = []) {
  const now = Date.now();
  try {
    const activeAds = await adminService.getActiveAds('pre_roll_audio');
    if (activeAds && activeAds.length > 0) {
      // 30 seconds interval between pre-rolls
      if (now - lastPrerollTime > 30000) {
        lastPrerollTime = now;
        const ad = activeAds[0];
        showPrerollAd(ad, () => {
          player.playTrack(track, queue);
        });
        return;
      }
    }
  } catch (e) {
    console.warn('Pre-roll check notice:', e);
  }

  // Otherwise directly play track
  player.playTrack(track, queue);
}

function showPrerollAd(ad: Ad, onFinish: () => void) {
  currentPrerollAd = ad;
  const modal = document.getElementById('modal-preroll-ad');
  const titleEl = document.getElementById('preroll-title');
  const descEl = document.getElementById('preroll-desc');
  const ctaBtn = document.getElementById('preroll-cta-btn') as HTMLAnchorElement;
  const skipBtn = document.getElementById('preroll-skip-btn') as HTMLButtonElement;
  const timerProgress = document.getElementById('preroll-timer-progress');
  const imgEl = document.getElementById('preroll-img') as HTMLImageElement;
  const videoEl = document.getElementById('preroll-video') as HTMLVideoElement;

  if (!modal) {
    onFinish();
    return;
  }

  // Register real impression in DB
  adminService.recordAdView(ad.id);

  if (titleEl) titleEl.textContent = ad.title;
  if (descEl) descEl.textContent = ad.description || 'Promoción oficial en Vynox Play.';

  // CTA button
  if (ctaBtn) {
    if (ad.target_url) {
      ctaBtn.href = ad.target_url;
      ctaBtn.classList.remove('hidden');
      ctaBtn.onclick = () => {
        adminService.recordAdClick(ad.id);
      };
    } else {
      ctaBtn.classList.add('hidden');
    }
  }

  // Media setup
  if (ad.media_type === 'video' && videoEl && imgEl) {
    imgEl.classList.add('hidden');
    videoEl.classList.remove('hidden');
    videoEl.src = ad.media_url;
    videoEl.currentTime = 0;
    videoEl.play().catch(() => {});
  } else if (imgEl && videoEl) {
    videoEl.classList.add('hidden');
    imgEl.classList.remove('hidden');
    imgEl.src = ad.media_url;
  }

  // Show modal
  modal.classList.remove('hidden');

  const totalDuration = Math.max(2, ad.duration || 8);
  const skipAfter = Math.min(totalDuration, Math.max(0, ad.skip_after ?? 3));
  let elapsed = 0;

  if (timerProgress) timerProgress.style.width = '0%';

  const finishAd = () => {
    clearInterval(prerollTimerInterval);
    if (videoEl) {
      videoEl.pause();
      videoEl.src = '';
    }
    modal.classList.add('hidden');
    currentPrerollAd = null;
    onFinish();
  };

  // Configure skip button initial state
  if (skipBtn) {
    if (!ad.can_skip) {
      skipBtn.disabled = true;
      skipBtn.textContent = 'Anuncio';
      skipBtn.className = 'px-3 py-1 rounded-xl bg-[#28231E] text-[#7D756C] text-xs font-semibold font-mono border border-[#3D352D] cursor-not-allowed';
    } else {
      skipBtn.disabled = skipAfter > 0;
      skipBtn.textContent = skipAfter > 0 ? `Saltar en ${skipAfter}s` : 'Saltar Anuncio ➔';
      skipBtn.className = skipAfter > 0 
        ? 'px-3 py-1 rounded-xl bg-[#28231E] text-[#7D756C] text-xs font-semibold font-mono border border-[#3D352D] cursor-not-allowed'
        : 'px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs font-bold font-mono border border-amber-500/40 cursor-pointer shadow-md';
      
      skipBtn.onclick = () => {
        if (!skipBtn.disabled) {
          finishAd();
        }
      };
    }
  }

  clearInterval(prerollTimerInterval);
  prerollTimerInterval = setInterval(() => {
    elapsed += 0.2;
    const pct = Math.min(100, (elapsed / totalDuration) * 100);
    if (timerProgress) timerProgress.style.width = `${pct}%`;

    if (ad.can_skip && skipBtn && elapsed < skipAfter) {
      const remaining = Math.ceil(skipAfter - elapsed);
      skipBtn.textContent = `Saltar en ${remaining}s`;
    } else if (ad.can_skip && skipBtn && elapsed >= skipAfter && skipBtn.disabled) {
      skipBtn.disabled = false;
      skipBtn.textContent = 'Saltar Anuncio ➔';
      skipBtn.className = 'px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs font-bold font-mono border border-amber-500/40 cursor-pointer shadow-md';
    }

    if (elapsed >= totalDuration) {
      finishAd();
    }
  }, 200);
}

// ==========================================
// HOME PROMOTIONAL BANNER & NOTICES
// ==========================================
async function renderHomePromotionalBanner() {
  const banner = document.getElementById('home-ad-banner');
  if (!banner) return;

  try {
    const activeAds = await adminService.getActiveAds('home_banner');
    if (!activeAds || activeAds.length === 0) {
      banner.classList.add('hidden');
      return;
    }

    const ad = activeAds[0];
    const imgEl = document.getElementById('home-ad-img') as HTMLImageElement;
    const videoEl = document.getElementById('home-ad-video') as HTMLVideoElement;
    const titleEl = document.getElementById('home-ad-title');
    const descEl = document.getElementById('home-ad-desc');
    const ctaBtn = document.getElementById('home-ad-cta-btn') as HTMLAnchorElement;

    if (titleEl) titleEl.textContent = ad.title;
    if (descEl) descEl.textContent = ad.description || 'Promoción oficial';

    if (ad.media_type === 'video' && videoEl && imgEl) {
      imgEl.classList.add('hidden');
      videoEl.classList.remove('hidden');
      videoEl.src = ad.media_url;
    } else if (imgEl && videoEl) {
      videoEl.classList.add('hidden');
      imgEl.classList.remove('hidden');
      imgEl.src = ad.media_url;
    }

    if (ctaBtn) {
      if (ad.target_url) {
        ctaBtn.href = ad.target_url;
        ctaBtn.classList.remove('hidden');
        ctaBtn.onclick = () => {
          adminService.recordAdClick(ad.id);
        };
      } else {
        ctaBtn.classList.add('hidden');
      }
    }

    banner.classList.remove('hidden');
    adminService.recordAdView(ad.id);
  } catch (e) {
    banner.classList.add('hidden');
  }
}

async function renderPlatformAnnouncement() {
  const banner = document.getElementById('platform-notification-banner');
  if (!banner) return;

  try {
    const res = await fetch('/api/notifications/active');
    if (!res.ok) return;
    const data = await res.json();
    const notifs = data.notifications || [];

    if (notifs.length === 0) {
      banner.classList.add('hidden');
      return;
    }

    const notif = notifs[0];
    const titleEl = document.getElementById('notif-banner-title');
    const msgEl = document.getElementById('notif-banner-message');
    const badgeEl = document.getElementById('notif-banner-badge');
    const closeBtn = document.getElementById('btn-close-notif-banner');

    if (titleEl) titleEl.textContent = notif.title;
    if (msgEl) msgEl.textContent = notif.message;
    if (badgeEl) {
      badgeEl.textContent = notif.type === 'warning' ? 'Mantenimiento' : notif.type === 'update' ? 'Novedad' : 'Aviso';
      badgeEl.className = notif.type === 'warning'
        ? 'px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40 shrink-0'
        : 'px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0';
    }

    if (closeBtn) {
      closeBtn.onclick = () => banner.classList.add('hidden');
    }

    banner.classList.remove('hidden');
  } catch (e) {
    banner.classList.add('hidden');
  }
}

async function syncPlatformSettings() {
  const settings = await adminService.getPublicSettings();
  if (settings && settings.platform_name) {
    document.title = `${settings.platform_name} • Streaming Musical de Alta Fidelidad`;
  }
}

// ==========================================
// LIFECYCLE & DOM INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
  initDOMElements();
  setupEventListeners();

  // Check user session
  const user = await auth.checkSession();
  state.currentUser = user;
  updateUserUI();

  // Subscribe to player state updates
  player.subscribe(renderPlayerState);

  // Sync settings & active notifications
  syncPlatformSettings();
  renderPlatformAnnouncement();

  // Initial load
  await loadHomeContent();
  if (state.currentUser) {
    loadUserLibrary();
  }
});

function initDOMElements() {
  elViews = {
    home: document.getElementById('view-home'),
    explore: document.getElementById('view-explore'),
    search: document.getElementById('view-search'),
    favorites: document.getElementById('view-favorites'),
    playlists: document.getElementById('view-playlists'),
    'playlist-detail': document.getElementById('view-playlist-detail'),
    history: document.getElementById('view-history'),
    admin: document.getElementById('view-admin'),
  };
}

function setupEventListeners() {
  // Navigation Links
  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = (btn as HTMLElement).dataset.nav as any;
      if (targetView) {
        navigateTo(targetView);
        closeMobileSidebar();
      }
    });
  });

  // Mobile Sidebar Drawer Toggle & Backdrop
  const btnMobileMenuToggle = document.getElementById('mobile-menu-toggle');
  if (btnMobileMenuToggle) {
    btnMobileMenuToggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openMobileSidebar();
    });
  }

  const btnSidebarClose = document.getElementById('sidebar-close-btn');
  if (btnSidebarClose) {
    btnSidebarClose.addEventListener('click', (e) => {
      e.preventDefault();
      closeMobileSidebar();
    });
  }

  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', () => {
      closeMobileSidebar();
    });
  }

  // Admin sub-navigation tabs
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = (btn as HTMLElement).dataset.adminTab as any;
      if (tab) {
        switchAdminTab(tab);
      }
    });
  });

  const btnAdminRefresh = document.getElementById('btn-admin-refresh');
  if (btnAdminRefresh) {
    btnAdminRefresh.addEventListener('click', () => {
      loadAdminDashboard();
      showToast('Datos de administración actualizados', 'info');
    });
  }

  // Search Input in Header & Search View
  const headerSearch = document.getElementById('header-search-input') as HTMLInputElement;
  if (headerSearch) {
    headerSearch.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value;
      if (val.trim()) {
        navigateTo('search');
        const viewSearch = document.getElementById('search-input') as HTMLInputElement;
        if (viewSearch) viewSearch.value = val;
        handleSearch(val);
      }
    });
  }

  const viewSearchInput = document.getElementById('search-input') as HTMLInputElement;
  if (viewSearchInput) {
    viewSearchInput.addEventListener('input', (e) => {
      handleSearch((e.target as HTMLInputElement).value);
    });
  }

  // Player Controls
  const btnPlayPause = document.getElementById('player-play-pause');
  if (btnPlayPause) btnPlayPause.addEventListener('click', () => player.togglePlay());

  const btnNext = document.getElementById('player-next');
  if (btnNext) btnNext.addEventListener('click', () => player.next());

  const btnPrev = document.getElementById('player-prev');
  if (btnPrev) btnPrev.addEventListener('click', () => player.prev());

  const btnShuffle = document.getElementById('player-shuffle');
  if (btnShuffle) btnShuffle.addEventListener('click', () => player.toggleShuffle());

  const btnRepeat = document.getElementById('player-repeat');
  if (btnRepeat) btnRepeat.addEventListener('click', () => player.cycleRepeat());

  const progressBar = document.getElementById('player-progress') as HTMLInputElement;
  if (progressBar) {
    progressBar.addEventListener('input', (e) => {
      const pct = parseFloat((e.target as HTMLInputElement).value);
      const targetTime = (pct / 100) * player.getState().duration;
      player.seek(targetTime);
    });
  }

  const volBar = document.getElementById('player-volume') as HTMLInputElement;
  if (volBar) {
    volBar.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value) / 100;
      player.setVolume(val);
    });
  }

  const btnMute = document.getElementById('player-mute');
  if (btnMute) btnMute.addEventListener('click', () => player.toggleMute());

  const playerHeart = document.getElementById('player-heart');
  if (playerHeart) {
    playerHeart.addEventListener('click', () => {
      const current = player.getState().currentTrack;
      if (current) handleFavoriteClick(current, playerHeart);
    });
  }

  // Create Playlist Modal handlers
  setupPlaylistModals();

  // Admin Modals & Form Handlers
  setupAdminModalsAndForms();

  // User Reporting Modal
  setupReportingModal();
}

// ==========================================
// NAVIGATION & VIEWS
// ==========================================

function navigateTo(viewName: keyof typeof elViews, extraData?: any) {
  state.currentView = viewName as any;

  // Toggle active view elements
  Object.keys(elViews).forEach(k => {
    const el = elViews[k];
    if (el) {
      if (k === viewName) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    }
  });

  // Update navigation button active styles
  document.querySelectorAll('[data-nav]').forEach(btn => {
    const target = (btn as HTMLElement).dataset.nav;
    if (target === viewName) {
      btn.classList.add('text-amber-400');
      btn.classList.remove('text-[#8A8074]', 'text-[#BDB5AA]');
      if (btn.classList.contains('px-3')) {
        btn.classList.add('bg-[#28231E]', 'border-amber-500/40');
        btn.classList.remove('border-transparent');
      }
    } else {
      btn.classList.remove('text-amber-400');
      btn.classList.add('text-[#BDB5AA]');
      if (btn.classList.contains('px-3')) {
        btn.classList.remove('bg-[#28231E]', 'border-amber-500/40');
        btn.classList.add('border-transparent');
      }
    }
  });

  if (viewName === 'home') {
    renderHomePromotionalBanner();
  } else if (viewName === 'explore') {
    renderExploreGenres();
  } else if (viewName === 'favorites') {
    renderFavorites();
  } else if (viewName === 'playlists') {
    renderPlaylists();
  } else if (viewName === 'playlist-detail') {
    if (extraData) state.selectedPlaylist = extraData;
    renderPlaylistDetail();
  } else if (viewName === 'history') {
    renderHistory();
  } else if (viewName === 'admin') {
    loadAdminDashboard();
  }

  closeMobileSidebar();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openMobileSidebar() {
  const sidebar = document.getElementById('main-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) {
    sidebar.classList.remove('-translate-x-full');
    sidebar.classList.add('translate-x-0');
  }
  if (backdrop) {
    backdrop.classList.remove('hidden');
  }
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('main-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) {
    sidebar.classList.add('-translate-x-full');
    sidebar.classList.remove('translate-x-0');
  }
  if (backdrop) {
    backdrop.classList.add('hidden');
  }
}

// Expose navigation & sidebar toggle globally
(window as any).navigateTo = navigateTo;
(window as any).switchAdminTab = switchAdminTab;
(window as any).openMobileSidebar = openMobileSidebar;
(window as any).closeMobileSidebar = closeMobileSidebar;

// ==========================================
// USER UI & AUTH STATUS
// ==========================================

function getInitials(name: string): string {
  if (!name) return 'VP';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function updateUserUI() {
  const user = state.currentUser;
  const initials = user ? getInitials(user.name) : 'VP';

  // Integrated Menu Profile Card
  const menuLogged = document.getElementById('menu-user-logged');
  const menuGuest = document.getElementById('menu-user-guest');
  const menuAvatar = document.getElementById('menu-user-avatar');
  const menuName = document.getElementById('menu-user-name');
  const menuBadge = document.getElementById('menu-user-badge');
  const menuEmail = document.getElementById('menu-user-email');

  // Top Header Profile Pill
  const headerLogged = document.getElementById('header-user-logged');
  const headerGuest = document.getElementById('header-user-guest');
  const headerAvatar = document.getElementById('header-user-avatar');
  const headerName = document.getElementById('header-user-name');
  const headerRole = document.getElementById('header-user-role');

  // Sidebar profile
  const userSection = document.getElementById('user-profile-section');
  const guestSection = document.getElementById('guest-profile-section');
  const userNameEl = document.getElementById('user-profile-name');
  const userRoleEl = document.getElementById('user-profile-role');
  const adminNavItem = document.getElementById('nav-admin-item');

  if (user) {
    const isStaff = user.role === 'admin' || user.role === 'superadmin' || user.role === 'moderator';

    if (menuLogged) menuLogged.classList.remove('hidden');
    if (menuGuest) menuGuest.classList.add('hidden');
    if (menuAvatar) menuAvatar.textContent = initials;
    if (menuName) menuName.textContent = user.name;
    if (menuEmail) menuEmail.textContent = user.email;
    if (menuBadge) {
      menuBadge.textContent = user.role.toUpperCase();
      menuBadge.className = isStaff
        ? 'px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0'
        : 'px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-[#28231E] text-[#D5CBC0] border border-[#3A332B] shrink-0';
    }

    if (headerLogged) headerLogged.classList.remove('hidden');
    if (headerGuest) headerGuest.classList.add('hidden');
    if (headerAvatar) headerAvatar.textContent = initials;
    if (headerName) headerName.textContent = user.name;
    if (headerRole) {
      headerRole.textContent = user.role === 'superadmin' ? 'Superadmin' : user.role === 'admin' ? 'Administrador' : user.role === 'moderator' ? 'Moderador' : 'Usuario';
    }

    if (userSection) userSection.classList.remove('hidden');
    if (guestSection) guestSection.classList.add('hidden');
    if (userNameEl) userNameEl.textContent = user.name;
    if (userRoleEl) {
      userRoleEl.textContent = user.role.toUpperCase();
      userRoleEl.className = isStaff 
        ? 'text-[10px] font-bold text-amber-400 tracking-wider font-mono'
        : 'text-[10px] font-bold text-amber-500/80 tracking-wider font-mono';
    }

    // Show Admin Link in sidebar for staff
    if (adminNavItem) {
      if (isStaff) {
        adminNavItem.classList.remove('hidden');
      } else {
        adminNavItem.classList.add('hidden');
      }
    }
  } else {
    if (menuLogged) menuLogged.classList.add('hidden');
    if (menuGuest) menuGuest.classList.remove('hidden');
    if (headerLogged) headerLogged.classList.add('hidden');
    if (headerGuest) headerGuest.classList.remove('hidden');
    if (userSection) userSection.classList.add('hidden');
    if (guestSection) guestSection.classList.remove('hidden');
    if (adminNavItem) adminNavItem.classList.add('hidden');
  }

  // Logout Buttons
  const btnLogoutSide = document.getElementById('btn-logout-sidebar');
  if (btnLogoutSide) {
    btnLogoutSide.onclick = async () => {
      await auth.logout();
      window.location.href = '/html/login.html';
    };
  }

  const btnLogoutMenu = document.getElementById('menu-btn-logout');
  if (btnLogoutMenu) {
    btnLogoutMenu.onclick = async () => {
      await auth.logout();
      window.location.href = '/html/login.html';
    };
  }
}

// ==========================================
// HOME VIEW
// ==========================================

async function loadHomeContent() {
  const grid = document.getElementById('trending-tracks-grid');
  if (grid) grid.innerHTML = createTrackSkeletons(12);

  renderGenreChips();
  renderHomePromotionalBanner();

  state.trendingTracks = await audius.getTrendingTracks('Todos', 24);
  renderHeroTrack();
  renderTrendingGrid();
}

function renderHeroTrack() {
  if (state.trendingTracks.length === 0) return;
  const heroTrack = state.trendingTracks[0];

  const titleEl = document.getElementById('hero-track-title');
  const artistEl = document.getElementById('hero-track-artist');
  const genreEl = document.getElementById('hero-track-genre');
  const coverEl = document.getElementById('hero-track-cover') as HTMLImageElement;
  const btnHeroPlay = document.getElementById('hero-play-btn');

  if (titleEl) titleEl.textContent = heroTrack.title;
  if (artistEl) artistEl.textContent = heroTrack.artist;
  if (genreEl) genreEl.textContent = heroTrack.genre || 'Destacado';
  if (coverEl) coverEl.src = heroTrack.artwork;

  if (btnHeroPlay) {
    btnHeroPlay.onclick = () => {
      playTrackWithAdCheck(heroTrack, state.trendingTracks);
    };
  }
}

function renderGenreChips() {
  const container = document.getElementById('home-genre-chips');
  if (!container) return;

  const popularGenres = ['Todos', 'Electronic', 'Hip-Hop/Rap', 'Pop', 'Rock', 'House', 'Trap', 'Lo-Fi', 'Latin', 'Ambient'];
  container.innerHTML = popularGenres.map(g => {
    const isActive = state.selectedGenre === g;
    return `
      <button 
        class="genre-chip px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
          isActive 
            ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20' 
            : 'bg-[#221F1C] hover:bg-[#2C2722] text-[#D5CBC0] hover:text-[#FAF7F2] border border-[#332D27]'
        }"
        data-genre="${g}"
      >
        ${g}
      </button>
    `;
  }).join('');

  container.querySelectorAll('[data-genre]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const g = (btn as HTMLElement).dataset.genre || 'Todos';
      state.selectedGenre = g;
      renderGenreChips();
      const grid = document.getElementById('trending-tracks-grid');
      if (grid) grid.innerHTML = createTrackSkeletons(8);
      state.trendingTracks = await audius.getTrendingTracks(g, 24);
      renderTrendingGrid();
    });
  });
}

function renderTrendingGrid() {
  const grid = document.getElementById('trending-tracks-grid');
  if (!grid) return;

  if (state.trendingTracks.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-500">
        No se encontraron pistas para este género.
      </div>
    `;
    return;
  }

  grid.innerHTML = state.trendingTracks.map((t, idx) => createMusicCardHtml(t, idx)).join('');
  attachMusicCardEvents(grid, state.trendingTracks);
}

function createMusicCardHtml(t: Track, idx: number): string {
  const isFav = library.isFavorite(t.id);
  const durationStr = PlayerService.formatTime(t.duration);

  return `
    <div 
      class="music-card bg-[#181614] border border-[#2D2823] hover:border-amber-500/40 rounded-xl p-3 flex flex-col justify-between group relative cursor-pointer"
      data-track-id="${t.id}"
      data-track-index="${idx}"
    >
      <div class="relative aspect-square w-full rounded-lg overflow-hidden mb-3 bg-[#201D1A]">
        <img 
          src="${t.artwork}" 
          alt="${t.title}" 
          loading="lazy"
          class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
          onerror="this.src='/assets/default-cover.svg'"
        />
        
        <!-- Play Overlay Button -->
        <button 
          class="play-btn-overlay absolute bottom-2 right-2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/25 hover:scale-110 active:scale-95 transition-all z-10"
          title="Reproducir"
          data-action="play"
        >
          <svg width="18" height="18" class="w-4 h-4 sm:w-5 sm:h-5 ml-0.5 fill-current" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>

        <span class="absolute top-2 left-2 text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-black/75 backdrop-blur-md text-[#D5CBC0] border border-[#3D352D]">
          ${t.genre || 'Vynox'}
        </span>
      </div>

      <div class="flex-1 min-w-0">
        <h4 class="text-xs sm:text-sm font-bold text-[#FAF7F2] truncate group-hover:text-amber-400 transition-colors" title="${t.title}">
          ${t.title}
        </h4>
        <p class="text-[11px] sm:text-xs text-[#BDB5AA] truncate mt-0.5" title="${t.artist}">
          ${t.artist}
        </p>
      </div>

      <div class="flex items-center justify-between mt-2.5 pt-2 border-t border-[#26221D] text-xs text-[#8A8074]">
        <span class="font-mono text-[10px] sm:text-[11px]">${durationStr}</span>
        
        <div class="flex items-center gap-1">
          <!-- Report button -->
          <button 
            class="p-1 sm:p-1.5 rounded-lg hover:bg-[#28231E] text-[#7D756C] hover:text-amber-400 transition-colors"
            title="Reportar canción"
            data-action="report"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
            </svg>
          </button>

          <!-- Favorite button -->
          <button 
            class="p-1 sm:p-1.5 rounded-lg hover:bg-[#28231E] text-[#8A8074] hover:text-rose-500 transition-colors ${isFav ? 'text-rose-500' : ''}"
            title="${isFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}"
            data-action="favorite"
          >
            <svg width="16" height="16" class="w-3.5 h-3.5 sm:w-4 sm:h-4 ${isFav ? 'fill-current' : 'fill-none'} stroke-current" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>

          <!-- Add to playlist button -->
          <button 
            class="p-1 sm:p-1.5 rounded-lg hover:bg-[#28231E] text-[#8A8074] hover:text-amber-400 transition-colors"
            title="Añadir a Playlist"
            data-action="add-to-playlist"
          >
            <svg width="16" height="16" class="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

function attachMusicCardEvents(container: HTMLElement, trackContext: Track[]) {
  container.querySelectorAll('.music-card').forEach(card => {
    const trackId = (card as HTMLElement).dataset.trackId;
    const track = trackContext.find(t => String(t.id) === String(trackId));
    if (!track) return;

    card.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const actionBtn = target.closest('[data-action]');
      const action = actionBtn?.getAttribute('data-action');

      if (action === 'report') {
        e.stopPropagation();
        openReportModal('track', track.id, `${track.title} - ${track.artist}`);
        return;
      }

      if (action === 'favorite') {
        e.stopPropagation();
        handleFavoriteClick(track, actionBtn as HTMLElement);
        return;
      }

      if (action === 'add-to-playlist') {
        e.stopPropagation();
        openAddToPlaylistModal(track);
        return;
      }

      // Default: play track with pre-roll ad check
      playTrackWithAdCheck(track, trackContext);
    });
  });
}

async function handleFavoriteClick(track: Track, btnEl: HTMLElement) {
  if (!state.currentUser) {
    showToast('Inicia sesión para guardar favoritos', 'info');
    return;
  }
  try {
    const isFav = await library.toggleFavorite(track);
    const svg = btnEl.querySelector('svg');
    if (svg) {
      if (isFav) {
        btnEl.classList.add('text-rose-500');
        svg.classList.add('fill-current');
        svg.classList.remove('fill-none');
      } else {
        btnEl.classList.remove('text-rose-500');
        svg.classList.remove('fill-current');
        svg.classList.add('fill-none');
      }
    }
    showToast(isFav ? 'Añadido a tus Favoritos' : 'Eliminado de tus Favoritos', 'success');
    loadUserLibrary();
  } catch (err) {
    console.warn('Could not complete favorite toggle:', err);
  }
}

// ==========================================
// ADD TO PLAYLIST MODAL
// ==========================================

function openAddToPlaylistModal(track: Track) {
  if (!state.currentUser) {
    showToast('Inicia sesión para gestionar tus playlists', 'info');
    window.location.href = '/html/login.html';
    return;
  }

  state.selectedTrackForPlaylist = track;
  const modal = document.getElementById('modal-add-to-playlist');
  const trackInfoEl = document.getElementById('modal-add-track-info');
  const playlistsContainer = document.getElementById('modal-add-playlists-list');

  if (trackInfoEl) {
    trackInfoEl.innerHTML = `
      <div class="flex items-center gap-3 p-2 bg-[#201D1A] rounded-xl border border-[#332D27]">
        <img src="${track.artwork}" class="w-10 h-10 rounded-lg object-cover" onerror="this.src='/assets/default-cover.svg'" />
        <div class="min-w-0">
          <p class="text-xs font-bold text-[#FAF7F2] truncate">${track.title}</p>
          <p class="text-[11px] text-[#BDB5AA] truncate">${track.artist}</p>
        </div>
      </div>
    `;
  }

  if (playlistsContainer) {
    if (state.userPlaylists.length === 0) {
      playlistsContainer.innerHTML = `
        <div class="text-center py-4 text-xs text-[#BDB5AA]">
          <p>No tienes playlists creadas todavía.</p>
          <button id="btn-create-first-playlist" class="mt-2 text-amber-400 hover:underline">
            + Crear una nueva playlist
          </button>
        </div>
      `;
      const btnFirst = document.getElementById('btn-create-first-playlist');
      if (btnFirst) {
        btnFirst.onclick = () => {
          if (modal) modal.classList.add('hidden');
          const createModal = document.getElementById('modal-create-playlist');
          if (createModal) createModal.classList.remove('hidden');
        };
      }
    } else {
      playlistsContainer.innerHTML = state.userPlaylists.map(pl => {
        const alreadyIn = pl.tracks.some(t => String(t.id) === String(track.id));
        return `
          <button 
            class="w-full text-left p-2.5 rounded-xl bg-[#201D1A] hover:bg-[#28231E] border border-[#332D27] hover:border-amber-500/40 transition-all flex items-center justify-between"
            data-target-playlist="${pl.id}"
          >
            <div>
              <p class="text-xs font-semibold text-[#FAF7F2]">${pl.name}</p>
              <p class="text-[10px] text-[#BDB5AA]">${pl.tracks.length} canciones</p>
            </div>
            <span class="text-xs ${alreadyIn ? 'text-amber-400 font-mono font-bold' : 'text-[#8A8074]'}">
              ${alreadyIn ? '✓ Ya añadida' : '+ Añadir'}
            </span>
          </button>
        `;
      }).join('');

      playlistsContainer.querySelectorAll('[data-target-playlist]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const plId = (btn as HTMLElement).dataset.targetPlaylist;
          if (plId && state.selectedTrackForPlaylist) {
            const ok = await library.addTrackToPlaylist(plId, state.selectedTrackForPlaylist);
            if (ok) {
              showToast('Canción agregada a playlist', 'success');
              if (modal) modal.classList.add('hidden');
              loadUserLibrary();
            } else {
              showToast('Error al añadir a playlist', 'error');
            }
          }
        });
      });
    }
  }

  if (modal) modal.classList.remove('hidden');
}

function setupPlaylistModals() {
  const modalCreate = document.getElementById('modal-create-playlist');
  const btnOpenCreate = document.getElementById('btn-create-playlist');
  const btnOpenCreateHeader = document.getElementById('btn-create-playlist-header');
  const btnCloseCreate = document.getElementById('modal-playlist-close');
  const formCreate = document.getElementById('form-create-playlist') as HTMLFormElement;

  const openCreate = () => {
    if (!state.currentUser) {
      showToast('Inicia sesión para crear playlists', 'info');
      window.location.href = '/html/login.html';
      return;
    }
    if (modalCreate) modalCreate.classList.remove('hidden');
  };

  if (btnOpenCreate) btnOpenCreate.onclick = openCreate;
  if (btnOpenCreateHeader) btnOpenCreateHeader.onclick = openCreate;
  if (btnCloseCreate && modalCreate) btnCloseCreate.onclick = () => modalCreate.classList.add('hidden');

  if (formCreate) {
    formCreate.onsubmit = async (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('playlist-name-input') as HTMLInputElement;
      const descInput = document.getElementById('playlist-desc-input') as HTMLInputElement;
      if (!nameInput || !nameInput.value.trim()) return;

      const pl = await library.createPlaylist(nameInput.value, descInput ? descInput.value : '');
      if (pl) {
        showToast('Playlist creada con éxito', 'success');
        if (modalCreate) modalCreate.classList.add('hidden');
        formCreate.reset();
        await loadUserLibrary();
        navigateTo('playlist-detail', pl);
      } else {
        showToast('Error al crear playlist', 'error');
      }
    };
  }

  const modalAdd = document.getElementById('modal-add-to-playlist');
  const btnCloseAdd = document.getElementById('modal-add-playlist-close');
  if (btnCloseAdd && modalAdd) btnCloseAdd.onclick = () => modalAdd.classList.add('hidden');
}

// ==========================================
// EXPLORE VIEW
// ==========================================

function renderExploreGenres() {
  const grid = document.getElementById('explore-genres-grid');
  if (!grid) return;

  const genres = [
    'Electronic', 'Hip-Hop/Rap', 'Pop', 'R&B/Soul', 'Rock', 
    'Latin', 'House', 'Techno', 'Trap', 'Indie', 'Lo-Fi', 'Ambient'
  ];

  grid.innerHTML = genres.map(g => `
    <div 
      class="genre-card bg-[#181614] border border-[#2D2823] hover:border-amber-500/50 p-5 rounded-2xl cursor-pointer group transition-all shadow-md"
      data-explore-genre="${g}"
    >
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-lg font-bold text-[#FAF7F2] group-hover:text-amber-400 transition-colors">${g}</h3>
        <span class="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-[#D5CBC0] group-hover:bg-amber-400 group-hover:text-slate-950 transition-colors">
          <svg width="16" height="16" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
      <p class="text-xs text-[#BDB5AA]">Pistas destacadas y artistas de ${g}</p>
    </div>
  `).join('');

  grid.querySelectorAll('[data-explore-genre]').forEach(card => {
    card.addEventListener('click', async () => {
      const genre = (card as HTMLElement).dataset.exploreGenre;
      if (genre) {
        state.selectedGenre = genre;
        navigateTo('home');
        renderGenreChips();
        const trendingGrid = document.getElementById('trending-tracks-grid');
        if (trendingGrid) trendingGrid.innerHTML = createTrackSkeletons(12);
        state.trendingTracks = await audius.getTrendingTracks(genre, 24);
        renderTrendingGrid();
      }
    });
  });
}

// ==========================================
// SEARCH VIEW
// ==========================================

function handleSearch(query: string) {
  clearTimeout(searchTimeout);
  state.searchQuery = query;

  const resultsGrid = document.getElementById('search-results-grid');
  const searchStatus = document.getElementById('search-status-text');

  if (!query.trim()) {
    if (resultsGrid) resultsGrid.innerHTML = '';
    if (searchStatus) searchStatus.textContent = 'Escribe el nombre de una canción o artista para buscar en Audius.';
    return;
  }

  if (searchStatus) searchStatus.textContent = `Buscando "${query}" en el catálogo oficial de Vynox...`;
  if (resultsGrid) resultsGrid.innerHTML = createTrackSkeletons(6);

  searchTimeout = setTimeout(async () => {
    try {
      const tracks = await audius.search(query);
      state.searchResults = tracks;

      if (tracks.length === 0) {
        if (searchStatus) searchStatus.textContent = `No se encontraron resultados para "${query}". Intenta con otro término.`;
        if (resultsGrid) resultsGrid.innerHTML = '';
      } else {
        if (searchStatus) searchStatus.textContent = `Mostrando ${tracks.length} resultados para "${query}":`;
        if (resultsGrid) {
          resultsGrid.innerHTML = tracks.map((t, idx) => createMusicCardHtml(t, idx)).join('');
          attachMusicCardEvents(resultsGrid, tracks);
        }
      }
    } catch (e) {
      if (searchStatus) searchStatus.textContent = 'Error al realizar la búsqueda en Audius.';
    }
  }, 400);
}

// ==========================================
// FAVORITES VIEW
// ==========================================

async function renderFavorites() {
  const container = document.getElementById('favorites-tracks-container');
  const countEl = document.getElementById('favorites-count');
  const btnPlayAll = document.getElementById('btn-play-all-favorites');

  if (!state.currentUser) {
    if (container) {
      container.innerHTML = `
        <div class="py-16 text-center text-[#BDB5AA]">
          <p class="text-base font-semibold mb-2">Inicia sesión para ver tu biblioteca de favoritos</p>
          <a href="/html/login.html" class="inline-block px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-md">
            Iniciar Sesión / Registrarse
          </a>
        </div>
      `;
    }
    return;
  }

  const favs = await library.getFavorites();
  state.userFavorites = favs;

  if (countEl) countEl.textContent = `${favs.length} canciones guardadas`;

  if (favs.length === 0) {
    if (container) {
      container.innerHTML = `
        <div class="py-16 text-center text-[#8A8074]">
          <svg width="32" height="32" class="w-8 h-8 mx-auto mb-3 text-[#5A5247]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
          </svg>
          <p class="text-sm font-semibold text-[#D5CBC0]">Tu lista de favoritos está vacía</p>
          <p class="text-xs text-[#8A8074] mt-1">Explora canciones y haz clic en el corazón para guardarlas aquí.</p>
        </div>
      `;
    }
    return;
  }

  if (btnPlayAll) {
    btnPlayAll.onclick = () => {
      if (favs.length > 0) playTrackWithAdCheck(favs[0], favs);
    };
  }

  if (container) {
    container.innerHTML = favs.map((t, idx) => `
      <div 
        class="flex items-center justify-between p-3 rounded-xl bg-[#181614] hover:bg-[#201D1A] border border-[#2D2823] transition-all group cursor-pointer"
        data-fav-track-id="${t.id}"
      >
        <div class="flex items-center gap-3 min-w-0">
          <span class="font-mono text-xs text-[#8A8074] w-5 text-right">${idx + 1}</span>
          <img src="${t.artwork}" class="w-11 h-11 rounded-lg object-cover" onerror="this.src='/assets/default-cover.svg'" />
          <div class="min-w-0">
            <p class="text-sm font-bold text-[#FAF7F2] truncate group-hover:text-amber-400 transition-colors">${t.title}</p>
            <p class="text-xs text-[#BDB5AA] truncate">${t.artist}</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <span class="text-xs font-mono text-[#8A8074]">${PlayerService.formatTime(t.duration)}</span>
          <button 
            class="p-2 text-rose-500 hover:text-white transition-colors"
            title="Quitar de favoritos"
            data-action="remove-fav"
          >
            <svg width="16" height="16" class="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('[data-fav-track-id]').forEach(row => {
      const id = (row as HTMLElement).dataset.favTrackId;
      const track = favs.find(t => String(t.id) === String(id));
      if (!track) return;

      row.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('[data-action="remove-fav"]')) {
          e.stopPropagation();
          library.toggleFavorite(track).then(() => {
            showToast('Eliminado de favoritos', 'info');
            renderFavorites();
          });
          return;
        }
        playTrackWithAdCheck(track, favs);
      });
    });
  }
}

// ==========================================
// PLAYLISTS VIEW & DETAIL
// ==========================================

async function loadUserLibrary() {
  state.userPlaylists = await library.getPlaylists();
  state.userFavorites = await library.getFavorites();
}

async function renderPlaylists() {
  const container = document.getElementById('playlists-grid');
  if (!container) return;

  if (!state.currentUser) {
    container.innerHTML = `
      <div class="col-span-full py-16 text-center text-[#BDB5AA]">
        <p class="text-base font-semibold mb-2">Inicia sesión para gestionar tus playlists personalizadas</p>
        <a href="/html/login.html" class="inline-block px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-md">
          Iniciar Sesión / Registrarse
        </a>
      </div>
    `;
    return;
  }

  const playlists = await library.getPlaylists();
  state.userPlaylists = playlists;

  if (playlists.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-16 text-center text-[#8A8074]">
        <svg width="32" height="32" class="w-8 h-8 mx-auto mb-3 text-[#5A5247]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
        </svg>
        <p class="text-sm font-semibold text-[#D5CBC0]">No tienes ninguna playlist creada aún</p>
        <button id="btn-create-playlist-empty" class="mt-3 px-4 py-2 rounded-xl bg-[#28231E] hover:bg-[#332D27] border border-amber-500/40 text-amber-400 text-xs font-semibold transition-all">
          + Crear mi primera playlist
        </button>
      </div>
    `;
    const btnEmpty = document.getElementById('btn-create-playlist-empty');
    if (btnEmpty) {
      btnEmpty.onclick = () => {
        const modal = document.getElementById('modal-create-playlist');
        if (modal) modal.classList.remove('hidden');
      };
    }
    return;
  }

  container.innerHTML = playlists.map(pl => {
    const firstCover = pl.tracks.length > 0 ? pl.tracks[0].artwork : '/assets/default-cover.svg';
    return `
      <div 
        class="music-card bg-[#181614] border border-[#2D2823] hover:border-amber-500/40 rounded-2xl p-4 flex flex-col justify-between cursor-pointer group shadow-lg"
        data-playlist-card-id="${pl.id}"
      >
        <div class="relative aspect-square w-full rounded-xl overflow-hidden mb-3 bg-[#201D1A] flex items-center justify-center">
          <img 
            src="${firstCover}" 
            alt="${pl.name}" 
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
            onerror="this.src='/assets/default-cover.svg'"
          />
          <span class="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/75 backdrop-blur-md text-[10px] font-mono text-amber-400 border border-[#3D352D]">
            ${pl.tracks.length} canciones
          </span>
        </div>

        <div>
          <h4 class="text-base font-bold text-[#FAF7F2] truncate group-hover:text-amber-400 transition-colors">${pl.name}</h4>
          <p class="text-xs text-[#BDB5AA] line-clamp-2 mt-1">${pl.description || 'Sin descripción'}</p>
        </div>

        <div class="mt-4 pt-3 border-t border-[#26221D] flex items-center justify-between text-xs text-[#8A8074]">
          <span class="font-mono text-[10px]">Actualizado</span>
          <button class="text-amber-400 font-semibold group-hover:underline">Ver playlist &rarr;</button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-playlist-card-id]').forEach(card => {
    card.addEventListener('click', () => {
      const id = (card as HTMLElement).dataset.playlistCardId;
      const pl = playlists.find(p => p.id === id);
      if (pl) navigateTo('playlist-detail', pl);
    });
  });
}

function renderPlaylistDetail() {
  const pl = state.selectedPlaylist;
  if (!pl) return;

  const titleEl = document.getElementById('playlist-detail-title');
  const descEl = document.getElementById('playlist-detail-desc');
  const countEl = document.getElementById('playlist-detail-count');
  const tracksListEl = document.getElementById('playlist-detail-tracks');
  const btnPlayAll = document.getElementById('btn-play-all-playlist');
  const btnDelete = document.getElementById('btn-delete-playlist');

  if (titleEl) titleEl.textContent = pl.name;
  if (descEl) descEl.textContent = pl.description || 'Playlist personalizada en Vynox Play';
  if (countEl) countEl.textContent = `${pl.tracks.length} canciones`;

  if (btnPlayAll) {
    btnPlayAll.onclick = () => {
      if (pl.tracks.length > 0) playTrackWithAdCheck(pl.tracks[0], pl.tracks);
      else showToast('La playlist está vacía', 'info');
    };
  }

  if (btnDelete) {
    btnDelete.onclick = async () => {
      if (confirm(`¿Estás seguro de que deseas eliminar la playlist "${pl.name}"?`)) {
        const ok = await library.deletePlaylist(pl.id);
        if (ok) {
          showToast('Playlist eliminada', 'success');
          await loadUserLibrary();
          navigateTo('playlists');
        } else {
          showToast('Error al eliminar playlist', 'error');
        }
      }
    };
  }

  if (tracksListEl) {
    if (pl.tracks.length === 0) {
      tracksListEl.innerHTML = `
        <div class="py-12 text-center text-slate-500">
          <p>Esta playlist no contiene pistas aún.</p>
          <p class="text-xs text-slate-600 mt-1">Explora canciones y haz clic en el botón "+" para añadirlas aquí.</p>
        </div>
      `;
      return;
    }

    tracksListEl.innerHTML = pl.tracks.map((t, idx) => `
      <div 
        class="flex items-center justify-between p-3 rounded-xl bg-[#181614] hover:bg-[#201D1A] border border-[#2D2823] transition-all group cursor-pointer"
        data-playlist-track-id="${t.id}"
      >
        <div class="flex items-center gap-3 min-w-0">
          <span class="font-mono text-xs text-[#8A8074] w-5 text-right">${idx + 1}</span>
          <img src="${t.artwork}" class="w-11 h-11 rounded-lg object-cover" onerror="this.src='/assets/default-cover.svg'" />
          <div class="min-w-0">
            <p class="text-sm font-bold text-[#FAF7F2] truncate group-hover:text-amber-400 transition-colors">${t.title}</p>
            <p class="text-xs text-[#BDB5AA] truncate">${t.artist}</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <span class="text-xs font-mono text-[#8A8074]">${PlayerService.formatTime(t.duration)}</span>
          <button 
            class="p-2 text-[#8A8074] hover:text-rose-400 transition-colors"
            title="Quitar de playlist"
            data-action="remove-from-pl"
          >
            <svg width="16" height="16" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    `).join('');

    tracksListEl.querySelectorAll('[data-playlist-track-id]').forEach(row => {
      const id = (row as HTMLElement).dataset.playlistTrackId;
      const track = pl.tracks.find(t => String(t.id) === String(id));
      if (!track) return;

      row.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('[data-action="remove-from-pl"]')) {
          e.stopPropagation();
          const ok = await library.removeTrackFromPlaylist(pl.id, track.id);
          if (ok) {
            showToast('Pista eliminada de playlist', 'info');
            pl.tracks = pl.tracks.filter(t => String(t.id) !== String(track.id));
            renderPlaylistDetail();
            loadUserLibrary();
          }
          return;
        }
        playTrackWithAdCheck(track, pl.tracks);
      });
    });
  }
}

// ==========================================
// HISTORY VIEW
// ==========================================

async function renderHistory() {
  const container = document.getElementById('history-tracks-container');
  if (!container) return;

  if (!state.currentUser) {
    container.innerHTML = `
      <div class="py-16 text-center text-[#BDB5AA]">
        <p class="text-base font-semibold mb-2">Inicia sesión para registrar tu historial de reproducción</p>
        <a href="/html/login.html" class="inline-block px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-md">
          Iniciar Sesión
        </a>
      </div>
    `;
    return;
  }

  const history = await library.getHistory();
  state.historyTracks = history;

  if (history.length === 0) {
    container.innerHTML = `
      <div class="py-16 text-center text-[#8A8074]">
        <p class="text-sm font-semibold text-[#D5CBC0]">No hay canciones reproducidas recientemente</p>
        <p class="text-xs text-[#8A8074] mt-1">Las pistas que escuches se guardarán aquí automáticamente.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = history.map((t, idx) => `
    <div 
      class="flex items-center justify-between p-3 rounded-xl bg-[#181614] hover:bg-[#201D1A] border border-[#2D2823] transition-all group cursor-pointer"
      data-history-track-id="${t.id}"
    >
      <div class="flex items-center gap-3 min-w-0">
        <span class="font-mono text-xs text-[#8A8074] w-5 text-right">${idx + 1}</span>
        <img src="${t.artwork}" class="w-11 h-11 rounded-lg object-cover" onerror="this.src='/assets/default-cover.svg'" />
        <div class="min-w-0">
          <p class="text-sm font-bold text-[#FAF7F2] truncate group-hover:text-amber-400 transition-colors">${t.title}</p>
          <p class="text-xs text-[#BDB5AA] truncate">${t.artist}</p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <span class="text-xs font-mono text-[#8A8074]">${PlayerService.formatTime(t.duration)}</span>
        <button class="p-1.5 rounded-lg bg-amber-400/10 text-amber-400 hover:bg-amber-400 hover:text-slate-950 transition-colors" title="Reproducir">
          <svg width="16" height="16" class="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('[data-history-track-id]').forEach(row => {
    const id = (row as HTMLElement).dataset.historyTrackId;
    const track = history.find(t => String(t.id) === String(id));
    if (track) {
      row.addEventListener('click', () => {
        playTrackWithAdCheck(track, history);
      });
    }
  });
}

// ==========================================
// REPORTING MODAL
// ==========================================

function openReportModal(type: 'track' | 'user', id: string, title: string) {
  if (!state.currentUser) {
    showToast('Inicia sesión para reportar contenido', 'info');
    return;
  }

  const modal = document.getElementById('modal-report-item');
  const typeInput = document.getElementById('report-input-type') as HTMLInputElement;
  const idInput = document.getElementById('report-input-id') as HTMLInputElement;
  const titleInput = document.getElementById('report-input-title') as HTMLInputElement;
  const targetLabel = document.getElementById('report-target-label');

  if (typeInput) typeInput.value = type;
  if (idInput) idInput.value = id;
  if (titleInput) titleInput.value = title;
  if (targetLabel) targetLabel.textContent = `${type === 'track' ? 'Canción' : 'Usuario'}: ${title}`;

  if (modal) modal.classList.remove('hidden');
}

function setupReportingModal() {
  const modal = document.getElementById('modal-report-item');
  const closeBtn = document.getElementById('modal-report-close');
  const form = document.getElementById('form-report-item') as HTMLFormElement;

  if (closeBtn && modal) {
    closeBtn.onclick = () => modal.classList.add('hidden');
  }

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const type = (document.getElementById('report-input-type') as HTMLInputElement).value as any;
      const id = (document.getElementById('report-input-id') as HTMLInputElement).value;
      const title = (document.getElementById('report-input-title') as HTMLInputElement).value;
      const reasonSelect = document.getElementById('report-input-reason-select') as HTMLSelectElement;
      const notes = (document.getElementById('report-input-notes') as HTMLTextAreaElement).value;

      const fullReason = `${reasonSelect.value}${notes ? ` - ${notes}` : ''}`;
      const ok = await adminService.submitReport({
        reported_type: type,
        target_id: id,
        target_title: title,
        reason: fullReason,
      });

      if (ok) {
        showToast('Reporte enviado a los moderadores. Gracias por tu colaboración.', 'success');
        if (modal) modal.classList.add('hidden');
        form.reset();
      } else {
        showToast('Error al enviar reporte.', 'error');
      }
    };
  }
}

// ==========================================
// ADMIN DASHBOARD & SUB-PANEL CONTROLLER
// ==========================================

async function loadAdminDashboard() {
  if (!state.currentUser || (state.currentUser.role !== 'admin' && state.currentUser.role !== 'superadmin' && state.currentUser.role !== 'moderator')) {
    navigateTo('home');
    showToast('Acceso restringido al personal administrativo', 'error');
    return;
  }

  // Update role badge in header
  const roleBadge = document.getElementById('admin-header-role-badge');
  if (roleBadge) {
    roleBadge.textContent = state.currentUser.role.toUpperCase();
  }

  // Load active subpanel
  switchAdminTab(state.currentAdminTab);
}

function switchAdminTab(tabName: AppState['currentAdminTab']) {
  state.currentAdminTab = tabName;

  // Update tab buttons
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    const targetTab = (btn as HTMLElement).dataset.adminTab;
    if (targetTab === tabName) {
      btn.className = 'admin-tab-btn px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap bg-amber-500/20 text-amber-300 border border-amber-500/40 transition-all inline-flex items-center gap-1.5';
    } else {
      btn.className = 'admin-tab-btn px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap bg-[#1D1B18] text-[#BDB5AA] hover:text-[#FAF7F2] border border-[#2D2823] transition-all inline-flex items-center gap-1.5';
    }
  });

  // Hide all panels, show target panel
  document.querySelectorAll('.admin-subpanel').forEach(panel => {
    panel.classList.add('hidden');
  });

  const targetPanel = document.getElementById(`admin-panel-${tabName}`);
  if (targetPanel) {
    targetPanel.classList.remove('hidden');
  }

  // Fetch data specific to the active tab
  if (tabName === 'overview') {
    loadOverviewTab();
  } else if (tabName === 'users') {
    loadUsersTab();
  } else if (tabName === 'music') {
    loadMusicTab();
  } else if (tabName === 'ads') {
    loadAdsTab();
  } else if (tabName === 'security') {
    loadSecurityTab();
  } else if (tabName === 'notifications') {
    loadNotificationsTab();
  } else if (tabName === 'reports') {
    loadReportsTab();
  } else if (tabName === 'settings') {
    loadSettingsTab();
  } else if (tabName === 'system') {
    loadSystemTab();
  }
}

// 1. OVERVIEW TAB
async function loadOverviewTab() {
  const stats = await adminService.getOverview();
  if (!stats) return;

  const elUsers = document.getElementById('admin-stat-users');
  const elUsersSub = document.getElementById('admin-stat-users-sub');
  const elPlaylists = document.getElementById('admin-stat-playlists');
  const elFavorites = document.getElementById('admin-stat-favorites');
  const elPlays = document.getElementById('admin-stat-plays');
  const elAds = document.getElementById('admin-stat-ads');
  const elAdsSub = document.getElementById('admin-stat-ads-sub');
  const elReports = document.getElementById('admin-stat-reports');

  if (elUsers) elUsers.textContent = String(stats.totalUsers);
  if (elUsersSub) elUsersSub.textContent = `${stats.activeUsers} activos • ${stats.suspendedUsers} susp.`;
  if (elPlaylists) elPlaylists.textContent = String(stats.totalPlaylists);
  if (elFavorites) elFavorites.textContent = String(stats.totalFavorites);
  if (elPlays) elPlays.textContent = String(stats.totalPlays);
  if (elAds) elAds.textContent = String(stats.totalAds);
  if (elAdsSub) elAdsSub.textContent = `${stats.totalAdViews} v • ${stats.totalAdClicks} c`;
  if (elReports) elReports.textContent = String(stats.pendingReports);

  // Top tracks
  const topTracksContainer = document.getElementById('admin-top-tracks-list');
  if (topTracksContainer) {
    if (!stats.topTracks || stats.topTracks.length === 0) {
      topTracksContainer.innerHTML = '<p class="text-xs text-[#8A8074] italic">Sin reproducciones registradas aún.</p>';
    } else {
      topTracksContainer.innerHTML = stats.topTracks.map((t, idx) => `
        <div class="flex items-center justify-between p-2 rounded-xl bg-[#201D1A] border border-[#2D2823]">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="font-mono text-xs text-amber-400 font-bold w-4">${idx + 1}</span>
            <div class="truncate">
              <p class="text-xs font-bold text-[#FAF7F2] truncate">${t.title}</p>
              <p class="text-[10px] text-[#BDB5AA] truncate">${t.artist}</p>
            </div>
          </div>
          <span class="text-xs font-mono text-amber-400 font-semibold shrink-0 ml-2">${t.count} reproducciones</span>
        </div>
      `).join('');
    }
  }

  // Recent audit logs
  const auditContainer = document.getElementById('admin-recent-audit-list');
  if (auditContainer) {
    if (!stats.recentAudit || stats.recentAudit.length === 0) {
      auditContainer.innerHTML = '<p class="text-xs text-[#8A8074] italic">Sin acciones registradas aún.</p>';
    } else {
      auditContainer.innerHTML = stats.recentAudit.map(a => `
        <div class="p-2.5 rounded-xl bg-[#201D1A] border border-[#2D2823] space-y-0.5">
          <div class="flex items-center justify-between text-[10px] font-mono">
            <span class="font-bold text-amber-400">${a.admin_name} • ${a.action}</span>
            <span class="text-[#8A8074]">${new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <p class="text-xs text-[#FAF7F2] truncate">${a.details}</p>
        </div>
      `).join('');
    }
  }
}

// 2. USERS TAB
async function loadUsersTab() {
  const searchInput = document.getElementById('admin-users-search') as HTMLInputElement;
  const roleSelect = document.getElementById('admin-users-role-filter') as HTMLSelectElement;
  const statusSelect = document.getElementById('admin-users-status-filter') as HTMLSelectElement;

  const search = searchInput?.value || '';
  const role = roleSelect?.value || 'all';
  const status = statusSelect?.value || 'all';

  const users = await adminService.getUsers(search, role, status);
  state.adminUsers = users;

  const tbody = document.getElementById('admin-users-tbody');
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-8 text-center text-xs text-[#8A8074]">No se encontraron usuarios coincidentes.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = users.map(u => {
    const isSuspended = u.status === 'suspended';
    const roleBadgeClass = u.role === 'superadmin' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                           u.role === 'admin' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                           u.role === 'moderator' ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30' :
                           'bg-[#28231E] text-[#BDB5AA] border-[#3D352D]';

    return `
      <tr class="border-b border-[#2D2823] hover:bg-[#201D1A]/50 transition-colors">
        <td class="py-3 px-3 text-xs font-semibold text-[#FAF7F2] flex items-center gap-2">
          <div class="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-[#E07A5F] flex items-center justify-center font-bold text-slate-950 text-[10px] shrink-0">
            ${getInitials(u.name)}
          </div>
          <span class="truncate">${u.name}</span>
        </td>
        <td class="py-3 px-3 text-xs text-[#BDB5AA] font-mono truncate">${u.email}</td>
        <td class="py-3 px-3 text-xs">
          <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${roleBadgeClass}">
            ${u.role}
          </span>
        </td>
        <td class="py-3 px-3 text-xs">
          <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
            isSuspended ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
          }">
            ${isSuspended ? 'Suspendido' : 'Activo'}
          </span>
        </td>
        <td class="py-3 px-3 text-xs font-mono text-[#BDB5AA]">${u.playlistsCount} pl • ${u.favoritesCount} fav</td>
        <td class="py-3 px-3 text-xs font-mono text-[#8A8074]">${new Date(u.created_at).toLocaleDateString()}</td>
        <td class="py-3 px-3 text-right">
          <div class="flex items-center justify-end gap-1.5">
            <button 
              class="px-2.5 py-1 rounded-lg bg-[#201D1A] hover:bg-[#2A2520] border border-[#3A332B] text-[11px] font-semibold text-[#FAF7F2] transition-colors"
              data-user-action="view"
              data-user-id="${u.id}"
            >
              Perfil
            </button>
            <button 
              class="px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors ${
                isSuspended 
                  ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-300' 
                  : 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-300'
              }"
              data-user-action="toggle-status"
              data-user-id="${u.id}"
              data-current-status="${u.status}"
            >
              ${isSuspended ? 'Reactivar' : 'Suspender'}
            </button>
            ${u.role !== 'superadmin' ? `
            <button 
              class="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-[11px] font-semibold text-rose-300 transition-colors"
              data-user-action="delete"
              data-user-id="${u.id}"
              data-user-email="${u.email}"
              title="Eliminar usuario permanentemente"
            >
              Eliminar
            </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Attach table events
  tbody.querySelectorAll('[data-user-action="view"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.userId;
      if (id) openUserDetailModal(id);
    });
  });

  tbody.querySelectorAll('[data-user-action="delete"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = (btn as HTMLElement).dataset.userId;
      const email = (btn as HTMLElement).dataset.userEmail;
      if (id && confirm(`¿Eliminar permanentemente la cuenta de "${email}"? Esta acción no se puede deshacer.`)) {
        const res = await adminService.deleteUser(id);
        if (res.success) {
          showToast(res.message || 'Usuario eliminado permanentemente', 'success');
          loadUsersTab();
          loadOverviewTab();
        } else {
          showToast(res.message || 'Error al eliminar usuario', 'error');
        }
      }
    });
  });

  tbody.querySelectorAll('[data-user-action="toggle-status"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = (btn as HTMLElement).dataset.userId;
      const current = (btn as HTMLElement).dataset.currentStatus as UserStatus;
      if (!id) return;

      const newStatus = current === 'active' ? 'suspended' : 'active';
      let reason: string | undefined = undefined;
      if (newStatus === 'suspended') {
        const inputReason = prompt('Indica el motivo de la suspensión de la cuenta (opcional):');
        if (inputReason === null) return; // User cancelled prompt
        reason = inputReason.trim() || 'Suspensión administrativa';
      }

      const res = await adminService.setUserStatus(id, newStatus, reason);
      if (res.success) {
        showToast(res.message || 'Estado actualizado', 'success');
        loadUsersTab();
      } else {
        showToast(res.message || 'Error al actualizar estado', 'error');
      }
    });
  });
}

// 3. MUSIC & CATALOG TAB
async function loadMusicTab() {
  const data = await adminService.getMusicData();
  const customList = document.getElementById('admin-custom-tracks-list');
  const reportsList = document.getElementById('admin-music-reports-list');

  if (customList) {
    if (data.customTracks.length === 0) {
      customList.innerHTML = `
        <div class="col-span-full py-8 text-center text-xs text-[#8A8074]">
          No hay pistas curadas personalizadas en la base de datos.
        </div>
      `;
    } else {
      customList.innerHTML = data.customTracks.map(ct => `
        <div class="p-3.5 rounded-2xl bg-[#1A1816] border border-[#2D2823] flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <img src="${ct.artwork}" class="w-12 h-12 rounded-xl object-cover shrink-0 bg-[#25201B]" onerror="this.src='/assets/default-cover.svg'" />
            <div class="min-w-0">
              <h5 class="text-xs font-bold text-[#FAF7F2] truncate">${ct.title}</h5>
              <p class="text-[11px] text-[#BDB5AA] truncate">${ct.artist} • ${ct.genre}</p>
              <span class="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono mt-1 ${ct.is_promoted ? 'bg-amber-500/20 text-amber-300' : 'bg-[#25201B] text-[#8A8074]'}">
                ${ct.is_promoted ? 'Promocionada' : 'Normal'}
              </span>
            </div>
          </div>
          <button 
            class="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-colors shrink-0"
            data-delete-custom-track="${ct.id}"
            title="Eliminar de la plataforma"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      `).join('');

      customList.querySelectorAll('[data-delete-custom-track]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = (btn as HTMLElement).dataset.deleteCustomTrack;
          if (id && confirm('¿Eliminar esta pista curada del catálogo?')) {
            const ok = await adminService.deleteCustomTrack(id);
            if (ok) {
              showToast('Pista curada eliminada', 'success');
              loadMusicTab();
            }
          }
        });
      });
    }
  }

  if (reportsList) {
    if (data.reports.length === 0) {
      reportsList.innerHTML = '<p class="text-xs text-[#8A8074] italic">No hay denuncias de canciones pendientes.</p>';
    } else {
      reportsList.innerHTML = data.reports.map(r => `
        <div class="p-3 rounded-xl bg-[#201D1A] border border-[#2D2823] flex items-center justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-[#FAF7F2]">${r.target_title}</span>
              <span class="px-2 py-0.5 rounded text-[9px] font-mono ${r.status === 'resolved' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}">
                ${r.status.toUpperCase()}
              </span>
            </div>
            <p class="text-[11px] text-[#BDB5AA] mt-0.5">Denunciado por: ${r.reporter_name} • Razón: ${r.reason}</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button 
              class="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold"
              data-resolve-report="${r.id}"
            >
              Resolver
            </button>
            <button 
              class="px-2.5 py-1 rounded-lg bg-[#25201B] hover:bg-[#302A24] text-[#8A8074] border border-[#3D352D] text-[11px]"
              data-dismiss-report="${r.id}"
            >
              Descartar
            </button>
          </div>
        </div>
      `).join('');

      reportsList.querySelectorAll('[data-resolve-report]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = (btn as HTMLElement).dataset.resolveReport;
          if (id) {
            await adminService.updateReport(id, 'resolved');
            showToast('Reporte resuelto', 'success');
            loadMusicTab();
          }
        });
      });

      reportsList.querySelectorAll('[data-dismiss-report]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = (btn as HTMLElement).dataset.dismissReport;
          if (id) {
            await adminService.updateReport(id, 'dismissed');
            showToast('Reporte descartado', 'info');
            loadMusicTab();
          }
        });
      });
    }
  }
}

// 4. GLOBAL ADS TAB
async function loadAdsTab() {
  const ads = await adminService.getAllAds();
  const container = document.getElementById('admin-ads-list');
  if (!container) return;

  if (ads.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-12 text-center text-[#8A8074]">
        <p class="text-sm font-semibold text-[#D5CBC0]">No hay anuncios promocionales configurados</p>
        <p class="text-xs text-[#8A8074] mt-1">Crea anuncios con imágenes o vídeos para Inicio o Pre-roll.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = ads.map((ad, idx) => {
    const isPreRoll = ad.placement === 'pre_roll_audio';
    const tagText = isPreRoll ? 'Pre-roll Audio' : 'Banner Inicio';
    const tagClass = isPreRoll ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';

    return `
      <div class="p-4 sm:p-5 rounded-2xl bg-[#1A1816] border border-[#2D2823] space-y-4 shadow-lg flex flex-col justify-between">
        <div>
          <!-- Header Tag Line -->
          <div class="flex items-center justify-between gap-2 pb-2 border-b border-[#26221D]">
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Anuncio 1 • 1
              </span>
              <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${tagClass}">
                ${tagText}
              </span>
            </div>
            <span class="text-xs font-mono font-bold ${ad.active ? 'text-emerald-400' : 'text-[#8A8074]'}">
              ${ad.active ? '● ACTIVO' : '○ INACTIVO'}
            </span>
          </div>

          <!-- Media Preview & Info -->
          <div class="flex items-start gap-4 mt-3">
            <div class="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden shrink-0 bg-[#0E0D0C] border border-[#332D27] flex items-center justify-center">
              ${ad.media_type === 'video' 
                ? `<video src="${ad.media_url}" class="w-full h-full object-cover" controls playsinline muted></video>` 
                : `<img src="${ad.media_url}" class="w-full h-full object-cover" onerror="this.src='/assets/default-cover.svg'" />`
              }
            </div>

            <div class="min-w-0 flex-1 space-y-1">
              <h4 class="text-sm font-bold text-[#FAF7F2] truncate">${ad.title}</h4>
              <p class="text-xs text-[#BDB5AA] line-clamp-2">${ad.description || 'Sin descripción'}</p>
              
              <div class="flex flex-wrap items-center gap-2 pt-1 text-[10px] font-mono text-[#8A8074]">
                <span>${ad.duration}s total</span>
                ${ad.can_skip ? `<span>Saltar tras ${ad.skip_after}s</span>` : '<span>No saltable</span>'}
                <span>Orden #${ad.order}</span>
              </div>
            </div>
          </div>

          <!-- Real Metrics Card -->
          <div class="grid grid-cols-2 gap-2 mt-4 p-2.5 rounded-xl bg-[#201D1A] border border-[#2D2823]">
            <div class="text-center">
              <p class="text-[9px] font-mono uppercase text-[#8A8074]">Vistas Reales</p>
              <p class="text-base font-extrabold text-[#FAF7F2] font-mono">${ad.views || 0}</p>
            </div>
            <div class="text-center">
              <p class="text-[9px] font-mono uppercase text-[#8A8074]">Clics Reales</p>
              <p class="text-base font-extrabold text-amber-400 font-mono">${ad.clicks || 0}</p>
            </div>
          </div>
        </div>

        <!-- Action Controls -->
        <div class="pt-3 border-t border-[#26221D] flex items-center justify-between">
          <button 
            class="px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
              ad.active 
                ? 'bg-[#25201B] hover:bg-[#302A24] text-[#BDB5AA] border-[#3D352D]' 
                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30 font-bold'
            }"
            data-toggle-ad="${ad.id}"
            data-current-active="${ad.active}"
          >
            ${ad.active ? 'Pausar Anuncio' : 'Activar Anuncio'}
          </button>

          <button 
            class="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-colors"
            data-delete-ad="${ad.id}"
          >
            Eliminar
          </button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-toggle-ad]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = (btn as HTMLElement).dataset.toggleAd;
      const current = (btn as HTMLElement).dataset.currentActive === 'true';
      if (id) {
        const ok = await adminService.updateAd(id, { active: !current });
        if (ok) {
          showToast(!current ? 'Anuncio activado' : 'Anuncio pausado', 'success');
          loadAdsTab();
        }
      }
    });
  });

  container.querySelectorAll('[data-delete-ad]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = (btn as HTMLElement).dataset.deleteAd;
      if (id && confirm('¿Estás seguro de que deseas eliminar permanentemente este anuncio?')) {
        const ok = await adminService.deleteAd(id);
        if (ok) {
          showToast('Anuncio eliminado', 'success');
          loadAdsTab();
        }
      }
    });
  });
}

// 5. SECURITY TAB
async function loadSecurityTab() {
  const { logs, failedCount } = await adminService.getSecurityLogs(100);
  const totalEl = document.getElementById('admin-security-total');
  const failedEl = document.getElementById('admin-security-failed');
  const blockedEl = document.getElementById('admin-security-blocked');
  const tbody = document.getElementById('admin-security-tbody');

  if (totalEl) totalEl.textContent = String(logs.length);
  if (failedEl) failedEl.textContent = String(failedCount);
  if (blockedEl) blockedEl.textContent = String(logs.filter(l => l.event === 'blocked_attempt').length);

  if (!tbody) return;

  if (logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="py-6 text-center text-xs text-[#8A8074]">Sin registros de seguridad aún.</td></tr>';
    return;
  }

  tbody.innerHTML = logs.map(l => {
    const isDanger = l.event === 'login_failed' || l.event === 'blocked_attempt' || l.event === 'suspicious';
    const eventBadge = isDanger ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';

    return `
      <tr class="border-b border-[#2D2823] hover:bg-[#201D1A]/50 transition-colors">
        <td class="py-2.5 px-3 text-xs">
          <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${eventBadge}">
            ${l.event}
          </span>
        </td>
        <td class="py-2.5 px-3 text-xs font-mono text-[#FAF7F2] truncate">${l.email}</td>
        <td class="py-2.5 px-3 text-xs font-mono text-amber-400">${l.ip}</td>
        <td class="py-2.5 px-3 text-[11px] text-[#BDB5AA] max-w-xs truncate" title="${l.user_agent}">${l.user_agent}</td>
        <td class="py-2.5 px-3 text-xs text-[#D5CBC0]">${l.details || 'Normal'}</td>
        <td class="py-2.5 px-3 text-xs font-mono text-[#8A8074]">${new Date(l.timestamp).toLocaleString()}</td>
      </tr>
    `;
  }).join('');
}

// 6. NOTIFICATIONS TAB
async function loadNotificationsTab() {
  const notifs = await adminService.getNotifications();
  const container = document.getElementById('admin-notifications-list');
  if (!container) return;

  if (notifs.length === 0) {
    container.innerHTML = '<p class="text-xs text-[#8A8074] italic">Sin avisos activos en la plataforma.</p>';
    return;
  }

  container.innerHTML = notifs.map(n => `
    <div class="p-4 rounded-2xl bg-[#1A1816] border border-[#2D2823] flex items-center justify-between gap-4">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <h4 class="text-sm font-bold text-[#FAF7F2]">${n.title}</h4>
          <span class="px-2 py-0.5 rounded text-[9px] font-mono uppercase ${n.type === 'warning' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'}">
            ${n.type}
          </span>
          <span class="text-[10px] font-mono ${n.active ? 'text-emerald-400 font-bold' : 'text-[#8A8074]'}">
            ${n.active ? 'Activo' : 'Oculto'}
          </span>
        </div>
        <p class="text-xs text-[#BDB5AA] mt-1">${n.message}</p>
        <span class="text-[10px] font-mono text-[#8A8074] mt-1 inline-block">Publicado: ${new Date(n.created_at).toLocaleString()}</span>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <button 
          class="px-2.5 py-1 rounded-xl bg-[#201D1A] border border-[#332D27] text-xs font-semibold text-[#FAF7F2]"
          data-toggle-notif="${n.id}"
        >
          ${n.active ? 'Desactivar' : 'Activar'}
        </button>
        <button 
          class="px-2.5 py-1 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold"
          data-delete-notif="${n.id}"
        >
          Eliminar
        </button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('[data-toggle-notif]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = (btn as HTMLElement).dataset.toggleNotif;
      if (id) {
        await adminService.toggleNotification(id);
        loadNotificationsTab();
      }
    });
  });

  container.querySelectorAll('[data-delete-notif]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = (btn as HTMLElement).dataset.deleteNotif;
      if (id && confirm('¿Eliminar este aviso de forma permanente?')) {
        await adminService.deleteNotification(id);
        loadNotificationsTab();
      }
    });
  });
}

// 7. REPORTS TAB
async function loadReportsTab() {
  const reports = await adminService.getReports();
  const container = document.getElementById('admin-reports-list');
  if (!container) return;

  if (reports.length === 0) {
    container.innerHTML = '<p class="text-xs text-[#8A8074] italic">No hay denuncias pendientes de revisión.</p>';
    return;
  }

  container.innerHTML = reports.map(r => `
    <div class="p-4 rounded-2xl bg-[#1A1816] border border-[#2D2823] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500/20 text-amber-300">
            ${r.reported_type.toUpperCase()}
          </span>
          <h4 class="text-sm font-bold text-[#FAF7F2]">${r.target_title}</h4>
          <span class="px-2 py-0.5 rounded text-[10px] font-mono ${r.status === 'pending' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}">
            ${r.status}
          </span>
        </div>
        <p class="text-xs text-[#D5CBC0] mt-1"><span class="text-[#8A8074]">Motivo:</span> ${r.reason}</p>
        <p class="text-[10px] font-mono text-[#8A8074] mt-0.5">Enviado por: ${r.reporter_name} (${new Date(r.created_at).toLocaleString()})</p>
      </div>

      <div class="flex items-center gap-2 self-start sm:self-auto shrink-0">
        ${r.status === 'pending' ? `
          <button 
            class="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold"
            data-report-action="resolve"
            data-report-id="${r.id}"
          >
            Resolver
          </button>
          <button 
            class="px-3 py-1.5 rounded-xl bg-[#25201B] hover:bg-[#302A24] border border-[#3D352D] text-[#8A8074] text-xs"
            data-report-action="dismiss"
            data-report-id="${r.id}"
          >
            Descartar
          </button>
        ` : `
          <span class="text-xs font-mono text-[#8A8074]">Atendido</span>
        `}
      </div>
    </div>
  `).join('');

  container.querySelectorAll('[data-report-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = (btn as HTMLElement).dataset.reportAction as 'resolve' | 'dismiss';
      const id = (btn as HTMLElement).dataset.reportId;
      if (id) {
        await adminService.updateReport(id, action === 'resolve' ? 'resolved' : 'dismissed');
        showToast(action === 'resolve' ? 'Denuncia resuelta' : 'Denuncia descartada', 'info');
        loadReportsTab();
      }
    });
  });
}

// 8. SETTINGS TAB
async function loadSettingsTab() {
  const settings = await adminService.getSettings();
  if (!settings) return;

  const nameInput = document.getElementById('settings-platform-name') as HTMLInputElement;
  const logoInput = document.getElementById('settings-logo-url') as HTMLInputElement;
  const welcomeInput = document.getElementById('settings-welcome-text') as HTMLInputElement;
  const infoInput = document.getElementById('settings-info-text') as HTMLTextAreaElement;
  const legalInput = document.getElementById('settings-legal-text') as HTMLInputElement;
  const maintInput = document.getElementById('settings-maintenance-mode') as HTMLInputElement;

  if (nameInput) nameInput.value = settings.platform_name || '';
  if (logoInput) logoInput.value = settings.logo_url || '';
  if (welcomeInput) welcomeInput.value = settings.welcome_text || '';
  if (infoInput) infoInput.value = settings.info_text || '';
  if (legalInput) legalInput.value = settings.legal_text || '';
  if (maintInput) maintInput.checked = Boolean(settings.maintenance_mode);

  const form = document.getElementById('form-admin-settings') as HTMLFormElement;
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const ok = await adminService.updateSettings({
        platform_name: nameInput?.value,
        logo_url: logoInput?.value,
        welcome_text: welcomeInput?.value,
        info_text: infoInput?.value,
        legal_text: legalInput?.value,
        maintenance_mode: maintInput?.checked,
      });

      if (ok) {
        showToast('Configuración de la plataforma guardada correctamente', 'success');
        syncPlatformSettings();
      } else {
        showToast('Error al guardar configuración', 'error');
      }
    };
  }
}

// 9. SYSTEM & BACKUP TAB
async function loadSystemTab() {
  const sys = await adminService.getSystemStatus();
  if (!sys) return;

  const nodeEl = document.getElementById('sys-node-version');
  const uptimeEl = document.getElementById('sys-uptime');
  const rssEl = document.getElementById('sys-memory-rss');
  const heapEl = document.getElementById('sys-memory-heap');
  const errorsContainer = document.getElementById('sys-errors-list');

  if (nodeEl) nodeEl.textContent = sys.node_version;
  if (uptimeEl) {
    const mins = Math.floor(sys.uptime_seconds / 60);
    const hours = Math.floor(mins / 60);
    uptimeEl.textContent = `${hours}h ${mins % 60}m`;
  }
  if (rssEl) rssEl.textContent = `${sys.memory_rss_mb} MB`;
  if (heapEl) heapEl.textContent = `${sys.memory_heap_mb} MB`;

  if (errorsContainer) {
    if (!sys.errors || sys.errors.length === 0) {
      errorsContainer.innerHTML = '<p class="text-xs text-emerald-400 font-mono">0 errores críticos registrados en el sistema.</p>';
    } else {
      errorsContainer.innerHTML = sys.errors.map(err => `
        <div class="p-2.5 rounded-xl bg-[#201D1A] border border-rose-500/30 text-xs space-y-1">
          <div class="flex items-center justify-between text-[10px] font-mono">
            <span class="text-rose-400 font-bold">${err.source}</span>
            <span class="text-[#8A8074]">${new Date(err.timestamp).toLocaleTimeString()}</span>
          </div>
          <p class="text-[#FAF7F2] font-mono text-[11px]">${err.message}</p>
        </div>
      `).join('');
    }
  }

  // Backup Export Download
  const btnExport = document.getElementById('btn-admin-export-backup');
  if (btnExport) {
    btnExport.onclick = async () => {
      try {
        await adminService.downloadBackup();
        showToast('Copia de seguridad descargada con éxito', 'success');
      } catch (e) {
        showToast('Error al descargar copia de seguridad', 'error');
      }
    };
  }

  // Backup Restore File
  const inputRestore = document.getElementById('input-admin-restore-file') as HTMLInputElement;
  if (inputRestore) {
    inputRestore.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      if (!confirm(`¿Restaurar la base de datos completa desde "${file.name}"? Esta acción reemplazará los datos actuales.`)) {
        inputRestore.value = '';
        return;
      }

      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const res = await adminService.restoreBackup(json);
        if (res.success) {
          showToast('Base de datos restaurada correctamente. Recargando...', 'success');
          setTimeout(() => window.location.reload(), 1500);
        } else {
          showToast(res.message || 'Error al restaurar respaldo', 'error');
        }
      } catch (err: any) {
        showToast('Archivo JSON no válido o dañado', 'error');
      } finally {
        inputRestore.value = '';
      }
    };
  }
}

// User detail modal logic
async function openUserDetailModal(userId: string) {
  const data = await adminService.getUserDetail(userId);
  if (!data || !data.user) {
    showToast('Usuario no encontrado', 'error');
    return;
  }

  const u = data.user;
  const modal = document.getElementById('modal-admin-user-detail');
  const avatarEl = document.getElementById('user-detail-avatar');
  const nameEl = document.getElementById('user-detail-name');
  const emailEl = document.getElementById('user-detail-email');
  const statusEl = document.getElementById('user-detail-status-text');
  const roleEl = document.getElementById('user-detail-role-text');
  const plCountEl = document.getElementById('user-detail-playlists-count');
  const suspBox = document.getElementById('user-detail-suspension-box');
  const suspReasonEl = document.getElementById('user-detail-suspension-reason');
  const historyList = document.getElementById('user-detail-history-list');
  const toggleBtn = document.getElementById('btn-user-detail-toggle-status') as HTMLButtonElement;
  const reasonInput = document.getElementById('user-detail-suspend-reason-input') as HTMLInputElement;
  const roleSelect = document.getElementById('user-detail-role-select') as HTMLSelectElement;
  const saveRoleBtn = document.getElementById('btn-user-detail-save-role');

  if (avatarEl) avatarEl.textContent = getInitials(u.name);
  if (nameEl) nameEl.textContent = u.name;
  if (emailEl) emailEl.textContent = u.email;
  if (statusEl) {
    statusEl.textContent = u.status === 'suspended' ? 'Suspendido' : 'Activo';
    statusEl.className = u.status === 'suspended' ? 'text-xs font-bold text-rose-400 mt-0.5' : 'text-xs font-bold text-emerald-400 mt-0.5';
  }
  if (roleEl) roleEl.textContent = u.role.toUpperCase();
  if (plCountEl) plCountEl.textContent = String(data.playlists?.length || 0);

  if (suspBox && suspReasonEl) {
    if (u.status === 'suspended' && u.suspension_reason) {
      suspReasonEl.textContent = u.suspension_reason;
      suspBox.classList.remove('hidden');
    } else {
      suspBox.classList.add('hidden');
    }
  }

  if (historyList) {
    if (!data.history || data.history.length === 0) {
      historyList.innerHTML = '<p class="text-xs text-[#8A8074] italic">Sin reproducciones registradas.</p>';
    } else {
      historyList.innerHTML = data.history.slice(0, 10).map((h: any) => `
        <div class="flex items-center justify-between p-2 rounded-lg bg-[#201D1A] text-xs">
          <span class="text-[#FAF7F2] truncate">${h.track?.title || 'Canción'}</span>
          <span class="text-[#8A8074] font-mono text-[10px] shrink-0 ml-2">${new Date(h.played_at).toLocaleDateString()}</span>
        </div>
      `).join('');
    }
  }

  if (toggleBtn) {
    const isSuspended = u.status === 'suspended';
    toggleBtn.textContent = isSuspended ? 'Reactivar Cuenta' : 'Suspender Cuenta';
    toggleBtn.className = isSuspended 
      ? 'px-3.5 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 font-bold text-xs transition-colors shrink-0'
      : 'px-3.5 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 font-bold text-xs transition-colors shrink-0';

    toggleBtn.onclick = async () => {
      const newStatus = isSuspended ? 'active' : 'suspended';
      const reason = reasonInput ? reasonInput.value.trim() : '';
      const res = await adminService.setUserStatus(u.id, newStatus, reason);
      if (res.success) {
        showToast(res.message || 'Estado modificado', 'success');
        openUserDetailModal(u.id);
        loadUsersTab();
      } else {
        showToast(res.message || 'Error al cambiar estado', 'error');
      }
    };
  }

  if (roleSelect) roleSelect.value = u.role;
  if (saveRoleBtn) {
    saveRoleBtn.onclick = async () => {
      const targetRole = roleSelect?.value as UserRole;
      if (targetRole) {
        const res = await adminService.setRole(u.id, targetRole);
        if (res.success) {
          showToast(res.message || 'Rol modificado', 'success');
          openUserDetailModal(u.id);
          loadUsersTab();
        } else {
          showToast(res.message || 'Error al cambiar rol', 'error');
        }
      }
    };
  }

  if (modal) modal.classList.remove('hidden');
}

// Setup Admin Modals
function setupAdminModalsAndForms() {
  // User detail close
  const userModal = document.getElementById('modal-admin-user-detail');
  const userModalClose = document.getElementById('modal-user-detail-close');
  if (userModalClose && userModal) userModalClose.onclick = () => userModal.classList.add('hidden');

  // Create Ad Modal
  const adModal = document.getElementById('modal-admin-create-ad');
  const btnOpenAd = document.getElementById('btn-open-create-ad');
  const btnCloseAd = document.getElementById('modal-ad-close');
  const formAd = document.getElementById('form-admin-create-ad') as HTMLFormElement;
  const fileAd = document.getElementById('ad-input-file') as HTMLInputElement;
  const mediaUrlAd = document.getElementById('ad-input-media-url') as HTMLInputElement;
  const previewBox = document.getElementById('ad-media-preview-box');
  const previewImg = document.getElementById('ad-preview-img') as HTMLImageElement;
  const previewVid = document.getElementById('ad-preview-video') as HTMLVideoElement;

  if (btnOpenAd && adModal) {
    btnOpenAd.onclick = () => {
      uploadedAdMediaBase64 = '';
      if (previewBox) previewBox.classList.add('hidden');
      if (formAd) formAd.reset();
      adModal.classList.remove('hidden');
    };
  }
  if (btnCloseAd && adModal) btnCloseAd.onclick = () => adModal.classList.add('hidden');

  // Handle file selection from gallery or files
  if (fileAd) {
    fileAd.onchange = () => {
      const file = fileAd.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          uploadedAdMediaBase64 = e.target?.result as string;
          if (previewBox) previewBox.classList.remove('hidden');
          if (file.type.startsWith('video') && previewVid && previewImg) {
            previewImg.classList.add('hidden');
            previewVid.classList.remove('hidden');
            previewVid.src = uploadedAdMediaBase64;
          } else if (previewImg && previewVid) {
            previewVid.classList.add('hidden');
            previewImg.classList.remove('hidden');
            previewImg.src = uploadedAdMediaBase64;
          }
        };
        reader.readAsDataURL(file);
      }
    };
  }

  if (mediaUrlAd) {
    mediaUrlAd.oninput = () => {
      const url = mediaUrlAd.value.trim();
      if (url) {
        uploadedAdMediaBase64 = url;
        if (previewBox) previewBox.classList.remove('hidden');
        if (url.match(/\.(mp4|webm)$/i) && previewVid && previewImg) {
          previewImg.classList.add('hidden');
          previewVid.classList.remove('hidden');
          previewVid.src = url;
        } else if (previewImg && previewVid) {
          previewVid.classList.add('hidden');
          previewImg.classList.remove('hidden');
          previewImg.src = url;
        }
      }
    };
  }

  if (formAd) {
    formAd.onsubmit = async (e) => {
      e.preventDefault();
      const title = (document.getElementById('ad-input-title') as HTMLInputElement).value;
      const desc = (document.getElementById('ad-input-desc') as HTMLTextAreaElement).value;
      const placement = (document.getElementById('ad-input-placement') as HTMLSelectElement).value as any;
      const mediaType = (document.getElementById('ad-input-media-type') as HTMLSelectElement).value as any;
      const duration = parseInt((document.getElementById('ad-input-duration') as HTMLInputElement).value) || 8;
      const skipAfter = parseInt((document.getElementById('ad-input-skip-after') as HTMLInputElement).value) || 3;
      const order = parseInt((document.getElementById('ad-input-order') as HTMLInputElement).value) || 1;
      const targetUrl = (document.getElementById('ad-input-target-url') as HTMLInputElement).value;
      const startDate = (document.getElementById('ad-input-start-date') as HTMLInputElement).value;
      const endDate = (document.getElementById('ad-input-end-date') as HTMLInputElement).value;
      const canSkip = (document.getElementById('ad-input-can-skip') as HTMLInputElement).checked;
      const active = (document.getElementById('ad-input-active') as HTMLInputElement).checked;

      const mediaUrl = uploadedAdMediaBase64 || mediaUrlAd?.value.trim();
      if (!mediaUrl) {
        showToast('Selecciona un archivo multimedia o escribe una URL válida', 'error');
        return;
      }

      const res = await adminService.createAd({
        title,
        description: desc,
        media_url: mediaUrl,
        media_type: mediaType,
        placement,
        duration,
        can_skip: canSkip,
        skip_after: skipAfter,
        order,
        target_url: targetUrl,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        active,
      });

      if (res.success) {
        showToast('Anuncio global creado exitosamente', 'success');
        if (adModal) adModal.classList.add('hidden');
        formAd.reset();
        uploadedAdMediaBase64 = '';
        loadAdsTab();
      } else {
        showToast(res.message || 'Error al guardar anuncio', 'error');
      }
    };
  }

  // Create Song Modal
  const songModal = document.getElementById('modal-admin-create-song');
  const btnOpenSong = document.getElementById('btn-open-create-song');
  const btnCloseSong = document.getElementById('modal-create-song-close');
  const formSong = document.getElementById('form-admin-create-song') as HTMLFormElement;

  if (btnOpenSong && songModal) btnOpenSong.onclick = () => songModal.classList.remove('hidden');
  if (btnCloseSong && songModal) btnCloseSong.onclick = () => songModal.classList.add('hidden');

  if (formSong) {
    formSong.onsubmit = async (e) => {
      e.preventDefault();
      const title = (document.getElementById('song-input-title') as HTMLInputElement).value;
      const artist = (document.getElementById('song-input-artist') as HTMLInputElement).value;
      const album = (document.getElementById('song-input-album') as HTMLInputElement).value;
      const genre = (document.getElementById('song-input-genre') as HTMLInputElement).value;
      const streamUrl = (document.getElementById('song-input-stream') as HTMLInputElement).value;
      const cover = (document.getElementById('song-input-cover') as HTMLInputElement).value;
      const duration = parseInt((document.getElementById('song-input-duration') as HTMLInputElement).value) || 180;
      const promoted = (document.getElementById('song-input-promoted') as HTMLInputElement).checked;

      const res = await adminService.createCustomTrack({
        title,
        artist,
        album,
        genre,
        stream_url: streamUrl,
        artwork: cover || '/assets/default-cover.svg',
        duration,
        is_promoted: promoted,
      });

      if (res.success) {
        showToast('Canción curada añadida al catálogo', 'success');
        if (songModal) songModal.classList.add('hidden');
        formSong.reset();
        loadMusicTab();
      } else {
        showToast(res.message || 'Error al añadir canción', 'error');
      }
    };
  }

  // Create Broadcast Notification Modal
  const notifModal = document.getElementById('modal-admin-create-notif');
  const btnOpenNotif = document.getElementById('btn-open-create-notif');
  const btnCloseNotif = document.getElementById('modal-create-notif-close');
  const formNotif = document.getElementById('form-admin-create-notif') as HTMLFormElement;

  if (btnOpenNotif && notifModal) btnOpenNotif.onclick = () => notifModal.classList.remove('hidden');
  if (btnCloseNotif && notifModal) btnCloseNotif.onclick = () => notifModal.classList.add('hidden');

  if (formNotif) {
    formNotif.onsubmit = async (e) => {
      e.preventDefault();
      const title = (document.getElementById('notif-input-title') as HTMLInputElement).value;
      const message = (document.getElementById('notif-input-msg') as HTMLTextAreaElement).value;
      const type = (document.getElementById('notif-input-type') as HTMLSelectElement).value;
      const expires = (document.getElementById('notif-input-expires') as HTMLInputElement).value;

      const ok = await adminService.createNotification({
        title,
        message,
        type,
        expires_at: expires || undefined,
      });

      if (ok) {
        showToast('Aviso general publicado para todos los usuarios', 'success');
        if (notifModal) notifModal.classList.add('hidden');
        formNotif.reset();
        loadNotificationsTab();
      } else {
        showToast('Error al publicar aviso', 'error');
      }
    };
  }

  // User search/filter change listeners
  const searchInput = document.getElementById('admin-users-search');
  const roleSelect = document.getElementById('admin-users-role-filter');
  const statusSelect = document.getElementById('admin-users-status-filter');

  if (searchInput) searchInput.addEventListener('input', () => loadUsersTab());
  if (roleSelect) roleSelect.addEventListener('change', () => loadUsersTab());
  if (statusSelect) statusSelect.addEventListener('change', () => loadUsersTab());
}

// ==========================================
// PLAYER UI SYNC
// ==========================================

function renderPlayerState(pState: PlayerState) {
  const track = pState.currentTrack;
  const playBtnIcon = document.getElementById('player-play-icon');
  const vinylDisc = document.getElementById('player-vinyl-disc');
  const coverImg = document.getElementById('player-cover-img') as HTMLImageElement;
  const titleEl = document.getElementById('player-title');
  const artistEl = document.getElementById('player-artist');
  const currTimeEl = document.getElementById('player-current-time');
  const totalTimeEl = document.getElementById('player-total-time');
  const progressBar = document.getElementById('player-progress') as HTMLInputElement;
  const shuffleBtn = document.getElementById('player-shuffle');
  const repeatBtn = document.getElementById('player-repeat');
  const playerHeart = document.getElementById('player-heart');
  const errorBanner = document.getElementById('player-error-banner');
  const errorBannerText = document.getElementById('player-error-text');

  if (track) {
    if (titleEl) titleEl.textContent = track.title;
    if (artistEl) artistEl.textContent = track.artist;
    if (coverImg) coverImg.src = track.artwork;
    if (playerHeart) {
      updateHeartIcon(playerHeart, library.isFavorite(track.id));
    }
  }

  if (playBtnIcon) {
    if (pState.isPlaying) {
      playBtnIcon.innerHTML = `
        <svg width="18" height="18" class="w-4 h-4 sm:w-5 sm:h-5 fill-current" viewBox="0 0 24 24">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
        </svg>
      `;
    } else {
      playBtnIcon.innerHTML = `
        <svg width="18" height="18" class="w-4 h-4 sm:w-5 sm:h-5 ml-0.5 fill-current" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      `;
    }
  }

  if (vinylDisc) {
    if (pState.isPlaying) {
      vinylDisc.classList.remove('spin-paused');
    } else {
      vinylDisc.classList.add('spin-paused');
    }
  }

  if (currTimeEl) currTimeEl.textContent = PlayerService.formatTime(pState.currentTime);
  if (totalTimeEl) totalTimeEl.textContent = PlayerService.formatTime(pState.duration);

  if (progressBar) {
    if (pState.duration > 0) {
      const pct = (pState.currentTime / pState.duration) * 100;
      progressBar.value = String(pct);
      progressBar.style.background = `linear-gradient(to right, #F59E0B ${pct}%, #2E2924 ${pct}%)`;
    } else {
      progressBar.value = '0';
      progressBar.style.background = '#2E2924';
    }
  }

  const mobileProgress = document.getElementById('player-mobile-progress-fill');
  if (mobileProgress) {
    if (pState.duration > 0) {
      const pct = (pState.currentTime / pState.duration) * 100;
      mobileProgress.style.width = `${pct}%`;
    } else {
      mobileProgress.style.width = '0%';
    }
  }

  if (shuffleBtn) {
    if (pState.isShuffle) {
      shuffleBtn.classList.add('text-amber-400');
      shuffleBtn.classList.remove('text-[#8A8074]');
    } else {
      shuffleBtn.classList.remove('text-amber-400');
      shuffleBtn.classList.add('text-[#8A8074]');
    }
  }

  if (repeatBtn) {
    if (pState.repeatMode !== 'off') {
      repeatBtn.classList.add('text-amber-400');
      repeatBtn.classList.remove('text-[#8A8074]');
      repeatBtn.title = `Repetir: ${pState.repeatMode === 'one' ? 'Una pista' : 'Todas'}`;
    } else {
      repeatBtn.classList.remove('text-amber-400');
      repeatBtn.classList.add('text-[#8A8074]');
      repeatBtn.title = 'Repetir desactivado';
    }
  }

  if (errorBanner && errorBannerText) {
    if (pState.hasError && pState.errorMessage) {
      errorBannerText.textContent = pState.errorMessage;
      errorBanner.classList.remove('hidden');
    } else {
      errorBanner.classList.add('hidden');
    }
  }
}

function updateHeartIcon(btn: HTMLElement, isFav: boolean) {
  const svg = btn.querySelector('svg');
  if (svg) {
    if (isFav) {
      btn.classList.add('text-rose-500');
      btn.classList.remove('text-slate-400');
      svg.classList.add('fill-current');
      svg.classList.remove('fill-none');
    } else {
      btn.classList.remove('text-rose-500');
      btn.classList.add('text-slate-400');
      svg.classList.remove('fill-current');
      svg.classList.add('fill-none');
    }
  }
}

function createTrackSkeletons(count = 8): string {
  return Array.from({ length: count }).map(() => `
    <div class="bg-[#181614] border border-[#2D2823] rounded-xl p-3 flex flex-col justify-between animate-pulse">
      <div class="aspect-square w-full rounded-lg bg-[#24201C] mb-3"></div>
      <div class="h-4 bg-[#28231E] rounded w-3/4 mb-2"></div>
      <div class="h-3 bg-[#24201C] rounded w-1/2 mb-3"></div>
      <div class="pt-2 border-t border-[#26221D] flex items-center justify-between">
        <div class="h-3 bg-[#24201C] rounded w-10"></div>
        <div class="h-3 bg-[#24201C] rounded w-6"></div>
      </div>
    </div>
  `).join('');
}

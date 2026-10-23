import{t as e}from"./auth-CtTRDopN.js";var t=class e{constructor(){}static getInstance(){return e.instance||=new e,e.instance}async getTrendingTracks(e,t=24){try{let n=`/api/audius/trending?limit=${t}`;e&&e!==`Todos`&&e!==`All`&&(n+=`&genre=${encodeURIComponent(e)}`);let r=await fetch(n);if(!r.ok)throw Error(`Error en servidor: ${r.status}`);return((await r.json()).tracks||[]).map(e=>this.normalizeTrack(e))}catch(n){return console.error(`Error fetching trending tracks:`,n),this.fetchDirectAudiusTrending(e,t)}}async fetchDirectAudiusTrending(e,t=20){try{let n=`https://api.audius.co/v1/tracks/trending?app_name=VynoxPlay&client_id=2cc593fc814461263d282a84286fd4f72c79562e&limit=${t}`;e&&e!==`Todos`&&e!==`All`&&(n+=`&genre=${encodeURIComponent(e)}`);let r=await fetch(n);return r.ok?((await r.json()).data||[]).map(e=>this.normalizeTrack(e)):[]}catch(e){return console.warn(`Direct Audius fallback also encountered error:`,e),[]}}async search(e){if(!e||!e.trim())return[];try{let t=await fetch(`/api/audius/search?query=${encodeURIComponent(e.trim())}`);if(!t.ok)throw Error(`Search failed`);return((await t.json()).tracks||[]).map(e=>this.normalizeTrack(e))}catch(t){console.error(`Search error:`,t);try{let t=`https://api.audius.co/v1/tracks/search?query=${encodeURIComponent(e.trim())}&app_name=VynoxPlay&client_id=2cc593fc814461263d282a84286fd4f72c79562e`;return((await(await fetch(t)).json()).data||[]).map(e=>this.normalizeTrack(e))}catch{return[]}}}async getGenres(){try{let e=await fetch(`/api/audius/genres`);if(e.ok)return(await e.json()).genres||[]}catch{}return[`Electronic`,`Hip-Hop/Rap`,`Pop`,`R&B/Soul`,`Rock`,`Latin`,`House`,`Techno`,`Trap`,`Indie`,`Lo-Fi`,`Ambient`,`Dubstep`,`Jazz`]}getStreamUrl(e){return`https://api.audius.co/v1/tracks/${e}/stream?app_name=VynoxPlay&client_id=2cc593fc814461263d282a84286fd4f72c79562e`}normalizeTrack(e){let t=String(e.id||e.track_id),n=`/assets/default-cover.svg`;return typeof e.artwork==`string`&&e.artwork?n=e.artwork:e.artwork&&(n=e.artwork[`480x480`]||e.artwork[`1000x1000`]||e.artwork[`150x150`]||n),{id:t,title:e.title||`Pista de Música`,artist:e.artist||e.user?.name||e.user?.handle||`Artista Audius`,artist_handle:e.artist_handle||e.user?.handle,artwork:n,duration:typeof e.duration==`number`?e.duration:0,genre:e.genre||`Electronic`,stream_url:e.stream_url||this.getStreamUrl(t)}}}.getInstance(),n=`vynox_local_favorites_v1`,r=class t{constructor(){this.favoriteIds=new Set,this.localFavoriteTracks=[],this.loadFromLocalStorage()}static getInstance(){return t.instance||=new t,t.instance}loadFromLocalStorage(){try{let e=localStorage.getItem(n);if(e){let t=JSON.parse(e);Array.isArray(t)&&(this.localFavoriteTracks=t,this.favoriteIds=new Set(t.map(e=>String(e.id))))}}catch{}}saveToLocalStorage(e){try{this.localFavoriteTracks=e,this.favoriteIds=new Set(e.map(e=>String(e.id))),localStorage.setItem(n,JSON.stringify(e))}catch{}}async getFavorites(){try{let t=await fetch(`/api/favorites`,{headers:{Accept:`application/json`,...e.getAuthHeaders()},credentials:`include`});if(t.ok){let e=((await t.json()).favorites||[]).map(e=>e.track);return this.saveToLocalStorage(e),e}}catch(e){console.warn(`Failed to load favorites from server, using local favorites:`,e)}return this.localFavoriteTracks}isFavorite(e){return this.favoriteIds.has(String(e))}async toggleFavorite(t){let n=String(t.id),r=!this.isFavorite(n),i=[...this.localFavoriteTracks];r?i.some(e=>String(e.id)===n)||i.unshift(t):i=i.filter(e=>String(e.id)!==n),this.saveToLocalStorage(i);try{let a=await fetch(`/api/favorites`,{method:`POST`,headers:{"Content-Type":`application/json`,Accept:`application/json`,...e.getAuthHeaders()},body:JSON.stringify({track:t}),credentials:`include`});if(a.ok){let e=await a.json();if(typeof e.isFavorite==`boolean`&&e.isFavorite!==r)return e.isFavorite?i.some(e=>String(e.id)===n)||i.unshift(t):i=i.filter(e=>String(e.id)!==n),this.saveToLocalStorage(i),e.isFavorite}}catch(e){console.warn(`Network issue syncing favorite with backend; persisted locally:`,e)}return r}async getPlaylists(){try{let t=await fetch(`/api/playlists`,{headers:{Accept:`application/json`,...e.getAuthHeaders()},credentials:`include`});return t.ok&&(await t.json()).playlists||[]}catch(e){return console.warn(`Failed to load playlists:`,e),[]}}async createPlaylist(t,n=``){try{let r=await fetch(`/api/playlists`,{method:`POST`,headers:{"Content-Type":`application/json`,Accept:`application/json`,...e.getAuthHeaders()},body:JSON.stringify({name:t,description:n}),credentials:`include`});return r.ok&&(await r.json()).playlist||null}catch(e){return console.warn(`Error creating playlist:`,e),null}}async deletePlaylist(t){try{return(await fetch(`/api/playlists/${t}`,{method:`DELETE`,headers:{Accept:`application/json`,...e.getAuthHeaders()},credentials:`include`})).ok}catch(e){return console.warn(`Error deleting playlist:`,e),!1}}async addTrackToPlaylist(t,n){try{return(await fetch(`/api/playlists/${t}/tracks`,{method:`POST`,headers:{"Content-Type":`application/json`,Accept:`application/json`,...e.getAuthHeaders()},body:JSON.stringify({track:n}),credentials:`include`})).ok}catch(e){return console.warn(`Error adding track to playlist:`,e),!1}}async removeTrackFromPlaylist(t,n){try{return(await fetch(`/api/playlists/${t}/tracks/${n}`,{method:`DELETE`,headers:{Accept:`application/json`,...e.getAuthHeaders()},credentials:`include`})).ok}catch(e){return console.warn(`Error removing track from playlist:`,e),!1}}async recordPlay(t){try{await fetch(`/api/history`,{method:`POST`,headers:{"Content-Type":`application/json`,Accept:`application/json`,...e.getAuthHeaders()},body:JSON.stringify({track:t}),credentials:`include`})}catch{}}async getHistory(){try{let t=await fetch(`/api/history`,{headers:{Accept:`application/json`,...e.getAuthHeaders()},credentials:`include`});return t.ok?((await t.json()).history||[]).map(e=>e.track):[]}catch(e){return console.warn(`Error getting history:`,e),[]}}}.getInstance(),i=class e{constructor(){this.state={currentTrack:null,isPlaying:!1,currentTime:0,duration:0,volume:.8,isMuted:!1,isShuffle:!1,repeatMode:`off`,queue:[],queueIndex:-1,isLoading:!1,hasError:!1},this.listeners=[],this.playTimer=null,this.recordedCurrentPlay=!1,this.audio=new Audio,this.audio.volume=this.state.volume,this.setupAudioListeners()}static getInstance(){return e.instance||=new e,e.instance}subscribe(e){return this.listeners.push(e),e({...this.state}),()=>{this.listeners=this.listeners.filter(t=>t!==e)}}notify(){let e={...this.state};this.listeners.forEach(t=>t(e))}setupAudioListeners(){this.audio.addEventListener(`play`,()=>{this.state.isPlaying=!0,this.state.isLoading=!1,this.notify()}),this.audio.addEventListener(`pause`,()=>{this.state.isPlaying=!1,this.notify()}),this.audio.addEventListener(`timeupdate`,()=>{this.state.currentTime=this.audio.currentTime||0,this.notify(),!this.recordedCurrentPlay&&this.state.currentTime>5&&this.state.currentTrack&&(this.recordedCurrentPlay=!0,r.recordPlay(this.state.currentTrack))}),this.audio.addEventListener(`loadedmetadata`,()=>{this.state.duration=this.audio.duration||this.state.currentTrack?.duration||0,this.state.isLoading=!1,this.notify()}),this.audio.addEventListener(`waiting`,()=>{this.state.isLoading=!0,this.notify()}),this.audio.addEventListener(`playing`,()=>{this.state.isLoading=!1,this.notify()}),this.audio.addEventListener(`ended`,()=>{this.state.repeatMode===`one`?(this.audio.currentTime=0,this.audio.play().catch(console.warn)):this.next()}),this.audio.addEventListener(`error`,e=>{console.warn(`Audio playback error encountered:`,e),this.state.isLoading=!1,this.state.isPlaying=!1,this.state.hasError=!0,this.state.errorMessage=`Esta pista no está disponible para reproducción en este momento.`,this.notify()})}playTrack(e,t=[]){this.state.hasError=!1,this.state.errorMessage=void 0,this.recordedCurrentPlay=!1,t.length>0?(this.state.queue=[...t],this.state.queueIndex=this.state.queue.findIndex(t=>String(t.id)===String(e.id)),this.state.queueIndex===-1&&(this.state.queue.unshift(e),this.state.queueIndex=0)):(this.state.queue.some(t=>String(t.id)===String(e.id))||this.state.queue.push(e),this.state.queueIndex=this.state.queue.findIndex(t=>String(t.id)===String(e.id))),this.state.currentTrack=e,this.state.currentTime=0,this.state.duration=e.duration||0,this.state.isLoading=!0,this.notify();let n=e.stream_url||`https://api.audius.co/v1/tracks/${e.id}/stream?app_name=VynoxPlay&client_id=2cc593fc814461263d282a84286fd4f72c79562e`;this.audio.src=n,this.audio.load();let r=this.audio.play();r!==void 0&&r.catch(e=>{console.warn(`Auto-play prevented or stream failed:`,e),this.state.isPlaying=!1,this.state.isLoading=!1,this.notify()})}togglePlay(){this.state.currentTrack?this.state.isPlaying?this.audio.pause():this.audio.play().catch(e=>{console.warn(`Play error:`,e)}):this.state.queue.length>0&&this.playTrack(this.state.queue[0],this.state.queue)}pause(){this.audio.pause()}resume(){this.state.currentTrack&&this.audio.play().catch(console.warn)}seek(e){Number.isFinite(e)&&(this.audio.currentTime=Math.max(0,Math.min(e,this.audio.duration||this.state.duration)))}seekPercentage(e){let t=this.audio.duration||this.state.duration;t>0&&this.seek(e/100*t)}setVolume(e){let t=Math.max(0,Math.min(1,e));this.state.volume=t,this.audio.volume=t,this.state.isMuted=t===0,this.notify()}toggleMute(){this.state.isMuted=!this.state.isMuted,this.audio.muted=this.state.isMuted,this.notify()}toggleShuffle(){this.state.isShuffle=!this.state.isShuffle,this.notify()}cycleRepeat(){let e=[`off`,`all`,`one`],t=e.indexOf(this.state.repeatMode);this.state.repeatMode=e[(t+1)%e.length],this.notify()}next(){if(this.state.queue.length===0)return;if(this.state.isShuffle){let e=Math.floor(Math.random()*this.state.queue.length);this.state.queueIndex=e,this.playTrack(this.state.queue[e],this.state.queue);return}let e=this.state.queueIndex+1;e<this.state.queue.length?(this.state.queueIndex=e,this.playTrack(this.state.queue[e],this.state.queue)):this.state.repeatMode===`all`?(this.state.queueIndex=0,this.playTrack(this.state.queue[0],this.state.queue)):(this.audio.pause(),this.audio.currentTime=0,this.state.isPlaying=!1,this.notify())}prev(){if(this.state.queue.length===0)return;if(this.audio.currentTime>3){this.audio.currentTime=0;return}let e=this.state.queueIndex-1;e>=0?(this.state.queueIndex=e,this.playTrack(this.state.queue[e],this.state.queue)):this.audio.currentTime=0}getState(){return{...this.state}}static formatTime(e){if(!Number.isFinite(e)||e<0)return`0:00`;let t=Math.floor(e/60),n=Math.floor(e%60);return`${t}:${n<10?`0`:``}${n}`}},a=i.getInstance(),o=class t{constructor(){}static getInstance(){return t.instance||=new t,t.instance}async request(t,n={}){return await fetch(t,{...n,headers:{Accept:`application/json`,...e.getAuthHeaders(),...n.headers||{}},credentials:`include`})}async getOverview(){try{let e=await this.request(`/api/admin/overview`);if(!e.ok)throw Error(`No autorizado`);return(await e.json()).stats}catch(e){return console.warn(`Failed to get admin overview:`,e),null}}async getStats(){return this.getOverview()}async getUsers(e=``,t=`all`,n=`all`){try{let r=new URLSearchParams;e&&r.append(`q`,e),t!==`all`&&r.append(`role`,t),n!==`all`&&r.append(`status`,n);let i=await this.request(`/api/admin/users?${r.toString()}`);if(!i.ok)throw Error(`No autorizado`);return(await i.json()).users||[]}catch(e){return console.warn(`Failed to get users:`,e),[]}}async getUserDetail(e){try{let t=await this.request(`/api/admin/users/${e}`);if(!t.ok)throw Error(`Usuario no encontrado`);return await t.json()}catch{return null}}async setUserStatus(e,t,n){try{let r=await this.request(`/api/admin/users/${e}/status`,{method:`PUT`,headers:{"Content-Type":`application/json`},body:JSON.stringify({status:t,reason:n})}),i=await r.json();return r.ok?{success:!0,message:i.message}:{success:!1,message:i.error}}catch(e){return{success:!1,message:e.message}}}async setRole(e,t){try{let n=await this.request(`/api/admin/users/${e}/role`,{method:`PUT`,headers:{"Content-Type":`application/json`},body:JSON.stringify({role:t})}),r=await n.json();return n.ok?{success:!0,message:r.message}:{success:!1,message:r.error}}catch(e){return{success:!1,message:e.message}}}async deleteUser(e){try{let t=await this.request(`/api/admin/users/${e}`,{method:`DELETE`}),n=await t.json();return t.ok?{success:!0,message:n.message}:{success:!1,message:n.error}}catch(e){return{success:!1,message:e.message}}}async getMusicData(){try{let e=await this.request(`/api/admin/music`);if(!e.ok)throw Error(`Error al cargar música`);let t=await e.json();return{customTracks:t.customTracks||[],reports:t.reports||[]}}catch{return{customTracks:[],reports:[]}}}async createCustomTrack(e){try{let t=await this.request(`/api/admin/music`,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify(e)}),n=await t.json();return t.ok?{success:!0,track:n.track}:{success:!1,message:n.error}}catch(e){return{success:!1,message:e.message}}}async deleteCustomTrack(e){try{return(await this.request(`/api/admin/music/${e}`,{method:`DELETE`})).ok}catch{return!1}}async getSecurityLogs(e=100){try{let t=await this.request(`/api/admin/security?limit=${e}`);if(!t.ok)throw Error(`No autorizado`);let n=await t.json();return{logs:n.logs||[],failedCount:n.failedCount||0}}catch{return{logs:[],failedCount:0}}}async getNotifications(){try{let e=await this.request(`/api/admin/notifications`);return e.ok&&(await e.json()).notifications||[]}catch{return[]}}async createNotification(e){try{return(await this.request(`/api/admin/notifications`,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify(e)})).ok}catch{return!1}}async toggleNotification(e){try{return(await this.request(`/api/admin/notifications/${e}/toggle`,{method:`PUT`})).ok}catch{return!1}}async deleteNotification(e){try{return(await this.request(`/api/admin/notifications/${e}`,{method:`DELETE`})).ok}catch{return!1}}async getSettings(){try{let e=await this.request(`/api/admin/settings`);return e.ok?(await e.json()).settings:null}catch{return null}}async updateSettings(e){try{return(await this.request(`/api/admin/settings`,{method:`PUT`,headers:{"Content-Type":`application/json`},body:JSON.stringify(e)})).ok}catch{return!1}}async getPublicSettings(){try{let e=await fetch(`/api/settings/public`);return e.ok?(await e.json()).settings:null}catch{return null}}async getAuditLogs(e=100){try{let t=await this.request(`/api/admin/audit?limit=${e}`);return t.ok&&(await t.json()).logs||[]}catch{return[]}}async getReports(){try{let e=await this.request(`/api/admin/reports`);return e.ok&&(await e.json()).reports||[]}catch{return[]}}async updateReport(e,t,n){try{return(await this.request(`/api/admin/reports/${e}`,{method:`PUT`,headers:{"Content-Type":`application/json`},body:JSON.stringify({status:t,admin_note:n})})).ok}catch{return!1}}async submitReport(e){try{return(await this.request(`/api/reports`,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify(e)})).ok}catch{return!1}}async getAllAds(){try{let e=await this.request(`/api/admin/ads`);return e.ok&&(await e.json()).ads||[]}catch{return[]}}async createAd(e){try{let t=await this.request(`/api/admin/ads`,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify(e)}),n=await t.json();return t.ok?{success:!0,ad:n.ad}:{success:!1,message:n.error}}catch(e){return{success:!1,message:e.message}}}async updateAd(e,t){try{return(await this.request(`/api/admin/ads/${e}`,{method:`PUT`,headers:{"Content-Type":`application/json`},body:JSON.stringify(t)})).ok}catch{return!1}}async deleteAd(e){try{return(await this.request(`/api/admin/ads/${e}`,{method:`DELETE`})).ok}catch{return!1}}async getActiveAds(e){try{let t=e?`/api/ads/active?placement=${e}`:`/api/ads/active`,n=await fetch(t);return n.ok&&(await n.json()).ads||[]}catch{return[]}}async recordAdView(e){try{await fetch(`/api/ads/${e}/view`,{method:`POST`})}catch{}}async recordAdClick(e){try{await fetch(`/api/ads/${e}/click`,{method:`POST`})}catch{}}async getSystemStatus(){try{let e=await this.request(`/api/admin/system`);return e.ok?(await e.json()).system:null}catch{return null}}async downloadBackup(){try{let e=await this.request(`/api/admin/system/backup`);if(!e.ok)throw Error(`No autorizado`);let t=await e.blob(),n=window.URL.createObjectURL(t),r=document.createElement(`a`);r.href=n,r.download=`vynox_play_backup_${Date.now()}.json`,document.body.appendChild(r),r.click(),r.remove(),window.URL.revokeObjectURL(n)}catch(e){throw console.error(`Backup download error:`,e),e}}async restoreBackup(e){try{let t=await this.request(`/api/admin/system/restore`,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify(e)}),n=await t.json();return t.ok?{success:!0,message:n.message}:{success:!1,message:n.error}}catch(e){return{success:!1,message:e.message}}}}.getInstance(),s={currentView:`home`,currentAdminTab:`overview`,selectedGenre:`Todos`,selectedPlaylist:null,trendingTracks:[],searchResults:[],searchQuery:``,userPlaylists:[],userFavorites:[],historyTracks:[],adminStats:null,adminUsers:[],currentUser:null,isLoading:!1,selectedTrackForPlaylist:null,selectedUserForDetail:null};function c(e,t=`info`){let n=document.getElementById(`toast-container`);if(!n)return;let r=document.createElement(`div`);r.className=`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-xl text-xs font-medium transform transition-all duration-300 translate-y-2 opacity-0 ${t===`success`?`bg-[#1C2618]/95 border-emerald-500/50 text-emerald-200`:t===`error`?`bg-[#2E1815]/95 border-rose-500/50 text-rose-200`:`bg-[#221F1C]/95 border-amber-500/40 text-[#FAF7F2]`}`,r.innerHTML=`<span>${e}</span>`,n.appendChild(r),requestAnimationFrame(()=>{r.classList.remove(`translate-y-2`,`opacity-0`)}),setTimeout(()=>{r.classList.add(`opacity-0`,`translate-y-2`),setTimeout(()=>r.remove(),300)},3500)}var l={},u=null,d=0,f=null,p=``;async function m(e,t=[]){let n=Date.now();try{let r=await o.getActiveAds(`pre_roll_audio`);if(r&&r.length>0&&n-d>3e4){d=n;let i=r[0];h(i,()=>{a.playTrack(e,t)});return}}catch(e){console.warn(`Pre-roll check notice:`,e)}a.playTrack(e,t)}function h(e,t){let n=document.getElementById(`modal-preroll-ad`),r=document.getElementById(`preroll-title`),i=document.getElementById(`preroll-desc`),a=document.getElementById(`preroll-cta-btn`),s=document.getElementById(`preroll-skip-btn`),c=document.getElementById(`preroll-timer-progress`),l=document.getElementById(`preroll-img`),u=document.getElementById(`preroll-video`);if(!n){t();return}o.recordAdView(e.id),r&&(r.textContent=e.title),i&&(i.textContent=e.description||`Promoción oficial en Vynox Play.`),a&&(e.target_url?(a.href=e.target_url,a.classList.remove(`hidden`),a.onclick=()=>{o.recordAdClick(e.id)}):a.classList.add(`hidden`)),e.media_type===`video`&&u&&l?(l.classList.add(`hidden`),u.classList.remove(`hidden`),u.src=e.media_url,u.currentTime=0,u.play().catch(()=>{})):l&&u&&(u.classList.add(`hidden`),l.classList.remove(`hidden`),l.src=e.media_url),n.classList.remove(`hidden`);let d=Math.max(2,e.duration||8),p=Math.min(d,Math.max(0,e.skip_after??3)),m=0;c&&(c.style.width=`0%`);let h=()=>{clearInterval(f),u&&(u.pause(),u.src=``),n.classList.add(`hidden`),t()};s&&(e.can_skip?(s.disabled=p>0,s.textContent=p>0?`Saltar en ${p}s`:`Saltar Anuncio ➔`,s.className=p>0?`px-3 py-1 rounded-xl bg-[#28231E] text-[#7D756C] text-xs font-semibold font-mono border border-[#3D352D] cursor-not-allowed`:`px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs font-bold font-mono border border-amber-500/40 cursor-pointer shadow-md`,s.onclick=()=>{s.disabled||h()}):(s.disabled=!0,s.textContent=`Anuncio`,s.className=`px-3 py-1 rounded-xl bg-[#28231E] text-[#7D756C] text-xs font-semibold font-mono border border-[#3D352D] cursor-not-allowed`)),clearInterval(f),f=setInterval(()=>{m+=.2;let t=Math.min(100,m/d*100);if(c&&(c.style.width=`${t}%`),e.can_skip&&s&&m<p){let e=Math.ceil(p-m);s.textContent=`Saltar en ${e}s`}else e.can_skip&&s&&m>=p&&s.disabled&&(s.disabled=!1,s.textContent=`Saltar Anuncio ➔`,s.className=`px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs font-bold font-mono border border-amber-500/40 cursor-pointer shadow-md`);m>=d&&h()},200)}async function g(){let e=document.getElementById(`home-ad-banner`);if(e)try{let t=await o.getActiveAds(`home_banner`);if(!t||t.length===0){e.classList.add(`hidden`);return}let n=t[0],r=document.getElementById(`home-ad-img`),i=document.getElementById(`home-ad-video`),a=document.getElementById(`home-ad-title`),s=document.getElementById(`home-ad-desc`),c=document.getElementById(`home-ad-cta-btn`);a&&(a.textContent=n.title),s&&(s.textContent=n.description||`Promoción oficial`),n.media_type===`video`&&i&&r?(r.classList.add(`hidden`),i.classList.remove(`hidden`),i.src=n.media_url):r&&i&&(i.classList.add(`hidden`),r.classList.remove(`hidden`),r.src=n.media_url),c&&(n.target_url?(c.href=n.target_url,c.classList.remove(`hidden`),c.onclick=()=>{o.recordAdClick(n.id)}):c.classList.add(`hidden`)),e.classList.remove(`hidden`),o.recordAdView(n.id)}catch{e.classList.add(`hidden`)}}async function _(){let e=document.getElementById(`platform-notification-banner`);if(e)try{let t=await fetch(`/api/notifications/active`);if(!t.ok)return;let n=(await t.json()).notifications||[];if(n.length===0){e.classList.add(`hidden`);return}let r=n[0],i=document.getElementById(`notif-banner-title`),a=document.getElementById(`notif-banner-message`),o=document.getElementById(`notif-banner-badge`),s=document.getElementById(`btn-close-notif-banner`);i&&(i.textContent=r.title),a&&(a.textContent=r.message),o&&(o.textContent=r.type===`warning`?`Mantenimiento`:r.type===`update`?`Novedad`:`Aviso`,o.className=r.type===`warning`?`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40 shrink-0`:`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0`),s&&(s.onclick=()=>e.classList.add(`hidden`)),e.classList.remove(`hidden`)}catch{e.classList.add(`hidden`)}}async function v(){let e=await o.getPublicSettings();e&&e.platform_name&&(document.title=`${e.platform_name} • Streaming Musical de Alta Fidelidad`)}document.addEventListener(`DOMContentLoaded`,async()=>{y(),b(),s.currentUser=await e.checkSession(),T(),a.subscribe(ie),v(),_(),await E(),s.currentUser&&R()});function y(){l={home:document.getElementById(`view-home`),explore:document.getElementById(`view-explore`),search:document.getElementById(`view-search`),favorites:document.getElementById(`view-favorites`),playlists:document.getElementById(`view-playlists`),"playlist-detail":document.getElementById(`view-playlist-detail`),history:document.getElementById(`view-history`),admin:document.getElementById(`view-admin`)}}function b(){document.querySelectorAll(`[data-nav]`).forEach(e=>{e.addEventListener(`click`,t=>{t.preventDefault();let n=e.dataset.nav;n&&(x(n),C())})});let e=document.getElementById(`mobile-menu-toggle`);e&&e.addEventListener(`click`,e=>{e.preventDefault(),e.stopPropagation(),S()});let t=document.getElementById(`sidebar-close-btn`);t&&t.addEventListener(`click`,e=>{e.preventDefault(),C()});let n=document.getElementById(`sidebar-backdrop`);n&&n.addEventListener(`click`,()=>{C()}),document.querySelectorAll(`.admin-tab-btn`).forEach(e=>{e.addEventListener(`click`,t=>{t.preventDefault();let n=e.dataset.adminTab;n&&G(n)})});let r=document.getElementById(`btn-admin-refresh`);r&&r.addEventListener(`click`,()=>{W(),c(`Datos de administración actualizados`,`info`)});let i=document.getElementById(`header-search-input`);i&&i.addEventListener(`input`,e=>{let t=e.target.value;if(t.trim()){x(`search`);let e=document.getElementById(`search-input`);e&&(e.value=t),I(t)}});let o=document.getElementById(`search-input`);o&&o.addEventListener(`input`,e=>{I(e.target.value)});let s=document.getElementById(`player-play-pause`);s&&s.addEventListener(`click`,()=>a.togglePlay());let l=document.getElementById(`player-next`);l&&l.addEventListener(`click`,()=>a.next());let u=document.getElementById(`player-prev`);u&&u.addEventListener(`click`,()=>a.prev());let d=document.getElementById(`player-shuffle`);d&&d.addEventListener(`click`,()=>a.toggleShuffle());let f=document.getElementById(`player-repeat`);f&&f.addEventListener(`click`,()=>a.cycleRepeat());let p=document.getElementById(`player-progress`);p&&p.addEventListener(`input`,e=>{let t=parseFloat(e.target.value)/100*a.getState().duration;a.seek(t)});let m=document.getElementById(`player-volume`);m&&m.addEventListener(`input`,e=>{let t=parseFloat(e.target.value)/100;a.setVolume(t)});let h=document.getElementById(`player-mute`);h&&h.addEventListener(`click`,()=>a.toggleMute());let g=document.getElementById(`player-heart`);g&&g.addEventListener(`click`,()=>{let e=a.getState().currentTrack;e&&M(e,g)}),P(),re(),U()}function x(e,t){s.currentView=e,Object.keys(l).forEach(t=>{let n=l[t];n&&(t===e?n.classList.remove(`hidden`):n.classList.add(`hidden`))}),document.querySelectorAll(`[data-nav]`).forEach(t=>{t.dataset.nav===e?(t.classList.add(`text-amber-400`),t.classList.remove(`text-[#8A8074]`,`text-[#BDB5AA]`),t.classList.contains(`px-3`)&&(t.classList.add(`bg-[#28231E]`,`border-amber-500/40`),t.classList.remove(`border-transparent`))):(t.classList.remove(`text-amber-400`),t.classList.add(`text-[#BDB5AA]`),t.classList.contains(`px-3`)&&(t.classList.remove(`bg-[#28231E]`,`border-amber-500/40`),t.classList.add(`border-transparent`)))}),e===`home`?g():e===`explore`?F():e===`favorites`?L():e===`playlists`?z():e===`playlist-detail`?(t&&(s.selectedPlaylist=t),B()):e===`history`?V():e===`admin`&&W(),C(),window.scrollTo({top:0,behavior:`smooth`})}function S(){let e=document.getElementById(`main-sidebar`),t=document.getElementById(`sidebar-backdrop`);e&&(e.classList.remove(`-translate-x-full`),e.classList.add(`translate-x-0`)),t&&t.classList.remove(`hidden`)}function C(){let e=document.getElementById(`main-sidebar`),t=document.getElementById(`sidebar-backdrop`);e&&(e.classList.add(`-translate-x-full`),e.classList.remove(`translate-x-0`)),t&&t.classList.add(`hidden`)}window.navigateTo=x,window.switchAdminTab=G,window.openMobileSidebar=S,window.closeMobileSidebar=C;function w(e){if(!e)return`VP`;let t=e.trim().split(/\s+/);return t.length>=2?(t[0][0]+t[1][0]).toUpperCase():e.slice(0,2).toUpperCase()}function T(){let t=s.currentUser,n=t?w(t.name):`VP`,r=document.getElementById(`menu-user-logged`),i=document.getElementById(`menu-user-guest`),a=document.getElementById(`menu-user-avatar`),o=document.getElementById(`menu-user-name`),c=document.getElementById(`menu-user-badge`),l=document.getElementById(`menu-user-email`),u=document.getElementById(`header-user-logged`),d=document.getElementById(`header-user-guest`),f=document.getElementById(`header-user-avatar`),p=document.getElementById(`header-user-name`),m=document.getElementById(`header-user-role`),h=document.getElementById(`user-profile-section`),g=document.getElementById(`guest-profile-section`),_=document.getElementById(`user-profile-name`),v=document.getElementById(`user-profile-role`),y=document.getElementById(`nav-admin-item`);if(t){let e=t.role===`admin`||t.role===`superadmin`||t.role===`moderator`;r&&r.classList.remove(`hidden`),i&&i.classList.add(`hidden`),a&&(a.textContent=n),o&&(o.textContent=t.name),l&&(l.textContent=t.email),c&&(c.textContent=t.role.toUpperCase(),c.className=e?`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0`:`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-[#28231E] text-[#D5CBC0] border border-[#3A332B] shrink-0`),u&&u.classList.remove(`hidden`),d&&d.classList.add(`hidden`),f&&(f.textContent=n),p&&(p.textContent=t.name),m&&(m.textContent=t.role===`superadmin`?`Superadmin`:t.role===`admin`?`Administrador`:t.role===`moderator`?`Moderador`:`Usuario`),h&&h.classList.remove(`hidden`),g&&g.classList.add(`hidden`),_&&(_.textContent=t.name),v&&(v.textContent=t.role.toUpperCase(),v.className=e?`text-[10px] font-bold text-amber-400 tracking-wider font-mono`:`text-[10px] font-bold text-amber-500/80 tracking-wider font-mono`),y&&(e?y.classList.remove(`hidden`):y.classList.add(`hidden`))}else r&&r.classList.add(`hidden`),i&&i.classList.remove(`hidden`),u&&u.classList.add(`hidden`),d&&d.classList.remove(`hidden`),h&&h.classList.add(`hidden`),g&&g.classList.remove(`hidden`),y&&y.classList.add(`hidden`);let b=document.getElementById(`btn-logout-sidebar`);b&&(b.onclick=async()=>{await e.logout(),window.location.href=`/html/login.html`});let x=document.getElementById(`menu-btn-logout`);x&&(x.onclick=async()=>{await e.logout(),window.location.href=`/html/login.html`})}async function E(){let e=document.getElementById(`trending-tracks-grid`);e&&(e.innerHTML=$(12)),O(),g(),s.trendingTracks=await t.getTrendingTracks(`Todos`,24),D(),k()}function D(){if(s.trendingTracks.length===0)return;let e=s.trendingTracks[0],t=document.getElementById(`hero-track-title`),n=document.getElementById(`hero-track-artist`),r=document.getElementById(`hero-track-genre`),i=document.getElementById(`hero-track-cover`),a=document.getElementById(`hero-play-btn`);t&&(t.textContent=e.title),n&&(n.textContent=e.artist),r&&(r.textContent=e.genre||`Destacado`),i&&(i.src=e.artwork),a&&(a.onclick=()=>{m(e,s.trendingTracks)})}function O(){let e=document.getElementById(`home-genre-chips`);e&&(e.innerHTML=[`Todos`,`Electronic`,`Hip-Hop/Rap`,`Pop`,`Rock`,`House`,`Trap`,`Lo-Fi`,`Latin`,`Ambient`].map(e=>`
      <button 
        class="genre-chip px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${s.selectedGenre===e?`bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20`:`bg-[#221F1C] hover:bg-[#2C2722] text-[#D5CBC0] hover:text-[#FAF7F2] border border-[#332D27]`}"
        data-genre="${e}"
      >
        ${e}
      </button>
    `).join(``),e.querySelectorAll(`[data-genre]`).forEach(e=>{e.addEventListener(`click`,async()=>{let n=e.dataset.genre||`Todos`;s.selectedGenre=n,O();let r=document.getElementById(`trending-tracks-grid`);r&&(r.innerHTML=$(8)),s.trendingTracks=await t.getTrendingTracks(n,24),k()})}))}function k(){let e=document.getElementById(`trending-tracks-grid`);e&&(s.trendingTracks.length===0?e.innerHTML=`
      <div class="col-span-full py-12 text-center text-slate-500">
        No se encontraron pistas para este género.
      </div>
    `:(e.innerHTML=s.trendingTracks.map((e,t)=>A(e,t)).join(``),j(e,s.trendingTracks)))}function A(e,t){let n=r.isFavorite(e.id),a=i.formatTime(e.duration);return`
    <div 
      class="music-card bg-[#181614] border border-[#2D2823] hover:border-amber-500/40 rounded-xl p-3 flex flex-col justify-between group relative cursor-pointer"
      data-track-id="${e.id}"
      data-track-index="${t}"
    >
      <div class="relative aspect-square w-full rounded-lg overflow-hidden mb-3 bg-[#201D1A]">
        <img 
          src="${e.artwork}" 
          alt="${e.title}" 
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
          ${e.genre||`Vynox`}
        </span>
      </div>

      <div class="flex-1 min-w-0">
        <h4 class="text-xs sm:text-sm font-bold text-[#FAF7F2] truncate group-hover:text-amber-400 transition-colors" title="${e.title}">
          ${e.title}
        </h4>
        <p class="text-[11px] sm:text-xs text-[#BDB5AA] truncate mt-0.5" title="${e.artist}">
          ${e.artist}
        </p>
      </div>

      <div class="flex items-center justify-between mt-2.5 pt-2 border-t border-[#26221D] text-xs text-[#8A8074]">
        <span class="font-mono text-[10px] sm:text-[11px]">${a}</span>
        
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
            class="p-1 sm:p-1.5 rounded-lg hover:bg-[#28231E] text-[#8A8074] hover:text-rose-500 transition-colors ${n?`text-rose-500`:``}"
            title="${n?`Quitar de favoritos`:`Añadir a favoritos`}"
            data-action="favorite"
          >
            <svg width="16" height="16" class="w-3.5 h-3.5 sm:w-4 sm:h-4 ${n?`fill-current`:`fill-none`} stroke-current" stroke-width="2" viewBox="0 0 24 24">
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
  `}function j(e,t){e.querySelectorAll(`.music-card`).forEach(e=>{let n=e.dataset.trackId,r=t.find(e=>String(e.id)===String(n));r&&e.addEventListener(`click`,e=>{let n=e.target.closest(`[data-action]`),i=n?.getAttribute(`data-action`);i===`report`?(e.stopPropagation(),H(`track`,r.id,`${r.title} - ${r.artist}`)):i===`favorite`?(e.stopPropagation(),M(r,n)):i===`add-to-playlist`?(e.stopPropagation(),N(r)):m(r,t)})})}async function M(e,t){if(!s.currentUser)c(`Inicia sesión para guardar favoritos`,`info`);else try{let n=await r.toggleFavorite(e),i=t.querySelector(`svg`);i&&(n?(t.classList.add(`text-rose-500`),i.classList.add(`fill-current`),i.classList.remove(`fill-none`)):(t.classList.remove(`text-rose-500`),i.classList.remove(`fill-current`),i.classList.add(`fill-none`))),c(n?`Añadido a tus Favoritos`:`Eliminado de tus Favoritos`,`success`),R()}catch(e){console.warn(`Could not complete favorite toggle:`,e)}}function N(e){if(!s.currentUser){c(`Inicia sesión para gestionar tus playlists`,`info`),window.location.href=`/html/login.html`;return}s.selectedTrackForPlaylist=e;let t=document.getElementById(`modal-add-to-playlist`),n=document.getElementById(`modal-add-track-info`),i=document.getElementById(`modal-add-playlists-list`);if(n&&(n.innerHTML=`
      <div class="flex items-center gap-3 p-2 bg-[#201D1A] rounded-xl border border-[#332D27]">
        <img src="${e.artwork}" class="w-10 h-10 rounded-lg object-cover" onerror="this.src='/assets/default-cover.svg'" />
        <div class="min-w-0">
          <p class="text-xs font-bold text-[#FAF7F2] truncate">${e.title}</p>
          <p class="text-[11px] text-[#BDB5AA] truncate">${e.artist}</p>
        </div>
      </div>
    `),i){if(s.userPlaylists.length===0){i.innerHTML=`
        <div class="text-center py-4 text-xs text-[#BDB5AA]">
          <p>No tienes playlists creadas todavía.</p>
          <button id="btn-create-first-playlist" class="mt-2 text-amber-400 hover:underline">
            + Crear una nueva playlist
          </button>
        </div>
      `;let e=document.getElementById(`btn-create-first-playlist`);e&&(e.onclick=()=>{t&&t.classList.add(`hidden`);let e=document.getElementById(`modal-create-playlist`);e&&e.classList.remove(`hidden`)})}else i.innerHTML=s.userPlaylists.map(t=>{let n=t.tracks.some(t=>String(t.id)===String(e.id));return`
          <button 
            class="w-full text-left p-2.5 rounded-xl bg-[#201D1A] hover:bg-[#28231E] border border-[#332D27] hover:border-amber-500/40 transition-all flex items-center justify-between"
            data-target-playlist="${t.id}"
          >
            <div>
              <p class="text-xs font-semibold text-[#FAF7F2]">${t.name}</p>
              <p class="text-[10px] text-[#BDB5AA]">${t.tracks.length} canciones</p>
            </div>
            <span class="text-xs ${n?`text-amber-400 font-mono font-bold`:`text-[#8A8074]`}">
              ${n?`✓ Ya añadida`:`+ Añadir`}
            </span>
          </button>
        `}).join(``),i.querySelectorAll(`[data-target-playlist]`).forEach(e=>{e.addEventListener(`click`,async()=>{let n=e.dataset.targetPlaylist;n&&s.selectedTrackForPlaylist&&(await r.addTrackToPlaylist(n,s.selectedTrackForPlaylist)?(c(`Canción agregada a playlist`,`success`),t&&t.classList.add(`hidden`),R()):c(`Error al añadir a playlist`,`error`))})})}t&&t.classList.remove(`hidden`)}function P(){let e=document.getElementById(`modal-create-playlist`),t=document.getElementById(`btn-create-playlist`),n=document.getElementById(`btn-create-playlist-header`),i=document.getElementById(`modal-playlist-close`),a=document.getElementById(`form-create-playlist`),o=()=>{s.currentUser?e&&e.classList.remove(`hidden`):(c(`Inicia sesión para crear playlists`,`info`),window.location.href=`/html/login.html`)};t&&(t.onclick=o),n&&(n.onclick=o),i&&e&&(i.onclick=()=>e.classList.add(`hidden`)),a&&(a.onsubmit=async t=>{t.preventDefault();let n=document.getElementById(`playlist-name-input`),i=document.getElementById(`playlist-desc-input`);if(!n||!n.value.trim())return;let o=await r.createPlaylist(n.value,i?i.value:``);o?(c(`Playlist creada con éxito`,`success`),e&&e.classList.add(`hidden`),a.reset(),await R(),x(`playlist-detail`,o)):c(`Error al crear playlist`,`error`)});let l=document.getElementById(`modal-add-to-playlist`),u=document.getElementById(`modal-add-playlist-close`);u&&l&&(u.onclick=()=>l.classList.add(`hidden`))}function F(){let e=document.getElementById(`explore-genres-grid`);e&&(e.innerHTML=[`Electronic`,`Hip-Hop/Rap`,`Pop`,`R&B/Soul`,`Rock`,`Latin`,`House`,`Techno`,`Trap`,`Indie`,`Lo-Fi`,`Ambient`].map(e=>`
    <div 
      class="genre-card bg-[#181614] border border-[#2D2823] hover:border-amber-500/50 p-5 rounded-2xl cursor-pointer group transition-all shadow-md"
      data-explore-genre="${e}"
    >
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-lg font-bold text-[#FAF7F2] group-hover:text-amber-400 transition-colors">${e}</h3>
        <span class="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-[#D5CBC0] group-hover:bg-amber-400 group-hover:text-slate-950 transition-colors">
          <svg width="16" height="16" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
      <p class="text-xs text-[#BDB5AA]">Pistas destacadas y artistas de ${e}</p>
    </div>
  `).join(``),e.querySelectorAll(`[data-explore-genre]`).forEach(e=>{e.addEventListener(`click`,async()=>{let n=e.dataset.exploreGenre;if(n){s.selectedGenre=n,x(`home`),O();let e=document.getElementById(`trending-tracks-grid`);e&&(e.innerHTML=$(12)),s.trendingTracks=await t.getTrendingTracks(n,24),k()}})}))}function I(e){clearTimeout(u),s.searchQuery=e;let n=document.getElementById(`search-results-grid`),r=document.getElementById(`search-status-text`);e.trim()?(r&&(r.textContent=`Buscando "${e}" en el catálogo oficial de Vynox...`),n&&(n.innerHTML=$(6)),u=setTimeout(async()=>{try{let i=await t.search(e);s.searchResults=i,i.length===0?(r&&(r.textContent=`No se encontraron resultados para "${e}". Intenta con otro término.`),n&&(n.innerHTML=``)):(r&&(r.textContent=`Mostrando ${i.length} resultados para "${e}":`),n&&(n.innerHTML=i.map((e,t)=>A(e,t)).join(``),j(n,i)))}catch{r&&(r.textContent=`Error al realizar la búsqueda en Audius.`)}},400)):(n&&(n.innerHTML=``),r&&(r.textContent=`Escribe el nombre de una canción o artista para buscar en Audius.`))}async function L(){let e=document.getElementById(`favorites-tracks-container`),t=document.getElementById(`favorites-count`),n=document.getElementById(`btn-play-all-favorites`);if(!s.currentUser){e&&(e.innerHTML=`
        <div class="py-16 text-center text-[#BDB5AA]">
          <p class="text-base font-semibold mb-2">Inicia sesión para ver tu biblioteca de favoritos</p>
          <a href="/html/login.html" class="inline-block px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-md">
            Iniciar Sesión / Registrarse
          </a>
        </div>
      `);return}let a=await r.getFavorites();s.userFavorites=a,t&&(t.textContent=`${a.length} canciones guardadas`),a.length===0?e&&(e.innerHTML=`
        <div class="py-16 text-center text-[#8A8074]">
          <svg width="32" height="32" class="w-8 h-8 mx-auto mb-3 text-[#5A5247]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
          </svg>
          <p class="text-sm font-semibold text-[#D5CBC0]">Tu lista de favoritos está vacía</p>
          <p class="text-xs text-[#8A8074] mt-1">Explora canciones y haz clic en el corazón para guardarlas aquí.</p>
        </div>
      `):(n&&(n.onclick=()=>{a.length>0&&m(a[0],a)}),e&&(e.innerHTML=a.map((e,t)=>`
      <div 
        class="flex items-center justify-between p-3 rounded-xl bg-[#181614] hover:bg-[#201D1A] border border-[#2D2823] transition-all group cursor-pointer"
        data-fav-track-id="${e.id}"
      >
        <div class="flex items-center gap-3 min-w-0">
          <span class="font-mono text-xs text-[#8A8074] w-5 text-right">${t+1}</span>
          <img src="${e.artwork}" class="w-11 h-11 rounded-lg object-cover" onerror="this.src='/assets/default-cover.svg'" />
          <div class="min-w-0">
            <p class="text-sm font-bold text-[#FAF7F2] truncate group-hover:text-amber-400 transition-colors">${e.title}</p>
            <p class="text-xs text-[#BDB5AA] truncate">${e.artist}</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <span class="text-xs font-mono text-[#8A8074]">${i.formatTime(e.duration)}</span>
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
    `).join(``),e.querySelectorAll(`[data-fav-track-id]`).forEach(e=>{let t=e.dataset.favTrackId,n=a.find(e=>String(e.id)===String(t));n&&e.addEventListener(`click`,e=>{e.target.closest(`[data-action="remove-fav"]`)?(e.stopPropagation(),r.toggleFavorite(n).then(()=>{c(`Eliminado de favoritos`,`info`),L()})):m(n,a)})})))}async function R(){s.userPlaylists=await r.getPlaylists(),s.userFavorites=await r.getFavorites()}async function z(){let e=document.getElementById(`playlists-grid`);if(!e)return;if(!s.currentUser){e.innerHTML=`
      <div class="col-span-full py-16 text-center text-[#BDB5AA]">
        <p class="text-base font-semibold mb-2">Inicia sesión para gestionar tus playlists personalizadas</p>
        <a href="/html/login.html" class="inline-block px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-md">
          Iniciar Sesión / Registrarse
        </a>
      </div>
    `;return}let t=await r.getPlaylists();if(s.userPlaylists=t,t.length===0){e.innerHTML=`
      <div class="col-span-full py-16 text-center text-[#8A8074]">
        <svg width="32" height="32" class="w-8 h-8 mx-auto mb-3 text-[#5A5247]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
        </svg>
        <p class="text-sm font-semibold text-[#D5CBC0]">No tienes ninguna playlist creada aún</p>
        <button id="btn-create-playlist-empty" class="mt-3 px-4 py-2 rounded-xl bg-[#28231E] hover:bg-[#332D27] border border-amber-500/40 text-amber-400 text-xs font-semibold transition-all">
          + Crear mi primera playlist
        </button>
      </div>
    `;let t=document.getElementById(`btn-create-playlist-empty`);t&&(t.onclick=()=>{let e=document.getElementById(`modal-create-playlist`);e&&e.classList.remove(`hidden`)})}else e.innerHTML=t.map(e=>{let t=e.tracks.length>0?e.tracks[0].artwork:`/assets/default-cover.svg`;return`
      <div 
        class="music-card bg-[#181614] border border-[#2D2823] hover:border-amber-500/40 rounded-2xl p-4 flex flex-col justify-between cursor-pointer group shadow-lg"
        data-playlist-card-id="${e.id}"
      >
        <div class="relative aspect-square w-full rounded-xl overflow-hidden mb-3 bg-[#201D1A] flex items-center justify-center">
          <img 
            src="${t}" 
            alt="${e.name}" 
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
            onerror="this.src='/assets/default-cover.svg'"
          />
          <span class="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/75 backdrop-blur-md text-[10px] font-mono text-amber-400 border border-[#3D352D]">
            ${e.tracks.length} canciones
          </span>
        </div>

        <div>
          <h4 class="text-base font-bold text-[#FAF7F2] truncate group-hover:text-amber-400 transition-colors">${e.name}</h4>
          <p class="text-xs text-[#BDB5AA] line-clamp-2 mt-1">${e.description||`Sin descripción`}</p>
        </div>

        <div class="mt-4 pt-3 border-t border-[#26221D] flex items-center justify-between text-xs text-[#8A8074]">
          <span class="font-mono text-[10px]">Actualizado</span>
          <button class="text-amber-400 font-semibold group-hover:underline">Ver playlist &rarr;</button>
        </div>
      </div>
    `}).join(``),e.querySelectorAll(`[data-playlist-card-id]`).forEach(e=>{e.addEventListener(`click`,()=>{let n=e.dataset.playlistCardId,r=t.find(e=>e.id===n);r&&x(`playlist-detail`,r)})})}function B(){let e=s.selectedPlaylist;if(!e)return;let t=document.getElementById(`playlist-detail-title`),n=document.getElementById(`playlist-detail-desc`),a=document.getElementById(`playlist-detail-count`),o=document.getElementById(`playlist-detail-tracks`),l=document.getElementById(`btn-play-all-playlist`),u=document.getElementById(`btn-delete-playlist`);if(t&&(t.textContent=e.name),n&&(n.textContent=e.description||`Playlist personalizada en Vynox Play`),a&&(a.textContent=`${e.tracks.length} canciones`),l&&(l.onclick=()=>{e.tracks.length>0?m(e.tracks[0],e.tracks):c(`La playlist está vacía`,`info`)}),u&&(u.onclick=async()=>{confirm(`¿Estás seguro de que deseas eliminar la playlist "${e.name}"?`)&&(await r.deletePlaylist(e.id)?(c(`Playlist eliminada`,`success`),await R(),x(`playlists`)):c(`Error al eliminar playlist`,`error`))}),o){if(e.tracks.length===0){o.innerHTML=`
        <div class="py-12 text-center text-slate-500">
          <p>Esta playlist no contiene pistas aún.</p>
          <p class="text-xs text-slate-600 mt-1">Explora canciones y haz clic en el botón "+" para añadirlas aquí.</p>
        </div>
      `;return}o.innerHTML=e.tracks.map((e,t)=>`
      <div 
        class="flex items-center justify-between p-3 rounded-xl bg-[#181614] hover:bg-[#201D1A] border border-[#2D2823] transition-all group cursor-pointer"
        data-playlist-track-id="${e.id}"
      >
        <div class="flex items-center gap-3 min-w-0">
          <span class="font-mono text-xs text-[#8A8074] w-5 text-right">${t+1}</span>
          <img src="${e.artwork}" class="w-11 h-11 rounded-lg object-cover" onerror="this.src='/assets/default-cover.svg'" />
          <div class="min-w-0">
            <p class="text-sm font-bold text-[#FAF7F2] truncate group-hover:text-amber-400 transition-colors">${e.title}</p>
            <p class="text-xs text-[#BDB5AA] truncate">${e.artist}</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <span class="text-xs font-mono text-[#8A8074]">${i.formatTime(e.duration)}</span>
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
    `).join(``),o.querySelectorAll(`[data-playlist-track-id]`).forEach(t=>{let n=t.dataset.playlistTrackId,i=e.tracks.find(e=>String(e.id)===String(n));i&&t.addEventListener(`click`,async t=>{t.target.closest(`[data-action="remove-from-pl"]`)?(t.stopPropagation(),await r.removeTrackFromPlaylist(e.id,i.id)&&(c(`Pista eliminada de playlist`,`info`),e.tracks=e.tracks.filter(e=>String(e.id)!==String(i.id)),B(),R())):m(i,e.tracks)})})}}async function V(){let e=document.getElementById(`history-tracks-container`);if(!e)return;if(!s.currentUser){e.innerHTML=`
      <div class="py-16 text-center text-[#BDB5AA]">
        <p class="text-base font-semibold mb-2">Inicia sesión para registrar tu historial de reproducción</p>
        <a href="/html/login.html" class="inline-block px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-md">
          Iniciar Sesión
        </a>
      </div>
    `;return}let t=await r.getHistory();s.historyTracks=t,t.length===0?e.innerHTML=`
      <div class="py-16 text-center text-[#8A8074]">
        <p class="text-sm font-semibold text-[#D5CBC0]">No hay canciones reproducidas recientemente</p>
        <p class="text-xs text-[#8A8074] mt-1">Las pistas que escuches se guardarán aquí automáticamente.</p>
      </div>
    `:(e.innerHTML=t.map((e,t)=>`
    <div 
      class="flex items-center justify-between p-3 rounded-xl bg-[#181614] hover:bg-[#201D1A] border border-[#2D2823] transition-all group cursor-pointer"
      data-history-track-id="${e.id}"
    >
      <div class="flex items-center gap-3 min-w-0">
        <span class="font-mono text-xs text-[#8A8074] w-5 text-right">${t+1}</span>
        <img src="${e.artwork}" class="w-11 h-11 rounded-lg object-cover" onerror="this.src='/assets/default-cover.svg'" />
        <div class="min-w-0">
          <p class="text-sm font-bold text-[#FAF7F2] truncate group-hover:text-amber-400 transition-colors">${e.title}</p>
          <p class="text-xs text-[#BDB5AA] truncate">${e.artist}</p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <span class="text-xs font-mono text-[#8A8074]">${i.formatTime(e.duration)}</span>
        <button class="p-1.5 rounded-lg bg-amber-400/10 text-amber-400 hover:bg-amber-400 hover:text-slate-950 transition-colors" title="Reproducir">
          <svg width="16" height="16" class="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      </div>
    </div>
  `).join(``),e.querySelectorAll(`[data-history-track-id]`).forEach(e=>{let n=e.dataset.historyTrackId,r=t.find(e=>String(e.id)===String(n));r&&e.addEventListener(`click`,()=>{m(r,t)})}))}function H(e,t,n){if(!s.currentUser){c(`Inicia sesión para reportar contenido`,`info`);return}let r=document.getElementById(`modal-report-item`),i=document.getElementById(`report-input-type`),a=document.getElementById(`report-input-id`),o=document.getElementById(`report-input-title`),l=document.getElementById(`report-target-label`);i&&(i.value=e),a&&(a.value=t),o&&(o.value=n),l&&(l.textContent=`${e===`track`?`Canción`:`Usuario`}: ${n}`),r&&r.classList.remove(`hidden`)}function U(){let e=document.getElementById(`modal-report-item`),t=document.getElementById(`modal-report-close`),n=document.getElementById(`form-report-item`);t&&e&&(t.onclick=()=>e.classList.add(`hidden`)),n&&(n.onsubmit=async t=>{t.preventDefault();let r=document.getElementById(`report-input-type`).value,i=document.getElementById(`report-input-id`).value,a=document.getElementById(`report-input-title`).value,s=document.getElementById(`report-input-reason-select`),l=document.getElementById(`report-input-notes`).value,u=`${s.value}${l?` - ${l}`:``}`;await o.submitReport({reported_type:r,target_id:i,target_title:a,reason:u})?(c(`Reporte enviado a los moderadores. Gracias por tu colaboración.`,`success`),e&&e.classList.add(`hidden`),n.reset()):c(`Error al enviar reporte.`,`error`)})}async function W(){if(!s.currentUser||s.currentUser.role!==`admin`&&s.currentUser.role!==`superadmin`&&s.currentUser.role!==`moderator`){x(`home`),c(`Acceso restringido al personal administrativo`,`error`);return}let e=document.getElementById(`admin-header-role-badge`);e&&(e.textContent=s.currentUser.role.toUpperCase()),G(s.currentAdminTab)}function G(e){s.currentAdminTab=e,document.querySelectorAll(`.admin-tab-btn`).forEach(t=>{t.className=t.dataset.adminTab===e?`admin-tab-btn px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap bg-amber-500/20 text-amber-300 border border-amber-500/40 transition-all inline-flex items-center gap-1.5`:`admin-tab-btn px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap bg-[#1D1B18] text-[#BDB5AA] hover:text-[#FAF7F2] border border-[#2D2823] transition-all inline-flex items-center gap-1.5`}),document.querySelectorAll(`.admin-subpanel`).forEach(e=>{e.classList.add(`hidden`)});let t=document.getElementById(`admin-panel-${e}`);t&&t.classList.remove(`hidden`),e===`overview`?K():e===`users`?q():e===`music`?J():e===`ads`?Y():e===`security`?ee():e===`notifications`?X():e===`reports`?Z():e===`settings`?te():e===`system`&&ne()}async function K(){let e=await o.getOverview();if(!e)return;let t=document.getElementById(`admin-stat-users`),n=document.getElementById(`admin-stat-users-sub`),r=document.getElementById(`admin-stat-playlists`),i=document.getElementById(`admin-stat-favorites`),a=document.getElementById(`admin-stat-plays`),s=document.getElementById(`admin-stat-ads`),c=document.getElementById(`admin-stat-ads-sub`),l=document.getElementById(`admin-stat-reports`);t&&(t.textContent=String(e.totalUsers)),n&&(n.textContent=`${e.activeUsers} activos • ${e.suspendedUsers} susp.`),r&&(r.textContent=String(e.totalPlaylists)),i&&(i.textContent=String(e.totalFavorites)),a&&(a.textContent=String(e.totalPlays)),s&&(s.textContent=String(e.totalAds)),c&&(c.textContent=`${e.totalAdViews} v • ${e.totalAdClicks} c`),l&&(l.textContent=String(e.pendingReports));let u=document.getElementById(`admin-top-tracks-list`);u&&(u.innerHTML=!e.topTracks||e.topTracks.length===0?`<p class="text-xs text-[#8A8074] italic">Sin reproducciones registradas aún.</p>`:e.topTracks.map((e,t)=>`
        <div class="flex items-center justify-between p-2 rounded-xl bg-[#201D1A] border border-[#2D2823]">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="font-mono text-xs text-amber-400 font-bold w-4">${t+1}</span>
            <div class="truncate">
              <p class="text-xs font-bold text-[#FAF7F2] truncate">${e.title}</p>
              <p class="text-[10px] text-[#BDB5AA] truncate">${e.artist}</p>
            </div>
          </div>
          <span class="text-xs font-mono text-amber-400 font-semibold shrink-0 ml-2">${e.count} reproducciones</span>
        </div>
      `).join(``));let d=document.getElementById(`admin-recent-audit-list`);d&&(d.innerHTML=!e.recentAudit||e.recentAudit.length===0?`<p class="text-xs text-[#8A8074] italic">Sin acciones registradas aún.</p>`:e.recentAudit.map(e=>`
        <div class="p-2.5 rounded-xl bg-[#201D1A] border border-[#2D2823] space-y-0.5">
          <div class="flex items-center justify-between text-[10px] font-mono">
            <span class="font-bold text-amber-400">${e.admin_name} • ${e.action}</span>
            <span class="text-[#8A8074]">${new Date(e.timestamp).toLocaleTimeString([],{hour:`2-digit`,minute:`2-digit`})}</span>
          </div>
          <p class="text-xs text-[#FAF7F2] truncate">${e.details}</p>
        </div>
      `).join(``))}async function q(){let e=document.getElementById(`admin-users-search`),t=document.getElementById(`admin-users-role-filter`),n=document.getElementById(`admin-users-status-filter`),r=e?.value||``,i=t?.value||`all`,a=n?.value||`all`,l=await o.getUsers(r,i,a);s.adminUsers=l;let u=document.getElementById(`admin-users-tbody`);u&&(l.length===0?u.innerHTML=`
      <tr>
        <td colspan="7" class="py-8 text-center text-xs text-[#8A8074]">No se encontraron usuarios coincidentes.</td>
      </tr>
    `:(u.innerHTML=l.map(e=>{let t=e.status===`suspended`,n=e.role===`superadmin`?`bg-amber-500/20 text-amber-300 border-amber-500/40`:e.role===`admin`?`bg-amber-500/10 text-amber-400 border-amber-500/30`:e.role===`moderator`?`bg-cyan-500/10 text-cyan-300 border-cyan-500/30`:`bg-[#28231E] text-[#BDB5AA] border-[#3D352D]`;return`
      <tr class="border-b border-[#2D2823] hover:bg-[#201D1A]/50 transition-colors">
        <td class="py-3 px-3 text-xs font-semibold text-[#FAF7F2] flex items-center gap-2">
          <div class="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-[#E07A5F] flex items-center justify-center font-bold text-slate-950 text-[10px] shrink-0">
            ${w(e.name)}
          </div>
          <span class="truncate">${e.name}</span>
        </td>
        <td class="py-3 px-3 text-xs text-[#BDB5AA] font-mono truncate">${e.email}</td>
        <td class="py-3 px-3 text-xs">
          <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${n}">
            ${e.role}
          </span>
        </td>
        <td class="py-3 px-3 text-xs">
          <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${t?`bg-rose-500/20 text-rose-300 border border-rose-500/40`:`bg-emerald-500/20 text-emerald-300 border border-emerald-500/40`}">
            ${t?`Suspendido`:`Activo`}
          </span>
        </td>
        <td class="py-3 px-3 text-xs font-mono text-[#BDB5AA]">${e.playlistsCount} pl • ${e.favoritesCount} fav</td>
        <td class="py-3 px-3 text-xs font-mono text-[#8A8074]">${new Date(e.created_at).toLocaleDateString()}</td>
        <td class="py-3 px-3 text-right">
          <div class="flex items-center justify-end gap-1.5">
            <button 
              class="px-2.5 py-1 rounded-lg bg-[#201D1A] hover:bg-[#2A2520] border border-[#3A332B] text-[11px] font-semibold text-[#FAF7F2] transition-colors"
              data-user-action="view"
              data-user-id="${e.id}"
            >
              Perfil
            </button>
            <button 
              class="px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors ${t?`bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-300`:`bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-300`}"
              data-user-action="toggle-status"
              data-user-id="${e.id}"
              data-current-status="${e.status}"
            >
              ${t?`Reactivar`:`Suspender`}
            </button>
            ${e.role===`superadmin`?``:`
            <button 
              class="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-[11px] font-semibold text-rose-300 transition-colors"
              data-user-action="delete"
              data-user-id="${e.id}"
              data-user-email="${e.email}"
              title="Eliminar usuario permanentemente"
            >
              Eliminar
            </button>
            `}
          </div>
        </td>
      </tr>
    `}).join(``),u.querySelectorAll(`[data-user-action="view"]`).forEach(e=>{e.addEventListener(`click`,()=>{let t=e.dataset.userId;t&&Q(t)})}),u.querySelectorAll(`[data-user-action="delete"]`).forEach(e=>{e.addEventListener(`click`,async()=>{let t=e.dataset.userId,n=e.dataset.userEmail;if(t&&confirm(`¿Eliminar permanentemente la cuenta de "${n}"? Esta acción no se puede deshacer.`)){let e=await o.deleteUser(t);e.success?(c(e.message||`Usuario eliminado permanentemente`,`success`),q(),K()):c(e.message||`Error al eliminar usuario`,`error`)}})}),u.querySelectorAll(`[data-user-action="toggle-status"]`).forEach(e=>{e.addEventListener(`click`,async()=>{let t=e.dataset.userId,n=e.dataset.currentStatus;if(!t)return;let r=n===`active`?`suspended`:`active`,i;if(r===`suspended`){let e=prompt(`Indica el motivo de la suspensión de la cuenta (opcional):`);if(e===null)return;i=e.trim()||`Suspensión administrativa`}let a=await o.setUserStatus(t,r,i);a.success?(c(a.message||`Estado actualizado`,`success`),q()):c(a.message||`Error al actualizar estado`,`error`)})})))}async function J(){let e=await o.getMusicData(),t=document.getElementById(`admin-custom-tracks-list`),n=document.getElementById(`admin-music-reports-list`);t&&(e.customTracks.length===0?t.innerHTML=`
        <div class="col-span-full py-8 text-center text-xs text-[#8A8074]">
          No hay pistas curadas personalizadas en la base de datos.
        </div>
      `:(t.innerHTML=e.customTracks.map(e=>`
        <div class="p-3.5 rounded-2xl bg-[#1A1816] border border-[#2D2823] flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <img src="${e.artwork}" class="w-12 h-12 rounded-xl object-cover shrink-0 bg-[#25201B]" onerror="this.src='/assets/default-cover.svg'" />
            <div class="min-w-0">
              <h5 class="text-xs font-bold text-[#FAF7F2] truncate">${e.title}</h5>
              <p class="text-[11px] text-[#BDB5AA] truncate">${e.artist} • ${e.genre}</p>
              <span class="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono mt-1 ${e.is_promoted?`bg-amber-500/20 text-amber-300`:`bg-[#25201B] text-[#8A8074]`}">
                ${e.is_promoted?`Promocionada`:`Normal`}
              </span>
            </div>
          </div>
          <button 
            class="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-colors shrink-0"
            data-delete-custom-track="${e.id}"
            title="Eliminar de la plataforma"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      `).join(``),t.querySelectorAll(`[data-delete-custom-track]`).forEach(e=>{e.addEventListener(`click`,async()=>{let t=e.dataset.deleteCustomTrack;t&&confirm(`¿Eliminar esta pista curada del catálogo?`)&&await o.deleteCustomTrack(t)&&(c(`Pista curada eliminada`,`success`),J())})}))),n&&(e.reports.length===0?n.innerHTML=`<p class="text-xs text-[#8A8074] italic">No hay denuncias de canciones pendientes.</p>`:(n.innerHTML=e.reports.map(e=>`
        <div class="p-3 rounded-xl bg-[#201D1A] border border-[#2D2823] flex items-center justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-[#FAF7F2]">${e.target_title}</span>
              <span class="px-2 py-0.5 rounded text-[9px] font-mono ${e.status===`resolved`?`bg-emerald-500/20 text-emerald-300`:`bg-amber-500/20 text-amber-300`}">
                ${e.status.toUpperCase()}
              </span>
            </div>
            <p class="text-[11px] text-[#BDB5AA] mt-0.5">Denunciado por: ${e.reporter_name} • Razón: ${e.reason}</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button 
              class="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold"
              data-resolve-report="${e.id}"
            >
              Resolver
            </button>
            <button 
              class="px-2.5 py-1 rounded-lg bg-[#25201B] hover:bg-[#302A24] text-[#8A8074] border border-[#3D352D] text-[11px]"
              data-dismiss-report="${e.id}"
            >
              Descartar
            </button>
          </div>
        </div>
      `).join(``),n.querySelectorAll(`[data-resolve-report]`).forEach(e=>{e.addEventListener(`click`,async()=>{let t=e.dataset.resolveReport;t&&(await o.updateReport(t,`resolved`),c(`Reporte resuelto`,`success`),J())})}),n.querySelectorAll(`[data-dismiss-report]`).forEach(e=>{e.addEventListener(`click`,async()=>{let t=e.dataset.dismissReport;t&&(await o.updateReport(t,`dismissed`),c(`Reporte descartado`,`info`),J())})})))}async function Y(){let e=await o.getAllAds(),t=document.getElementById(`admin-ads-list`);t&&(e.length===0?t.innerHTML=`
      <div class="col-span-full py-12 text-center text-[#8A8074]">
        <p class="text-sm font-semibold text-[#D5CBC0]">No hay anuncios promocionales configurados</p>
        <p class="text-xs text-[#8A8074] mt-1">Crea anuncios con imágenes o vídeos para Inicio o Pre-roll.</p>
      </div>
    `:(t.innerHTML=e.map((e,t)=>{let n=e.placement===`pre_roll_audio`;return`
      <div class="p-4 sm:p-5 rounded-2xl bg-[#1A1816] border border-[#2D2823] space-y-4 shadow-lg flex flex-col justify-between">
        <div>
          <!-- Header Tag Line -->
          <div class="flex items-center justify-between gap-2 pb-2 border-b border-[#26221D]">
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Anuncio 1 • 1
              </span>
              <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${n?`bg-amber-500/20 text-amber-300 border-amber-500/40`:`bg-cyan-500/20 text-cyan-300 border-cyan-500/40`}">
                ${n?`Pre-roll Audio`:`Banner Inicio`}
              </span>
            </div>
            <span class="text-xs font-mono font-bold ${e.active?`text-emerald-400`:`text-[#8A8074]`}">
              ${e.active?`● ACTIVO`:`○ INACTIVO`}
            </span>
          </div>

          <!-- Media Preview & Info -->
          <div class="flex items-start gap-4 mt-3">
            <div class="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden shrink-0 bg-[#0E0D0C] border border-[#332D27] flex items-center justify-center">
              ${e.media_type===`video`?`<video src="${e.media_url}" class="w-full h-full object-cover" controls playsinline muted></video>`:`<img src="${e.media_url}" class="w-full h-full object-cover" onerror="this.src='/assets/default-cover.svg'" />`}
            </div>

            <div class="min-w-0 flex-1 space-y-1">
              <h4 class="text-sm font-bold text-[#FAF7F2] truncate">${e.title}</h4>
              <p class="text-xs text-[#BDB5AA] line-clamp-2">${e.description||`Sin descripción`}</p>
              
              <div class="flex flex-wrap items-center gap-2 pt-1 text-[10px] font-mono text-[#8A8074]">
                <span>${e.duration}s total</span>
                ${e.can_skip?`<span>Saltar tras ${e.skip_after}s</span>`:`<span>No saltable</span>`}
                <span>Orden #${e.order}</span>
              </div>
            </div>
          </div>

          <!-- Real Metrics Card -->
          <div class="grid grid-cols-2 gap-2 mt-4 p-2.5 rounded-xl bg-[#201D1A] border border-[#2D2823]">
            <div class="text-center">
              <p class="text-[9px] font-mono uppercase text-[#8A8074]">Vistas Reales</p>
              <p class="text-base font-extrabold text-[#FAF7F2] font-mono">${e.views||0}</p>
            </div>
            <div class="text-center">
              <p class="text-[9px] font-mono uppercase text-[#8A8074]">Clics Reales</p>
              <p class="text-base font-extrabold text-amber-400 font-mono">${e.clicks||0}</p>
            </div>
          </div>
        </div>

        <!-- Action Controls -->
        <div class="pt-3 border-t border-[#26221D] flex items-center justify-between">
          <button 
            class="px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${e.active?`bg-[#25201B] hover:bg-[#302A24] text-[#BDB5AA] border-[#3D352D]`:`bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30 font-bold`}"
            data-toggle-ad="${e.id}"
            data-current-active="${e.active}"
          >
            ${e.active?`Pausar Anuncio`:`Activar Anuncio`}
          </button>

          <button 
            class="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-colors"
            data-delete-ad="${e.id}"
          >
            Eliminar
          </button>
        </div>
      </div>
    `}).join(``),t.querySelectorAll(`[data-toggle-ad]`).forEach(e=>{e.addEventListener(`click`,async()=>{let t=e.dataset.toggleAd,n=e.dataset.currentActive===`true`;t&&await o.updateAd(t,{active:!n})&&(c(n?`Anuncio pausado`:`Anuncio activado`,`success`),Y())})}),t.querySelectorAll(`[data-delete-ad]`).forEach(e=>{e.addEventListener(`click`,async()=>{let t=e.dataset.deleteAd;t&&confirm(`¿Estás seguro de que deseas eliminar permanentemente este anuncio?`)&&await o.deleteAd(t)&&(c(`Anuncio eliminado`,`success`),Y())})})))}async function ee(){let{logs:e,failedCount:t}=await o.getSecurityLogs(100),n=document.getElementById(`admin-security-total`),r=document.getElementById(`admin-security-failed`),i=document.getElementById(`admin-security-blocked`),a=document.getElementById(`admin-security-tbody`);n&&(n.textContent=String(e.length)),r&&(r.textContent=String(t)),i&&(i.textContent=String(e.filter(e=>e.event===`blocked_attempt`).length)),a&&(a.innerHTML=e.length===0?`<tr><td colspan="6" class="py-6 text-center text-xs text-[#8A8074]">Sin registros de seguridad aún.</td></tr>`:e.map(e=>`
      <tr class="border-b border-[#2D2823] hover:bg-[#201D1A]/50 transition-colors">
        <td class="py-2.5 px-3 text-xs">
          <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${e.event===`login_failed`||e.event===`blocked_attempt`||e.event===`suspicious`?`bg-rose-500/20 text-rose-300 border-rose-500/40`:`bg-emerald-500/20 text-emerald-300 border-emerald-500/40`}">
            ${e.event}
          </span>
        </td>
        <td class="py-2.5 px-3 text-xs font-mono text-[#FAF7F2] truncate">${e.email}</td>
        <td class="py-2.5 px-3 text-xs font-mono text-amber-400">${e.ip}</td>
        <td class="py-2.5 px-3 text-[11px] text-[#BDB5AA] max-w-xs truncate" title="${e.user_agent}">${e.user_agent}</td>
        <td class="py-2.5 px-3 text-xs text-[#D5CBC0]">${e.details||`Normal`}</td>
        <td class="py-2.5 px-3 text-xs font-mono text-[#8A8074]">${new Date(e.timestamp).toLocaleString()}</td>
      </tr>
    `).join(``))}async function X(){let e=await o.getNotifications(),t=document.getElementById(`admin-notifications-list`);t&&(e.length===0?t.innerHTML=`<p class="text-xs text-[#8A8074] italic">Sin avisos activos en la plataforma.</p>`:(t.innerHTML=e.map(e=>`
    <div class="p-4 rounded-2xl bg-[#1A1816] border border-[#2D2823] flex items-center justify-between gap-4">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <h4 class="text-sm font-bold text-[#FAF7F2]">${e.title}</h4>
          <span class="px-2 py-0.5 rounded text-[9px] font-mono uppercase ${e.type===`warning`?`bg-rose-500/20 text-rose-300`:`bg-amber-500/20 text-amber-300`}">
            ${e.type}
          </span>
          <span class="text-[10px] font-mono ${e.active?`text-emerald-400 font-bold`:`text-[#8A8074]`}">
            ${e.active?`Activo`:`Oculto`}
          </span>
        </div>
        <p class="text-xs text-[#BDB5AA] mt-1">${e.message}</p>
        <span class="text-[10px] font-mono text-[#8A8074] mt-1 inline-block">Publicado: ${new Date(e.created_at).toLocaleString()}</span>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <button 
          class="px-2.5 py-1 rounded-xl bg-[#201D1A] border border-[#332D27] text-xs font-semibold text-[#FAF7F2]"
          data-toggle-notif="${e.id}"
        >
          ${e.active?`Desactivar`:`Activar`}
        </button>
        <button 
          class="px-2.5 py-1 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold"
          data-delete-notif="${e.id}"
        >
          Eliminar
        </button>
      </div>
    </div>
  `).join(``),t.querySelectorAll(`[data-toggle-notif]`).forEach(e=>{e.addEventListener(`click`,async()=>{let t=e.dataset.toggleNotif;t&&(await o.toggleNotification(t),X())})}),t.querySelectorAll(`[data-delete-notif]`).forEach(e=>{e.addEventListener(`click`,async()=>{let t=e.dataset.deleteNotif;t&&confirm(`¿Eliminar este aviso de forma permanente?`)&&(await o.deleteNotification(t),X())})})))}async function Z(){let e=await o.getReports(),t=document.getElementById(`admin-reports-list`);t&&(e.length===0?t.innerHTML=`<p class="text-xs text-[#8A8074] italic">No hay denuncias pendientes de revisión.</p>`:(t.innerHTML=e.map(e=>`
    <div class="p-4 rounded-2xl bg-[#1A1816] border border-[#2D2823] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500/20 text-amber-300">
            ${e.reported_type.toUpperCase()}
          </span>
          <h4 class="text-sm font-bold text-[#FAF7F2]">${e.target_title}</h4>
          <span class="px-2 py-0.5 rounded text-[10px] font-mono ${e.status===`pending`?`bg-amber-500/20 text-amber-300`:`bg-emerald-500/20 text-emerald-300`}">
            ${e.status}
          </span>
        </div>
        <p class="text-xs text-[#D5CBC0] mt-1"><span class="text-[#8A8074]">Motivo:</span> ${e.reason}</p>
        <p class="text-[10px] font-mono text-[#8A8074] mt-0.5">Enviado por: ${e.reporter_name} (${new Date(e.created_at).toLocaleString()})</p>
      </div>

      <div class="flex items-center gap-2 self-start sm:self-auto shrink-0">
        ${e.status===`pending`?`
          <button 
            class="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold"
            data-report-action="resolve"
            data-report-id="${e.id}"
          >
            Resolver
          </button>
          <button 
            class="px-3 py-1.5 rounded-xl bg-[#25201B] hover:bg-[#302A24] border border-[#3D352D] text-[#8A8074] text-xs"
            data-report-action="dismiss"
            data-report-id="${e.id}"
          >
            Descartar
          </button>
        `:`
          <span class="text-xs font-mono text-[#8A8074]">Atendido</span>
        `}
      </div>
    </div>
  `).join(``),t.querySelectorAll(`[data-report-action]`).forEach(e=>{e.addEventListener(`click`,async()=>{let t=e.dataset.reportAction,n=e.dataset.reportId;n&&(await o.updateReport(n,t===`resolve`?`resolved`:`dismissed`),c(t===`resolve`?`Denuncia resuelta`:`Denuncia descartada`,`info`),Z())})})))}async function te(){let e=await o.getSettings();if(!e)return;let t=document.getElementById(`settings-platform-name`),n=document.getElementById(`settings-logo-url`),r=document.getElementById(`settings-welcome-text`),i=document.getElementById(`settings-info-text`),a=document.getElementById(`settings-legal-text`),s=document.getElementById(`settings-maintenance-mode`);t&&(t.value=e.platform_name||``),n&&(n.value=e.logo_url||``),r&&(r.value=e.welcome_text||``),i&&(i.value=e.info_text||``),a&&(a.value=e.legal_text||``),s&&(s.checked=!!e.maintenance_mode);let l=document.getElementById(`form-admin-settings`);l&&(l.onsubmit=async e=>{e.preventDefault(),await o.updateSettings({platform_name:t?.value,logo_url:n?.value,welcome_text:r?.value,info_text:i?.value,legal_text:a?.value,maintenance_mode:s?.checked})?(c(`Configuración de la plataforma guardada correctamente`,`success`),v()):c(`Error al guardar configuración`,`error`)})}async function ne(){let e=await o.getSystemStatus();if(!e)return;let t=document.getElementById(`sys-node-version`),n=document.getElementById(`sys-uptime`),r=document.getElementById(`sys-memory-rss`),i=document.getElementById(`sys-memory-heap`),a=document.getElementById(`sys-errors-list`);if(t&&(t.textContent=e.node_version),n){let t=Math.floor(e.uptime_seconds/60);n.textContent=`${Math.floor(t/60)}h ${t%60}m`}r&&(r.textContent=`${e.memory_rss_mb} MB`),i&&(i.textContent=`${e.memory_heap_mb} MB`),a&&(a.innerHTML=!e.errors||e.errors.length===0?`<p class="text-xs text-emerald-400 font-mono">0 errores críticos registrados en el sistema.</p>`:e.errors.map(e=>`
        <div class="p-2.5 rounded-xl bg-[#201D1A] border border-rose-500/30 text-xs space-y-1">
          <div class="flex items-center justify-between text-[10px] font-mono">
            <span class="text-rose-400 font-bold">${e.source}</span>
            <span class="text-[#8A8074]">${new Date(e.timestamp).toLocaleTimeString()}</span>
          </div>
          <p class="text-[#FAF7F2] font-mono text-[11px]">${e.message}</p>
        </div>
      `).join(``));let s=document.getElementById(`btn-admin-export-backup`);s&&(s.onclick=async()=>{try{await o.downloadBackup(),c(`Copia de seguridad descargada con éxito`,`success`)}catch{c(`Error al descargar copia de seguridad`,`error`)}});let l=document.getElementById(`input-admin-restore-file`);l&&(l.onchange=async e=>{let t=e.target.files?.[0];if(t){if(!confirm(`¿Restaurar la base de datos completa desde "${t.name}"? Esta acción reemplazará los datos actuales.`))l.value=``;else try{let e=await t.text(),n=JSON.parse(e),r=await o.restoreBackup(n);r.success?(c(`Base de datos restaurada correctamente. Recargando...`,`success`),setTimeout(()=>window.location.reload(),1500)):c(r.message||`Error al restaurar respaldo`,`error`)}catch{c(`Archivo JSON no válido o dañado`,`error`)}finally{l.value=``}}})}async function Q(e){let t=await o.getUserDetail(e);if(!t||!t.user){c(`Usuario no encontrado`,`error`);return}let n=t.user,r=document.getElementById(`modal-admin-user-detail`),i=document.getElementById(`user-detail-avatar`),a=document.getElementById(`user-detail-name`),s=document.getElementById(`user-detail-email`),l=document.getElementById(`user-detail-status-text`),u=document.getElementById(`user-detail-role-text`),d=document.getElementById(`user-detail-playlists-count`),f=document.getElementById(`user-detail-suspension-box`),p=document.getElementById(`user-detail-suspension-reason`),m=document.getElementById(`user-detail-history-list`),h=document.getElementById(`btn-user-detail-toggle-status`),g=document.getElementById(`user-detail-suspend-reason-input`),_=document.getElementById(`user-detail-role-select`),v=document.getElementById(`btn-user-detail-save-role`);if(i&&(i.textContent=w(n.name)),a&&(a.textContent=n.name),s&&(s.textContent=n.email),l&&(l.textContent=n.status===`suspended`?`Suspendido`:`Activo`,l.className=n.status===`suspended`?`text-xs font-bold text-rose-400 mt-0.5`:`text-xs font-bold text-emerald-400 mt-0.5`),u&&(u.textContent=n.role.toUpperCase()),d&&(d.textContent=String(t.playlists?.length||0)),f&&p&&(n.status===`suspended`&&n.suspension_reason?(p.textContent=n.suspension_reason,f.classList.remove(`hidden`)):f.classList.add(`hidden`)),m&&(m.innerHTML=!t.history||t.history.length===0?`<p class="text-xs text-[#8A8074] italic">Sin reproducciones registradas.</p>`:t.history.slice(0,10).map(e=>`
        <div class="flex items-center justify-between p-2 rounded-lg bg-[#201D1A] text-xs">
          <span class="text-[#FAF7F2] truncate">${e.track?.title||`Canción`}</span>
          <span class="text-[#8A8074] font-mono text-[10px] shrink-0 ml-2">${new Date(e.played_at).toLocaleDateString()}</span>
        </div>
      `).join(``)),h){let e=n.status===`suspended`;h.textContent=e?`Reactivar Cuenta`:`Suspender Cuenta`,h.className=e?`px-3.5 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 font-bold text-xs transition-colors shrink-0`:`px-3.5 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 font-bold text-xs transition-colors shrink-0`,h.onclick=async()=>{let t=e?`active`:`suspended`,r=g?g.value.trim():``,i=await o.setUserStatus(n.id,t,r);i.success?(c(i.message||`Estado modificado`,`success`),Q(n.id),q()):c(i.message||`Error al cambiar estado`,`error`)}}_&&(_.value=n.role),v&&(v.onclick=async()=>{let e=_?.value;if(e){let t=await o.setRole(n.id,e);t.success?(c(t.message||`Rol modificado`,`success`),Q(n.id),q()):c(t.message||`Error al cambiar rol`,`error`)}}),r&&r.classList.remove(`hidden`)}function re(){let e=document.getElementById(`modal-admin-user-detail`),t=document.getElementById(`modal-user-detail-close`);t&&e&&(t.onclick=()=>e.classList.add(`hidden`));let n=document.getElementById(`modal-admin-create-ad`),r=document.getElementById(`btn-open-create-ad`),i=document.getElementById(`modal-ad-close`),a=document.getElementById(`form-admin-create-ad`),s=document.getElementById(`ad-input-file`),l=document.getElementById(`ad-input-media-url`),u=document.getElementById(`ad-media-preview-box`),d=document.getElementById(`ad-preview-img`),f=document.getElementById(`ad-preview-video`);r&&n&&(r.onclick=()=>{p=``,u&&u.classList.add(`hidden`),a&&a.reset(),n.classList.remove(`hidden`)}),i&&n&&(i.onclick=()=>n.classList.add(`hidden`)),s&&(s.onchange=()=>{let e=s.files?.[0];if(e){let t=new FileReader;t.onload=t=>{p=t.target?.result,u&&u.classList.remove(`hidden`),e.type.startsWith(`video`)&&f&&d?(d.classList.add(`hidden`),f.classList.remove(`hidden`),f.src=p):d&&f&&(f.classList.add(`hidden`),d.classList.remove(`hidden`),d.src=p)},t.readAsDataURL(e)}}),l&&(l.oninput=()=>{let e=l.value.trim();e&&(p=e,u&&u.classList.remove(`hidden`),e.match(/\.(mp4|webm)$/i)&&f&&d?(d.classList.add(`hidden`),f.classList.remove(`hidden`),f.src=e):d&&f&&(f.classList.add(`hidden`),d.classList.remove(`hidden`),d.src=e))}),a&&(a.onsubmit=async e=>{e.preventDefault();let t=document.getElementById(`ad-input-title`).value,r=document.getElementById(`ad-input-desc`).value,i=document.getElementById(`ad-input-placement`).value,s=document.getElementById(`ad-input-media-type`).value,u=parseInt(document.getElementById(`ad-input-duration`).value)||8,d=parseInt(document.getElementById(`ad-input-skip-after`).value)||3,f=parseInt(document.getElementById(`ad-input-order`).value)||1,m=document.getElementById(`ad-input-target-url`).value,h=document.getElementById(`ad-input-start-date`).value,g=document.getElementById(`ad-input-end-date`).value,_=document.getElementById(`ad-input-can-skip`).checked,v=document.getElementById(`ad-input-active`).checked,y=p||l?.value.trim();if(!y){c(`Selecciona un archivo multimedia o escribe una URL válida`,`error`);return}let b=await o.createAd({title:t,description:r,media_url:y,media_type:s,placement:i,duration:u,can_skip:_,skip_after:d,order:f,target_url:m,start_date:h||void 0,end_date:g||void 0,active:v});b.success?(c(`Anuncio global creado exitosamente`,`success`),n&&n.classList.add(`hidden`),a.reset(),p=``,Y()):c(b.message||`Error al guardar anuncio`,`error`)});let m=document.getElementById(`modal-admin-create-song`),h=document.getElementById(`btn-open-create-song`),g=document.getElementById(`modal-create-song-close`),_=document.getElementById(`form-admin-create-song`);h&&m&&(h.onclick=()=>m.classList.remove(`hidden`)),g&&m&&(g.onclick=()=>m.classList.add(`hidden`)),_&&(_.onsubmit=async e=>{e.preventDefault();let t=document.getElementById(`song-input-title`).value,n=document.getElementById(`song-input-artist`).value,r=document.getElementById(`song-input-album`).value,i=document.getElementById(`song-input-genre`).value,a=document.getElementById(`song-input-stream`).value,s=document.getElementById(`song-input-cover`).value,l=parseInt(document.getElementById(`song-input-duration`).value)||180,u=document.getElementById(`song-input-promoted`).checked,d=await o.createCustomTrack({title:t,artist:n,album:r,genre:i,stream_url:a,artwork:s||`/assets/default-cover.svg`,duration:l,is_promoted:u});d.success?(c(`Canción curada añadida al catálogo`,`success`),m&&m.classList.add(`hidden`),_.reset(),J()):c(d.message||`Error al añadir canción`,`error`)});let v=document.getElementById(`modal-admin-create-notif`),y=document.getElementById(`btn-open-create-notif`),b=document.getElementById(`modal-create-notif-close`),x=document.getElementById(`form-admin-create-notif`);y&&v&&(y.onclick=()=>v.classList.remove(`hidden`)),b&&v&&(b.onclick=()=>v.classList.add(`hidden`)),x&&(x.onsubmit=async e=>{e.preventDefault();let t=document.getElementById(`notif-input-title`).value,n=document.getElementById(`notif-input-msg`).value,r=document.getElementById(`notif-input-type`).value,i=document.getElementById(`notif-input-expires`).value;await o.createNotification({title:t,message:n,type:r,expires_at:i||void 0})?(c(`Aviso general publicado para todos los usuarios`,`success`),v&&v.classList.add(`hidden`),x.reset(),X()):c(`Error al publicar aviso`,`error`)});let S=document.getElementById(`admin-users-search`),C=document.getElementById(`admin-users-role-filter`),w=document.getElementById(`admin-users-status-filter`);S&&S.addEventListener(`input`,()=>q()),C&&C.addEventListener(`change`,()=>q()),w&&w.addEventListener(`change`,()=>q())}function ie(e){let t=e.currentTrack,n=document.getElementById(`player-play-icon`),a=document.getElementById(`player-vinyl-disc`),o=document.getElementById(`player-cover-img`),s=document.getElementById(`player-title`),c=document.getElementById(`player-artist`),l=document.getElementById(`player-current-time`),u=document.getElementById(`player-total-time`),d=document.getElementById(`player-progress`),f=document.getElementById(`player-shuffle`),p=document.getElementById(`player-repeat`),m=document.getElementById(`player-heart`),h=document.getElementById(`player-error-banner`),g=document.getElementById(`player-error-text`);if(t&&(s&&(s.textContent=t.title),c&&(c.textContent=t.artist),o&&(o.src=t.artwork),m&&ae(m,r.isFavorite(t.id))),n&&(n.innerHTML=e.isPlaying?`
        <svg width="18" height="18" class="w-4 h-4 sm:w-5 sm:h-5 fill-current" viewBox="0 0 24 24">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
        </svg>
      `:`
        <svg width="18" height="18" class="w-4 h-4 sm:w-5 sm:h-5 ml-0.5 fill-current" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      `),a&&(e.isPlaying?a.classList.remove(`spin-paused`):a.classList.add(`spin-paused`)),l&&(l.textContent=i.formatTime(e.currentTime)),u&&(u.textContent=i.formatTime(e.duration)),d){if(e.duration>0){let t=e.currentTime/e.duration*100;d.value=String(t),d.style.background=`linear-gradient(to right, #F59E0B ${t}%, #2E2924 ${t}%)`}else d.value=`0`,d.style.background=`#2E2924`}let _=document.getElementById(`player-mobile-progress-fill`);if(_){if(e.duration>0){let t=e.currentTime/e.duration*100;_.style.width=`${t}%`}else _.style.width=`0%`}f&&(e.isShuffle?(f.classList.add(`text-amber-400`),f.classList.remove(`text-[#8A8074]`)):(f.classList.remove(`text-amber-400`),f.classList.add(`text-[#8A8074]`))),p&&(e.repeatMode===`off`?(p.classList.remove(`text-amber-400`),p.classList.add(`text-[#8A8074]`),p.title=`Repetir desactivado`):(p.classList.add(`text-amber-400`),p.classList.remove(`text-[#8A8074]`),p.title=`Repetir: ${e.repeatMode===`one`?`Una pista`:`Todas`}`)),h&&g&&(e.hasError&&e.errorMessage?(g.textContent=e.errorMessage,h.classList.remove(`hidden`)):h.classList.add(`hidden`))}function ae(e,t){let n=e.querySelector(`svg`);n&&(t?(e.classList.add(`text-rose-500`),e.classList.remove(`text-slate-400`),n.classList.add(`fill-current`),n.classList.remove(`fill-none`)):(e.classList.remove(`text-rose-500`),e.classList.add(`text-slate-400`),n.classList.remove(`fill-current`),n.classList.add(`fill-none`)))}function $(e=8){return Array.from({length:e}).map(()=>`
    <div class="bg-[#181614] border border-[#2D2823] rounded-xl p-3 flex flex-col justify-between animate-pulse">
      <div class="aspect-square w-full rounded-lg bg-[#24201C] mb-3"></div>
      <div class="h-4 bg-[#28231E] rounded w-3/4 mb-2"></div>
      <div class="h-3 bg-[#24201C] rounded w-1/2 mb-3"></div>
      <div class="pt-2 border-t border-[#26221D] flex items-center justify-between">
        <div class="h-3 bg-[#24201C] rounded w-10"></div>
        <div class="h-3 bg-[#24201C] rounded w-6"></div>
      </div>
    </div>
  `).join(``)}
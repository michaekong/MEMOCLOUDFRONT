// --- Config ---
// --- Config ---
const BASE_URL = 'https://mcb.reimca-app.com/api';
const UNIV_SLUG = 'ecole-des-travaux';

// ⚡ on déclare les variables avant tout
let TOKEN             = localStorage.getItem('authToken');
let CURRENT_USER_ID   = null;
let CURRENT_USER_NAME = localStorage.getItem('userName') || 'Moi'; // let, pas const

// --- State ---
let memoiresData = [];
let currentPage  = 1;
let isCompactView = false;

let filters = {
    search: '',
    year: '',
    domain: '',
    sort: '-created_at',
    rating: '',
    university: '',
    hasResume: false,
    isPopular: false,
    isCommented: false
};

// --- Elements ---
const grid                   = document.getElementById('memoires-grid');
const loader                 = document.getElementById('loader');
const emptyState             = document.getElementById('empty-state');
const paginationContainer    = document.getElementById('pagination-container');
const heroStatsContainer     = document.getElementById('hero-stats');

// ----------  Petit helper  ----------
function getHeaders() {
    const h = { 'Content-Type': 'application/json' };
    if (TOKEN) h['Authorization'] = `Bearer ${TOKEN}`;
    return h;
}

// ----------  Récupération user connecté (version DEBUG)  ----------
async function loadCurrentUser() {
    if (!TOKEN) {
        console.info('[AUTH] Pas de token en mémoire → on ignore.');
        return;
    }

    console.log('[AUTH] Token trouvé :', TOKEN);
    console.log('[AUTH] Headers envoyés :', getHeaders());

    try {
        const url = `${BASE_URL}/auth/me/`;
        console.log('[AUTH] Appel à :', url);

        const res = await fetch(url, { headers: getHeaders() });

        console.log('[AUTH] Status :', res.status, res.statusText);

        // on récupère le corps même en cas d’erreur
        const data = await res.json().catch(() => ({ detail: 'Pas de JSON' }));
        console.log('[AUTH] Réponse brute :', data);

        if (!res.ok) {
            // on affiche le vrai message du serveur
            throw new Error(data.detail || `Erreur ${res.status}`);
        }
  
        // succès
        localStorage.setItem('userId', data.id);
        localStorage.setItem('userName', data.nom || data.username || 'Moi');
        CURRENT_USER_ID   = data.id;
        CURRENT_USER_NAME = data.nom || data.username || 'Moi';
        console.log('[AUTH] User connecté :', CURRENT_USER_NAME, '(id:', CURRENT_USER_ID, ')');
       

    } catch (e) {
        console.warn('[AUTH] ❌ Erreur réseau ou token invalide :', e.message);
        localStorage.removeItem('authToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('userName');
        TOKEN = null;
    }
}

// ----------  Init  ----------
document.addEventListener('DOMContentLoaded', async () => {
    await loadCurrentUser();          // 1. charge / met à jour TOKEN & CURRENT_USER_*
    initIcons();
    initSlideshow();
    await loadInitialData();          // 2. dépend de TOKEN & CURRENT_USER_*
    setupListeners();
    document.getElementById('footer-year').textContent = new Date().getFullYear();

    // 3. boutons auth (utilise TOKEN à jour)
    const setupAuthBtn = (id) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        if (TOKEN) {
            btn.innerHTML = '<i data-lucide="log-out" class="w-4 h-4"></i> Déconnexion';
            btn.onclick = () => { localStorage.clear(); location.reload(); };
        } else {
            btn.onclick = () => (location.href = 'register.html');
        }
    };
    setupAuthBtn('login-btn');
    setupAuthBtn('mobile-login-btn');
});

// ----------  Icones  ----------
function initIcons() {
    if (window.lucide) window.lucide.createIcons();
}

// ----------  Slideshow  ----------
function initSlideshow() {
    const slides = document.querySelectorAll('.slide');
    if (!slides.length) return;
    let current = 0;
    setInterval(() => {
        slides[current].style.opacity = 0;
        slides[current].style.transform = 'scale(1)';
        current = (current + 1) % slides.length;
        slides[current].style.opacity = 0.6;
        slides[current].style.transform = 'scale(1.05)';
    }, 6000);
}

function getFullUrl(path) {
    if (!path) return 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=800&q=80';
    if (path.startsWith('http')) return path;
    return `https://mcb.reimca-app.com${path}`;
}

// --- Data Loading ---
async function loadInitialData() {
    await Promise.all([
        loadStats(),
        loadFiltersData(),
        fetchMemoires(true)
    ]);
}

/* ----------------------------------------------------------
   1.  CACHE GLOBAL (indexation poussée)
---------------------------------------------------------- */
let FULL_LIST   = [];
let CACHE_BUILD = false;

/* ----------------------------------------------------------
   2.  FETCH + FILTRAGE (client, ultra-rapide)
---------------------------------------------------------- */
async function fetchMemoires(reset = false) {
    if (reset) {
        currentPage = 1;
        memoiresData = [];
        grid.innerHTML = '';
        emptyState.classList.add('hidden');
    }
    loader.classList.remove('hidden');
    paginationContainer.classList.add('hidden');

    /* ---- 1ère fois : on charge TOUT ---- */
    if (!CACHE_BUILD) {
        let page = 1, hasNext = true;
        while (hasNext) {
            try {
                const res = await fetch(
                    `${BASE_URL}/memoires/universites/${UNIV_SLUG}/memoires/?page=${page}&ordering=${filters.sort}`,
                    { headers: getHeaders() }
                );
                const data = await res.json();
                const batch = Array.isArray(data) ? data : (data.results || []);
                FULL_LIST = FULL_LIST.concat(batch);
                hasNext = !!data.next;
                page++;
            } catch (e) {
                hasNext = false;
            }
        }
        /* INDEXATION AUTEUR / ENCADREUR ultra complète */
        FULL_LIST = FULL_LIST.map(m => ({
            ...m,
            _search: [
                m.titre,
                m.resume,
                m.annee,
                m.langue,
                m.nombre_pages,
                ...(m.domaines_list || []),
                /* AUTEURS : nom, prénom, email, linkedin */
                ...(m.auteur
        ? [
                    m.auteur.nom,
                    m.auteur.prenom || '',
                    m.auteur.email || '',
                    m.auteur.linkedin || '',
                ]
                : []),
                /* ENCADREURS */
                ...(m.encadreurs || []).flatMap(e => [
                    e.nom,
                    e.email || '',
                    e.linkedin || '',
                ]),
            ]
                .join(' ')
                .normalize('NFD')
                .replace(/\p{Diacritic}/gu, '')
                .toLowerCase(),
            _isENSTP:
                !m.universites_list ||
                m.universites_list.length === 0 ||
                m.universites_list.some(u =>
                    u.toLowerCase().includes('ecole des travaux')
                ),
        }));
        CACHE_BUILD = true;
    }

    /* ---- filtres ---- */
    let filtered = FULL_LIST;

    /* recherche full-text (split par mot) */
    if (filters.search.trim()) {
        const needles = filters.search
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .toLowerCase()
            .split(/\s+/)
            .filter(Boolean);
        filtered = filtered.filter(m =>
            needles.every(n => m._search.includes(n))
        );
    }

    /* filtres rapides */
    if (filters.year)        filtered = filtered.filter(m => String(m.annee) === filters.year);
    if (filters.domain)      filtered = filtered.filter(m => (m.domaines_list || []).includes(filters.domain));
    if (filters.rating)      filtered = filtered.filter(m => (m.note_moyenne || 0) >= +filters.rating);
    if (filters.university === 'ENSTP') filtered = filtered.filter(m => m._isENSTP);
    if (filters.university === 'Autre') filtered = filtered.filter(m => !m._isENSTP);
    if (filters.hasResume)   filtered = filtered.filter(m => m.resume && m.resume.length > 50);
    if (filters.isPopular)   filtered = filtered.filter(m => m.nb_telechargements >= 10);
    if (filters.isCommented) filtered = filtered.filter(m => m.nb_commentaires >= 5);

    /* ---- pagination client ---- */
    const start = (currentPage - 1) * 12;
    const end   = start + 12;
    const pageResults = filtered.slice(start, end);

    memoiresData = reset ? filtered : [...memoiresData, ...pageResults];
    renderGrid(pageResults);

    if (end < filtered.length) paginationContainer.classList.remove('hidden');
    else paginationContainer.classList.add('hidden');
    if (filtered.length === 0) emptyState.classList.remove('hidden');

    loader.classList.add('hidden');
}

/* ----------------------------------------------------------
   3.  DEBOUNCE 200 ms
---------------------------------------------------------- */
let debounceTimer;
function debounceLoad() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fetchMemoires(true), 200);
}
async function loadStats() {
    try {
        const res = await fetch(`${BASE_URL}/memoires/universites/${UNIV_SLUG}/stats/`);
        const stats = await res.json();
        console.log("Stats loaded:", stats);
        
        const items = [
       
            { l: 'Memoires', v: stats.total_memoires || 0, i: 'book' },
            { l: 'Téléchargements', v: stats.total_telechargements || 0, i: 'download' },
            { l: 'Likes', v: stats.total_likes || 0, i: 'heart' },
            { l: 'Note Moyenne', v: stats.note_moyenne || 0, i: 'star', gold: true, isFloat: true }
        ];

        heroStatsContainer.innerHTML = items.map((item, idx) => `
            <div class="px-5 py-4 rounded-2xl border ${item.gold ? 'bg-brand-orange/20 border-brand-orange text-brand-orange shadow-glow' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'} backdrop-blur-md flex flex-col items-center justify-center transition-transform hover:-translate-y-1 cursor-default group min-w-[140px]">
                <div class="mb-2 opacity-80"><i data-lucide="${item.i}" class="w-6 h-6"></i></div>
                <div class="text-3xl font-extrabold font-title mb-1 group-hover:scale-110 transition-transform" id="stat-${idx}">0</div>
                <div class="text-[10px] md:text-xs uppercase tracking-widest opacity-70 mt-1 font-bold">${item.l}</div>
            </div>
        `).join('');
        
        initIcons();

        items.forEach((item, idx) => {
            const el = document.getElementById(`stat-${idx}`);
            const target = item.v;
            if(item.isFloat) {
                el.innerText = parseFloat(target).toFixed(1);
            } else {
                animateValue(el, 0, target, 1500);
            }
        });

    } catch (e) { console.warn("Stats error", e); }
}

function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.innerHTML = end;
        }
    };
    window.requestAnimationFrame(step);
}

async function loadFiltersData() {
    const yearSelect = document.getElementById('filter-year');
    try {
        const res = await fetch(`${BASE_URL}/memoires/universites/${UNIV_SLUG}/memoires/annees/`);
        const data = await res.json();
        const years = data.annees || (Array.isArray(data) ? data : []);
        yearSelect.innerHTML = '<option value="">Toutes les années</option>';
        years.forEach(y => yearSelect.innerHTML += `<option value="${y}">${y}</option>`);
    } catch(e) {
        const currentYear = new Date().getFullYear();
        for(let i=0; i<10; i++) {
            yearSelect.innerHTML += `<option value="${currentYear - i}">${currentYear - i}</option>`;
        }
    }

    try {
        const res = await fetch(`${BASE_URL}/universites/domaines/`);
        const data = await res.json();
        const relevant = data.filter(d => d.universites && d.universites.some(u => u.slug === UNIV_SLUG));
        const domainSelect = document.getElementById('filter-domain');
        (relevant.length ? relevant : data).forEach(d => {
            domainSelect.innerHTML += `<option value="${d.nom}">${d.nom}</option>`;
        });
    } catch(e) {}
}

// --- Render Grid ---
function renderGrid(list) {
    if (!list || !list.length) return;
    
    list.forEach(m => {
        const cardHTML = createCardHTML(m);
        grid.insertAdjacentHTML('beforeend', cardHTML);
    });
    initIcons();
}

function createCardHTML(m) {
    const note = m.note_moyenne || 0;
    const authorName = m.auteur?.nom || 'Inconnu';
    const authorPhoto = getFullUrl(m.auteur?.photo_profil);
    
    let badgeClass = 'bg-gray-100 text-gray-600';
    if(note >= 4.5) badgeClass = 'bg-gradient-to-r from-yellow-400 to-amber-500 shadow-amber-500/30 text-white';
    else if(note >= 3.5) badgeClass = 'bg-gradient-to-r from-blue-400 to-blue-600 shadow-blue-500/30 text-white';

    // --- COMPACT VIEW ENRICHIE (Actions Visibles) ---
    if (isCompactView) {
        return `
        <div class="bg-white rounded-xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-gray-100 flex p-3 group overflow-hidden relative cursor-pointer" onclick="openDetail(${m.id})">
            <div class="absolute left-0 top-0 bottom-0 w-1 bg-brand-orange scale-y-0 group-hover:scale-y-100 transition-transform origin-bottom"></div>
            <div class="w-24 h-24 flex-shrink-0 relative overflow-hidden rounded-lg bg-gray-100">
                <img src="${getFullUrl(m.images)}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy">
            </div>
            <div class="ml-4 flex-1 flex flex-col justify-between min-w-0">
                <div>
                    <div class="flex justify-between items-start gap-2">
                        <h3 class="font-title font-bold text-brand-black line-clamp-1 text-sm group-hover:text-brand-orange transition-colors">${m.titre}</h3>
                        <span class="text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${badgeClass}">
                            <i data-lucide="star" class="w-2 h-2 fill-current"></i> ${note.toFixed(1)}
                        </span>
                    </div>
                    <div class="flex items-center gap-4 mt-1.5 text-xs text-gray-500">
                        <div class="flex items-center gap-1.5 font-medium">
                            <img src="${authorPhoto}" class="w-5 h-5 rounded-full object-cover border border-gray-200">
                            <span class="truncate max-w-[120px]">${authorName}</span>
                        </div>
                        <span class="hidden sm:flex items-center gap-1"><i data-lucide="calendar" class="w-3 h-3"></i> ${m.annee}</span>
                    </div>
                </div>
                
                <!-- Action Bar Compacte & Visible -->
                <div class="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                     <div class="flex gap-2 text-xs font-bold text-gray-400">
                        <span class="flex items-center gap-1" title="Téléchargements"><i data-lucide="download" class="w-3 h-3"></i> ${m.nb_telechargements}</span>
                     </div>
                     <div class="flex gap-1" onclick="event.stopPropagation()">
                         <button onclick="toggleLike(event, ${m.id})" class="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"><i data-lucide="heart" class="w-3.5 h-3.5 ${m.is_liked ? 'fill-red-500 text-red-500' : ''}"></i></button>
                         <button onclick="openChat(event, ${m.id})" class="p-1.5 rounded-md text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"><i data-lucide="message-square" class="w-3.5 h-3.5"></i></button>
                         <button onclick="downloadMemoire(event, ${m.id}, '${m.pdf_url}')" class="p-1.5 rounded-md text-gray-400 hover:text-brand-orange hover:bg-orange-50 transition-colors"><i data-lucide="download" class="w-3.5 h-3.5"></i></button>
                         
                         <!-- Notation au survol -->
                         <div class="relative group/rate ml-1">
                            <button class="p-1.5 rounded-md text-gray-400 hover:text-yellow-500 hover:bg-yellow-50"><i data-lucide="star" class="w-3.5 h-3.5"></i></button>
                            <div class="absolute bottom-full right-0 mb-1 hidden group-hover/rate:flex bg-white shadow-lg rounded-lg p-1 border border-gray-100 gap-0.5 z-10">
                                ${[1,2,3,4,5].map(i => `<span class="cursor-pointer hover:scale-125 text-yellow-400 text-xs px-1" onclick="rateMemoire(${m.id}, ${i})">★</span>`).join('')}
                            </div>
                         </div>
                     </div>
                </div>
            </div>
        </div>`;
    }

    // Standard View
    return `
    <div class="group bg-white rounded-[24px] shadow-card hover:shadow-card-hover transition-all duration-500 border border-gray-100 flex flex-col h-full hover:-translate-y-2 relative overflow-visible cursor-pointer" onclick="openDetail(${m.id})">
        
        <!-- Stars Interactives -->
        <div class="absolute -top-4 right-6 z-30 flex items-center gap-1 bg-white/95 backdrop-blur-md shadow-lg border border-gray-100 p-2 rounded-full transform transition-all duration-300 translate-y-2 opacity-0 group-hover:opacity-100 group-hover:translate-y-0" onclick="event.stopPropagation()">
            ${[1,2,3,4,5].map(i => `
                <button onclick="rateMemoire(${m.id}, ${i})" class="p-1 hover:scale-125 transition-transform focus:outline-none" title="Noter ${i}/5">
                    <i data-lucide="star" class="w-4 h-4 transition-colors ${i <= Math.round(note) ? 'fill-brand-orange text-brand-orange' : 'text-gray-200'}"></i>
                </button>
            `).join('')}
        </div>

        <div class="relative h-56 overflow-hidden rounded-t-[24px]">
            <img src="${getFullUrl(m.images)}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy">
            <div class="absolute inset-0 bg-gradient-to-t from-brand-black/90 via-brand-black/20 to-transparent opacity-90"></div>
            <div class="absolute top-5 left-5 flex gap-2">
                <span class="bg-white/20 backdrop-blur-md border border-white/20 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm">${m.annee}</span>
            </div>
            <div class="absolute bottom-0 left-0 right-0 p-6">
               <div class="flex items-center gap-2 mb-3">
                    <div class="flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold shadow-lg ${badgeClass}">
                        <i data-lucide="star" class="w-2.5 h-2.5 fill-current"></i> ${note.toFixed(1)}
                    </div>
               </div>
              <h3 class="font-title text-xl font-extrabold text-white leading-tight line-clamp-2 group-hover:text-brand-orange transition-colors">${m.titre}</h3>
            </div>
        </div>
        <div class="p-6 flex-1 flex flex-col bg-white rounded-b-[24px]">
            <div class="mb-5 flex items-center gap-3">
                 <img src="${authorPhoto}" class="w-10 h-10 rounded-full object-cover border-2 border-white shadow-md bg-gray-100">
                 <div>
                    <p class="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Réalisé par</p>
                    <p class="text-sm font-bold text-brand-black">${authorName}</p>
                 </div>
            </div>
            <p class="text-gray-500 text-sm line-clamp-3 mb-6 flex-1 leading-relaxed font-body border-l-2 border-gray-100 pl-4 italic">
              ${m.resume || "Aucun résumé disponible."}
            </p>
            
            <div class="grid grid-cols-3 divide-x divide-gray-100 border-t border-b border-gray-100 py-4 mb-5 bg-gray-50/50 rounded-xl">
                 <div class="text-center px-1">
                    <div class="text-brand-black font-extrabold text-sm flex items-center justify-center gap-1.5">${m.nb_telechargements} <i data-lucide="download" class="w-3 h-3"></i></div>
                    <div class="text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-1">Downloads</div>
                 </div>
                 <div class="text-center px-1">
                    <div class="text-brand-black font-extrabold text-sm flex items-center justify-center gap-1.5 ${m.is_liked ? 'text-red-500' : ''}">${m.nb_likes} <i data-lucide="heart" class="w-3 h-3 ${m.is_liked ? 'fill-current' : ''}"></i></div>
                    <div class="text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-1">Likes</div>
                 </div>
                 <div class="text-center px-1">
                    <div class="text-brand-black font-extrabold text-sm flex items-center justify-center gap-1.5">${m.nb_commentaires || 0} <i data-lucide="message-square" class="w-3 h-3"></i></div>
                    <div class="text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-1">Avis</div>
                 </div>
            </div>

            <div class="flex items-center justify-between gap-3">
                 <div class="flex gap-2">
                    <button onclick="toggleLike(event, ${m.id})" class="h-11 w-11 flex items-center justify-center rounded-full border transition-all ${m.is_liked ? 'bg-red-50 text-red-500 border-red-200' : 'bg-white text-gray-400 border-gray-200 hover:text-red-500'}"><i data-lucide="heart" class="w-5 h-5 ${m.is_liked ? 'fill-current' : ''}"></i></button>
                    <button onclick="openChat(event, ${m.id})" class="h-11 w-11 flex items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 hover:text-blue-500 hover:bg-blue-50 relative">
                        <i data-lucide="message-square" class="w-5 h-5"></i>
                        ${m.nb_commentaires > 0 ? `<span class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full font-bold border-2 border-white">${m.nb_commentaires}</span>` : ''}
                    </button>
                 </div>
                 <div class="flex gap-2 flex-1 justify-end">
                    <button onclick="downloadMemoire(event, ${m.id}, '${m.pdf_url}')" class="h-11 w-11 flex items-center justify-center rounded-full bg-gray-50 text-gray-500 hover:bg-brand-orange hover:text-brand-black transition-all hover:shadow-lg border border-gray-200 hover:border-brand-orange"><i data-lucide="download" class="w-5 h-5"></i></button>
                    <button class="h-11 px-6 rounded-full bg-brand-black text-white font-bold text-xs uppercase tracking-wide hover:bg-gray-800 transition-all shadow-md flex items-center gap-2 group/btn">Détails <i data-lucide="arrow-right" class="w-4 h-4 group-hover/btn:translate-x-1 transition-transform"></i></button>
                 </div>
            </div>
        </div>
    </div>`;
}

// --- Detail Modal (Responsive & Interactive) ---
function openDetail(id) {
    const m = memoiresData.find(item => item.id === id);
    if (!m) return;

    // Auth check: if user not connected, show a themed interactive prompt instead
    if (!TOKEN) { showAuthPrompt(); return; }
    
    const modal = document.getElementById('modal-detail');
    const content = document.getElementById('modal-detail-content');
   
    const authorName = m.auteur?.nom || 'Inconnu';
    const authorPhoto = getFullUrl(m.auteur?.photo_profil);
    const authorEmail = m.auteur?.email;
    const authorLinkedin = m.auteur?.linkedin;
    const note = m.note_moyenne || 0;

    content.innerHTML = `
  <!-- container global : pile sur mobile, 2 cols > md -->
<div class="flex flex-col md:flex-row w-full h-full">

  <!-- COLONNE GAUCHE (image + infos) -->
  <div class="w-full md:w-[420px] lg:w-[460px] bg-[#111] text-white
              overflow-y-auto custom-scrollbar
              shrink-0 md:border-r md:border-white/10">

    <!-- image responsive -->
    <div class="relative w-full aspect-video md:aspect-auto md:h-64 lg:h-72">
      <img src="${getFullUrl(m.images)}" class="w-full h-full object-cover">
      <div class="absolute inset-0 bg-gradient-to-t from-[#111] via-transparent to-transparent"></div>
      <!-- promo + domaines -->
      <div class="absolute bottom-0 left-0 p-4 md:p-6 w-full">
        <div class="flex flex-wrap gap-2 mb-3">
          <span class="bg-brand-orange text-brand-black text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider shadow-lg shadow-brand-orange/20">Promo ${m.annee}</span>
          ${(m.domaines_list || []).map(d => `<span class="bg-white/10 backdrop-blur-md border border-white/20 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">${d}</span>`).join('')}
        </div>
        <h2 class="text-lg md:text-xl lg:text-2xl font-title font-extrabold text-white leading-tight">${m.titre}</h2>
      </div>
    </div>

    <!-- bloc auteur + stats + actions -->
    <div class="p-4 md:p-6 lg:p-8 space-y-6">
      <!-- AUTEUR -->
      <div class="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-6 backdrop-blur-sm">
        <div class="flex items-center gap-3 md:gap-5">
          <img src="${authorPhoto}" class="w-12 h-12 md:w-16 md:h-16 rounded-full object-cover border-2 border-brand-orange">
          <div class="flex-1 min-w-0">
            <p class="font-title font-bold text-base md:text-xl text-white leading-none mb-1 truncate">${authorName}</p>
            ${authorLinkedin ? `<a href="${authorLinkedin}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 text-xs md:text-sm font-bold text-[#0077b5] hover:text-white transition-colors"><i data-lucide="linkedin" class="w-3 h-3 md:w-4 md:h-4 fill-current"></i> LinkedIn</a>` : '<span class="text-gray-500 text-xs italic">Non relié</span>'}
          </div>
        </div>
      </div>

      <!-- STATS -->
      <div class="grid grid-cols-2 gap-3 md:gap-4">
        <div class="bg-brand-orange text-brand-black p-4 md:p-5 rounded-2xl text-center shadow-lg relative overflow-hidden group">
          <div class="text-2xl md:text-4xl font-title font-extrabold mb-1">${m.nb_telechargements}</div>
          <div class="text-[10px] uppercase tracking-widest font-bold opacity-80">Downloads</div>
        </div>
        <div class="bg-white/10 border border-white/10 p-4 md:p-5 rounded-2xl text-center relative overflow-hidden">
          <div class="text-2xl md:text-4xl font-title font-extrabold text-white mb-1 flex justify-center items-center gap-2">
            ${note.toFixed(1)} <i data-lucide="star" class="w-5 h-5 md:w-6 md:h-6 fill-brand-orange text-brand-orange"></i>
          </div>
          <div class="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Note Moy.</div>
        </div>
      </div>

      <!-- ACTIONS -->
      <div class="space-y-4 pt-4 border-t border-white/10">
        <h4 class="text-xs uppercase font-bold text-gray-400 tracking-widest">Interactions</h4>
        <div class="flex items-center justify-between bg-white/5 p-3 md:p-4 rounded-xl">
          <span class="text-sm font-bold">Notez ce mémoire :</span>
          <div class="flex gap-1">
            ${[1,2,3,4,5].map(i => `<button onclick="rateMemoire(${m.id}, ${i})" class="text-gray-500 hover:text-brand-orange hover:scale-110 transition-all p-1"><i data-lucide="star" class="w-5 h-5 md:w-6 md:h-6 ${i <= Math.round(note) ? 'fill-brand-orange text-brand-orange' : ''}"></i></button>`).join('')}
          </div>
        </div>
        <div class="flex gap-2">
          <button onclick="toggleLike(event, ${m.id})" class="flex-1 py-3 bg-white/5 hover:bg-red-500/20 hover:text-red-500 border border-white/10 rounded-xl transition-all flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wide ${m.is_liked ? 'text-red-500 border-red-500/50 bg-red-500/10' : 'text-gray-300'}">
            <i data-lucide="heart" class="w-5 h-5 ${m.is_liked ? 'fill-current' : ''}"></i> J'aime
          </button>
          <button onclick="openChat(event, ${m.id})" class="flex-1 py-3 bg-white/5 hover:bg-blue-500/20 hover:text-blue-500 border border-white/10 rounded-xl transition-all flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-300">
            <i data-lucide="message-square" class="w-5 h-5"></i> Chat
          </button>
        </div>
      </div>

      <!-- Encadreurs -->
      ${(m.encadreurs || []).length ? `
      <div class="mt-6">
        <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2"><i data-lucide="users" class="w-4 h-4"></i> Encadreur(s)</h4>
        <div class="space-y-2">
          ${m.encadreurs.map(e => `
              <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <img src="${getFullUrl(e.photo_profil)}" onerror="this.src='https://via.placeholder.com/40?text=👤'" class="w-10 h-10 rounded-full object-cover">
                <div>
                  <p class="text-sm font-bold text-brand-black">${e.nom}</p>
                  <a href="mailto:${e.email}" class="text-xs text-gray-500">${e.email}</a>
                  ${e.linkedin ? `<a href="${e.linkedin}" target="_blank" rel="noopener noreferrer" class="text-xs text-[#0077b5] hover:underline ml-2">LinkedIn</a>` : ''}
                </div>
              </div>
          `).join('')}
        </div>
      </div>
      ` : ''}
    </div>
  </div>

  <!-- COLONNE DROITE (résumé, institutions, commentaire rapide) -->
  <div class="flex-1 bg-white overflow-y-auto custom-scrollbar scroll-safe">
    <div class="p-6 md:p-12 space-y-8">
      <!-- Résumé -->
      <div>
        <div class="flex items-start gap-4 mb-6">
          <div class="p-3 md:p-4 bg-gray-50 rounded-2xl text-brand-orange shadow-sm border border-gray-100"><i data-lucide="file-text" class="w-6 h-6 md:w-8 md:h-8"></i></div>
          <div>
            <h3 class="text-xl md:text-2xl font-title font-extrabold text-brand-black uppercase tracking-wide mb-1">Résumé</h3>
            <p class="text-sm text-gray-400 font-bold">Aperçu du document</p>
          </div>
        </div>
        <div class="prose prose-sm md:prose-lg max-w-none text-gray-600 font-body leading-loose text-justify bg-gray-50 p-6 md:p-8 rounded-3xl border border-gray-100">
          ${m.resume || '<span class="italic opacity-50">Aucun résumé disponible.</span>'}
        </div>
      </div>

      <!-- Institutions -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 border-t border-gray-100 pt-8">
        <div>
          <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2"><i data-lucide="building" class="w-4 h-4"></i> Institution</h4>
          <div class="flex flex-wrap gap-2">
            ${(m.universites_list || []).map(u => `<div class="flex items-center gap-3 text-sm font-bold text-brand-black bg-gray-50 border border-gray-100 px-4 py-3 rounded-xl"><div class="w-2 h-2 bg-brand-orange rounded-full"></div> ${u}</div>`).join('')}
          </div>
        </div>
        <div>
          <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2"><i data-lucide="calendar" class="w-4 h-4"></i> Publication</h4>
          <span class="px-4 py-3 bg-gray-50 border border-gray-100 text-gray-600 rounded-xl text-sm font-bold inline-block shadow-sm">
            ${new Date(m.created_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
      </div>
      <div class="space-y-1 text-xs text-gray-500">
                <div>Langue : <span class="font-semibold text-gray-800">${m.langue || 'Non renseignée'}</span></div>
                <div>Pages : <span class="font-semibold text-gray-800">${m.nombre_pages || '-'}</span></div>
                <div>Taille du fichier : <span class="font-semibold text-gray-800">${m.fichier_taille || '-'} Mo</span></div>
                <div>Dernière modif : <span class="font-semibold text-gray-800">${moment(m.derniere_modif).fromNow()}</span></div>
                ${m.est_confidentiel ? '<div class="text-red-600 font-bold">⚠ Document confidentiel</div>' : ''}
              </div>


      <!-- Commentaire rapide -->
      <div class="mt-8 pt-8 border-t border-gray-100">
        <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2"><i data-lucide="pen-tool" class="w-4 h-4"></i> Commentaire Rapide</h4>
        <div class="flex gap-2">
          <input type="text" id="modal-quick-comment" class="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-orange/50 outline-none transition-all" placeholder="Votre avis...">
          <button onclick="sendCommentFromModal(${m.id})" class="px-6 py-3 bg-brand-black text-white rounded-xl font-bold uppercase text-xs hover:bg-brand-orange hover:text-brand-black transition-all">Envoyer</button>
        </div>
      </div>
    </div>

    <!-- BOUTON TÉLÉCHARGER (sticky en bas) -->
    <div class="sticky bottom-0 p-4 md:p-6 border-t border-gray-100 bg-white/95 backdrop-blur-md flex flex-col md:flex-row gap-4">
      <button onclick="downloadMemoire(event, ${m.id}, '${m.pdf_url}')" class="flex-1 py-4 bg-brand-black hover:bg-brand-orange hover:text-brand-black text-white font-title font-bold rounded-2xl transition-all shadow-xl flex items-center justify-center gap-3 text-sm uppercase tracking-widest group">
        <div class="p-1.5 bg-white/20 rounded-full group-hover:bg-brand-black/20 transition-colors"><i data-lucide="download" class="w-5 h-5"></i></div>
        Télécharger le PDF
      </button>
    </div>
  </div>
</div>`;
    
    modal.classList.remove('hidden');
    initIcons();
}

window.sendCommentFromModal = async (id) => {
    if (!TOKEN) { showAuthPrompt(); return; }
    const input = document.getElementById('modal-quick-comment');
    const txt = input.value.trim();
    if(!txt) return;
    try {
        await fetch(`${BASE_URL}/interactions/commentaires/`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ memoire: id, contenu: txt })
        });
        alert("Commentaire envoyé !");
        input.value = '';
    } catch(e) {
        alert("Erreur lors de l'envoi");
    }
};

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

function showAuthPrompt() {
    const el = document.getElementById('auth-prompt');
    if (!el) return;
    el.classList.remove('hidden');
    // ensure icons render correctly
    initIcons();
}

function closeAuthPrompt() {
    const el = document.getElementById('auth-prompt');
    if (!el) return;
    el.classList.add('hidden');
} 

// --- Chat Logic ---
function openChat(e, id) {
     if(e) e.stopPropagation();
    if (!TOKEN) { showAuthPrompt(); return; }

    const m = memoiresData.find(item => item.id === id);
    if (!m) return;

    document.getElementById('modal-chat').classList.remove('hidden');
    document.getElementById('chat-title').innerText = m.titre;
    
    const container = document.getElementById('chat-messages');
    container.innerHTML = '<div class="flex justify-center py-20"><div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-orange"></div></div>';

    // ✅ URL correcte pour récupérer les commentaires d’un mémoire
    fetch(`${BASE_URL}/memoires/universites/${UNIV_SLUG}/memoires/${id}/commentaires/`, {
        headers: getHeaders()
    })
        .then(res => res.json())
        .then(data => {
            if (Array.isArray(data) && data.length > 0) renderComments(data);
            else container.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-center opacity-50 space-y-4">
                    <div class="bg-white p-6 rounded-full shadow-sm"><i data-lucide="message-circle" class="w-12 h-12 text-gray-300"></i></div>
                    <div><p class="text-lg font-bold text-gray-600">Aucun message</p><p class="text-sm text-gray-400">Soyez le premier !</p></div>
                </div>`;
            initIcons();
        })
        .catch(() => container.innerHTML = '<p class="text-center text-gray-400 py-10">Erreur de chargement.</p>');
    const btn = document.getElementById('chat-send');
    const input = document.getElementById('chat-input');
    // Clear old listeners
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);

    newBtn.onclick = () => sendComment(id);
    newInput.onkeypress = (e) => {
        if(e.key === 'Enter') sendComment(id);
    };
}

function renderComments(comments) {
    const container = document.getElementById('chat-messages');
    console.log('[CHAT] Réponse brute reçue :', comments);
    container.innerHTML = comments.map(c => {
       const userObj   = c.utilisateur || {};
const userName  = userObj.nom || 'Anonyme';
const userPhoto = getFullUrl(userObj.photo_profil);
const isMe      = CURRENT_USER_ID && userObj.id === CURRENT_USER_ID;

console.log('[CHAT] userObj complet :', userObj);
        return `
        <div class="chat-msg ${isMe ? 'mine' : 'theirs'} mb-4">
            ${!isMe ? `
                <img src="${userPhoto}" class="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm">
            ` : ''}
            <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[80%]">
                ${!isMe ? `<span class="text-[10px] font-bold text-gray-500 mb-1">${userName}</span>` : ''}
                <div class="chat-bubble ${isMe ? 'mine' : 'theirs'}">
                    ${c.contenu}
                    <div class="text-[9px] mt-1 text-right font-bold opacity-50">${moment(c.date).fromNow()}</div>
                </div>
            </div>
        </div>`;
    }).join('');
    
    initIcons();
    container.scrollTop = container.scrollHeight;
}
// ... (Rest of functions like toggleView, sendComment, listeners... remain similar) ...
function toggleView() {
    isCompactView = !isCompactView;
    document.getElementById('view-label').textContent = isCompactView ? "Vue Normale" : "Vue Compacte";
    grid.innerHTML = '';
    renderGrid(memoiresData);
}

async function sendComment(id) {
    const input = document.getElementById('chat-input');
    const txt = input.value.trim();
    if (!txt) return;

    const container = document.getElementById('chat-messages');
    if (container.querySelector('.text-center')) container.innerHTML = '';

    // message temporaire
    container.insertAdjacentHTML('beforeend', `
        <div class="chat-msg mine mb-4 opacity-70">
            <div class="flex flex-col items-end max-w-[80%] ml-auto">
                <div class="chat-bubble mine">${txt}<div class="text-[9px] mt-1 text-right font-bold opacity-50">Envoi...</div></div>
            </div>
        </div>`);
    input.value = '';
    container.scrollTop = container.scrollHeight;

    try {
        // 1. on envoie le commentaire
        await fetch(`${BASE_URL}/interactions/commentaires/`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ memoire: id, contenu: txt })
        });

        // 2. on re-récupère **les commentaires de CE mémoire seulement**
        const res = await fetch(`${BASE_URL}/memoires/universites/${UNIV_SLUG}/memoires/${id}/commentaires/`, {
            headers: getHeaders()
        });
        const data = await res.json();
        renderComments(data);   // ⬅️  affiche la liste à jour
    } catch (e) {
        alert('Erreur envoi');
    }
}
function setupListeners() {
    document.getElementById('filter-search').addEventListener('input', (e) => {
        filters.search = e.target.value;
        debounceLoad();
    });
    // Listeners for all filters
    ['filter-year', 'filter-domain', 'filter-sort', 'filter-rating', 'filter-university'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('change', (e) => {
            const key = id.split('-')[1];
            filters[key] = e.target.value;
            fetchMemoires(true);
        });
    });
    // Checkboxes
    document.getElementById('filter-resume').addEventListener('change', (e) => {
        filters.hasResume = e.target.checked;
        fetchMemoires(true);
    });
    document.getElementById('filter-popular').addEventListener('change', (e) => {
        filters.isPopular = e.target.checked;
        fetchMemoires(true);
    });
    document.getElementById('filter-commented').addEventListener('change', (e) => {
        filters.isCommented = e.target.checked;
        fetchMemoires(true);
    });

    document.getElementById('load-more-btn').onclick = () => { currentPage++; fetchMemoires(); };
    
    // Mobile Menu
    const sidebar = document.getElementById('mobile-sidebar');
    document.getElementById('mobile-menu-btn').onclick = () => sidebar.classList.remove('translate-x-full');
    document.getElementById('close-mobile-menu').onclick = () => sidebar.classList.add('translate-x-full');
    document.getElementById('mobile-backdrop').onclick = () => sidebar.classList.add('translate-x-full');
    
    const toggle = document.getElementById('mobile-filter-toggle');
    if(toggle) toggle.onclick = () => {
        document.getElementById('filters-content').classList.toggle('hidden');
        document.getElementById('filter-chevron').classList.toggle('rotate-180');
    };
}

let timeout;
function debounceLoad() {
    clearTimeout(timeout);
    timeout = setTimeout(() => fetchMemoires(true), 500);
}

window.openDetail = openDetail;
window.closeModal = closeModal;
window.showAuthPrompt = showAuthPrompt;
window.closeAuthPrompt = closeAuthPrompt;
window.toggleView = toggleView;
window.handleAction = handleAction;
window.rateMemoire = rateMemoire;
window.toggleLike = toggleLike;
window.downloadMemoire = downloadMemoire;
window.openChat = openChat;
window.resetFilters = resetFilters;
window.sendComment = sendComment;
window.sendCommentFromModal = sendCommentFromModal;

function downloadMemoire(e, id, url) {
    if(e) e.stopPropagation();
    if (!TOKEN) { showAuthPrompt(); return; }
    fetch(`${BASE_URL}/interactions/telechargements/telecharger/`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ memoire: id }) });
    window.open(url, '_blank');
}

function toggleLike(e, id) {
    if(e) e.stopPropagation();
    if (!TOKEN) { showAuthPrompt(); return; }
    if(e.currentTarget) {
        const icon = e.currentTarget.querySelector('svg');
        icon.classList.toggle('fill-current');
        icon.classList.toggle('text-red-500');
    }
    fetch(`${BASE_URL}/interactions/likes/toggle/`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ memoire_id: id }) });
}

function rateMemoire(id, note) {
    if(event) event.stopPropagation();
    if (!TOKEN) { showAuthPrompt(); return; }
    fetch(`${BASE_URL}/interactions/notations/`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ memoire_id: id, note: note }) })
    .then(res => { if(res.ok) alert(`Note ${note}/5 enregistrée !`); });
}

function resetFilters() {
    document.getElementById('filter-search').value = '';
    document.getElementById('filter-year').value = '';
    document.getElementById('filter-domain').value = '';
    document.getElementById('filter-rating').value = '';
    document.getElementById('filter-university').value = '';
    document.getElementById('filter-resume').checked = false;
    document.getElementById('filter-popular').checked = false;
    document.getElementById('filter-commented').checked = false;
    
    filters = { 
        search: '', year: '', domain: '', sort: '-created_at', rating: '', 
        university: '', hasResume: false, isPopular: false, isCommented: false 
    };
    fetchMemoires(true);
}

async function handleAction(type) {
    if (!TOKEN && type !== 'annuaire') { showAuthPrompt(); return; }
    const modal = document.getElementById('modal-generic');
    const contentEl = document.getElementById('modal-generic-content');
    const titleEl = document.getElementById('modal-generic-title');
    modal.classList.remove('hidden');
    contentEl.innerHTML = '<div class="flex justify-center py-10"><div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-orange"></div></div>';
    
    try {
        if (type === 'annuaire') {
            titleEl.innerHTML = 'Annuaire';
            const res = await fetch(`${BASE_URL}/auth/${UNIV_SLUG}/users/annuaire/`, { headers: getHeaders() });
            const data = await res.json();
            contentEl.innerHTML = `<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">${data.map(u => `
                <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <img src="${getFullUrl(u.photo_profil)}" class="w-10 h-10 rounded-full object-cover bg-gray-200">
                    <div><p class="font-bold text-sm text-brand-black">${u.nom} ${u.prenom || ''}</p></div>
                </div>`).join('')}</div>`;
        } else if (type === 'stats') {
             titleEl.innerHTML = 'Mes Statistiques';
             const res = await fetch(`${BASE_URL}/memoires/universites/${UNIV_SLUG}/memoires/mes-stats/`, { headers: getHeaders() });
             const data = await res.json();
             contentEl.innerHTML = `<div class="bg-gray-50 p-6 rounded-xl text-center"><div class="text-3xl font-bold">${data.total_memoires}</div><div class="text-xs uppercase text-gray-500">Mémoires Publiés</div></div>`;
        } else if (type === 'downloads') {
             titleEl.innerHTML = 'Mes Téléchargements';
             const res = await fetch(`${BASE_URL}/interactions/telechargements/mes-telechargements/`, { headers: getHeaders() });
             const data = await res.json();
             contentEl.innerHTML = data.length ? data.map(d => `<div class="p-3 border-b text-sm">${d.memoire_titre}</div>`).join('') : '<p class="text-center text-gray-400">Vide</p>';
        } else if (type === 'likes') {
             titleEl.innerHTML = 'Mes Likes';
             const res = await fetch(`${BASE_URL}/interactions/universites/${UNIV_SLUG}/interactions/likes/`, { headers: getHeaders() });
             const data = await res.json();
             contentEl.innerHTML = data.length ? data.map(l => `<div class="p-3 border-b text-sm flex justify-between"><span>${l.memoire_titre}</span><i data-lucide="heart" class="w-4 h-4 fill-red-500 text-red-500"></i></div>`).join('') : '<p class="text-center text-gray-400">Vide</p>';
             initIcons();
        }
    } catch(e) { contentEl.innerHTML = 'Erreur'; }
}
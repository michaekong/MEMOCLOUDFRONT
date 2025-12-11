/**
 * DashboardAnalytics - Gestionnaire tout-en-un pour le tableau de bord
 * Nécessite: Chart.js, TailwindCSS (pour le style)
 */

class DashboardAnalytics {
    constructor(config) {
        this.apiBase = config.apiBase;
        this.univSlug = config.univSlug;
        this.token = config.token;
        this.containerId = config.containerId;
        this.charts = {}; // Stockage des instances Chart.js
        
        this.colors = {
            primary: '#ffb606', // Brand Yellow
            dark: '#3a3a3a',
            blue: '#3b82f6',
            purple: '#8b5cf6',
            green: '#10b981',
            red: '#ef4444',
            orange: '#f97316',
            teal: '#14b8a6',
            pink: '#ec4899',
            gray: '#94a3b8',
            transparent: (hex, alpha = '20') => hex + alpha
        };
    }

    async init() {
        this.renderSkeleton();
        try {
            const data = await this.fetchAllData();
            this.renderLayout(data);
            // Petit délai pour laisser le DOM se construire
            setTimeout(() => this.renderAllCharts(data), 100);
        } catch (e) {
            console.error("Dashboard Error:", e);
            document.getElementById(this.containerId).innerHTML = `
                <div class="flex flex-col items-center justify-center h-64 text-red-500">
                    <i class="fas fa-exclamation-triangle text-4xl mb-2"></i>
                    <p>Erreur de chargement des données analytiques.</p>
                </div>`;
        }
    }

    getHeaders() {
        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        };
    }

    async fetchAllData() {
        const [users, memoires, domaines, news] = await Promise.all([
            fetch(`${this.apiBase}/auth/${this.univSlug}/users/`, { headers: this.getHeaders() }).then(r => r.json()),
            fetch(`${this.apiBase}/memoires/universites/${this.univSlug}/memoires/`, { headers: this.getHeaders() }).then(r => r.json()),
            fetch(`${this.apiBase}/universites/domaines/`, { headers: this.getHeaders() }).then(r => r.json()),
            fetch(`${this.apiBase}/universites/universities/${this.univSlug}/news/`, { headers: this.getHeaders() }).then(r => r.json())
        ]);
        return { users, memoires, domaines, news };
    }

    // --- HTML GENERATION ---

    renderSkeleton() {
        const container = document.getElementById(this.containerId);
        container.innerHTML = `
            <div class="animate-pulse space-y-6">
                <div class="grid grid-cols-4 gap-4"><div class="h-32 bg-gray-200 rounded-xl"></div><div class="h-32 bg-gray-200 rounded-xl"></div><div class="h-32 bg-gray-200 rounded-xl"></div><div class="h-32 bg-gray-200 rounded-xl"></div></div>
                <div class="grid grid-cols-2 gap-4"><div class="h-80 bg-gray-200 rounded-xl"></div><div class="h-80 bg-gray-200 rounded-xl"></div></div>
            </div>`;
    }

    renderLayout({ users, memoires }) {
        const container = document.getElementById(this.containerId);
        
        // KPIs Calculs
        const totalDownloads = memoires.reduce((acc, m) => acc + (m.nb_telechargements || 0), 0);
        const totalLikes = memoires.reduce((acc, m) => acc + (m.nb_likes || 0), 0);
        const totalComments = memoires.reduce((acc, m) => acc + (m.nb_commentaires || 0), 0);
        
        container.innerHTML = `
            <div class="space-y-8 animate-fade-in pb-12">
                <!-- 1. KPI Cards -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    ${this.createKpiCard('Utilisateurs', users.length, 'fa-users', 'text-blue-600', 'bg-blue-50')}
                    ${this.createKpiCard('Mémoires', memoires.length, 'fa-book', 'text-yellow-600', 'bg-yellow-50')}
                    ${this.createKpiCard('Téléchargements', totalDownloads, 'fa-download', 'text-green-600', 'bg-green-50')}
                    ${this.createKpiCard('Interactions (Likes+Comm)', totalLikes + totalComments, 'fa-chart-line', 'text-purple-600', 'bg-purple-50')}
                </div>

                <!-- 2. Téléchargements & Popularité -->
                <h3 class="text-xl font-bold text-brand-dark border-l-4 border-brand-yellow pl-3">📥 Téléchargements & Popularité</h3>
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2">
                        <h4 class="font-bold text-gray-700 mb-4">Top 10 Mémoires (Téléchargements)</h4>
                        <div class="chart-container h-72"><canvas id="chartTopDownloads"></canvas></div>
                    </div>
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h4 class="font-bold text-gray-700 mb-4">Conversion Vue → Download</h4>
                        <div class="chart-container h-72"><canvas id="chartConversion"></canvas></div>
                    </div>
                </div>

                <!-- 3. Likes & Favoris -->
                <h3 class="text-xl font-bold text-brand-dark border-l-4 border-red-500 pl-3 pt-4">❤️ Likes & Favoris</h3>
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h4 class="font-bold text-gray-700 mb-4">Répartition des Likes (Domaine)</h4>
                        <div class="chart-container h-64"><canvas id="chartLikesDomain"></canvas></div>
                    </div>
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2">
                        <h4 class="font-bold text-gray-700 mb-4">Top 10 Mémoires les plus Likés</h4>
                        <div class="chart-container h-64"><canvas id="chartTopLikes"></canvas></div>
                    </div>
                </div>

                <!-- 4. Commentaires & Engagement -->
                <h3 class="text-xl font-bold text-brand-dark border-l-4 border-blue-500 pl-3 pt-4">💬 Commentaires & Engagement</h3>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h4 class="font-bold text-gray-700 mb-4">Top Mémoires Commentés</h4>
                        <div class="chart-container h-64"><canvas id="chartTopComments"></canvas></div>
                    </div>
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h4 class="font-bold text-gray-700 mb-4">Taux de Likes par Note</h4>
                        <div class="chart-container h-64"><canvas id="chartLikesByRating"></canvas></div>
                    </div>
                </div>

                <!-- 5. Qualité & Notes -->
                <h3 class="text-xl font-bold text-brand-dark border-l-4 border-yellow-500 pl-3 pt-4">⭐ Qualité & Satisfaction</h3>
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h4 class="font-bold text-gray-700 mb-4">Répartition des Notes</h4>
                        <div class="chart-container h-64"><canvas id="chartRatingDist"></canvas></div>
                    </div>
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2">
                        <h4 class="font-bold text-gray-700 mb-4">Corrélation: Note vs Téléchargements</h4>
                        <div class="chart-container h-64"><canvas id="chartScatterNoteDown"></canvas></div>
                    </div>
                </div>

                <!-- 6. Utilisateurs & Activité -->
                <h3 class="text-xl font-bold text-brand-dark border-l-4 border-green-500 pl-3 pt-4">👤 Utilisateurs & Activité</h3>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h4 class="font-bold text-gray-700 mb-4">Top Contributeurs (Publications)</h4>
                        <div class="chart-container h-72"><canvas id="chartUserPubs"></canvas></div>
                    </div>
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h4 class="font-bold text-gray-700 mb-4">Activité Hebdomadaire (Publications)</h4>
                        <div class="chart-container h-72"><canvas id="chartWeeklyActivity"></canvas></div>
                    </div>
                </div>

                <!-- 7. Avancés -->
                <h3 class="text-xl font-bold text-brand-dark border-l-4 border-purple-500 pl-3 pt-4">🎯 Métriques Avancées</h3>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h4 class="font-bold text-gray-700 mb-4">Score Viral Global</h4>
                        <div class="chart-container h-80"><canvas id="chartViralScore"></canvas></div>
                        <p class="text-xs text-gray-400 mt-2">Score = Likes + (Comm × 2) + (Dl × 0.5)</p>
                    </div>
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h4 class="font-bold text-gray-700 mb-4">Performance Globale par Domaine</h4>
                        <div class="chart-container h-80"><canvas id="chartRadarDomain"></canvas></div>
                    </div>
                </div>
            </div>
        `;
    }

    createKpiCard(label, value, icon, colorClass, bgClass) {
        return `
            <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 hover:-translate-y-1 transition-transform">
                <div class="w-14 h-14 rounded-xl ${bgClass} ${colorClass} flex items-center justify-center text-2xl">
                    <i class="fas ${icon}"></i>
                </div>
                <div>
                    <p class="text-gray-500 text-xs font-bold uppercase tracking-wider">${label}</p>
                    <h3 class="text-3xl font-bold text-brand-dark">${value}</h3>
                </div>
            </div>`;
    }

    // --- CHART RENDERING ENGINE ---

    renderAllCharts(data) {
        // Nettoyage préalable (optionnel si IDs uniques)
        Object.values(this.charts).forEach(c => c.destroy());
        this.charts = {};

        // 1. Downloads
        this.renderTopDownloads(data.memoires);
        this.renderConversion(data.memoires);

        // 2. Likes
        this.renderLikesByDomain(data.memoires, data.domaines);
        this.renderTopLikes(data.memoires);

        // 3. Comments
        this.renderTopComments(data.memoires);
        this.renderLikesByRating(data.memoires);

        // 4. Quality
        this.renderRatingDist(data.memoires);
        this.renderScatterNoteDown(data.memoires);

        // 5. Users
        this.renderUserPubs(data.memoires);
        this.renderWeeklyActivity(data.memoires);

        // 6. Advanced
        this.renderViralScore(data.memoires);
        this.renderRadarDomain(data.memoires, data.domaines);
    }

    // --- CHART IMPLEMENTATIONS ---

    // 1. Top 10 Downloads (Barres Horizontales)
    renderTopDownloads(memoires) {
        const sorted = [...memoires].sort((a, b) => (b.nb_telechargements || 0) - (a.nb_telechargements || 0)).slice(0, 10);
        this.createChart('chartTopDownloads', 'bar', {
            data: {
                labels: sorted.map(m => m.titre.substring(0, 20) + '...'),
                datasets: [{
                    label: 'Téléchargements',
                    data: sorted.map(m => m.nb_telechargements || 0),
                    backgroundColor: this.colors.primary,
                    borderRadius: 4
                }]
            },
            options: { indexAxis: 'y' }
        });
    }

    // 2. Conversion Vue -> Download (Barres empilées ou Funnel simulé)
    renderConversion(memoires) {
        const dls = memoires.reduce((a, b) => a + (b.nb_telechargements || 0), 0);
        const views = memoires.reduce((a, b) => a + (b.nb_vues || 0), 0) || (dls * 5); // Fallback simulation
        const ratio = ((dls / views) * 100).toFixed(1);

        this.createChart('chartConversion', 'bar', {
            data: {
                labels: ['Traffic Total'],
                datasets: [
                    { label: 'Vues sans DL', data: [views - dls], backgroundColor: this.colors.gray },
                    { label: 'Téléchargements', data: [dls], backgroundColor: this.colors.green }
                ]
            },
            options: {
                indexAxis: 'y',
                stacked: true,
                scales: { x: { stacked: true }, y: { stacked: true } },
                plugins: { title: { display: true, text: `Taux de conversion : ${ratio}%` } }
            }
        });
    }

    // 3. Likes par Domaine (Doughnut)
    renderLikesByDomain(memoires, domaines) {
        const stats = {};
        domaines.forEach(d => stats[d.slug] = { label: d.nom, val: 0 });
        stats['autre'] = { label: 'Autre', val: 0 };

        memoires.forEach(m => {
            const likes = m.nb_likes || 0;
            if(likes > 0) {
                if(m.domaines_list && m.domaines_list.length) {
                    m.domaines_list.forEach(slug => {
                        if(stats[slug]) stats[slug].val += likes;
                        else stats['autre'].val += likes;
                    });
                } else stats['autre'].val += likes;
            }
        });

        const labels = Object.values(stats).filter(s => s.val > 0).map(s => s.label);
        const data = Object.values(stats).filter(s => s.val > 0).map(s => s.val);

        this.createChart('chartLikesDomain', 'doughnut', {
            data: {
                labels,
                datasets: [{ data, backgroundColor: Object.values(this.colors).slice(0, labels.length) }]
            }
        });
    }

    // 4. Top Liked (Barres)
    renderTopLikes(memoires) {
        const sorted = [...memoires].sort((a, b) => (b.nb_likes || 0) - (a.nb_likes || 0)).slice(0, 10);
        this.createChart('chartTopLikes', 'bar', {
            data: {
                labels: sorted.map(m => m.titre.substring(0, 20) + '...'),
                datasets: [{
                    label: 'Likes',
                    data: sorted.map(m => m.nb_likes || 0),
                    backgroundColor: this.colors.red,
                    borderRadius: 4
                }]
            }
        });
    }

    // 5. Top Commented (Barres)
    renderTopComments(memoires) {
        const sorted = [...memoires].sort((a, b) => (b.nb_commentaires || 0) - (a.nb_commentaires || 0)).slice(0, 10);
        this.createChart('chartTopComments', 'bar', {
            data: {
                labels: sorted.map(m => m.titre.substring(0, 20) + '...'),
                datasets: [{
                    label: 'Commentaires',
                    data: sorted.map(m => m.nb_commentaires || 0),
                    backgroundColor: this.colors.blue,
                    borderRadius: 4
                }]
            }
        });
    }

    // 6. Taux de Likes par Tranche de Note (Histogramme)
    renderLikesByRating(memoires) {
        const buckets = { '0-1': 0, '1-2': 0, '2-3': 0, '3-4': 0, '4-5': 0 };
        memoires.forEach(m => {
            const note = m.note_moyenne || 0;
            const likes = m.nb_likes || 0;
            if(note < 1) buckets['0-1'] += likes;
            else if(note < 2) buckets['1-2'] += likes;
            else if(note < 3) buckets['2-3'] += likes;
            else if(note < 4) buckets['3-4'] += likes;
            else buckets['4-5'] += likes;
        });

        this.createChart('chartLikesByRating', 'line', {
            data: {
                labels: Object.keys(buckets),
                datasets: [{
                    label: 'Volume de Likes',
                    data: Object.values(buckets),
                    borderColor: this.colors.pink,
                    backgroundColor: this.colors.transparent(this.colors.pink),
                    fill: true,
                    tension: 0.4
                }]
            }
        });
    }

    // 7. Répartition des Notes (Histogramme)
    renderRatingDist(memoires) {
        const counts = [0, 0, 0, 0, 0]; // 1 to 5
        memoires.forEach(m => {
            const n = Math.round(m.note_moyenne || 0);
            if(n >= 1 && n <= 5) counts[n-1]++;
        });

        this.createChart('chartRatingDist', 'bar', {
            data: {
                labels: ['1★', '2★', '3★', '4★', '5★'],
                datasets: [{
                    label: 'Nombre de Mémoires',
                    data: counts,
                    backgroundColor: this.colors.orange,
                    borderRadius: 4
                }]
            }
        });
    }

    // 8. Scatter Note vs Téléchargements
    renderScatterNoteDown(memoires) {
        const data = memoires
            .filter(m => (m.note_moyenne || 0) > 0)
            .map(m => ({
                x: m.note_moyenne,
                y: m.nb_telechargements || 0,
                r: 5
            }));

        this.createChart('chartScatterNoteDown', 'bubble', {
            data: {
                datasets: [{
                    label: 'Note vs DL',
                    data: data,
                    backgroundColor: this.colors.transparent(this.colors.teal),
                    borderColor: this.colors.teal
                }]
            },
            options: {
                scales: {
                    x: { title: { display: true, text: 'Note (0-5)' }, min: 0, max: 5.5 },
                    y: { title: { display: true, text: 'Téléchargements' } }
                }
            }
        });
    }

    // 9. User Pubs
    renderUserPubs(memoires) {
        const counts = {};
        memoires.forEach(m => {
            const name = m.auteur?.nom || m.auteur?.full_name || 'Inconnu';
            counts[name] = (counts[name] || 0) + 1;
        });
        
        const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 10);

        this.createChart('chartUserPubs', 'bar', {
            data: {
                labels: sorted.map(x => x[0]),
                datasets: [{
                    label: 'Mémoires publiés',
                    data: sorted.map(x => x[1]),
                    backgroundColor: this.colors.dark,
                    borderRadius: 4
                }]
            },
            options: { indexAxis: 'y' }
        });
    }

    // 10. Weekly Activity
    renderWeeklyActivity(memoires) {
        const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
        const counts = new Array(7).fill(0);
        
        memoires.forEach(m => {
            const d = new Date(m.created_at || Date.now()).getDay();
            counts[d]++;
        });

        this.createChart('chartWeeklyActivity', 'radar', {
            data: {
                labels: days,
                datasets: [{
                    label: 'Publications par jour',
                    data: counts,
                    backgroundColor: this.colors.transparent(this.colors.purple, '50'),
                    borderColor: this.colors.purple,
                    pointBackgroundColor: this.colors.purple
                }]
            }
        });
    }

    // 11. Viral Score
    renderViralScore(memoires) {
        const scored = memoires.map(m => ({
            t: m.titre,
            s: (m.nb_likes||0) + (m.nb_commentaires||0)*2 + (m.nb_telechargements||0)*0.5
        })).sort((a,b) => b.s - a.s).slice(0, 10);

        this.createChart('chartViralScore', 'bar', {
            data: {
                labels: scored.map(x => x.t.substring(0,15)+'...'),
                datasets: [{
                    label: 'Score Viral',
                    data: scored.map(x => x.s),
                    backgroundColor: 'rgba(255, 182, 6, 0.8)',
                    borderRadius: 4
                }]
            }
        });
    }

    // 12. Radar Domain Performance
    renderRadarDomain(memoires, domaines) {
        const labels = domaines.slice(0, 6).map(d => d.nom); // Limit to 6 for readability
        const dataLikes = [];
        const dataDLs = [];

        domaines.slice(0, 6).forEach(d => {
            const mems = memoires.filter(m => m.domaines_list && m.domaines_list.includes(d.slug));
            const l = mems.reduce((a,b) => a + (b.nb_likes||0), 0);
            const dl = mems.reduce((a,b) => a + (b.nb_telechargements||0), 0);
            dataLikes.push(l);
            dataDLs.push(dl);
        });

        this.createChart('chartRadarDomain', 'radar', {
            data: {
                labels,
                datasets: [
                    { label: 'Likes', data: dataLikes, borderColor: this.colors.red, backgroundColor: this.colors.transparent(this.colors.red) },
                    { label: 'Downloads', data: dataDLs, borderColor: this.colors.green, backgroundColor: this.colors.transparent(this.colors.green) }
                ]
            }
        });
    }

    // --- UTILS ---
    createChart(id, type, config) {
        const ctx = document.getElementById(id);
        if(!ctx) return;
        this.charts[id] = new Chart(ctx, {
            type,
            data: config.data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 12, padding: 15 } }
                },
                ...config.options
            }
        });
    }
}

// Export global
window.DashboardAnalytics = DashboardAnalytics;

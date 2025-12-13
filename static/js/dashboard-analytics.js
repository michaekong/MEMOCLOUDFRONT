/**
 * DashboardAnalytics v2.0 - 20 Graphiques Pertinents Basés sur Données Réelles
 * Nécessite: Chart.js 3.x, TailwindCSS
 */

class DashboardAnalytics {
    constructor(config) {
        this.apiBase = config.apiBase;
        this.univSlug = config.univSlug;
        this.token = config.token;
        this.containerId = config.containerId;
        this.charts = {};
        
        this.colors = {
            primary: '#ffb606',
            dark: '#3a3a3a',
            blue: '#3b82f6',
            purple: '#8b5cf6',
            green: '#10b981',
            red: '#ef4444',
            orange: '#f97316',
            teal: '#14b8a6',
            pink: '#ec4899',
            indigo: '#6366f1',
            cyan: '#06b6d4',
            lime: '#84cc16',
            amber: '#f59e0b',
            emerald: '#059669',
            rose: '#f43f5e',
            violet: '#7c3aed',
            gray: '#94a3b8'
        };
    }

    getHeaders() {
        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        };
    }

    async init() {
        this.renderSkeleton();
        try {
            const data = await this.fetchAllData();
            console.log('📊 Données chargées:', data);
            this.renderLayout(data);
            setTimeout(() => this.renderAllCharts(data), 150);
        } catch (e) {
            console.error("Dashboard Error:", e);
            document.getElementById(this.containerId).innerHTML = `
                <div class="flex flex-col items-center justify-center h-64 text-red-500">
                    <i class="fas fa-exclamation-triangle text-4xl mb-2"></i>
                    <p class="font-bold">Erreur de chargement</p>
                    <p class="text-sm">${e.message}</p>
                </div>`;
        }
    }

    async fetchAllData() {
        const endpoints = [
            // Users
            { key: 'users', url: `${this.apiBase}/auth/${this.univSlug}/users/?ordering=-id` },
            { key: 'annuaire', url: `${this.apiBase}/auth/${this.univSlug}/users/annuaire/` },
            
            // Mémoires
            { key: 'memoires', url: `${this.apiBase}/memoires/universites/${this.univSlug}/memoires/` },
            { key: 'stats', url: `${this.apiBase}/memoires/universites/${this.univSlug}/stats/` },
            { key: 'annees', url: `${this.apiBase}/memoires/universites/${this.univSlug}/memoires/annees/` },
            
            // Domaines
            { key: 'domaines', url: `${this.apiBase}/universites/domaines/` },
            
            // News
            { key: 'news', url: `${this.apiBase}/universites/universities/${this.univSlug}/news/` },
            
            // Interactions (si disponibles)
            { key: 'likes', url: `${this.apiBase}/interactions/universites/${this.univSlug}/interactions/likes/`, optional: true },
            { key: 'comments', url: `${this.apiBase}/interactions/universites/${this.univSlug}/interactions/commentaires/`, optional: true }
        ];

        const results = {};
        
        for (const endpoint of endpoints) {
            try {
                const res = await fetch(endpoint.url, { headers: this.getHeaders() });
                if (res.ok) {
                    results[endpoint.key] = await res.json();
                } else if (!endpoint.optional) {
                    console.warn(`⚠️ Endpoint ${endpoint.key} failed:`, res.status);
                    results[endpoint.key] = [];
                }
            } catch (e) {
                if (!endpoint.optional) {
                    console.warn(`⚠️ Fetch error for ${endpoint.key}:`, e);
                }
                results[endpoint.key] = [];
            }
        }

        // Enrichissement: Calculer rôles si non disponibles
        if (results.users && results.users.length) {
            for (let user of results.users) {
                if (!user.role) {
                    try {
                        const roleRes = await fetch(`${this.apiBase}/universites/auth/universities/${this.univSlug}/user-role/${user.id}/`, 
                            { headers: this.getHeaders() });
                        if (roleRes.ok) {
                            const roleData = await roleRes.json();
                            user.role = roleData.role;
                        }
                    } catch (e) {
                        user.role = 'standard';
                    }
                }
            }
        }

        return results;
    }

    renderSkeleton() {
        const container = document.getElementById(this.containerId);
        container.innerHTML = `
            <div class="animate-pulse space-y-6">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    ${Array(4).fill('<div class="h-32 bg-gray-200 rounded-xl"></div>').join('')}
                </div>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    ${Array(4).fill('<div class="h-80 bg-gray-200 rounded-xl"></div>').join('')}
                </div>
            </div>`;
    }

    renderLayout(data) {
        const container = document.getElementById(this.containerId);
        const { users = [], memoires = [], stats = {} } = data;
        
        const totalDownloads = stats.total_telechargements || memoires.reduce((a, m) => a + (m.nb_telechargements || 0), 0);
        const totalLikes = stats.total_likes || memoires.reduce((a, m) => a + (m.nb_likes || 0), 0);
        const avgNote = stats.note_moyenne || (memoires.reduce((a, m) => a + (m.note_moyenne || 0), 0) / memoires.length).toFixed(1);
        
        container.innerHTML = `
            <div class="space-y-10 pb-12">
                <!-- KPI Cards -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    ${this.kpi('Utilisateurs', users.length, 'fa-users', 'blue')}
                    ${this.kpi('Mémoires', memoires.length, 'fa-book', 'yellow')}
                    ${this.kpi('Téléchargements', totalDownloads, 'fa-download', 'green')}
                    ${this.kpi('Note Moyenne', avgNote + '/5', 'fa-star', 'orange')}
                </div>

                <!-- Section 1: Vue d'ensemble -->
                <div class="space-y-4">
                    <h2 class="text-2xl font-bold text-brand-dark border-l-4 border-brand-yellow pl-3">📊 Vue d'Ensemble</h2>
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div class="chart-card"><h4>1. Évolution des Publications (Années)</h4><canvas id="chart1"></canvas></div>
                        <div class="chart-card"><h4>2. Répartition par Domaine</h4><canvas id="chart2"></canvas></div>
                    </div>
                </div>

                <!-- Section 2: Utilisateurs -->
                <div class="space-y-4">
                    <h2 class="text-2xl font-bold text-brand-dark border-l-4 border-blue-500 pl-3">👥 Analyse Utilisateurs</h2>
                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div class="chart-card"><h4>3. Répartition par Rôle</h4><canvas id="chart3"></canvas></div>
                        <div class="chart-card"><h4>4. Top 10 Auteurs Actifs</h4><canvas id="chart4"></canvas></div>
                        <div class="chart-card"><h4>5. Répartition Homme/Femme</h4><canvas id="chart5"></canvas></div>
                    </div>
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div class="chart-card"><h4>6. Inscriptions par Mois (Dernière Année)</h4><canvas id="chart6"></canvas></div>
                        <div class="chart-card"><h4>7. Top 10 Encadreurs les Plus Sollicités</h4><canvas id="chart7"></canvas></div>
                    </div>
                </div>

                <!-- Section 3: Popularité & Engagement -->
                <div class="space-y-4">
                    <h2 class="text-2xl font-bold text-brand-dark border-l-4 border-red-500 pl-3">🔥 Popularité & Engagement</h2>
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div class="chart-card"><h4>8. Top 15 Mémoires les Plus Téléchargés</h4><canvas id="chart8"></canvas></div>
                        <div class="chart-card"><h4>9. Top 15 Mémoires les Plus Likés</h4><canvas id="chart9"></canvas></div>
                    </div>
                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div class="chart-card"><h4>10. Distribution des Téléchargements</h4><canvas id="chart10"></canvas></div>
                        <div class="chart-card"><h4>11. Distribution des Likes</h4><canvas id="chart11"></canvas></div>
                        <div class="chart-card"><h4>12. Distribution des Commentaires</h4><canvas id="chart12"></canvas></div>
                    </div>
                </div>

                <!-- Section 4: Qualité & Notes -->
                <div class="space-y-4">
                    <h2 class="text-2xl font-bold text-brand-dark border-l-4 border-yellow-500 pl-3">⭐ Qualité & Satisfaction</h2>
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div class="chart-card"><h4>13. Répartition des Notes (0-5)</h4><canvas id="chart13"></canvas></div>
                        <div class="chart-card"><h4>14. Note Moyenne par Domaine</h4><canvas id="chart14"></canvas></div>
                    </div>
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div class="chart-card"><h4>15. Corrélation: Note vs Téléchargements</h4><canvas id="chart15"></canvas></div>
                        <div class="chart-card"><h4>16. Corrélation: Note vs Likes</h4><canvas id="chart16"></canvas></div>
                    </div>
                </div>

                <!-- Section 5: Métriques Avancées -->
                <div class="space-y-4">
                    <h2 class="text-2xl font-bold text-brand-dark border-l-4 border-purple-500 pl-3">🎯 Métriques Avancées</h2>
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div class="chart-card"><h4>17. Score Viral (Likes + Comm×2 + DL×0.5)</h4><canvas id="chart17"></canvas></div>
                        <div class="chart-card"><h4>18. Taux d'Engagement par Domaine</h4><canvas id="chart18"></canvas></div>
                    </div>
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div class="chart-card"><h4>19. Performance Globale (Radar Multi-Domaines)</h4><canvas id="chart19"></canvas></div>
                        <div class="chart-card"><h4>20. Activité Hebdomadaire (Publications par Jour)</h4><canvas id="chart20"></canvas></div>
                    </div>
                </div>

                <!-- Section 6: Analyse Temporelle -->
                <div class="space-y-4">
                    <h2 class="text-2xl font-bold text-brand-dark border-l-4 border-teal-500 pl-3">⏰ Analyse Temporelle</h2>
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div class="chart-card"><h4>21. Publications par Mois (Dernière Année)</h4><canvas id="chart21"></canvas></div>
                        <div class="chart-card"><h4>22. Croissance Cumulative des Mémoires</h4><canvas id="chart22"></canvas></div>
                    </div>
                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div class="chart-card"><h4>23. Heures de Publication (24h)</h4><canvas id="chart23"></canvas></div>
                        <div class="chart-card"><h4>24. Saisonnalité (Trimestres)</h4><canvas id="chart24"></canvas></div>
                        <div class="chart-card"><h4>25. Ancienneté des Mémoires</h4><canvas id="chart25"></canvas></div>
                    </div>
                </div>

                <!-- Section 7: Analyse de Contenu -->
                <div class="space-y-4">
                    <h2 class="text-2xl font-bold text-brand-dark border-l-4 border-pink-500 pl-3">📄 Analyse de Contenu</h2>
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div class="chart-card"><h4>26. Distribution Nombre de Pages</h4><canvas id="chart26"></canvas></div>
                        <div class="chart-card"><h4>27. Taille des Fichiers (Mo)</h4><canvas id="chart27"></canvas></div>
                    </div>
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div class="chart-card"><h4>28. Longueur des Résumés (caractères)</h4><canvas id="chart28"></canvas></div>
                        <div class="chart-card"><h4>29. Mémoires avec/sans Résumé</h4><canvas id="chart29"></canvas></div>
                    </div>
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div class="chart-card"><h4>30. Répartition par Langue</h4><canvas id="chart30"></canvas></div>
                        <div class="chart-card"><h4>31. Mémoires Confidentiels vs Publics</h4><canvas id="chart31"></canvas></div>
                    </div>
                </div>

                <!-- Section 8: Comparaisons & Ratios -->
                <div class="space-y-4">
                    <h2 class="text-2xl font-bold text-brand-dark border-l-4 border-amber-500 pl-3">⚖️ Comparaisons & Ratios</h2>
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div class="chart-card"><h4>32. Ratio Likes/Téléchargements par Mémoire</h4><canvas id="chart32"></canvas></div>
                        <div class="chart-card"><h4>33. Taux de Conversion (DL/Vue)</h4><canvas id="chart33"></canvas></div>
                    </div>
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div class="chart-card"><h4>34. Engagement Moyen par Auteur (Top 10)</h4><canvas id="chart34"></canvas></div>
                        <div class="chart-card"><h4>35. Productivité par Encadreur</h4><canvas id="chart35"></canvas></div>
                    </div>
                </div>

                <!-- Section 9: Analyse Avancée Multi-Critères -->
                <div class="space-y-4">
                    <h2 class="text-2xl font-bold text-brand-dark border-l-4 border-rose-500 pl-3">🔬 Analyse Multi-Critères</h2>
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div class="chart-card"><h4>36. Matrice Note × Engagement (Bubble)</h4><canvas id="chart36"></canvas></div>
                        <div class="chart-card"><h4>37. Pareto 80/20 (Téléchargements)</h4><canvas id="chart37"></canvas></div>
                    </div>
                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div class="chart-card"><h4>38. Top Domaines Croisés (Heatmap)</h4><canvas id="chart38"></canvas></div>
                        <div class="chart-card"><h4>39. Évolution Note Moyenne (Années)</h4><canvas id="chart39"></canvas></div>
                        <div class="chart-card"><h4>40. Indice de Qualité Global</h4><canvas id="chart40"></canvas></div>
                    </div>
                </div>

                <!-- Section 10: KPIs Temps Réel -->
                <div class="space-y-4">
                    <h2 class="text-2xl font-bold text-brand-dark border-l-4 border-cyan-500 pl-3">📡 Performance & KPIs</h2>
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div class="chart-card"><h4>41. Top 10 Mémoires en Tendance (Score 7j)</h4><canvas id="chart41"></canvas></div>
                        <div class="chart-card"><h4>42. Distribution des Vues (si disponible)</h4><canvas id="chart42"></canvas></div>
                    </div>
                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div class="chart-card"><h4>43. Ratio Commentaires/Likes</h4><canvas id="chart43"></canvas></div>
                        <div class="chart-card"><h4>44. Mémoires les Plus Complets</h4><canvas id="chart44"></canvas></div>
                        <div class="chart-card"><h4>45. Taux de Participation (Utilisateurs)</h4><canvas id="chart45"></canvas></div>
                    </div>
                </div>
            </div>
        `;
    }

    kpi(label, value, icon, color) {
        const colors = {
            blue: 'bg-blue-50 text-blue-600',
            yellow: 'bg-yellow-50 text-yellow-600',
            green: 'bg-green-50 text-green-600',
            orange: 'bg-orange-50 text-orange-600',
            red: 'bg-red-50 text-red-600'
        };
        return `
            <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-lg transition-all">
                <div class="w-14 h-14 rounded-xl ${colors[color]} flex items-center justify-center text-2xl">
                    <i class="fas ${icon}"></i>
                </div>
                <div>
                    <p class="text-gray-500 text-xs font-bold uppercase">${label}</p>
                    <h3 class="text-3xl font-bold text-brand-dark">${value}</h3>
                </div>
            </div>`;
    }

    renderAllCharts(data) {
        Object.values(this.charts).forEach(c => c?.destroy());
        this.charts = {};

        console.log('🎨 Rendu des graphiques avec données:', data);

        // 1. Évolution Publications par Année
        this.chart1(data);
        
        // 2. Répartition par Domaine
        this.chart2(data);
        
        // 3. Répartition par Rôle
        this.chart3(data);
        
        // 4. Top Auteurs
        this.chart4(data);
        
        // 5. Genre
        this.chart5(data);
        
        // 6. Inscriptions par Mois
        this.chart6(data);
        
        // 7. Top Encadreurs
        this.chart7(data);
        
        // 8. Top Téléchargements
        this.chart8(data);
        
        // 9. Top Likes
        this.chart9(data);
        
        // 10-12. Distributions
        this.chart10(data);
        this.chart11(data);
        this.chart12(data);
        
        // 13. Répartition Notes
        this.chart13(data);
        
        // 14. Note par Domaine
        this.chart14(data);
        
        // 15-16. Corrélations
        this.chart15(data);
        this.chart16(data);
        
        // 17. Score Viral
        this.chart17(data);
        
        // 18. Taux Engagement
        this.chart18(data);
        
        // 19. Radar
        this.chart19(data);
        
        // 20. Activité Hebdo
        this.chart20(data);
        
        // 21-25. Analyse Temporelle
        this.chart21(data);
        this.chart22(data);
        this.chart23(data);
        this.chart24(data);
        this.chart25(data);
        
        // 26-31. Analyse Contenu
        this.chart26(data);
        this.chart27(data);
        this.chart28(data);
        this.chart29(data);
        this.chart30(data);
        this.chart31(data);
        
        // 32-35. Comparaisons
        this.chart32(data);
        this.chart33(data);
        this.chart34(data);
        this.chart35(data);
        
        // 36-40. Multi-critères
        this.chart36(data);
        this.chart37(data);
        this.chart38(data);
        this.chart39(data);
        this.chart40(data);
        
        // 41-45. Performance
        this.chart41(data);
        this.chart42(data);
        this.chart43(data);
        this.chart44(data);
        this.chart45(data);
        
        console.log('✅ Tous les graphiques créés:', Object.keys(this.charts).length);
    }

    // === GRAPHIQUES ===

    // 1. Évolution Publications par Année
    chart1(data) {
        const { memoires = [], annees = {} } = data;
        const years = annees.annees || [...new Set(memoires.map(m => m.annee))].sort();
        const counts = years.map(y => memoires.filter(m => m.annee == y).length);
        
        this.create('chart1', 'line', {
            labels: years,
            datasets: [{
                label: 'Publications',
                data: counts,
                borderColor: this.colors.primary,
                backgroundColor: this.colors.primary + '30',
                fill: true,
                tension: 0.4
            }]
        });
    }

    // 2. Répartition par Domaine
    chart2(data) {
        const { memoires = [], domaines = [] } = data;
        const counts = {};
        domaines.forEach(d => counts[d.nom] = 0);
        
        memoires.forEach(m => {
            if (m.domaines_list && m.domaines_list.length) {
                m.domaines_list.forEach(slug => {
                    const d = domaines.find(x => x.slug === slug);
                    if (d) counts[d.nom]++;
                });
            }
        });

        const labels = Object.keys(counts);
        const values = Object.values(counts);
        
        this.create('chart2', 'doughnut', {
            labels,
            datasets: [{
                data: values,
                backgroundColor: Object.values(this.colors).slice(0, labels.length)
            }]
        });
    }

    // 3. Répartition par Rôle
    chart3(data) {
        const { users = [] } = data;
        const roles = { standard: 0, professeur: 0, admin: 0, superadmin: 0, bigboss: 0 };
        users.forEach(u => roles[u.role || 'standard']++);
        
        this.create('chart3', 'pie', {
            labels: ['Étudiants', 'Professeurs', 'Admins', 'Super Admins', 'Big Boss'],
            datasets: [{
                data: Object.values(roles),
                backgroundColor: [this.colors.blue, this.colors.green, this.colors.orange, this.colors.purple, this.colors.red]
            }]
        });
    }

    // 4. Top 10 Auteurs
    chart4(data) {
        const { memoires = [] } = data;
        const counts = {};
        memoires.forEach(m => {
            const name = m.auteur?.nom || m.auteur?.full_name || 'Inconnu';
            counts[name] = (counts[name] || 0) + 1;
        });
        
        const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 10);
        
        this.create('chart4', 'bar', {
            labels: sorted.map(x => x[0]),
            datasets: [{
                label: 'Mémoires',
                data: sorted.map(x => x[1]),
                backgroundColor: this.colors.indigo
            }]
        }, { indexAxis: 'y' });
    }

    // 5. Genre
    chart5(data) {
        const { users = [] } = data;
        const m = users.filter(u => u.sexe === 'M').length;
        const f = users.filter(u => u.sexe === 'F').length;
        
        this.create('chart5', 'doughnut', {
            labels: ['Hommes', 'Femmes'],
            datasets: [{
                data: [m, f],
                backgroundColor: [this.colors.blue, this.colors.pink]
            }]
        });
    }

    // 6. Inscriptions par Mois (12 derniers)
    chart6(data) {
        const { users = [] } = data;
        const now = new Date();
        const months = [];
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push(d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }));
        }
        
        const counts = months.map(() => 0);
        users.forEach(u => {
            const date = new Date(u.date_joined);
            const diff = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
            if (diff >= 0 && diff < 12) counts[11 - diff]++;
        });
        
        this.create('chart6', 'line', {
            labels: months,
            datasets: [{
                label: 'Inscriptions',
                data: counts,
                borderColor: this.colors.teal,
                backgroundColor: this.colors.teal + '30',
                fill: true,
                tension: 0.3
            }]
        });
    }

    // 7. Top Encadreurs
    chart7(data) {
        const { memoires = [] } = data;
        const counts = {};
        memoires.forEach(m => {
            (m.encadreurs || []).forEach(e => {
                const name = e.nom || e.full_name || 'Inconnu';
                counts[name] = (counts[name] || 0) + 1;
            });
        });
        
        const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 10);
        
        this.create('chart7', 'bar', {
            labels: sorted.map(x => x[0]),
            datasets: [{
                label: 'Mémoires Encadrés',
                data: sorted.map(x => x[1]),
                backgroundColor: this.colors.emerald
            }]
        }, { indexAxis: 'y' });
    }

    // 8. Top Téléchargements
    chart8(data) {
        const { memoires = [] } = data;
        const sorted = [...memoires].sort((a,b) => (b.nb_telechargements||0) - (a.nb_telechargements||0)).slice(0, 15);
        
        this.create('chart8', 'bar', {
            labels: sorted.map(m => m.titre.substring(0, 20) + '...'),
            datasets: [{
                label: 'Téléchargements',
                data: sorted.map(m => m.nb_telechargements || 0),
                backgroundColor: this.colors.green
            }]
        }, { indexAxis: 'y' });
    }

    // 9. Top Likes
    chart9(data) {
        const { memoires = [] } = data;
        const sorted = [...memoires].sort((a,b) => (b.nb_likes||0) - (a.nb_likes||0)).slice(0, 15);
        
        this.create('chart9', 'bar', {
            labels: sorted.map(m => m.titre.substring(0, 20) + '...'),
            datasets: [{
                label: 'Likes',
                data: sorted.map(m => m.nb_likes || 0),
                backgroundColor: this.colors.red
            }]
        }, { indexAxis: 'y' });
    }

    // 10. Distribution Téléchargements
    chart10(data) {
        const { memoires = [] } = data;
        const buckets = { '0-10': 0, '11-50': 0, '51-100': 0, '101-200': 0, '200+': 0 };
        
        memoires.forEach(m => {
            const dl = m.nb_telechargements || 0;
            if (dl <= 10) buckets['0-10']++;
            else if (dl <= 50) buckets['11-50']++;
            else if (dl <= 100) buckets['51-100']++;
            else if (dl <= 200) buckets['101-200']++;
            else buckets['200+']++;
        });
        
        this.create('chart10', 'bar', {
            labels: Object.keys(buckets),
            datasets: [{
                label: 'Mémoires',
                data: Object.values(buckets),
                backgroundColor: this.colors.cyan
            }]
        });
    }

    // 11. Distribution Likes
    chart11(data) {
        const { memoires = [] } = data;
        const buckets = { '0': 0, '1-5': 0, '6-10': 0, '11-20': 0, '20+': 0 };
        
        memoires.forEach(m => {
            const l = m.nb_likes || 0;
            if (l === 0) buckets['0']++;
            else if (l <= 5) buckets['1-5']++;
            else if (l <= 10) buckets['6-10']++;
            else if (l <= 20) buckets['11-20']++;
            else buckets['20+']++;
        });
        
        this.create('chart11', 'bar', {
            labels: Object.keys(buckets),
            datasets: [{
                label: 'Mémoires',
                data: Object.values(buckets),
                backgroundColor: this.colors.rose
            }]
        });
    }

    // 12. Distribution Commentaires
    chart12(data) {
        const { memoires = [] } = data;
        const buckets = { '0': 0, '1-3': 0, '4-10': 0, '10+': 0 };
        
        memoires.forEach(m => {
            const c = m.nb_commentaires || 0;
            if (c === 0) buckets['0']++;
            else if (c <= 3) buckets['1-3']++;
            else if (c <= 10) buckets['4-10']++;
            else buckets['10+']++;
        });
        
        this.create('chart12', 'bar', {
            labels: Object.keys(buckets),
            datasets: [{
                label: 'Mémoires',
                data: Object.values(buckets),
                backgroundColor: this.colors.violet
            }]
        });
    }

    // 13. Répartition Notes
    chart13(data) {
        const { memoires = [] } = data;
        const counts = [0, 0, 0, 0, 0]; // 1 à 5
        
        memoires.forEach(m => {
            const n = Math.round(m.note_moyenne || 0);
            if (n >= 1 && n <= 5) counts[n-1]++;
        });
        
        this.create('chart13', 'bar', {
            labels: ['1★', '2★', '3★', '4★', '5★'],
            datasets: [{
                label: 'Nombre',
                data: counts,
                backgroundColor: [this.colors.red, this.colors.orange, this.colors.amber, this.colors.lime, this.colors.green]
            }]
        });
    }

    // 14. Note Moyenne par Domaine
    chart14(data) {
        const { memoires = [], domaines = [] } = data;
        const stats = {};
        
        domaines.forEach(d => stats[d.nom] = { sum: 0, count: 0 });
        
        memoires.forEach(m => {
            if (m.domaines_list && m.note_moyenne) {
                m.domaines_list.forEach(slug => {
                    const d = domaines.find(x => x.slug === slug);
                    if (d && stats[d.nom]) {
                        stats[d.nom].sum += m.note_moyenne;
                        stats[d.nom].count++;
                    }
                });
            }
        });
        
        const labels = Object.keys(stats).filter(k => stats[k].count > 0);
        const avgs = labels.map(k => (stats[k].sum / stats[k].count).toFixed(2));
        
        this.create('chart14', 'bar', {
            labels,
            datasets: [{
                label: 'Note Moyenne',
                data: avgs,
                backgroundColor: this.colors.primary
            }]
        });
    }

    // 15. Scatter: Note vs DL
    chart15(data) {
        const { memoires = [] } = data;
        const points = memoires
            .filter(m => (m.note_moyenne || 0) > 0)
            .map(m => ({ x: m.note_moyenne, y: m.nb_telechargements || 0 }));
        
        this.create('chart15', 'scatter', {
            datasets: [{
                label: 'Mémoires',
                data: points,
                backgroundColor: this.colors.teal + '80'
            }]
        }, {
            scales: {
                x: { title: { display: true, text: 'Note' }, min: 0, max: 5.5 },
                y: { title: { display: true, text: 'Téléchargements' } }
            }
        });
    }

    // 16. Scatter: Note vs Likes
    chart16(data) {
        const { memoires = [] } = data;
        const points = memoires
            .filter(m => (m.note_moyenne || 0) > 0)
            .map(m => ({ x: m.note_moyenne, y: m.nb_likes || 0 }));
        
        this.create('chart16', 'scatter', {
            datasets: [{
                label: 'Mémoires',
                data: points,
                backgroundColor: this.colors.pink + '80'
            }]
        }, {
            scales: {
                x: { title: { display: true, text: 'Note' }, min: 0, max: 5.5 },
                y: { title: { display: true, text: 'Likes' } }
            }
        });
    }

    // 17. Score Viral
    chart17(data) {
        const { memoires = [] } = data;
        const scored = memoires.map(m => ({
            t: m.titre,
            s: (m.nb_likes||0) + (m.nb_commentaires||0)*2 + (m.nb_telechargements||0)*0.5
        })).sort((a,b) => b.s - a.s).slice(0, 15);
        
        this.create('chart17', 'bar', {
            labels: scored.map(x => x.t.substring(0, 15) + '...'),
            datasets: [{
                label: 'Score Viral',
                data: scored.map(x => x.s.toFixed(1)),
                backgroundColor: this.colors.primary
            }]
        }, { indexAxis: 'y' });
    }

    // 18. Taux Engagement par Domaine
    chart18(data) {
        const { memoires = [], domaines = [] } = data;
        const stats = {};
        
        domaines.forEach(d => stats[d.nom] = { likes: 0, comments: 0, dls: 0 });
        
        memoires.forEach(m => {
            if (m.domaines_list) {
                m.domaines_list.forEach(slug => {
                    const d = domaines.find(x => x.slug === slug);
                    if (d && stats[d.nom]) {
                        stats[d.nom].likes += m.nb_likes || 0;
                        stats[d.nom].comments += m.nb_commentaires || 0;
                        stats[d.nom].dls += m.nb_telechargements || 0;
                    }
                });
            }
        });
        
        const labels = Object.keys(stats);
        const engagement = labels.map(k => stats[k].likes + stats[k].comments + stats[k].dls);
        
        this.create('chart18', 'bar', {
            labels,
            datasets: [{
                label: 'Engagement Total',
                data: engagement,
                backgroundColor: this.colors.purple
            }]
        });
    }

    // 19. Radar Multi-Domaines
    chart19(data) {
        const { memoires = [], domaines = [] } = data;
        const top6 = domaines.slice(0, 6);
        const labels = top6.map(d => d.nom);
        
        const dataLikes = [];
        const dataDL = [];
        const dataComments = [];
        
        top6.forEach(d => {
            const mems = memoires.filter(m => m.domaines_list && m.domaines_list.includes(d.slug));
            dataLikes.push(mems.reduce((a, m) => a + (m.nb_likes || 0), 0));
            dataDL.push(mems.reduce((a, m) => a + (m.nb_telechargements || 0), 0));
            dataComments.push(mems.reduce((a, m) => a + (m.nb_commentaires || 0), 0));
        });
        
        this.create('chart19', 'radar', {
            labels,
            datasets: [
                { label: 'Likes', data: dataLikes, borderColor: this.colors.red, backgroundColor: this.colors.red + '30' },
                { label: 'Téléchargements', data: dataDL, borderColor: this.colors.green, backgroundColor: this.colors.green + '30' },
                { label: 'Commentaires', data: dataComments, borderColor: this.colors.blue, backgroundColor: this.colors.blue + '30' }
            ]
        });
    }

    // 20. Activité Hebdo
    chart20(data) {
        const { memoires = [] } = data;
        const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
        const counts = [0, 0, 0, 0, 0, 0, 0];
        
        memoires.forEach(m => {
            const d = new Date(m.created_at || Date.now()).getDay();
            counts[d]++;
        });
        
        this.create('chart20', 'bar', {
            labels: days,
            datasets: [{
                label: 'Publications',
                data: counts,
                backgroundColor: this.colors.indigo
            }]
        });
    }

    // === NOUVEAUX GRAPHIQUES (21-45) ===

    // 21. Publications par Mois (Dernière Année)
    chart21(data) {
        const { memoires = [] } = data;
        if (!memoires.length) return;
        
        const now = new Date();
        const months = [];
        const counts = [];
        
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push(d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }));
            counts.push(0);
        }
        
        memoires.forEach(m => {
            if (!m.created_at) return;
            const date = new Date(m.created_at);
            const diff = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
            if (diff >= 0 && diff < 12) counts[11 - diff]++;
        });
        
        this.create('chart21', 'line', {
            labels: months,
            datasets: [{
                label: 'Mémoires publiés',
                data: counts,
                borderColor: this.colors.primary,
                backgroundColor: this.colors.primary + '30',
                fill: true,
                tension: 0.4
            }]
        });
    }

    // 22. Croissance Cumulative
    chart22(data) {
        const { memoires = [] } = data;
        if (!memoires.length) return;
        
        const sorted = [...memoires]
            .filter(m => m.created_at)
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        
        const labels = [];
        const cumulative = [];
        let count = 0;
        const step = Math.max(1, Math.ceil(sorted.length / 20));
        
        sorted.forEach((m, i) => {
            count++;
            if (i % step === 0 || i === sorted.length - 1) {
                const date = new Date(m.created_at);
                labels.push(date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }));
                cumulative.push(count);
            }
        });
        
        this.create('chart22', 'line', {
            labels,
            datasets: [{
                label: 'Total Cumulé',
                data: cumulative,
                borderColor: this.colors.green,
                backgroundColor: this.colors.green + '20',
                fill: true,
                tension: 0.3
            }]
        });
    }

    // 23. Heures de Publication
    chart23(data) {
        const { memoires = [] } = data;
        if (!memoires.length) return;
        
        const hours = Array(24).fill(0);
        
        memoires.forEach(m => {
            if (!m.created_at) return;
            const h = new Date(m.created_at).getHours();
            hours[h]++;
        });
        
        this.create('chart23', 'bar', {
            labels: Array.from({ length: 24 }, (_, i) => i + 'h'),
            datasets: [{
                label: 'Publications',
                data: hours,
                backgroundColor: this.colors.cyan
            }]
        });
    }

    // 24. Saisonnalité (Trimestres)
    chart24(data) {
        const { memoires = [] } = data;
        if (!memoires.length) return;
        
        const quarters = { 'Q1 (Jan-Mar)': 0, 'Q2 (Avr-Juin)': 0, 'Q3 (Juil-Sep)': 0, 'Q4 (Oct-Déc)': 0 };
        
        memoires.forEach(m => {
            if (!m.created_at) return;
            const month = new Date(m.created_at).getMonth();
            if (month < 3) quarters['Q1 (Jan-Mar)']++;
            else if (month < 6) quarters['Q2 (Avr-Juin)']++;
            else if (month < 9) quarters['Q3 (Juil-Sep)']++;
            else quarters['Q4 (Oct-Déc)']++;
        });
        
        this.create('chart24', 'doughnut', {
            labels: Object.keys(quarters),
            datasets: [{
                data: Object.values(quarters),
                backgroundColor: [this.colors.blue, this.colors.green, this.colors.orange, this.colors.purple]
            }]
        });
    }

    // 25. Ancienneté des Mémoires
    chart25(data) {
        const { memoires = [] } = data;
        if (!memoires.length) return;
        
        const now = new Date();
        const buckets = { '< 6 mois': 0, '6-12 mois': 0, '1-2 ans': 0, '> 2 ans': 0 };
        
        memoires.forEach(m => {
            if (!m.created_at) return;
            const months = (now - new Date(m.created_at)) / (1000 * 60 * 60 * 24 * 30);
            if (months < 6) buckets['< 6 mois']++;
            else if (months < 12) buckets['6-12 mois']++;
            else if (months < 24) buckets['1-2 ans']++;
            else buckets['> 2 ans']++;
        });
        
        this.create('chart25', 'bar', {
            labels: Object.keys(buckets),
            datasets: [{
                label: 'Mémoires',
                data: Object.values(buckets),
                backgroundColor: this.colors.teal
            }]
        });
    }

    // 26. Distribution Nombre de Pages
    chart26(data) {
        const { memoires = [] } = data;
        if (!memoires.length) return;
        
        const buckets = { '0-50': 0, '51-100': 0, '101-150': 0, '151-200': 0, '200+': 0 };
        
        memoires.forEach(m => {
            const p = parseInt(m.nombre_pages) || 0;
            if (p === 0) return; // Ignorer les valeurs manquantes
            if (p <= 50) buckets['0-50']++;
            else if (p <= 100) buckets['51-100']++;
            else if (p <= 150) buckets['101-150']++;
            else if (p <= 200) buckets['151-200']++;
            else buckets['200+']++;
        });
        
        this.create('chart26', 'bar', {
            labels: Object.keys(buckets),
            datasets: [{
                label: 'Mémoires',
                data: Object.values(buckets),
                backgroundColor: this.colors.purple
            }]
        });
    }

    // 27. Taille des Fichiers
    chart27(data) {
        const { memoires = [] } = data;
        if (!memoires.length) return;
        
        const buckets = { '< 1 Mo': 0, '1-5 Mo': 0, '5-10 Mo': 0, '10-20 Mo': 0, '> 20 Mo': 0 };
        
        memoires.forEach(m => {
            const size = parseFloat(m.fichier_taille) || 0;
            if (size === 0) return;
            if (size < 1) buckets['< 1 Mo']++;
            else if (size < 5) buckets['1-5 Mo']++;
            else if (size < 10) buckets['5-10 Mo']++;
            else if (size < 20) buckets['10-20 Mo']++;
            else buckets['> 20 Mo']++;
        });
        
        this.create('chart27', 'bar', {
            labels: Object.keys(buckets),
            datasets: [{
                label: 'Mémoires',
                data: Object.values(buckets),
                backgroundColor: this.colors.orange
            }]
        });
    }

    // 28. Longueur des Résumés
    chart28(data) {
        const { memoires = [] } = data;
        if (!memoires.length) return;
        
        const buckets = { '0-100': 0, '101-300': 0, '301-500': 0, '500+': 0 };
        
        memoires.forEach(m => {
            const len = (m.resume || '').length;
            if (len === 0) return;
            if (len <= 100) buckets['0-100']++;
            else if (len <= 300) buckets['101-300']++;
            else if (len <= 500) buckets['301-500']++;
            else buckets['500+']++;
        });
        
        this.create('chart28', 'bar', {
            labels: Object.keys(buckets),
            datasets: [{
                label: 'Mémoires',
                data: Object.values(buckets),
                backgroundColor: this.colors.pink
            }]
        });
    }

    // 29. Avec/Sans Résumé
    chart29(data) {
        const { memoires = [] } = data;
        if (!memoires.length) return;
        
        const withResume = memoires.filter(m => m.resume && m.resume.length > 50).length;
        const withoutResume = memoires.length - withResume;
        
        this.create('chart29', 'doughnut', {
            labels: ['Avec Résumé', 'Sans Résumé'],
            datasets: [{
                data: [withResume, withoutResume],
                backgroundColor: [this.colors.green, this.colors.gray]
            }]
        });
    }

    // 30. Répartition par Langue
    chart30(data) {
        const { memoires = [] } = data;
        if (!memoires.length) return;
        
        const langs = {};
        
        memoires.forEach(m => {
            const lang = m.langue || 'Non renseignée';
            langs[lang] = (langs[lang] || 0) + 1;
        });
        
        this.create('chart30', 'pie', {
            labels: Object.keys(langs),
            datasets: [{
                data: Object.values(langs),
                backgroundColor: Object.values(this.colors).slice(0, Object.keys(langs).length)
            }]
        });
    }

    // 31. Confidentiels vs Publics
    chart31(data) {
        const { memoires = [] } = data;
        if (!memoires.length) return;
        
        const confidentiel = memoires.filter(m => m.est_confidentiel).length;
        const public_ = memoires.length - confidentiel;
        
        this.create('chart31', 'doughnut', {
            labels: ['Publics', 'Confidentiels'],
            datasets: [{
                data: [public_, confidentiel],
                backgroundColor: [this.colors.green, this.colors.red]
            }]
        });
    }

    // 32. Ratio Likes/DL
    chart32(data) {
        const { memoires = [] } = data;
        if (!memoires.length) return;
        
        const ratios = memoires
            .filter(m => (m.nb_telechargements || 0) > 0)
            .map(m => ({
                t: m.titre,
                r: parseFloat(((m.nb_likes || 0) / m.nb_telechargements * 100).toFixed(1))
            }))
            .sort((a, b) => b.r - a.r)
            .slice(0, 15);
        
        if (!ratios.length) return;
        
        this.create('chart32', 'bar', {
            labels: ratios.map(x => x.t.substring(0, 15) + '...'),
            datasets: [{
                label: 'Ratio (%)',
                data: ratios.map(x => x.r),
                backgroundColor: this.colors.violet
            }]
        }, { indexAxis: 'y' });
    }

    // 33. Taux de Conversion
    chart33(data) {
        const { memoires = [] } = data;
        if (!memoires.length) return;
        
        const conversions = memoires
            .filter(m => (m.nb_vues || 0) > 0)
            .map(m => ({
                t: m.titre,
                c: parseFloat(((m.nb_telechargements || 0) / m.nb_vues * 100).toFixed(1))
            }))
            .sort((a, b) => b.c - a.c)
            .slice(0, 15);
        
        if (conversions.length === 0) {
            this.create('chart33', 'bar', {
                labels: ['Données non disponibles'],
                datasets: [{ label: 'Info', data: [0], backgroundColor: this.colors.gray }]
            });
        } else {
            this.create('chart33', 'bar', {
                labels: conversions.map(x => x.t.substring(0, 15) + '...'),
                datasets: [{
                    label: 'Taux (%)',
                    data: conversions.map(x => x.c),
                    backgroundColor: this.colors.lime
                }]
            }, { indexAxis: 'y' });
        }
    }

    // 34. Engagement Moyen par Auteur
    chart34(data) {
        const { memoires = [] } = data;
        if (!memoires.length) return;
        
        const authors = {};
        
        memoires.forEach(m => {
            const name = m.auteur?.nom || m.auteur?.full_name || 'Inconnu';
            if (!authors[name]) authors[name] = { total: 0, count: 0 };
            authors[name].total += (m.nb_likes || 0) + (m.nb_commentaires || 0) + (m.nb_telechargements || 0);
            authors[name].count++;
        });
        
        const sorted = Object.entries(authors)
            .map(([name, data]) => ({ name, avg: parseFloat((data.total / data.count).toFixed(1)) }))
            .sort((a, b) => b.avg - a.avg)
            .slice(0, 10);
        
        if (!sorted.length) return;
        
        this.create('chart34', 'bar', {
            labels: sorted.map(x => x.name),
            datasets: [{
                label: 'Engagement Moyen',
                data: sorted.map(x => x.avg),
                backgroundColor: this.colors.emerald
            }]
        }, { indexAxis: 'y' });
    }

    // 35. Productivité Encadreurs
    chart35(data) {
        const { memoires = [] } = data;
        if (!memoires.length) return;
        
        const encadreurs = {};
        
        memoires.forEach(m => {
            (m.encadreurs || []).forEach(e => {
                const name = e.nom || e.full_name || 'Inconnu';
                if (!encadreurs[name]) encadreurs[name] = 0;
                encadreurs[name]++;
            });
        });
        
        const sorted = Object.entries(encadreurs)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        
        if (!sorted.length) return;
        
        this.create('chart35', 'bar', {
            labels: sorted.map(x => x[0]),
            datasets: [{
                label: 'Mémoires Encadrés',
                data: sorted.map(x => x[1]),
                backgroundColor: this.colors.amber
            }]
        });
    }

    // 36. Matrice Note × Engagement (Bubble)
    chart36(data) {
        const { memoires = [] } = data;
        if (!memoires.length) return;
        
        const points = memoires
            .filter(m => (m.note_moyenne || 0) > 0)
            .map(m => ({
                x: m.note_moyenne,
                y: (m.nb_likes || 0) + (m.nb_commentaires || 0),
                r: Math.max(5, Math.sqrt((m.nb_telechargements || 1)) * 2)
            }));
        
        if (!points.length) return;
        
        this.create('chart36', 'bubble', {
            datasets: [{
                label: 'Mémoires (taille = DL)',
                data: points,
                backgroundColor: this.colors.rose + '60',
                borderColor: this.colors.rose
            }]
        }, {
            scales: {
                x: { title: { display: true, text: 'Note' }, min: 0, max: 5.5 },
                y: { title: { display: true, text: 'Engagement (Likes + Comm)' } }
            }
        });
    }

    // 37. Pareto 80/20
    chart37(data) {
        const { memoires = [] } = data;
        if (!memoires.length) return;
        
        const sorted = [...memoires].sort((a, b) => (b.nb_telechargements || 0) - (a.nb_telechargements || 0));
        const total = sorted.reduce((a, m) => a + (m.nb_telechargements || 0), 0);
        
        if (total === 0) return;
        
        let cumul = 0;
        const cumulative = [];
        const dls = [];
        const step = Math.max(1, Math.ceil(sorted.length / 20));
        
        sorted.forEach((m, i) => {
            cumul += m.nb_telechargements || 0;
            if (i % step === 0 || i === sorted.length - 1) {
                dls.push(m.nb_telechargements || 0);
                cumulative.push(parseFloat((cumul / total * 100).toFixed(1)));
            }
        });
        
        this.create('chart37', 'line', {
            labels: dls.map((_, i) => `M${i + 1}`),
            datasets: [
                {
                    label: 'Téléchargements',
                    data: dls,
                    type: 'bar',
                    backgroundColor: this.colors.blue + '80',
                    yAxisID: 'y'
                },
                {
                    label: '% Cumulé',
                    data: cumulative,
                    type: 'line',
                    borderColor: this.colors.red,
                    backgroundColor: this.colors.red + '20',
                    fill: true,
                    yAxisID: 'y1',
                    tension: 0.4
                }
            ]
        }, {
            scales: {
                y: { type: 'linear', position: 'left', title: { display: true, text: 'DL' } },
                y1: { type: 'linear', position: 'right', title: { display: true, text: '%' }, min: 0, max: 100, grid: { drawOnChartArea: false } }
            }
        });
    }

    // 38. Top Domaines Croisés
    chart38(data) {
        const { memoires = [], domaines = [] } = data;
        if (!memoires.length || !domaines.length) return;
        
        const counts = {};
        domaines.slice(0, 6).forEach(d => counts[d.nom] = 0);
        
        memoires.forEach(m => {
            if (m.domaines_list && m.domaines_list.length > 0) {
                m.domaines_list.forEach(slug => {
                    const d = domaines.find(x => x.slug === slug);
                    if (d && counts[d.nom] !== undefined) {
                        counts[d.nom]++;
                    }
                });
            }
        });
        
        const labels = Object.keys(counts);
        const values = Object.values(counts);
        
        if (labels.length === 0) return;
        
        this.create('chart38', 'bar', {
            labels,
            datasets: [{
                label: 'Mémoires',
                data: values,
                backgroundColor: Object.values(this.colors).slice(0, labels.length)
            }]
        });
    }

    // 39. Évolution Note Moyenne (Années)
    chart39(data) {
        const { memoires = [] } = data;
        if (!memoires.length) return;
        
        const years = [...new Set(memoires.map(m => m.annee))].filter(Boolean).sort();
        const avgs = years.map(y => {
            const mems = memoires.filter(m => m.annee == y && m.note_moyenne);
            const sum = mems.reduce((a, m) => a + (m.note_moyenne || 0), 0);
            return mems.length ? parseFloat((sum / mems.length).toFixed(2)) : 0;
        });
        
        if (years.length === 0) return;
        
        this.create('chart39', 'line', {
            labels: years,
            datasets: [{
                label: 'Note Moyenne',
                data: avgs,
                borderColor: this.colors.primary,
                backgroundColor: this.colors.primary + '30',
                fill: true,
                tension: 0.4
            }]
        });
    }

    // 40. Indice de Qualité Global
    chart40(data) {
        const { memoires = [] } = data;
        if (!memoires.length) return;
        
        const scores = memoires.map(m => {
            let score = 0;
            if (m.note_moyenne >= 4) score += 30;
            else if (m.note_moyenne >= 3) score += 20;
            else if (m.note_moyenne > 0) score += 10;
            
            if ((m.resume || '').length > 200) score += 20;
            if ((m.nombre_pages || 0) > 100) score += 15;
            if ((m.nb_telechargements || 0) > 50) score += 15;
            if ((m.nb_likes || 0) > 10) score += 10;
            if ((m.encadreurs || []).length > 0) score += 10;
            
            return { t: m.titre, s: score };
        }).sort((a, b) => b.s - a.s).slice(0, 15);
        
        if (!scores.length) return;
        
        this.create('chart40', 'bar', {
            labels: scores.map(x => x.t.substring(0, 15) + '...'),
            datasets: [{
                label: 'Indice Qualité (/100)',
                data: scores.map(x => x.s),
                backgroundColor: this.colors.primary
            }]
        }, { indexAxis: 'y' });
    }

    // 41. Top Tendance (Score 7j simulé)
    chart41(data) {
        const { memoires = [] } = data;
        if (!memoires.length) return;
        
        const now = new Date();
        
        const trending = memoires
            .filter(m => {
                if (!m.created_at) return false;
                const days = (now - new Date(m.created_at)) / (1000 * 60 * 60 * 24);
                return days <= 30;
            })
            .map(m => ({
                t: m.titre,
                s: (m.nb_likes || 0) * 3 + (m.nb_telechargements || 0) * 2 + (m.nb_commentaires || 0) * 5
            }))
            .sort((a, b) => b.s - a.s)
            .slice(0, 10);
        
        if (!trending.length) return;
        
        this.create('chart41', 'bar', {
            labels: trending.map(x => x.t.substring(0, 15) + '...'),
            datasets: [{
                label: 'Score Tendance',
                data: trending.map(x => x.s),
                backgroundColor: this.colors.red
            }]
        }, { indexAxis: 'y' });
    }

    // 42. Distribution des Vues
    chart42(data) {
        const { memoires = [] } = data;
        if (!memoires.length) return;
        
        const hasViews = memoires.some(m => (m.nb_vues || 0) > 0);
        
        if (!hasViews) {
            this.create('chart42', 'bar', {
                labels: ['Données non disponibles'],
                datasets: [{ label: 'Info', data: [0], backgroundColor: this.colors.gray }]
            });
        } else {
            const buckets = { '0-100': 0, '101-500': 0, '501-1000': 0, '1000+': 0 };
            memoires.forEach(m => {
                const v = m.nb_vues || 0;
                if (v <= 100) buckets['0-100']++;
                else if (v <= 500) buckets['101-500']++;
                else if (v <= 1000) buckets['501-1000']++;
                else buckets['1000+']++;
            });
            
            this.create('chart42', 'bar', {
                labels: Object.keys(buckets),
                datasets: [{
                    label: 'Mémoires',
                    data: Object.values(buckets),
                    backgroundColor: this.colors.indigo
                }]
            });
        }
    }

    // 43. Ratio Commentaires/Likes
    chart43(data) {
        const { memoires = [] } = data;
        if (!memoires.length) return;
        
        const totalLikes = memoires.reduce((a, m) => a + (m.nb_likes || 0), 0);
        const totalComments = memoires.reduce((a, m) => a + (m.nb_commentaires || 0), 0);
        
        if (totalLikes === 0 && totalComments === 0) return;
        
        this.create('chart43', 'doughnut', {
            labels: ['Likes', 'Commentaires'],
            datasets: [{
                data: [totalLikes, totalComments],
                backgroundColor: [this.colors.red, this.colors.blue]
            }]
        });
    }

    // 44. Mémoires les Plus Complets
    chart44(data) {
        const { memoires = [] } = data;
        if (!memoires.length) return;
        
        const scored = memoires.map(m => {
            let completeness = 0;
            if (m.resume && m.resume.length > 100) completeness += 25;
            if ((m.nombre_pages || 0) > 50) completeness += 25;
            if (m.pdf_url) completeness += 20;
            if (m.images) completeness += 10;
            if ((m.encadreurs || []).length > 0) completeness += 10;
            if ((m.domaines_list || []).length > 0) completeness += 10;
            
            return { t: m.titre, c: completeness };
        }).sort((a, b) => b.c - a.c).slice(0, 15);
        
        if (!scored.length) return;
        
        this.create('chart44', 'bar', {
            labels: scored.map(x => x.t.substring(0, 15) + '...'),
            datasets: [{
                label: 'Complétude (%)',
                data: scored.map(x => x.c),
                backgroundColor: this.colors.green
            }]
        }, { indexAxis: 'y' });
    }

    // 45. Taux de Participation
    chart45(data) {
        const { users = [], memoires = [] } = data;
        if (!users.length || !memoires.length) return;
        
        const authors = new Set(memoires.map(m => m.auteur?.id).filter(Boolean));
        const participationRate = parseFloat(((authors.size / users.length) * 100).toFixed(1));
        
        this.create('chart45', 'doughnut', {
            labels: ['Ont publié', 'N\'ont pas publié'],
            datasets: [{
                data: [authors.size, users.length - authors.size],
                backgroundColor: [this.colors.green, this.colors.gray]
            }]
        }, {
            plugins: {
                title: { display: true, text: `Taux: ${participationRate}%` }
            }
        });
    }

    // === HELPER ===
    create(id, type, data, options = {}) {
        const ctx = document.getElementById(id);
        if (!ctx) {
            console.warn(`Canvas #${id} non trouvé`);
            return;
        }
        
        try {
            this.charts[id] = new Chart(ctx, {
                type,
                data,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { 
                            position: 'bottom', 
                            labels: { boxWidth: 12, padding: 10 },
                            display: type !== 'doughnut' && type !== 'pie' || (data.datasets && data.datasets.length > 1)
                        }
                    },
                    ...options
                }
            });
        } catch (e) {
            console.error(`Erreur création chart ${id}:`, e);
        }
    }
}

// Style CSS pour les cartes
const style = document.createElement('style');
style.textContent = `
    .chart-card {
        background: white;
        padding: 1.5rem;
        border-radius: 1rem;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        border: 1px solid #e5e7eb;
        height: 400px;
        display: flex;
        flex-direction: column;
    }
    .chart-card h4 {
        font-weight: bold;
        color: #3a3a3a;
        margin-bottom: 1rem;
        font-size: 0.875rem;
    }
    .chart-card canvas {
        flex: 1;
        min-height: 0;
    }
`;
document.head.appendChild(style);

// Export
window.DashboardAnalytics = DashboardAnalytics;
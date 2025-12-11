/**
 * DomaineManager – ES6 module
 * Handles: list, suggest, create, delete
 * End-points expected:
 *   GET  /api/universites/<slug>/domaines/          -> list
 *   POST /api/universites/<slug>/domaines/          -> create
 *   DEL  /api/universites/<slug>/domaines/<slug>/   -> remove link (+ purge if last univ)
 *   GET  /api/domaines/suggest/?q=<query>           -> trigram suggestions
 * -----------------------------------------------------------------------------
 * The back-end MUST return JSON with at least:
 *   {id, nom, slug, universites:[{id,nom,acronyme}]}
 */

class DomaineManager {
  constructor() {
    this.universiteSlug  = window.UNIV_SLUG || null; // injected by template
    this.domaines        = [];
    this.suggestions     = [];
    this.selectedSuggest = -1;
    this.searchDebounce  = null;
    this.init();
  }

  /* ---------- public ---------- */
  init() {
    if (!this.universiteSlug) { console.warn('[DM] no UNIV_SLUG'); return; }
    this.cacheDom();
    this.bindEvents();
    this.loadDomaines();
  }

  /* ---------- DOM cache ---------- */
  cacheDom() {
    this.DOM = {
      listBox      : document.getElementById('domaines-container'),
      searchInput  : document.getElementById('domaine-search'),
      suggestBox   : document.getElementById('suggestions-box'),
      addModal     : document.getElementById('add-domaine-modal'),
      addForm      : document.getElementById('add-domaine-form'),
      addInput     : document.getElementById('new-domaine-nom'),
      slugPreview  : document.getElementById('slug-preview'),
      emptyTpl     : document.getElementById('empty-domaine-tpl')?.innerHTML || '<p>Aucun domaine</p>'
    };
  }
  /* ✅ onEdit à l’intérieur de la classe */
  async onEdit(slug) {
    const domaine = this.domaines.find(d => d.slug === slug);
    if (!domaine) return;
    this.editingSlug = slug;
    this.openAddModal(true);
    this.DOM.addInput.value = domaine.nom;
    this.previewSlug();
    this.DOM.addModal.querySelector('h3').textContent = 'Modifier le domaine';
    this.DOM.addForm.querySelector('button[type="submit"]').textContent = 'Enregistrer';
  }
  /* ---------- events ---------- */
  bindEvents() {
    /* search */
    this.DOM.searchInput?.addEventListener('input', e => this.onSearch(e.target.value));
    this.DOM.searchInput?.addEventListener('keydown', e => this.onSearchKey(e));

    /* add */
    this.DOM.addForm?.addEventListener('submit', e => this.onAdd(e));
    this.DOM.addInput?.addEventListener('input', () => this.previewSlug());
    document.querySelector('[data-action="open-add-modal"]')
            ?.addEventListener('click', () => this.openAddModal(true));

    /* delete */
    this.DOM.listBox.addEventListener('click', e => {
      const btn = e.target.closest('[data-action="delete"]');
      if (btn) this.onDelete(btn.dataset.slug, btn.dataset.nom);
    });

    /* modal close */
    this.DOM.addModal?.querySelector('.modal-close')
            .addEventListener('click', () => this.openAddModal(false));
            this.DOM.listBox.addEventListener('click', e => {
  const editBtn = e.target.closest('[data-action="edit"]');
  if (editBtn) {
    e.stopPropagation();
    this.onEdit(editBtn.dataset.slug);
    return;
  }
  const delBtn = e.target.closest('[data-action="delete"]');
  if (delBtn) this.onDelete(delBtn.dataset.slug, delBtn.dataset.nom);
});
  }
async init() {
  if (!this.universiteSlug) { console.warn('[DM] no UNIV_SLUG'); return; }
  this.cacheDom();
  this.bindEvents();
  await this.loadUserRole(); // ← on attend le rôle
  await this.loadDomaines(); // puis on affiche
}

  /* ---------- load / render ---------- */
  async loadDomaines() {
    try {
      const res = await fetch(`${API_BASE}/universites/universites/${this.universiteSlug}/domaines/`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error(res.status);
      const jsonData = await res.json();
      const res1 = await fetch(`${API_URL}/universites/auth/${UNIV_SLUG}/my-role/`, {
                 headers: getAuthHeaders()
            });
            if (!res1.ok) throw new Error('Erreur chargement rôle');
            const user_role = await res1.json();

this.domaines = jsonData;

 this.renderList(user_role);
    }
     catch (e) {
      showToast('Impossible de charger les domaines', 'error');
    }
  }

  renderList(UROLE) {
    const box = this.DOM.listBox;
    if (!this.domaines.length) { box.innerHTML = this.DOM.emptyTpl; return; }
   
    box.innerHTML = this.domaines.map(d => `
      <div class="domaine-card" data-id="${d.id}">
        <div class="domaine-main">
          <h4>${escapeHtml(d.nom)} <small>/${d.slug}</small></h4>
          <div class="domaine-tags">
            ${d.universites.map(u =>
              `<span class="tag">${escapeHtml(u.acronyme||u.nom)}</span>`
            ).join('')}
          </div>
        </div>
        
        ${UROLE?.role?.match(/admin|superadmin|bigboss/) ? `
        <button class="btn-icon-danger" data-action="delete"
                data-slug="${d.slug}" data-nom="${escapeHtml(d.nom)}"
                title="Supprimer"><i class="fas fa-trash"></i></button>
                <button class="btn-icon-warning" data-action="edit"
        data-slug="${d.slug}" data-nom="${escapeHtml(d.nom)}"
        title="Modifier"><i class="fas fa-edit"></i></button>
        ` : ''}
      </div>`).join('');
  }

  /* ---------- search / suggest ---------- */
  onSearch(query) {
    clearTimeout(this.searchDebounce);
    if (query.length < 2) { this.clearSuggestions(); return; }
    this.searchDebounce = setTimeout(() => this.fetchSuggestions(query), 200);
  }

  async fetchSuggestions(q) {
    try {
      const res = await fetch(`${API_BASE}/universites/domaines/suggest/?q=${encodeURIComponent(q)}`, {
        headers: getAuthHeaders()
      });
      this.suggestions = await res.json();
      this.renderSuggestions();
    } catch { this.clearSuggestions(); }
  }

  renderSuggestions() {
    const box = this.DOM.suggestBox;
    if (!this.suggestions.length) { box.style.display='none'; return; }
    box.innerHTML = this.suggestions.map((s,i) =>
      `<li class="suggest-item ${i===this.selectedSuggest?'selected':''}"
          data-index="${i}">${escapeHtml(s.nom)}</li>`).join('');
    box.style.display = 'block';
    this.selectedSuggest = -1;
  }

  clearSuggestions() {
    this.DOM.suggestBox.innerHTML = '';
    this.DOM.suggestBox.style.display = 'none';
    this.selectedSuggest = -1;
  }

  onSearchKey(e) {
    const items = this.DOM.suggestBox.querySelectorAll('li');
    if (!items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.selectedSuggest = Math.min(this.selectedSuggest+1, items.length-1);
      this.highlightSuggest(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.selectedSuggest = Math.max(this.selectedSuggest-1, -1);
      this.highlightSuggest(items);
    } else if (e.key === 'Enter' && this.selectedSuggest > -1) {
      e.preventDefault();
      this.selectSuggestion(items[this.selectedSuggest].textContent);
    } else if (e.key === 'Escape') this.clearSuggestions();
  }

  highlightSuggest(nodes) {
    nodes.forEach((n,i) => n.classList.toggle('selected', i===this.selectedSuggest));
  }

  selectSuggestion(nom) {
    this.DOM.addInput.value = nom;
    this.clearSuggestions();
  }

  /* ---------- add ---------- */
 openAddModal(show) {
  this.DOM.addModal.classList.toggle('active', show);
  if (show) {
    this.DOM.addInput.focus();
  } else {
    this.DOM.addForm.reset();
    this.editingSlug = null;
    // Remet le titre & bouton à l’état « créer »
    this.DOM.addModal.querySelector('h3').textContent = 'Nouveau domaine';
    this.DOM.addForm.querySelector('button[type="submit"]').textContent = 'Créer';
  }
}
  previewSlug() {
    const nom = this.DOM.addInput.value.trim();
    const slug = nom.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\W+/g,'-').toLowerCase();
    this.DOM.slugPreview.textContent = slug ? `Slug : ${slug}` : '';
  }

  async onAdd(e) {
  e.preventDefault();
  const nom = this.DOM.addInput.value.trim();
  if (!nom) return showToast('Nom requis', 'warning');

  // Mode édition
  // ---------- MODE ÉDITION ----------
if (this.editingSlug) {
  if (this.domaines.some(d => d.slug !== this.editingSlug && d.nom.toLowerCase() === nom.toLowerCase()))
    return showToast('Ce nom existe déjà', 'warning');

  try {
   // dans onAdd (mode édition)
const res = await fetch(`${API_BASE}/universites/universites/${this.universiteSlug}/domaines/${this.editingSlug}/update/`, {
  method: 'PATCH',
  headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
  body: JSON.stringify({ nom })
});
    const updated = await res.json();
    const idx = this.domaines.findIndex(d => d.slug === this.editingSlug);
    this.domaines[idx] = updated;
    this.renderList();
    this.openAddModal(false);
    showToast('Domaine modifié', 'success');
    this.editingSlug = null;
    return; // ← on sort pour ne pas faire la création
  } catch (e) {
    showToast(e.message || 'Modification impossible', 'error');
    return;
  }
}

  // --- Sinon : création (code déjà présent) ---
  if (this.domaines.some(d => d.nom.toLowerCase() === nom.toLowerCase()))
    return showToast('Ce domaine existe déjà', 'warning');

  try {
    const res = await fetch(`${API_BASE}/universites/universites/${this.universiteSlug}/domaines/create/`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom })
    });
    if (!res.ok) throw new Error((await res.json()).detail || 'Erreur');
    const created = await res.json();
    this.domaines.push(created);
    this.renderList();
    this.openAddModal(false);
    showToast('Domaine créé', 'success');
  } catch (e) {
    showToast(e.message || 'Création impossible', 'error');
  }
}

  /* ---------- delete ---------- */
  async onDelete(slug, nom) {
    if (!confirm(`Supprimer « ${nom} » ?\n(sera définitivement effacé s’il ne reste plus aucune université liée)`)) return;
    try {
      const res = await fetch(`${API_BASE}/universites/universites/${this.universiteSlug}/domaines/${slug}/`, {
        method : 'DELETE',
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Erreur');
      this.domaines = this.domaines.filter(d => d.slug !== slug);
      this.renderList();
      showToast('Domaine supprimé', 'success');
    } catch (e) {
      showToast(e.message||'Suppression impossible', 'error');
    }
  }

  /* ---------- helpers ---------- */
  getCurrentUnivId()  { return window.UNIV_ID   || null; }
  getCurrentUnivSlug(){ return window.UNIV_SLUG || null; }
 
}

/* ---------- petite lib utilitaire (si vous ne l’avez pas) ---------- */
export const getAuthHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('authToken')||''}` });
export const escapeHtml = (str) => str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
export const showToast = (msg, type='info') => {
  const t = document.createElement('div'); t.className=`toast ${type}`; t.textContent=msg;
  document.body.appendChild(t); setTimeout(()=>t.remove(), 3000);
};
export const API_BASE = window.API_BASE || '/api'; // injected by template

/* ---------- single instance ---------- */
const manager = new DomaineManager();

/* ---------- rendre disponible globalement ---------- */
window.loadDomaines = () => manager.loadDomaines();
window.domaineManager = manager;   // debug / extensibilité
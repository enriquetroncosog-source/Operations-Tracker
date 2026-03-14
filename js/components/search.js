// ============================================
// CECSO Tracker - Search Component
// ============================================

const SearchComponent = {

  render() {
    const bar = document.getElementById('search-bar');
    bar.innerHTML = `
      <div class="search-group">
        <div class="search-wrap">
          <svg class="search-icon" width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/>
          </svg>
          <input type="text" id="search-input" placeholder="Buscar por invoice, caja, proveedor o transportista" />
        </div>
      </div>
      <button class="btn-primary" id="btn-search">Buscar</button>
      <button class="btn-secondary" id="btn-new-op-bar">+ Nueva</button>
    `;

    this.bindEvents();
  },

  bindEvents() {
    document.getElementById('btn-search').addEventListener('click', () => this.doSearch());
    document.getElementById('btn-new-op-bar').addEventListener('click', () => DashboardComponent.showOpForm());

    document.getElementById('search-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.doSearch();
    });
  },

  doSearch() {
    const term = document.getElementById('search-input').value.trim();
    if (!term) return;

    const valClean = term.toUpperCase();
    const ops = App.toDisplayOps(Store.getAll());

    // Search locally
    const matches = ops.filter(o => {
      const inv = (o.invoice || '').toUpperCase();
      const caja = (o.caja || '').toUpperCase();
      const prov = (o.proveedor || '').toUpperCase();
      const trans = (o.transportista || '').toUpperCase();
      return inv.includes(valClean) || caja.includes(valClean) ||
             prov.includes(valClean) || trans.includes(valClean) ||
             (o.pedimentos || []).some(p => p.includes(valClean));
    });

    if (matches.length === 1) {
      OperationDetail.render(matches[0]);
    } else if (matches.length > 1) {
      DashboardComponent.renderWithOps(matches);
    } else {
      DashboardComponent.showEmpty(`No se encontraron operaciones para "${term}".`);
    }
  }
};

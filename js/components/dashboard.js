// ============================================
// CECSO Tracker - Dashboard Component
// ============================================

const DashboardComponent = {

  renderHeader() {
    const header = document.getElementById('app-header');
    header.innerHTML = `
      <div class="header-left">
        <div class="logo-sm">CIS</div>
        <span class="header-title">Operations Tracker</span>
        <span class="header-badge">CECSO</span>
      </div>
      <div class="header-right">
        <div class="user-pill">
          <div class="user-dot"></div>
          <span id="user-email">${Auth.userEmail || ''}</span>
        </div>
        <button class="btn-logout" id="btn-logout">Salir</button>
      </div>
    `;

    document.getElementById('btn-logout').addEventListener('click', () => App.logout());
  },

  render(ops) {
    this.renderHeader();
    this.renderWithOps(ops);
  },

  renderWithOps(ops) {
    const dv = document.getElementById('dashboard-view');
    Router.navigate('dashboard');

    if (!ops.length) {
      this.showEmpty('No se encontraron operaciones.');
      return;
    }

    // Calculate stats
    const weekOps = ops.filter(o => Parser.isThisWeek(o.lastUpdate));
    const bodegaOps = ops.filter(o => o.status === 'bodega');
    const despachadas = ops.filter(o => o.status === 'despachado');
    const enProceso = ops.filter(o => o.status === 'en_proceso');

    dv.innerHTML = `
      <div class="stats-row">
        <div class="stat-card blue" data-filter="all">
          <div class="stat-label">Procesadas esta semana</div>
          <div class="stat-val blue">${weekOps.length}</div>
          <div class="stat-hint">Clic para ver detalle</div>
        </div>
        <div class="stat-card amber" data-filter="bodega">
          <div class="stat-label">Listas en bodega</div>
          <div class="stat-val amber">${bodegaOps.length}</div>
          <div class="stat-hint">DODA enviado</div>
        </div>
        <div class="stat-card green" data-filter="despachado">
          <div class="stat-label">Despachadas</div>
          <div class="stat-val green">${despachadas.length}</div>
          <div class="stat-hint">Completadas</div>
        </div>
        <div class="stat-card red" data-filter="en_proceso">
          <div class="stat-label">En proceso</div>
          <div class="stat-val red">${enProceso.length}</div>
          <div class="stat-hint">Pendientes de despacho</div>
        </div>
      </div>
      <div class="board-grid">${ops.map(op => this.opCard(op)).join('')}</div>
    `;

    this.bindCardEvents(ops);
    this.bindStatEvents(ops, weekOps, bodegaOps, despachadas, enProceso);
  },

  opCard(op) {
    const si = op.currentStageIdx;
    const dots = STAGES.map((_, i) =>
      `<div class="mini-seg ${i < si ? 'done' : i === si ? 'now' : ''}"></div>`
    ).join('');
    const dotCls = op.status === 'despachado' ? 'done' : 'prog';
    const dateStr = Parser.fmtDate(op.lastUpdate);
    const stageLabel = STAGES[si]?.label || '—';
    const cajaLine = op.cajas.length ? `<div class="op-meta" style="margin-top:2px"><span>Caja: ${op.cajas.join(', ')}</span></div>` : '';

    return `<div class="op-card" data-id="${op.id}">
      <div class="op-ref">${op.displayRef}</div>
      <div class="op-stage">${stageLabel}</div>
      ${cajaLine}
      <div class="mini-track">${dots}</div>
      <div class="op-foot">
        <div class="op-meta">
          <span>${dateStr}</span>
          <span>${op.emailCount} correos</span>
        </div>
        <div class="status-dot ${dotCls}"></div>
      </div>
    </div>`;
  },

  bindCardEvents(ops) {
    document.querySelectorAll('.op-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const op = ops.find(o => o.id === id);
        if (op) OperationDetail.render(op);
      });
    });
  },

  bindStatEvents(ops, weekOps, bodegaOps, despachadas, enProceso) {
    document.querySelectorAll('.stat-card').forEach(card => {
      card.addEventListener('click', () => {
        const filter = card.dataset.filter;
        let filtered, title;

        switch (filter) {
          case 'all':
            filtered = weekOps;
            title = 'Operaciones procesadas esta semana';
            break;
          case 'bodega':
            filtered = bodegaOps;
            title = 'Operaciones listas en bodega (DODA enviado)';
            break;
          case 'despachado':
            filtered = despachadas;
            title = 'Operaciones despachadas';
            break;
          case 'en_proceso':
            filtered = enProceso;
            title = 'Operaciones en proceso';
            break;
        }

        if (filtered) {
          OperationsList.render(filtered, title);
        }
      });
    });
  },

  showLoading(msg) {
    const dv = document.getElementById('dashboard-view');
    Router.navigate('dashboard');
    dv.innerHTML = `
      <div class="state-box">
        <div class="spinner"></div>
        <div class="state-desc">${msg}</div>
      </div>
    `;
  },

  showEmpty(msg) {
    const dv = document.getElementById('dashboard-view');
    dv.innerHTML = `
      <div class="state-box">
        <div class="state-icon">📭</div>
        <div class="state-desc">${msg}</div>
      </div>
    `;
  },

  showError(msg) {
    const dv = document.getElementById('dashboard-view');
    dv.innerHTML = `
      <div class="state-box">
        <div class="state-icon">⚠️</div>
        <div class="state-desc">${msg}</div>
      </div>
    `;
  },

  showWelcome() {
    const dv = document.getElementById('dashboard-view');
    dv.innerHTML = `
      <div class="state-box">
        <div class="state-icon">📦</div>
        <div class="state-title">Listo para buscar</div>
        <div class="state-desc">
          Ingresa un número de caja, factura o pedimento para ver el detalle,
          o presiona <strong>Recientes</strong> para cargar las últimas operaciones.
        </div>
      </div>
    `;
  }
};

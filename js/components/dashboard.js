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
      <div style="margin-bottom:12px">
        <button class="btn-primary" id="btn-new-op">+ Nueva Operaci&oacute;n</button>
      </div>
      <div class="board-grid">${ops.map(op => this.opCard(op)).join('')}</div>
    `;

    document.getElementById('btn-new-op').addEventListener('click', () => this.showOpForm());
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
    const subLine = [
      op.cajas?.length ? `Caja: ${op.cajas.join(', ')}` : '',
      op.parties?.proveedor ? op.parties.proveedor : '',
    ].filter(Boolean).join(' · ');

    return `<div class="op-card" data-id="${op.id}">
      <div class="op-ref">${op.displayRef}</div>
      <div class="op-stage">${stageLabel}</div>
      ${subLine ? `<div class="op-meta" style="margin-bottom:6px"><span>${subLine}</span></div>` : ''}
      <div class="mini-track">${dots}</div>
      <div class="op-foot">
        <div class="op-meta">
          <span>${dateStr}</span>
          <span>${op.emailCount || 0} correos</span>
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

  // Show form to create or edit an operation
  showOpForm(editOp) {
    const modal = document.getElementById('config-modal');
    const isEdit = !!editOp;
    modal.innerHTML = `
      <div class="modal">
        <h3>${isEdit ? 'Editar' : 'Nueva'} Operaci&oacute;n</h3>
        <p>Ingresa los datos principales de la operaci&oacute;n. Los correos se asociar&aacute;n autom&aacute;ticamente.</p>
        <label class="form-label">Invoice / Factura</label>
        <input type="text" id="op-invoice" placeholder="Ej: 26NI013718" value="${editOp?.invoice || editOp?.facturas?.[0] || ''}" />
        <label class="form-label">Caja / Econ&oacute;mico</label>
        <input type="text" id="op-caja" placeholder="Ej: 544437" value="${editOp?.caja || editOp?.cajas?.[0] || ''}" />
        <label class="form-label">Proveedor</label>
        <input type="text" id="op-proveedor" placeholder="Ej: New-Indy" value="${editOp?.proveedor || editOp?.parties?.proveedor || ''}" />
        <label class="form-label">Transportista</label>
        <input type="text" id="op-transportista" placeholder="Ej: INTRANSPORT TRUCKING INC" value="${editOp?.transportista || editOp?.parties?.transportista || ''}" />
        <div class="modal-footer">
          <button class="btn-secondary" id="op-cancel">Cancelar</button>
          <button class="btn-primary" id="op-save">${isEdit ? 'Guardar' : 'Crear Operaci&oacute;n'}</button>
        </div>
      </div>
    `;
    modal.style.display = 'flex';

    document.getElementById('op-cancel').addEventListener('click', () => {
      modal.style.display = 'none';
    });

    document.getElementById('op-save').addEventListener('click', () => {
      const data = {
        invoice: document.getElementById('op-invoice').value,
        caja: document.getElementById('op-caja').value,
        proveedor: document.getElementById('op-proveedor').value,
        transportista: document.getElementById('op-transportista').value,
      };
      if (!data.invoice && !data.caja) {
        alert('Ingresa al menos el invoice o la caja.');
        return;
      }
      // Check for duplicate invoice
      if (data.invoice) {
        const invClean = data.invoice.trim().toUpperCase();
        const existing = Store.getAll().find(o =>
          o.invoice === invClean && (!isEdit || o.id !== editOp?.id)
        );
        if (existing) {
          alert('Ya existe una operaci\u00f3n con el invoice ' + invClean);
          return;
        }
      }
      modal.style.display = 'none';
      if (isEdit) {
        App.editOperation(editOp.id, data);
      } else {
        App.createOperation(data);
      }
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
    Router.navigate('dashboard');
    dv.innerHTML = `
      <div class="state-box">
        <div class="state-icon">📦</div>
        <div class="state-title">Sin operaciones</div>
        <div class="state-desc">
          Crea tu primera operaci&oacute;n para comenzar a rastrear correos autom&aacute;ticamente.
        </div>
        <button class="btn-primary" id="btn-new-op-welcome" style="margin-top:12px">+ Nueva Operaci&oacute;n</button>
      </div>
    `;
    document.getElementById('btn-new-op-welcome').addEventListener('click', () => this.showOpForm());
  }
};

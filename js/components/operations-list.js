// ============================================
// CECSO Tracker - Operations List Component
// ============================================

const OperationsList = {

  render(ops, title) {
    const container = document.getElementById('operations-list-view');
    Router.navigate('list');

    if (!ops.length) {
      container.innerHTML = `
        <button class="back-link" id="list-back">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd"/>
          </svg>
          Volver al dashboard
        </button>
        <div class="state-box">
          <div class="state-icon">📭</div>
          <div class="state-title">Sin operaciones</div>
          <div class="state-desc">No hay operaciones en esta categoría.</div>
        </div>
      `;
      document.getElementById('list-back').addEventListener('click', () => Router.navigate('dashboard'));
      return;
    }

    const statusCounts = {
      despachado: ops.filter(o => o.status === 'despachado').length,
      bodega: ops.filter(o => o.status === 'bodega').length,
      en_proceso: ops.filter(o => o.status === 'en_proceso').length,
    };

    container.innerHTML = `
      <div class="list-header">
        <button class="back-link" id="list-back">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd"/>
          </svg>
          Dashboard
        </button>
        <h2>${title} <span class="count-badge">${ops.length}</span></h2>
        <div></div>
      </div>

      <div class="search-filters" style="margin-bottom:16px">
        <span class="filter-chip active" data-status="all">Todas (${ops.length})</span>
        <span class="filter-chip" data-status="en_proceso">En proceso (${statusCounts.en_proceso})</span>
        <span class="filter-chip" data-status="bodega">Bodega (${statusCounts.bodega})</span>
        <span class="filter-chip" data-status="despachado">Despachadas (${statusCounts.despachado})</span>
      </div>

      <div class="board-grid" id="ops-grid">
        ${ops.map(op => this.opRow(op)).join('')}
      </div>
    `;

    this.bindEvents(ops);
  },

  opRow(op) {
    const si = op.currentStageIdx;
    const dots = STAGES.map((_, i) =>
      `<div class="mini-seg ${i < si ? 'done' : i === si ? 'now' : ''}"></div>`
    ).join('');
    const stageLabel = STAGES[si]?.label || '—';
    const dateStr = Parser.fmtDate(op.lastUpdate);

    const statusClass = op.status === 'despachado' ? 'done' :
                         op.status === 'bodega' ? 'attn' : 'prog';
    const cajaLine = op.cajas.length ? `<span style="color:var(--text3);font-size:11px">Caja: ${op.cajas.join(', ')}</span>` : '';

    return `<div class="op-card" data-id="${op.id}" data-status="${op.status}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <div class="op-ref">${op.displayRef}</div>
        <div class="status-dot ${statusClass}"></div>
      </div>
      ${cajaLine}
      <div class="op-stage">${stageLabel} · ${Parser.getStatusLabel(op.status)}</div>
      <div class="mini-track">${dots}</div>
      <div class="op-foot">
        <div class="op-meta">
          <span>${dateStr}</span>
          <span>${op.emailCount} correos</span>
        </div>
      </div>
    </div>`;
  },

  bindEvents(ops) {
    document.getElementById('list-back').addEventListener('click', () => {
      Router.navigate('dashboard');
    });

    // Card clicks
    document.querySelectorAll('#operations-list-view .op-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const op = ops.find(o => o.id === id);
        if (op) OperationDetail.render(op);
      });
    });

    // Filter chips
    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        const status = chip.dataset.status;
        document.querySelectorAll('#ops-grid .op-card').forEach(card => {
          if (status === 'all' || card.dataset.status === status) {
            card.style.display = '';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  }
};

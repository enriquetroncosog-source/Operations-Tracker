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
          <input type="text" id="search-input" placeholder="Caja · Factura · Pedimento · Num. económico" />
        </div>
        <input type="date" class="search-date" id="search-date-from" title="Fecha desde" />
        <input type="date" class="search-date" id="search-date-to" title="Fecha hasta" />
      </div>
      <button class="btn-primary" id="btn-search">Buscar</button>
      <button class="btn-secondary" id="btn-recent">&#8635; Recientes</button>
    `;

    this.bindEvents();
  },

  bindEvents() {
    document.getElementById('btn-search').addEventListener('click', () => this.doSearch());
    document.getElementById('btn-recent').addEventListener('click', () => App.loadRecent());

    document.getElementById('search-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.doSearch();
    });
  },

  async doSearch() {
    const term = document.getElementById('search-input').value.trim();
    const dateFrom = document.getElementById('search-date-from').value;
    const dateTo = document.getElementById('search-date-to').value;

    if (!term && !dateFrom && !dateTo) return;

    DashboardComponent.showLoading('Buscando operaciones...');
    Router.navigate('dashboard');

    try {
      let messages = [];

      if (term && (dateFrom || dateTo)) {
        // Combined: term + date filter
        const termMsgs = await Gmail.search(term);
        const dateMsgs = await Gmail.searchByDate(dateFrom, dateTo);
        // Merge unique by checking IDs in snippets (we don't have IDs at this level)
        // Just combine and let groupByOperation deduplicate
        messages = [...termMsgs, ...dateMsgs];
      } else if (term) {
        messages = await Gmail.search(term);
      } else if (dateFrom || dateTo) {
        messages = await Gmail.searchByDate(dateFrom, dateTo);
      }

      if (!messages.length) {
        DashboardComponent.showEmpty(`No se encontraron resultados para "${term || 'rango de fechas'}".`);
        return;
      }

      const ops = Parser.groupByOperation(messages);

      if (term) {
        const valClean = term.toUpperCase().trim();
        const mainOp = ops.find(o =>
          o.cajas.some(c => c === valClean || c.replace('/', '') === valClean) ||
          o.pedimentos.includes(valClean) ||
          o.facturas.includes(valClean) ||
          (o.invoice && o.invoice === valClean)
        );

        if (mainOp && ops.length <= 3) {
          // Try to enrich with billing emails
          await this.enrichOperation(mainOp, messages.map(m => m.id || ''));
          OperationDetail.render(mainOp);
          return;
        }
      }

      // Show all results
      App.allOps = ops;
      DashboardComponent.renderWithOps(ops);

    } catch (e) {
      DashboardComponent.showError('Error: ' + e.message);
    }
  },

  async enrichOperation(op, existingIds) {
    try {
      const billingMsgs = await Gmail.fetchBillingEmails(op, existingIds);
      billingMsgs.forEach(msg => {
        const subj = Gmail.getHeader(msg, 'Subject');
        const frm = Gmail.getHeader(msg, 'From');
        const dt = Parser.parseDate(Gmail.getHeader(msg, 'Date'));
        const snip = msg.snippet || '';
        const stage = Parser.detectStage(subj, frm, snip);
        const party = Parser.detectParty(frm);
        op.emails.push({
          subject: subj, from: frm, fromName: Parser.parseName(frm),
          date: dt, stage, party
        });
      });
      if (billingMsgs.length) {
        op.emails.sort((a, b) => b.date - a.date);
        op.emailCount = op.emails.length;
        const newHighest = Math.max(...op.emails.map(e => STAGE_IDX[e.stage] ?? 0));
        op.currentStageIdx = newHighest;
        op.currentStage = STAGES[newHighest]?.id || op.currentStage;
        op.status = Parser.getStatus(newHighest);
      }
    } catch (e) {
      console.log('[Search] Billing enrichment failed:', e.message);
    }
  }
};

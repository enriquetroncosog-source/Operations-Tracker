// ============================================
// CECSO Tracker - Main Application
// ============================================

const App = {
  allOps: [],

  init() {
    LoginComponent.render();
    // Pre-initialize GSI when library loads (no token request yet)
    const waitGSI = setInterval(() => {
      if (typeof google !== 'undefined' && google.accounts) {
        clearInterval(waitGSI);
        Auth.initGSI();
      }
    }, 200);
  },

  onAuthSuccess() {
    console.log('[App] Auth success, token:', Auth.getToken() ? 'YES' : 'NO');
    LoginComponent.hide();
    document.getElementById('app').classList.add('visible');
    DashboardComponent.renderHeader();
    SearchComponent.render();
    this.loadOperations();
  },

  // Load operations from localStorage and render
  loadOperations() {
    const ops = Store.getAll();
    console.log('[App] Store has', ops.length, 'operations');
    if (!ops.length) {
      DashboardComponent.showWelcome();
      return;
    }
    this.allOps = ops;
    DashboardComponent.renderWithOps(this.toDisplayOps(ops));
    // Enrich in background
    this.enrichAll(ops);
  },

  // Enrich all operations with Gmail data
  async enrichAll(ops) {
    let updated = false;
    for (const op of ops) {
      // Skip if enriched recently (last 5 min)
      if (op.lastEnriched && (Date.now() - new Date(op.lastEnriched).getTime()) < 5 * 60 * 1000) {
        console.log('[Enrich] Skipping', op.invoice || op.caja, '(enriched', Math.round((Date.now() - new Date(op.lastEnriched).getTime()) / 1000), 's ago)');
        continue;
      }
      try {
        await this.enrichOne(op);
        updated = true;
      } catch (e) {
        console.log('[App] Enrich failed for', op.invoice || op.caja, e.message);
      }
    }
    if (updated) {
      this.allOps = Store.getAll();
      DashboardComponent.renderWithOps(this.toDisplayOps(this.allOps));
    }
  },

  // Enrich a single operation with Gmail emails
  async enrichOne(op) {
    const terms = [op.invoice, op.caja].filter(Boolean);
    if (!terms.length) { console.log('[Enrich] No terms for', op.id); return; }

    // Search with multiple query strategies
    if (!Auth.getToken()) {
      console.warn('[Enrich] No auth token available');
      return;
    }

    const query = terms.join(' OR ');
    console.log('[Enrich] Query:', query);
    const result = await Gmail.list(query, 40);
    console.log('[Enrich] Gmail result:', JSON.stringify(result).substring(0, 500));
    if (result.error) {
      console.error('[Enrich] Gmail API error:', result.error.code, result.error.message || result.error);
      if (result.error.code === 401) {
        console.log('[Enrich] Token expired, requesting fresh token...');
        try {
          await Auth.refreshToken();
          // Retry once with new token
          const retry = await Gmail.list(query, 40);
          if (retry.error || !retry.messages) return;
          result.messages = retry.messages;
        } catch (e) {
          console.error('[Enrich] Token refresh failed:', e);
          return;
        }
      } else {
        return;
      }
    }
    const msgIds = (result.messages || []).map(m => m.id);
    if (!msgIds.length) {
      op.lastEnriched = new Date().toISOString();
      Store.save(op);
      return;
    }

    const messages = await Gmail.fetchMessages(msgIds);
    const emails = [];
    const attachments = [];
    const pedimentos = new Set(op.pedimentos || []);
    const opData = { ...(op.opData || {}) };
    let highestStage = op.currentStageIdx || 0;

    for (const msg of messages) {
      const subject = Gmail.getHeader(msg, 'Subject');
      const from = Gmail.getHeader(msg, 'From');
      const date = Gmail.getHeader(msg, 'Date');
      const snippet = msg.snippet || '';
      const bodyText = Gmail.extractBodyText(msg);
      const fullText = subject + ' ' + snippet + ' ' + bodyText;

      const stage = Parser.detectStage(subject, from, snippet + ' ' + bodyText);
      const party = Parser.detectParty(from);
      const stageIdx = STAGE_IDX[stage] ?? 0;
      if (stageIdx > highestStage) highestStage = stageIdx;

      const ped = Parser.extractPedimento(fullText);
      if (ped) pedimentos.add(ped);
      Object.assign(opData, Parser.extractOperationData(fullText));

      const msgAttachments = Gmail.extractAttachments(msg);
      if (msgAttachments.length) attachments.push(...msgAttachments);

      emails.push({
        messageId: msg.id,
        subject, from,
        fromName: Parser.parseName(from),
        date, stage, party,
        summary: Parser.summarize(stage, subject),
      });
    }

    // Deduplicate emails by messageId
    const seen = new Set();
    op.emails = emails.filter(e => {
      if (seen.has(e.messageId)) return false;
      seen.add(e.messageId);
      return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    op.emailCount = op.emails.length;
    op.currentStageIdx = highestStage;
    op.currentStage = STAGES[highestStage]?.id || 'docs_proveedor';
    op.status = Parser.getStatus(highestStage);
    op.attachments = attachments;
    op.pedimentos = [...pedimentos];
    op.opData = opData;
    op.lastUpdate = op.emails[0]?.date || op.createdAt;
    op.lastEnriched = new Date().toISOString();

    Store.save(op);
  },

  // Convert stored ops to display format for components
  toDisplayOps(ops) {
    return ops.map(op => ({
      ...op,
      id: op.id,
      displayRef: op.invoice || op.caja || '—',
      cajas: op.caja ? [op.caja] : [],
      facturas: op.invoice ? [op.invoice] : [],
      lastUpdate: op.lastUpdate ? new Date(op.lastUpdate) : new Date(op.createdAt),
      emails: (op.emails || []).map(e => ({ ...e, date: new Date(e.date) })),
      parties: {
        proveedor: op.proveedor || null,
        transportista: op.transportista || null,
      },
    }));
  },

  // Create a new operation
  async createOperation(data) {
    const op = Store.create(data);
    Store.save(op);
    DashboardComponent.showLoading('Buscando correos relacionados...');
    try {
      await this.enrichOne(op);
      console.log('[App] Enriched op:', JSON.stringify(op).substring(0, 500));
    } catch (e) {
      console.error('[App] Initial enrich failed:', e);
    }
    this.allOps = Store.getAll();
    console.log('[App] Rendering', this.allOps.length, 'ops, first has', this.allOps[0]?.emails?.length, 'emails');
    DashboardComponent.renderWithOps(this.toDisplayOps(this.allOps));
  },

  // Edit an operation
  async editOperation(id, data) {
    const op = Store.getById(id);
    if (!op) return;
    op.invoice = (data.invoice || '').trim().toUpperCase();
    op.caja = (data.caja || '').trim().toUpperCase();
    op.proveedor = (data.proveedor || '').trim();
    op.transportista = (data.transportista || '').trim();
    op.lastEnriched = null; // Force re-enrich
    Store.save(op);
    DashboardComponent.showLoading('Actualizando...');
    try {
      await this.enrichOne(op);
    } catch (e) {
      console.log('[App] Re-enrich failed:', e.message);
    }
    this.allOps = Store.getAll();
    DashboardComponent.renderWithOps(this.toDisplayOps(this.allOps));
  },

  // Delete an operation
  deleteOperation(id) {
    Store.delete(id);
    this.allOps = Store.getAll();
    if (this.allOps.length) {
      DashboardComponent.renderWithOps(this.toDisplayOps(this.allOps));
    } else {
      DashboardComponent.showWelcome();
    }
    Router.navigate('dashboard');
  },

  logout() {
    Auth.logout();
    this.allOps = [];
    document.getElementById('app').classList.remove('visible');
    LoginComponent.render();
  }
};

window.addEventListener('load', () => App.init());

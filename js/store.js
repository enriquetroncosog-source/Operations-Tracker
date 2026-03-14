// ============================================
// CECSO Tracker - LocalStorage Store
// ============================================

const Store = {
  KEY: 'cis_operations',

  getAll() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY)) || [];
    } catch { return []; }
  },

  getById(id) {
    return this.getAll().find(op => op.id === id) || null;
  },

  save(op) {
    const ops = this.getAll();
    const idx = ops.findIndex(o => o.id === op.id);
    if (idx >= 0) {
      ops[idx] = op;
    } else {
      ops.unshift(op);
    }
    this._persist(ops);
    return op;
  },

  delete(id) {
    const ops = this.getAll().filter(o => o.id !== id);
    this._persist(ops);
  },

  _persist(ops) {
    localStorage.setItem(this.KEY, JSON.stringify(ops));
  },

  // Create a new operation from form data
  create(data) {
    return {
      id: crypto.randomUUID(),
      invoice: (data.invoice || '').trim().toUpperCase(),
      caja: (data.caja || '').trim().toUpperCase(),
      proveedor: (data.proveedor || '').trim(),
      transportista: (data.transportista || '').trim(),
      createdAt: new Date().toISOString(),
      lastEnriched: null,
      // Email-enriched fields
      emails: [],
      currentStage: 'docs_proveedor',
      currentStageIdx: 0,
      status: 'en_proceso',
      lastUpdate: new Date().toISOString(),
      emailCount: 0,
      attachments: [],
      pedimentos: [],
      opData: {},
    };
  }
};

// ============================================
// CECSO Tracker - Gmail API Module
// ============================================

const Gmail = {
  async list(query, max = 40) {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${max}`;
    const r = await fetch(url, {
      headers: { Authorization: 'Bearer ' + Auth.getToken() }
    });
    return r.json();
  },

  async get(id) {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`;
    const r = await fetch(url, {
      headers: { Authorization: 'Bearer ' + Auth.getToken() }
    });
    return r.json();
  },

  async fetchMessages(ids) {
    const results = [];
    const chunks = [];
    for (let i = 0; i < ids.length; i += 10) {
      chunks.push(ids.slice(i, i + 10));
    }
    for (const chunk of chunks) {
      const promises = chunk.map(id => this.get(id));
      const msgs = await Promise.all(promises);
      results.push(...msgs);
    }
    return results;
  },

  getHeader(msg, name) {
    const h = (msg.payload?.headers || []).find(
      x => x.name.toLowerCase() === name.toLowerCase()
    );
    return h?.value || '';
  },

  extractBodyText(msg) {
    try {
      const walk = (parts) => {
        for (const part of (parts || [])) {
          if (part?.mimeType === 'text/plain' && part?.body?.data) {
            return atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/')).substring(0, 800);
          }
          if (part?.parts) {
            const found = walk(part.parts);
            if (found) return found;
          }
        }
        return null;
      };
      const fromParts = walk(msg.payload?.parts || []);
      if (fromParts) return fromParts;
      if (msg.payload?.body?.data) {
        return atob(msg.payload.body.data.replace(/-/g, '+').replace(/_/g, '/')).substring(0, 800);
      }
    } catch (e) {
      console.log('[Gmail] body extract error:', e.message);
    }
    return '';
  },

  // Load recent CECSO operations
  async loadRecent() {
    const query = 'cecso OR CECSO newer_than:60d';
    const result = await this.list(query, 60);
    const msgs = result.messages || [];
    if (!msgs.length) return [];
    const details = await this.fetchMessages(msgs.map(m => m.id));
    return details;
  },

  // Search by specific term (caja, factura, pedimento, etc.)
  async search(term) {
    const valClean = term.toUpperCase().trim();

    const [r1, r2, r3] = await Promise.all([
      this.list(`${valClean} OR "caja ${valClean}"`, 60),
      this.list(`(despachada OR despachado) ${valClean}`, 20),
      this.list(`from:enrique (${valClean} OR "caja ${valClean}") newer_than:90d`, 20),
    ]);

    const allIds = [...new Set([
      ...(r1.messages || []).map(m => m.id),
      ...(r2.messages || []).map(m => m.id),
      ...(r3.messages || []).map(m => m.id),
    ])];

    if (!allIds.length) return [];
    return this.fetchMessages(allIds);
  },

  // Search by date range
  async searchByDate(dateFrom, dateTo) {
    const qFrom = dateFrom ? `after:${dateFrom}` : '';
    const qTo = dateTo ? `before:${dateTo}` : '';
    const query = `(cecso OR CECSO) ${qFrom} ${qTo}`.trim();
    const result = await this.list(query, 80);
    const msgs = result.messages || [];
    if (!msgs.length) return [];
    return this.fetchMessages(msgs.map(m => m.id));
  },

  // Fetch additional billing emails for an operation
  async fetchBillingEmails(op, existingIds) {
    const pedRef = op.pedimentos[0];
    const facRef = op.facturas[0];
    if (!pedRef && !facRef) return [];

    const query = [pedRef, facRef].filter(Boolean).join(' OR ');
    const rBill = await this.list(query, 20);
    const billIds = (rBill.messages || []).map(m => m.id)
      .filter(id => !existingIds.includes(id));

    if (!billIds.length) return [];
    return this.fetchMessages(billIds);
  }
};

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

  // Extract attachment info from a message
  extractAttachments(msg) {
    const attachments = [];
    const walk = (parts) => {
      for (const part of (parts || [])) {
        if (part.filename && part.filename.length > 0 && part.body) {
          attachments.push({
            filename: part.filename,
            mimeType: part.mimeType || '',
            size: part.body.size || 0,
            attachmentId: part.body.attachmentId,
            messageId: msg.id,
          });
        }
        if (part.parts) walk(part.parts);
      }
    };
    walk(msg.payload?.parts || []);
    return attachments;
  },

  // Peek at attachment content (returns decoded text for analysis)
  async peekAttachment(messageId, attachmentId) {
    try {
      const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`;
      const r = await fetch(url, {
        headers: { Authorization: 'Bearer ' + Auth.getToken() }
      });
      const data = await r.json();
      if (data.data) {
        // Decode base64url and extract readable text (first ~2000 chars)
        const b64 = data.data.replace(/-/g, '+').replace(/_/g, '/');
        const raw = atob(b64.substring(0, 8000)); // Only decode first chunk
        return raw;
      }
    } catch (e) {
      console.log('[Gmail] peekAttachment error:', e.message);
    }
    return '';
  },

  // Download an attachment
  async downloadAttachment(messageId, attachmentId, filename) {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`;
    const r = await fetch(url, {
      headers: { Authorization: 'Bearer ' + Auth.getToken() }
    });
    const data = await r.json();
    if (data.data) {
      // Convert base64url to regular base64
      const b64 = data.data.replace(/-/g, '+').replace(/_/g, '/');
      const byteChars = atob(b64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray]);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    }
  },

  extractBodyText(msg) {
    try {
      const decode = (data) => atob(data.replace(/-/g, '+').replace(/_/g, '/'));

      // Walk parts looking for text/plain first, then text/html as fallback
      const walkFor = (parts, mimeType) => {
        for (const part of (parts || [])) {
          if (part?.mimeType === mimeType && part?.body?.data) {
            return decode(part.body.data).substring(0, 5000);
          }
          if (part?.parts) {
            const found = walkFor(part.parts, mimeType);
            if (found) return found;
          }
        }
        return null;
      };

      // Try text/plain first
      let body = walkFor(msg.payload?.parts || [], 'text/plain');
      // Fallback to text/html and strip tags
      if (!body) {
        body = walkFor(msg.payload?.parts || [], 'text/html');
        if (body) body = body.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
      }
      if (body) return body;

      // Top-level body
      if (msg.payload?.body?.data) {
        return decode(msg.payload.body.data).substring(0, 5000);
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
  },

  // Send an email
  async sendEmail(to, subject, body) {
    const raw = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=UTF-8',
      '',
      body
    ].join('\r\n');

    const encoded = btoa(unescape(encodeURIComponent(raw)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + Auth.getToken(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw: encoded })
    });
    return r.json();
  }
};

// ============================================
// CECSO Tracker - Email Parser Module
// ============================================

const Parser = {

  extractPedimento(text) {
    const m = text.match(/pedimento[:\s#]+([\d]{6,10})/i);
    return m ? m[1] : null;
  },

  extractFactura(text) {
    // Match factura followed by a number/code, but exclude common Spanish words
    const m = text.match(/factura[:\s#]+([A-Z0-9][-A-Z0-9]{3,20})/i);
    if (!m) return null;
    const val = m[1].toUpperCase();
    // Filter out false positives (Spanish words that appear after "factura")
    const falsePositives = ['PUEDEN', 'PARA', 'PAGO', 'POR', 'COMO', 'ESTE', 'ESTA', 'SERA', 'TIENE', 'FAVOR', 'ENVIAR', 'ADJUNTA', 'CORRESPONDIENTE'];
    if (falsePositives.includes(val)) return null;
    return val;
  },

  extractCajas(text) {
    const matches = [];
    const re1 = /caja[:\s\/\s#]+([A-Z0-9]{3,10})/gi;
    let m;
    while ((m = re1.exec(text)) !== null) {
      matches.push(m[1].toUpperCase().replace(/\/$/, ''));
    }
    const re2 = /\b([A-Z]\d{4,7})\b/gi;
    while ((m = re2.exec(text)) !== null) {
      matches.push(m[1].toUpperCase());
    }
    return [...new Set(matches.filter(v => v.length >= 3))];
  },

  isSimilar(str, target) {
    str = str.toLowerCase();
    target = target.toLowerCase();
    if (str.includes(target)) return true;
    const skelStr = str.replace(/[aeiou]/g, '');
    const skelTarget = target.replace(/[aeiou]/g, '');
    if (skelStr.includes(skelTarget)) return true;
    return false;
  },

  detectStage(subject, from, snippet = '') {
    const s = (subject + ' ' + from + ' ' + snippet).toLowerCase();

    if (/factura.*honorar|honorarios|facturaci/i.test(s)) return 'despachado';
    if (
      /despacha[d]?[ao]?|d[e3]sp[a4]ch[a4]d[ao]|despa[cks]h|despach[aeio]/i.test(s) ||
      /d.sp.ch.d/i.test(s) ||
      this.isSimilar(s, 'despachado') ||
      this.isSimilar(s, 'despachada') ||
      /liberado|libre|salida.*aduana|fwd:.*despacho/i.test(s)
    ) return 'despachado';

    if (/\bdoda\b|doda.*enviad/i.test(s)) return 'doda';
    if (/\bmve\b|solicitud.*mve|mva/i.test(s)) return 'mve';
    if (/proforma|cotizaci/i.test(s)) return 'proforma';
    return 'docs_proveedor';
  },

  detectParty(from) {
    const f = from.toLowerCase();
    if (f.includes('cecso')) return 'cliente';
    if (f.includes('new-indy') || f.includes('newmill') || f.includes('noreply')) return 'proveedor';
    if (f.includes('troncoso') || f.includes('logistico') || f.includes('tj@') || f.includes('operacion')) return 'agencia';
    if (f.includes('transport') || f.includes('carrier') || f.includes('trucking')) return 'transportista';
    return 'agencia';
  },

  parseName(from) {
    const m = from.match(/^"?([^"<]+)"?\s*</);
    if (m) return m[1].trim();
    const m2 = from.match(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+)/);
    if (m2) return m2[2].split('.')[0].replace(/\b\w/g, c => c.toUpperCase());
    return from;
  },

  parseDate(raw) {
    try { return new Date(raw); } catch { return new Date(); }
  },

  fmtDate(d) {
    if (!d) return '';
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
  },

  fmtDateTime(d) {
    if (!d) return '';
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  },

  // Group raw messages into operation objects
  groupByOperation(messages) {
    const groups = {};

    messages.forEach(msg => {
      const subject = Gmail.getHeader(msg, 'Subject');
      const from = Gmail.getHeader(msg, 'From');
      const date = this.parseDate(Gmail.getHeader(msg, 'Date'));
      const snippet = msg.snippet || '';
      const bodyText = Gmail.extractBodyText(msg);
      const fullText = subject + ' ' + snippet + ' ' + bodyText;

      const cajas = this.extractCajas(fullText);
      const stage = this.detectStage(subject, from, snippet + ' ' + bodyText);
      const party = this.detectParty(from);
      const name = this.parseName(from);
      const pedimento = this.extractPedimento(fullText);
      const factura = this.extractFactura(fullText);

      const keys = cajas.length ? cajas : ['_sin_caja'];

      keys.forEach(key => {
        if (!groups[key]) {
          groups[key] = {
            caja: key, emails: [], stages: new Set(),
            parties: {}, pedimentos: new Set(), facturas: new Set()
          };
        }
        const snippet_clean = (snippet || '').substring(0, 120);
        groups[key].emails.push({ subject, from, fromName: name, date, stage, party, pedimento, factura, snippet: snippet_clean });
        groups[key].stages.add(stage);
        if (!groups[key].parties[party]) groups[key].parties[party] = name;
        if (pedimento) groups[key].pedimentos.add(pedimento);
        if (factura) groups[key].facturas.add(factura);
      });
    });

    return Object.values(groups)
      .filter(g => g.caja !== '_sin_caja' && g.emails.length > 0)
      .map(g => {
        const sortedEmails = g.emails.sort((a, b) => b.date - a.date);
        const highestStage = Math.max(...g.emails.map(e => STAGE_IDX[e.stage] ?? 0));
        const currentStageId = STAGES[highestStage]?.id || 'docs_proveedor';
        const pedimentos = [...(g.pedimentos || [])];
        const facturas = [...(g.facturas || [])];

        return {
          caja: g.caja,
          currentStage: currentStageId,
          currentStageIdx: highestStage,
          lastUpdate: sortedEmails[0]?.date,
          emailCount: g.emails.length,
          emails: sortedEmails,
          parties: g.parties,
          stages: g.stages,
          pedimentos,
          facturas,
          status: this.getStatus(highestStage),
        };
      })
      .sort((a, b) => b.lastUpdate - a.lastUpdate);
  },

  getStatus(stageIdx) {
    if (stageIdx >= STAGE_IDX['despachado']) return 'despachado';
    if (stageIdx >= STAGE_IDX['doda']) return 'bodega';
    return 'en_proceso';
  },

  getStatusLabel(status) {
    const labels = {
      despachado: 'Despachado',
      bodega: 'En bodega (DODA enviado)',
      en_proceso: 'En proceso',
    };
    return labels[status] || status;
  },

  isThisWeek(date) {
    if (!date) return false;
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    return date >= startOfWeek;
  }
};

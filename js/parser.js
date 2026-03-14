// ============================================
// CECSO Tracker - Email Parser Module
// ============================================

const Parser = {

  extractPedimento(text) {
    const m = text.match(/pedimento[:\s#]+([\d]{6,10})/i);
    return m ? m[1] : null;
  },

  extractFactura(text) {
    const patterns = [
      /Invoice[I]?(\d{2}NI\d{3,10})/i,        // InvoiceI26NI013718
      /\b(\d{2}NI[-]?\d{3,10})\b/i,            // 26NI013718
      /(?:factura|invoice|inv)[:\s#]*\s*([A-Z0-9][-A-Z0-9]{4,20})/i,
      /\b(INV[-\s]?[A-Z0-9]{4,15})\b/i,
    ];
    const falsePositives = ['PUEDEN','PARA','PAGO','POR','COMO','ESTE','ESTA','SERA','TIENE','FAVOR','ENVIAR','ADJUNTA','CORRESPONDIENTE','IMPO','EXPO'];
    for (const re of patterns) {
      const m = text.match(re);
      if (m) {
        const val = m[1].toUpperCase();
        if (!falsePositives.includes(val)) return val;
      }
    }
    return null;
  },

  // Extract factura from attachment filenames
  extractFacturaFromAttachments(attachments) {
    for (const att of (attachments || [])) {
      const f = att.filename || '';
      const m = f.match(/Invoice[I]?(\d{2}NI\d{3,10})/i) || f.match(/(\d{2}NI[-]?\d{3,10})/i);
      if (m) return m[1].toUpperCase();
    }
    return null;
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
    if (f.includes('transport') || f.includes('carrier') || f.includes('trucking') ||
        f.includes('logistics') || f.includes('freight') || f.includes('dlr') ||
        f.includes('arrive') || f.includes('fletera')) return 'transportista';
    return 'agencia';
  },

  // Extract transportista company name from email From field
  extractTransportistaFromEmail(from) {
    const f = from.toLowerCase();
    // Check if this is a transportista email
    const transportKw = ['transport', 'carrier', 'trucking', 'logistics', 'freight', 'dlr', 'arrive', 'fletera'];
    if (!transportKw.some(kw => f.includes(kw))) return null;
    // Try to get display name first
    const nameMatch = from.match(/^"?([^"<]+)"?\s*</);
    if (nameMatch) {
      const name = nameMatch[1].trim();
      if (name.length > 2 && !/^[a-z0-9._%+-]+@/i.test(name)) return name;
    }
    // Extract from domain: user@arrivelogistics.com -> Arrive Logistics
    const domainMatch = from.match(/@([a-z0-9.-]+)\./i);
    if (domainMatch) {
      const domain = domainMatch[1].replace(/\.(com|net|org|mx)$/i, '');
      // Split camelCase or known patterns
      const pretty = domain
        .replace(/logistics/i, ' Logistics')
        .replace(/transport/i, ' Transport')
        .replace(/trucking/i, ' Trucking')
        .replace(/freight/i, ' Freight')
        .replace(/^(\w)/, (m) => m.toUpperCase())
        .trim();
      if (pretty.length > 2) return pretty;
    }
    return null;
  },

  // Extract proveedor name from subject (pattern: "IMPO | Proveedor | ...")
  extractProveedor(subject) {
    const m = subject.match(/IMPO\s*\|\s*([^|]+)\s*\|/i);
    if (m) return m[1].trim();
    const m2 = subject.match(/(?:proveedor|supplier)[:\s]+([^,|\/]+)/i);
    if (m2) return m2[1].trim();
    return null;
  },

  // Extract transportista from text
  extractTransportista(text) {
    const t = (text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 1. "Transfer Carrier" followed by company name (handle newlines, spaces, colons)
    const m1 = t.match(/Transfer\s+Carrier[\s\n:]*([A-Z][A-Z0-9 &.'\-]{3,50})/i);
    if (m1) {
      const val = m1[1].trim().replace(/\s+/g, ' ');
      if (val.length > 3) return val;
    }

    // 2. "INTRANSPORT" or known carrier names directly
    const m1b = t.match(/\b(INTRANSPORT(?:\s+TRUCKING)?(?:\s+INC)?)\b/i);
    if (m1b) return m1b[1].trim().replace(/\s+/g, ' ');

    // 3. Company names with trucking keywords - but NOT URLs or email domains
    const m2 = t.match(/\b([A-Z][A-Z0-9 &.'\-]+\s+(?:TRUCKING|TRANSPORT|FREIGHT|FORWARDING|LOGISTICS)\s*(?:INC|LLC|SA|CORP|CO|DE CV)?)\b/);
    if (m2) {
      const val = m2[1].trim().replace(/\s+/g, ' ');
      if (val.length > 5 && val.length < 60 && !val.includes('.com') && !val.includes('@')) return val;
    }

    // 4. Label: "Transportista: COMPANY" or "Carrier: COMPANY"
    const m3 = t.match(/(?:^|\n)\s*(?:transportista|carrier|fletera)\s*[:\-]\s*([^\n]{3,50})/im);
    if (m3) {
      const val = m3[1].trim();
      if (val.length > 3 && !val.includes('.com') && !val.includes('@')) return val;
    }

    return null;
  },

  // Extract additional operation data from email body
  extractOperationData(text) {
    const data = {};
    const arriveM = text.match(/Arrive\s*#?[:\s]*(\d+)/i);
    if (arriveM) data.arrive = arriveM[1];
    const placasM = text.match(/Placas?[:\s]*([A-Z0-9]{5,10})/i);
    if (placasM) data.placas = placasM[1].toUpperCase();
    const poM = text.match(/\bPO[:\s#]*([A-Z0-9]{4,15})/i);
    if (poM) data.po = poM[1].toUpperCase();
    const bolM = text.match(/BOL\s*#?\s*([A-Z0-9]{4,15})/i);
    if (bolM) data.bol = bolM[1].toUpperCase();
    const scacM = text.match(/SCAC\s*\n?\s*([A-Z]{2,6})/i);
    if (scacM) data.scac = scacM[1].toUpperCase();
    return data;
  },

  // Generate a one-line summary based on stage and context
  summarize(stage, subject) {
    const summaries = {
      docs_proveedor: 'Documentación del proveedor recibida',
      proforma: 'Proforma enviada al cliente',
      mve: 'MVE recibida - en proceso de revisión',
      doda: 'DODA enviado - mercancía lista en bodega',
      despachado: 'Operación despachada',
    };
    // Try to extract useful context from subject
    const bolMatch = subject.match(/BOL\s*#?\s*([A-Z0-9]+)/i);
    const arriveMatch = subject.match(/Arrive\s+(\d+)/i);
    let extra = '';
    if (bolMatch) extra += ` · BOL: ${bolMatch[1]}`;
    if (arriveMatch) extra += ` · Arrive: ${arriveMatch[1]}`;
    return (summaries[stage] || 'Correo de la operación') + extra;
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
      const proveedor = this.extractProveedor(subject);
      const transportista = this.extractTransportista(bodyText) || this.extractTransportista(snippet) || this.extractTransportista(fullText)
        || (party === 'transportista' ? this.extractTransportistaFromEmail(from) : null);
      const opData = this.extractOperationData(fullText);
      const summary = this.summarize(stage, subject);
      const attachments = Gmail.extractAttachments(msg);
      // Try to extract factura from attachment filenames
      const facturaFromAtt = this.extractFacturaFromAttachments(attachments);

      const keys = cajas.length ? cajas : ['_sin_caja'];

      keys.forEach(key => {
        if (!groups[key]) {
          groups[key] = {
            caja: key, emails: [], stages: new Set(),
            parties: {}, pedimentos: new Set(), facturas: new Set(),
            opData: {}, attachments: []
          };
        }
        groups[key].emails.push({ subject, from, fromName: name, date, stage, party, pedimento, factura, summary });
        groups[key].stages.add(stage);
        if (!groups[key].parties[party]) groups[key].parties[party] = name;
        if (proveedor && !groups[key].parties.proveedor) groups[key].parties.proveedor = proveedor;
        if (transportista && !groups[key].parties.transportista) groups[key].parties.transportista = transportista;
        if (pedimento) groups[key].pedimentos.add(pedimento);
        if (factura) groups[key].facturas.add(factura);
        if (facturaFromAtt && !factura) groups[key].facturas.add(facturaFromAtt);
        // Merge operation data
        Object.assign(groups[key].opData, opData);
        // Collect attachments
        if (attachments.length) groups[key].attachments.push(...attachments);
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
          opData: g.opData || {},
          attachments: g.attachments || [],
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

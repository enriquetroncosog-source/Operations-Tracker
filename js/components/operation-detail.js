// ============================================
// CECSO Tracker - Operation Detail Component
// ============================================

const OperationDetail = {

  // Fixed document slots with matching rules
  DOC_SLOTS: [
    { label: 'INVOICE',           match: ['invoice', 'inv', 'factura', 'ni0'] },
    { label: 'BOL',               match: ['rpt040', 'bol', 'lading', 'bill of lading'] },
    { label: 'SHIPPING MANIFEST', match: ['rpt020', 'manifest', 'shipping'] },
    { label: 'PROFORMA',          match: ['proforma'] },
    { label: 'MVE',               match: ['mve'] },
    { label: 'DODA',              match: ['doda'] },
    { label: 'SHIPPER',           match: ['shipper', 'shpr', 'ship'] },
  ],

  matchAttachmentToSlot(attachment) {
    const f = (attachment.filename || '').toLowerCase();
    for (const slot of this.DOC_SLOTS) {
      if (slot.match.some(kw => f.includes(kw))) return slot.label;
    }
    return null;
  },

  renderAttachments(attachments) {
    // Build a map: slot label -> attachment (first match wins)
    const slotMap = {};
    for (const att of (attachments || [])) {
      const slotLabel = this.matchAttachmentToSlot(att);
      if (slotLabel && !slotMap[slotLabel]) {
        slotMap[slotLabel] = att;
      }
    }

    const downloadSvg = '<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>';

    return `
      <div class="panel">
        <div class="panel-title">Archivos adjuntos</div>
        ${this.DOC_SLOTS.map(slot => {
          const att = slotMap[slot.label];
          if (att) {
            return `<div class="doc-item">
              <div class="doc-icon yes">${this.fileIcon(att.filename)}</div>
              <span class="doc-name">${slot.label}</span>
              <button class="btn-icon" onclick="Gmail.downloadAttachment('${att.messageId}','${att.attachmentId}','${att.filename.replace(/'/g, "\\'")}')" title="Descargar ${att.filename}">${downloadSvg}</button>
            </div>`;
          } else {
            return `<div class="doc-item">
              <div class="doc-icon no">○</div>
              <span class="doc-name" style="color:var(--text3)">${slot.label}</span>
              <span class="doc-date"></span>
            </div>`;
          }
        }).join('')}
      </div>`;
  },

  fileIcon(filename) {
    const ext = (filename || '').split('.').pop().toLowerCase();
    if (['pdf'].includes(ext)) return 'PDF';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'XLS';
    if (['doc', 'docx'].includes(ext)) return 'DOC';
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return 'IMG';
    if (['xml'].includes(ext)) return 'XML';
    return 'FILE';
  },

  render(op) {
    const dv = document.getElementById('detail-view');
    Router.navigate('detail');

    const si = op.currentStageIdx;

    // Build stages timeline
    const stagesHtml = STAGES.map((s, i) => {
      const cls = i < si ? 'done' : i === si ? 'now' : '';
      const icon = i < si ? '✓' : i === si ? '●' : (i + 1).toString();
      const stageEmail = op.emails
        .filter(e => e.stage === s.id)
        .sort((a, b) => a.date - b.date)[0];
      const dt = stageEmail ? Parser.fmtDate(stageEmail.date) : '';
      return `<div class="stage-node">
        <div class="stage-circle ${cls}">${icon}</div>
        <div class="stage-lbl ${cls}">${s.label}</div>
        <div class="stage-dt">${dt}</div>
      </div>`;
    }).join('');

    // Infer documents
    const allText = op.emails.map(e => e.subject.toLowerCase() + ' ' + e.from.toLowerCase()).join(' ');
    const stageReached = (stageId) => si >= (STAGE_IDX[stageId] ?? 99);
    const firstEmailDate = op.emails.length ? Parser.fmtDate(op.emails[op.emails.length - 1].date) : '';
    const stageDate = (stageId) => {
      const e = op.emails.filter(em => em.stage === stageId).sort((a, b) => a.date - b.date)[0];
      return e ? Parser.fmtDate(e.date) : firstEmailDate;
    };

    const docs = [
      { name: 'Bill of Lading',       found: stageReached('proforma') || /rpt040|lading/i.test(allText),   date: stageDate('docs_proveedor') },
      { name: 'Shipping Manifest',    found: stageReached('proforma') || /rpt020|manifest/i.test(allText), date: stageDate('docs_proveedor') },
      { name: 'Invoice comercial',    found: stageReached('proforma') || /invoice|26NI/i.test(allText),    date: stageDate('docs_proveedor') },
      { name: 'Proforma',             found: stageReached('proforma') || /proforma|pedimento/i.test(allText), date: stageDate('proforma') },
      { name: 'DODA',                 found: stageReached('doda') || /\bdoda\b/i.test(allText),            date: stageDate('doda') },
    ];

    const docsHtml = docs.map(d => `
      <div class="doc-item">
        <div class="doc-icon ${d.found ? 'yes' : 'no'}">${d.found ? '✓' : '○'}</div>
        <span class="doc-name">${d.name}</span>
        <span class="doc-date">${d.found ? d.date : ''}</span>
      </div>
    `).join('');


    // Operation info
    const d = op.opData || {};
    const allParties = { ...op.parties };
    const infoHtml = `
      <div class="info-row">
        <span class="info-label">Proveedor</span>
        <span class="info-value">${allParties.proveedor || '—'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Transportista</span>
        <span class="info-value">${allParties.transportista || '—'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Caja / Econ.</span>
        <span class="info-value">${op.caja}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Invoice</span>
        <span class="info-value">${op.facturas.length ? op.facturas.join(', ') : '—'}</span>
      </div>
      ${d.bol ? `<div class="info-row">
        <span class="info-label">BOL</span>
        <span class="info-value">${d.bol}</span>
      </div>` : ''}
      <div class="info-row">
        <span class="info-label">Status</span>
        <span class="info-value">${Parser.getStatusLabel(op.status)}</span>
      </div>
    `;

    // Emails log
    const emailsHtml = op.emails.map(e => `
      <div class="email-entry">
        <div class="e-line ${e.party}"></div>
        <div class="e-body">
          <div class="e-head">
            <span class="e-from">${e.fromName}</span>
            <span class="e-tag ${e.party}">${e.party}</span>
            <span class="e-time">${Parser.fmtDateTime(e.date)}</span>
          </div>
          <div class="e-subj" title="${e.subject}">${e.subject}</div>
          ${e.summary ? `<div class="e-snippet">${e.summary}</div>` : ''}
        </div>
      </div>
    `).join('');

    // Status pill
    let statusPillClass = 'prog';
    let statusPillText = 'En proceso';
    if (op.status === 'despachado') {
      statusPillClass = 'done';
      statusPillText = '✓ Despachado';
    } else if (op.status === 'bodega') {
      statusPillClass = 'bodega';
      statusPillText = 'En bodega';
    }

    const lu = Parser.fmtDateTime(op.lastUpdate);

    dv.innerHTML = `
      <button class="back-btn" id="detail-back">
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd"/>
        </svg>
        Volver
      </button>

      <div class="detail-header">
        <div>
          <div class="detail-ref">Caja ${op.caja}</div>
          <div class="detail-sub">
            ${op.pedimentos.length ? `<span>Ped: ${op.pedimentos.join(', ')}</span>` : ''}
            ${op.facturas.length ? `<span>Fac: ${op.facturas.join(', ')}</span>` : ''}
            <span>${lu}</span>
            <span>${op.emailCount} correos</span>
          </div>
        </div>
        <span class="status-pill ${statusPillClass}">${statusPillText}</span>
      </div>

      <div class="timeline-wrap">
        <div class="section-label">Etapas de la operación</div>
        <div class="stages-track">${stagesHtml}</div>
      </div>

      <div class="detail-cols">
        <div>
          <div class="panel" style="margin-bottom:10px">
            <div class="panel-title">Información</div>
            ${infoHtml}
          </div>
          <div class="panel" style="margin-bottom:10px">
            <div class="panel-title">Documentos</div>
            ${docsHtml}
          </div>
          ${this.renderAttachments(op.attachments)}
        </div>
        <div class="panel">
          <div class="panel-title">Log de correos (${op.emails.length})</div>
          ${emailsHtml}
        </div>
      </div>
    `;

    document.getElementById('detail-back').addEventListener('click', () => {
      Router.back();
    });
  }
};

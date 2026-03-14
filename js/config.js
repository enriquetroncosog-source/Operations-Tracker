// ============================================
// CECSO Tracker - Configuration
// ============================================

const CONFIG = {
  CLIENT_ID: '659571303958-ak8jq5qc9v5h9hh4770l7mubbm5alfer.apps.googleusercontent.com',
  SCOPES: 'https://www.googleapis.com/auth/gmail.readonly',
  CECSO_KEYWORDS: ['cecso', 'CECSO', '544437'],
};

const STAGES = [
  { id: 'docs_proveedor', label: 'Docs Proveedor' },
  { id: 'proforma',       label: 'Proforma Enviada' },
  { id: 'mve',            label: 'MVE Recibida' },
  { id: 'doda',           label: 'DODA Enviado' },
  { id: 'despachado',     label: 'Despachado' },
];

const STAGE_IDX = Object.fromEntries(STAGES.map((s, i) => [s.id, i]));

// Status categories for dashboard filtering
const STATUS_FILTERS = {
  all:          { label: 'Procesadas esta semana', color: 'blue' },
  bodega:       { label: 'Listas en bodega',       color: 'amber' },
  despachado:   { label: 'Despachadas',             color: 'green' },
  en_proceso:   { label: 'En proceso',              color: 'red' },
};

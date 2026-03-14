// ============================================
// CECSO Tracker - Login Component
// ============================================

const LoginComponent = {

  render() {
    const screen = document.getElementById('login-screen');
    screen.style.display = 'flex';
    screen.innerHTML = `
      <div class="login-logo">
        <div class="logo-mark">CIS</div>
        <div>
          <div class="logo-text">Core Integrated Services</div>
          <div class="logo-sub">Operations Tracker</div>
        </div>
      </div>
      <div class="login-card">
        <h2>Acceso al sistema</h2>
        <p>Conecta tu cuenta de Google para acceder y monitorear las operaciones de CECSO en tiempo real.</p>
        <button class="btn-google" id="btn-google-auth">
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Conectar con Google
        </button>
        <div class="setup-note" id="config-note"></div>
      </div>
    `;

    // Bind events
    document.getElementById('btn-google-auth').addEventListener('click', () => {
      Auth.startAuth(() => App.onAuthSuccess());
    });

    // Show config note if needed
    if (!Auth.isClientIdSet()) {
      document.getElementById('config-note').innerHTML =
        '⚙️ <a href="#" style="color:var(--info)" id="show-config-link">Configura tu Client ID</a> para conectar con Gmail';
      document.getElementById('show-config-link').addEventListener('click', (e) => {
        e.preventDefault();
        this.showConfigModal();
      });
    }
  },

  hide() {
    document.getElementById('login-screen').style.display = 'none';
  },

  showConfigModal() {
    const modal = document.getElementById('config-modal');
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal">
        <h3>⚙️ Configurar Google Client ID</h3>
        <p>Para conectar con Gmail necesitas un Client ID de Google Cloud. Solo se hace una vez:</p>
        <div class="step-list">
          <div class="step"><div class="step-n">1</div><p>Ve a <code>console.cloud.google.com</code> → Crea un proyecto</p></div>
          <div class="step"><div class="step-n">2</div><p>Activa la <code>Gmail API</code> en "APIs y Servicios"</p></div>
          <div class="step"><div class="step-n">3</div><p>Crea credenciales → OAuth 2.0 → Aplicación web</p></div>
          <div class="step"><div class="step-n">4</div><p>En "Orígenes JS autorizados" agrega tu URL de GitHub Pages</p></div>
          <div class="step"><div class="step-n">5</div><p>Copia el Client ID y pégalo aquí:</p></div>
        </div>
        <input type="text" id="modal-client-id" placeholder="xxxxxxxx.apps.googleusercontent.com" />
        <div class="modal-footer">
          <button class="btn-secondary" id="btn-cancel-config">Cancelar</button>
          <button class="btn-primary" id="btn-save-config">Guardar y conectar</button>
        </div>
      </div>
    `;

    document.getElementById('btn-cancel-config').addEventListener('click', () => {
      modal.style.display = 'none';
    });

    document.getElementById('btn-save-config').addEventListener('click', () => {
      const val = document.getElementById('modal-client-id').value.trim();
      if (!val) return;
      localStorage.setItem('cis_client_id', val);
      modal.style.display = 'none';
      Auth.initGSI(() => App.onAuthSuccess());
      setTimeout(() => Auth.startAuth(() => App.onAuthSuccess()), 300);
    });
  }
};

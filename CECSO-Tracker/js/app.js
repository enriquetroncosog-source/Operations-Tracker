// ============================================
// CECSO Tracker - Main Application
// ============================================

const App = {
  allOps: [],

  init() {
    // Render login screen
    LoginComponent.render();

    // Wait for Google Identity Services to load
    const waitGSI = setInterval(() => {
      if (typeof google !== 'undefined' && google.accounts) {
        clearInterval(waitGSI);
        Auth.initGSI(() => this.onAuthSuccess());
      }
    }, 200);
  },

  onAuthSuccess() {
    // Hide login, show app
    LoginComponent.hide();
    const app = document.getElementById('app');
    app.style.display = 'flex';

    // Render app components
    DashboardComponent.renderHeader();
    SearchComponent.render();
    DashboardComponent.showWelcome();

    // Auto-load recent
    this.loadRecent();
  },

  async loadRecent() {
    DashboardComponent.showLoading('Cargando operaciones recientes de CECSO...');
    Router.navigate('dashboard');

    try {
      const messages = await Gmail.loadRecent();
      if (!messages.length) {
        DashboardComponent.showEmpty('No se encontraron correos de CECSO en los últimos 60 días.');
        return;
      }
      const ops = Parser.groupByOperation(messages);
      this.allOps = ops;
      DashboardComponent.renderWithOps(ops);
    } catch (e) {
      DashboardComponent.showError('Error cargando correos: ' + e.message);
    }
  },

  logout() {
    Auth.logout();
    this.allOps = [];
    document.getElementById('app').style.display = 'none';
    LoginComponent.render();
  }
};

// Start the application
window.addEventListener('load', () => App.init());

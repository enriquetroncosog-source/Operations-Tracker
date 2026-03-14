// ============================================
// CECSO Tracker - Authentication Module
// ============================================

const Auth = {
  tokenClient: null,
  accessToken: null,
  userEmail: null,

  getClientId() {
    return localStorage.getItem('cis_client_id') || CONFIG.CLIENT_ID;
  },

  isClientIdSet() {
    const id = this.getClientId();
    return id && id !== 'TU_CLIENT_ID_AQUI.apps.googleusercontent.com';
  },

  initGSI(onSuccess) {
    if (!this.isClientIdSet()) return;
    if (typeof google === 'undefined' || !google.accounts) return;
    try {
      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: this.getClientId(),
        scope: CONFIG.SCOPES,
        callback: (resp) => {
          if (resp.error) {
            console.error('[Auth] Error:', resp.error);
            alert('Error de autenticación: ' + resp.error +
              '\n\nVerifica que tu URL esté en los orígenes autorizados en Google Cloud Console.');
            return;
          }
          this.accessToken = resp.access_token;
          this.fetchUserInfo().then(() => {
            if (onSuccess) onSuccess();
          });
        }
      });
      console.log('[Auth] GSI initialized');
    } catch (e) {
      console.error('[Auth] initGSI error:', e.message);
    }
  },

  startAuth(onSuccess) {
    if (!this.isClientIdSet()) {
      LoginComponent.showConfigModal();
      return;
    }
    if (typeof google === 'undefined' || !google.accounts) {
      setTimeout(() => this.startAuth(onSuccess), 500);
      return;
    }
    if (!this.tokenClient) {
      this.initGSI(onSuccess);
      setTimeout(() => this.startAuth(onSuccess), 500);
      return;
    }
    try {
      this._onSuccess = onSuccess;
      this.tokenClient.requestAccessToken({ prompt: 'select_account' });
    } catch (e) {
      console.error('[Auth] requestAccessToken error:', e.message);
      alert('Error al conectar con Google: ' + e.message);
    }
  },

  async fetchUserInfo() {
    const r = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: 'Bearer ' + this.accessToken }
    });
    const info = await r.json();
    this.userEmail = info.email;
    return info;
  },

  logout() {
    if (this.accessToken) {
      google.accounts.oauth2.revoke(this.accessToken);
    }
    this.accessToken = null;
    this.userEmail = null;
  },

  isAuthenticated() {
    return !!this.accessToken;
  },

  getToken() {
    return this.accessToken;
  }
};

// ============================================
// CECSO Tracker - Authentication Module
// ============================================

const Auth = {
  tokenClient: null,
  accessToken: null,
  userEmail: null,
  _onSuccess: null,

  getClientId() {
    return localStorage.getItem('cis_client_id') || CONFIG.CLIENT_ID;
  },

  isClientIdSet() {
    const id = this.getClientId();
    return id && id !== 'TU_CLIENT_ID_AQUI.apps.googleusercontent.com';
  },

  initGSI() {
    if (!this.isClientIdSet()) return;
    if (typeof google === 'undefined' || !google.accounts) return;
    if (this.tokenClient) return; // Already initialized

    try {
      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: this.getClientId(),
        scope: CONFIG.SCOPES,
        callback: (resp) => {
          if (resp.error) {
            console.error('[Auth] Token error:', resp.error);
            alert('Error de autenticación: ' + resp.error);
            return;
          }
          console.log('[Auth] Token received successfully');
          this.accessToken = resp.access_token;
          this.fetchUserInfo().then(() => {
            console.log('[Auth] User:', this.userEmail);
            if (this._onSuccess) this._onSuccess();
          }).catch(e => {
            console.error('[Auth] fetchUserInfo failed:', e);
            // Token is still valid even if userinfo fails
            if (this._onSuccess) this._onSuccess();
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
    this._onSuccess = onSuccess;

    if (typeof google === 'undefined' || !google.accounts) {
      setTimeout(() => this.startAuth(onSuccess), 500);
      return;
    }

    if (!this.tokenClient) {
      this.initGSI();
    }

    // Wait for tokenClient to be ready
    if (!this.tokenClient) {
      setTimeout(() => this.startAuth(onSuccess), 500);
      return;
    }

    try {
      this.tokenClient.requestAccessToken({ prompt: '' });
    } catch (e) {
      console.error('[Auth] requestAccessToken error:', e.message);
      alert('Error al conectar con Google: ' + e.message);
    }
  },

  // Request a fresh token (for re-auth after expiry)
  refreshToken() {
    return new Promise((resolve, reject) => {
      if (!this.tokenClient) { reject('No token client'); return; }
      const prevCallback = this._onSuccess;
      this._onSuccess = () => {
        this._onSuccess = prevCallback;
        resolve();
      };
      try {
        this.tokenClient.requestAccessToken({ prompt: '' });
      } catch (e) {
        reject(e);
      }
    });
  },

  async fetchUserInfo() {
    const r = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: 'Bearer ' + this.accessToken }
    });
    if (!r.ok) {
      console.warn('[Auth] userinfo status:', r.status);
      return {};
    }
    const info = await r.json();
    this.userEmail = info.email;
    return info;
  },

  logout() {
    if (this.accessToken) {
      try { google.accounts.oauth2.revoke(this.accessToken); } catch (e) {}
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

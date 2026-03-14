// ============================================
// CECSO Tracker - Simple Router / View Manager
// ============================================

const Router = {
  _current: 'dashboard',
  _history: [],

  views: {
    dashboard: 'dashboard-view',
    list: 'operations-list-view',
    detail: 'detail-view',
  },

  navigate(view, data = {}) {
    if (this._current !== view) {
      this._history.push(this._current);
    }
    this._current = view;

    // Hide all views
    Object.values(this.views).forEach(id => {
      document.getElementById(id).style.display = 'none';
    });

    // Show target
    document.getElementById(this.views[view]).style.display = 'block';

    // Dispatch custom event for components to react
    window.dispatchEvent(new CustomEvent('route-change', {
      detail: { view, data }
    }));
  },

  back() {
    const prev = this._history.pop() || 'dashboard';
    this.navigate(prev);
  },

  current() {
    return this._current;
  }
};

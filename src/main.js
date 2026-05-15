/**
 * SiCAPAI — Main Application Entry Point
 * Sistem Catatan Capaian Anak
 */

import { AuthService } from './services/auth.js';
import { renderLoginScreen } from './components/auth/login-screen.js';
import { renderAppShell } from './components/layout/app-shell.js';

class App {
  constructor() {
    this.authService = new AuthService();
    this.currentUser = null;
    this.appContainer = document.getElementById('app');
    this.loadingScreen = document.getElementById('loading-screen');
    this.initialized = false;
    this._renderVersion = 0; // Guard against race conditions
  }

  init() {
    // Listen for auth state changes
    // Firebase may fire this MULTIPLE times (null → user, token refresh, etc.)
    // Each fire increments renderVersion; stale renders bail out safely.
    this.authService.onAuthStateChanged((user) => {
      this.currentUser = user;
      this.render();
    });

    // Safety net: if onAuthStateChanged never fires (e.g., network issue),
    // force render after 5 seconds
    setTimeout(() => {
      if (!this.initialized) {
        console.warn('Auth state timeout — forcing render');
        this.render();
      }
    }, 5000);
  }

  async render() {
    const myVersion = ++this._renderVersion;
    this.initialized = true;

    // Clear #app completely and rebuild
    this.appContainer.innerHTML = '';

    try {
      if (this.currentUser) {
        await renderAppShell(this.appContainer, this.currentUser, this.authService);
      } else {
        renderLoginScreen(this.appContainer, this.authService);
      }

      // After await: check if a NEWER render has started while we were waiting.
      // If so, this render is stale → bail out, don't touch the DOM.
      if (myVersion !== this._renderVersion) return;

    } catch (err) {
      console.error('Render error:', err);
      if (myVersion !== this._renderVersion) return;
    }

    // Remove loading screen ONLY after the UI is ready
    this.hideLoading();
  }

  hideLoading() {
    const loadingEl = this.loadingScreen || document.getElementById('loading-screen');
    if (loadingEl) {
      loadingEl.classList.add('hidden');
      setTimeout(() => loadingEl.remove(), 400);
      this.loadingScreen = null;
    }
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
  });
} else {
  const app = new App();
  app.init();
}

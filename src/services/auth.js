/**
 * Auth Service — Firebase Authentication via Google Identity Services (GIS)
 *
 * Primary:  google.accounts.id.prompt()  → FedCM/One Tap (Chrome)
 *           ID token → signInWithCredential → shows "SiCAPAI"
 *
 * Fallback: google.accounts.oauth2.initTokenClient → OAuth popup (all browsers)
 *           access token → signInWithCredential → shows "SiCAPAI" from consent screen
 *
 * Neither path uses Firebase's signInWithPopup, so the Firebase domain
 * never appears — Google shows the app name from the OAuth consent screen.
 */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithCredential,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
} from 'firebase/auth';
import { firebaseConfig } from '../config/firebase.js';

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);

export class AuthService {
  constructor() {
    this.auth = auth;
    this.currentUser = null;
    this._clientId = null;
    this._gisReady = false;
    this._pendingCallback = null;
  }

  /**
   * Initialize GIS once on page load. Call with the OAuth client ID.
   * Sets up the One Tap credential callback and fires the auto-prompt.
   */
  initGIS(clientId) {
    if (!window.google?.accounts?.id || this._gisReady) return;
    this._clientId = clientId;

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => this._handleIdToken(response.credential),
      auto_select: false,
      cancel_on_tap_outside: false,
      context: 'use',
    });

    this._gisReady = true;

    // Auto One Tap prompt on page load (Chrome/FedCM)
    window.google.accounts.id.prompt((n) => {
      if (n.isNotDisplayed()) {
        console.log('[GIS] One Tap auto-prompt skipped:', n.getNotDisplayedReason());
      }
    });
  }

  /** Handle ID token from FedCM/One Tap path */
  async _handleIdToken(idToken) {
    try {
      const credential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(this.auth, credential);
      this._pendingCallback?.(null, result.user);
    } catch (err) {
      this._pendingCallback?.(err, null);
    } finally {
      this._pendingCallback = null;
    }
  }

  /**
   * Fallback: OAuth popup via initTokenClient.
   * Works in all browsers. Opens Google's account picker popup.
   * Google shows "SiCAPAI" from the OAuth consent screen app name.
   */
  _signInWithOAuthPopup() {
    return new Promise((resolve, reject) => {
      if (!window.google?.accounts?.oauth2 || !this._clientId) {
        reject(new Error('Google Identity Services tidak tersedia. Refresh halaman.'));
        return;
      }

      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: this._clientId,
        scope: 'email profile openid',
        callback: async (tokenResponse) => {
          if (tokenResponse.error) {
            reject(new Error(
              tokenResponse.error === 'access_denied'
                ? 'Login dibatalkan.'
                : `Gagal login Google: ${tokenResponse.error}`
            ));
            return;
          }
          try {
            const credential = GoogleAuthProvider.credential(null, tokenResponse.access_token);
            const result = await signInWithCredential(this.auth, credential);
            resolve(result.user);
          } catch (err) {
            reject(this._mapError(err));
          }
        },
        error_callback: (err) => {
          reject(new Error(
            err.type === 'popup_closed' ? 'Login dibatalkan.' : 'Gagal membuka popup Google.'
          ));
        },
      });

      tokenClient.requestAccessToken({ prompt: 'select_account' });
    });
  }

  /**
   * Sign in with Google.
   * Tries FedCM/One Tap first; falls back to OAuth popup if not supported.
   *
   * @returns {Promise<import('firebase/auth').User>}
   */
  signInWithGoogle() {
    if (!window.google?.accounts) {
      return Promise.reject(new Error('Google Identity Services tidak tersedia. Refresh halaman.'));
    }

    // FedCM path (Chrome, modern browsers)
    if (this._gisReady) {
      return new Promise((resolve, reject) => {
        this._pendingCallback = (err, user) => {
          if (err) reject(this._mapError(err));
          else resolve(user);
        };

        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed()) {
            // FedCM not available (Firefox, Private Browsing, etc.) → OAuth popup
            this._pendingCallback = null;
            this._signInWithOAuthPopup().then(resolve).catch(reject);
          } else if (notification.isSkippedMoment()) {
            // User dismissed the prompt
            this._pendingCallback = null;
            reject(new Error('Login dibatalkan. Silakan coba lagi.'));
          }
          // isDismissedMoment → user closed FedCM sheet → same as skipped
        });
      });
    }

    // GIS not initialized yet → direct OAuth popup
    return this._signInWithOAuthPopup();
  }

  /** Map Firebase auth error codes to user-facing Bahasa Indonesia messages */
  _mapError(error) {
    const messages = {
      'auth/network-request-failed':                        'Koneksi internet bermasalah. Periksa jaringan Anda.',
      'auth/user-disabled':                                 'Akun Anda dinonaktifkan. Hubungi administrator.',
      'auth/account-exists-with-different-credential':      'Email ini sudah terdaftar dengan metode login lain.',
      'auth/invalid-credential':                            'Kredensial tidak valid. Silakan coba lagi.',
    };
    return new Error(messages[error.code] ?? 'Gagal login dengan Google. Silakan coba lagi.');
  }

  /**
   * Sign out current user
   */
  async logout() {
    try {
      window.google?.accounts?.id?.disableAutoSelect?.();
      await signOut(this.auth);
    } catch (error) {
      console.error('Sign out error:', error);
      throw new Error('Gagal logout. Silakan coba lagi.');
    }
  }

  /**
   * Listen for auth state changes
   * @param {Function} callback
   */
  onAuthStateChanged(callback) {
    onAuthStateChanged(this.auth, (user) => {
      this.currentUser = user;
      callback(user);
    });
  }

  /**
   * Get Firebase JWT for API calls
   * @returns {Promise<string>}
   */
  async getIdToken() {
    if (!this.currentUser) throw new Error('Pengguna belum login');
    return this.currentUser.getIdToken();
  }

  getUser() {
    return this.currentUser;
  }

  /** @deprecated Use initGIS instead */
  initOneTap(clientId) {
    this.initGIS(clientId);
  }
}

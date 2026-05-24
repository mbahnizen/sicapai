import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithRedirect,
  getRedirectResult,
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
  }

  // Redirect user to Google sign-in page. No popup — avoids cross-origin
  // iframe relay issues on custom domains (Cloud Run).
  async signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    await signInWithRedirect(this.auth, provider);
    // Browser navigates away; execution never reaches here on success.
  }

  // Call once on app init. Resolves with the signed-in user if returning
  // from a Google redirect, null if not a redirect flow, throws on error.
  async getRedirectResult() {
    try {
      const result = await getRedirectResult(this.auth);
      return result?.user ?? null;
    } catch (err) {
      throw this._mapError(err);
    }
  }

  _mapError(error) {
    const messages = {
      'auth/user-disabled':                                 'Akun Anda dinonaktifkan. Hubungi administrator.',
      'auth/account-exists-with-different-credential':      'Email ini sudah terdaftar dengan metode login lain.',
      'auth/invalid-credential':                            'Kredensial tidak valid. Silakan coba lagi.',
      'auth/network-request-failed':                        'Koneksi internet bermasalah. Periksa jaringan Anda.',
    };
    return new Error(messages[error.code] ?? 'Gagal login dengan Google. Silakan coba lagi.');
  }

  async logout() {
    try {
      await signOut(this.auth);
    } catch (error) {
      console.error('Sign out error:', error);
      throw new Error('Gagal logout. Silakan coba lagi.');
    }
  }

  onAuthStateChanged(callback) {
    onAuthStateChanged(this.auth, (user) => {
      this.currentUser = user;
      callback(user);
    });
  }

  async getIdToken() {
    if (!this.currentUser) throw new Error('Pengguna belum login');
    return this.currentUser.getIdToken();
  }

  getUser() {
    return this.currentUser;
  }
}

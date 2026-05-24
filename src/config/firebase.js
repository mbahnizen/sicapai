const _hostname = typeof window !== 'undefined' ? window.location.hostname : '';
const authDomain = _hostname.endsWith('.run.app')
  ? _hostname
  : 'sicapai-paud-a293b.firebaseapp.com';

export const firebaseConfig = {
  apiKey: 'AIzaSyBL5FR6BzuK3FZ7gVAu9jUbx2PyX-Sy6ek',
  authDomain,
  projectId: 'sicapai-paud',
  storageBucket: 'sicapai-paud.firebasestorage.app',
  appId: '1:555383432296:web:a0b1d285f6cd62efee87dd',
  messagingSenderId: '555383432296',
};

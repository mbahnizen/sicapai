/**
 * App Shell — Main application layout after login
 */

import { showToast } from '../shared/toast.js';
import { escapeHTML, escapeAttr } from '../../utils/sanitize.js';
import { renderChecklist, renderKokurikulerChecklist, renderNilaiPlusChecklist, renderSaranChecklist } from '../report/checklist.js';
import { renderPreview } from '../report/preview.js';
import { generateTemplate, countSelected, generateKokurikulerNarrative, generateNilaiPlusNarrative, generateSaranNarrative, getChecklistStructure } from '../../services/template-engine.js';
import { api } from '../../services/api.js';
import { printReport } from '../../services/report-export.js';
import { exportInstitutionToXlsx } from '../../services/report-xlsx.js';
import { downloadReportAsDocx } from '../../services/report-export-docx.js';

// ---- Progress Persistence Helpers ----
function getProgressKey(student) {
  return `sicapai-progress-${student.institutionId || 'x'}-${student.id}`;
}

function saveProgress(state) {
  if (!state.selectedStudent) return;
  const data = {
    selectedIndicators: state.selectedIndicators,
    aiResult: state.aiResult || {},
    kokurikulerSelected: state.kokurikulerSelected || {},
    aiKokurikuler: state.aiKokurikuler || null,
    nilaiPlusSelected: state.nilaiPlusSelected || {},
    saranSelected: state.saranSelected || {},
    semester: document.querySelector('#report-semester')?.value || '1',
    year: document.querySelector('#report-year')?.value || '',
    savedAt: Date.now(),
  };
  localStorage.setItem(getProgressKey(state.selectedStudent), JSON.stringify(data));
  // Non-blocking Firestore sync — update save indicator on failure
  api.saveProgress(state.selectedStudent.id, data).catch(() => {
    const saveStatus = document.querySelector('#save-status');
    if (saveStatus && saveStatus.textContent.includes('Tersimpan')) {
      saveStatus.textContent = '⚠️ Gagal sinkronisasi';
      saveStatus.title = 'Data tersimpan lokal, tapi gagal tersinkron ke server. Cek koneksi.';
    }
  });
}

function loadProgress(student) {
  try {
    const raw = localStorage.getItem(getProgressKey(student));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// Show input error state with shake animation, auto-clear on first keystroke
function markInputError(inputEl) {
  if (!inputEl) return;
  inputEl.classList.add('input-error');
  inputEl.focus();
  inputEl.addEventListener('input', () => inputEl.classList.remove('input-error'), { once: true });
}

// ---- Avatar Utilities ----
const AVATAR_COLORS = [
  '#0D9488', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE',
  '#85C1E9', '#F0B27A', '#82E0AA', '#F1948A', '#AED6F1',
];

function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function renderAvatar(name, size = 32, colorSeed = null) {
  const initial = (name || '?')[0].toUpperCase();
  const bg = getAvatarColor(colorSeed ?? name);
  const fontSize = Math.round(size * 0.45);
  return `<div class="avatar-initial" style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:${fontSize}px;flex-shrink:0;user-select:none;letter-spacing:-0.02em">${initial}</div>`;
}

export async function renderAppShell(container, user, authService) {
  // App state
  const state = {
    user,                // Store user reference for use across all functions
    authService,         // Store authService reference for post-delete reload
    currentInstitution: null,
    institutions: [],
    students: [],
    selectedStudent: null,
    selectedIndicators: {},
    templateResult: {},
    aiResult: null,
    aiHistory: {},
    // Kokurikuler (8 Dimensi Profil Lulusan) — parallel track to intrakurikuler
    // Shape: { "kk-ibadah-mandiri": true, "kl-kerja-kelompok": true, ... }
    // Unlike selectedIndicators (which can hold sub-indicator arrays), these are always boolean.
    kokurikulerSelected: {},
    kokurikulerNarrative: '',  // combined template paragraph from all checked dimensi
    aiKokurikuler: null,       // AI-enhanced version of kokurikulerNarrative
    nilaiPlusSelected: {},     // { "np-bantu-guru-beres": true, ... }
    saranSelected: {},         // { "saran-doa-harian-rutin": true, ... }
    quota: { weeklyUsed: 0, limit: 20 },
    theme: localStorage.getItem('sicapai-theme') || 'light',
    finalizedStudents: new Set(), // Track students with finalized reports (local session)
  };

  // Apply saved theme
  document.documentElement.setAttribute('data-theme', state.theme);

  container.innerHTML = `
    <div class="app-shell">
      <!-- Header -->
      <header class="app-header" id="app-header">
        <div class="app-header-inner">
          <div class="header-left">
            <div class="header-brand">
              <span class="header-logo-text">Si<span class="logo-highlight">CAPAI</span></span>
            </div>
            <span class="header-divider"></span>
            <button class="workspace-switcher" id="workspace-switcher">
              <span class="workspace-name" id="workspace-name">Pilih Instansi</span>
              <svg class="workspace-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="header-icon-btn" id="btn-export-xlsx" title="Unduh XLSX (Mail Merge)" style="display:none; margin-left:var(--space-2)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
          </div>
          <div class="header-actions">
            <button class="header-icon-btn" id="btn-theme" title="Ganti tema">
              <svg class="icon-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:${state.theme === 'dark' ? 'block' : 'none'}"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              <svg class="icon-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:${state.theme === 'dark' ? 'none' : 'block'}"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            </button>
            <div class="dropdown" id="user-dropdown">
              <button class="dropdown-trigger" id="user-menu-trigger">
                ${renderAvatar(user.displayName, 32, user.email)}
              </button>
              <div class="dropdown-menu" id="user-dropdown-menu">
                <div class="dropdown-item dropdown-user-info">
                  <span class="dropdown-user-name">${user.displayName || 'User'}</span>
                  <span class="dropdown-user-email">${user.email}</span>
                </div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-item" id="quota-badge" style="gap:var(--space-2);cursor:default" title="Kuota AI mingguan">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                  <span id="quota-text" style="font-size:var(--font-size-xs);font-weight:500">20/20 AI</span>
                </div>
                <div class="dropdown-divider"></div>
                <button class="dropdown-item" id="btn-logout">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  <span>Keluar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- Main Content -->
      <div class="app-body">
        <!-- Sidebar: Students -->
        <aside class="app-sidebar" id="app-sidebar" data-state="loading">
          <div class="sidebar-header">
            <h3 class="sidebar-title">👧 Daftar Siswa</h3>
            <div style="display:flex;gap:var(--space-1)">
              <button class="btn btn-sm btn-ghost" id="btn-bulk-add-student" disabled title="Tambah banyak siswa sekaligus">Massal</button>
              <button class="btn btn-sm btn-primary" id="btn-add-student" disabled>+ Tambah</button>
            </div>
          </div>
          <div class="sidebar-body" id="student-list">
            <div class="sidebar-loading">
              <p style="font-size:var(--font-size-xs);color:var(--text-tertiary);margin-bottom:var(--space-3);padding:0 var(--space-3)">Memuat daftar siswa...</p>
              <div class="skeleton" style="height:40px;margin-bottom:8px"></div>
              <div class="skeleton" style="height:40px;margin-bottom:8px"></div>
              <div class="skeleton" style="height:40px"></div>
            </div>
          </div>
          <div id="sidebar-export-footer" style="display:none;padding:var(--space-2) var(--space-3);border-top:1px solid var(--border-light);flex-shrink:0">
            <button id="btn-sidebar-export" class="btn btn-ghost btn-sm" style="width:100%;justify-content:flex-start;font-size:var(--font-size-xs);color:var(--text-secondary)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
              Export Rapor (.xlsx)
            </button>
          </div>
        </aside>

        <!-- Main Panel -->
        <main class="app-main" id="app-main">
          <div class="main-content" id="main-content">
            <div class="loading-placeholder" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--space-3);min-height:60vh">
              <div class="spinner-ring"></div>
              <p style="font-size:var(--font-size-sm);color:var(--text-tertiary)">Memuat data instansi...</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  `;

  // Add app shell styles
  addAppShellStyles(container);

  // --- Event Bindings ---
  setupThemeToggle(container, state);
  setupUserDropdown(container);
  setupLogout(authService);
  setupWorkspaceSwitcher(container, state);
  setupInstitutionSettings(container, state);
  setupAddStudent(container, state);

  // Load initial data (AWAIT so the loading screen doesn't disappear too early)
  await loadInstitutions(state, container);
}

// ---- Theme Toggle ----
function setupThemeToggle(container, state) {
  const themeBtn = container.querySelector('#btn-theme');
  themeBtn.addEventListener('click', () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', state.theme);
    localStorage.setItem('sicapai-theme', state.theme);
    themeBtn.querySelector('.icon-sun').style.display = state.theme === 'dark' ? 'block' : 'none';
    themeBtn.querySelector('.icon-moon').style.display = state.theme === 'dark' ? 'none' : 'block';
  });
}

// ---- User Dropdown ----
function setupUserDropdown(container) {
  const trigger = container.querySelector('#user-menu-trigger');
  const menu = container.querySelector('#user-dropdown-menu');

  // Portal: move to body so no parent overflow/transform/zoom can clip it.
  // data-portal marks it for cleanup when the app re-renders (see main.js).
  menu.dataset.portal = '';
  document.body.appendChild(menu);
  menu.style.cssText = `
    position:fixed;
    z-index:9998;
    min-width:240px;
    background:var(--bg-card);
    border:1px solid var(--border-light);
    border-radius:var(--radius-lg);
    box-shadow:var(--shadow-lg);
    padding:var(--space-2);
    opacity:0;
    visibility:hidden;
    transform:translateY(-6px);
    transition:opacity 0.15s,transform 0.15s,visibility 0.15s;
    pointer-events:none;
  `;

  let isOpen = false;

  const position = () => {
    const rect = trigger.getBoundingClientRect();
    const menuW = 240;
    let left = rect.right - menuW;
    if (left < 8) left = 8;
    if (left + menuW > window.innerWidth - 8) left = window.innerWidth - menuW - 8;
    menu.style.top = `${rect.bottom + 6}px`;
    menu.style.left = `${left}px`;
  };

  const open = () => {
    isOpen = true;
    position();
    menu.style.opacity = '1';
    menu.style.visibility = 'visible';
    menu.style.transform = 'translateY(0)';
    menu.style.pointerEvents = '';
  };

  const close = () => {
    isOpen = false;
    menu.style.opacity = '0';
    menu.style.visibility = 'hidden';
    menu.style.transform = 'translateY(-6px)';
    menu.style.pointerEvents = 'none';
  };

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    isOpen ? close() : open();
  });

  document.addEventListener('click', (e) => {
    if (isOpen && !menu.contains(e.target)) close();
  });

  window.addEventListener('resize', () => { if (isOpen) position(); });
  window.addEventListener('scroll', () => { if (isOpen) position(); }, { passive: true });
}

// ---- Logout ----
function setupLogout(authService) {
  // #btn-logout lives in the portal menu (document.body), not container
  document.querySelector('#btn-logout').addEventListener('click', async () => {
    try {
      await authService.logout();
      showToast('Berhasil keluar. Sampai jumpa! 👋', 'info');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ---- Workspace Switcher ----
function setupWorkspaceSwitcher(container, state) {
  const switcher = container.querySelector('#workspace-switcher');
  let isLoading = false;
  
  switcher.addEventListener('click', async () => {
    if (isLoading) return;
    isLoading = true;
    
    try {
      if (state.institutions.length === 0) {
        await promptCreateInstitution(state, container);
      } else {
        await showInstitutionPicker(state, container);
      }
    } finally {
      isLoading = false;
    }
  });
}

// ---- Add Student ----
function setupAddStudent(container, state) {
  container.querySelector('#btn-add-student').addEventListener('click', () => {
    if (!state.currentInstitution) {
      promptCreateInstitution(state, container);
      return;
    }
    showAddStudentForm(state, container);
  });

  container.querySelector('#btn-bulk-add-student').addEventListener('click', () => {
    if (!state.currentInstitution) {
      promptCreateInstitution(state, container);
      return;
    }
    showBulkAddStudentForm(state, container);
  });
}

// ---- Load Institutions ----
async function loadInstitutions(state, container) {
  const MAX_RETRIES = 2;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const [institutions, quotaData] = await Promise.all([
        api.getInstitutions(),
        api.getQuota().catch(() => null),
      ]);
      if (quotaData) {
        state.quota.weeklyUsed = quotaData.weeklyUsed ?? 0;
        state.quota.limit = quotaData.limit ?? 20;
        updateQuotaBadge(container, state);
      }
      state.institutions = institutions || [];

      if (state.institutions.length > 0) {
        state.currentInstitution = state.institutions[0];
        updateWorkspaceDisplay(state, container);
        await loadStudents(state, container);
      } else {
        // No institutions yet — show onboarding
        updateWorkspaceDisplay(state, container);
        renderOnboarding(state, container);
      }
      return; // Success — exit the retry loop
    } catch (err) {
      console.warn(`loadInstitutions attempt ${attempt}/${MAX_RETRIES} failed:`, err.message);
      if (attempt < MAX_RETRIES) {
        // Wait before retrying (token might still be refreshing after hard reload)
        await new Promise(r => setTimeout(r, 1500));
      } else {
        // All retries exhausted
        console.error('All loadInstitutions retries failed.');
        container.querySelector('#workspace-name').textContent = 'Gagal memuat ↻';
        renderOnboarding(state, container);
      }
    }
  }
}

// ---- Onboarding Welcome Screen ----
function renderOnboarding(state, container) {
  const mainContent = container.querySelector('#main-content');
  const sidebar = container.querySelector('#app-sidebar');

  // Hide sidebar on mobile, show empty state on desktop
  sidebar.setAttribute('data-state', 'onboarding');
  container.querySelector('#student-list').innerHTML = `
    <div class="empty-state" style="padding:var(--space-6)">
      <p class="empty-state-desc" style="font-size:var(--font-size-xs);color:var(--text-tertiary)">Pilih atau buat instansi (data TK/PAUD) untuk mulai.</p>
    </div>
  `;

  mainContent.innerHTML = `
    <div class="onboarding">
      <div class="onboarding-hero">
        <div class="onboarding-emoji">🎓</div>
        <h2 class="onboarding-title">Selamat Datang di SiCAPAI!</h2>
        <p class="onboarding-subtitle">Sistem Catatan Capaian Anak — siap membantu Bunda menulis narasi rapor yang hangat & profesional.</p>
      </div>

      <div class="onboarding-steps">
        <h3 class="onboarding-steps-title">📋 3 Langkah Mudah untuk Memulai</h3>

        <div class="onboarding-step">
          <div class="step-number">1</div>
          <div class="step-content">
            <h4>Buat Instansi <span style="font-size:var(--font-size-xs);font-weight:400;color:var(--text-tertiary)">(= data TK/PAUD Anda)</span></h4>
            <p>Daftarkan nama dan alamat sekolah tempat Bunda mengajar. Setelah dibuat, Bunda bisa mengundang rekan guru lain dengan kode undangan.</p>
          </div>
        </div>

        <div class="onboarding-step">
          <div class="step-number">2</div>
          <div class="step-content">
            <h4>Tambahkan Siswa</h4>
            <p>Masukkan data anak didik — nama panggilan, kelompok usia, dan agama. Agama memengaruhi pilihan indikator ibadah secara otomatis.</p>
          </div>
        </div>

        <div class="onboarding-step">
          <div class="step-number">3</div>
          <div class="step-content">
            <h4>Centang & Generate!</h4>
            <p>Pilih capaian anak dari 172 indikator Kurikulum Merdeka, narasi rapor terbentuk otomatis. Bisa diperindah dengan AI Gemini ✨</p>
          </div>
        </div>
      </div>

      <div class="onboarding-actions">
        <button class="btn btn-primary btn-lg" id="btn-onboarding-create">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          Buat Instansi Pertama
        </button>
        <button class="btn btn-secondary btn-sm" id="btn-onboarding-join">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
          Gabung dengan Kode Undangan
        </button>
      </div>
    </div>
  `;

  addOnboardingStyles();

  mainContent.querySelector('#btn-onboarding-create').addEventListener('click', () => {
    promptCreateInstitution(state, container);
  });

  mainContent.querySelector('#btn-onboarding-join').addEventListener('click', () => {
    promptJoinInstitution(state, container);
  });
}

// ---- Update Workspace Display ----
function updateWorkspaceDisplay(state, container) {
  const nameEl = container.querySelector('#workspace-name');
  const exportBtn = container.querySelector('#btn-export-xlsx');

  if (state.currentInstitution) {
    nameEl.textContent = state.currentInstitution.name;
    container.querySelector('#btn-add-student').disabled = false;
    container.querySelector('#btn-bulk-add-student').disabled = false;
    if (exportBtn) exportBtn.style.display = '';
  } else {
    nameEl.textContent = 'Pilih Instansi...';
    if (exportBtn) exportBtn.style.display = 'none';
  }
}

// ---- Load Students ----
async function loadStudents(state, container) {
  if (!state.currentInstitution) return;

  try {
    const students = await api.getStudents(state.currentInstitution.id);
    state.students = students || [];
    renderStudentList(state, container);
  } catch (err) {
    console.warn('Could not load students:', err.message);
  }
}

// ---- Render Student List ----
function renderStudentList(state, container) {
  const listEl = container.querySelector('#student-list');
  const sidebar = container.querySelector('#app-sidebar');
  sidebar.setAttribute('data-state', 'ready');

  if (state.students.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">👧</div>
        <p class="empty-state-desc">Belum ada siswa. Tambahkan siswa baru untuk mulai membuat rapor.</p>
      </div>
    `;
    
    // Also clear the main content loading spinner
    const mainContent = container.querySelector('#main-content');
    if (mainContent) {
      mainContent.innerHTML = `
        <div class="empty-state" style="min-height:60vh">
          <div class="empty-state-icon" style="font-size:4rem;margin-bottom:var(--space-4)">🏫</div>
          <h3 class="empty-state-title" style="font-size:var(--font-size-xl);margin-bottom:var(--space-2)">Instansi Anda Siap!</h3>
          <p class="empty-state-desc">Mulai dengan menambahkan siswa pertama Anda.</p>
          <button class="btn btn-primary" id="btn-empty-add-student" style="margin-top:var(--space-4)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Tambah Siswa Pertama</button>
        </div>
      `;
      mainContent.querySelector('#btn-empty-add-student').addEventListener('click', () => {
        showAddStudentForm(state, container);
      });
    }
    return;
  }

  // Clear the loading spinner — show a "pick a student" prompt
  if (!state.selectedStudent) {
    const mainContent = container.querySelector('#main-content');
    if (mainContent) {
      mainContent.innerHTML = `
        <div class="empty-state" style="min-height:60vh">
          <div class="empty-state-icon" style="font-size:4rem;margin-bottom:var(--space-4)">👈</div>
          <h3 class="empty-state-title" style="font-size:var(--font-size-xl);margin-bottom:var(--space-2)">Pilih Siswa</h3>
          <p class="empty-state-desc">Klik nama siswa untuk mulai menyusun narasi rapor.</p>
        </div>
      `;
    }
  }

  // Group students by ageGroup, sorted A → B → etc.
  const groups = {};
  state.students.forEach(s => {
    if (!groups[s.ageGroup]) groups[s.ageGroup] = [];
    groups[s.ageGroup].push(s);
  });

  listEl.innerHTML = Object.keys(groups).sort().map(groupKey => `
    <div class="student-group">
      <div class="student-group-label">Kelompok ${groupKey}</div>
      ${groups[groupKey].map(s => `
        <div class="student-item-row">
          <button class="student-item ${state.selectedStudent?.id === s.id ? 'active' : ''}"
                  data-id="${s.id}">
            <span class="student-avatar">${s.gender === 'P' ? '👧' : '👦'}</span>
            <div class="student-info">
              <span class="student-name">${escapeHTML(s.name)}${state.finalizedStudents.has(s.id) ? ' <span class="finalized-tick">✅</span>' : ''}</span>
              <span class="student-meta">${escapeHTML(s.nickname || s.name.split(' ')[0])}</span>
            </div>
          </button>
          <button class="student-edit-btn" data-id="${s.id}" title="Ganti nama siswa">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
          </button>
          <button class="student-delete-btn" data-id="${s.id}" title="Hapus siswa">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      `).join('')}
    </div>
  `).join('');

  // Click handlers — select student
  listEl.querySelectorAll('.student-item').forEach((item) => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      state.selectedStudent = state.students.find((s) => s.id === id);
      state.selectedIndicators = {};
      state.templateResult = {};
      state.aiResult = null;
      state.kokurikulerSelected = {};
      state.kokurikulerNarrative = '';
      state.aiKokurikuler = null;
      state.nilaiPlusSelected = {};
      state.saranSelected = {};

      // Update active state
      listEl.querySelectorAll('.student-item').forEach((el) => el.classList.remove('active'));
      item.classList.add('active');

      // Render checklist
      renderMainPanel(state, container);
      // Background sync: silently update if server has newer data
      syncProgressFromServer(state, container, state.selectedStudent);
    });
  });

  // Click handlers — rename student
  listEl.querySelectorAll('.student-edit-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const studentId = btn.dataset.id;
      const student = state.students.find(s => s.id === studentId);
      if (!student) return;

      const { showModal } = await import('../shared/modal.js');
      const form = document.createElement('div');
      form.innerHTML = `
        <div class="form-group" style="margin-bottom:var(--space-4)">
          <label class="form-label" for="rename-input">Nama Lengkap</label>
          <input class="form-input" id="rename-input" value="${escapeAttr(student.name)}" autocomplete="off" />
        </div>
        <div class="form-group" style="margin-bottom:var(--space-6)">
          <label class="form-label" for="rename-nickname">Nama Panggilan <span style="color:var(--text-tertiary);font-weight:400">(dipakai di narasi rapor)</span></label>
          <input class="form-input" id="rename-nickname" value="${escapeAttr(student.nickname || '')}" placeholder="Contoh: Ilmi" autocomplete="off" />
        </div>
        <div style="display:flex;gap:var(--space-3);justify-content:flex-end">
          <button class="btn btn-secondary btn-sm" id="rename-cancel">Batal</button>
          <button class="btn btn-primary btn-sm" id="rename-save">Simpan</button>
        </div>
      `;

      const modal = showModal({
        title: 'Ganti Nama Siswa',
        content: form,
      });

      // Cancel button
      form.querySelector('#rename-cancel').addEventListener('click', () => modal.close());

      // Save button
      form.querySelector('#rename-save').addEventListener('click', async () => {
        const newName = form.querySelector('#rename-input').value.trim();
        const newNickname = form.querySelector('#rename-nickname').value.trim();
        if (!newName) { markInputError(form.querySelector('#rename-input')); showToast('Nama tidak boleh kosong.', 'warning'); return; }
        if (!newNickname) { markInputError(form.querySelector('#rename-nickname')); showToast('Nama panggilan wajib diisi.', 'warning'); return; }
        if (newName === student.name && newNickname === (student.nickname || '')) { modal.close(); return; }

        const saveBtn = form.querySelector('#rename-save');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Menyimpan...';

        try {
          await api.updateStudent(student.id, {
            name: newName,
            nickname: newNickname,
            gender: student.gender,
            ageGroup: student.ageGroup,
            religion: student.religion,
          });
          student.name = newName;
          student.nickname = newNickname;
          if (state.selectedStudent?.id === student.id) {
            state.selectedStudent.name = newName;
            state.selectedStudent.nickname = newNickname;
            renderMainPanel(state, container);
          }
          renderStudentList(state, container);
          showToast('Nama siswa berhasil diubah.', 'success');
          modal.close();
        } catch (err) {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Simpan';
          showToast(err.message || 'Gagal mengubah nama.', 'error');
        }
      });

      // Enter key to save
      form.querySelector('#rename-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') form.querySelector('#rename-save').click();
      });

      // Auto-focus and select input text
      setTimeout(() => {
        const input = form.querySelector('#rename-input');
        if (input) { input.focus(); input.select(); }
      }, 100);
    });
  });

  // Click handlers — delete student
  listEl.querySelectorAll('.student-delete-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const studentId = btn.dataset.id;
      const student = state.students.find(s => s.id === studentId);
      if (!student) return;

      const { showConfirmDialog } = await import('../shared/modal.js');
      const confirmed = await showConfirmDialog({
        title: 'Hapus Siswa?',
        message: `Data "${escapeHTML(student.name)}" dan seluruh rapornya akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`,
        confirmLabel: 'Hapus',
        danger: true,
      });
      if (!confirmed) return;

      try {
        await api.deleteStudent(studentId);
        state.students = state.students.filter(s => s.id !== studentId);
        state.finalizedStudents.delete(studentId);
        if (state.selectedStudent?.id === studentId) {
          state.selectedStudent = null;
          state.selectedIndicators = {};
          state.templateResult = {};
          state.aiResult = null;
          state.kokurikulerSelected = {};
          state.kokurikulerNarrative = '';
          state.aiKokurikuler = null;
          state.nilaiPlusSelected = {};
          state.saranSelected = {};
          state.aiHistory = {};
          const mainContent = container.querySelector('#main-content');
          if (mainContent) {
            mainContent.innerHTML = `
              <div class="empty-state" style="min-height:60vh">
                <div class="empty-state-icon" style="font-size:4rem;margin-bottom:var(--space-4)">👈</div>
                <h3 class="empty-state-title" style="font-size:var(--font-size-xl);margin-bottom:var(--space-2)">Pilih Siswa</h3>
                <p class="empty-state-desc">Klik nama siswa untuk mulai menyusun narasi rapor.</p>
              </div>
            `;
          }
        }
        renderStudentList(state, container);
        showToast(`Siswa "${student.name}" berhasil dihapus.`, 'success');
      } catch (err) {
        showToast(err.message || 'Gagal menghapus siswa.', 'error');
      }
    });
  });

  // Sidebar export footer — show only when ≥1 finalized report exists
  const exportFooter = container.querySelector('#sidebar-export-footer');
  if (exportFooter) {
    exportFooter.style.display = state.finalizedStudents.size > 0 ? 'block' : 'none';
    const exportBtn = container.querySelector('#btn-sidebar-export');
    if (exportBtn && !exportBtn._listenerAttached) {
      exportBtn._listenerAttached = true;
      exportBtn.addEventListener('click', async () => {
        exportBtn.disabled = true;
        const origHTML = exportBtn.innerHTML;
        exportBtn.textContent = '⏳ Mengunduh...';
        try {
          const reports = await api.getInstitutionReports(state.currentInstitution.id);
          if (!reports || reports.length === 0) {
            showToast('Belum ada rapor yang difinalisasi di instansi ini.', 'warning');
            return;
          }
          exportInstitutionToXlsx(reports, state.currentInstitution.name);
          showToast(`${reports.length} rapor berhasil diekspor! 📊`, 'success');
        } catch (err) {
          showToast(err.message || 'Gagal mengekspor data.', 'error');
        } finally {
          exportBtn.disabled = false;
          exportBtn.innerHTML = origHTML;
        }
      });
    }
  }
}

// Seed aiHistory from existing aiResult entries that have no history yet.
// Ensures backward-compat: progress saved before aiHistory was introduced
// still gets version-bar navigation on load.
function seedAiHistory(state) {
  for (const [sectionId, text] of Object.entries(state.aiResult || {})) {
    if (text && !state.aiHistory[sectionId]?.length) {
      state.aiHistory[sectionId] = [text];
    }
  }
  if (state.aiKokurikuler && !state.aiHistory['kokurikuler']?.length) {
    state.aiHistory['kokurikuler'] = [state.aiKokurikuler];
  }
}

// ---- Background Sync: pull server progress and re-render if newer ----
async function syncProgressFromServer(state, container, student) {
  try {
    const serverData = await Promise.race([
      api.loadProgress(student.id),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
    ]);
    if (!serverData) return;

    // Only apply if server data is strictly newer than what we already have
    const localRaw = localStorage.getItem(getProgressKey(student));
    const local = localRaw ? JSON.parse(localRaw) : null;
    const localSavedAt = local?.savedAt || 0;
    if ((serverData.savedAt || 0) <= localSavedAt) return;

    // Content-guard: skip if indicators + AI are identical (avoids spurious re-renders on hot reload)
    const sameIndicators = JSON.stringify(serverData.selectedIndicators || {}) === JSON.stringify(local?.selectedIndicators || {});
    const sameAI = JSON.stringify(serverData.aiResult || {}) === JSON.stringify(local?.aiResult || {});
    const sameKokurikuler = JSON.stringify(serverData.kokurikulerSelected || {}) === JSON.stringify(local?.kokurikulerSelected || {});
    const sameAiKokurikuler = (serverData.aiKokurikuler || null) === (local?.aiKokurikuler || null);
    if (sameIndicators && sameAI && sameKokurikuler && sameAiKokurikuler) return;

    // Server has genuinely fresher data — update state and UI
    // Defensive merge: if server doc predates kokurikuler feature, fall back to local values
    state.selectedIndicators = serverData.selectedIndicators || {};
    state.aiResult = serverData.aiResult || {};
    state.kokurikulerSelected = serverData.kokurikulerSelected ?? local?.kokurikulerSelected ?? {};
    state.aiKokurikuler = serverData.aiKokurikuler !== undefined ? serverData.aiKokurikuler : (local?.aiKokurikuler ?? null);
    state.nilaiPlusSelected = serverData.nilaiPlusSelected ?? local?.nilaiPlusSelected ?? {};
    state.saranSelected = serverData.saranSelected ?? local?.saranSelected ?? {};
    seedAiHistory(state);
    const mergedData = { ...serverData, kokurikulerSelected: state.kokurikulerSelected, aiKokurikuler: state.aiKokurikuler, nilaiPlusSelected: state.nilaiPlusSelected, saranSelected: state.saranSelected };
    localStorage.setItem(getProgressKey(student), JSON.stringify(mergedData));

    // Re-render if this student is still selected
    if (state.selectedStudent?.id === student.id) {
      renderMainPanel(state, container);
      // Quiet inline indicator instead of intrusive toast
      const saveStatus = container.querySelector('#save-status');
      if (saveStatus) {
        saveStatus.textContent = '↓ Tersinkronisasi';
        setTimeout(() => { saveStatus.textContent = '✓ Data tersedia'; }, 3000);
      }
    }
  } catch {
    // Silent — network or timeout failures are expected offline
  }
}

// ---- Render Main Panel (Checklist + Preview) ----
function renderMainPanel(state, container) {
  state.templateResult = {};
  state.aiResult = {};
  state.aiHistory = {};
  state.kokurikulerSelected = {};
  state.kokurikulerNarrative = '';
  state.aiKokurikuler = null;
  state.nilaiPlusSelected = {};
  state.saranSelected = {};

  // Restore saved progress for this student
  const savedProgress = loadProgress(state.selectedStudent);
  if (savedProgress) {
    state.selectedIndicators = savedProgress.selectedIndicators || {};
    state.aiResult = savedProgress.aiResult || {};
    state.kokurikulerSelected = savedProgress.kokurikulerSelected || {};
    state.aiKokurikuler = savedProgress.aiKokurikuler || null;
    state.nilaiPlusSelected = savedProgress.nilaiPlusSelected || {};
    state.saranSelected = savedProgress.saranSelected || {};
    seedAiHistory(state);
  }

  const mainContent = container.querySelector('#main-content');

  container.querySelector('.app-body').dataset.selected = 'true';

  mainContent.innerHTML = `
    <div class="report-workspace">
      <button class="mobile-back-btn" id="btn-mobile-back">← Daftar Siswa</button>
      <div class="report-info card">
        <div class="report-student-header">
          <span class="report-student-avatar">${state.selectedStudent.gender === 'P' ? '👧' : '👦'}</span>
          <div>
            <h2 class="report-student-name">${escapeHTML(state.selectedStudent.name)}</h2>
            <p class="report-student-meta">Kelompok ${escapeHTML(state.selectedStudent.ageGroup)} · ${escapeHTML(state.selectedStudent.religion || 'Tidak diset')}</p>
          </div>
        </div>
        <div class="report-meta-row">
          <div class="meta-field">
            <label class="meta-label" for="report-semester">Semester</label>
            <select class="form-select" id="report-semester">
              <option value="1">Smt. 1</option>
              <option value="2">Smt. 2</option>
            </select>
          </div>
          <div class="meta-field">
            <label class="meta-label" for="report-year">Tahun Ajaran</label>
            <input class="form-input" id="report-year" value="2025/2026" />
          </div>
          <div class="save-indicator" id="save-indicator">
            <span id="save-status">${savedProgress ? '✓ Data tersedia' : ''}</span>
          </div>
        </div>
      </div>

      <div class="report-panels">
        <div class="report-checklist-panel" id="checklist-panel"></div>
        <div class="report-preview-panel" id="preview-panel"></div>
      </div>
    </div>
  `;

  addReportStyles(container);

  // Restore form values
  if (savedProgress?.semester) {
    mainContent.querySelector('#report-semester').value = savedProgress.semester;
  }
  if (savedProgress?.year) {
    mainContent.querySelector('#report-year').value = savedProgress.year;
  }

  // Rebuild template from restored indicators
  if (savedProgress && Object.keys(state.selectedIndicators).length > 0) {
    state.templateResult = generateTemplate(
      state.selectedStudent.nickname || state.selectedStudent.name,
      state.selectedIndicators,
      state.selectedStudent.religion
    );
    // Drop AI results for sections no longer in template
    const validAI = {};
    for (const [k, v] of Object.entries(state.aiResult)) {
      if (state.templateResult[k]) validAI[k] = v;
    }
    state.aiResult = validAI;
  }

  // Compute level distribution for a specific curriculum section
  const computeSectionLevelProfile = (sectionId, selectedIndicators) => {
    const structure = getChecklistStructure();
    const sectionData = structure.find((e) => e.id === sectionId);
    if (!sectionData) return null;
    const counts = { BB: 0, MB: 0, BSH: 0, BSB: 0 };
    for (const sub of sectionData.subElemen) {
      for (const ind of sub.indikator) {
        const sel = selectedIndicators[ind.id];
        if (sel?.level && Object.hasOwn(counts, sel.level)) counts[sel.level]++;
      }
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total === 0) return null;
    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    return { dominant, distribution: counts };
  };

  // Per-section AI generator
  const onGenerateAI = async (sectionId) => {
    if (state.quota.weeklyUsed >= state.quota.limit) {
      showToast('Kuota AI minggu ini sudah habis.', 'error');
      throw new Error('quota_exceeded');
    }
    if (sectionId === 'kokurikuler') {
      if (!state.kokurikulerNarrative) {
        showToast('Pilih indikator kokurikuler terlebih dahulu.', 'warning');
        throw new Error('no_template');
      }
      try {
        const result = await api.generateAI({
          studentName: state.selectedStudent.nickname || state.selectedStudent.name,
          ageGroup: state.selectedStudent.ageGroup,
          semester: mainContent.querySelector('#report-semester').value,
          templateNarrative: { kokurikuler: state.kokurikulerNarrative },
        });
        state.aiKokurikuler = result.narrative['kokurikuler'];
        if (!state.aiHistory['kokurikuler']) state.aiHistory['kokurikuler'] = [];
        state.aiHistory['kokurikuler'].push(state.aiKokurikuler);
        state.quota.weeklyUsed++;
        updateQuotaBadge(container, state);
        saveProgress(state);
        const saveStatus = mainContent.querySelector('#save-status');
        if (saveStatus) saveStatus.textContent = '✓ Tersimpan ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        renderPreviewWithCallbacks();
        showToast('Narasi berhasil diperindah! ✨', 'success');
        const sectionEl = mainContent.querySelector('#section-kokurikuler');
        if (sectionEl) sectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (err) {
        showToast(err.message || 'Gagal generate AI. Coba lagi nanti.', 'error');
        throw err;
      }
      return;
    }
    if (!state.templateResult[sectionId]) {
      showToast('Pilih indikator untuk bagian ini terlebih dahulu.', 'warning');
      throw new Error('no_template');
    }

    try {
      const result = await api.generateAI({
        studentName: state.selectedStudent.nickname || state.selectedStudent.name,
        ageGroup: state.selectedStudent.ageGroup,
        semester: mainContent.querySelector('#report-semester').value,
        templateNarrative: { [sectionId]: state.templateResult[sectionId] },
        levelProfile: computeSectionLevelProfile(sectionId, state.selectedIndicators),
      });

      state.aiResult[sectionId] = result.narrative[sectionId];
      if (!state.aiHistory[sectionId]) state.aiHistory[sectionId] = [];
      state.aiHistory[sectionId].push(result.narrative[sectionId]);
      state.quota.weeklyUsed++;

      updateQuotaBadge(container, state);
      saveProgress(state);

      const saveStatus = mainContent.querySelector('#save-status');
      if (saveStatus) saveStatus.textContent = '✓ Tersimpan ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

      renderPreviewWithCallbacks();
      showToast('Narasi berhasil diperindah! ✨', 'success');

      const sectionEl = mainContent.querySelector(`#section-${sectionId}`);
      if (sectionEl) sectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      showToast(err.message || 'Gagal generate AI. Coba lagi nanti.', 'error');
      throw err;
    }
  };

  // --- Navigate to next student in sidebar display order ---
  const onNextStudent = () => {
    const groups = {};
    state.students.forEach(s => {
      const g = s.ageGroup || '-';
      if (!groups[g]) groups[g] = [];
      groups[g].push(s);
    });
    const ordered = Object.keys(groups).sort().flatMap(g => groups[g]);
    const currentIdx = ordered.findIndex(s => s.id === state.selectedStudent.id);
    const next = ordered[currentIdx + 1];
    if (!next) {
      showToast('Ini sudah siswa terakhir dalam daftar.', 'info');
      return;
    }
    state.selectedStudent = next;
    state.selectedIndicators = {};
    state.templateResult = {};
    state.aiResult = null;
    state.aiHistory = {};
    state.kokurikulerSelected = {};
    state.kokurikulerNarrative = '';
    state.aiKokurikuler = null;
    state.nilaiPlusSelected = {};
    state.saranSelected = {};
    const listEl = container.querySelector('#student-list');
    listEl.querySelectorAll('.student-item').forEach(el => el.classList.remove('active'));
    listEl.querySelector(`.student-item[data-id="${next.id}"]`)?.classList.add('active');
    renderMainPanel(state, container);
    syncProgressFromServer(state, container, next);
  };

  // --- Finalize Report Callback ---
  const onFinalizeReport = async () => {
    const { showConfirmDialog } = await import('../shared/modal.js');
    const semester = mainContent.querySelector('#report-semester').value;
    const year = mainContent.querySelector('#report-year').value;
    const semLabel = semester === '1' ? 'Semester 1 (Ganjil)' : 'Semester 2 (Genap)';

    const confirmed = await showConfirmDialog({
      title: 'Finalisasi Laporan Capaian Pembelajaran',
      message: `Tinjau kembali narasi sebelum menyimpan sebagai dokumen final.<br><br><strong style="color:var(--text-primary);font-size:1.1em">${escapeHTML(state.selectedStudent.name)}</strong><br>${escapeHTML(semLabel)} — TA ${escapeHTML(year)}`,
      confirmLabel: 'Ya, Finalisasi',
      cancelLabel: 'Tinjau Ulang',
      danger: false,
    });
    if (!confirmed) return;

    const btnEl = mainContent.querySelector('#btn-finalize-report');
    if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Menyimpan...'; }

    try {
      // Merge all section narratives for unified storage
      const mergedTemplate = { ...state.templateResult };
      const mergedAI = { ...(state.aiResult || {}) };
      if (state.kokurikulerNarrative) mergedTemplate.kokurikuler = state.kokurikulerNarrative;
      if (state.aiKokurikuler) mergedAI.kokurikuler = state.aiKokurikuler;
      const _nickFin = state.selectedStudent.nickname || state.selectedStudent.name;
      const _npNarFin = generateNilaiPlusNarrative(_nickFin, state.nilaiPlusSelected);
      if (_npNarFin) mergedTemplate['nilai-plus'] = _npNarFin;
      const _saranNarFin = generateSaranNarrative(_nickFin, state.saranSelected);
      if (_saranNarFin) mergedTemplate['saran'] = _saranNarFin;

      const savedReport = await api.saveReport({
        studentId: state.selectedStudent.id,
        institutionId: state.currentInstitution.id,
        semester,
        academicYear: year,
        selectedIndicators: state.selectedIndicators,
        kokurikulerSelected: state.kokurikulerSelected || {},
        nilaiPlusSelected: state.nilaiPlusSelected || {},
        saranSelected: state.saranSelected || {},
        templateNarrative: mergedTemplate,
        aiNarrative: mergedAI || null,
        studentName: state.selectedStudent.name,
        studentMeta: {
          ageGroup: state.selectedStudent.ageGroup,
          religion: state.selectedStudent.religion,
          gender: state.selectedStudent.gender,
        },
      });

      // Mark student as finalized (local session)
      state.finalizedStudents.add(state.selectedStudent.id);
      renderStudentList(state, container);

      // Show Achievement State
      const _achTemplate = { ...state.templateResult };
      if (state.kokurikulerNarrative) _achTemplate.kokurikuler = state.kokurikulerNarrative;
      const _achAI = { ...(state.aiResult || {}) };
      if (state.aiKokurikuler) _achAI.kokurikuler = state.aiKokurikuler;
      if (_npNarFin) _achTemplate['nilai-plus'] = _npNarFin;
      if (_saranNarFin) _achTemplate['saran'] = _saranNarFin;
      renderAchievementState(mainContent.querySelector('#preview-panel'), {
        studentName: state.selectedStudent.name,
        semester: semLabel,
        year,
        reportData: {
          ...savedReport,
          studentName: state.selectedStudent.name,
          studentMeta: { ageGroup: state.selectedStudent.ageGroup, religion: state.selectedStudent.religion, gender: state.selectedStudent.gender },
          semester,
          academicYear: year,
          templateNarrative: _achTemplate,
          aiNarrative: _achAI,
          finalizedAt: new Date(),
        },
        institutionName: state.currentInstitution?.name || '',
        onViewHistory: () => showHistoryPanel(),
        onBackToEditor: () => renderPreviewWithCallbacks(),
        onNextStudent,
        studentNickname: state.selectedStudent.nickname || state.selectedStudent.name,
        onCopyCapaian: state.students.length > 1 ? () => openCopyCapaianModal(state) : null,
      });

    } catch (err) {
      if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 15 11 17 15 13"/></svg>Finalisasi & Simpan Rapor`; }
      showToast(err.message || 'Gagal menyimpan rapor.', 'error');
    }
  };

  // --- View History Callback (opens as modal overlay) ---
  const showHistoryPanel = async () => {
    const instName = state.currentInstitution?.name || '';
    const studentName = state.selectedStudent.name;

    // Create modal backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'rv-backdrop archive-modal-backdrop';
    backdrop.innerHTML = `
      <div class="rv-modal archive-modal">
        <div class="rv-header">
          <div>
            <h2 class="rv-title">Arsip Rapor</h2>
            <p class="rv-subtitle">${escapeHTML(studentName)}</p>
          </div>
          <button class="rv-close-x" id="archive-close" aria-label="Tutup">&times;</button>
        </div>
        <div class="rv-body" id="archive-body">
          <div style="display:flex;align-items:center;justify-content:center;min-height:150px">
            <div class="spinner-ring"></div>
          </div>
        </div>
        <div class="rv-footer">
          <button class="btn btn-ghost btn-sm" id="archive-close-btn">Tutup</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);
    addReportViewerStyles();
    requestAnimationFrame(() => backdrop.classList.add('active'));

    function close() {
      backdrop.classList.remove('active');
      backdrop.addEventListener('transitionend', () => backdrop.remove(), { once: true });
    }

    backdrop.querySelector('#archive-close').addEventListener('click', close);
    backdrop.querySelector('#archive-close-btn').addEventListener('click', close);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
    document.addEventListener('keydown', function escH(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escH); }
    });

    // Fetch reports
    try {
      const reports = await api.getStudentReports(state.selectedStudent.id);
      const body = backdrop.querySelector('#archive-body');

      if (!reports || reports.length === 0) {
        body.innerHTML = `
          <div style="text-align:center;padding:var(--space-8)">
            <div style="font-size:2.5rem;margin-bottom:var(--space-4)">📂</div>
            <p style="color:var(--text-tertiary)">Belum ada dokumen rapor yang difinalisasi untuk siswa ini.</p>
          </div>
        `;
        return;
      }

      const listHTML = reports.map((report, idx) => {
        const semLabel = report.semester === '1' ? 'Semester 1' : 'Semester 2';
        let dateStr = '';
        try {
          const d = report.finalizedAt?.toDate ? report.finalizedAt.toDate() :
                    report.finalizedAt?._seconds ? new Date(report.finalizedAt._seconds * 1000) :
                    new Date(report.finalizedAt);
          dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch { dateStr = '-'; }

        return `
          <div class="archive-item${idx === 0 ? ' archive-item--latest' : ''}" data-idx="${idx}">
            <div class="archive-item-left">
              <span class="archive-badge">${semLabel}</span>
              <div class="archive-item-meta">
                <span class="archive-item-year">TA ${report.academicYear || '-'}</span>
                <span class="archive-item-date">${dateStr}</span>
              </div>
            </div>
            <div class="archive-item-actions">
              <button class="btn btn-ghost btn-sm archive-btn-view" data-idx="${idx}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:2px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Lihat
              </button>
              <button class="btn btn-ghost btn-sm archive-btn-print" data-idx="${idx}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Cetak</button>
            </div>
          </div>
        `;
      }).join('');

      body.innerHTML = `<div class="archive-list">${listHTML}</div>`;

      // Bind view buttons
      body.querySelectorAll('.archive-btn-view').forEach(btn => {
        btn.addEventListener('click', () => {
          const report = reports[parseInt(btn.dataset.idx)];
          openReportViewerModal(report, instName);
        });
      });

      // Bind print buttons
      body.querySelectorAll('.archive-btn-print').forEach(btn => {
        btn.addEventListener('click', () => {
          const report = reports[parseInt(btn.dataset.idx)];
          printReport(report, instName);
        });
      });

    } catch (err) {
      const body = backdrop.querySelector('#archive-body');
      body.innerHTML = `
        <div style="text-align:center;padding:var(--space-8)">
          <div style="font-size:2rem;margin-bottom:var(--space-4)">⚠️</div>
          <p style="color:var(--text-tertiary)">Gagal memuat arsip rapor.</p>
        </div>
      `;
    }
  };

  const scrollToSection = (sectionId) => {
    requestAnimationFrame(() => {
      const el = mainContent.querySelector(`#section-${sectionId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  // Called by preview when user resets AI for one section (no quota cost)
  const onResetSectionAI = (sectionId) => {
    if (sectionId === 'kokurikuler') {
      state.aiKokurikuler = null;
    } else {
      delete state.aiResult[sectionId];
    }
    saveProgress(state);
    renderPreviewWithCallbacks();
    scrollToSection(sectionId);
  };

  // Called by preview when user navigates AI history for one section
  const onSelectAIVersion = (sectionId, idx) => {
    if (sectionId === 'kokurikuler') {
      state.aiKokurikuler = state.aiHistory['kokurikuler']?.[idx] ?? null;
    } else {
      state.aiResult[sectionId] = state.aiHistory[sectionId][idx];
    }
    saveProgress(state);
    renderPreviewWithCallbacks();
    scrollToSection(sectionId);
  };

  // Destructive reset — extracted as named callback so ⋯ menu can call it
  const doResetProgress = async () => {
    const { showConfirmDialog } = await import('../shared/modal.js');
    const confirmed = await showConfirmDialog({
      title: 'Mulai Ulang Progress?',
      message: `Semua indikator yang dicentang dan narasi AI untuk <strong>${escapeHTML(state.selectedStudent.name)}</strong> akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`,
      confirmLabel: 'Ya, Hapus Semua',
      cancelLabel: 'Batal',
      danger: true,
    });
    if (!confirmed) return;
    try {
      localStorage.removeItem(getProgressKey(state.selectedStudent));
      api.resetProgress(state.selectedStudent.id).catch(() => {});
      state.selectedIndicators = {};
      state.templateResult = {};
      state.aiResult = {};
      state.aiHistory = {};
      state.kokurikulerSelected = {};
      state.kokurikulerNarrative = '';
      state.aiKokurikuler = null;
      state.nilaiPlusSelected = {};
      state.saranSelected = {};
      renderMainPanel(state, container);
      showToast('Progress berhasil direset.', 'success');
    } catch (err) {
      showToast(err.message || 'Gagal mereset progress.', 'error');
    }
  };

  const doCopyCapaian = state.students.length > 1 ? () => {
    const selCount = countSelected(state.selectedIndicators);
    if (selCount.total === 0) {
      showToast('Pilih minimal 1 indikator sebelum menyalin capaian.', 'warning');
      return;
    }
    openCopyCapaianModal(state);
  } : null;

  // --- Helper: render preview with all callbacks ---
  const renderPreviewWithCallbacks = () => {
    const mergedTemplate = { ...state.templateResult };
    const mergedAI = { ...(state.aiResult || {}) };
    if (state.kokurikulerNarrative) mergedTemplate.kokurikuler = state.kokurikulerNarrative;
    if (state.aiKokurikuler) mergedAI.kokurikuler = state.aiKokurikuler;
    const studentNick = state.selectedStudent.nickname || state.selectedStudent.name;
    const npNarrative = generateNilaiPlusNarrative(studentNick, state.nilaiPlusSelected);
    if (npNarrative) mergedTemplate['nilai-plus'] = npNarrative;
    const saranNarrative = generateSaranNarrative(studentNick, state.saranSelected);
    if (saranNarrative) mergedTemplate['saran'] = saranNarrative;

    renderPreview(
      mainContent.querySelector('#preview-panel'),
      mergedTemplate,
      mergedAI,
      state.selectedStudent.name,
      { onGenerateAI, quota: state.quota, onFinalizeReport, onViewHistory: showHistoryPanel, onResetSectionAI, onSelectAIVersion, aiHistory: state.aiHistory, onResetProgress: doResetProgress, onCopyCapaian: doCopyCapaian, onSave: () => saveProgress(state) }
    );
  };

  // Auto-generate on checkbox change (debounced)
  let autoGenTimer = null;
  renderChecklist(
    mainContent.querySelector('#checklist-panel'),
    state.selectedStudent,
    state.selectedIndicators,
    (indicators) => {
      state.selectedIndicators = indicators;
      clearTimeout(autoGenTimer);
      autoGenTimer = setTimeout(() => {
        const sel = countSelected(indicators);
        const resetBtn = mainContent.querySelector('#btn-reset-progress');
        if (resetBtn) resetBtn.disabled = sel.total === 0;
        const hasOtherContent = state.kokurikulerNarrative ||
          Object.keys(state.nilaiPlusSelected).length > 0 ||
          Object.keys(state.saranSelected).length > 0;
        if (sel.total === 0 && !hasOtherContent) {
          state.templateResult = {};
          state.aiResult = {};
          renderPreview(mainContent.querySelector('#preview-panel'), null, null);
        } else {
          const prevTemplate = { ...state.templateResult };
          state.templateResult = generateTemplate(
            state.selectedStudent.nickname || state.selectedStudent.name,
            indicators,
            state.selectedStudent.religion
          );
          // Revert AI to Baku for sections whose template text changed (content is now stale)
          for (const sectionId of Object.keys(state.templateResult)) {
            if (prevTemplate[sectionId] !== state.templateResult[sectionId]) {
              delete state.aiResult[sectionId];
            }
          }
          // Prune AI results for sections removed from template
          const validAI = {};
          for (const [k, v] of Object.entries(state.aiResult)) {
            if (state.templateResult[k]) validAI[k] = v;
          }
          state.aiResult = validAI;
          renderPreviewWithCallbacks();

          // Side-by-side desktop only (>1024px): scroll to + flash changed sections
          if (window.innerWidth > 1024) {
            requestAnimationFrame(() => {
              let scrolledOnce = false;
              Object.keys(state.templateResult).forEach(sectionId => {
                if (prevTemplate[sectionId] !== state.templateResult[sectionId]) {
                  const el = mainContent.querySelector(`#section-${sectionId} .preview-narrative`);
                  if (!el) return;
                  // Scroll first changed section into view inside .preview-body
                  if (!scrolledOnce) {
                    el.closest('.preview-section')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    scrolledOnce = true;
                  }
                  el.classList.remove('narrative-changed');
                  void el.offsetWidth;
                  el.classList.add('narrative-changed');
                  el.addEventListener('animationend', () => el.classList.remove('narrative-changed'), { once: true });
                }
              });
            });
          }
        }
        saveProgress(state);
        const saveStatus = mainContent.querySelector('#save-status');
        if (saveStatus) saveStatus.textContent = '✓ Tersimpan ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      }, 300);
    }
  );

  // Kokurikuler checklist — appended below intrakurikuler with visual divider
  renderKokurikulerChecklist(
    mainContent.querySelector('#checklist-panel'),
    state.kokurikulerSelected,
    (kokurikulerSel) => {
      state.kokurikulerSelected = kokurikulerSel;
      const prevNarrative = state.kokurikulerNarrative;
      state.kokurikulerNarrative = generateKokurikulerNarrative(
        state.selectedStudent.nickname || state.selectedStudent.name,
        kokurikulerSel
      );
      // Invalidate AI if template changed
      if (prevNarrative !== state.kokurikulerNarrative) {
        state.aiKokurikuler = null;
      }
      renderPreviewWithCallbacks();
      // Scroll + flash kokurikuler section on desktop (mirrors intrakurikuler behavior)
      if (window.innerWidth > 1024 && prevNarrative !== state.kokurikulerNarrative) {
        requestAnimationFrame(() => {
          const el = mainContent.querySelector('#section-kokurikuler .preview-narrative');
          if (!el) return;
          el.closest('.preview-section')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          el.classList.remove('narrative-changed');
          void el.offsetWidth;
          el.classList.add('narrative-changed');
          el.addEventListener('animationend', () => el.classList.remove('narrative-changed'), { once: true });
        });
      }
      saveProgress(state);
      const saveStatus = mainContent.querySelector('#save-status');
      if (saveStatus) saveStatus.textContent = '✓ Tersimpan ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }
  );

  // Nilai Plus checklist — appended below kokurikuler
  const scrollPreviewToSection = (sectionId) => {
    if (window.innerWidth <= 1024) return;
    requestAnimationFrame(() => {
      mainContent.querySelector(`#preview-panel #section-${sectionId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  renderNilaiPlusChecklist(
    mainContent.querySelector('#checklist-panel'),
    state.nilaiPlusSelected,
    (npSel) => {
      state.nilaiPlusSelected = npSel;
      renderPreviewWithCallbacks();
      scrollPreviewToSection('nilai-plus');
      saveProgress(state);
      const saveStatus = mainContent.querySelector('#save-status');
      if (saveStatus) saveStatus.textContent = '✓ Tersimpan ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }
  );

  // Saran checklist — appended below nilai-plus
  renderSaranChecklist(
    mainContent.querySelector('#checklist-panel'),
    state.saranSelected,
    (saranSel) => {
      state.saranSelected = saranSel;
      renderPreviewWithCallbacks();
      scrollPreviewToSection('saran');
      saveProgress(state);
      const saveStatus = mainContent.querySelector('#save-status');
      if (saveStatus) saveStatus.textContent = '✓ Tersimpan ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }
  );

  // Rebuild kokurikuler narrative from restored state
  if (Object.keys(state.kokurikulerSelected).length > 0) {
    state.kokurikulerNarrative = generateKokurikulerNarrative(
      state.selectedStudent.nickname || state.selectedStudent.name,
      state.kokurikulerSelected
    );
  }

  // Initial preview render (uses restored state if available)
  const hasAnyContent = Object.keys(state.templateResult).length > 0 || state.kokurikulerNarrative ||
    Object.keys(state.nilaiPlusSelected).length > 0 || Object.keys(state.saranSelected).length > 0;
  if (hasAnyContent) {
    renderPreviewWithCallbacks();
  } else {
    renderPreview(
      mainContent.querySelector('#preview-panel'),
      null, null, state.selectedStudent.name,
      { onViewHistory: showHistoryPanel }
    );
  }

  // Mobile back button — return to student list
  mainContent.querySelector('#btn-mobile-back')?.addEventListener('click', () => {
    container.querySelector('.app-body').removeAttribute('data-selected');
    state.selectedStudent = null;
    container.querySelectorAll('.student-item').forEach(el => el.classList.remove('active'));
    mainContent.innerHTML = '';
  });
}
// ---- Achievement State (after finalization) ----
function renderAchievementState(container, options) {
  const { studentName, semester, year, reportData, institutionName, onViewHistory, onBackToEditor, onNextStudent, onCopyCapaian, studentNickname } = options;

  const now = new Date();
  const timestamp = now.toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const confettiColors = ['#0D9488', '#F43F5E', '#FFBA49', '#00C9A7', '#A78BFA', '#FB923C', '#34D399', '#F472B6'];
  const confettiHTML = Array.from({ length: 20 }, (_, i) => {
    const color = confettiColors[i % confettiColors.length];
    const left = Math.random() * 100;
    const delay = Math.random() * 1.5;
    const size = 4 + Math.random() * 6;
    return `<span class="confetti-piece" style="left:${left}%;animation-delay:${delay}s;background:${color};width:${size}px;height:${size}px;"></span>`;
  }).join('');

  container.innerHTML = `
    <div class="preview-panel achievement-panel">
      <div class="confetti-container">${confettiHTML}</div>
      <div class="achievement-body">
        <div class="achievement-icon">✅</div>
        <h2 class="achievement-title">Laporan Capaian Pembelajaran<br>Telah Difinalisasi</h2>
        <p class="achievement-meta"><strong>${escapeHTML(studentName)}</strong> — ${escapeHTML(semester)}, TA ${escapeHTML(year)}</p>
        <p class="achievement-timestamp">Disimpan pada ${timestamp} WIB</p>
        <div class="achievement-actions">
          <button class="btn btn-secondary" id="btn-ach-view">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Lihat Narasi Lengkap
          </button>
          <button class="btn btn-primary" id="btn-ach-docx">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Unduh DOCX
          </button>
          ${onNextStudent ? `
          <button class="btn btn-secondary" id="btn-ach-next">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Lanjut ke Siswa Berikutnya
          </button>` : ''}
          ${onCopyCapaian ? `
            <div class="ach-copy-offer">
              <p class="ach-copy-offer-text">
                <strong>Ada siswa lain yang perkembangannya mirip ${escapeHTML(studentNickname || studentName)}?</strong><br>
                Salin capaian yang sama ke mereka — hemat waktu, lanjutkan rapor lebih cepat.
              </p>
              <button class="btn btn-secondary btn-sm" id="btn-ach-copy-capaian">👥 Terapkan ke Siswa Lain</button>
            </div>
          ` : ''}
          <div class="ach-tertiary-row">
            <button class="btn btn-ghost btn-sm" id="btn-ach-history">Lihat Arsip</button>
            <span class="ach-row-divider">·</span>
            <button class="btn btn-ghost btn-sm" id="btn-ach-back">← Kembali ke Editor</button>
          </div>
        </div>
      </div>
    </div>
  `;

  addAchievementStyles();

  container.querySelector('#btn-ach-history')?.addEventListener('click', () => {
    if (onViewHistory) onViewHistory();
  });
  container.querySelector('#btn-ach-next')?.addEventListener('click', () => {
    if (onNextStudent) onNextStudent();
  });
  container.querySelector('#btn-ach-view')?.addEventListener('click', () => {
    if (reportData) openReportViewerModal(reportData, institutionName || '');
  });
  container.querySelector('#btn-ach-docx')?.addEventListener('click', async () => {
    const btn = container.querySelector('#btn-ach-docx');
    const _svgDown = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
    if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Menyiapkan...'; }
    try {
      await downloadReportAsDocx(reportData, institutionName || '');
    } catch (err) {
      showToast('Gagal mengunduh DOCX. Coba lagi.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = `${_svgDown} Unduh DOCX`; }
    }
  });
  container.querySelector('#btn-ach-copy-capaian')?.addEventListener('click', () => {
    if (onCopyCapaian) onCopyCapaian();
  });
  container.querySelector('#btn-ach-back')?.addEventListener('click', () => {
    if (onBackToEditor) onBackToEditor();
  });
}

function addAchievementStyles() {
  if (document.querySelector('#achievement-styles')) return;
  const style = document.createElement('style');
  style.id = 'achievement-styles';
  style.textContent = `
    .achievement-panel {
      position: relative;
      overflow: hidden;
    }
    .confetti-container {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
    }
    .confetti-piece {
      position: absolute;
      top: -10px;
      border-radius: 2px;
      opacity: 0;
      animation: confettiFall 4s ease-out forwards;
    }
    @keyframes confettiFall {
      0% { opacity: 1; transform: translateY(0) rotate(0deg); }
      60% { opacity: 0.7; }
      100% { opacity: 0; transform: translateY(500px) rotate(1080deg); }
    }
    .achievement-body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: var(--space-8) var(--space-6);
      position: relative;
      z-index: 1;
    }
    .achievement-icon {
      font-size: 3.5rem;
      margin-bottom: var(--space-6);
    }
    .achievement-title {
      font-size: var(--font-size-xl);
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1.4;
      margin-bottom: var(--space-4);
    }
    .achievement-meta {
      font-size: var(--font-size-base);
      color: var(--text-secondary);
      margin-bottom: var(--space-2);
    }
    .achievement-timestamp {
      font-size: var(--font-size-sm);
      color: var(--text-tertiary);
      margin-bottom: var(--space-8);
    }
    .achievement-actions {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3);
    }
    .achievement-actions .btn-primary,
    .achievement-actions .btn-secondary:not(.btn-sm) {
      min-width: 220px;
    }
    .ach-tertiary-row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-top: var(--space-1);
    }
    .ach-row-divider {
      color: var(--text-tertiary);
      font-size: var(--font-size-sm);
      user-select: none;
    }
    /* Finalized tick in student list */
    .finalized-tick {
      font-size: 0.75em;
      vertical-align: middle;
    }
    /* Copy Capaian offer card in achievement panel */
    .ach-copy-offer {
      margin-top: var(--space-2);
      padding: var(--space-4) var(--space-5);
      border-radius: var(--radius-lg);
      background: linear-gradient(135deg, rgba(13,148,136,0.06), rgba(108,99,255,0.06));
      border: 1px dashed var(--border-light);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3);
      max-width: 340px;
      text-align: center;
    }
    .ach-copy-offer-text {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      line-height: 1.6;
      margin: 0;
    }
    .ach-copy-offer-text strong {
      color: var(--text-primary);
    }
  `;
  document.head.appendChild(style);
}

// ---- Full-Screen Report Viewer Modal ----
const VIEWER_META = {
  'agama-budi-pekerti': { title: 'Nilai Agama dan Budi Pekerti', letter: 'A' },
  'jati-diri':          { title: 'Jati Diri', letter: 'B' },
  'literasi-steam':     { title: 'Dasar-Dasar Literasi & STEAM', letter: 'C' },
  'kokurikuler':        { title: 'Profil Lulusan — Kokurikuler (P5)', letter: 'D' },
};

function openReportViewerModal(report, institutionName) {
  const tpl = report.templateNarrative || {};
  const ai = report.aiNarrative || {};
  const semLabel = report.semester === '1' ? 'Semester 1 (Ganjil)' : 'Semester 2 (Genap)';

  let dateStr = '';
  try {
    const d = report.finalizedAt?.toDate ? report.finalizedAt.toDate() :
              report.finalizedAt?._seconds ? new Date(report.finalizedAt._seconds * 1000) :
              new Date(report.finalizedAt);
    dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { dateStr = '-'; }

  const sectionsHTML = Object.keys(VIEWER_META)
    .filter(id => tpl[id] || ai[id])
    .map(id => {
      const m = VIEWER_META[id];
      const text = ai[id] || tpl[id];
      return `
        <div class="rv-section">
          <div class="rv-section-header">
            <h3 class="rv-section-title">${m.letter}. ${m.title}</h3>
            <button class="rv-copy-btn" data-rv-copy="${id}" title="Salin narasi">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>Salin</span>
            </button>
          </div>
          <p class="rv-section-text">${escapeHTML(text)}</p>
        </div>`;
    }).join('');

  const backdrop = document.createElement('div');
  backdrop.className = 'rv-backdrop';
  backdrop.innerHTML = `
    <div class="rv-modal">
      <div class="rv-header">
        <div>
          <h2 class="rv-title">Laporan Capaian Pembelajaran Anak</h2>
          <p class="rv-subtitle">${escapeHTML(institutionName || '')}</p>
        </div>
        <button class="rv-close-x" id="rv-close" aria-label="Tutup">&times;</button>
      </div>
      <div class="rv-body">
        <div class="rv-meta-card">
          <div class="rv-meta-item"><span class="rv-label">Nama Lengkap</span><span class="rv-value">${escapeHTML(report.studentName || '-')}</span></div>
          <div class="rv-meta-item"><span class="rv-label">Kelompok</span><span class="rv-value">Kelompok ${report.studentMeta?.ageGroup || '-'}</span></div>
          <div class="rv-meta-item"><span class="rv-label">Semester</span><span class="rv-value">${semLabel}</span></div>
          <div class="rv-meta-item"><span class="rv-label">Tahun Ajaran</span><span class="rv-value">${report.academicYear || '-'}</span></div>
          <div class="rv-meta-item"><span class="rv-label">Difinalisasi</span><span class="rv-value">${dateStr}</span></div>
        </div>
        ${sectionsHTML}
      </div>
      <div class="rv-footer">
        <button class="btn btn-primary btn-sm" id="rv-print"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Cetak Dokumen</button>
        <button class="btn btn-ghost btn-sm" id="rv-close-btn">Tutup</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  addReportViewerStyles();

  requestAnimationFrame(() => backdrop.classList.add('active'));

  function close() {
    backdrop.classList.remove('active');
    backdrop.addEventListener('transitionend', () => backdrop.remove(), { once: true });
  }

  backdrop.querySelector('#rv-close').addEventListener('click', close);
  backdrop.querySelector('#rv-close-btn').addEventListener('click', close);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', function escH(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escH); }
  });

  backdrop.querySelector('#rv-print').addEventListener('click', () => {
    printReport(report, institutionName);
  });

  // Per-section copy buttons
  backdrop.querySelectorAll('.rv-copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.rvCopy;
      const text = ai[id] || tpl[id] || '';
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        showToast('Narasi tersalin', 'success');
      }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
        showToast('Narasi tersalin', 'success');
      });
      btn.classList.add('copied');
      setTimeout(() => btn.classList.remove('copied'), 1500);
    });
  });
}

// ---- Copy Capaian Modal ----
function openCopyCapaianModal(state) {
  const currentId = state.selectedStudent.id;
  const others = state.students.filter(s => s.id !== currentId);

  if (others.length === 0) {
    showToast('Tidak ada siswa lain untuk disalin capaiannya.', 'warning');
    return;
  }

  // Group by ageGroup
  const groups = {};
  others.forEach(s => {
    const g = s.ageGroup || '-';
    if (!groups[g]) groups[g] = [];
    groups[g].push(s);
  });

  const selCount = countSelected(state.selectedIndicators);

  const groupsHTML = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([group, students]) => `
    <div class="cc-group">
      <div class="cc-group-title">Kelompok ${group}</div>
      <div class="cc-student-list">
        ${students.map(s => `
          <label class="cc-student-item">
            <input type="checkbox" value="${s.id}" class="cc-student-check" />
            <span class="cc-student-avatar">${s.gender === 'P' ? '👧' : '👦'}</span>
            <span class="cc-student-name">${escapeHTML(s.nickname || s.name)}</span>
          </label>
        `).join('')}
      </div>
    </div>
  `).join('');

  const backdrop = document.createElement('div');
  backdrop.className = 'rv-backdrop';
  backdrop.innerHTML = `
    <div class="rv-modal" style="max-width:520px">
      <div class="rv-header">
        <div>
          <h2 class="rv-title">Terapkan ke Siswa Lain</h2>
          <p class="rv-subtitle">Salin ${selCount.total} indikator dari <strong>${escapeHTML(state.selectedStudent.nickname || state.selectedStudent.name)}</strong> ke siswa lain</p>
        </div>
        <button class="rv-close-x" id="cc-close" aria-label="Tutup">&times;</button>
      </div>
      <div class="rv-body">
        <label class="cc-select-all">
          <input type="checkbox" id="cc-select-all-check" />
          <span>Pilih Semua (${others.length} siswa)</span>
        </label>
        ${groupsHTML}
      </div>
      <div class="rv-footer">
        <span class="cc-selected-count" id="cc-count">0 siswa dipilih</span>
        <button class="btn btn-primary btn-sm" id="cc-confirm" disabled>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Terapkan
        </button>
        <button class="btn btn-ghost btn-sm" id="cc-cancel">Batal</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  addReportViewerStyles();
  addCopyCapaianStyles();
  requestAnimationFrame(() => backdrop.classList.add('active'));

  function close() {
    backdrop.classList.remove('active');
    backdrop.addEventListener('transitionend', () => backdrop.remove(), { once: true });
  }

  backdrop.querySelector('#cc-close').addEventListener('click', close);
  backdrop.querySelector('#cc-cancel').addEventListener('click', close);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

  const checks = backdrop.querySelectorAll('.cc-student-check');
  const confirmBtn = backdrop.querySelector('#cc-confirm');
  const countLabel = backdrop.querySelector('#cc-count');
  const selectAll = backdrop.querySelector('#cc-select-all-check');

  function updateCount() {
    const checked = backdrop.querySelectorAll('.cc-student-check:checked').length;
    countLabel.textContent = `${checked} siswa dipilih`;
    confirmBtn.disabled = checked === 0;
    selectAll.checked = checked === checks.length;
  }

  checks.forEach(c => c.addEventListener('change', updateCount));
  selectAll.addEventListener('change', () => {
    checks.forEach(c => { c.checked = selectAll.checked; });
    updateCount();
  });

  confirmBtn.addEventListener('click', () => {
    const selectedIds = [...backdrop.querySelectorAll('.cc-student-check:checked')].map(c => c.value);
    if (selectedIds.length === 0) return;

    const semester = document.querySelector('#report-semester')?.value || '1';
    const year = document.querySelector('#report-year')?.value || '';

    selectedIds.forEach(targetId => {
      const targetStudent = state.students.find(s => s.id === targetId);
      if (!targetStudent) return;

      const data = {
        selectedIndicators: { ...state.selectedIndicators },
        kokurikulerSelected: { ...state.kokurikulerSelected },
        nilaiPlusSelected: { ...state.nilaiPlusSelected },
        saranSelected: { ...state.saranSelected },
        aiResult: {},
        aiKokurikuler: null,
        semester,
        year,
        savedAt: Date.now(),
      };

      localStorage.setItem(getProgressKey(targetStudent), JSON.stringify(data));
      api.saveProgress(targetId, data).catch(() => {});
    });

    showToast(`Capaian berhasil disalin ke ${selectedIds.length} siswa! 📋`, 'success');
    close();
  });
}

function addCopyCapaianStyles() {
  if (document.querySelector('#cc-styles')) return;
  const s = document.createElement('style');
  s.id = 'cc-styles';
  s.textContent = `
    .cc-select-all {
      display:flex;align-items:center;gap:var(--space-2);
      padding:var(--space-3) var(--space-4);
      border-radius:var(--radius-md);background:var(--primary-light);
      font-size:var(--font-size-sm);font-weight:600;color:var(--primary);
      cursor:pointer;margin-bottom:var(--space-4);
    }
    .cc-group{margin-bottom:var(--space-4)}
    .cc-group:last-child{margin-bottom:0}
    .cc-group-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-tertiary);margin-bottom:var(--space-2);padding-left:var(--space-2)}
    .cc-student-list{display:flex;flex-direction:column;gap:var(--space-1)}
    .cc-student-item {
      display:flex;align-items:center;gap:var(--space-3);
      padding:var(--space-2) var(--space-3);border-radius:var(--radius-md);
      cursor:pointer;transition:background var(--transition-fast);
    }
    .cc-student-item:hover{background:var(--bg-page)}
    .cc-student-item input[type="checkbox"]{width:16px;height:16px;accent-color:var(--primary);cursor:pointer;flex-shrink:0}
    .cc-student-avatar{font-size:1.2rem;flex-shrink:0}
    .cc-student-name{font-size:var(--font-size-sm);font-weight:500;color:var(--text-primary)}
    .cc-selected-count{font-size:var(--font-size-xs);color:var(--text-tertiary);margin-right:auto}
    .copy-capaian-btn{font-size:var(--font-size-xs)!important;white-space:nowrap}
  `;
  document.head.appendChild(s);
}

function addReportViewerStyles() {
  if (document.querySelector('#rv-styles')) return;
  const s = document.createElement('style');
  s.id = 'rv-styles';
  s.textContent = `
    .rv-backdrop {
      position:fixed;inset:0;z-index:9999;
      background:rgba(0,0,0,.5);backdrop-filter:blur(4px);
      display:flex;align-items:center;justify-content:center;
      padding:var(--space-4);opacity:0;transition:opacity .3s ease;
    }
    .rv-backdrop.active{opacity:1}
    .rv-modal {
      background:var(--bg-card);border-radius:var(--radius-xl);
      box-shadow:var(--shadow-xl);width:100%;max-width:720px;max-height:90vh;
      display:flex;flex-direction:column;overflow:hidden;
      transform:translateY(20px) scale(.97);transition:transform .3s ease;
    }
    .rv-backdrop.active .rv-modal{transform:translateY(0) scale(1)}
    .rv-header {
      display:flex;justify-content:space-between;align-items:flex-start;
      padding:var(--space-6) var(--space-6) var(--space-4);
      border-bottom:1px solid var(--border-light);
    }
    .rv-title{font-size:var(--font-size-lg);font-weight:700;color:var(--text-primary);margin:0}
    .rv-subtitle{font-size:var(--font-size-sm);color:var(--text-tertiary);margin-top:2px}
    .rv-close-x {
      background:none;border:none;font-size:1.5rem;line-height:1;
      color:var(--text-tertiary);cursor:pointer;padding:0;
      transition:color var(--transition-fast);
    }
    .rv-close-x:hover{color:var(--text-primary)}
    .rv-body{overflow-y:auto;padding:var(--space-6);flex:1}
    .rv-meta-card {
      display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));
      gap:var(--space-3);padding:var(--space-4);
      background:var(--bg-page);border-radius:var(--radius-md);
      border:1px solid var(--border-light);margin-bottom:var(--space-6);
    }
    .rv-meta-item{display:flex;flex-direction:column;gap:2px}
    .rv-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-tertiary)}
    .rv-value{font-size:var(--font-size-sm);font-weight:600;color:var(--text-primary)}
    .rv-section{margin-bottom:var(--space-6)}
    .rv-section:last-child{margin-bottom:0}
    .rv-section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3)}
    .rv-section-title{font-size:var(--font-size-sm);font-weight:700;color:var(--primary);text-transform:uppercase;letter-spacing:.04em;margin:0}
    .rv-copy-btn {
      display:inline-flex;align-items:center;gap:4px;
      padding:4px 10px;border-radius:var(--radius-sm);
      border:1px solid var(--border-light);background:var(--bg-page);
      color:var(--text-tertiary);cursor:pointer;font-size:11px;font-weight:600;
      transition:all var(--transition-fast);white-space:nowrap;
    }
    .rv-copy-btn:hover{color:var(--primary);border-color:var(--primary)}
    .rv-copy-btn.copied{color:var(--primary);border-color:var(--primary);background:var(--primary-light)}
    .rv-copy-btn.copied span::after{content:' ✓'}
    .rv-section-text{font-size:var(--font-size-base);line-height:1.8;color:var(--text-secondary);padding:var(--space-4);background:var(--bg-page);border-radius:var(--radius-md);border-left:3px solid var(--primary);white-space:pre-wrap}
    .archive-list{display:flex;flex-direction:column;gap:var(--space-3)}
    .archive-item {
      display:flex;align-items:center;justify-content:space-between;
      padding:var(--space-3) var(--space-4);border-radius:var(--radius-md);
      border:1px solid var(--border-light);background:var(--bg-page);
      gap:var(--space-3);flex-wrap:wrap;
      transition:border-color var(--transition-fast);
    }
    .archive-item:hover{border-color:var(--primary)}
    .archive-item-left{display:flex;align-items:center;gap:var(--space-3);flex:1;min-width:0}
    .archive-badge {
      font-size:10px;font-weight:700;padding:3px 10px;
      border-radius:var(--radius-full);white-space:nowrap;
      background:var(--primary-light);color:var(--primary);
    }
    .archive-item-meta{display:flex;flex-direction:column;gap:1px;min-width:0}
    .archive-item-year{font-size:var(--font-size-sm);font-weight:600;color:var(--text-primary)}
    .archive-item-date{font-size:var(--font-size-xs);color:var(--text-tertiary)}
    .archive-item-actions{display:flex;gap:var(--space-2);flex-shrink:0}
    .archive-item--latest{border-color:var(--primary);position:relative;overflow:hidden}
    .archive-item--latest::after {
      content:'Terbaru';position:absolute;top:8px;right:-28px;
      background:linear-gradient(135deg,#10B981,#0D9488);color:#fff;
      font-size:9px;font-weight:700;padding:2px 32px;
      transform:rotate(35deg);letter-spacing:.04em;
      box-shadow:0 1px 3px rgba(0,0,0,.15);
    }
    .rv-footer{padding:var(--space-4) var(--space-6);border-top:1px solid var(--border-light);display:flex;justify-content:flex-end;gap:var(--space-3)}
  `;
  document.head.appendChild(s);
}

// ---- Prompt Create Institution ----
function promptCreateInstitution(state, container) {
  return import('../shared/modal.js').then(({ showModal }) => {
    const form = document.createElement('div');
    form.innerHTML = `
      <div class="form-group" style="margin-bottom:var(--space-4)">
        <label class="form-label" for="inst-name">Nama Instansi</label>
        <input class="form-input" id="inst-name" placeholder="Contoh: TK Bintang Kecil" autocomplete="organization" />
      </div>
      <div class="form-group" style="margin-bottom:var(--space-6)">
        <label class="form-label" for="inst-address">Alamat (Opsional)</label>
        <input class="form-input" id="inst-address" placeholder="Jl. Pendidikan No. 1" autocomplete="street-address" />
      </div>
      <button class="btn btn-primary w-full" id="btn-create-inst">Buat Instansi</button>
    `;

    const modal = showModal({ title: 'Buat Instansi Baru', content: form });

    // Generate Idempotency Key once when modal opens.
    // If user retries due to network error, the same key is used, preventing duplicates.
    const idempotencyKey = 'inst_' + Date.now().toString(36) + Math.random().toString(36).substr(2);

    form.querySelector('#btn-create-inst').addEventListener('click', async () => {
      const name = form.querySelector('#inst-name').value.trim();
      if (!name) {
        markInputError(form.querySelector('#inst-name'));
        showToast('Nama instansi wajib diisi', 'warning');
        return;
      }

      const btn = form.querySelector('#btn-create-inst');
      btn.disabled = true;
      btn.textContent = 'Membuat...';

      try {
        const newInst = await api.createInstitution({ 
          idempotencyKey,
          name, 
          address: form.querySelector('#inst-address').value 
        });
        
        // Cek jika instansi sudah pernah ditambahkan ke state sebelumnya (karena retry)
        if (!state.institutions.find(i => i.id === newInst.id)) {
          state.institutions.push(newInst);
        }
        state.currentInstitution = newInst;
        updateWorkspaceDisplay(state, container);
        modal.close();
        showToast(`Instansi "${name}" berhasil dibuat! 🎉`, 'success');

        // Reload students (empty for new institution)
        state.students = [];
        renderStudentList(state, container);

        // Show welcome in main panel
        const mainContent = container.querySelector('#main-content');
        mainContent.innerHTML = `
          <div class="empty-state" style="min-height:60vh">
            <div class="empty-state-icon">🎉</div>
            <h3 class="empty-state-title">Instansi Siap!</h3>
            <p class="empty-state-desc">Mulai dengan menambahkan siswa pertama Anda.</p>
            <button class="btn btn-primary" id="btn-empty-add-student" style="margin-top:var(--space-4)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Tambah Siswa Pertama</button>
          </div>
        `;
        mainContent.querySelector('#btn-empty-add-student').addEventListener('click', () => {
          showAddStudentForm(state, container);
        });
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Buat Instansi';
        showToast(err.message, 'error');
      }
    });
  });
}

// ---- Show Institution Picker ----
function showInstitutionPicker(state, container) {
  return import('../shared/modal.js').then(({ showModal }) => {
    const content = document.createElement('div');
    content.innerHTML = `
      <div class="institution-list">
        ${state.institutions.map((inst) => `
          <div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-2)">
            <button class="dropdown-item institution-pick-item" data-id="${inst.id}" style="padding:var(--space-4);flex:1;margin-bottom:0">
              <span style="display:flex;align-items:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></span>
              <span>${escapeHTML(inst.name)} <span style="opacity:0.6; font-size:0.85em; margin-left:var(--space-2)">#${escapeHTML(inst.inviteCode)}</span></span>
            </button>
            <button class="header-icon-btn inst-settings-btn" data-id="${inst.id}" title="Kelola Instansi">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            </button>
          </div>
        `).join('')}
      </div>
      <div class="dropdown-divider" style="margin:var(--space-4) 0"></div>
      <button class="btn btn-secondary w-full btn-sm" id="btn-new-inst">+ Buat Instansi Baru</button>
    `;

    const modal = showModal({ title: 'Pilih Instansi', content });

    content.querySelectorAll('.institution-pick-item').forEach((item) => {
      item.addEventListener('click', async () => {
        state.currentInstitution = state.institutions.find((i) => i.id === item.dataset.id);
        updateWorkspaceDisplay(state, container);
        modal.close();
        await loadStudents(state, container);
      });
    });

    const GEAR_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>';

    content.querySelectorAll('.inst-settings-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const instId = btn.dataset.id;
        btn.innerHTML = '<div class="spinner-ring" style="width:14px;height:14px;border-width:2px;border-top-color:currentColor"></div>';
        try {
          const details = await api.getInstitutionDetails(instId);
          modal.close();
          await promptManageInstitution(state, container, details);
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          btn.innerHTML = GEAR_SVG;
        }
      });
    });

    content.querySelector('#btn-new-inst').addEventListener('click', () => {
      modal.close();
      promptCreateInstitution(state, container);
    });
  });
}

// ---- Show Add Student Form ----
function showAddStudentForm(state, container, offlineMode = false) {
  import('../shared/modal.js').then(({ showModal }) => {
    const form = document.createElement('div');
    form.innerHTML = `
      <div class="form-group" style="margin-bottom:var(--space-4)">
        <label class="form-label" for="student-name">Nama Lengkap</label>
        <input class="form-input" id="student-name" placeholder="Contoh: Agnina Ilmi Rahayu" required autocomplete="name" />
      </div>
      <div class="form-group" style="margin-bottom:var(--space-4)">
        <label class="form-label" for="student-nickname">Nama Panggilan <span style="color:var(--text-tertiary);font-weight:400">(dipakai di narasi rapor)</span></label>
        <input class="form-input" id="student-nickname" placeholder="Contoh: Ilmi" required />
      </div>
      <div style="display:flex;gap:var(--space-4);margin-bottom:var(--space-4)">
        <div class="form-group" style="flex:1">
          <label class="form-label" for="student-gender">Jenis Kelamin</label>
          <select class="form-select" id="student-gender">
            <option value="P">Perempuan</option>
            <option value="L">Laki-laki</option>
          </select>
        </div>
        <div class="form-group" style="flex:1">
          <label class="form-label" for="student-age-group">Kelompok</label>
          <select class="form-select" id="student-age-group">
            <option value="A">Kelompok A (4-5 thn)</option>
            <option value="B">Kelompok B (5-6 thn)</option>
          </select>
        </div>
      </div>
      <div class="form-group" style="margin-bottom:var(--space-6)">
        <label class="form-label" for="student-religion">Agama <span style="color:var(--text-tertiary);font-weight:400">(memengaruhi pilihan indikator ibadah)</span></label>
        <select class="form-select" id="student-religion">
          <option value="Islam">Islam</option>
          <option value="Kristen">Kristen</option>
          <option value="Katolik">Katolik</option>
          <option value="Hindu">Hindu</option>
          <option value="Buddha">Buddha</option>
          <option value="Konghucu">Konghucu</option>
        </select>
      </div>
      <button class="btn btn-primary w-full" id="btn-save-student">Simpan Siswa</button>
    `;

    const modal = showModal({ title: '👧 Tambah Siswa Baru', content: form });

    // Generate Idempotency Key for Student Creation
    const idempotencyKey = 'stu_' + Date.now().toString(36) + Math.random().toString(36).substr(2);

    form.querySelector('#btn-save-student').addEventListener('click', async () => {
      const name = form.querySelector('#student-name').value.trim();
      const nickname = form.querySelector('#student-nickname').value.trim();
      if (!name) {
        markInputError(form.querySelector('#student-name'));
        showToast('Nama lengkap anak wajib diisi', 'warning');
        return;
      }
      if (!nickname) {
        markInputError(form.querySelector('#student-nickname'));
        showToast('Nama panggilan wajib diisi', 'warning');
        return;
      }

      const btn = form.querySelector('#btn-save-student');
      btn.disabled = true;
      btn.textContent = 'Menyimpan...';

      const payload = {
        idempotencyKey,
        name,
        nickname,
        gender: form.querySelector('#student-gender').value,
        ageGroup: form.querySelector('#student-age-group').value,
        religion: form.querySelector('#student-religion').value,
        institutionId: state.currentInstitution?.id || 'offline',
      };

      if (offlineMode) {
        // Offline: add to local state
        payload.id = 'local-' + Date.now();
        state.students.push(payload);
        renderStudentList(state, container);
        modal.close();
        showToast(`Siswa "${name}" ditambahkan (mode offline)`, 'success');
        return;
      }

      try {
        const wasEmpty = state.students.length === 0;
        const saved = await api.createStudent(payload);

        // Prevent duplicate push on retry
        if (!state.students.find(s => s.id === saved.id)) {
          state.students.push(saved);
          state.students.sort((a, b) => a.name.localeCompare(b.name));
        }

        renderStudentList(state, container);
        modal.close();
        showToast(`Siswa "${name}" berhasil ditambahkan! 🎉`, 'success');

        // Auto-select if this is the first student — no friction, straight into workspace
        if (wasEmpty) {
          state.selectedStudent = saved;
          state.selectedIndicators = {};
          state.templateResult = {};
          state.aiResult = null;
          state.aiHistory = {};
          state.kokurikulerSelected = {};
          state.kokurikulerNarrative = '';
          state.aiKokurikuler = null;
          const listEl = container.querySelector('#student-list');
          listEl.querySelector(`.student-item[data-id="${saved.id}"]`)?.classList.add('active');
          renderMainPanel(state, container);
        }
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Simpan Siswa';
        showToast(err.message, 'error');
      }
    });
  });
}

// ---- Bulk Add Students ----
function showBulkAddStudentForm(state, container) {
  import('../shared/modal.js').then(({ showModal }) => {
    if (!document.querySelector('#bulk-add-styles')) {
      const s = document.createElement('style');
      s.id = 'bulk-add-styles';
      s.textContent = `
        .bulk-hint{background:var(--bg-secondary);border:1px solid var(--border-light);border-radius:var(--radius-md);padding:var(--space-3) var(--space-4);font-size:var(--font-size-xs);color:var(--text-secondary);margin-bottom:var(--space-4);line-height:1.6}
        .bulk-hint strong{color:var(--text-primary)}
        .bulk-hint em{font-style:normal;background:var(--bg-primary);border:1px solid var(--border-light);border-radius:3px;padding:1px 4px;font-size:.75rem;font-family:monospace}
        .bulk-table-wrap{overflow-x:auto;overflow-y:auto;margin-bottom:var(--space-3);border:1px solid var(--border-light);border-radius:var(--radius-md);max-height:360px;scrollbar-width:thin;scrollbar-color:var(--border-light) transparent}
        .bulk-table-wrap::-webkit-scrollbar{width:4px;height:4px}
        .bulk-table-wrap::-webkit-scrollbar-thumb{background:var(--border-light);border-radius:2px}
        .bulk-table-wrap::-webkit-scrollbar-track{background:transparent}
        .bulk-table{width:100%;border-collapse:collapse;font-size:var(--font-size-sm)}
        .bulk-table th{background-color:var(--bg-body,#F0FDFA);padding:var(--space-2) var(--space-3);text-align:left;font-size:var(--font-size-xs);font-weight:600;color:var(--text-secondary);box-shadow:0 1px 0 var(--border-color,#C8F2EC);white-space:nowrap;position:sticky;top:0;z-index:1}
        .bulk-table td{padding:var(--space-1) var(--space-2);border-bottom:1px solid var(--border-light)}
        .bulk-table tr:last-child td{border-bottom:none}
        .bulk-table .form-input,.bulk-table .form-select{font-size:var(--font-size-sm);padding:6px var(--space-3);height:auto}
        .bulk-table .form-input{min-width:140px}
        .bulk-table .form-select{min-width:100px}
        .bulk-table .input-error{border-color:var(--danger,#e53e3e)!important;background:#fff8f8}
        .bulk-row-del{background:none;border:none;cursor:pointer;color:var(--text-tertiary);padding:4px 6px;border-radius:var(--radius-sm);line-height:1;font-size:1.1rem;transition:color .15s}
        .bulk-row-del:hover{color:var(--danger,#e53e3e)}
        .bulk-footer{display:flex;align-items:center;justify-content:space-between;padding-top:var(--space-4);border-top:1px solid var(--border-light);margin-top:var(--space-2)}
        .bulk-count{font-size:var(--font-size-sm);color:var(--text-secondary)}
        .bulk-paste-flash{outline:2px solid var(--primary)!important;border-radius:var(--radius-md)}
      `;
      document.head.appendChild(s);
    }

    const RELIGIONS = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu'];

    function religionOptions(selected) {
      return RELIGIONS.map(r => `<option value="${r}"${r === selected ? ' selected' : ''}>${r}</option>`).join('');
    }

    function createRowEl(data, countEl, saveBtn, tbody) {
      const { name = '', nickname = '', gender = 'P', ageGroup = 'A', religion = 'Islam' } = data || {};
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input class="form-input bulk-name" type="text" placeholder="Nama lengkap" value="${escapeHTML(name)}" /></td>
        <td><input class="form-input bulk-nickname" type="text" placeholder="Nama panggilan" value="${escapeHTML(nickname)}" /></td>
        <td><select class="form-select bulk-gender">
          <option value="P"${gender === 'P' ? ' selected' : ''}>Perempuan</option>
          <option value="L"${gender === 'L' ? ' selected' : ''}>Laki-laki</option>
        </select></td>
        <td><select class="form-select bulk-agegroup">
          <option value="A"${ageGroup === 'A' ? ' selected' : ''}>Kelompok A</option>
          <option value="B"${ageGroup === 'B' ? ' selected' : ''}>Kelompok B</option>
        </select></td>
        <td><select class="form-select bulk-religion">${religionOptions(religion)}</select></td>
        <td><button class="bulk-row-del" type="button" title="Hapus baris">&times;</button></td>
      `;
      tr.querySelector('.bulk-row-del').addEventListener('click', () => {
        tr.remove();
        updateCount(tbody, countEl, saveBtn);
        if (!tbody.querySelectorAll('tr').length) addRow(tbody, null, countEl, saveBtn);
      });
      tr.querySelectorAll('input,select').forEach(el => {
        el.addEventListener('input', () => {
          el.classList.remove('input-error');
          updateCount(tbody, countEl, saveBtn);
        });
      });
      return tr;
    }

    function getLastRowDefaults(tbody) {
      const rows = tbody.querySelectorAll('tr');
      if (!rows.length) return {};
      const last = rows[rows.length - 1];
      return {
        gender: last.querySelector('.bulk-gender').value,
        ageGroup: last.querySelector('.bulk-agegroup').value,
        religion: last.querySelector('.bulk-religion').value,
      };
    }

    function updateCount(tbody, countEl, saveBtn) {
      const filled = [...tbody.querySelectorAll('tr')].filter(r => r.querySelector('.bulk-name').value.trim()).length;
      countEl.textContent = `${filled} siswa`;
      saveBtn.textContent = filled > 0 ? `Simpan Semua (${filled} siswa)` : 'Simpan Semua';
    }

    function addRow(tbody, data, countEl, saveBtn) {
      const merged = { ...getLastRowDefaults(tbody), ...(data || {}) };
      const tr = createRowEl(merged, countEl, saveBtn, tbody);
      tbody.appendChild(tr);
      updateCount(tbody, countEl, saveBtn);
      return tr;
    }

    function parseGender(raw) {
      const v = (raw || '').toLowerCase().trim();
      return (v === 'l' || v.startsWith('laki')) ? 'L' : 'P';
    }

    function parseAgeGroup(raw) {
      const v = (raw || '').trim().toUpperCase();
      return (v === 'B' || v === 'KELOMPOK B' || v === 'KB') ? 'B' : 'A';
    }

    function parseReligion(raw) {
      const v = (raw || '').toLowerCase().trim();
      return RELIGIONS.find(r => r.toLowerCase() === v) || 'Islam';
    }

    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="bulk-hint">
        <strong>Tip paste dari Excel / Google Sheets:</strong> Susun kolom spreadsheet:
        <em>Nama Lengkap</em> <em>Nama Panggilan</em> <em>Jenis Kelamin</em> <em>Kelompok</em> <em>Agama</em>,
        lalu klik di area tabel di bawah dan tekan <strong>Ctrl+V</strong>.
      </div>
      <div class="bulk-table-wrap" id="bulk-table-wrap" tabindex="0">
        <table class="bulk-table">
          <thead><tr>
            <th>Nama Lengkap</th><th>Nama Panggilan</th>
            <th>Jenis Kelamin</th><th>Kelompok</th><th>Agama</th><th></th>
          </tr></thead>
          <tbody id="bulk-tbody"></tbody>
        </table>
      </div>
      <div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-3)">
        <button class="btn btn-ghost btn-sm" id="btn-bulk-add-row">+ Tambah Baris</button>
        <button class="btn btn-ghost btn-sm" id="btn-bulk-clear" style="color:var(--text-tertiary)">Bersihkan Semua</button>
      </div>
      <div class="bulk-footer">
        <span class="bulk-count" id="bulk-count">0 siswa</span>
        <button class="btn btn-primary" id="btn-bulk-save">Simpan Semua</button>
      </div>
    `;

    const modal = showModal({ title: '👥 Tambah Siswa Massal', content: wrap });

    // Widen the modal for the table
    const modalEl = modal.element.querySelector('.modal');
    if (modalEl) modalEl.style.maxWidth = '760px';

    const tbody = wrap.querySelector('#bulk-tbody');
    const countEl = wrap.querySelector('#bulk-count');
    const saveBtn = wrap.querySelector('#btn-bulk-save');

    // Start with 5 empty rows
    for (let i = 0; i < 5; i++) addRow(tbody, null, countEl, saveBtn);

    wrap.querySelector('#btn-bulk-add-row').addEventListener('click', () => {
      const tr = addRow(tbody, null, countEl, saveBtn);
      tr.querySelector('.bulk-name').focus();
      const tableWrap = wrap.querySelector('#bulk-table-wrap');
      tableWrap.scrollTop = tableWrap.scrollHeight;
    });

    wrap.querySelector('#btn-bulk-clear').addEventListener('click', () => {
      tbody.querySelectorAll('tr').forEach(tr => {
        tr.querySelector('.bulk-name').value = '';
        tr.querySelector('.bulk-nickname').value = '';
        tr.querySelector('.bulk-gender').value = 'P';
        tr.querySelector('.bulk-agegroup').value = 'A';
        tr.querySelector('.bulk-religion').value = 'Islam';
        tr.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
      });
      updateCount(tbody, countEl, saveBtn);
      wrap.querySelector('#bulk-table-wrap').scrollTop = 0;
    });

    // Paste handler — intercepts TSV from Excel / Google Sheets
    wrap.addEventListener('paste', (e) => {
      const text = (e.clipboardData || window.clipboardData).getData('text');
      if (!text.includes('\t')) return; // not TSV, let default happen

      e.preventDefault();

      const lines = text.split(/\r?\n/).map(l => l.trimEnd()).filter(l => l);
      if (!lines.length) return;

      // Skip header row if cells look like column labels
      const HEADER_WORDS = ['nama', 'panggilan', 'kelamin', 'jenis', 'kelompok', 'agama', 'gender', 'name', 'group'];
      const firstCells = lines[0].split('\t').map(c => c.toLowerCase().trim());
      const firstIsHeader = firstCells.some(c => HEADER_WORDS.includes(c));
      const dataLines = firstIsHeader ? lines.slice(1) : lines;

      if (!dataLines.length) return;

      // Remove empty rows to make room for pasted data
      [...tbody.querySelectorAll('tr')].forEach(tr => {
        if (!tr.querySelector('.bulk-name').value.trim() && !tr.querySelector('.bulk-nickname').value.trim()) {
          tr.remove();
        }
      });

      dataLines.forEach(line => {
        const cells = line.split('\t');
        const name = cells[0]?.trim() || '';
        const pastedNickname = cells[1]?.trim() || '';
        addRow(tbody, {
          name,
          nickname: pastedNickname || name.split(/\s+/)[0],
          gender: parseGender(cells[2]),
          ageGroup: parseAgeGroup(cells[3]),
          religion: parseReligion(cells[4]),
        }, countEl, saveBtn);
      });

      // Flash outline to confirm paste received
      const tableWrap = wrap.querySelector('#bulk-table-wrap');
      tableWrap.classList.add('bulk-paste-flash');
      setTimeout(() => tableWrap.classList.remove('bulk-paste-flash'), 500);

      showToast(`${dataLines.length} baris berhasil ditempel dari spreadsheet`, 'success');
    });

    // Save handler
    saveBtn.addEventListener('click', async () => {
      const rows = [...tbody.querySelectorAll('tr')];
      const students = [];
      let hasError = false;

      rows.forEach(tr => {
        const nameEl = tr.querySelector('.bulk-name');
        const nicknameEl = tr.querySelector('.bulk-nickname');
        const name = nameEl.value.trim();
        const nickname = nicknameEl.value.trim();

        if (!name && !nickname) return; // silently skip empty rows

        if (!name) {
          nameEl.classList.add('input-error');
          hasError = true;
          return;
        }
        if (!nickname) {
          nicknameEl.classList.add('input-error');
          hasError = true;
          return;
        }

        students.push({
          idempotencyKey: 'stu_' + Date.now().toString(36) + Math.random().toString(36).substr(2),
          name,
          nickname,
          gender: tr.querySelector('.bulk-gender').value,
          ageGroup: tr.querySelector('.bulk-agegroup').value,
          religion: tr.querySelector('.bulk-religion').value,
        });
      });

      if (hasError) {
        showToast('Periksa baris yang ditandai merah', 'warning');
        return;
      }
      if (!students.length) {
        showToast('Belum ada siswa yang diisi', 'warning');
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = `Menyimpan ${students.length} siswa...`;

      try {
        const wasEmpty = state.students.length === 0;
        const { created, failed } = await api.createStudentsBatch(state.currentInstitution.id, students);

        created.forEach(s => {
          if (!state.students.find(ex => ex.id === s.id)) state.students.push(s);
        });
        state.students.sort((a, b) => a.name.localeCompare(b.name));
        renderStudentList(state, container);
        modal.close();

        if (failed.length === 0) {
          showToast(`${created.length} siswa berhasil ditambahkan! 🎉`, 'success');
        } else {
          showToast(`${created.length} berhasil, ${failed.length} gagal ditambahkan`, 'warning');
        }

        // Auto-select first student if institution was empty before
        if (wasEmpty && created.length > 0) {
          const first = created[0];
          state.selectedStudent = first;
          state.selectedIndicators = {};
          state.templateResult = {};
          state.aiResult = null;
          state.aiHistory = {};
          state.kokurikulerSelected = {};
          state.kokurikulerNarrative = '';
          state.aiKokurikuler = null;
          const listEl = container.querySelector('#student-list');
          listEl.querySelector(`.student-item[data-id="${first.id}"]`)?.classList.add('active');
          renderMainPanel(state, container);
        }
      } catch (err) {
        saveBtn.disabled = false;
        saveBtn.textContent = students.length > 0 ? `Simpan Semua (${students.length} siswa)` : 'Simpan Semua';
        showToast(err.message, 'error');
      }
    });
  });
}

// ---- Update Quota Badge ----
function updateQuotaBadge(container, state) {
  const remaining = state.quota.limit - state.quota.weeklyUsed;
  // #quota-badge and #quota-text live in the portal (document.body), not container
  const badge = document.querySelector('#quota-badge');
  const text = document.querySelector('#quota-text');
  const aiBadge = container.querySelector('#btn-ai-quota');

  if (!text) return;

  if (remaining <= 0) {
    text.textContent = 'Kuota habis';
    text.style.color = 'var(--error, #DC2626)';
    if (badge) badge.title = 'Kuota AI minggu ini sudah habis. Reset tiap Senin.';
  } else if (remaining <= 3) {
    text.textContent = `⚠️ ${remaining}/${state.quota.limit} AI`;
    text.style.color = 'var(--warning, #D97706)';
    if (badge) badge.title = `Sisa kuota AI: ${remaining}. Gunakan dengan bijak!`;
  } else {
    text.textContent = `${remaining}/${state.quota.limit} AI`;
    text.style.color = '';
    if (badge) badge.title = `Kuota AI mingguan: sisa ${remaining} dari ${state.quota.limit}`;
  }

  if (aiBadge) aiBadge.textContent = `${remaining > 0 ? remaining : 0}/${state.quota.limit}`;
}

// ---- Prompt Join Institution ----
function promptJoinInstitution(state, container) {
  return import('../shared/modal.js').then(({ showModal }) => {
    const form = document.createElement('div');
    form.innerHTML = `
      <div class="form-group" style="margin-bottom:var(--space-4)">
        <label class="form-label" for="join-code">Kode Undangan</label>
        <input class="form-input" id="join-code" placeholder="Contoh: A1B2C3" style="text-transform:uppercase;letter-spacing:0.2em;font-weight:700;text-align:center;font-size:var(--font-size-xl)" maxlength="7" autocomplete="off" />
      </div>
      <p style="font-size:var(--font-size-xs);color:var(--text-tertiary);margin-bottom:var(--space-6);text-align:center">Minta kode undangan dari admin instansi yang ingin Anda gabungi.</p>
      <button class="btn btn-primary w-full" id="btn-join-inst">Gabung</button>
    `;

    const modal = showModal({ title: 'Gabung Instansi', content: form });

    form.querySelector('#btn-join-inst').addEventListener('click', async () => {
      const code = form.querySelector('#join-code').value.trim().replace(/^#/, '');
      if (!code) {
        markInputError(form.querySelector('#join-code'));
        showToast('Masukkan kode undangan', 'warning');
        return;
      }

      try {
        const inst = await api.joinInstitution(code);
        state.institutions.push(inst);
        state.currentInstitution = inst;
        updateWorkspaceDisplay(state, container);
        modal.close();
        showToast(`Berhasil bergabung ke "${inst.name}"! 🎉`, 'success');
        await loadStudents(state, container);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

// ---- App Shell Styles ----
function addAppShellStyles(container) {
  if (container.querySelector('#app-shell-styles')) return;
  const style = document.createElement('style');
  style.id = 'app-shell-styles';
  style.textContent = `
    .app-shell { min-height: 100vh; display: flex; flex-direction: column; }
    .app-header {
      height: var(--header-height);
      background: var(--bg-card);
      border-bottom: 1px solid var(--border-light);
      box-shadow: var(--shadow-xs);
      position: sticky;
      top: 0;
      z-index: var(--z-sticky);
    }
    .app-header-inner {
      max-width: var(--max-content-width);
      margin: 0 auto;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 var(--space-6);
    }
    .header-left { display: flex; align-items: center; gap: var(--space-4); }
    .header-brand { display: flex; align-items: center; }
    .header-logo-text { font-size: var(--font-size-lg); font-weight: 800; letter-spacing: -0.01em; }
    .header-divider {
      width: 1px;
      height: 20px;
      background: var(--border-light);
    }
    .workspace-switcher {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-md);
      border: 1px solid var(--border-light);
      background: var(--bg-page);
      cursor: pointer;
      transition: all var(--transition-fast);
      font-size: var(--font-size-sm);
      font-weight: 500;
      color: var(--text-primary);
      font-family: inherit;
    }
    .workspace-switcher:hover {
      border-color: var(--primary);
      background: var(--primary-light);
    }
    .workspace-name {
      max-width: 160px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .workspace-chevron {
      flex-shrink: 0;
      opacity: 0.5;
      transition: transform var(--transition-fast);
    }
    .header-actions { display: flex; align-items: center; gap: var(--space-2); }
    .quota-pill {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      padding: 4px 10px;
      border-radius: 100px;
      font-size: 11px;
      font-weight: 600;
      background: var(--primary-light);
      color: var(--primary);
      letter-spacing: 0.02em;
    }
    .header-icon-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: var(--radius-md);
      border: none;
      background: none;
      cursor: pointer;
      color: var(--text-secondary);
      transition: all var(--transition-fast);
    }
    .header-icon-btn:hover {
      background: var(--bg-page);
      color: var(--text-primary);
    }
    .dropdown-trigger {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      background: none;
      border: none;
      cursor: pointer;
      padding: 2px;
      border-radius: 50%;
      transition: box-shadow var(--transition-fast);
    }
    .dropdown-trigger:hover {
      box-shadow: 0 0 0 2px var(--primary-light);
    }
    .dropdown-user-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: var(--space-3) var(--space-4) !important;
      cursor: default !important;
    }
    .dropdown-user-name {
      font-weight: 600;
      font-size: var(--font-size-sm);
      color: var(--text-primary);
    }
    .dropdown-user-email {
      font-size: var(--font-size-xs);
      color: var(--text-tertiary);
    }

    .app-body {
      flex: 1;
      display: flex;
      max-width: var(--max-content-width);
      margin: 0 auto;
      width: 100%;
      height: calc(100vh - var(--header-height));
    }
    .app-sidebar {
      width: var(--sidebar-width);
      border-right: 1px solid var(--border-light);
      background: var(--bg-sidebar);
      overflow-y: auto;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
    }
    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-4) var(--space-5);
      border-bottom: 1px solid var(--border-light);
      flex-shrink: 0;
    }
    .sidebar-title { font-size: var(--font-size-base); font-weight: 700; }
    .sidebar-body { padding: var(--space-3); overflow-y: auto; flex: 1; }

    .student-item {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      width: 100%;
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      border: none;
      background: none;
      color: var(--text-primary);
      cursor: pointer;
      text-align: left;
      transition: all var(--transition-fast);
      margin-bottom: var(--space-1);
    }
    .student-group { margin-bottom: var(--space-2); }
    .student-group-label {
      padding: var(--space-3) var(--space-4) var(--space-1);
      font-size: 10px;
      font-weight: 700;
      color: var(--text-tertiary);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .student-item:hover { background: var(--primary-light); }
    .student-item.active {
      background: var(--primary);
      color: white;
    }
    .student-item.active .student-meta { color: rgba(255,255,255,0.7); }
    .student-avatar { font-size: var(--font-size-xl); }
    .student-name { font-weight: 600; font-size: var(--font-size-sm); display: block; color: inherit; }
    .student-meta { font-size: var(--font-size-xs); color: var(--text-secondary); display: block; }
    .student-item-row {
      display: flex;
      align-items: center;
      gap: 0;
      margin-bottom: var(--space-1);
    }
    .student-item-row .student-item {
      flex: 1;
      min-width: 0;
      margin-bottom: 0;
    }
    .student-edit-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-light);
      background: var(--bg-secondary);
      color: var(--text-secondary);
      cursor: pointer;
      opacity: 1;
      transition: all var(--transition-fast);
      flex-shrink: 0;
    }
    .student-edit-btn:hover {
      background: var(--primary-light);
      border-color: var(--primary);
      color: var(--primary);
    }
    .student-delete-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-light);
      background: var(--bg-secondary);
      color: var(--text-secondary);
      cursor: pointer;
      opacity: 1;
      transition: all var(--transition-fast);
      flex-shrink: 0;
    }
    .student-delete-btn:hover {
      background: rgba(220,38,38,0.08);
      border-color: var(--error, #DC2626);
      color: var(--error, #DC2626);
    }

    .app-main {
      flex: 1;
      overflow-y: auto;
      min-width: 0;
    }
    .main-content { padding: var(--space-6); }

    /* ---- Mobile: chip strip + full-page content ---- */
    @media (max-width: 768px) {
      .app-body { flex-direction: column; height: auto; }
      .app-sidebar {
        width: 100%;
        height: auto;
        border-right: none;
        background: var(--bg-card);
        border-bottom: 1px solid var(--border-light);
        overflow: visible;
      }
      /* Always show main — no hiding on mobile */
      .app-main { display: block !important; height: auto; overflow-y: visible; }
      .app-body[data-selected] .app-sidebar { display: block !important; }
      /* Back button not needed — sidebar always visible */
      .mobile-back-btn { display: none !important; }

      /* Sidebar body → horizontal scrollable chip row */
      .sidebar-body {
        flex: none;
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--space-2);
        overflow-x: auto;
        padding: var(--space-2) var(--space-4) var(--space-3);
        scrollbar-width: none;
        -webkit-overflow-scrolling: touch;
        flex-wrap: nowrap;
        mask-image: linear-gradient(to right, black 78%, transparent 100%);
        -webkit-mask-image: linear-gradient(to right, black 78%, transparent 100%);
      }
      .sidebar-body::-webkit-scrollbar { display: none; }

      /* Groups flatten into the chip row */
      .student-group { display: contents; }
      .student-group-label {
        flex-shrink: 0;
        font-size: 9px;
        font-weight: 700;
        color: var(--text-tertiary);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        padding: 0 var(--space-1) 0 var(--space-2);
        border-left: 1px solid var(--border-light);
        margin-left: var(--space-1);
        white-space: nowrap;
      }
      .student-group:first-child .student-group-label {
        border-left: none;
        margin-left: 0;
        padding-left: 0;
      }

      /* Student chips */
      .student-item {
        flex-direction: row;
        align-items: center;
        gap: var(--space-2);
        padding: 6px 12px;
        border-radius: var(--radius-full);
        min-width: auto;
        width: auto;
        flex-shrink: 0;
        margin-bottom: 0;
        background: var(--bg-page);
        border: 1.5px solid var(--border-light);
      }
      .student-item:hover { background: var(--primary-light); }
      .student-item.active {
        background: var(--primary);
        border-color: var(--primary);
        color: white;
        box-shadow: 0 2px 8px var(--primary-glow);
      }
      .student-item.active .student-meta { color: rgba(255,255,255,0.7); }
      .student-avatar { font-size: 1rem; }
      .student-name { font-size: var(--font-size-xs); font-weight: 600; white-space: nowrap; }
      .student-meta { display: none; }
    }
    .mobile-back-btn {
      display: none;
      align-items: center;
      gap: var(--space-2);
      margin-bottom: var(--space-3);
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--primary);
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      font-family: inherit;
    }
    .mobile-back-btn:active { opacity: 0.7; }
  `;
  container.appendChild(style);
}

// ---- Report Workspace Styles ----
function addReportStyles(container) {
  if (container.querySelector('#report-styles')) return;
  const style = document.createElement('style');
  style.id = 'report-styles';
  style.textContent = `
    /* Workspace fills viewport — page does not scroll */
    .report-workspace {
      height: calc(100vh - var(--header-height) - var(--space-6) * 2);
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
      overflow: hidden;
    }
    .report-info {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }
    .report-student-header { display: flex; align-items: center; gap: var(--space-4); }
    .report-student-avatar { font-size: 2.5rem; }
    .report-student-name { font-size: var(--font-size-xl); font-weight: 700; }
    .report-student-meta { font-size: var(--font-size-sm); color: var(--text-secondary); }
    .report-meta-row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      align-items: flex-end;
    }
    .meta-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; min-width: 80px; }
    .meta-label {
      font-size: 10px;
      font-weight: 600;
      color: var(--text-tertiary);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .save-indicator {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding-bottom: 2px;
    }
    #save-status {
      font-size: var(--font-size-xs);
      color: var(--text-tertiary);
      white-space: nowrap;
    }
    /* Panel grid takes remaining height — each column scrolls independently */
    .report-panels {
      flex: 1;
      min-height: 0;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-5);
      overflow: hidden;
    }
    .report-checklist-panel {
      overflow-y: auto;
      min-height: 0;
    }
    .report-preview-panel {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-height: 0;
    }
    /* preview-panel fills its column; body scrolls */
    .preview-panel {
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .preview-body {
      flex: 1;
      overflow-y: auto;
      min-height: 0;
    }
    /* Mobile: revert to natural flow */
    @media (max-width: 1024px) {
      .report-workspace { height: auto; overflow: visible; }
      .report-panels { grid-template-columns: 1fr; overflow: visible; }
      .report-checklist-panel { overflow-y: visible; }
      .report-preview-panel { overflow: visible; flex: none; }
      .preview-panel { height: auto; overflow: visible; }
      .preview-body { overflow-y: auto; max-height: 70vh; }
    }
  `;
  container.appendChild(style);
}

// ---- Onboarding Styles ----
function addOnboardingStyles() {
  if (document.querySelector('#onboarding-styles')) return;
  const style = document.createElement('style');
  style.id = 'onboarding-styles';
  style.textContent = `
    .onboarding {
      max-width: 600px;
      margin: 0 auto;
      padding: var(--space-8) 0;
    }
    .onboarding-hero {
      text-align: center;
      margin-bottom: var(--space-10);
    }
    .onboarding-emoji {
      font-size: 4rem;
      margin-bottom: var(--space-4);
      animation: logoBounce 2s ease-in-out infinite;
    }
    .onboarding-title {
      font-size: var(--font-size-2xl);
      font-weight: 800;
      margin-bottom: var(--space-3);
    }
    .onboarding-subtitle {
      color: var(--text-secondary);
      font-size: var(--font-size-base);
      line-height: 1.7;
    }
    .onboarding-steps {
      background: var(--bg-card);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-xl);
      padding: var(--space-6);
      margin-bottom: var(--space-8);
      box-shadow: var(--shadow-sm);
    }
    .onboarding-steps-title {
      font-size: var(--font-size-md);
      font-weight: 700;
      margin-bottom: var(--space-5);
    }
    .onboarding-step {
      display: flex;
      gap: var(--space-4);
      margin-bottom: var(--space-5);
    }
    .onboarding-step:last-child { margin-bottom: 0; }
    .step-number {
      width: 36px;
      height: 36px;
      min-width: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--primary), #14B8A6);
      color: white;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: var(--font-size-base);
    }
    .step-content h4 {
      font-weight: 700;
      margin-bottom: var(--space-1);
    }
    .step-content p {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      line-height: 1.6;
    }
    .onboarding-actions {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-4);
    }
  `;
  document.head.appendChild(style);
}

// ---- Setup Institution Settings ----
function setupInstitutionSettings(container, state) {
  const exportBtn = container.querySelector('#btn-export-xlsx');
  const DOWNLOAD_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
  let isLoading = false;

  exportBtn.addEventListener('click', async () => {
    if (isLoading || !state.currentInstitution) return;
    isLoading = true;
    exportBtn.disabled = true;
    exportBtn.innerHTML = '<div class="spinner-ring" style="width:14px;height:14px;border-width:2px;border-top-color:currentColor"></div>';

    try {
      const reports = await api.getInstitutionReports(state.currentInstitution.id);
      if (!reports || reports.length === 0) {
        showToast('Belum ada rapor yang difinalisasi di instansi ini.', 'warning');
        return;
      }
      exportInstitutionToXlsx(reports, state.currentInstitution.name);
      showToast(`${reports.length} rapor berhasil diekspor! 📊`, 'success');
    } catch (err) {
      showToast(err.message || 'Gagal mengekspor data.', 'error');
    } finally {
      isLoading = false;
      exportBtn.disabled = false;
      exportBtn.innerHTML = DOWNLOAD_SVG;
    }
  });
}

// ---- Prompt Manage Institution ----
function promptManageInstitution(state, container, details) {
  return import('../shared/modal.js').then(({ showModal, showConfirmDialog }) => {
    const user = state.user;
    const isCreator = details.createdBy === user.uid;

    const content = document.createElement('div');

    const renderContent = (currentDetails) => {
      content.innerHTML = `
        <div class="inst-details-card" style="background:var(--bg-secondary);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-4);display:flex;align-items:center;gap:var(--space-4)">
          <div style="font-size:32px">🏫</div>
          <div style="flex:1;overflow:hidden">
            <h3 style="font-weight:700;font-size:var(--font-size-md);margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHTML(currentDetails.name)}</h3>
            <p style="color:var(--text-secondary);font-size:var(--font-size-sm);margin-top:2px">Kode: <span style="user-select:none;color:var(--text-tertiary)">#</span><strong style="color:var(--primary);user-select:all">${escapeHTML(currentDetails.inviteCode)}</strong></p>
            ${currentDetails.address ? `<p style="color:var(--text-tertiary);font-size:12px;margin-top:2px">${escapeHTML(currentDetails.address)}</p>` : ''}
          </div>
          ${isCreator ? `<button class="btn btn-ghost btn-sm" id="btn-edit-inst-toggle" title="Edit nama/alamat instansi" style="flex-shrink:0"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit</button>` : ''}
        </div>

        <div id="edit-inst-form" style="display:none;background:var(--bg-secondary);border-radius:var(--radius-lg);padding:var(--space-4);margin-bottom:var(--space-4);border:1px solid var(--primary)">
          <p style="font-weight:600;font-size:var(--font-size-sm);margin-bottom:var(--space-3)">Edit Instansi</p>
          <div class="form-group" style="margin-bottom:var(--space-3)">
            <label class="form-label" for="edit-inst-name">Nama Instansi</label>
            <input class="form-input" id="edit-inst-name" value="${escapeAttr(currentDetails.name)}" maxlength="100" autocomplete="organization" />
          </div>
          <div class="form-group" style="margin-bottom:var(--space-4)">
            <label class="form-label" for="edit-inst-address">Alamat <span style="color:var(--text-tertiary);font-weight:normal">(opsional)</span></label>
            <input class="form-input" id="edit-inst-address" value="${escapeAttr(currentDetails.address || '')}" maxlength="200" autocomplete="street-address" />
          </div>
          <div style="display:flex;gap:var(--space-2)">
            <button class="btn btn-primary btn-sm" id="btn-save-inst-edit">Simpan</button>
            <button class="btn btn-ghost btn-sm" id="btn-cancel-inst-edit">Batal</button>
          </div>
        </div>

        <div class="inst-members" style="margin-bottom:var(--space-6)">
          <h4 style="font-weight:600;font-size:var(--font-size-sm);margin-bottom:var(--space-3);color:var(--text-secondary)">DAFTAR GURU (${currentDetails.members.length})</h4>
          <div style="display:flex;flex-direction:column;gap:var(--space-3)">
            ${currentDetails.members.map(m => `
              <div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3);border:1px solid var(--border-light);border-radius:var(--radius-md);background:var(--bg-card)">
                ${renderAvatar(m.name, 36, m.email)}
                <div style="flex:1;overflow:hidden">
                  <p style="font-weight:600;font-size:var(--font-size-sm);margin:0;white-space:nowrap;text-overflow:ellipsis;overflow:hidden">
                    ${escapeHTML(m.name)} ${m.uid === user.uid ? '<span style="opacity:0.5;font-weight:normal">(Anda)</span>' : ''}
                  </p>
                  <p style="color:var(--text-tertiary);font-size:11px;margin-top:2px">${escapeHTML(m.email)}</p>
                </div>
                ${m.role === 'admin' ? '<span class="badge" style="background:rgba(108,99,255,0.1);color:var(--primary);padding:4px 8px;border-radius:12px;font-size:10px;font-weight:700">ADMIN</span>' : ''}
              </div>
            `).join('')}
          </div>
        </div>

        <div class="dropdown-divider" style="margin:var(--space-4) 0"></div>
        <div style="background:var(--bg-secondary);border-radius:var(--radius-md);padding:var(--space-4);border:1px solid var(--border-light)">
          <h4 style="font-weight:600;font-size:var(--font-size-sm);margin-bottom:4px;display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg> Export Data Rapor</h4>
          <p style="color:var(--text-secondary);font-size:12px;line-height:1.5;margin-bottom:var(--space-3)">Unduh semua rapor yang sudah difinalisasi sebagai file Excel (.xlsx), siap dipakai sebagai data source Mail Merge Word.</p>
          <button class="btn btn-secondary w-full" id="btn-export-xlsx-modal"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Unduh XLSX (Mail Merge)</button>
        </div>

        ${!isCreator ? `
          <div class="dropdown-divider" style="margin:var(--space-4) 0"></div>
          <button class="btn w-full btn-danger-ghost" id="btn-leave-inst">Keluar dari Instansi</button>
        ` : ''}

        ${isCreator ? `
          <div class="dropdown-divider" style="margin:var(--space-4) 0"></div>
          <div class="danger-zone" style="background:rgba(255,59,48,0.05);border:1px solid rgba(255,59,48,0.2);border-radius:var(--radius-md);padding:var(--space-4)">
            <h4 style="color:#FF3B30;font-weight:600;font-size:var(--font-size-sm);margin-bottom:var(--space-1)">Danger Zone</h4>
            <p style="color:var(--text-secondary);font-size:12px;line-height:1.5;margin-bottom:var(--space-4)">Menghapus instansi akan menyembunyikan semua data siswa dan rapor di dalamnya secara permanen.</p>
            <button class="btn w-full" id="btn-delete-inst" style="background:#FF3B30;color:white;border:none">Hapus Instansi Permanen</button>
          </div>
        ` : ''}
      `;

      // ---- Export XLSX ----
      const modalExportBtn = content.querySelector('#btn-export-xlsx-modal');
      modalExportBtn.addEventListener('click', async () => {
        modalExportBtn.disabled = true;
        const origHTML = modalExportBtn.innerHTML;
        modalExportBtn.textContent = '⏳ Mengunduh...';
        try {
          const reports = await api.getInstitutionReports(currentDetails.id);
          if (!reports || reports.length === 0) {
            showToast('Belum ada rapor yang difinalisasi di instansi ini.', 'warning');
            return;
          }
          exportInstitutionToXlsx(reports, currentDetails.name);
          showToast(`${reports.length} rapor berhasil diekspor! 📊`, 'success');
        } catch (err) {
          showToast(err.message || 'Gagal mengekspor data.', 'error');
        } finally {
          modalExportBtn.disabled = false;
          modalExportBtn.innerHTML = origHTML;
        }
      });

      // ---- Edit toggle ----
      content.querySelector('#btn-edit-inst-toggle')?.addEventListener('click', () => {
        const form = content.querySelector('#edit-inst-form');
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
      });

      content.querySelector('#btn-cancel-inst-edit')?.addEventListener('click', () => {
        content.querySelector('#edit-inst-form').style.display = 'none';
      });

      content.querySelector('#btn-save-inst-edit')?.addEventListener('click', async () => {
        const name = content.querySelector('#edit-inst-name').value.trim();
        const address = content.querySelector('#edit-inst-address').value.trim();
        if (!name) { markInputError(content.querySelector('#edit-inst-name')); showToast('Nama instansi wajib diisi', 'warning'); return; }

        const saveBtn = content.querySelector('#btn-save-inst-edit');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Menyimpan...';

        try {
          await api.updateInstitution(currentDetails.id, { name, address });
          currentDetails.name = name;
          currentDetails.address = address;
          if (state.currentInstitution?.id === currentDetails.id) {
            state.currentInstitution.name = name;
            state.currentInstitution.address = address;
            const instInList = state.institutions.find(i => i.id === currentDetails.id);
            if (instInList) { instInList.name = name; instInList.address = address; }
            updateWorkspaceDisplay(state, container);
          }
          showToast('Instansi berhasil diperbarui!', 'success');
          renderContent(currentDetails);
        } catch (err) {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Simpan';
          showToast(err.message, 'error');
        }
      });

      // ---- Leave institution ----
      content.querySelector('#btn-leave-inst')?.addEventListener('click', async () => {
        const confirmed = await showConfirmDialog({
          title: `Keluar dari "${escapeHTML(currentDetails.name)}"?`,
          message: 'Anda tidak akan bisa mengakses data siswa di instansi ini lagi. Progress yang sudah Anda buat tetap tersimpan.',
          confirmLabel: 'Ya, Keluar',
          cancelLabel: 'Batal',
          danger: true,
        });
        if (!confirmed) return;

        const btn = content.querySelector('#btn-leave-inst');
        btn.disabled = true;
        btn.textContent = 'Keluar...';

        try {
          await api.leaveInstitution(currentDetails.id);
          showToast(`Berhasil keluar dari "${currentDetails.name}"`, 'success');
          modal.close();

          state.institutions = state.institutions.filter(i => i.id !== currentDetails.id);
          if (state.institutions.length > 0) {
            state.currentInstitution = state.institutions[0];
            updateWorkspaceDisplay(state, container);
            await loadStudents(state, container);
            renderStudentList(state, container);
          } else {
            state.currentInstitution = null;
            state.students = [];
            updateWorkspaceDisplay(state, container);
            renderOnboarding(state, container);
          }
        } catch (err) {
          btn.disabled = false;
          btn.textContent = 'Keluar dari Instansi';
          showToast(err.message, 'error');
        }
      });

      // ---- Delete institution ----
      content.querySelector('#btn-delete-inst')?.addEventListener('click', async () => {
        const confirmed = await showConfirmDialog({
          title: `Hapus "${escapeHTML(currentDetails.name)}"?`,
          message: 'Data murid dan rapor di dalamnya tidak akan bisa diakses lagi. Tindakan ini tidak dapat dibatalkan.',
          confirmLabel: 'Ya, Hapus',
          cancelLabel: 'Batal',
          danger: true,
        });
        if (!confirmed) return;

        const btn = content.querySelector('#btn-delete-inst');
        btn.disabled = true;
        btn.textContent = 'Menghapus...';

        try {
          await api.deleteInstitution(currentDetails.id);
          showToast('Instansi berhasil dihapus', 'success');
          modal.close();

          state.institutions = state.institutions.filter(i => i.id !== currentDetails.id);
          if (state.institutions.length > 0) {
            state.currentInstitution = state.institutions[0];
            updateWorkspaceDisplay(state, container);
            await loadStudents(state, container);
            renderStudentList(state, container);
          } else {
            state.currentInstitution = null;
            state.students = [];
            updateWorkspaceDisplay(state, container);
            renderOnboarding(state, container);
          }
        } catch (err) {
          btn.disabled = false;
          btn.textContent = 'Hapus Instansi Permanen';
          showToast(err.message, 'error');
        }
      });
    };

    const modal = showModal({ title: 'Pengaturan Instansi', content });
    renderContent(details);
  });
}

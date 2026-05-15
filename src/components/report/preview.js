/**
 * Preview Component — Narrative preview with per-section AI buttons,
 * finalization flow, arsip rapor (history) views, and AI trust framing.
 */

import { showToast } from '../shared/toast.js';
import { printReport } from '../../services/report-export.js';
import { escapeHTML } from '../../utils/sanitize.js';

let _overflowCleanup = null;

const ELEMENT_META = {
  'agama-budi-pekerti': { icon: '📖', title: 'Nilai Agama dan Budi Pekerti', letter: 'A' },
  'jati-diri':          { icon: '🌟', title: 'Jati Diri', letter: 'B' },
  'literasi-steam':     { icon: '📚', title: 'Dasar-Dasar Literasi & STEAM', letter: 'C' },
};

/**
 * Render preview panel (editing mode)
 * @param {HTMLElement} container
 * @param {object|null} templateResult - Template narratives { elementId: text }
 * @param {object|null} aiResult - AI-enhanced narratives { elementId: text }
 * @param {string} [studentName]
 * @param {object} [options] - { onGenerateAI, quota, onFinalizeReport, onViewHistory }
 */
export function renderPreview(container, templateResult, aiResult, studentName = '', options = {}) {
  const { onGenerateAI, quota, onFinalizeReport, onViewHistory, onResetSectionAI, onSelectAIVersion, aiHistory, onResetProgress, onCopyCapaian, onSave } = options;

  if (!templateResult || Object.keys(templateResult).length === 0) {
    container.innerHTML = `
      <div class="preview-panel">
        <div class="preview-header">
          <span class="preview-title">📄 Preview Narasi Rapor</span>
          ${onViewHistory ? `
            <div class="preview-actions">
              <button class="btn btn-ghost btn-sm" id="btn-view-history"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg> Arsip Rapor</button>
            </div>
          ` : ''}
        </div>
        <div class="preview-empty">
          <div class="preview-empty-icon">✍️</div>
          <p>Pilih indikator capaian untuk melihat narasi rapor secara otomatis.</p>
        </div>
      </div>
    `;
    if (onViewHistory) {
      container.querySelector('#btn-view-history')?.addEventListener('click', onViewHistory);
    }
    return;
  }

  const hasAnyAI = aiResult && Object.values(aiResult).some(v => v);

  const sectionsHTML = Object.entries(templateResult).map(([elemId, templateText]) => {
    const meta = ELEMENT_META[elemId] || { icon: '📋', title: elemId, letter: '?' };
    const sectionHasAI = !!(aiResult?.[elemId]);
    const displayText = sectionHasAI ? aiResult[elemId] : templateText;
    const historyArr = aiHistory?.[elemId] || [];
    const showVersionNav = sectionHasAI || historyArr.length >= 1;
    const currentIdx = showVersionNav ? historyArr.lastIndexOf(aiResult?.[elemId]) : -1;
    const templateIsActive = !sectionHasAI;

    return `
      <div class="preview-section" id="section-${elemId}">
        <div class="preview-section-title">
          <span>${meta.icon}</span>
          <span>${meta.title}</span>
          ${sectionHasAI ? '<span class="ai-badge">✨ AI</span>' : ''}
          <button class="btn-copy-section" data-copy-section="${elemId}" title="Salin narasi ini" aria-label="Salin narasi ${meta.title}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            <span class="copy-section-label">Salin</span>
          </button>
        </div>
        ${showVersionNav ? `
          <div class="ai-version-bar">
            <span class="ai-version-label">Tampilkan:</span>
            <button class="ai-version-btn ${templateIsActive ? 'active' : ''}" data-version-section="${elemId}" data-version-type="template" title="Gunakan narasi template baku">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> Baku
            </button>
            ${historyArr.map((_, i) => `
              <button class="ai-version-btn ${i === currentIdx ? 'active' : ''}" data-version-section="${elemId}" data-version-idx="${i}" title="Tampilkan hasil AI ke-${i + 1}">
                ✨ #${i + 1}
              </button>
            `).join('')}
          </div>
        ` : ''}
        <div class="preview-narrative ${sectionHasAI ? 'ai-enhanced' : ''}">${escapeHTML(displayText)}</div>
        <div class="preview-section-actions" style="margin-top:var(--space-3);display:flex;gap:var(--space-2);flex-wrap:wrap">
          ${onGenerateAI ? `
            <button class="btn btn-ai btn-sm preview-ai-btn" data-section="${elemId}">
              ${sectionHasAI ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg> Generate Ulang AI' : '✨ Percantik dengan AI'}
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');


  // Save scroll position so re-render doesn't flash to top (restored before next paint)
  const savedScrollTop = container.querySelector('.preview-body')?.scrollTop ?? 0;

  container.innerHTML = `
    <div class="preview-panel">
      <div class="preview-header">
        <span class="preview-title">📄 Narasi Rapor</span>
        <div class="preview-actions">
          <span style="display:none" aria-hidden="true">
            <button id="btn-copy-all"></button>
            <button id="btn-full-preview"></button>
            ${onViewHistory ? `<button id="btn-view-history"></button>` : ''}
          </span>
          <button class="btn btn-ghost btn-sm" id="btn-overflow" aria-label="Aksi lainnya" aria-haspopup="true" aria-expanded="false">
            <svg width="4" height="18" viewBox="0 0 4 18" fill="currentColor"><circle cx="2" cy="2" r="2"/><circle cx="2" cy="9" r="2"/><circle cx="2" cy="16" r="2"/></svg>
          </button>
          ${onFinalizeReport ? `
            <button class="btn btn-primary btn-sm" id="btn-finalize-report">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 15 11 17 15 13"/></svg>
              Finalisasi & Simpan
            </button>
          ` : ''}
        </div>
      </div>
      ${hasAnyAI ? `
        <div class="ai-trust-banner">
          <span>🤝</span>
          <span>AI membantu merangkai kata, Bunda yang paling tahu cerita di baliknya.</span>
        </div>
      ` : ''}
      <div class="preview-body">
        ${sectionsHTML}
      </div>
    </div>
  `;

  // Restore scroll before next paint — prevents flash-to-top on re-render
  if (savedScrollTop > 0) {
    const previewBody = container.querySelector('.preview-body');
    if (previewBody) previewBody.scrollTop = savedScrollTop;
  }

  addPreviewStyles();

  // ---- Finalize button ----
  if (onFinalizeReport) {
    container.querySelector('#btn-finalize-report')?.addEventListener('click', () => {
      onFinalizeReport();
    });
  }

  // ---- Full preview modal ----
  container.querySelector('#btn-full-preview')?.addEventListener('click', () => {
    openDraftPreviewModal(templateResult, aiResult, studentName, { onFinalize: onFinalizeReport, onSave });
  });

  // ---- History button ----
  if (onViewHistory) {
    container.querySelector('#btn-view-history')?.addEventListener('click', onViewHistory);
  }

  // ---- Copy all ----
  container.querySelector('#btn-copy-all')?.addEventListener('click', () => {
    const allText = Object.entries(templateResult)
      .map(([elemId, templateText]) => {
        const meta = ELEMENT_META[elemId] || { title: elemId };
        const text = aiResult?.[elemId] || templateText;
        return `[${meta.title}]\n${text}`;
      })
      .join('\n\n');

    copyToClipboard(allText, 'Semua narasi tersalin');
  });

  // ---- Overflow menu (mobile) — portal to avoid overflow:hidden clipping ----
  const overflowBtn = container.querySelector('#btn-overflow');
  if (overflowBtn) {
    if (_overflowCleanup) _overflowCleanup();
    let portal = null;

    const closeMenu = () => {
      portal?.remove();
      portal = null;
      overflowBtn.setAttribute('aria-expanded', 'false');
      document.removeEventListener('click', onDocClick);
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('resize', closeMenu);
    };

    const onDocClick = (e) => {
      if (!overflowBtn.contains(e.target) && !portal?.contains(e.target)) closeMenu();
    };

    overflowBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (portal) { closeMenu(); return; }

      const rect = overflowBtn.getBoundingClientRect();
      const PW = 192; // portal width
      const leftPos = Math.max(8, Math.min(rect.right - PW, window.innerWidth - PW - 8));
      portal = document.createElement('div');
      portal.className = 'preview-overflow-portal';
      portal.style.cssText = `position:fixed;top:${rect.bottom + 4}px;left:${leftPos}px;background:var(--bg-card);border:1px solid var(--border-light);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.15);z-index:9999;min-width:${PW}px;padding:4px`;
      if (!document.getElementById('poi-styles')) {
        const ps = document.createElement('style');
        ps.id = 'poi-styles';
        ps.textContent = `
          .poi { display:flex; align-items:center; gap:10px; width:100%; padding:9px 14px; border-radius:8px; font-size:13.5px; font-weight:500; color:var(--text-primary); background:none; border:none; cursor:pointer; text-align:left; transition:background 0.12s, color 0.12s; white-space:nowrap; }
          .poi:hover { background:var(--primary-light); color:var(--primary); }
          .poi-icon { display:flex; align-items:center; justify-content:center; width:18px; flex-shrink:0; color:var(--text-secondary); transition:color 0.12s; }
          .poi:hover .poi-icon { color:var(--primary); }
          .poi-danger { color:var(--error,#DC2626) !important; }
          .poi-danger .poi-icon { color:var(--error,#DC2626) !important; }
          .poi-danger:hover { background:rgba(220,38,38,0.07) !important; color:var(--error,#DC2626) !important; }
        `;
        document.head.appendChild(ps);
      }

      const _svgCopy    = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
      const _svgEye     = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
      const _svgArchive = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`;
      const _svgUsers   = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
      const _svgReset   = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>`;
      const _poi = (id, svg, label, cls = '') =>
        `<button class="poi${cls ? ' '+cls : ''}" id="${id}"><span class="poi-icon">${svg}</span><span>${label}</span></button>`;

      portal.innerHTML = `
        ${_poi('op-copy-all',     _svgCopy,    'Salin Semua')}
        ${_poi('op-full-preview', _svgEye,     'Lihat Penuh')}
        ${onViewHistory   ? _poi('op-view-history',  _svgArchive, 'Arsip Rapor') : ''}
        ${onCopyCapaian   ? _poi('op-copy-capaian',  _svgUsers,   'Terapkan ke Siswa Lain') : ''}
        ${onResetProgress ? `<div style="height:1px;background:var(--border-light);margin:4px 0"></div>${_poi('op-reset', _svgReset, 'Mulai Ulang', 'poi-danger')}` : ''}
      `;
      document.body.appendChild(portal);
      overflowBtn.setAttribute('aria-expanded', 'true');

      portal.querySelector('#op-copy-all')?.addEventListener('click', () => {
        closeMenu();
        container.querySelector('#btn-copy-all')?.click();
      });
      portal.querySelector('#op-full-preview')?.addEventListener('click', () => {
        closeMenu();
        openDraftPreviewModal(templateResult, aiResult, studentName, { onFinalize: onFinalizeReport, onSave });
      });
      if (onViewHistory) {
        portal.querySelector('#op-view-history')?.addEventListener('click', () => {
          closeMenu();
          onViewHistory();
        });
      }
      if (onCopyCapaian) {
        portal.querySelector('#op-copy-capaian')?.addEventListener('click', () => {
          closeMenu();
          onCopyCapaian();
        });
      }
      if (onResetProgress) {
        portal.querySelector('#op-reset')?.addEventListener('click', () => {
          closeMenu();
          onResetProgress();
        });
      }

      setTimeout(() => {
        document.addEventListener('click', onDocClick);
        window.addEventListener('scroll', closeMenu, { passive: true, capture: true });
        window.addEventListener('resize', closeMenu);
      }, 0);
    });

    _overflowCleanup = closeMenu;
  }

  // ---- Per-section copy buttons ----
  bindSectionCopyButtons(container, (elemId) => {
    const text = aiResult?.[elemId] || templateResult[elemId] || '';
    return text;
  });

  // ---- Per-section AI buttons ----
  if (onGenerateAI) {
    container.querySelectorAll('.preview-ai-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const sectionId = btn.dataset.section;
        const originalHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span style="display:inline-flex;align-items:center;gap:6px"><span style="width:12px;height:12px;border:2px solid rgba(255,255,255,0.4);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite;flex-shrink:0"></span>Memperindah narasi...</span>';
        try {
          await onGenerateAI(sectionId);
        } catch {
          btn.disabled = false;
          btn.innerHTML = originalHTML;
        }
      });
    });
  }

  // ---- Version bar: template pill + AI version pills ----
  container.querySelectorAll('.ai-version-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sectionId = btn.dataset.versionSection;
      if (btn.dataset.versionType === 'template') {
        if (onResetSectionAI) onResetSectionAI(sectionId);
      } else {
        if (onSelectAIVersion) onSelectAIVersion(sectionId, parseInt(btn.dataset.versionIdx));
      }
    });
  });

  // ---- Version bar styles (injected once) ----
  if (!document.getElementById('ai-version-bar-styles')) {
    const s = document.createElement('style');
    s.id = 'ai-version-bar-styles';
    s.textContent = `
      .ai-version-bar { display:flex; align-items:center; gap:4px; margin-bottom:var(--space-2); flex-wrap:wrap; }
      .ai-version-label { font-size:11px; color:var(--text-tertiary); margin-right:2px; }
      .ai-version-btn { padding:2px 8px; border-radius:10px; border:1px solid var(--border-light); background:var(--bg-secondary); color:var(--text-secondary); font-size:11px; font-weight:600; cursor:pointer; transition:all 0.15s; }
      .ai-version-btn:hover { border-color:var(--primary); color:var(--primary); }
      .ai-version-btn.active { background:var(--primary); border-color:var(--primary); color:white; }
    `;
    document.head.appendChild(s);
  }
}


// ============================================================
//  ARSIP RAPOR — History List (right-side panel)
// ============================================================

/**
 * Render history list panel (replaces preview panel)
 * @param {HTMLElement} container
 * @param {Array} reports - Finalized reports from server
 * @param {string} studentName
 * @param {object} options - { onSelectReport, onBackToEditor }
 */
export function renderHistoryList(container, reports, studentName, options = {}) {
  const { onSelectReport, onBackToEditor } = options;

  if (!reports || reports.length === 0) {
    container.innerHTML = `
      <div class="preview-panel">
        <div class="preview-header">
          <span class="preview-title">Arsip Rapor ${studentName ? '— ' + studentName : ''}</span>
          <div class="preview-actions">
            ${onBackToEditor ? `<button class="btn btn-ghost btn-sm" id="btn-back-editor">← Kembali ke Editor</button>` : ''}
          </div>
        </div>
        <div class="preview-empty">
          <div class="preview-empty-icon">📂</div>
          <p>Belum ada dokumen rapor yang difinalisasi untuk siswa ini.</p>
        </div>
      </div>
    `;
    if (onBackToEditor) {
      container.querySelector('#btn-back-editor')?.addEventListener('click', onBackToEditor);
    }
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
      <div class="history-item" data-idx="${idx}">
        <div class="history-item-left">
          <span class="history-badge">${semLabel}</span>
          <div class="history-item-meta">
            <span class="history-item-year">TA ${report.academicYear || '-'}</span>
            <span class="history-item-date">${dateStr}</span>
          </div>
        </div>
        <div class="history-item-actions">
          <button class="btn btn-ghost btn-sm history-btn-view" data-idx="${idx}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Lihat</button>
          <button class="btn btn-ghost btn-sm history-btn-print" data-idx="${idx}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Cetak</button>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="preview-panel">
      <div class="preview-header">
        <span class="preview-title">Arsip Rapor ${studentName ? '— ' + studentName : ''}</span>
        <div class="preview-actions">
          ${onBackToEditor ? `<button class="btn btn-ghost btn-sm" id="btn-back-editor">← Kembali ke Editor</button>` : ''}
        </div>
      </div>
      <div class="preview-body">
        <div class="history-list">
          ${listHTML}
        </div>
      </div>
    </div>
  `;

  addHistoryStyles();

  // Back button
  if (onBackToEditor) {
    container.querySelector('#btn-back-editor')?.addEventListener('click', onBackToEditor);
  }

  // View buttons
  container.querySelectorAll('.history-btn-view').forEach(btn => {
    btn.addEventListener('click', () => {
      const report = reports[parseInt(btn.dataset.idx)];
      if (onSelectReport) onSelectReport(report);
    });
  });

  // Print buttons
  container.querySelectorAll('.history-btn-print').forEach(btn => {
    btn.addEventListener('click', () => {
      const report = reports[parseInt(btn.dataset.idx)];
      printReport(report, options.institutionName || '');
    });
  });
}




// ============================================================
//  Styles
// ============================================================

function addPreviewStyles() {
  if (document.querySelector('#preview-extra-styles')) return;
  const style = document.createElement('style');
  style.id = 'preview-extra-styles';
  style.textContent = `
    .ai-badge {
      font-size: var(--font-size-xs);
      padding: 2px 8px;
      border-radius: var(--radius-full);
      background: linear-gradient(135deg, var(--secondary-light), var(--primary-light));
      color: var(--secondary);
      font-weight: 700;
      flex-shrink: 0;
      white-space: nowrap;
      line-height: 1.5;
      align-self: center;
    }
    .preview-actions { display: flex; gap: var(--space-2); align-items: center; }
    .preview-overflow-item {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      width: 100%;
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      font-size: var(--font-size-sm);
      font-weight: 500;
      color: var(--text-primary);
      background: none;
      border: none;
      cursor: pointer;
      transition: background var(--transition-fast);
      text-align: left;
    }
    .preview-overflow-item:hover { background: var(--primary-light); color: var(--primary); }
    .preview-quota-info {
      font-size: var(--font-size-xs);
      color: var(--text-tertiary);
      padding: 2px 8px;
      border-radius: var(--radius-full);
      background: var(--bg-page);
      border: 1px solid var(--border-light);
    }
    .preview-narrative {
      white-space: pre-wrap;
      line-height: 1.8;
    }
    /* AI Trust Banner */
    .ai-trust-banner {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      font-size: var(--font-size-xs);
      color: var(--text-tertiary);
      background: linear-gradient(135deg, rgba(13,148,136,0.04), rgba(244,63,94,0.04));
      border-bottom: 1px solid var(--border-light);
      font-style: italic;
    }
    /* Read-only Lock Banner */
    .report-lock-banner {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      font-size: var(--font-size-xs);
      font-weight: 600;
      color: var(--text-tertiary);
      background: var(--bg-page);
      border-bottom: 1px solid var(--border-light);
    }
    /* Formal section title (no emoji, letter prefix) */
    .formal-title {
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    /* Report detail metadata */
    .report-detail-meta {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-4);
      padding: var(--space-4);
      background: var(--bg-page);
      border-radius: var(--radius-md);
      margin-bottom: var(--space-6);
      border: 1px solid var(--border-light);
    }
    .detail-meta-row {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .detail-meta-label {
      font-size: 10px;
      font-weight: 700;
      color: var(--text-tertiary);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .detail-meta-value {
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--text-primary);
    }
  `;
  document.head.appendChild(style);
}

function addHistoryStyles() {
  if (document.querySelector('#history-styles')) return;
  const style = document.createElement('style');
  style.id = 'history-styles';
  style.textContent = `
    .history-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
    .history-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-4);
      background: var(--bg-page);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-lg);
      transition: all var(--transition-fast);
    }
    .history-item:hover {
      border-color: var(--primary);
      box-shadow: var(--shadow-sm);
    }
    .history-item-left {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }
    .history-badge {
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-full);
      font-size: var(--font-size-xs);
      font-weight: 700;
      background: var(--primary-light);
      color: var(--primary);
      white-space: nowrap;
    }
    .history-item-meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .history-item-year {
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--text-primary);
    }
    .history-item-date {
      font-size: var(--font-size-xs);
      color: var(--text-tertiary);
    }
    .history-item-actions {
      display: flex;
      gap: var(--space-2);
    }
  `;
  document.head.appendChild(style);
}


// ============================================================
//  Shared Helpers
// ============================================================

// ============================================================
//  DRAFT PREVIEW MODAL — Full narrative view before finalization
// ============================================================

function openDraftPreviewModal(templateResult, aiResult, studentName, { onFinalize = null, onSave = null } = {}) {
  const backdrop = document.createElement('div');
  backdrop.className = 'dp-backdrop';

  const copySvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

  const sectionsHTML = Object.entries(templateResult).map(([elemId, templateText]) => {
    const meta = ELEMENT_META[elemId] || { icon: '📋', title: elemId };
    const text = aiResult?.[elemId] || templateText || '';
    const isAI = !!(aiResult?.[elemId]);
    const paragraphs = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);

    return `
      <div class="dp-section">
        <div class="dp-section-header">
          <span class="dp-section-icon">${meta.icon}</span>
          <h3 class="dp-section-title">${meta.title}${isAI ? ' <span class="dp-ai-tag">✨ AI</span>' : ''}</h3>
          <button class="btn btn-secondary btn-sm dp-copy-btn" data-dp-section="${elemId}" aria-label="Salin narasi ${meta.title}">
            ${copySvg} Salin
          </button>
        </div>
        <div class="dp-section-body">
          ${paragraphs.map(p => `<p>${escapeHTML(p)}</p>`).join('')}
        </div>
      </div>
    `;
  }).join('');

  const _svgFile = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
  const _svgCopyAll = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
  const _svgSave = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`;
  const _svgFinalize = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
  const _svgClose = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

  backdrop.innerHTML = `
    <div class="dp-modal" role="dialog" aria-modal="true" aria-label="Preview Narasi Rapor">
      <div class="dp-header">
        <div class="dp-title-group">
          <h2 class="dp-title">${_svgFile} Preview Narasi Rapor</h2>
          ${studentName ? `<p class="dp-subtitle">${escapeHTML(studentName)}</p>` : ''}
        </div>
        <div class="dp-header-actions">
          <button class="btn btn-ghost btn-sm dp-btn-icon" id="dp-copy-all" title="Salin semua narasi">${_svgCopyAll} Salin Semua</button>
          ${onSave ? `<button class="btn btn-secondary btn-sm dp-btn-icon" id="dp-save" title="Simpan progress">${_svgSave} Simpan</button>` : ''}
          ${onFinalize ? `<button class="btn btn-primary btn-sm dp-btn-icon" id="dp-finalize" title="Finalisasi rapor">${_svgFinalize} Finalisasi</button>` : ''}
          <button class="dp-close-btn" id="dp-close" aria-label="Tutup">${_svgClose}</button>
        </div>
      </div>
      <div class="dp-body">${sectionsHTML}</div>
    </div>
  `;

  document.body.appendChild(backdrop);
  addDraftPreviewStyles();
  requestAnimationFrame(() => backdrop.classList.add('active'));

  function close() {
    backdrop.classList.remove('active');
    backdrop.addEventListener('transitionend', () => backdrop.remove(), { once: true });
  }

  backdrop.querySelector('#dp-close').addEventListener('click', close);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', function escH(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escH); }
  });

  backdrop.querySelector('#dp-copy-all').addEventListener('click', () => {
    const allText = Object.entries(templateResult)
      .map(([elemId, templateText]) => {
        const meta = ELEMENT_META[elemId] || { title: elemId };
        const text = aiResult?.[elemId] || templateText;
        return `[${meta.title}]\n${text}`;
      })
      .join('\n\n');
    copyToClipboard(allText, 'Semua narasi tersalin');
  });

  backdrop.querySelectorAll('.dp-copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const elemId = btn.dataset.dpSection;
      const text = aiResult?.[elemId] || templateResult[elemId] || '';
      copyToClipboard(text, 'Narasi tersalin');
      btn.innerHTML = '✓ Disalin';
      btn.style.color = 'var(--primary)';
      setTimeout(() => {
        btn.innerHTML = `${copySvg} Salin`;
        btn.style.color = '';
      }, 1500);
    });
  });

  if (onSave) {
    backdrop.querySelector('#dp-save')?.addEventListener('click', () => {
      onSave();
      close();
    });
  }

  if (onFinalize) {
    backdrop.querySelector('#dp-finalize')?.addEventListener('click', () => {
      close();
      onFinalize();
    });
  }
}

function addDraftPreviewStyles() {
  if (document.getElementById('draft-preview-styles')) return;
  const s = document.createElement('style');
  s.id = 'draft-preview-styles';
  s.textContent = `
    .dp-backdrop {
      position: fixed; inset: 0;
      background: var(--bg-overlay);
      z-index: var(--z-modal-backdrop);
      display: flex; align-items: center; justify-content: center;
      padding: var(--space-4);
      opacity: 0;
      transition: opacity 0.25s ease;
      backdrop-filter: blur(4px);
    }
    .dp-backdrop.active { opacity: 1; }
    .dp-modal {
      background: var(--bg-card);
      border-radius: var(--radius-2xl);
      width: 100%; max-width: 680px;
      max-height: 90vh;
      display: flex; flex-direction: column;
      box-shadow: var(--shadow-xl);
      transform: translateY(24px);
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      overflow: hidden;
    }
    .dp-backdrop.active .dp-modal { transform: translateY(0); }
    .dp-header {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-5) var(--space-6);
      border-bottom: 1px solid var(--border-light);
      flex-shrink: 0;
      flex-wrap: wrap;
    }
    .dp-title-group { flex: 1; min-width: 0; }
    .dp-title { font-size: var(--font-size-lg); font-weight: 700; }
    .dp-subtitle { font-size: var(--font-size-sm); color: var(--text-secondary); margin-top: 2px; }
    .dp-header-actions { display: flex; align-items: center; gap: var(--space-2); flex-shrink: 0; }
    .dp-btn-icon { display: inline-flex !important; align-items: center; gap: 6px; }
    .dp-close-btn {
      width: 36px; height: 36px;
      display: flex; align-items: center; justify-content: center;
      border-radius: var(--radius-md);
      color: var(--text-tertiary);
      cursor: pointer; border: none; background: none;
      transition: all var(--transition-fast);
      flex-shrink: 0;
    }
    .dp-close-btn:hover { background: var(--error-light); color: var(--error); }
    .dp-body {
      overflow-y: auto;
      padding: var(--space-6);
      display: flex; flex-direction: column;
      gap: var(--space-6);
    }
    .dp-section-header {
      display: flex; align-items: center; gap: var(--space-2);
      margin-bottom: var(--space-3);
    }
    .dp-section-icon { font-size: var(--font-size-lg); flex-shrink: 0; }
    .dp-section-title {
      font-size: var(--font-size-sm); font-weight: 700;
      color: var(--primary); text-transform: uppercase;
      letter-spacing: 0.05em; flex: 1; margin: 0;
    }
    .dp-ai-tag {
      font-size: var(--font-size-xs); font-weight: 600;
      background: var(--secondary-light); color: var(--secondary);
      padding: 1px 8px; border-radius: var(--radius-full);
      text-transform: none; letter-spacing: 0; margin-left: 4px;
    }
    .dp-copy-btn { flex-shrink: 0; display: inline-flex !important; align-items: center; gap: 4px; }
    .dp-section-body {
      font-size: var(--font-size-base); line-height: 1.8;
      color: var(--text-primary);
      padding: var(--space-4);
      background: var(--bg-body);
      border-radius: var(--radius-md);
      border-left: 3px solid var(--primary);
    }
    .dp-section-body p { margin: 0; }
    .dp-section-body p + p { margin-top: 0.8em; }
    @media (max-width: 520px) {
      .dp-backdrop { padding: 0; align-items: flex-end; }
      .dp-modal { border-radius: var(--radius-2xl) var(--radius-2xl) 0 0; max-height: 92vh; }
    }
  `;
  document.head.appendChild(s);
}

// ============================================================

/**
 * Copy text to clipboard with fallback for older browsers
 */
function copyToClipboard(text, successMsg = 'Disalin ke clipboard!') {
  navigator.clipboard.writeText(text).then(() => {
    showToast(successMsg, 'success');
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast(successMsg, 'success');
  });
}

/**
 * Bind click handlers for per-section copy buttons
 * @param {HTMLElement} container
 * @param {Function} getTextFn - (elemId) => string
 */
function bindSectionCopyButtons(container, getTextFn) {
  container.querySelectorAll('.btn-copy-section').forEach(btn => {
    btn.addEventListener('click', () => {
      const elemId = btn.dataset.copySection;
      const text = getTextFn(elemId);
      if (!text) return;

      copyToClipboard(text, 'Narasi tersalin');

      // Visual feedback
      btn.classList.add('copied');
      setTimeout(() => btn.classList.remove('copied'), 1500);
    });
  });

  // Inject copy button styles
  addCopyButtonStyles();
}

function addCopyButtonStyles() {
  if (document.querySelector('#copy-btn-styles')) return;
  const style = document.createElement('style');
  style.id = 'copy-btn-styles';
  style.textContent = `
    .btn-copy-section {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      height: 28px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-light);
      background: var(--bg-card);
      color: var(--text-secondary);
      cursor: pointer;
      opacity: 1;
      transition: all var(--transition-fast);
      margin-left: auto;
      position: relative;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
    }
    .btn-copy-section:hover {
      background: var(--primary-light);
      color: var(--primary);
      border-color: var(--primary);
    }
    .btn-copy-section:focus { outline: none; box-shadow: 0 0 0 2px var(--primary-glow); }
    .btn-copy-section.copied {
      color: var(--primary);
      border-color: var(--primary);
      background: var(--primary-light);
    }
    .copy-section-label { display: none; }
    @media (max-width: 768px) {
      .copy-section-label { display: inline; }
    }
    .btn-copy-section.copied::after {
      content: 'Disalin!';
      position: absolute;
      top: -24px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 10px;
      font-weight: 600;
      color: var(--primary);
      white-space: nowrap;
      animation: copyFadeUp 1.2s ease-out forwards;
    }
    @keyframes copyFadeUp {
      0% { opacity: 1; transform: translateX(-50%) translateY(0); }
      100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
    }
    .preview-section-title {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      position: sticky;
      top: -1px;
      z-index: 2;
      background: var(--bg-card);
      padding: calc(var(--space-3) + 1px) 0 var(--space-2);
      margin: 0 0 var(--space-2) 0;
      flex-wrap: wrap;
    }
    .preview-section-title .btn-copy-section {
      margin-left: auto;
      flex-shrink: 0;
    }
    @media (max-width: 768px) {
      .ai-badge {
        font-size: 10px;
        padding: 1px 6px;
      }
    }
    /* Side-by-side desktop only (>1024px): flash highlight when template auto-updates */
    @media (min-width: 1025px) {
      @keyframes narrativeFlash {
        0%   { background: rgba(13,148,136,0.15); box-shadow: 0 0 0 10px rgba(13,148,136,0.15); border-radius: 4px; }
        60%  { background: rgba(13,148,136,0.05); box-shadow: 0 0 0 6px  rgba(13,148,136,0.05); }
        100% { background: transparent;           box-shadow: 0 0 0 0    transparent;            }
      }
      .narrative-changed {
        animation: narrativeFlash 1.8s ease-out forwards;
        border-radius: 4px;
      }
    }
  `;
  document.head.appendChild(style);
}

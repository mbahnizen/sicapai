/**
 * Checklist Component — 4-level progressive disclosure accordion
 * Level 1: Elemen (tab/card)
 * Level 2: Sub-Elemen (accordion)
 * Level 3: Indikator (checkbox)
 * Level 4: Sub-Indikator (nested checkbox/radio)
 */

import { getChecklistStructure, countSelected, getKokurikulerData, countKokurikulerSelected, getNilaiPlusData, getSaranData } from '../../services/template-engine.js';

/**
 * Render the checklist UI
 * @param {HTMLElement} container
 * @param {object} student - Student data (for religion filter)
 * @param {object} selectedIndicators - Current selections
 * @param {Function} onSelectionChange - Callback when selection changes
 */
export function renderChecklist(container, student, selectedIndicators, onSelectionChange) {
  const structure = getChecklistStructure(student?.religion);

  const elementIcons = {
    'agama-budi-pekerti': '📖',
    'jati-diri': '🌟',
    'literasi-steam': '📚',
  };

  const elementColors = {
    'agama-budi-pekerti': 'var(--primary)',
    'jati-diri': 'var(--secondary)',
    'literasi-steam': 'var(--accent)',
  };

  container.innerHTML = `
    <div class="checklist-container">
      <div class="checklist-header">
        <h3 class="checklist-title">📋 Capaian Pembelajaran</h3>
        <span class="checklist-counter" id="checklist-counter">0 dipilih</span>
      </div>
      <div class="checklist-elements" id="checklist-elements">
        <div class="kokurikuler-divider">
          <span class="kokurikuler-divider-line"></span>
          <span class="kokurikuler-divider-label">Intrakurikuler</span>
          <span class="kokurikuler-divider-line"></span>
        </div>
        ${structure.map((elemen) => `
          <div class="accordion checklist-element" data-element="${elemen.id}">
            <button class="accordion-header" aria-expanded="false" data-toggle="${elemen.id}">
              <span class="accordion-icon">${elementIcons[elemen.id] || '📋'}</span>
              <span class="accordion-title">${elemen.nama}</span>
              <span class="accordion-badge" id="badge-${elemen.id}">0</span>
              <span class="accordion-chevron">▾</span>
            </button>
            <div class="accordion-content" id="content-${elemen.id}">
              <div class="accordion-body">
                ${elemen.subElemen.map((sub) => `
                  <div class="sub-elemen-group">
                    <button class="sub-elemen-header" aria-expanded="false" data-toggle-sub="${sub.id}">
                      <span class="sub-elemen-title">${sub.nama}</span>
                      <span class="accordion-chevron sub-chevron">▾</span>
                    </button>
                    <div class="sub-elemen-content" id="sub-content-${sub.id}">
                      ${sub.indikator.map((ind) => renderIndicator(ind, selectedIndicators)).join('')}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Add styles
  addChecklistStyles(container);

  // Setup accordion toggles
  setupAccordions(container);

  // Setup checkbox/radio interactions
  setupCheckboxes(container, selectedIndicators, onSelectionChange, structure);

  // Setup fixed-position tooltips for level buttons (avoids overflow clipping)
  setupLevelBtnTooltips(container);

  // Update counter
  updateCounter(container, selectedIndicators);
}

/**
 * Render kokurikuler checklist — separate function from renderChecklist (Option A).
 * Flat checkboxes (no sub-indicators), 8 dimensi as collapsible groups.
 * Appended BELOW the intrakurikuler checklist with a visual divider.
 *
 * @param {HTMLElement} container - Same container as renderChecklist
 * @param {object} kokurikulerSelected - { "kk-ibadah-mandiri": true, ... }
 * @param {Function} onSelectionChange - Callback with updated selection map
 */
export function renderKokurikulerChecklist(container, kokurikulerSelected, onSelectionChange) {
  const dimensi = getKokurikulerData();
  const elementsEl = container.querySelector('#checklist-elements');
  if (!elementsEl) return;

  // Remove previous kokurikuler section if re-rendering
  elementsEl.querySelector('#kokurikuler-section')?.remove();

  const section = document.createElement('div');
  section.id = 'kokurikuler-section';
  section.innerHTML = `
    <div class="kokurikuler-divider">
      <span class="kokurikuler-divider-line"></span>
      <span class="kokurikuler-divider-label">Kokurikuler</span>
      <span class="kokurikuler-divider-line"></span>
    </div>
    <div class="kokurikuler-header">
      <span class="kokurikuler-title">🎯 Profil Lulusan (8 Dimensi)</span>
      <span class="kokurikuler-counter" id="kokurikuler-counter">0 dipilih</span>
    </div>
    ${dimensi.map(d => `
      <div class="accordion checklist-element" data-element="kk-${d.id}">
        <button class="accordion-header" aria-expanded="false" data-toggle="kk-${d.id}">
          <span class="accordion-icon">🎯</span>
          <span class="accordion-title">${d.nama}</span>
          <span class="accordion-badge" id="badge-kk-${d.id}">0</span>
          <span class="accordion-chevron">▾</span>
        </button>
        <div class="accordion-content" id="content-kk-${d.id}">
          <div class="accordion-body">
            ${d.indikator.map(ind => `
              <div class="indicator-group">
                <label class="check-item">
                  <input type="checkbox"
                         data-kokurikuler-id="${ind.id}"
                         ${kokurikulerSelected[ind.id] ? 'checked' : ''} />
                  <span class="check-label">${ind.label}</span>
                </label>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `).join('')}
  `;

  elementsEl.appendChild(section);

  // Setup accordion toggles for kokurikuler
  section.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.toggle;
      const content = section.querySelector(`#content-${id}`);
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', !expanded);
      content.classList.toggle('expanded');
    });
  });

  // Setup checkbox interactions
  section.querySelectorAll('[data-kokurikuler-id]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const id = checkbox.dataset.kokurikulerId;
      if (checkbox.checked) {
        kokurikulerSelected[id] = true;
      } else {
        delete kokurikulerSelected[id];
      }
      updateKokurikulerCounter(section, kokurikulerSelected);
      onSelectionChange({ ...kokurikulerSelected });
    });
  });

  updateKokurikulerCounter(section, kokurikulerSelected);
  addKokurikulerChecklistStyles();
}

function updateKokurikulerCounter(container, selected) {
  const counts = countKokurikulerSelected(selected);
  const counterEl = container.querySelector('#kokurikuler-counter');
  if (counterEl) counterEl.textContent = `${counts.total} dipilih`;

  for (const [dimId, count] of Object.entries(counts.byDimensi)) {
    const badge = container.querySelector(`#badge-kk-${dimId}`);
    if (badge) badge.textContent = count;
  }
}

function addKokurikulerChecklistStyles() {
  if (document.querySelector('#kokurikuler-checklist-styles')) return;
  const s = document.createElement('style');
  s.id = 'kokurikuler-checklist-styles';
  s.textContent = `
    .kokurikuler-divider {
      display: flex; align-items: center; gap: var(--space-3);
      margin: var(--space-6) 0 var(--space-4);
    }
    .kokurikuler-divider-line {
      flex: 1; height: 1px;
      background: linear-gradient(90deg, transparent, var(--border-light), transparent);
    }
    .kokurikuler-divider-label {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.08em; color: var(--text-tertiary);
      white-space: nowrap;
    }
    .kokurikuler-header {
      display: flex; align-items: center; gap: var(--space-2);
      margin-bottom: var(--space-3);
    }
    .kokurikuler-title {
      font-size: var(--font-size-md); font-weight: 700; margin-right: auto;
    }
    .kokurikuler-counter {
      font-size: var(--font-size-sm); font-weight: 600;
      color: var(--secondary); background: rgba(16,185,129,0.1);
      padding: var(--space-1) var(--space-3); border-radius: var(--radius-full);
    }
    #kokurikuler-section .accordion-icon { font-size: 14px; }
  `;
  document.head.appendChild(s);
}

const LEVEL_TOOLTIPS = {
  BB:  'Belum Berkembang',
  MB:  'Mulai Berkembang',
  BSH: 'Berkembang Sesuai Harapan',
  BSB: 'Berkembang Sangat Baik',
};

function renderIndicator(ind, selectedIndicators) {
  const selection = selectedIndicators[ind.id];
  const isSelected = !!selection;
  const currentLevel = selection?.level ?? null;
  const selectedSubs = selection?.subs || [];
  const levels = ['BB', 'MB', 'BSH', 'BSB'];

  if (ind.hasSub) {
    // Level buttons ARE the selection mechanism — no checkbox
    const showSubs = isSelected && ind.subIndikator.length > 0 &&
                     ['BSH', 'BSB'].includes(currentLevel);

    const inputType = ind.isMutuallyExclusive ? 'radio' : 'checkbox';
    const subHTML = ind.subIndikator.length > 0 ? `
      <div class="check-sub-list" id="sub-list-${ind.id}" style="${showSubs ? '' : 'display:none'}">
        ${ind.subIndikator.map((sub) => `
          <label class="check-item check-sub-item">
            <input type="${inputType}"
                   name="${ind.isMutuallyExclusive ? 'radio-' + ind.id : ''}"
                   data-parent="${ind.id}"
                   data-sub-id="${sub.id}"
                   ${selectedSubs.includes(sub.id) ? 'checked' : ''} />
            <span class="check-label">${sub.label}</span>
          </label>
        `).join('')}
      </div>
    ` : '';

    return `
      <div class="indicator-group indicator-group--parent${isSelected ? ' indicator-group--selected' : ''}"
           data-ind-group="${ind.id}">
        <div class="ind-level-row">
          <span class="ind-label">${ind.label}</span>
          <div class="level-selector level-selector--inline" id="level-${ind.id}">
            ${levels.map((lvl) => `
              <button type="button"
                      class="level-btn${currentLevel === lvl ? ' active' : ''}"
                      data-level-for="${ind.id}"
                      data-level="${lvl}"
                      data-ind-has-sub="true"
                      data-tooltip="${LEVEL_TOOLTIPS[lvl]}">${lvl}</button>
            `).join('')}
          </div>
        </div>
        ${subHTML}
      </div>
    `;
  }

  // Non-has_sub: same inline pattern as has_sub, no sub-list
  return `
    <div class="indicator-group indicator-group--parent${isSelected ? ' indicator-group--selected' : ''}"
         data-ind-group="${ind.id}">
      <div class="ind-level-row">
        <span class="ind-label">${ind.label}</span>
        <div class="level-selector level-selector--inline" id="level-${ind.id}">
          ${levels.map((lvl) => `
            <button type="button"
                    class="level-btn${currentLevel === lvl ? ' active' : ''}"
                    data-level-for="${ind.id}"
                    data-level="${lvl}"
                    data-ind-has-sub="false"
                    data-tooltip="${LEVEL_TOOLTIPS[lvl]}">${lvl}</button>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function setupAccordions(container) {
  // Level 1: Element accordions
  container.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.toggle;
      const content = container.querySelector(`#content-${id}`);
      const expanded = btn.getAttribute('aria-expanded') === 'true';

      btn.setAttribute('aria-expanded', !expanded);
      content.classList.toggle('expanded');
    });
  });

  // Level 2: Sub-element accordions
  container.querySelectorAll('[data-toggle-sub]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.toggleSub;
      const content = container.querySelector(`#sub-content-${id}`);
      const expanded = btn.getAttribute('aria-expanded') === 'true';

      btn.setAttribute('aria-expanded', !expanded);
      content.classList.toggle('expanded');
    });
  });
}

function setupCheckboxes(container, selectedIndicators, onSelectionChange, structure) {
  // All indicator level buttons — unified toggle-select behavior
  container.querySelectorAll('[data-level-for]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const indId = btn.dataset.levelFor;
      const newLevel = btn.dataset.level;
      const hasSub = btn.dataset.indHasSub === 'true';
      const sel = selectedIndicators[indId];
      const group = container.querySelector(`[data-ind-group="${indId}"]`);

      if (sel && sel.level === newLevel) {
        // Clicking the already-active level → deselect
        delete selectedIndicators[indId];
        group?.classList.remove('indicator-group--selected');
        container.querySelector(`#level-${indId}`)
          ?.querySelectorAll('.level-btn').forEach((b) => b.classList.remove('active'));
        if (hasSub) {
          const subList = container.querySelector(`#sub-list-${indId}`);
          if (subList) {
            subList.style.display = 'none';
            subList.querySelectorAll('input').forEach((inp) => { inp.checked = false; });
          }
        }
      } else {
        // Select or switch level — preserve subs when staying in BSH/BSB
        const prevSubs = hasSub && ['BSH', 'BSB'].includes(newLevel) ? (sel?.subs || []) : [];
        selectedIndicators[indId] = { level: newLevel, subs: prevSubs };
        group?.classList.add('indicator-group--selected');

        container.querySelector(`#level-${indId}`)
          ?.querySelectorAll('.level-btn').forEach((b) => {
            b.classList.toggle('active', b.dataset.level === newLevel);
          });

        if (hasSub) {
          const subList = container.querySelector(`#sub-list-${indId}`);
          if (subList) {
            subList.style.display = ['BSH', 'BSB'].includes(newLevel) ? '' : 'none';
            if (!['BSH', 'BSB'].includes(newLevel)) {
              subList.querySelectorAll('input').forEach((inp) => { inp.checked = false; });
            }
          }
        }
      }

      updateCounter(container, selectedIndicators);
      onSelectionChange({ ...selectedIndicators });
    });
  });

  // Sub-indicator checkboxes/radios
  container.querySelectorAll('[data-sub-id]').forEach((input) => {
    input.addEventListener('change', () => {
      const parentId = input.getAttribute('data-parent');
      const subId = input.dataset.subId;
      const sel = selectedIndicators[parentId];
      if (!sel) return;

      if (input.type === 'radio') {
        sel.subs = [subId];
      } else {
        if (input.checked) {
          if (!sel.subs.includes(subId)) sel.subs.push(subId);
        } else {
          sel.subs = sel.subs.filter((s) => s !== subId);
        }
      }

      onSelectionChange({ ...selectedIndicators });
    });
  });
}

function updateCounter(container, selectedIndicators) {
  const counts = countSelected(selectedIndicators);
  const counterEl = container.querySelector('#checklist-counter');
  if (counterEl) {
    counterEl.textContent = `${counts.total} dipilih`;
  }

  // Update per-element badges
  for (const [elemId, count] of Object.entries(counts.byElement)) {
    const badge = container.querySelector(`#badge-${elemId}`);
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? '' : '';
    }
  }
}

// ============================================================
//  Nilai Plus Checklist
// ============================================================

/**
 * Render nilai-plus checklist section below the main checklist.
 * @param {HTMLElement} container - Same container as renderChecklist
 * @param {object} nilaiPlusSelected - { "np-bantu-guru-beres": true, ... }
 * @param {Function} onSelectionChange - Callback with updated selection map
 */
export function renderNilaiPlusChecklist(container, nilaiPlusSelected, onSelectionChange) {
  const kategoriList = getNilaiPlusData();
  const elementsEl = container.querySelector('#checklist-elements');
  if (!elementsEl) return;

  elementsEl.querySelector('#nilai-plus-section')?.remove();

  const totalSelected = Object.keys(nilaiPlusSelected).length;
  const section = document.createElement('div');
  section.id = 'nilai-plus-section';
  section.innerHTML = `
    <div class="kokurikuler-divider">
      <span class="kokurikuler-divider-line"></span>
      <span class="kokurikuler-divider-label">Catatan Istimewa</span>
      <span class="kokurikuler-divider-line"></span>
    </div>
    <div class="kokurikuler-header">
      <span class="kokurikuler-title">⭐ Catatan Istimewa (Nilai Plus)</span>
      <span class="kokurikuler-counter" id="nilai-plus-counter">${totalSelected} dipilih</span>
    </div>
    ${kategoriList.map((kat) => `
      <div class="accordion checklist-element" data-element="np-${kat.id}">
        <button class="accordion-header" aria-expanded="false" data-toggle="np-${kat.id}">
          <span class="accordion-icon">⭐</span>
          <span class="accordion-title">${kat.nama}</span>
          <span class="accordion-badge" id="badge-np-${kat.id}">0</span>
          <span class="accordion-chevron">▾</span>
        </button>
        <div class="accordion-content" id="content-np-${kat.id}">
          <div class="accordion-body">
            ${kat.item.map((item) => `
              <div class="indicator-group">
                <label class="check-item">
                  <input type="checkbox"
                         data-nilai-plus-id="${item.id}"
                         data-kat="${kat.id}"
                         ${nilaiPlusSelected[item.id] ? 'checked' : ''} />
                  <span class="check-label">${item.label}</span>
                </label>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `).join('')}
  `;

  elementsEl.appendChild(section);

  section.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.toggle;
      const content = section.querySelector(`#content-${id}`);
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', !expanded);
      content.classList.toggle('expanded');
    });
  });

  section.querySelectorAll('[data-nilai-plus-id]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const id = checkbox.dataset.nilaiPlusId;
      if (checkbox.checked) {
        nilaiPlusSelected[id] = true;
      } else {
        delete nilaiPlusSelected[id];
      }
      _updateNilaiPlusCounter(section, nilaiPlusSelected, kategoriList);
      onSelectionChange({ ...nilaiPlusSelected });
    });
  });

  _updateNilaiPlusCounter(section, nilaiPlusSelected, kategoriList);
}

function _updateNilaiPlusCounter(section, selected, kategoriList) {
  const total = Object.keys(selected).length;
  const counterEl = section.querySelector('#nilai-plus-counter');
  if (counterEl) counterEl.textContent = `${total} dipilih`;

  for (const kat of kategoriList) {
    const count = kat.item.filter((item) => selected[item.id]).length;
    const badge = section.querySelector(`#badge-np-${kat.id}`);
    if (badge) badge.textContent = count;
  }
}

// ============================================================
//  Saran Checklist
// ============================================================

/**
 * Render saran checklist section below nilai-plus.
 * @param {HTMLElement} container - Same container as renderChecklist
 * @param {object} saranSelected - { "saran-doa-harian-rutin": true, ... }
 * @param {Function} onSelectionChange - Callback with updated selection map
 */
export function renderSaranChecklist(container, saranSelected, onSelectionChange) {
  const kategoriList = getSaranData();
  const elementsEl = container.querySelector('#checklist-elements');
  if (!elementsEl) return;

  elementsEl.querySelector('#saran-section')?.remove();

  const totalSelected = Object.keys(saranSelected).length;
  const section = document.createElement('div');
  section.id = 'saran-section';
  section.innerHTML = `
    <div class="kokurikuler-divider">
      <span class="kokurikuler-divider-line"></span>
      <span class="kokurikuler-divider-label">Saran untuk Orang Tua</span>
      <span class="kokurikuler-divider-line"></span>
    </div>
    <div class="kokurikuler-header">
      <span class="kokurikuler-title">💡 Saran Pengembangan</span>
      <span class="kokurikuler-counter" id="saran-counter">${totalSelected} dipilih</span>
    </div>
    ${kategoriList.map((kat) => `
      <div class="accordion checklist-element" data-element="sr-${kat.id}">
        <button class="accordion-header" aria-expanded="false" data-toggle="sr-${kat.id}">
          <span class="accordion-icon">💡</span>
          <span class="accordion-title">${kat.nama}</span>
          <span class="accordion-badge" id="badge-sr-${kat.id}">0</span>
          <span class="accordion-chevron">▾</span>
        </button>
        <div class="accordion-content" id="content-sr-${kat.id}">
          <div class="accordion-body">
            ${kat.item.map((item) => `
              <div class="indicator-group">
                <label class="check-item">
                  <input type="checkbox"
                         data-saran-id="${item.id}"
                         data-kat="${kat.id}"
                         ${saranSelected[item.id] ? 'checked' : ''} />
                  <span class="check-label">${item.label}</span>
                </label>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `).join('')}
  `;

  elementsEl.appendChild(section);

  section.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.toggle;
      const content = section.querySelector(`#content-${id}`);
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', !expanded);
      content.classList.toggle('expanded');
    });
  });

  section.querySelectorAll('[data-saran-id]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const id = checkbox.dataset.saranId;
      if (checkbox.checked) {
        saranSelected[id] = true;
      } else {
        delete saranSelected[id];
      }
      _updateSaranCounter(section, saranSelected, kategoriList);
      onSelectionChange({ ...saranSelected });
    });
  });

  _updateSaranCounter(section, saranSelected, kategoriList);
}

function _updateSaranCounter(section, selected, kategoriList) {
  const total = Object.keys(selected).length;
  const counterEl = section.querySelector('#saran-counter');
  if (counterEl) counterEl.textContent = `${total} dipilih`;

  for (const kat of kategoriList) {
    const count = kat.item.filter((item) => selected[item.id]).length;
    const badge = section.querySelector(`#badge-sr-${kat.id}`);
    if (badge) badge.textContent = count;
  }
}

function setupLevelBtnTooltips(container) {
  let tip = document.getElementById('level-btn-tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'level-btn-tooltip';
    tip.style.cssText = [
      'position:fixed',
      'background:#1a1a1a',
      'color:#fff',
      'font-size:10px',
      'font-weight:500',
      'padding:3px 8px',
      'border-radius:5px',
      'pointer-events:none',
      'white-space:nowrap',
      'z-index:9999',
      'opacity:0',
      'transition:opacity 0.15s',
    ].join(';');
    document.body.appendChild(tip);
  }

  container.querySelectorAll('.level-btn[data-tooltip]').forEach((btn) => {
    btn.addEventListener('mouseenter', () => {
      tip.textContent = btn.dataset.tooltip;
      const r = btn.getBoundingClientRect();
      tip.style.left = `${r.left + r.width / 2}px`;
      tip.style.top = `${r.top - 8}px`;
      tip.style.transform = 'translateX(-50%) translateY(-100%)';
      tip.style.opacity = '1';
    });
    btn.addEventListener('mouseleave', () => { tip.style.opacity = '0'; });
  });
}

function addChecklistStyles(container) {
  if (document.querySelector('#checklist-styles')) return;
  const style = document.createElement('style');
  style.id = 'checklist-styles';
  style.textContent = `
    .checklist-container { }
    .checklist-header {
      display: flex; align-items: center; flex-wrap: wrap;
      gap: var(--space-2);
      margin-bottom: var(--space-4);
    }
    .checklist-title { font-size: var(--font-size-lg); font-weight: 700; margin-right: auto; }
    .checklist-counter {
      font-size: var(--font-size-sm); font-weight: 600;
      color: var(--primary); background: var(--primary-light);
      padding: var(--space-1) var(--space-3); border-radius: var(--radius-full);
    }
    .sub-elemen-group {
      border-bottom: 1px solid var(--border-light);
      padding-bottom: var(--space-2);
      margin-bottom: var(--space-2);
    }
    .sub-elemen-group:last-child { border-bottom: none; margin-bottom: 0; }
    .sub-elemen-header {
      display: flex; align-items: center; justify-content: space-between;
      width: 100%; padding: var(--space-3) var(--space-2);
      background: none; border: none; cursor: pointer;
      font-weight: 600; font-size: var(--font-size-sm);
      color: var(--text-secondary); text-align: left;
      transition: color var(--transition-fast);
    }
    .sub-elemen-header:hover { color: var(--primary); }
    .sub-elemen-header[aria-expanded="true"] .sub-chevron { transform: rotate(180deg); }
    .sub-elemen-content {
      max-height: 0; overflow: hidden;
      transition: max-height var(--transition-slow);
    }
    .sub-elemen-content.expanded { max-height: 9999px; }
    .sub-chevron {
      font-size: var(--font-size-sm); transition: transform var(--transition-base);
      color: var(--text-tertiary);
    }
    .indicator-group { margin-bottom: var(--space-1); }
    .indicator-group--parent { margin-bottom: var(--space-2); }
    .check-item--parent {
      background: var(--bg-page);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-md);
      padding: var(--space-2) var(--space-3);
      position: relative;
    }
    .check-item--parent .check-label {
      font-weight: 600;
    }
    .check-expand-hint {
      display: inline-flex;
      align-items: center;
      margin-left: auto;
      color: var(--text-tertiary);
      transition: transform var(--transition-base);
      flex-shrink: 0;
    }
    .check-item--parent input:checked ~ .check-expand-hint {
      transform: rotate(180deg);
      color: var(--primary);
    }
    .level-selector {
      display: flex;
      gap: 4px;
      margin: 4px 0 4px 24px;
      flex-wrap: wrap;
    }
    .level-selector--inline {
      margin: 0;
      flex-shrink: 0;
    }
    .level-btn {
      padding: 2px 8px;
      border-radius: 10px;
      border: 1px solid var(--border-light);
      background: var(--bg-secondary);
      color: var(--text-secondary);
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s;
      line-height: 1.6;
      letter-spacing: 0.02em;
    }
    .level-btn:hover { border-color: var(--primary); color: var(--primary); }
    .level-btn.active {
      background: var(--primary);
      border-color: var(--primary);
      color: white;
    }
    /* Level-specific colors — subtle default, stronger on hover/active */
    .level-btn[data-level="BB"]               { border-color: #fca5a5; color: #f87171; }
    .level-btn[data-level="BB"]:hover         { background: #fee2e2; border-color: #f87171; color: #dc2626; }
    .level-btn[data-level="BB"].active        { background: #fecaca; border-color: #ef4444; color: #b91c1c; }

    .level-btn[data-level="MB"]               { border-color: #fcd34d; color: #f59e0b; }
    .level-btn[data-level="MB"]:hover         { background: #fef3c7; border-color: #fbbf24; color: #d97706; }
    .level-btn[data-level="MB"].active        { background: #fde68a; border-color: #f59e0b; color: #92400e; }

    .level-btn[data-level="BSH"]              { border-color: #5eead4; color: #0d9488; }
    .level-btn[data-level="BSH"]:hover        { background: #f0fdfa; border-color: #2dd4bf; color: #0f766e; }
    .level-btn[data-level="BSH"].active       { background: #ccfbf1; border-color: #14b8a6; color: #0f766e; }

    .level-btn[data-level="BSB"]              { border-color: #86efac; color: #22c55e; }
    .level-btn[data-level="BSB"]:hover        { background: #f0fdf4; border-color: #4ade80; color: #16a34a; }
    .level-btn[data-level="BSB"].active       { background: #bbf7d0; border-color: #22c55e; color: #15803d; }
    .ind-level-row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-md);
      background: var(--bg-page);
      transition: border-color 0.15s, background 0.15s;
      cursor: default;
    }
    .ind-label {
      font-weight: 600;
      font-size: var(--font-size-sm);
      flex: 1;
      min-width: 0;
      color: var(--text-primary);
    }
    .indicator-group--selected .ind-level-row {
      border-color: var(--primary);
      background: var(--primary-light);
    }
    .indicator-group--selected .ind-label {
      color: var(--primary);
    }
  `;
  document.head.appendChild(style);
}

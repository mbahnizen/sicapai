/**
 * Checklist Component — 4-level progressive disclosure accordion
 * Level 1: Elemen (tab/card)
 * Level 2: Sub-Elemen (accordion)
 * Level 3: Indikator (checkbox)
 * Level 4: Sub-Indikator (nested checkbox/radio)
 */

import { getChecklistStructure, countSelected, getKokurikulerData, countKokurikulerSelected } from '../../services/template-engine.js';

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
      <span class="kokurikuler-title">🎯 Profil Lulusan (P5)</span>
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
    #kokurikuler-section .accordion-header {
      border-left: 3px solid var(--secondary);
    }
  `;
  document.head.appendChild(s);
}

function renderIndicator(ind, selectedIndicators) {
  const isSelected = !!selectedIndicators[ind.id];
  const selectedSubs = Array.isArray(selectedIndicators[ind.id]) ? selectedIndicators[ind.id] : [];

  let subHTML = '';
  if (ind.hasSub && ind.subIndikator.length > 0) {
    const inputType = ind.isMutuallyExclusive ? 'radio' : 'checkbox';
    subHTML = `
      <div class="check-sub-list" id="sub-list-${ind.id}" style="${isSelected ? '' : 'display:none'}">
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
    `;
  }

  const parentClass = ind.hasSub ? ' check-item--parent' : '';
  const expandHint = ind.hasSub ? `<span class="check-expand-hint">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
  </span>` : '';

  return `
    <div class="indicator-group${ind.hasSub ? ' indicator-group--parent' : ''}">
      <label class="check-item${parentClass}">
        <input type="checkbox" 
               data-indicator-id="${ind.id}" 
               data-has-sub="${ind.hasSub}"
               ${isSelected ? 'checked' : ''} />
        <span class="check-label">${ind.label}</span>
        ${expandHint}
      </label>
      ${subHTML}
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
  // Main indicator checkboxes
  container.querySelectorAll('[data-indicator-id]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const id = checkbox.dataset.indicatorId;
      const hasSub = checkbox.dataset.hasSub === 'true';

      if (checkbox.checked) {
        if (hasSub) {
          selectedIndicators[id] = [];
          // Show sub-indicators
          const subList = container.querySelector(`#sub-list-${id}`);
          if (subList) subList.style.display = '';
        } else {
          selectedIndicators[id] = true;
        }
      } else {
        delete selectedIndicators[id];
        // Hide & uncheck sub-indicators
        const subList = container.querySelector(`#sub-list-${id}`);
        if (subList) {
          subList.style.display = 'none';
          subList.querySelectorAll('input').forEach((inp) => { inp.checked = false; });
        }
      }

      updateCounter(container, selectedIndicators);
      onSelectionChange({ ...selectedIndicators });
    });
  });

  // Sub-indicator checkboxes/radios
  container.querySelectorAll('[data-sub-id]').forEach((input) => {
    input.addEventListener('change', () => {
      const parentId = input.dataset.parentId || input.getAttribute('data-parent');
      const subId = input.dataset.subId;

      if (!selectedIndicators[parentId]) {
        selectedIndicators[parentId] = [];
      }

      if (input.type === 'radio') {
        // Radio: only one selected
        selectedIndicators[parentId] = [subId];
      } else {
        // Checkbox: toggle
        const arr = selectedIndicators[parentId];
        if (input.checked) {
          if (!arr.includes(subId)) arr.push(subId);
        } else {
          const idx = arr.indexOf(subId);
          if (idx > -1) arr.splice(idx, 1);
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
  `;
  document.head.appendChild(style);
}

// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';
import { renderChecklist } from '../src/components/report/checklist.js';

describe('Checklist Component (Rendered DOM)', () => {
  const sampleStudent = {
    id: 'std-1',
    name: 'Budi Santoso',
    nickname: 'Budi',
    ageGroup: 'B (5-6 tahun)',
    religion: 'Islam',
    gender: 'L',
  };

  it('renders ang-1-10 and ang-1-20 as radio inputs and additive sub-indicators as checkboxes', () => {
    const container = document.createElement('div');
    const selectedIndicators = {
      'mengenal-angka': {
        level: 'BSH',
        subs: ['ang-1-10', 'ang-tulis', 'ang-urutan', 'ang-mundur'],
      },
    };
    const onSelectionChange = vi.fn();

    renderChecklist(container, sampleStudent, selectedIndicators, onSelectionChange);

    const ang1_10 = container.querySelector('input[data-sub-id="ang-1-10"]');
    const ang1_20 = container.querySelector('input[data-sub-id="ang-1-20"]');
    const angTulis = container.querySelector('input[data-sub-id="ang-tulis"]');
    const angUrutan = container.querySelector('input[data-sub-id="ang-urutan"]');
    const angMundur = container.querySelector('input[data-sub-id="ang-mundur"]');

    expect(ang1_10).not.toBeNull();
    expect(ang1_20).not.toBeNull();
    expect(angTulis).not.toBeNull();
    expect(angUrutan).not.toBeNull();
    expect(angMundur).not.toBeNull();

    expect(ang1_10.type).toBe('radio');
    expect(ang1_20.type).toBe('radio');
    expect(ang1_10.name).toBe('radio-mengenal-angka-range-angka');
    expect(ang1_20.name).toBe('radio-mengenal-angka-range-angka');

    expect(angTulis.type).toBe('checkbox');
    expect(angUrutan.type).toBe('checkbox');
    expect(angMundur.type).toBe('checkbox');

    expect(ang1_10.checked).toBe(true);
    expect(ang1_20.checked).toBe(false);
    expect(angTulis.checked).toBe(true);
    expect(angUrutan.checked).toBe(true);
    expect(angMundur.checked).toBe(true);
  });

  it('yields ang-1-20 plus all three additive subs and clears ang-1-10 when dispatching change on ang-1-20', () => {
    const container = document.createElement('div');
    const selectedIndicators = {
      'mengenal-angka': {
        level: 'BSH',
        subs: ['ang-1-10', 'ang-tulis', 'ang-urutan', 'ang-mundur'],
      },
    };
    let latestSelection = null;
    const onSelectionChange = vi.fn((newSel) => {
      latestSelection = newSel;
    });

    renderChecklist(container, sampleStudent, selectedIndicators, onSelectionChange);

    const ang1_20 = container.querySelector('input[data-sub-id="ang-1-20"]');
    expect(ang1_20).not.toBeNull();

    // Select ang-1-20 radio
    ang1_20.checked = true;
    ang1_20.dispatchEvent(new Event('change', { bubbles: true }));

    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(latestSelection).not.toBeNull();
    expect(latestSelection['mengenal-angka'].subs).toEqual([
      'ang-tulis',
      'ang-urutan',
      'ang-mundur',
      'ang-1-20',
    ]);
    expect(latestSelection['mengenal-angka'].subs).not.toContain('ang-1-10');
  });

  it('unchecking one additive checkbox removes only that sub and leaves others intact', () => {
    const container = document.createElement('div');
    const selectedIndicators = {
      'mengenal-angka': {
        level: 'BSH',
        subs: ['ang-1-10', 'ang-tulis', 'ang-urutan', 'ang-mundur'],
      },
    };
    let latestSelection = null;
    const onSelectionChange = vi.fn((newSel) => {
      latestSelection = newSel;
    });

    renderChecklist(container, sampleStudent, selectedIndicators, onSelectionChange);

    const angTulis = container.querySelector('input[data-sub-id="ang-tulis"]');
    expect(angTulis).not.toBeNull();
    expect(angTulis.checked).toBe(true);

    // Uncheck ang-tulis
    angTulis.checked = false;
    angTulis.dispatchEvent(new Event('change', { bubbles: true }));

    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(latestSelection['mengenal-angka'].subs).toEqual([
      'ang-1-10',
      'ang-urutan',
      'ang-mundur',
    ]);
    expect(latestSelection['mengenal-angka'].subs).not.toContain('ang-tulis');
  });

  it('renders only gi-kebaktian under gerakan-ibadah for a Christian student', () => {
    const container = document.createElement('div');
    const christianStudent = {
      ...sampleStudent,
      religion: 'kristen',
    };
    const selectedIndicators = {
      'gerakan-ibadah': {
        level: 'BSH',
        subs: ['gi-kebaktian'],
      },
    };
    const onSelectionChange = vi.fn();

    renderChecklist(container, christianStudent, selectedIndicators, onSelectionChange);

    const gerakanSubs = container.querySelectorAll(
      'input[data-parent="gerakan-ibadah"]'
    );
    expect(gerakanSubs).toHaveLength(1);

    const renderedSubIds = Array.from(gerakanSubs).map((i) => i.dataset.subId);
    expect(renderedSubIds).toEqual(['gi-kebaktian']);
    expect(container.querySelector('input[data-sub-id="gi-sholat"]')).toBeNull();
    expect(container.querySelector('input[data-sub-id="gi-sembahyang-hindu"]')).toBeNull();
    expect(container.querySelector('input[data-sub-id="gi-sembahyang-buddha"]')).toBeNull();
    expect(container.querySelector('input[data-sub-id="gi-sembahyang-konghucu"]')).toBeNull();
  });
});

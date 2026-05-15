/**
 * Template Engine — Client-side narrative concatenation
 *
 * Transforms selected indicator checkboxes into cohesive template paragraphs.
 * This runs entirely on the client — no backend call needed.
 */

import kurikulumData from '../data/kurikulum.json';

/**
 * Get all curriculum elements
 * @returns {Array} elemen array from kurikulum data
 */
export function getKurikulumData() {
  return kurikulumData.elemen;
}

/**
 * Get metadata
 * @returns {object} _meta object
 */
export function getKurikulumMeta() {
  return kurikulumData._meta;
}

/**
 * Generate narrative template from selected indicators
 *
 * @param {string} studentName - Nama anak (e.g., "Aisyah")
 * @param {object} selectedIndicators - Map of indicator selections
 *   Format: { "indikator-id": true | ["sub-id-1", "sub-id-2"] }
 *   - true = indicator selected (no sub-indicators)
 *   - array of sub-indicator IDs = indicator selected with specific sub-indicators
 * @param {string} [religion] - Agama anak untuk filter gerakan-ibadah
 * @returns {object} Map of elemen ID → narrative paragraph
 *   e.g., { "agama-budi-pekerti": "Ananda Aisyah sudah mampu...", ... }
 */
export function generateTemplate(studentName, selectedIndicators, religion = null) {
  const result = {};
  const elements = kurikulumData.elemen;

  for (const elemen of elements) {
    const subParas = [];

    for (const subElemen of elemen.sub_elemen) {
      const sentences = [];

      for (const indikator of subElemen.indikator) {
        const selection = selectedIndicators[indikator.id];
        if (!selection) continue;

        let sentence = '';

        if (!indikator.has_sub || selection === true) {
          sentence = indikator.template;
        } else if (Array.isArray(selection) && selection.length > 0) {
          const selectedSubs = indikator.sub_indikator.filter((sub) =>
            selection.includes(sub.id)
          );
          if (selectedSubs.length > 0) {
            const subTemplates = selectedSubs.map((sub) => sub.template);
            sentence = indikator.template + ', ' + subTemplates.join(', ');
          }
        }

        if (sentence) sentences.push(sentence);
      }

      if (sentences.length > 0) {
        subParas.push(buildParagraph(studentName, sentences));
      }
    }

    if (subParas.length > 0) {
      result[elemen.id] = subParas.join('\n\n');
    }
  }

  return result;
}

/**
 * Build a cohesive paragraph from an array of sentence fragments
 *
 * @param {string} studentName - Nama anak
 * @param {string[]} sentences - Array of template sentence fragments
 * @returns {string} Complete narrative paragraph
 */
function buildParagraph(studentName, sentences) {
  if (sentences.length === 0) return '';

  const prefix = `Ananda ${studentName} `;

  if (sentences.length === 1) {
    return prefix + sentences[0] + '.';
  }

  if (sentences.length === 2) {
    return prefix + sentences[0] + '. Selain itu, Ananda juga ' + sentences[1] + '.';
  }

  // 3+ sentences: group them naturally
  let paragraph = prefix + sentences[0] + '.';

  const connectors = [
    ' Selain itu, Ananda juga ',
    ' Di samping itu, Ananda ',
    ' Ananda juga ',
    ' Tak hanya itu, Ananda pun ',
    ' Hal yang membanggakan, Ananda ',
  ];

  for (let i = 1; i < sentences.length; i++) {
    const connector = connectors[(i - 1) % connectors.length];
    paragraph += connector + sentences[i] + '.';
  }

  return paragraph;
}

/**
 * Get all elements as flat structure for UI rendering
 *
 * @param {string} [religion] - Optional religion filter for gerakan-ibadah
 * @returns {Array} Flat array of elements with nested structure for UI
 */
export function getChecklistStructure(religion = null) {
  const elements = kurikulumData.elemen;

  return elements.map((elemen) => ({
    id: elemen.id,
    nama: elemen.nama,
    deskripsi: elemen.deskripsi,
    subElemen: elemen.sub_elemen.map((sub) => ({
      id: sub.id,
      nama: sub.nama,
      indikator: sub.indikator.map((ind) => {
        let subIndikator = ind.sub_indikator || [];

        // Filter religion-specific sub-indicators
        if (ind.id === 'gerakan-ibadah' && religion) {
          const religionMap = {
            islam: 'gi-sholat',
            kristen: 'gi-kebaktian',
            katolik: 'gi-kebaktian',
            hindu: 'gi-sembahyang-hindu',
            buddha: 'gi-sembahyang-buddha',
          };
          const matchId = religionMap[religion.toLowerCase()];
          if (matchId) {
            subIndikator = subIndikator.filter((s) => s.id === matchId);
          }
        }

        // Determine if radio button should be used (mutually exclusive)
        const isMutuallyExclusive =
          ind.id === 'mengenal-angka' &&
          subIndikator.some((s) => s.id === 'ang-1-10' || s.id === 'ang-1-20');

        return {
          id: ind.id,
          label: ind.label,
          hasSub: ind.has_sub,
          isMutuallyExclusive,
          subIndikator: subIndikator.map((s) => ({
            id: s.id,
            label: s.label,
          })),
        };
      }),
    })),
  }));
}

/**
 * Count selected indicators
 * @param {object} selectedIndicators - The selection map
 * @returns {{ total: number, byElement: object }}
 */
export function countSelected(selectedIndicators) {
  const byElement = {};
  let total = 0;

  const elements = kurikulumData.elemen;
  for (const elemen of elements) {
    let count = 0;
    for (const subElemen of elemen.sub_elemen) {
      for (const indikator of subElemen.indikator) {
        if (selectedIndicators[indikator.id]) {
          count++;
          total++;
        }
      }
    }
    byElement[elemen.id] = count;
  }

  return { total, byElement };
}

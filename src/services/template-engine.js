/**
 * Template Engine — Client-side narrative concatenation
 *
 * Transforms selected indicator checkboxes into cohesive template paragraphs.
 * This runs entirely on the client — no backend call needed.
 */

import agamaData from '../data/kurikulum-agama.json';
import jatiDiriData from '../data/kurikulum-jati-diri.json';
import literasiData from '../data/kurikulum-literasi-steam.json';
import kokurikulerData from '../data/kokurikuler.json';
import nilaiPlusData from '../data/nilai-plus.json';
import saranData from '../data/saran.json';

const kurikulumElements = [agamaData.elemen, jatiDiriData.elemen, literasiData.elemen];

/**
 * Get all curriculum elements
 * @returns {Array} array of elemen objects
 */
export function getKurikulumData() {
  return kurikulumElements;
}

/**
 * Generate narrative template from selected indicators
 *
 * @param {string} studentName - Nama anak (e.g., "Aisyah")
 * @param {object} selectedIndicators - Map of indicator selections
 *   Format v2: { "indikator-id": { level: "BSH", subs: ["sub-id-1"] } }
 * @param {string} [religion] - Agama anak untuk filter gerakan-ibadah
 * @returns {object} Map of elemen ID → narrative paragraph
 */
export function generateTemplate(studentName, selectedIndicators, religion = null) {
  const result = {};

  for (const elemen of kurikulumElements) {
    const subParas = [];

    for (const subElemen of elemen.sub_elemen) {
      const sentences = [];

      for (const indikator of subElemen.indikator) {
        const selection = selectedIndicators[indikator.id];
        if (!selection) continue;

        const level = selection.level || 'BSH';
        const template = indikator.level_templates?.[level];
        if (!template) continue;

        let sentence = template;

        // Sub-indicators only rendered for BSH or BSB
        if (indikator.has_sub && ['BSH', 'BSB'].includes(level) && selection.subs?.length > 0) {
          const selectedSubs = indikator.sub_indikator.filter((sub) =>
            selection.subs.includes(sub.id)
          );
          if (selectedSubs.length > 0) {
            const subParts = selectedSubs.map((sub) => sub.template);
            // Ensure first sub has a connector; JSON embeds "seperti/serta/dan" only on
            // certain subs, so if the first selected sub lacks one, inject "seperti".
            if (!/^(seperti|serta|dan)\s/i.test(subParts[0])) {
              subParts[0] = 'seperti ' + subParts[0];
            }
            sentence = template + ', ' + subParts.join(', ');
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
  return kurikulumElements.map((elemen) => ({
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
            konghucu: 'gi-sembahyang-konghucu',
          };
          const matchId = religionMap[religion.toLowerCase()];
          if (matchId) {
            subIndikator = subIndikator.filter((s) => s.id === matchId);
          }
        }

        // Mutually exclusive sub-indicators (ang-1-10 / ang-1-20)
        const isMutuallyExclusive =
          ind.id === 'mengenal-angka' &&
          subIndikator.some((s) => s.id === 'ang-1-10' || s.id === 'ang-1-20');

        return {
          id: ind.id,
          label: ind.label,
          hasSub: ind.has_sub,
          isMutuallyExclusive,
          levelTemplates: ind.level_templates || {},
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
 * @param {object} selectedIndicators - The selection map (v2 format)
 * @returns {{ total: number, byElement: object }}
 */
export function countSelected(selectedIndicators) {
  const byElement = {};
  let total = 0;

  for (const elemen of kurikulumElements) {
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

// ---- Nilai Plus Functions ----

/**
 * Get nilai-plus categories for UI
 * @returns {Array} kategori array
 */
export function getNilaiPlusData() {
  return nilaiPlusData.kategori;
}

/**
 * Generate nilai-plus narrative from selected items
 * @param {string} studentName
 * @param {object} nilaiPlusSelected - { "np-bantu-guru-beres": true, ... }
 * @returns {string} Narrative paragraph or ''
 */
export function generateNilaiPlusNarrative(studentName, nilaiPlusSelected) {
  if (!nilaiPlusSelected || Object.keys(nilaiPlusSelected).length === 0) return '';

  const sentences = [];
  for (const kategori of nilaiPlusData.kategori) {
    for (const item of kategori.item) {
      if (nilaiPlusSelected[item.id]) {
        sentences.push(item.template);
      }
    }
  }

  if (sentences.length === 0) return '';
  return sentences.map((s) => `Ananda ${studentName} ${s}.`).join('\n');
}

// ---- Saran Functions ----

/**
 * Get saran categories for UI
 * @returns {Array} kategori array
 */
export function getSaranData() {
  return saranData.kategori;
}

/**
 * Generate saran narrative from selected items
 * @param {string} studentName
 * @param {object} saranSelected - { "saran-doa-harian-rutin": true, ... }
 * @returns {string} Narrative paragraph or ''
 */
export function generateSaranNarrative(studentName, saranSelected) {
  if (!saranSelected || Object.keys(saranSelected).length === 0) return '';

  const sentences = [];
  for (const kategori of saranData.kategori) {
    for (const item of kategori.item) {
      if (saranSelected[item.id]) {
        sentences.push(item.template);
      }
    }
  }

  if (sentences.length === 0) return '';
  return sentences.map((s) => `Kami harapkan ${studentName} ${s}.`).join('\n');
}

// ---- Kokurikuler Functions ----

/**
 * Get kokurikuler data
 * @returns {Array} dimensi array from kokurikuler data
 */
export function getKokurikulerData() {
  return kokurikulerData.dimensi;
}

/**
 * Generate combined kokurikuler narrative from selected indicators.
 *
 * @param {string} studentName - Nama panggilan anak
 * @param {object} selectedIndicators - Map { "kk-ibadah-mandiri": true, ... }
 * @returns {string} Single combined narrative paragraph, or '' if nothing selected
 */
export function generateKokurikulerNarrative(studentName, selectedIndicators) {
  if (!selectedIndicators || Object.keys(selectedIndicators).length === 0) return '';

  const dimensiSentences = [];

  for (const dimensi of kokurikulerData.dimensi) {
    const sentences = [];
    for (const ind of dimensi.indikator) {
      if (selectedIndicators[ind.id]) {
        sentences.push(ind.template);
      }
    }
    if (sentences.length > 0) {
      dimensiSentences.push(sentences.join(', serta '));
    }
  }

  if (dimensiSentences.length === 0) return '';

  const prefix = `Ananda ${studentName} `;
  return dimensiSentences.map((s) => prefix + s + '.').join('\n\n');
}

/**
 * Count selected kokurikuler indicators
 * @param {object} selectedIndicators - Map { "kk-ibadah-mandiri": true, ... }
 * @returns {{ total: number, byDimensi: object }}
 */
export function countKokurikulerSelected(selectedIndicators) {
  const byDimensi = {};
  let total = 0;

  for (const dimensi of kokurikulerData.dimensi) {
    let count = 0;
    for (const ind of dimensi.indikator) {
      if (selectedIndicators?.[ind.id]) {
        count++;
        total++;
      }
    }
    byDimensi[dimensi.id] = count;
  }

  return { total, byDimensi };
}

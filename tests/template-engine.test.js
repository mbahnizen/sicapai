import { describe, it, expect } from 'vitest';
import {
  getKurikulumData,
  generateTemplate,
  getChecklistStructure,
  toggleSubSelection,
  countSelected,
  getNilaiPlusData,
  generateNilaiPlusNarrative,
  getSaranData,
  generateSaranNarrative,
  getKokurikulerData,
  generateKokurikulerNarrative,
  countKokurikulerSelected,
} from '../src/services/template-engine.js';

import agamaData from '../src/data/kurikulum-agama.json';
import jatiDiriData from '../src/data/kurikulum-jati-diri.json';
import literasiData from '../src/data/kurikulum-literasi-steam.json';
import kokurikulerData from '../src/data/kokurikuler.json';
import nilaiPlusData from '../src/data/nilai-plus.json';
import saranData from '../src/data/saran.json';

describe('Template Engine', () => {
  describe('getKurikulumData', () => {
    it('returns the three main curriculum elements in expected order', () => {
      const data = getKurikulumData();
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(3);
      expect(data.map((e) => e.id)).toEqual([
        'agama-budi-pekerti',
        'jati-diri',
        'literasi-steam',
      ]);
    });

    it('contains valid nested sub_elemen and indikator objects with required fields', () => {
      const data = getKurikulumData();
      for (const element of data) {
        expect(element.id).toBeDefined();
        expect(element.nama).toBeDefined();
        expect(element.deskripsi).toBeDefined();
        expect(Array.isArray(element.sub_elemen)).toBe(true);
        expect(element.sub_elemen.length).toBeGreaterThan(0);

        for (const sub of element.sub_elemen) {
          expect(sub.id).toBeDefined();
          expect(sub.nama).toBeDefined();
          expect(Array.isArray(sub.indikator)).toBe(true);
          expect(sub.indikator.length).toBeGreaterThan(0);

          for (const ind of sub.indikator) {
            expect(ind.id).toBeDefined();
            expect(ind.label).toBeDefined();
            expect(ind.level_templates).toBeDefined();
            expect(ind.level_templates.BSH).toBeDefined();
          }
        }
      }
    });
  });

  describe('generateTemplate', () => {
    describe('Empty and boundary inputs', () => {
      it('returns empty object when selectedIndicators is empty', () => {
        expect(generateTemplate('Aisyah', {})).toEqual({});
      });

      it('returns empty object when selectedIndicators contains only unknown indicator IDs', () => {
        const result = generateTemplate('Aisyah', {
          'unknown-ind-1': { level: 'BSH' },
          'unknown-ind-2': { level: 'BSB', subs: ['sub-1'] },
        });
        expect(result).toEqual({});
      });

      it('returns empty object when indicator selections are falsy or null', () => {
        const result = generateTemplate('Aisyah', {
          'doa-harian': null,
          'mengenal-angka': false,
          'berjalan-berlari': undefined,
        });
        expect(result).toEqual({});
      });

      it('ignores indicators with unknown or missing level templates', () => {
        const result = generateTemplate('Aisyah', {
          'doa-harian': { level: 'NON_EXISTENT_LEVEL' },
        });
        expect(result).toEqual({});
      });

      it('formats student name properly even with special characters or extra whitespace', () => {
        const result = generateTemplate("M. Nur Syahputra-Al'Attas", {
          'kitab-suci': { level: 'BSH' },
        });
        expect(result['agama-budi-pekerti']).toBe(
          "Ananda M. Nur Syahputra-Al'Attas mengenal kitab suci agamanya dan memperlakukannya dengan penuh rasa hormat."
        );
      });
    });

    describe('Level handling (BB, MB, BSH, BSB)', () => {
      it('defaults to BSH template when level is not explicitly specified in selection', () => {
        const result = generateTemplate('Budi', {
          'kitab-suci': {},
        });
        const expected =
          'Ananda Budi ' +
          agamaData.elemen.sub_elemen[0].indikator.find((i) => i.id === 'kitab-suci')
            .level_templates.BSH +
          '.';
        expect(result['agama-budi-pekerti']).toBe(expected);
      });

      it('generates correct narrative for level BB', () => {
        const result = generateTemplate('Budi', {
          'kitab-suci': { level: 'BB' },
        });
        expect(result['agama-budi-pekerti']).toBe(
          'Ananda Budi belum terlihat mengenal atau memperlakukan kitab suci agamanya secara khusus.'
        );
      });

      it('generates correct narrative for level MB', () => {
        const result = generateTemplate('Budi', {
          'kitab-suci': { level: 'MB' },
        });
        expect(result['agama-budi-pekerti']).toBe(
          'Ananda Budi mulai mengenal kitab suci agamanya dan belajar memperlakukannya dengan rasa hormat.'
        );
      });

      it('generates correct narrative for level BSH', () => {
        const result = generateTemplate('Budi', {
          'kitab-suci': { level: 'BSH' },
        });
        expect(result['agama-budi-pekerti']).toBe(
          'Ananda Budi mengenal kitab suci agamanya dan memperlakukannya dengan penuh rasa hormat.'
        );
      });

      it('generates correct narrative for level BSB', () => {
        const result = generateTemplate('Budi', {
          'kitab-suci': { level: 'BSB' },
        });
        expect(result['agama-budi-pekerti']).toBe(
          'Ananda Budi sangat mengenal kitab suci agamanya, memperlakukannya dengan penuh hormat dan kebanggaan, serta dengan antusias menceritakannya kepada teman.'
        );
      });

      it('does NOT append sub-indicators when level is BB, even if subs are provided', () => {
        const result = generateTemplate('Aisyah', {
          'doa-harian': { level: 'BB', subs: ['doa-makan', 'doa-tidur'] },
        });
        expect(result['agama-budi-pekerti']).toBe(
          'Ananda Aisyah belum terlihat secara konsisten melafalkan doa harian secara mandiri.'
        );
      });

      it('does NOT append sub-indicators when level is MB, even if subs are provided', () => {
        const result = generateTemplate('Aisyah', {
          'doa-harian': { level: 'MB', subs: ['doa-makan', 'doa-tidur'] },
        });
        expect(result['agama-budi-pekerti']).toBe(
          'Ananda Aisyah mulai dapat melafalkan beberapa doa harian, meski masih memerlukan bimbingan guru.'
        );
      });

      it('appends sub-indicators when level is BSH', () => {
        const result = generateTemplate('Aisyah', {
          'doa-harian': { level: 'BSH', subs: ['doa-makan'] },
        });
        expect(result['agama-budi-pekerti']).toBe(
          'Ananda Aisyah sudah mampu melafalkan beberapa doa harian dengan baik, seperti doa sebelum dan sesudah makan.'
        );
      });

      it('appends sub-indicators when level is BSB', () => {
        const result = generateTemplate('Aisyah', {
          'doa-harian': { level: 'BSB', subs: ['doa-makan'] },
        });
        expect(result['agama-budi-pekerti']).toBe(
          'Ananda Aisyah dengan sangat fasih melafalkan berbagai doa harian dan dengan senang hati membantu teman-temannya mengingat doa, seperti doa sebelum dan sesudah makan.'
        );
      });
    });

    describe('Sub-indicator connector injection and joining', () => {
      it('does not append anything when indicator has_sub is false despite subs array', () => {
        const result = generateTemplate('Budi', {
          'kitab-suci': { level: 'BSH', subs: ['nonexistent-sub'] },
        });
        expect(result['agama-budi-pekerti']).toBe(
          'Ananda Budi mengenal kitab suci agamanya dan memperlakukannya dengan penuh rasa hormat.'
        );
      });

      it('renders base template without trailing comma when subs array is empty', () => {
        const result = generateTemplate('Budi', {
          'doa-harian': { level: 'BSH', subs: [] },
        });
        expect(result['agama-budi-pekerti']).toBe(
          'Ananda Budi sudah mampu melafalkan beberapa doa harian dengan baik.'
        );
      });

      it('renders base template without trailing comma when none of the subs match valid sub-indicator IDs', () => {
        const result = generateTemplate('Budi', {
          'doa-harian': { level: 'BSH', subs: ['invalid-sub-1', 'invalid-sub-2'] },
        });
        expect(result['agama-budi-pekerti']).toBe(
          'Ananda Budi sudah mampu melafalkan beberapa doa harian dengan baik.'
        );
      });

      it('preserves existing "seperti" connector if first sub already starts with "seperti"', () => {
        const result = generateTemplate('Aisyah', {
          'doa-harian': { level: 'BSH', subs: ['doa-makan'] },
        });
        expect(result['agama-budi-pekerti']).toContain(
          'sudah mampu melafalkan beberapa doa harian dengan baik, seperti doa sebelum dan sesudah makan.'
        );
        expect(result['agama-budi-pekerti']).not.toContain('seperti seperti');
      });

      it('preserves existing "serta" connector if first sub already starts with "serta"', () => {
        const result = generateTemplate('Aisyah', {
          'doa-harian': { level: 'BSH', subs: ['doa-orang-tua'] },
        });
        expect(result['agama-budi-pekerti']).toContain(
          'sudah mampu melafalkan beberapa doa harian dengan baik, serta doa untuk kedua orang tua.'
        );
        expect(result['agama-budi-pekerti']).not.toContain('seperti serta');
      });

      it('auto-injects "seperti " when the first selected sub-indicator lacks a connector', () => {
        const result = generateTemplate('Aisyah', {
          'doa-harian': { level: 'BSH', subs: ['doa-tidur'] },
        });
        expect(result['agama-budi-pekerti']).toBe(
          'Ananda Aisyah sudah mampu melafalkan beberapa doa harian dengan baik, seperti doa sebelum tidur dan bangun tidur.'
        );
      });

      it('joins multiple sub-indicators with commas and preserves sub-indicator curriculum order', () => {
        const result = generateTemplate('Aisyah', {
          'doa-harian': {
            level: 'BSH',
            subs: ['doa-orang-tua', 'doa-tidur'],
          },
        });
        expect(result['agama-budi-pekerti']).toBe(
          'Ananda Aisyah sudah mampu melafalkan beberapa doa harian dengan baik, seperti doa sebelum tidur dan bangun tidur, serta doa untuk kedua orang tua.'
        );
      });

      it('renders all four sub-indicators when ang-1-10 is selected with ang-tulis, ang-urutan, and ang-mundur', () => {
        const result = generateTemplate('Aisyah', {
          'mengenal-angka': {
            level: 'BSH',
            subs: ['ang-1-10', 'ang-tulis', 'ang-urutan', 'ang-mundur'],
          },
        });
        expect(result['literasi-steam']).toBe(
          'Ananda Aisyah sudah mengenal lambang bilangan dan konsep angka dengan baik, seperti mengenal dan menyebut angka 1 sampai 10, serta mampu menuliskan lambang angka tersebut dengan benar, serta mampu mengurutkan angka dari yang terkecil ke yang terbesar dengan tepat, serta mampu menghitung mundur dari 10 atau 20 dengan lancar.'
        );
      });

      it('renders all four sub-indicators when ang-1-20 is selected with ang-tulis, ang-urutan, and ang-mundur', () => {
        const result = generateTemplate('Aisyah', {
          'mengenal-angka': {
            level: 'BSH',
            subs: ['ang-1-20', 'ang-tulis', 'ang-urutan', 'ang-mundur'],
          },
        });
        expect(result['literasi-steam']).toBe(
          'Ananda Aisyah sudah mengenal lambang bilangan dan konsep angka dengan baik, seperti mengenal dan menyebut angka 1 sampai 20, serta mampu menuliskan lambang angka tersebut dengan benar, serta mampu mengurutkan angka dari yang terkecil ke yang terbesar dengan tepat, serta mampu menghitung mundur dari 10 atau 20 dengan lancar.'
        );
      });

      it('renders additive sub-indicators alone when range sub-indicators are not selected', () => {
        const result = generateTemplate('Aisyah', {
          'mengenal-angka': {
            level: 'BSH',
            subs: ['ang-tulis', 'ang-urutan'],
          },
        });
        expect(result['literasi-steam']).toBe(
          'Ananda Aisyah sudah mengenal lambang bilangan dan konsep angka dengan baik, serta mampu menuliskan lambang angka tersebut dengan benar, serta mampu mengurutkan angka dari yang terkecil ke yang terbesar dengan tepat.'
        );
      });
    });

    describe('toggleSubSelection', () => {
      const mengenalAngkaStructure = getChecklistStructure()
        .find((e) => e.id === 'literasi-steam')
        .subElemen.find((s) => s.id === 'numerasi')
        .indikator.find((i) => i.id === 'mengenal-angka');

      it('is pure: does not mutate currentSubs or subIndikator and returns a new array', () => {
        const initialSubs = Object.freeze(['ang-1-10', 'ang-tulis']);
        const subIndikator = Object.freeze([...mengenalAngkaStructure.subIndikator]);
        const result = toggleSubSelection(initialSubs, subIndikator, 'ang-1-20', true);

        expect(result).not.toBe(initialSubs);
        expect(result).toEqual(['ang-tulis', 'ang-1-20']);
        expect(initialSubs).toEqual(['ang-1-10', 'ang-tulis']);
      });

      // The exclusive-group branch returns the result of filter(), so it stays pure
      // whether or not the input was copied first. Only the ungrouped branch appends
      // via push(), so this is the single path where dropping the defensive copy
      // would let the caller's own array be modified.
      it('is pure on the ungrouped branch: appending leaves the caller array untouched', () => {
        const callerSubs = ['ang-1-10'];
        const result = toggleSubSelection(
          callerSubs,
          mengenalAngkaStructure.subIndikator,
          'ang-tulis',
          true
        );

        expect(result).toEqual(['ang-1-10', 'ang-tulis']);
        expect(callerSubs).toEqual(['ang-1-10']);
        expect(result).not.toBe(callerSubs);
      });

      it('treats null or undefined currentSubs as an empty array', () => {
        expect(toggleSubSelection(null, mengenalAngkaStructure.subIndikator, 'ang-1-10', true)).toEqual(['ang-1-10']);
        expect(toggleSubSelection(undefined, mengenalAngkaStructure.subIndikator, 'ang-tulis', true)).toEqual(['ang-tulis']);
        expect(toggleSubSelection(null, mengenalAngkaStructure.subIndikator, 'ang-1-10', false)).toEqual([]);
      });

      it('clears only ang-1-10 when selecting ang-1-20, leaving additive sub-indicators intact', () => {
        const currentSubs = ['ang-1-10', 'ang-tulis', 'ang-urutan', 'ang-mundur'];
        const updatedSubs = toggleSubSelection(currentSubs, mengenalAngkaStructure.subIndikator, 'ang-1-20', true);

        expect(updatedSubs).toEqual(['ang-tulis', 'ang-urutan', 'ang-mundur', 'ang-1-20']);

        // Verify narrative generation produces all 4 active sub-indicators
        const narrative = generateTemplate('Citra', {
          'mengenal-angka': { level: 'BSH', subs: updatedSubs },
        });
        expect(narrative['literasi-steam']).toBe(
          'Ananda Citra sudah mengenal lambang bilangan dan konsep angka dengan baik, seperti mengenal dan menyebut angka 1 sampai 20, serta mampu menuliskan lambang angka tersebut dengan benar, serta mampu mengurutkan angka dari yang terkecil ke yang terbesar dengan tepat, serta mampu menghitung mundur dari 10 atau 20 dengan lancar.'
        );
      });

      it('clears exclusive sub-indicator when checked is false', () => {
        const currentSubs = ['ang-1-10', 'ang-tulis'];
        const updatedSubs = toggleSubSelection(currentSubs, mengenalAngkaStructure.subIndikator, 'ang-1-10', false);
        expect(updatedSubs).toEqual(['ang-tulis']);
      });

      it('performs plain toggle for sub-indicators without an exclusiveGroup', () => {
        const currentSubs = ['ang-1-10'];
        const withTulis = toggleSubSelection(currentSubs, mengenalAngkaStructure.subIndikator, 'ang-tulis', true);
        expect(withTulis).toEqual(['ang-1-10', 'ang-tulis']);

        const withoutTulis = toggleSubSelection(withTulis, mengenalAngkaStructure.subIndikator, 'ang-tulis', false);
        expect(withoutTulis).toEqual(['ang-1-10']);
      });

      it('does not produce duplicates when adding an already present sub-indicator', () => {
        const currentSubs = ['ang-1-10', 'ang-tulis'];
        const result = toggleSubSelection(currentSubs, mengenalAngkaStructure.subIndikator, 'ang-tulis', true);
        expect(result).toEqual(['ang-1-10', 'ang-tulis']);
      });

      it('preserves relative order of untouched sub-indicators and appends newly selected at the end', () => {
        const currentSubs = ['ang-urutan', 'ang-1-10', 'ang-mundur', 'ang-tulis'];
        const result = toggleSubSelection(currentSubs, mengenalAngkaStructure.subIndikator, 'ang-1-20', true);
        expect(result).toEqual(['ang-urutan', 'ang-mundur', 'ang-tulis', 'ang-1-20']);
      });

      it('falls back to plain toggle when subId is not found in subIndikator array', () => {
        const currentSubs = ['ang-1-10'];
        const added = toggleSubSelection(currentSubs, mengenalAngkaStructure.subIndikator, 'nonexistent-sub', true);
        expect(added).toEqual(['ang-1-10', 'nonexistent-sub']);

        const removed = toggleSubSelection(added, mengenalAngkaStructure.subIndikator, 'nonexistent-sub', false);
        expect(removed).toEqual(['ang-1-10']);
      });
    });

    describe('Paragraph building and sentence transitions (buildParagraph)', () => {
      it('builds a 1-sentence paragraph: "Ananda {name} {sentence}."', () => {
        const result = generateTemplate('Budi', {
          'kitab-suci': { level: 'BSH' },
        });
        expect(result['agama-budi-pekerti']).toBe(
          'Ananda Budi mengenal kitab suci agamanya dan memperlakukannya dengan penuh rasa hormat.'
        );
      });

      it('builds a 2-sentence paragraph: connector 1 is " Selain itu, Ananda juga "', () => {
        const result = generateTemplate('Budi', {
          'doa-harian': { level: 'BSH', subs: [] },
          'kitab-suci': { level: 'BSH' },
        });
        expect(result['agama-budi-pekerti']).toBe(
          'Ananda Budi sudah mampu melafalkan beberapa doa harian dengan baik. Selain itu, Ananda juga mengenal kitab suci agamanya dan memperlakukannya dengan penuh rasa hormat.'
        );
      });

      it('builds a 3-sentence paragraph: connector 2 is " Di samping itu, Ananda "', () => {
        const result = generateTemplate('Budi', {
          'doa-harian': { level: 'BSH', subs: [] },
          'gerakan-ibadah': { level: 'BSH', subs: [] },
          'kitab-suci': { level: 'BSH' },
        });
        expect(result['agama-budi-pekerti']).toBe(
          'Ananda Budi sudah mampu melafalkan beberapa doa harian dengan baik. Selain itu, Ananda juga mengenal dan mampu menirukan gerakan ibadah sesuai agamanya. Di samping itu, Ananda mengenal kitab suci agamanya dan memperlakukannya dengan penuh rasa hormat.'
        );
      });

      it('builds a 4-sentence paragraph: connector 3 is " Ananda juga "', () => {
        const result = generateTemplate('Budi', {
          'doa-harian': { level: 'BSH', subs: [] },
          'gerakan-ibadah': { level: 'BSH', subs: [] },
          'kitab-suci': { level: 'BSH' },
          'tempat-ibadah': { level: 'BSH' },
        });
        expect(result['agama-budi-pekerti']).toContain(
          ' Di samping itu, Ananda mengenal kitab suci agamanya dan memperlakukannya dengan penuh rasa hormat. Ananda juga dapat menyebutkan dan mengenal fungsi tempat ibadah agamanya dengan benar.'
        );
      });

      it('builds a 5-sentence paragraph: connector 4 is " Tak hanya itu, Ananda pun "', () => {
        const result = generateTemplate('Budi', {
          'doa-harian': { level: 'BSH', subs: [] },
          'gerakan-ibadah': { level: 'BSH', subs: [] },
          'kitab-suci': { level: 'BSH' },
          'tempat-ibadah': { level: 'BSH' },
          'hari-besar-agama': { level: 'BSH', subs: [] },
        });
        expect(result['agama-budi-pekerti']).toContain(
          ' Tak hanya itu, Ananda pun mulai mengenal hari-hari besar keagamaan.'
        );
      });

      it('builds a 6-sentence paragraph: connector 5 is " Hal yang membanggakan, Ananda "', () => {
        const result = generateTemplate('Budi', {
          'doa-harian': { level: 'BSH', subs: [] },
          'gerakan-ibadah': { level: 'BSH', subs: [] },
          'kitab-suci': { level: 'BSH' },
          'tempat-ibadah': { level: 'BSH' },
          'hari-besar-agama': { level: 'BSH', subs: [] },
          'sifat-tuhan': { level: 'BSH' },
        });
        expect(result['agama-budi-pekerti']).toContain(
          ' Hal yang membanggakan, Ananda mulai memahami beberapa sifat dan kebesaran Tuhan sesuai dengan ajaran agama yang diyakininya.'
        );
      });

      it('cycles back to connector 1 when there are 7+ sentences in the same sub-element', () => {
        const result = generateTemplate('Budi', {
          'doa-harian': { level: 'BSH', subs: [] },
          'gerakan-ibadah': { level: 'BSH', subs: [] },
          'kitab-suci': { level: 'BSH' },
          'tempat-ibadah': { level: 'BSH' },
          'hari-besar-agama': { level: 'BSH', subs: [] },
          'sifat-tuhan': { level: 'BSH' },
          'rasa-syukur': { level: 'BSH', subs: [] },
        });
        const paras = result['agama-budi-pekerti'].split('\n\n');
        expect(paras).toHaveLength(2);
        expect(paras[0]).toContain('Hal yang membanggakan, Ananda');
        expect(paras[1]).toBe(
          'Ananda Budi terbiasa mengucapkan rasa syukur atas nikmat dan karunia yang diterimanya dari Tuhan.'
        );
      });
    });

    describe('Multi-element and multi-sub-element paragraph structuring', () => {
      it('separates sub-elements within an element using double newlines ("\\n\\n")', () => {
        const result = generateTemplate('Citra', {
          'doa-harian': { level: 'BSH', subs: [] }, // ajaran-agama
          'rasa-syukur': { level: 'BSH', subs: [] }, // syukur-ciptaan
        });
        const text = result['agama-budi-pekerti'];
        expect(text).toBeDefined();
        const parts = text.split('\n\n');
        expect(parts).toHaveLength(2);
        expect(parts[0]).toBe(
          'Ananda Citra sudah mampu melafalkan beberapa doa harian dengan baik.'
        );
        expect(parts[1]).toBe(
          'Ananda Citra terbiasa mengucapkan rasa syukur atas nikmat dan karunia yang diterimanya dari Tuhan.'
        );
      });

      it('populates only the elements that have selected indicators', () => {
        const result = generateTemplate('Citra', {
          'mengenali-emosi': { level: 'BSH', subs: [] },
        });
        expect(result['agama-budi-pekerti']).toBeUndefined();
        expect(result['literasi-steam']).toBeUndefined();
        expect(result['jati-diri']).toBeDefined();
        expect(result['jati-diri']).toBe(
          'Ananda Citra mampu mengenali dan menamai berbagai emosi yang dirasakannya.'
        );
      });

      it('generates narrative across all three curriculum elements simultaneously', () => {
        const result = generateTemplate('Citra', {
          'kitab-suci': { level: 'BSH' },
          'mengenali-emosi': { level: 'BSH', subs: [] },
          'menyimak': { level: 'BSH', subs: [] },
        });
        expect(Object.keys(result)).toEqual([
          'agama-budi-pekerti',
          'jati-diri',
          'literasi-steam',
        ]);
        expect(result['agama-budi-pekerti']).toContain('mengenal kitab suci agamanya');
        expect(result['jati-diri']).toContain('mengenali dan menamai berbagai emosi');
        expect(result['literasi-steam']).toContain('mampu menyimak dengan seksama');
      });

      it('accepts optional religion parameter without throwing or affecting template output for non-religion indicators', () => {
        const sel = { 'kitab-suci': { level: 'BSH' } };
        const withRel = generateTemplate('Aisyah', sel, 'islam');
        const withoutRel = generateTemplate('Aisyah', sel);
        expect(withRel).toEqual(withoutRel);
      });

      it('filters out mismatched religion sub-indicators when religion is specified (e.g. Christian student with stale gi-sholat produces no sholat wording)', () => {
        const staleSel = {
          'gerakan-ibadah': { level: 'BSH', subs: ['gi-sholat'] },
        };
        const result = generateTemplate('Aisyah', staleSel, 'kristen');
        expect(result['agama-budi-pekerti']).toBe(
          'Ananda Aisyah mengenal dan mampu menirukan gerakan ibadah sesuai agamanya.'
        );
        expect(result['agama-budi-pekerti']).not.toContain('sholat');
        expect(result['agama-budi-pekerti']).not.toContain('rukuk');
      });

      it('retains matching religion sub-indicator regardless of subs array order when multiple subs exist in selection', () => {
        const multiSel1 = {
          'gerakan-ibadah': { level: 'BSH', subs: ['gi-sholat', 'gi-kebaktian'] },
        };
        const result1 = generateTemplate('Aisyah', multiSel1, 'kristen');
        expect(result1['agama-budi-pekerti']).toBe(
          'Ananda Aisyah mengenal dan mampu menirukan gerakan ibadah sesuai agamanya, seperti sikap tangan saat berdoa dan menyanyikan pujian rohani.'
        );
        expect(result1['agama-budi-pekerti']).not.toContain('sholat');

        const multiSel2 = {
          'gerakan-ibadah': { level: 'BSH', subs: ['gi-kebaktian', 'gi-sholat'] },
        };
        const result2 = generateTemplate('Aisyah', multiSel2, 'kristen');
        expect(result2['agama-budi-pekerti']).toBe(
          'Ananda Aisyah mengenal dan mampu menirukan gerakan ibadah sesuai agamanya, seperti sikap tangan saat berdoa dan menyanyikan pujian rohani.'
        );
        expect(result2['agama-budi-pekerti']).not.toContain('sholat');
      });

      it('produces unchanged output with all provided subs when religion is omitted or null', () => {
        const sel = {
          'gerakan-ibadah': { level: 'BSH', subs: ['gi-sholat'] },
        };
        const withoutRel = generateTemplate('Aisyah', sel);
        const withNull = generateTemplate('Aisyah', sel, null);
        const expected =
          'Ananda Aisyah mengenal dan mampu menirukan gerakan ibadah sesuai agamanya, seperti gerakan berdiri, rukuk, dan sujud dalam sholat.';

        expect(withoutRel['agama-budi-pekerti']).toBe(expected);
        expect(withNull['agama-budi-pekerti']).toBe(expected);
      });

      it('drops nothing and retains sub-indicators when religion is unrecognized or unmapped', () => {
        const sel = {
          'gerakan-ibadah': { level: 'BSH', subs: ['gi-sholat'] },
        };
        const result = generateTemplate('Aisyah', sel, 'shinto');
        expect(result['agama-budi-pekerti']).toBe(
          'Ananda Aisyah mengenal dan mampu menirukan gerakan ibadah sesuai agamanya, seperti gerakan berdiri, rukuk, dan sujud dalam sholat.'
        );
      });

      it('handles capitalized or mixed-case religion strings consistently (e.g. "Kristen", "ISLAM")', () => {
        const staleSel = {
          'gerakan-ibadah': { level: 'BSH', subs: ['gi-sholat', 'gi-kebaktian'] },
        };
        const resKristen = generateTemplate('Aisyah', staleSel, 'Kristen');
        expect(resKristen['agama-budi-pekerti']).toBe(
          'Ananda Aisyah mengenal dan mampu menirukan gerakan ibadah sesuai agamanya, seperti sikap tangan saat berdoa dan menyanyikan pujian rohani.'
        );
        expect(resKristen['agama-budi-pekerti']).not.toContain('sholat');

        const resIslam = generateTemplate('Aisyah', staleSel, 'ISLAM');
        expect(resIslam['agama-budi-pekerti']).toBe(
          'Ananda Aisyah mengenal dan mampu menirukan gerakan ibadah sesuai agamanya, seperti gerakan berdiri, rukuk, dan sujud dalam sholat.'
        );
        expect(resIslam['agama-budi-pekerti']).not.toContain('kebaktian');
      });

      it('produces byte-identical output for indicators with sub-indicators that are not gerakan-ibadah regardless of religion parameter', () => {
        const sel = {
          'mengenal-angka': {
            level: 'BSH',
            subs: ['ang-1-10', 'ang-tulis', 'ang-urutan'],
          },
          'doa-harian': {
            level: 'BSH',
            subs: ['doa-makan', 'doa-tidur'],
          },
        };
        const resIslam = generateTemplate('Aisyah', sel, 'islam');
        const resKristen = generateTemplate('Aisyah', sel, 'kristen');
        const resNull = generateTemplate('Aisyah', sel, null);

        expect(resIslam['literasi-steam']).toBe(resNull['literasi-steam']);
        expect(resKristen['literasi-steam']).toBe(resNull['literasi-steam']);
        expect(resIslam['agama-budi-pekerti']).toBe(resNull['agama-budi-pekerti']);
        expect(resKristen['agama-budi-pekerti']).toBe(resNull['agama-budi-pekerti']);
      });
    });
  });

  describe('getChecklistStructure', () => {
    it('returns 3 elements matching curriculum definitions with nested subElemen and indikator', () => {
      const structure = getChecklistStructure();
      expect(structure).toHaveLength(3);
      expect(structure[0].id).toBe('agama-budi-pekerti');
      expect(structure[1].id).toBe('jati-diri');
      expect(structure[2].id).toBe('literasi-steam');

      for (const element of structure) {
        expect(element.id).toBeDefined();
        expect(element.nama).toBeDefined();
        expect(element.deskripsi).toBeDefined();
        expect(Array.isArray(element.subElemen)).toBe(true);

        for (const sub of element.subElemen) {
          expect(sub.id).toBeDefined();
          expect(sub.nama).toBeDefined();
          expect(Array.isArray(sub.indikator)).toBe(true);

          for (const ind of sub.indikator) {
            expect(ind.id).toBeDefined();
            expect(ind.label).toBeDefined();
            expect(typeof ind.hasSub).toBe('boolean');
            expect(ind.isMutuallyExclusive).toBeUndefined();
            expect(ind.levelTemplates).toBeDefined();
            expect(Array.isArray(ind.subIndikator)).toBe(true);

            for (const s of ind.subIndikator) {
              expect(s.id).toBeDefined();
              expect(s.label).toBeDefined();
              expect(s.template).toBeUndefined();
            }
          }
        }
      }
    });

    describe('Religion filtering on gerakan-ibadah', () => {
      const getGerakanIbadah = (religion) => {
        const structure = getChecklistStructure(religion);
        const agama = structure.find((e) => e.id === 'agama-budi-pekerti');
        const subAjaran = agama.subElemen.find((s) => s.id === 'ajaran-agama');
        return subAjaran.indikator.find((i) => i.id === 'gerakan-ibadah');
      };

      it('returns all 5 religion sub-indicators when religion is null or omitted', () => {
        const ind = getGerakanIbadah(null);
        expect(ind.subIndikator).toHaveLength(5);
        expect(ind.subIndikator.map((s) => s.id)).toEqual([
          'gi-sholat',
          'gi-kebaktian',
          'gi-sembahyang-hindu',
          'gi-sembahyang-buddha',
          'gi-sembahyang-konghucu',
        ]);
      });

      it('filters to gi-sholat for Islam (case-insensitive)', () => {
        expect(getGerakanIbadah('islam').subIndikator.map((s) => s.id)).toEqual(['gi-sholat']);
        expect(getGerakanIbadah('Islam').subIndikator.map((s) => s.id)).toEqual(['gi-sholat']);
        expect(getGerakanIbadah('ISLAM').subIndikator.map((s) => s.id)).toEqual(['gi-sholat']);
      });

      it('filters to gi-kebaktian for Kristen and Katolik', () => {
        expect(getGerakanIbadah('kristen').subIndikator.map((s) => s.id)).toEqual(['gi-kebaktian']);
        expect(getGerakanIbadah('katolik').subIndikator.map((s) => s.id)).toEqual(['gi-kebaktian']);
      });

      it('filters to gi-sembahyang-hindu for Hindu', () => {
        expect(getGerakanIbadah('hindu').subIndikator.map((s) => s.id)).toEqual(['gi-sembahyang-hindu']);
      });

      it('filters to gi-sembahyang-buddha for Buddha', () => {
        expect(getGerakanIbadah('buddha').subIndikator.map((s) => s.id)).toEqual(['gi-sembahyang-buddha']);
      });

      it('filters to gi-sembahyang-konghucu for Konghucu', () => {
        expect(getGerakanIbadah('konghucu').subIndikator.map((s) => s.id)).toEqual(['gi-sembahyang-konghucu']);
      });

      it('returns all 5 sub-indicators for an unknown or unmapped religion string', () => {
        const ind = getGerakanIbadah('shinto');
        expect(ind.subIndikator).toHaveLength(5);
      });

      it('does NOT filter non-religion indicators (e.g. doa-harian or hari-besar-agama)', () => {
        const structure = getChecklistStructure('islam');
        const agama = structure.find((e) => e.id === 'agama-budi-pekerti');
        const ajaran = agama.subElemen.find((s) => s.id === 'ajaran-agama');
        const doaHarian = ajaran.indikator.find((i) => i.id === 'doa-harian');
        const hariBesar = ajaran.indikator.find((i) => i.id === 'hari-besar-agama');

        expect(doaHarian.subIndikator.length).toBe(8);
        expect(hariBesar.subIndikator.length).toBe(7);
      });
    });

    describe('Sub-indicator mutual exclusivity (exclusiveGroup)', () => {
      it('does not attach exclusiveGroup to sub-indicators without exclusivity rules', () => {
        const structure = getChecklistStructure();
        const agama = structure.find((e) => e.id === 'agama-budi-pekerti');
        const doaHarian = agama.subElemen[0].indikator.find((i) => i.id === 'doa-harian');
        expect(doaHarian.isMutuallyExclusive).toBeUndefined();
        expect(doaHarian.subIndikator.every((s) => s.exclusiveGroup === undefined)).toBe(true);
      });

      it('scopes exclusivity strictly to ang-1-10 and ang-1-20 via exclusiveGroup while leaving additive sub-indicators independent', () => {
        const structure = getChecklistStructure();
        const steam = structure.find((e) => e.id === 'literasi-steam');
        const numerasi = steam.subElemen.find((s) => s.id === 'numerasi');
        const mengenalAngka = numerasi.indikator.find((i) => i.id === 'mengenal-angka');

        expect(mengenalAngka.isMutuallyExclusive).toBeUndefined();
        expect(mengenalAngka.subIndikator).toHaveLength(5);

        const ang1_10 = mengenalAngka.subIndikator.find((s) => s.id === 'ang-1-10');
        const ang1_20 = mengenalAngka.subIndikator.find((s) => s.id === 'ang-1-20');
        const angTulis = mengenalAngka.subIndikator.find((s) => s.id === 'ang-tulis');
        const angUrutan = mengenalAngka.subIndikator.find((s) => s.id === 'ang-urutan');
        const angMundur = mengenalAngka.subIndikator.find((s) => s.id === 'ang-mundur');

        expect(ang1_10.exclusiveGroup).toBe('range-angka');
        expect(ang1_20.exclusiveGroup).toBe('range-angka');
        expect(angTulis.exclusiveGroup).toBeUndefined();
        expect(angUrutan.exclusiveGroup).toBeUndefined();
        expect(angMundur.exclusiveGroup).toBeUndefined();
      });
    });
  });

  describe('countSelected', () => {
    it('returns total 0 and 0 for each element when selection map is empty', () => {
      const result = countSelected({});
      expect(result).toEqual({
        total: 0,
        byElement: {
          'agama-budi-pekerti': 0,
          'jati-diri': 0,
          'literasi-steam': 0,
        },
      });
    });

    it('counts selected indicators correctly across single and multiple elements', () => {
      const result = countSelected({
        'doa-harian': { level: 'BSH' },
        'kitab-suci': { level: 'BSB' },
        'mengenali-emosi': { level: 'BSH' },
        'mengenal-angka': { level: 'BSH', subs: ['ang-1-10'] },
      });

      expect(result.total).toBe(4);
      expect(result.byElement).toEqual({
        'agama-budi-pekerti': 2,
        'jati-diri': 1,
        'literasi-steam': 1,
      });
    });

    it('handles legacy boolean true values in selection map', () => {
      const result = countSelected({
        'doa-harian': true,
        'mengenali-emosi': true,
      });
      expect(result.total).toBe(2);
      expect(result.byElement['agama-budi-pekerti']).toBe(1);
      expect(result.byElement['jati-diri']).toBe(1);
    });

    it('ignores falsy entries and nonexistent indicator IDs', () => {
      const result = countSelected({
        'doa-harian': false,
        'kitab-suci': null,
        'mengenali-emosi': undefined,
        'nonexistent-ind-id': { level: 'BSH' },
      });
      expect(result.total).toBe(0);
      expect(result.byElement['agama-budi-pekerti']).toBe(0);
      expect(result.byElement['jati-diri']).toBe(0);
      expect(result.byElement['literasi-steam']).toBe(0);
    });
  });

  describe('Nilai Plus Functions', () => {
    describe('getNilaiPlusData', () => {
      it('returns categories array from nilai-plus.json with expected structure', () => {
        const data = getNilaiPlusData();
        expect(Array.isArray(data)).toBe(true);
        expect(data).toHaveLength(nilaiPlusData.kategori.length);

        for (const cat of data) {
          expect(cat.id).toBeDefined();
          expect(cat.nama).toBeDefined();
          expect(Array.isArray(cat.item)).toBe(true);
          expect(cat.item.length).toBeGreaterThan(0);

          for (const item of cat.item) {
            expect(item.id).toBeDefined();
            expect(item.label).toBeDefined();
            expect(item.template).toBeDefined();
          }
        }
      });
    });

    describe('generateNilaiPlusNarrative', () => {
      it('returns empty string when input is null, undefined, or empty object', () => {
        expect(generateNilaiPlusNarrative('Budi', null)).toBe('');
        expect(generateNilaiPlusNarrative('Budi', undefined)).toBe('');
        expect(generateNilaiPlusNarrative('Budi', {})).toBe('');
      });

      it('returns empty string when all selections are falsy or unknown keys', () => {
        expect(
          generateNilaiPlusNarrative('Budi', {
            'np-bantu-guru-beres': false,
            'np-lerai-teman': null,
            'unknown-item': true,
          })
        ).toBe('');
      });

      it('generates a single narrative line for 1 selected item', () => {
        const result = generateNilaiPlusNarrative('Budi', {
          'np-bantu-guru-beres': true,
        });
        expect(result).toBe(
          'Ananda Budi dengan inisiatif yang menggembirakan selalu membantu guru membereskan dan merapikan kelas setelah kegiatan selesai, tanpa perlu diminta terlebih dahulu.'
        );
      });

      it('generates multiple narrative lines joined by newline ("\\n") for multiple selected items', () => {
        const result = generateNilaiPlusNarrative('Aisyah', {
          'np-bantu-guru-beres': true,
          'np-lerai-teman': true,
        });
        const lines = result.split('\n');
        expect(lines).toHaveLength(2);
        expect(lines[0]).toBe(
          'Ananda Aisyah dengan inisiatif yang menggembirakan selalu membantu guru membereskan dan merapikan kelas setelah kegiatan selesai, tanpa perlu diminta terlebih dahulu.'
        );
        expect(lines[1]).toBe(
          'Ananda Aisyah menunjukkan kematangan emosi yang patut diapresiasi dengan mau menengahi dan menenangkan teman-temannya yang sedang berselisih dengan cara yang damai.'
        );
      });

      it('preserves curriculum category and item order regardless of selection key order', () => {
        const result = generateNilaiPlusNarrative('Aisyah', {
          'np-lerai-teman': true,
          'np-bantu-guru-beres': true,
        });
        const lines = result.split('\n');
        expect(lines[0]).toContain('bantu guru membereskan');
        expect(lines[1]).toContain('menengahi dan menenangkan teman');
      });
    });
  });

  describe('Saran Functions', () => {
    describe('getSaranData', () => {
      it('returns categories array from saran.json with expected structure', () => {
        const data = getSaranData();
        expect(Array.isArray(data)).toBe(true);
        expect(data).toHaveLength(saranData.kategori.length);

        for (const cat of data) {
          expect(cat.id).toBeDefined();
          expect(cat.nama).toBeDefined();
          expect(Array.isArray(cat.item)).toBe(true);
          expect(cat.item.length).toBeGreaterThan(0);

          for (const item of cat.item) {
            expect(item.id).toBeDefined();
            expect(item.label).toBeDefined();
            expect(item.template).toBeDefined();
          }
        }
      });
    });

    describe('generateSaranNarrative', () => {
      it('returns empty string when input is null, undefined, or empty object', () => {
        expect(generateSaranNarrative('Budi', null)).toBe('');
        expect(generateSaranNarrative('Budi', undefined)).toBe('');
        expect(generateSaranNarrative('Budi', {})).toBe('');
      });

      it('returns empty string when all selections are falsy or unknown keys', () => {
        expect(
          generateSaranNarrative('Budi', {
            'saran-hindari-kata-kasar': false,
            'saran-doa-harian-rutin': null,
            'unknown-saran': true,
          })
        ).toBe('');
      });

      it('generates a single saran narrative line for 1 selected item', () => {
        const result = generateSaranNarrative('Budi', {
          'saran-doa-harian-rutin': true,
        });
        expect(result).toBe(
          'Kami harapkan Budi perlu didukung dengan pembiasaan melafalkan doa harian secara rutin dan konsisten di rumah — misalnya doa sebelum makan dan sebelum tidur — agar kemampuan dan kebiasaan berdoanya semakin kuat.'
        );
      });

      it('generates multiple saran lines joined by newline ("\\n") for multiple selected items', () => {
        const result = generateSaranNarrative('Aisyah', {
          'saran-hindari-kata-kasar': true,
          'saran-doa-harian-rutin': true,
        });
        const lines = result.split('\n');
        expect(lines).toHaveLength(2);
        expect(lines[0]).toBe(
          'Kami harapkan Aisyah perlu mendapat bimbingan yang konsisten dan penuh kasih sayang untuk menghindari penggunaan kata-kata kasar dalam percakapan sehari-hari, karena anak sangat mudah menyerap bahasa dari lingkungan sekitar — keteladanan orang tua dalam bertutur kata dengan santun adalah cara paling efektif untuk membentuk kebiasaan berbicara yang baik.'
        );
        expect(lines[1]).toBe(
          'Kami harapkan Aisyah perlu didukung dengan pembiasaan melafalkan doa harian secara rutin dan konsisten di rumah — misalnya doa sebelum makan dan sebelum tidur — agar kemampuan dan kebiasaan berdoanya semakin kuat.'
        );
      });

      it('preserves curriculum category and item order regardless of selection key order', () => {
        const result = generateSaranNarrative('Aisyah', {
          'saran-doa-harian-rutin': true,
          'saran-hindari-kata-kasar': true,
        });
        const lines = result.split('\n');
        expect(lines[0]).toContain('menghindari penggunaan kata-kata kasar');
        expect(lines[1]).toContain('pembiasaan melafalkan doa harian');
      });
    });
  });

  describe('Kokurikuler Functions', () => {
    describe('getKokurikulerData', () => {
      it('returns dimensi array from kokurikuler.json with 8 dimensions', () => {
        const data = getKokurikulerData();
        expect(Array.isArray(data)).toBe(true);
        expect(data).toHaveLength(8);
        expect(data.map((d) => d.id)).toEqual([
          'keimanan',
          'kewarganegaraan',
          'kolaborasi',
          'kemandirian',
          'penalaran-kritis',
          'kreativitas',
          'kesehatan',
          'komunikasi',
        ]);

        for (const dim of data) {
          expect(dim.id).toBeDefined();
          expect(dim.nama).toBeDefined();
          expect(dim.deskripsi).toBeDefined();
          expect(Array.isArray(dim.indikator)).toBe(true);
          expect(dim.indikator.length).toBeGreaterThan(0);

          for (const ind of dim.indikator) {
            expect(ind.id).toBeDefined();
            expect(ind.label).toBeDefined();
            expect(ind.template).toBeDefined();
            expect(ind.has_sub).toBe(false);
          }
        }
      });
    });

    describe('generateKokurikulerNarrative', () => {
      it('returns empty string when input is null, undefined, or empty object', () => {
        expect(generateKokurikulerNarrative('Budi', null)).toBe('');
        expect(generateKokurikulerNarrative('Budi', undefined)).toBe('');
        expect(generateKokurikulerNarrative('Budi', {})).toBe('');
      });

      it('returns empty string when selections contain only falsy or unknown keys', () => {
        expect(
          generateKokurikulerNarrative('Budi', {
            'kk-ibadah-mandiri': false,
            'unknown-kk': true,
          })
        ).toBe('');
      });

      it('generates narrative for 1 selected indicator in 1 dimension', () => {
        const result = generateKokurikulerNarrative('Budi', {
          'kk-ibadah-mandiri': true,
        });
        expect(result).toBe(
          'Ananda Budi sudah menunjukkan keimanan yang membanggakan, terlihat dari kemandiriannya dalam melaksanakan ibadah sehari-hari tanpa harus diingatkan.'
        );
      });

      it('joins multiple indicators within the same dimension using ", serta "', () => {
        const result = generateKokurikulerNarrative('Budi', {
          'kk-ibadah-mandiri': true,
          'kk-syukur-spontan': true,
        });
        expect(result).toBe(
          'Ananda Budi sudah menunjukkan keimanan yang membanggakan, terlihat dari kemandiriannya dalam melaksanakan ibadah sehari-hari tanpa harus diingatkan, serta terbiasa mengucapkan rasa syukur secara spontan atas segala nikmat yang dirasakannya dalam keseharian.'
        );
      });

      it('joins 3 indicators in the same dimension using ", serta "', () => {
        const result = generateKokurikulerNarrative('Budi', {
          'kk-ibadah-mandiri': true,
          'kk-syukur-spontan': true,
          'kk-akhlak-mulia': true,
        });
        expect(result).toBe(
          'Ananda Budi sudah menunjukkan keimanan yang membanggakan, terlihat dari kemandiriannya dalam melaksanakan ibadah sehari-hari tanpa harus diingatkan, serta terbiasa mengucapkan rasa syukur secara spontan atas segala nikmat yang dirasakannya dalam keseharian, serta senantiasa menunjukkan akhlak mulia dalam berinteraksi, seperti berlaku jujur, bertutur kata baik, dan bersikap santun kepada guru maupun teman-temannya.'
        );
      });

      it('separates different dimensions into separate paragraphs with "\\n\\n", each prefixed with "Ananda {name} "', () => {
        const result = generateKokurikulerNarrative('Aisyah', {
          'kk-ibadah-mandiri': true,
          'kw-bangga-indonesia': true,
        });
        const paras = result.split('\n\n');
        expect(paras).toHaveLength(2);
        expect(paras[0]).toBe(
          'Ananda Aisyah sudah menunjukkan keimanan yang membanggakan, terlihat dari kemandiriannya dalam melaksanakan ibadah sehari-hari tanpa harus diingatkan.'
        );
        expect(paras[1]).toBe(
          'Ananda Aisyah mengenal dan menunjukkan rasa bangga terhadap budaya serta simbol kebangsaan Indonesia, seperti lagu kebangsaan, bendera, dan kesenian daerah.'
        );
      });
    });

    describe('countKokurikulerSelected', () => {
      it('returns total 0 and 0 for all 8 dimensions when input is null, undefined, or empty object', () => {
        const emptyResult = {
          total: 0,
          byDimensi: {
            keimanan: 0,
            kewarganegaraan: 0,
            kolaborasi: 0,
            kemandirian: 0,
            'penalaran-kritis': 0,
            kreativitas: 0,
            kesehatan: 0,
            komunikasi: 0,
          },
        };
        expect(countKokurikulerSelected(null)).toEqual(emptyResult);
        expect(countKokurikulerSelected(undefined)).toEqual(emptyResult);
        expect(countKokurikulerSelected({})).toEqual(emptyResult);
      });

      it('counts selected kokurikuler indicators accurately across dimensions', () => {
        const result = countKokurikulerSelected({
          'kk-ibadah-mandiri': true,
          'kk-syukur-spontan': true,
          'kw-bangga-indonesia': true,
          'kl-kerja-kelompok': true,
        });

        expect(result.total).toBe(4);
        expect(result.byDimensi.keimanan).toBe(2);
        expect(result.byDimensi.kewarganegaraan).toBe(1);
        expect(result.byDimensi.kolaborasi).toBe(1);
        expect(result.byDimensi.kemandirian).toBe(0);
      });

      it('ignores falsy selections and unknown indicator keys', () => {
        const result = countKokurikulerSelected({
          'kk-ibadah-mandiri': false,
          'kk-syukur-spontan': null,
          'unknown-dimensi-ind': true,
        });
        expect(result.total).toBe(0);
        expect(result.byDimensi.keimanan).toBe(0);
      });
    });
  });
});

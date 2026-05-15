/**
 * DOCX Export Service — generates a downloadable Word document for LCPA.
 * Uses the `docx` package (browser-compatible via Vite/ESM).
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  PageOrientation,
  convertInchesToTwip,
} from 'docx';

const SECTION_META = {
  'agama-budi-pekerti': { letter: 'A', title: 'Nilai Agama dan Budi Pekerti' },
  'jati-diri':          { letter: 'B', title: 'Jati Diri' },
  'literasi-steam':     { letter: 'C', title: 'Dasar-Dasar Literasi dan STEAM' },
  'kokurikuler':        { letter: 'D', title: 'Projek Penguatan Profil Pelajar Pancasila (Kokurikuler)' },
};

function formatDate(finalizedAt) {
  try {
    const d = finalizedAt?.toDate ? finalizedAt.toDate()
            : finalizedAt?._seconds ? new Date(finalizedAt._seconds * 1000)
            : new Date(finalizedAt);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}

function noBorder() {
  const s = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  return { top: s, bottom: s, left: s, right: s, insideH: s, insideV: s };
}

function infoRow(label, value) {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 35, type: WidthType.PERCENTAGE },
        borders: noBorder(),
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 22 })] })],
      }),
      new TableCell({
        width: { size: 5, type: WidthType.PERCENTAGE },
        borders: noBorder(),
        children: [new Paragraph({ children: [new TextRun({ text: ':', size: 22 })] })],
      }),
      new TableCell({
        width: { size: 60, type: WidthType.PERCENTAGE },
        borders: noBorder(),
        children: [new Paragraph({ children: [new TextRun({ text: value, size: 22 })] })],
      }),
    ],
  });
}

function spacer(lines = 1) {
  return Array.from({ length: lines }, () => new Paragraph({ text: '' }));
}

/**
 * Generate and download a Word DOCX for one finalized report.
 *
 * @param {object} reportData  — finalized report object
 * @param {string} institutionName
 */
export async function downloadReportAsDocx(reportData, institutionName = '') {
  const {
    studentName = 'Siswa',
    studentMeta = {},
    semester = '1',
    academicYear = '',
    templateNarrative = {},
    aiNarrative = {},
    finalizedAt,
  } = reportData;

  const ageGroupLabel = studentMeta.ageGroup === 'A' ? 'A (4–5 tahun)' : 'B (5–6 tahun)';
  const semesterLabel = semester === '1' ? '1 (Ganjil)' : '2 (Genap)';
  const dateStr = formatDate(finalizedAt);

  // Build narrative section children
  const sectionChildren = [];
  Object.keys(SECTION_META)
    .filter(id => templateNarrative[id] || aiNarrative?.[id])
    .forEach(id => {
      const meta = SECTION_META[id];
      const text = aiNarrative?.[id] || templateNarrative[id] || '';

      // Section heading — with bottom divider matching PDF style
      sectionChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${meta.letter}. ${meta.title.toUpperCase()}`, bold: true, size: 22 }),
          ],
          spacing: { before: 280, after: 140 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: 'dddddd' } },
        }),
      );

      // Split on double newlines (template engine separates sub-elements with \n\n)
      const paragraphs = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
      paragraphs.forEach((para, i) => {
        sectionChildren.push(
          new Paragraph({
            children: [new TextRun({ text: para, size: 22 })],
            alignment: AlignmentType.JUSTIFIED,
            spacing: {
              line: 276,        // 1.15x line spacing (276 = 240 * 1.15)
              lineRule: 'AUTO',
              after: i < paragraphs.length - 1 ? 120 : 240,
            },
            indent: { firstLine: convertInchesToTwip(0.3) },
          }),
        );
      });
    });

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'Times New Roman', size: 24 } },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(0.9),
            bottom: convertInchesToTwip(0.9),
            left: convertInchesToTwip(1.2),
            right: convertInchesToTwip(1.0),
          },
        },
      },
      children: [
        // ---- Header ----
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [new TextRun({ text: 'LAPORAN CAPAIAN PEMBELAJARAN ANAK', bold: true, size: 28 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [new TextRun({ text: '(LCPA)', size: 22 })],
        }),
        ...(institutionName ? [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
            children: [new TextRun({ text: institutionName.toUpperCase(), bold: true, size: 24 })],
          }),
        ] : []),
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '1A1A1A' } },
          spacing: { after: 200 },
          children: [],
        }),

        // ---- Student Info Table ----
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: noBorder(),
          rows: [
            infoRow('Nama Anak', studentName),
            infoRow('Kelompok Usia', ageGroupLabel),
            infoRow('Semester', semesterLabel),
            infoRow('Tahun Ajaran', academicYear),
          ],
        }),

        // ---- Narrative Sections ----
        ...spacer(1),
        ...sectionChildren,

        // ---- Signature Block ----
        ...spacer(2),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { after: 480 },
          children: [new TextRun({ text: dateStr, italics: true, size: 22 })],
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: noBorder(),
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 45, type: WidthType.PERCENTAGE },
                  borders: noBorder(),
                  children: [
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Guru Kelas,', bold: true, size: 22 })] }),
                    ...spacer(3),
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      border: { top: { style: BorderStyle.SINGLE, size: 4, color: '333333' } },
                      indent: { left: convertInchesToTwip(0.25), right: convertInchesToTwip(0.25) },
                      children: [new TextRun({ text: 'NIP.', size: 20, color: '666666' })],
                    }),
                  ],
                }),
                new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, borders: noBorder(), children: [new Paragraph({ text: '' })] }),
                new TableCell({
                  width: { size: 45, type: WidthType.PERCENTAGE },
                  borders: noBorder(),
                  children: [
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Kepala Sekolah,', bold: true, size: 22 })] }),
                    ...spacer(3),
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      border: { top: { style: BorderStyle.SINGLE, size: 4, color: '333333' } },
                      indent: { left: convertInchesToTwip(0.25), right: convertInchesToTwip(0.25) },
                      children: [new TextRun({ text: 'NIP.', size: 20, color: '666666' })],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        ...spacer(1),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'Mengetahui, Orang Tua/Wali', bold: true, size: 22 })],
        }),
        ...spacer(3),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: '333333' } },
          indent: { left: convertInchesToTwip(1.9), right: convertInchesToTwip(1.9) },
          children: [new TextRun({ text: '( )', size: 22 })],
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const safeName = (studentName || 'Siswa').replace(/[^\w\s-]/g, '').trim();
  const safeYear = (academicYear || '').replace(/\//g, '-');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `LCPA_${safeName}_Smt${semester}_${safeYear}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

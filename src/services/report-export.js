/**
 * Report Export Service
 * Generates formal printable LCPA (Laporan Capaian Pembelajaran Anak) documents.
 * Uses native window.print() via hidden iframe — zero dependencies.
 */

const SECTION_META = {
  'agama-budi-pekerti': { letter: 'A', title: 'Nilai Agama dan Budi Pekerti' },
  'jati-diri':          { letter: 'B', title: 'Jati Diri' },
  'literasi-steam':     { letter: 'C', title: 'Dasar-Dasar Literasi dan STEAM' },
};

/**
 * Print a finalized report as a formal A4 document.
 * Opens the browser's native print dialog (can save as PDF).
 *
 * @param {object} reportData — the report object from Firestore
 * @param {string} institutionName — name of the institution
 */
export function printReport(reportData, institutionName = '') {
  const {
    studentName = 'Siswa',
    studentMeta = {},
    semester = '1',
    academicYear = '',
    templateNarrative = {},
    aiNarrative = {},
    finalizedAt,
  } = reportData;

  const ageGroupLabel = studentMeta.ageGroup === 'A' ? 'A (4-5 tahun)' : 'B (5-6 tahun)';
  const semesterLabel = semester === '1' ? '1 (Ganjil)' : '2 (Genap)';

  // Format finalization date
  let dateString = '';
  if (finalizedAt) {
    try {
      const d = finalizedAt.toDate ? finalizedAt.toDate() : new Date(finalizedAt);
      dateString = d.toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric',
      });
    } catch {
      dateString = new Date().toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric',
      });
    }
  } else {
    dateString = new Date().toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  // Build narrative sections (prefer AI, fallback to template)
  const sectionsHTML = Object.keys(SECTION_META)
    .filter(id => templateNarrative[id] || aiNarrative?.[id])
    .map(id => {
      const meta = SECTION_META[id];
      const text = aiNarrative?.[id] || templateNarrative[id] || '';
      return `
        <div class="section">
          <h3 class="section-title">${meta.letter}. ${meta.title.toUpperCase()}</h3>
          <p class="section-body">${escapeHTML(text)}</p>
        </div>
      `;
    }).join('');

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>LCPA — ${studentName}</title>
  <style>
    @page {
      size: A4;
      margin: 20mm 25mm;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Plus Jakarta Sans', 'Georgia', 'Times New Roman', serif;
      font-size: 12pt;
      line-height: 1.8;
      color: #1a1a1a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .document {
      max-width: 100%;
    }

    /* ---- Header ---- */
    .doc-header {
      text-align: center;
      padding-bottom: 16pt;
      border-bottom: 2pt solid #1a1a1a;
      margin-bottom: 20pt;
    }

    .doc-title {
      font-size: 14pt;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 2pt;
    }

    .doc-subtitle {
      font-size: 11pt;
      font-weight: 400;
      color: #555;
      margin-bottom: 10pt;
    }

    .doc-institution {
      font-size: 13pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    /* ---- Student Info ---- */
    .student-info {
      margin-bottom: 24pt;
      border: 1px solid #ddd;
      border-radius: 4pt;
      padding: 12pt 16pt;
    }

    .info-row {
      display: flex;
      margin-bottom: 4pt;
    }

    .info-label {
      width: 140pt;
      font-weight: 600;
      color: #333;
      flex-shrink: 0;
    }

    .info-sep {
      width: 12pt;
      text-align: center;
      flex-shrink: 0;
    }

    .info-value {
      flex: 1;
    }

    /* ---- Sections ---- */
    .section {
      margin-bottom: 20pt;
      page-break-inside: avoid;
    }

    .section-title {
      font-size: 12pt;
      font-weight: 700;
      letter-spacing: 0.05em;
      padding-bottom: 6pt;
      border-bottom: 1px solid #ddd;
      margin-bottom: 10pt;
      color: #1a1a1a;
    }

    .section-body {
      text-align: justify;
      text-indent: 2em;
      white-space: pre-wrap;
    }

    /* ---- Signature Block ---- */
    .signature-block {
      margin-top: 48pt;
      page-break-inside: avoid;
    }

    .signature-date {
      text-align: right;
      margin-bottom: 36pt;
      font-style: italic;
    }

    .signature-row {
      display: flex;
      justify-content: space-between;
      text-align: center;
    }

    .signature-col {
      width: 45%;
    }

    .signature-role {
      font-weight: 600;
      margin-bottom: 60pt;
    }

    .signature-line {
      border-top: 1px solid #333;
      display: inline-block;
      width: 160pt;
      margin-bottom: 4pt;
    }

    .signature-nip {
      font-size: 10pt;
      color: #666;
    }

    .signature-parent {
      text-align: center;
      margin-top: 36pt;
    }

    .signature-parent .signature-role {
      margin-bottom: 60pt;
    }
  </style>
</head>
<body>
  <div class="document">
    <!-- Header -->
    <div class="doc-header">
      <div class="doc-title">Laporan Capaian Pembelajaran Anak</div>
      <div class="doc-subtitle">(LCPA)</div>
      ${institutionName ? `<div class="doc-institution">${escapeHTML(institutionName)}</div>` : ''}
    </div>

    <!-- Student Info -->
    <div class="student-info">
      <div class="info-row">
        <span class="info-label">Nama Anak</span>
        <span class="info-sep">:</span>
        <span class="info-value">${escapeHTML(studentName)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Kelompok Usia</span>
        <span class="info-sep">:</span>
        <span class="info-value">${ageGroupLabel}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Semester</span>
        <span class="info-sep">:</span>
        <span class="info-value">${semesterLabel}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Tahun Ajaran</span>
        <span class="info-sep">:</span>
        <span class="info-value">${escapeHTML(academicYear)}</span>
      </div>
    </div>

    <!-- Narrative Sections -->
    ${sectionsHTML}

    <!-- Signature Block -->
    <div class="signature-block">
      <div class="signature-date">${dateString}</div>
      <div class="signature-row">
        <div class="signature-col">
          <div class="signature-role">Guru Kelas,</div>
          <div class="signature-line"></div>
          <div class="signature-nip">NIP.</div>
        </div>
        <div class="signature-col">
          <div class="signature-role">Kepala Sekolah,</div>
          <div class="signature-line"></div>
          <div class="signature-nip">NIP.</div>
        </div>
      </div>
      <div class="signature-parent">
        <div class="signature-role">Mengetahui, Orang Tua/Wali</div>
        <div class="signature-line"></div>
      </div>
    </div>
  </div>
</body>
</html>`;

  // Create hidden iframe, inject HTML, trigger print
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  // Wait for content to render, then trigger print
  iframe.contentWindow.addEventListener('afterprint', () => {
    setTimeout(() => iframe.remove(), 200);
  });

  // Trigger print after a brief render delay
  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    // Fallback cleanup if afterprint doesn't fire (some browsers)
    setTimeout(() => { if (iframe.parentNode) iframe.remove(); }, 5000);
  }, 300);
}

/**
 * Escape HTML special characters for safe insertion
 */
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

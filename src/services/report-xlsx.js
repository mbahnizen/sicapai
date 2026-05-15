/**
 * XLSX Export Service — Mail Merge data source for LCPA
 *
 * Generates a workbook with two sheets (Semester 1 & Semester 2).
 * Column names use underscores so they work directly as Word Mail Merge fields.
 * Each row = one student, one semester (latest finalized report only).
 */

import * as XLSX from 'xlsx';

const HEADERS = [
  'Nama_Anak',
  'Kelompok',
  'Agama',
  'Jenis_Kelamin',
  'Tahun_Ajaran',
  'Narasi_Agama',
  'Narasi_Jati_Diri',
  'Narasi_STEAM',
  'Nama_Instansi',
  'Tanggal_Laporan',
];

function parseDate(raw) {
  try {
    if (!raw) return '';
    const d = raw.toDate ? raw.toDate()
            : raw._seconds ? new Date(raw._seconds * 1000)
            : new Date(raw);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}

function toRow(report, institutionName) {
  const m = report.studentMeta || {};
  const ai = report.aiNarrative || {};
  const tmpl = report.templateNarrative || {};

  return [
    report.studentName || '',
    m.ageGroup ? `Kelompok ${m.ageGroup}` : '',
    m.religion || '',
    m.gender === 'P' ? 'Perempuan' : m.gender === 'L' ? 'Laki-laki' : '',
    report.academicYear || '',
    ai['agama-budi-pekerti']  || tmpl['agama-budi-pekerti']  || '',
    ai['jati-diri']           || tmpl['jati-diri']           || '',
    ai['literasi-steam']      || tmpl['literasi-steam']      || '',
    institutionName,
    parseDate(report.finalizedAt),
  ];
}

function buildSheet(rows) {
  const data = [HEADERS, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Column widths (in characters)
  ws['!cols'] = [
    { wch: 28 }, // Nama_Anak
    { wch: 13 }, // Kelompok
    { wch: 13 }, // Agama
    { wch: 13 }, // Jenis_Kelamin
    { wch: 14 }, // Tahun_Ajaran
    { wch: 70 }, // Narasi_Agama
    { wch: 70 }, // Narasi_Jati_Diri
    { wch: 70 }, // Narasi_STEAM
    { wch: 28 }, // Nama_Instansi
    { wch: 20 }, // Tanggal_Laporan
  ];

  return ws;
}

/**
 * Generate and trigger download of a Mail Merge-ready XLSX.
 *
 * @param {Array}  reports         - Array of finalized report objects from server
 * @param {string} institutionName - Shown in Nama_Instansi column and filename
 */
export function exportInstitutionToXlsx(reports, institutionName = 'Instansi') {
  const smt1Rows = reports.filter(r => r.semester === '1').map(r => toRow(r, institutionName));
  const smt2Rows = reports.filter(r => r.semester === '2').map(r => toRow(r, institutionName));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSheet(smt1Rows), 'Semester 1');
  XLSX.utils.book_append_sheet(wb, buildSheet(smt2Rows), 'Semester 2');

  const safeName = institutionName.replace(/[^\w\s-]/g, '').trim();
  const year = reports[0]?.academicYear || new Date().getFullYear();
  XLSX.writeFile(wb, `LCPA_${safeName}_${year}.xlsx`);
}

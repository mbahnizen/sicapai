/**
 * Gemini AI Service — Narrative paraphrasing with per-section pedagogical personas
 */

import { GoogleGenAI } from '@google/genai';

// ---- Core persona (universal) ----
const CORE_PERSONA = `Kamu adalah SiCAPAI, asisten penyusun narasi rapor PAUD/TK (Kurikulum Merdeka).

Tulis narasi perkembangan anak yang natural, observasional, dan profesional berdasarkan template capaian.
Rangkum secara ringkas tanpa menyebut seluruh indikator satu per satu, namun tetap representatif terhadap area perkembangan utama anak.
Gunakan tone hangat, positif, dan non-menghakimi seperti guru PAUD yang mengamati langsung kegiatan anak di kelas.

GAYA PENULISAN — gunakan pola ini:
❌ "Ananda memiliki kemampuan berbahasa yang sangat baik."
✅ "Dalam kegiatan bercerita, Ananda terlihat aktif menyampaikan pengalaman dan tidak ragu mengajukan pertanyaan."

❌ "Kecintaan Ananda pada buku sangat menonjol."
✅ "Saat kegiatan membaca bersama, Ananda tampak antusias mengikuti cerita dan memperhatikan gambar di buku."

❌ "Ananda menunjukkan kemampuan numerasi yang baik."
✅ "Dalam kegiatan berhitung, Ananda terlihat antusias menghitung benda satu per satu dan mulai mencoba operasi sederhana menggunakan alat bantu."

❌ "berbagai konsep ukuran seperti besar-kecil, panjang-pendek, tinggi-rendah"
✅ "berbagai konsep ukuran dasar"

❌ "Kegemaran Ananda pada seni sangat menonjol."
✅ "Kegiatan menggambar dan melukis menjadi salah satu yang paling dinikmati Ananda."

❌ "Ananda juga merespons dengan baik saat guru memberikan instruksi."
✅ "Saat guru memberikan instruksi, tampak Ananda mendengarkan dan segera merespons."

Prinsipnya berlaku terutama di AWAL paragraf: mulai dari situasi, kegiatan, atau minat anak → lalu deskripsikan perilaku yang terlihat.
Variasikan cara membuka paragraf — tidak semua harus dimulai dengan "Dalam/Saat kegiatan".

PANDUAN:
- Utamakan observasi perilaku dan aktivitas anak dibanding penilaian langsung — tulis apa yang terlihat, bukan hanya simpulkan kemampuan
- Gunakan gaya narasi seperti pengamatan guru di kelas, bukan evaluasi formal atau daftar kemampuan
- Gunakan "Ananda" sebagai sapaan utama — jangan buka kalimat baru dengan "ia" atau "dia"; omisi subjek atau variasi struktur lebih natural dari pengulangan "Ananda" terus-menerus
- Bahasa Indonesia baku; jangan mengubah atau menambah makna capaian di luar template
- Variasikan panjang kalimat — campurkan kalimat pendek dan panjang untuk ritme yang natural, tidak terlalu seragam
- Hindari transisi berulang: "selain itu", "di samping itu", "tak hanya itu", "Ananda juga" — variasikan struktur atau omisi subjek
- Hindari superlative berlebihan: ganti "sangat baik / luar biasa / pesat" dengan "baik", "konsisten", "mulai terlihat"
- Variasikan adjective keterlibatan: "antusias" tidak perlu selalu dipakai — alternatif: "menikmati", "tertarik", "bersemangat", "aktif terlibat", "senang mengikuti"
- Biarkan area perkembangan yang lebih kaya dalam template terasa sedikit lebih menonjol — tidak semua domain perlu terdengar sama kuat
- Penggabungan paragraf: gabungkan area satu domain (contoh: pra-membaca + pra-menulis); pisahkan area berbeda domain yang isinya padat (contoh: numerasi dan eksplorasi sains = paragraf terpisah)
- Jika relevan, boleh gunakan observasi situasional ringan yang sesuai konteks template — jangan mengarang aktivitas baru yang tidak tersirat
- Pangkas verbositas dan repetisi, bukan jumlah paragraf — biarkan struktur paragraf terbentuk natural sesuai topik
- Tutup narasi dengan satu kalimat hangat untuk orang tua — bisa saran spesifik, harapan, atau dukungan sederhana; tidak perlu multi-activity atau exhaustive
- Output: JSON valid saja, tidak ada teks lain`;

// ---- Per-section pedagogical personas ----
const SECTION_PERSONAS = {
  'agama-budi-pekerti': `Fokuskan pada pembiasaan nilai agama dan budi pekerti yang terjadi secara natural dalam keseharian anak.
Gunakan tone lembut dan reflektif — hindari bahasa yang menggurui atau terdengar seperti ceramah agama.`,

  'jati-diri': `Fokuskan pada perkembangan sosial-emosional, kemandirian, dan kepercayaan diri anak.
Gunakan tone suportif — soroti bagaimana anak beradaptasi dan berinteraksi dalam kegiatan belajar.`,

  'literasi-steam': `Fokuskan pada rasa ingin tahu, eksplorasi, dan keterlibatan anak dalam aktivitas literasi dan STEAM.
Gunakan tone deskriptif — soroti proses berpikir dan keantusiasan anak, bukan sekadar daftar kemampuan.`,

  'kokurikuler': `Ini adalah narasi kokurikuler (Profil Pelajar Pancasila) yang terdiri dari beberapa paragraf — setiap paragraf mewakili satu dimensi karakter anak.

STRUKTUR — wajib dipatuhi:
- Pertahankan jumlah paragraf SAMA PERSIS dengan template. Hitung paragraf di template (dipisahkan baris kosong), output harus menghasilkan jumlah yang sama.
- Jangan gabungkan dua paragraf berbeda menjadi satu blok. Jangan pisah satu paragraf menjadi dua.
- Jangan tambahkan kalimat penutup, kesimpulan, atau ringkasan di akhir — narasi berhenti setelah paragraf terakhir selesai.

PER PARAGRAF:
- Perindah kalimat agar lebih mengalir — uraikan repetisi "serta ... serta ..." menjadi kalimat-kalimat terpisah yang variatif; campurkan kalimat pendek dan panjang.
- Pertahankan atau perindah kata deskriptif hangat dari template (contoh: "menggembirakan", "mengagumkan", "menonjol"). JANGAN meratakan semua deskriptor menjadi kata "baik" — kata itu terlalu datar untuk narasi PAUD yang hangat dan personal.
- Mulai setiap paragraf dengan "Ananda [nama]". Di dalam paragraf, gunakan "Ananda" (tanpa nama) — DILARANG mengganti subjek kalimat mana pun dengan "ia", "dia", atau kata ganti orang ketiga lainnya.
- Jangan sebutkan nama dimensi secara eksplisit (misal: 'dimensi kemandirian', 'aspek kreativitas').
- Jangan tambahkan fakta, penilaian, atau aktivitas yang tidak ada di template paragraf tersebut.
- Gunakan bahasa hangat dan reflektif seperti guru yang mengamati anak secara langsung.`,
};

// ---- Retry config ----
const RETRYABLE_STATUS = new Set([429, 500, 503, 529]);
const RETRY_DELAYS_MS = [1000, 2500, 5000];

function extractJSON(text) {
  const closedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const openMatch = text.match(/```(?:json)?\s*([\s\S]+)/);
  const jsonStr = closedMatch?.[1]?.trim() ?? openMatch?.[1]?.trim() ?? text;
  return JSON.parse(jsonStr);
}

/**
 * Generate AI-enhanced narrative from template
 * @param {object} params
 * @param {string} params.ageGroup
 * @param {string} params.semester
 * @param {object} params.templateNarrative - { sectionId: templateText } (always single section)
 * @returns {Promise<object>} { sectionId: aiText }
 */
export async function generateAINarrative({ ageGroup, semester, templateNarrative }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const ai = new GoogleGenAI({ apiKey });

  // Derive section and compose layered system instruction
  const sectionId = Object.keys(templateNarrative)[0];
  const sectionPersona = SECTION_PERSONAS[sectionId];
  const systemInstruction = sectionPersona
    ? `${CORE_PERSONA}\n\n${sectionPersona}`
    : CORE_PERSONA;

  const sectionKeys = Object.keys(templateNarrative);
  const templateEntries = Object.entries(templateNarrative)
    .map(([id, text]) => `[${id}]\n${text}`)
    .join('\n\n');
  const formatExample = '{' + sectionKeys.map(k => `"${k}": "..."`).join(', ') + '}';

  const userPrompt = `Kelompok: ${ageGroup} | ${semester}

Template:
${templateEntries}

Balas HANYA JSON:
${formatExample}`;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      console.warn(`Gemini overloaded, retry ${attempt}/${RETRY_DELAYS_MS.length} setelah ${RETRY_DELAYS_MS[attempt - 1]}ms...`);
      await new Promise(r => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]));
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userPrompt,
        config: {
          systemInstruction,
          temperature: 0.7,
          maxOutputTokens: 8192,
        },
      });

      try {
        return extractJSON(response.text.trim());
      } catch {
        console.error('Failed to parse AI response:', response.text);
        throw new Error('AI menghasilkan format yang tidak valid. Silakan coba lagi.');
      }
    } catch (e) {
      const isParseError = e.message === 'AI menghasilkan format yang tidak valid. Silakan coba lagi.';
      const isRetryable = !isParseError && RETRYABLE_STATUS.has(e.status);
      if (isRetryable && attempt < RETRY_DELAYS_MS.length) continue;
      throw e;
    }
  }
}

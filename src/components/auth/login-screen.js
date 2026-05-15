/**
 * Login Screen Component
 */

import { showToast } from '../shared/toast.js';

export function renderLoginScreen(container, authService) {
  container.innerHTML = `
    <div class="login-screen">

      <!-- ===== LEFT BRAND PANEL ===== -->
      <div class="lp-left">
        <div class="lp-dot-grid"></div>
        <div class="lp-glow lp-glow-1"></div>
        <div class="lp-glow lp-glow-2"></div>

        <div class="lp-left-inner">
          <div class="lp-logo" aria-label="SiCAPAI">Si<span>CAPAI</span></div>
          <div class="lp-logo-sub">Sistem Catatan Capaian Anak</div>

          <div class="lp-hero">
            <span class="lp-badge">✦ Untuk guru PAUD &amp; TK</span>
            <h1 class="lp-title">Setiap anak memiliki<wbr> cerita perkembangan<wbr> yang berbeda</h1>
            <p class="lp-desc">SiCAPAI membantu guru menyusun narasi rapor yang hangat, personal, dan sesuai Kurikulum Merdeka — cukup dengan memilih capaian anak.</p>
          </div>

          <div class="lp-trust">
            <span class="lp-trust-item lp-trust-primary">Kurikulum Merdeka Fase Fondasi</span>
            <span class="lp-trust-dot">·</span>
            <span class="lp-trust-item">Permendikbudristek No. 5/2022</span>
            <span class="lp-trust-dot">·</span>
            <span class="lp-trust-item">SK BSKAP No. 033/H/KR/2022</span>
          </div>

          <div class="lp-mockup">
            <div class="lm-card">
              <div class="lm-header">
                <div class="lm-avatar">N</div>
                <div class="lm-info">
                  <div class="lm-name">Nadia Ramadhani</div>
                  <div class="lm-meta">Kelompok A &middot; Smt. 2</div>
                </div>
              </div>
              <div class="lm-ai-badge">✨ AI Draft</div>
              <p class="lm-narrative">&ldquo;Nadia mulai mampu menyampaikan pendapat dan perasaannya dengan percaya diri saat kegiatan bersama teman.&rdquo;</p>
              <div class="lm-tags">
                <span class="lm-tag lm-tag-active">Jati Diri</span>
                <span class="lm-tag lm-tag-3">Literasi &amp; STEAM</span>
              </div>
            </div>
            <div class="lm-chip">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="#2DD4BF" stroke-width="1.5"/>
                <path d="M5 8l2.5 2.5L11 5.5" stroke="#2DD4BF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Narasi siap ditinjau dalam hitungan menit
            </div>
          </div>

        </div>
      </div>

      <!-- ===== RIGHT LOGIN PANEL ===== -->
      <div class="lp-right">
        <div class="lp-right-inner">
          <div class="lp-card">
            <h2 class="lp-card-title">Mulai menyusun rapor anak</h2>
            <p class="lp-card-subtitle">Masuk dengan akun Google untuk mulai menyusun rapor anak</p>

            <button class="lp-google-btn" id="btn-google-login">
              <svg width="18" height="18" viewBox="0 0 48 48" style="flex-shrink:0">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Lanjutkan dengan Google
            </button>

            <p class="lp-card-trust">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Data siswa tersimpan aman dan hanya dapat diakses oleh instansi Anda
            </p>

            <div class="lp-card-footer">Mendukung penyusunan rapor PAUD &amp; TK sesuai Kurikulum Merdeka</div>
          </div>
        </div>
      </div>

    </div>
  `;

  const style = document.createElement('style');
  style.textContent = `
    /* ===== BASE ===== */
    .login-screen {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* ===== LEFT PANEL ===== */
    .lp-left {
      position: relative;
      background: linear-gradient(150deg, #042F2E 0%, #134E4A 55%, #052C2A 100%);
      overflow: hidden;
      display: flex;
      min-height: auto;
      align-items: flex-start;
      justify-content: flex-start;
    }

    .lp-dot-grid {
      position: absolute;
      inset: 0;
      background-image: radial-gradient(circle, rgba(255,255,255,0.045) 1px, transparent 1px);
      background-size: 28px 28px;
      pointer-events: none;
    }

    .lp-glow {
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
      filter: blur(90px);
    }
    .lp-glow-1 {
      width: 520px; height: 520px;
      background: radial-gradient(circle, rgba(13,148,136,0.35) 0%, transparent 70%);
      top: -140px; left: -140px;
    }
    .lp-glow-2 {
      width: 380px; height: 380px;
      background: radial-gradient(circle, rgba(244,63,94,0.2) 0%, transparent 70%);
      bottom: -100px; right: -100px;
    }

    .lp-left-inner {
      position: relative;
      z-index: 1;
      padding: 36px 28px 104px;
      max-width: 560px;
      width: 100%;
    }

    .lp-logo {
      font-size: 1.5rem;
      font-weight: 800;
      color: #FFFFFF;
      letter-spacing: -0.02em;
      margin-bottom: 4px;
    }
    .lp-logo span { color: var(--primary); }

    .lp-logo-sub {
      font-size: 11px;
      color: rgba(255,255,255,0.35);
      letter-spacing: 0.04em;
      margin-bottom: 44px;
    }

    .lp-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.02em;
      color: rgba(94,234,212,0.9);
      background: rgba(13,148,136,0.14);
      border: 1px solid rgba(13,148,136,0.28);
      border-radius: var(--radius-full);
      padding: 5px 14px;
      margin-bottom: 20px;
    }

    .lp-title {
      font-size: 2.05rem;
      font-weight: 800;
      color: #FFFFFF;
      line-height: 1.2;
      letter-spacing: -0.03em;
      margin-bottom: 16px;
    }

    .lp-desc {
      font-size: 1.0625rem;
      color: rgba(255,255,255,0.5);
      line-height: 1.75;
      max-width: 400px;
      margin-bottom: 12px;
      display: none;
    }

    /* ===== TRUST STRIP ===== */
    .lp-trust {
      display: none;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px 8px;
      margin-bottom: 28px;
    }
    .lp-trust-item {
      font-size: 13px;
      font-weight: 400;
      color: rgba(255,255,255,0.42);
      white-space: nowrap;
    }
    .lp-trust-primary {
      color: rgba(255,255,255,0.62);
      font-weight: 500;
    }
    .lp-trust-dot {
      font-size: 13px;
      color: rgba(255,255,255,0.2);
    }

    /* ===== MOCKUP ===== */
    .lp-mockup {
      position: relative;
      padding-bottom: 52px;
      display: block;
      max-width: 290px;
      margin: 24px auto 0;
    }


    .lm-card {
      background: rgba(255,255,255,0.065);
      border: 1px solid rgba(255,255,255,0.10);
      border-radius: var(--radius-xl);
      padding: 20px;
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      transform: rotate(-1.5deg);
      box-shadow: 0 32px 64px rgba(0,0,0,0.45), 0 8px 20px rgba(0,0,0,0.3);
    }

    .lm-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 14px;
    }

    .lm-avatar {
      width: 38px; height: 38px; min-width: 38px;
      border-radius: 50%;
      background: linear-gradient(135deg, #0D9488, #2DD4BF);
      color: #fff;
      font-weight: 700;
      font-size: 15px;
      display: flex; align-items: center; justify-content: center;
    }

    .lm-info { flex: 1; min-width: 0; }
    .lm-name { color: rgba(255,255,255,0.9); font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .lm-meta { color: rgba(255,255,255,0.38); font-size: 12px; margin-top: 2px; }

    .lm-status {
      flex-shrink: 0;
      font-size: 11px;
      font-weight: 600;
      color: #2DD4BF;
      background: rgba(45,212,191,0.12);
      border: 1px solid rgba(45,212,191,0.22);
      border-radius: var(--radius-full);
      padding: 3px 10px;
    }

    .lm-section-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: rgba(94,234,212,0.7);
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .lm-ai-tag {
      font-size: 10px;
      font-weight: 600;
      background: rgba(167,139,250,0.15);
      color: rgba(196,181,253,0.9);
      border: 1px solid rgba(167,139,250,0.2);
      border-radius: var(--radius-full);
      padding: 1px 7px;
      text-transform: none;
      letter-spacing: 0;
    }

    .lm-ai-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      font-weight: 600;
      background: rgba(167,139,250,0.15);
      color: rgba(196,181,253,0.9);
      border: 1px solid rgba(167,139,250,0.2);
      border-radius: var(--radius-full);
      padding: 3px 10px;
      margin-bottom: 12px;
    }

    .lm-narrative {
      font-size: 13px;
      color: rgba(255,255,255,0.84);
      line-height: 1.72;
      margin-bottom: 14px;
      font-style: italic;
    }

    .lm-text {
      font-size: 13px;
      color: rgba(255,255,255,0.48);
      line-height: 1.65;
      margin-bottom: 14px;
    }

    .lm-tags { display: flex; flex-wrap: wrap; gap: 6px; }

    .lm-tag {
      font-size: 11px; font-weight: 500;
      padding: 3px 10px;
      border-radius: var(--radius-full);
      background: rgba(13,148,136,0.18); color: rgba(94,234,212,0.9); border: 1px solid rgba(13,148,136,0.2);
    }
    .lm-tag-active { background: rgba(45,212,191,0.2); color: #2DD4BF; border-color: rgba(45,212,191,0.4); font-weight: 700; }
    .lm-tag-3 { background: rgba(245,158,11,0.12); color: rgba(252,211,77,0.9); border-color: rgba(245,158,11,0.18); }

    .lm-chip {
      position: absolute;
      bottom: 8px;
      right: -8px;
      background: rgba(5, 34, 32, 0.80);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      color: rgba(255,255,255,0.88);
      font-size: 12px;
      font-weight: 500;
      border-radius: 14px;
      border: 1px solid rgba(45,212,191,0.14);
      padding: 8px 13px;
      display: flex; align-items: center; gap: 7px;
      box-shadow: 0 6px 28px rgba(0,0,0,0.20), 0 0 16px rgba(45,212,191,0.06), inset 0 1px 0 rgba(255,255,255,0.07);
      animation: chipFloat 3.5s ease-in-out infinite;
      white-space: nowrap;
    }

    .lm-chip svg {
      filter: drop-shadow(0 0 3px rgba(45,212,191,0.55));
      flex-shrink: 0;
    }

    @keyframes chipFloat {
      0%, 100% { transform: translateY(0); }
      50%       { transform: translateY(-6px); }
    }

    /* ===== RIGHT PANEL ===== */
    .lp-right {
      flex: 1;
      background: linear-gradient(160deg, #F0FDFA 0%, #FFFFFF 55%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 24px 48px;
      min-height: auto;
      border-radius: 14px 14px 0 0;
      margin-top: -52px;
      z-index: 1;
      box-shadow: 0 -10px 44px rgba(0,0,0,0.18);
    }

    [data-theme="dark"] .lp-right {
      background: linear-gradient(160deg, #0A1A18 0%, #060F0E 55%);
    }

    .lp-right-inner {
      width: 100%;
      max-width: 380px;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-top: 64px;
    }

    /* ===== CARD ===== */
    .lp-card {
      width: 100%;
      background: var(--bg-card);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-2xl);
      padding: 28px 24px;
      box-shadow: 0 4px 40px rgba(13,148,136,0.07), 0 1px 4px rgba(0,0,0,0.04);
      text-align: left;
      animation: cardEntrance 0.55s cubic-bezier(0.34,1.56,0.64,1) both;
    }

    @keyframes cardEntrance {
      from { opacity: 0; transform: translateY(24px) scale(0.96); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    .lp-card-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
      letter-spacing: -0.025em;
      margin-bottom: 8px;
    }

    .lp-card-subtitle {
      font-size: 14px;
      color: var(--text-tertiary);
      line-height: 1.5;
      margin-bottom: 32px;
    }

    .lp-google-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 16px 24px;
      font-size: 15px;
      font-weight: 600;
      font-family: var(--font-family);
      cursor: pointer;
      background: var(--bg-card);
      color: var(--text-primary);
      border: 1.5px solid var(--border-color);
      border-radius: var(--radius-lg);
      transition: all var(--transition-fast);
      box-shadow: 0 1px 4px rgba(0,0,0,0.05);
    }

    .lp-google-btn:hover:not(:disabled) {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px var(--primary-glow), 0 2px 8px rgba(0,0,0,0.07);
      transform: translateY(-1px);
    }

    .lp-google-btn:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: none;
    }

    .lp-google-btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .lp-card-trust {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 14px;
      font-size: 12px;
      color: var(--text-tertiary);
      line-height: 1.5;
      text-align: left;
    }
    .lp-card-footer {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid var(--border-light);
      font-size: 12px;
      color: var(--text-tertiary);
      line-height: 1.5;
    }

    /* ===== DESKTOP OVERRIDES ===== */
    @media (min-width: 768px) {
      .login-screen { flex-direction: row; }

      .lp-left {
        flex: 1.1;
        min-height: 100vh;
        align-items: center;
        justify-content: center;
      }

      .lp-left-inner { padding: 56px 48px; }

      .lp-title { font-size: 2.5rem; line-height: 1.18; letter-spacing: -0.035em; }

      .lp-desc { display: block; }
      .lp-trust { display: flex; }
      .lp-mockup { display: block; max-width: none; margin: 0; padding-bottom: 32px; }

      .lp-right {
        flex: 0.9;
        min-height: 100vh;
        border-radius: 0;
        margin-top: 0;
        box-shadow: none;
        padding: 32px 24px;
      }

      .lp-right-inner { padding-top: 0; }
      .lp-card { padding: 40px 32px; text-align: center; }
    }
  `;
  container.appendChild(style);

  container.querySelector('#btn-google-login').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>Menghubungkan&hellip;</span>';

    try {
      await authService.signInWithGoogle();
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
  });

  const CLIENT_ID = '667682428659-b137ifvd6hfhlt3tuu8p25tk3stdq9jl.apps.googleusercontent.com';
  if (typeof authService.initOneTap === 'function') {
    setTimeout(() => authService.initOneTap(CLIENT_ID), 500);
  }
}

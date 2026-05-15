# SiCAPAI — Final Execution Plan (Revised)

> Incorporates all pre-implementation audits. Ready to execute.

---

## Pre-Implementation Audit Results

### Audit 1: Git History — No git repository

```
fatal: not a git repository (or any of the parent directories): .git
```

**No git exists.** This means:
- `service-account.json` — **no leaked history**, but file exists on disk at `server/service-account.json`. Risk is local only.
- `.env` with `GEMINI_API_KEY=AIzaSyD48...` — **not leaked via git**. File excluded in `.dockerignore`.
- **Recommendation:** Initialize git BEFORE deploying. Add to `.gitignore` immediately. Current secrets are safe from git history exposure.

---

### Audit 2: Toast System

**Uses `innerHTML`.** Line 35-38 in `toast.js`:
```js
toast.innerHTML = `
  <span class="toast-icon">${icons[type]}</span>
  <span class="toast-message">${message}</span>
`;
```

**`message` param comes from callers.** 47 call sites found. Categories:

| Category | Count | Example | Risk |
|----------|-------|---------|------|
| Static string | 33 | `'Narasi berhasil diperindah! ✨'` | ✅ Safe |
| `err.message` (server error) | 9 | `showToast(err.message, 'error')` | 🟡 Low — server returns controlled messages |
| **User data interpolation** | **5** | `showToast(\`Siswa "${student.name}" berhasil...\`)` | 🔴 **XSS** |

**Dangerous toast callers (5):**
1. L682: `showToast(\`Siswa "${student.name}" berhasil dihapus.\`, 'success')`
2. L1848: `showToast(\`Instansi "${name}" berhasil dibuat! 🎉\`, 'success')`
3. L2017: `showToast(\`Siswa "${name}" ditambahkan (mode offline)\`, 'success')`
4. L2033: `showToast(\`Siswa "${name}" berhasil ditambahkan! 🎉\`, 'success')`
5. L2111: `showToast(\`Berhasil bergabung ke "${inst.name}"! 🎉\`, 'success')`

**Decision:** Convert toast to `textContent`-only. The `icons[type]` is emoji (plaintext), so `textContent` works. No caller needs HTML in toasts.

---

### Audit 3: Modal API — Who Needs HTML?

5 callers of `showConfirmDialog`:

| Line | `title` | `message` | Needs HTML? |
|------|---------|-----------|-------------|
| L652 | `'Hapus Siswa?'` (static) | `\`Data "${student.name}"...\`` — **no HTML**, just quotes | ❌ No |
| L925 | `'Finalisasi Laporan...'` (static) | Uses `<br>`, `<strong>`, `<em>` with `${state.selectedStudent.name}` | ✅ **YES** |
| L1131 | `'Mulai Ulang Progress?'` (static) | Uses `<strong>${state.selectedStudent.name}</strong>` | ✅ **YES** |
| L2808 | `\`Keluar dari "${currentDetails.name}"?\`` | Static message (no HTML) | ❌ No — but `title` has user data |
| L2847 | `\`Hapus "${currentDetails.name}"?\`` | Static message (no HTML) | ❌ No — but `title` has user data |

**2 of 5 callers** genuinely use HTML in `message` (L925 finalize, L1131 reset).  
**3 of 5** use plaintext with user data in `title` and/or `message`.

**Decision:** Don't refactor modal to plaintext-only. Instead:
- `title` → always rendered via `textContent` (set after innerHTML)
- `message` → keep as `innerHTML` but require callers to pre-escape user data
- Add explicit `unsafeMessage` naming convention in code comments

Concrete approach for `modal.js`:
```js
// After innerHTML creates the DOM structure:
backdrop.querySelector('#cd-title').textContent = title;
// message stays as innerHTML — callers must escape user data within it
```

This way `title` is **always safe** (textContent), and `message` is the explicit "I accept the risk" path.

---

### Audit 4: Payload Snapshot — What Data Flows Where

| Surface | Data Source | User-Controlled Fields | Current Escaping | Risk |
|---------|-----------|----------------------|-----------------|------|
| **Preview panel** | `state.templateResult` + `state.aiResult` | Narrative text (from template engine / Gemini AI) + `studentName` | ❌ None | 🔴 XSS |
| **Report viewer modal** | `report` object from Firestore | `studentName`, `studentMeta`, narrative text, `institutionName` | ❌ None | 🔴 XSS |
| **Draft preview modal** | Same as preview + paragraph split | Narrative split into `<p>` tags | ❌ None | 🔴 XSS |
| **Archive viewer** | `reports[]` from server | `studentName`, `academicYear`, `finalizedAt` | ❌ None (but low dynamic content) | 🟡 Low |
| **Print export** | `reportData` object | `studentName`, `institutionName`, narrative text | ✅ `escapeHTML()` | ✅ Safe |
| **DOCX export** | `reportData` object | Same as print | ✅ `TextRun` (auto-escapes) | ✅ Safe |
| **XLSX export** | `reports[]` from server | `studentName`, narrative text, `institutionName` | ❌ None (formula injection) | 🟡 Formula |

**Key insight:** Print and DOCX are already safe. The 4 browser-rendered surfaces are all vulnerable. XLSX has formula injection only.

---

### Audit 5: Naming & Strategy Revisions

| Original Plan | Revised | Rationale |
|--------------|---------|-----------|
| `esc()` in `utils/escape.js` | `escapeHTML()` + `escapeAttr()` in `src/utils/sanitize.js` | Explicit naming. `escapeAttr` covers `"` and `'` for attribute contexts. Matches existing `escapeHTML` name in `report-export.js`. |
| CSP enforce immediately | CSP `report-only` first, enforce in Phase B | Avoids login breakage. Collects violations in console without blocking. |
| No explicit unsafe path | Add `unsafeHTML` comments on `message` param in modal | Documents the trust boundary for future developers. |

---

## Final Commit Plan (6 Commits)

### Commit 1: `feat(security): add sanitize utility module`

| Item | Detail |
|------|--------|
| **Files** | `src/utils/sanitize.js` [NEW] |
| **LOC** | ~20 |
| **Risk** | 🟢 Zero — new file, nothing imports it yet |
| **Hotfix safe?** | ✅ |

```js
// src/utils/sanitize.js

/**
 * Escape HTML entities for safe insertion into innerHTML.
 * Use for text content that should NEVER be interpreted as HTML.
 */
export function escapeHTML(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escape a string for safe use inside HTML attribute values.
 * Covers quote-breakout and tag injection.
 * Identical to escapeHTML — separated for semantic clarity.
 */
export const escapeAttr = escapeHTML;

/**
 * Sanitize cell value to prevent Excel formula injection.
 * Prefixes dangerous-start strings with ' (single quote).
 */
export function sanitizeXlsxCell(val) {
  if (typeof val !== 'string') return val;
  if (/^[=+\-@\t\r]/.test(val)) return "'" + val;
  return val;
}
```

**Testing:**
- [ ] Module imports without error
- [ ] `escapeHTML('<b>bold</b>')` → `'&lt;b&gt;bold&lt;/b&gt;'`
- [ ] `escapeHTML(null)` → `''`
- [ ] `escapeAttr('" onfocus="alert(1)')` → `'&quot; onfocus=&quot;alert(1)'`
- [ ] `sanitizeXlsxCell('=SUM(A1)')` → `"'=SUM(A1)"`
- [ ] `sanitizeXlsxCell('Normal text')` → `'Normal text'`
- [ ] App loads without errors

---

### Commit 2: `fix(xss): harden toast and modal against injection`

| Item | Detail |
|------|--------|
| **Files** | `src/components/shared/toast.js`, `src/components/shared/modal.js` |
| **LOC** | ~15 |
| **Risk** | 🟢 Very low — toast becomes safer, modal title becomes safer |
| **Hotfix safe?** | ✅ |

#### `toast.js` — Switch to textContent

```js
// BEFORE (line 35-38):
toast.innerHTML = `
  <span class="toast-icon">${icons[type]}</span>
  <span class="toast-message">${message}</span>
`;

// AFTER:
const iconSpan = document.createElement('span');
iconSpan.className = 'toast-icon';
iconSpan.textContent = icons[type];

const msgSpan = document.createElement('span');
msgSpan.className = 'toast-message';
msgSpan.textContent = message;

toast.appendChild(iconSpan);
toast.appendChild(msgSpan);
```

This makes ALL toast callers safe regardless of input. No caller needs to change.

#### `modal.js` — Protect title via textContent, document message as unsafe

```js
// showConfirmDialog — AFTER innerHTML creates structure (line 28+):
// Override title with textContent (safe regardless of input):
backdrop.querySelector('#cd-title').textContent = title;
// NOTE: `message` remains innerHTML — callers MUST escape user data.
// This is an intentional unsafeHTML path for callers that need <br>/<strong>.

// showModal — same pattern (line 66+):
backdrop.querySelector('.modal-title').textContent = title;
```

**Testing:**
- [ ] Toast with `<script>alert(1)</script>` in message → shows literal text, no XSS
- [ ] Toast with emoji → displays correctly
- [ ] Confirm dialog with HTML in title → shows literal tags (textContent)
- [ ] Confirm dialog with `<strong>` in message → renders bold (intentional)
- [ ] All existing toasts display correctly
- [ ] Finalize confirm shows student name in bold
- [ ] Reset confirm shows student name in bold

---

### Commit 3: `fix(xss): escape all user data in innerHTML interpolations`

| Item | Detail |
|------|--------|
| **Files** | `src/components/layout/app-shell.js`, `src/components/report/preview.js` |
| **LOC** | ~70 |
| **Risk** | 🟡 Low-Medium — most changes, needs visual QA |
| **Hotfix safe?** | ⚠️ Needs visual testing |

#### `app-shell.js` changes:

**Line 1 area:** Add import
```js
import { escapeHTML, escapeAttr } from '../../utils/sanitize.js';
```

**26 interpolation sites** — categorized by fix type:

**Type A: Text content → `escapeHTML()`** (19 sites)
```
L525:  ${escapeHTML(s.name)}
L526:  ${escapeHTML(s.nickname || s.name.split(' ')[0])}
L654:  Data "${escapeHTML(student.name)}" dan seluruh...
L682:  (toast call — already safe from Commit 2)
L796:  ${escapeHTML(state.selectedStudent.name)}
L927:  ${escapeHTML(state.selectedStudent.name)} (inside <strong> — OK, strong is our HTML)
L1000: ${escapeHTML(studentName)}
L1133: ${escapeHTML(state.selectedStudent.name)} (inside <strong> — OK)
L1284: ${escapeHTML(studentName)}
L1500: ${escapeHTML(report.studentName || '-')}
L1584: ${escapeHTML(s.nickname || s.name)}
L1598: ${escapeHTML(state.selectedStudent.nickname || ...name)}
L1848: (toast — safe from Commit 2)
L1886: ${escapeHTML(inst.name)}
L2111: (toast — safe from Commit 2)
L2682: ${escapeHTML(currentDetails.name)}
L2684: ${escapeHTML(currentDetails.address)}
L2713: ${escapeHTML(m.name)}
L2715: ${escapeHTML(m.email)}
L2809: title: `Keluar dari "${escapeHTML(currentDetails.name)}"?`
       (title now uses textContent from Commit 2 — double-safe)
L2823: (toast — safe from Commit 2)
L2848: title: `Hapus "${escapeHTML(currentDetails.name)}"?`
       (same — textContent from Commit 2)
```

**Type B: Attribute value → `escapeAttr()`** (4 sites)
```
L573:  value="${escapeAttr(student.name)}"
L577:  value="${escapeAttr(student.nickname || '')}"
L2693: value="${escapeAttr(currentDetails.name)}"
L2697: value="${escapeAttr(currentDetails.address || '')}"
```

#### `preview.js` changes:

**Line 1 area:** Add import
```js
import { escapeHTML } from '../../utils/sanitize.js';
```

**3 sites:**
```
L86:  <div class="preview-narrative ...">${escapeHTML(displayText)}</div>
L632: ${paragraphs.map(p => `<p>${escapeHTML(p)}</p>`).join('')}
L649: ${escapeHTML(studentName)}
```

#### `app-shell.js` — report viewer (line 1483):
```
L1483: <p class="rv-section-text">${escapeHTML(text)}</p>
```

**Testing:**
- [ ] XSS payload in student name → escaped in all screens
- [ ] XSS payload in institution name → escaped in picker/settings
- [ ] Normal names display correctly everywhere
- [ ] Narrative with `&`, `<`, `>` renders as visible characters
- [ ] Narrative with newlines → `pre-wrap` preserves line breaks
- [ ] AI generation → result displays correctly in preview
- [ ] Finalize report → achievement shows name correctly
- [ ] Report viewer → narrative renders correctly
- [ ] Copy capaian modal → names display correctly
- [ ] Institution settings → member names/emails display correctly
- [ ] Rename modal → existing name appears in input correctly
- [ ] Edit institution → name/address appears in input correctly

---

### Commit 4: `fix(idor): add membership check to progress routes`

| Item | Detail |
|------|--------|
| **File** | `server/routes/progress.js` |
| **LOC** | ~15 |
| **Risk** | 🟡 Low |
| **Hotfix safe?** | ✅ Server-only |

```js
import { db, checkMembership } from '../middleware/auth.js';

// Helper — verify student belongs to user's institution
async function verifyStudentAccess(uid, studentId) {
  const studentDoc = await db.collection('students').doc(studentId).get();
  if (!studentDoc.exists) return false;
  return checkMembership(uid, studentDoc.data().institutionId);
}

// In each handler, add before main logic:
const hasAccess = await verifyStudentAccess(req.user.uid, req.params.studentId);
if (!hasAccess) return res.status(403).json({ message: 'Akses ditolak' });
```

**Testing:**
- [ ] Select student → progress loads (normal flow)
- [ ] Check indicators → progress saves (POST)
- [ ] Reset progress → progress deleted (DELETE)
- [ ] Newly created student → GET returns null (not crash)
- [ ] Cross-institution access → 403

---

### Commit 5: `fix(security): XLSX formula prevention + uniform error responses`

| Item | Detail |
|------|--------|
| **Files** | `src/services/report-xlsx.js`, `server/routes/students.js`, `server/routes/institutions.js`, `server/routes/reports.js` |
| **LOC** | ~20 |
| **Risk** | 🟢 Low |
| **Hotfix safe?** | ✅ |

#### `report-xlsx.js` — Use `sanitizeXlsxCell`:
```js
import { sanitizeXlsxCell } from '../utils/sanitize.js';

// In toRow(), lines 47-49:
sanitizeXlsxCell(ai['agama-budi-pekerti'] || tmpl['agama-budi-pekerti'] || ''),
sanitizeXlsxCell(ai['jati-diri']          || tmpl['jati-diri']          || ''),
sanitizeXlsxCell(ai['literasi-steam']     || tmpl['literasi-steam']     || ''),
```

#### Server uniform 403 — merge 404+403:
```js
// students.js L47,72: change status(404) → status(403), message → 'Akses ditolak'
// institutions.js L214,238,269: same
// reports.js L78: same
```

**Testing:**
- [ ] XLSX export → narratives display as text in Excel
- [ ] Narrative starting with `=` → not interpreted as formula
- [ ] Mail Merge reads file correctly
- [ ] Delete non-existent student → 403 (not 404)
- [ ] PUT unauthorized student → 403 (same message)

---

### Commit 6: `feat(security): CSP report-only + Firestore deny-all rules`

| Item | Detail |
|------|--------|
| **Files** | `server/index.js`, `firestore.rules` [NEW] |
| **LOC** | ~25 |
| **Risk** | 🟠 Medium — CSP report-only is safe, but watch for false positives |
| **Hotfix safe?** | ⚠️ CSP needs monitoring. Rules are safe. |

#### `server/index.js` — CSP in report-only mode:

```js
const isProduction = process.env.NODE_ENV === 'production';

app.use(helmet({
  contentSecurityPolicy: isProduction ? {
    reportOnly: true,  // ← REPORT-ONLY: logs violations, does NOT block
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://accounts.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://*.googleusercontent.com"],
      connectSrc: [
        "'self'",
        "https://identitytoolkit.googleapis.com",
        "https://securetoken.googleapis.com",
      ],
      frameSrc: ["https://accounts.google.com"],
    },
  } : false,
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false,
}));
```

**Why report-only:** Logs CSP violations to browser console without blocking anything. After deploying, check console for any violations I missed. Once clean, switch `reportOnly: true` → remove it (enforce mode) in Phase B.

#### `firestore.rules` [NEW]:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**Testing:**
- [ ] Login with Google works (both paths)
- [ ] Google fonts load
- [ ] Profile photos load
- [ ] Browser console: check for `[Report Only]` CSP violations
- [ ] If violations found → note them for directive adjustment
- [ ] App functions normally (Admin SDK bypasses rules)
- [ ] AI generation works
- [ ] Finalize report works

---

## Execution Summary

| # | Commit | Files | LOC | Risk | Breaks Auth? |
|---|--------|-------|-----|------|-------------|
| 1 | Sanitize utility | 1 new | 20 | 🟢 Zero | No |
| 2 | Toast + Modal hardening | 2 mod | 15 | 🟢 Very Low | No |
| 3 | innerHTML escaping (main patch) | 2 mod | 70 | 🟡 Low-Med | No |
| 4 | Progress IDOR fix | 1 mod | 15 | 🟡 Low | No |
| 5 | XLSX + uniform errors | 4 mod | 20 | 🟢 Low | No |
| 6 | CSP report-only + rules | 2 (1 new, 1 mod) | 25 | 🟠 Medium | ⚠️ Monitor |

**Total: ~165 LOC, 8 files (6 modified, 2 new)**  
**Execution order: 1 → 2 → 3 → 4 → 5 → 6**  
**Estimated time: 2-3 hours including testing**

---

## What NOT to Touch

| File | Reason |
|------|--------|
| `auth.js` | Auth flow is correct and complex. Zero changes needed. |
| `login-screen.js` | All static HTML. No user data interpolation. |
| `report-export.js` | Already has `escapeHTML()`. Do NOT consolidate with new utility — different module, private function, works fine. |
| `report-export-docx.js` | Uses `TextRun` which auto-escapes. Safe. |
| `checklist.js` | Only hardcoded curriculum data. No user input. |
| `gemini.js` | Prompt is locked. Don't touch. |
| `quota.js` | Server quota logic. Not in scope. |

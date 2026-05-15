# SiCAPAI — Security Audit Phase 2 (Deep Dive)

> Opinionated & practical. Not textbook OWASP.  
> Date: 2026-05-15. Auditor: Antigravity.

---

## §1. innerHTML Categorization

Every `innerHTML` assignment in `src/` classified into 4 categories.

### 🔴 DANGEROUS — User data interpolated without escaping

These are **exploitable XSS vectors**. User-controlled strings (`name`, `nickname`, `address`, `email`, narrative text) are injected into HTML.

| File | Line | Interpolated Data | Attack Vector |
|------|------|-------------------|---------------|
| `app-shell.js` | 525 | `${s.name}` | Student name in sidebar list |
| `app-shell.js` | 526 | `${s.nickname \|\| s.name.split(' ')[0]}` | Nickname in sidebar meta |
| `app-shell.js` | 573 | `value="${student.name}"` | Attribute breakout (see §2) |
| `app-shell.js` | 577 | `value="${student.nickname}"` | Attribute breakout (see §2) |
| `app-shell.js` | 654 | `"${student.name}"` in confirm dialog message | Name in delete confirmation |
| `app-shell.js` | 796 | `${state.selectedStudent.name}` | Report header H2 |
| `app-shell.js` | 1000 | `${studentName}` | Archive modal subtitle |
| `app-shell.js` | 1133 | `${state.selectedStudent.name}` | Reset progress confirm |
| `app-shell.js` | 1284 | `${studentName}` | Achievement panel |
| `app-shell.js` | 1500 | `${report.studentName}` | Report viewer modal |
| `app-shell.js` | 1584 | `${s.nickname \|\| s.name}` | Copy capaian modal |
| `app-shell.js` | 1598 | `${state.selectedStudent.nickname \|\| ...name}` | Copy capaian subtitle |
| `app-shell.js` | 1848 | `showToast("${name}")` | Toast after create institution |
| `app-shell.js` | 1886 | `${inst.name}` | Institution picker list |
| `app-shell.js` | 2682 | `${currentDetails.name}` | Institution settings card |
| `app-shell.js` | 2684 | `${currentDetails.address}` | Address in settings |
| `app-shell.js` | 2693 | `value="${currentDetails.name}"` | Edit inst input attribute breakout |
| `app-shell.js` | 2697 | `value="${currentDetails.address}"` | Edit inst address attribute breakout |
| `app-shell.js` | 2713 | `${m.name}` | Member name in inst settings |
| `app-shell.js` | 2715 | `${m.email}` | Member email in inst settings |
| `preview.js` | 86 | `${displayText}` | **Narrative text** (template or AI) |
| `preview.js` | 632 | `${p}` in `<p>${p}</p>` | Paragraph in draft preview |
| `preview.js` | 649 | `${studentName}` | Draft preview subtitle |
| `app-shell.js` | 1483 | `${text}` | Report viewer section text |
| `modal.js` | 21-22 | `${title}`, `${message}` | Confirm dialog title & message |
| `modal.js` | 61 | `${title}` | Generic modal title |

**Total: 26 dangerous interpolations.**

### 🟡 REQUIRES CONTROLLED HTML — Static UI with dynamic structure

These use `innerHTML` to build controlled HTML (SVGs, buttons, layout) where interpolated values are from internal state only (array indices, boolean flags, section IDs from hardcoded constants). Safe **as long as** the data source remains internal.

| File | Line | Purpose | Safe Because |
|------|------|---------|-------------|
| `app-shell.js` | 97 | App shell skeleton | All static HTML |
| `app-shell.js` | 789 | Report main panel layout | Semester/year from `<select>` (constrained) |
| `app-shell.js` | 995 | Archive modal skeleton | Static structure |
| `app-shell.js` | 1278 | Achievement state | Uses `studentName` ← **DANGEROUS, listed above** |
| `preview.js` | 102 | Preview panel with sections | Section IDs from `ELEMENT_META` (hardcoded) |
| `checklist.js` | 33 | Checklist accordion | Indicator IDs from hardcoded curriculum data |
| `app-shell.js` | 1804 | Create institution form | All static inputs |
| `app-shell.js` | 1939 | Add student form | All static inputs |
| `app-shell.js` | 2086 | Join institution form | All static inputs |

### 🟢 SAFE — Static HTML only, no interpolation

| File | Line | Purpose |
|------|------|---------|
| `main.js` | 44 | `innerHTML = ''` — clearing container |
| `app-shell.js` | 1256 | `innerHTML = ''` — clearing panel |
| `app-shell.js` | 375 | Empty state (static text only) |
| `app-shell.js` | 470 | Loading spinner (static) |
| `app-shell.js` | 480 | Error state (static) |
| `app-shell.js` | 499 | No-students empty state (static) |
| `app-shell.js` | 672 | Post-delete empty state (static) |
| `app-shell.js` | 1037 | Archive loading/empty state (static) |
| `app-shell.js` | 1096 | Archive error state (static) |
| `app-shell.js` | 1856 | Post-create welcome (static) |
| `login-screen.js` | 8 | Entire login page (static) |
| `toast.js` | 35 | Toast message — **⚠️ receives `message` param, could be dangerous if user-controlled strings are passed** |

### 🔵 REPLACEABLE — Button state swaps (use textContent instead)

These swap button content between states. Could use `textContent` for text-only states, but the SVG states genuinely need `innerHTML`.

| File | Line | Current | Can Replace? |
|------|------|---------|-------------|
| `app-shell.js` | 982 | Finalize button restore (SVG + text) | No — needs SVG |
| `app-shell.js` | 1915 | Spinner in gear button | No — needs HTML spinner |
| `app-shell.js` | 1923 | Restore gear SVG | No — needs SVG |
| `app-shell.js` | 2649 | Export spinner | No — needs HTML spinner |
| `app-shell.js` | 2664 | Restore download SVG | No — needs SVG |
| `preview.js` | 285 | AI button spinner | No — needs HTML spinner |
| `preview.js` | 290 | Restore AI button | No — needs SVG |
| `preview.js` | 693 | Copy button "✓ Disalin" | **YES** — use `textContent` |
| `preview.js` | 696 | Restore copy button | No — needs SVG |

---

## §2. Dangerous Attribute Interpolation

### `value="${...}"` — Attribute Breakout XSS

| File | Line | Code | Payload |
|------|------|------|---------|
| `app-shell.js` | 573 | `value="${student.name}"` | `" onfocus="alert(1)` → breaks out of `value`, adds event handler |
| `app-shell.js` | 577 | `value="${student.nickname \|\| ''}"` | Same attack |
| `app-shell.js` | 2693 | `value="${currentDetails.name}"` | Institution name with `"` breaks attribute |
| `app-shell.js` | 2697 | `value="${currentDetails.address \|\| ''}"` | Address with `"` breaks attribute |

**Fix:** Escape `"` → `&quot;` in all attribute interpolations, or use `el.value = data` after DOM creation.

### `data-id="${...}"` — Low risk

| File | Lines | Source |
|------|-------|--------|
| `app-shell.js` | 522, 529, 532, 1884, 1888 | Firestore auto-generated IDs (alphanumeric) |

**Verdict:** Safe. Firestore document IDs don't contain `"` or `<`. No remediation needed.

### `style="${...}"` — Minimal risk

| File | Line | Code |
|------|------|------|
| `checklist.js` | 90 | `style="${isSelected ? '' : 'display:none'}"` |

**Verdict:** Safe. Boolean toggle, no user data.

### `href="${...}"`, `src="${...}"` — **None found.** ✅

---

## §3. Advanced DOM Injection Audit

| Pattern | Found? | Details |
|---------|--------|---------|
| `DOMParser` | ❌ No | |
| `insertAdjacentHTML` | ❌ No | |
| `Range.createContextualFragment` | ❌ No | |
| `eval()` / `new Function()` | ❌ No | |
| `postMessage` | ❌ No | |
| `document.write` | ❌ No | |
| **Dynamic `import()`** | ⚠️ Yes | 10 instances — all importing `'../shared/modal.js'` |

### Dynamic Import Assessment

All 10 dynamic imports are **hardcoded string paths** to `modal.js`. No user-controlled import paths. **Safe.** This is standard code-splitting, not an injection vector.

```js
// All instances follow this exact pattern:
const { showModal } = await import('../shared/modal.js');
const { showConfirmDialog } = await import('../shared/modal.js');
```

**Verdict: Clean surface.** No exotic DOM injection APIs used anywhere.

---

## §4. Report Endpoint IDOR Audit

### `POST /api/reports` — Create report
- ✅ `checkMembership(uid, institutionId)` — cannot create report in foreign institution
- ⚠️ **No check that `studentId` belongs to `institutionId`** — attacker who is member of Institution A could create a report linking a student from Institution B to Institution A. The student record isn't verified.
- **Impact:** Low. The report stores a snapshot, it doesn't modify the student. But it creates a "ghost" report for a student the user shouldn't access.

### `GET /api/reports/:studentId` — Get student reports
- ✅ Looks up student → gets `institutionId` → `checkMembership()`
- ⚠️ **Existence leak:** Returns `404: "Siswa tidak ditemukan"` vs `403: "Akses ditolak"` — attacker can enumerate valid student IDs. See §6.

### `GET /api/reports/institution/:institutionId` — Get all institution reports
- ✅ `checkMembership()` — correct
- ✅ Returns only `status: 'final'` reports

### `GET/POST/DELETE /api/progress/:studentId` — **🔴 FULL IDOR**
- ❌ **No membership check at all**
- Document key: `${uid}_${studentId}` — user can only access their own progress docs
- **But:** Any authenticated user can create progress for ANY studentId. The `studentId` doesn't need to be a real student they have access to.
- **Actual exploit:** Limited. The progress doc is keyed by `uid`, so User A can't read User B's progress. But User A can write meaningless progress data keyed to arbitrary student IDs.
- **Real risk:** If progress endpoint is later used for analytics or shared views, this becomes dangerous.

### Summary Table

| Endpoint | Auth | Membership | Student→Institution Check | IDOR? |
|----------|------|-----------|--------------------------|-------|
| `POST /api/reports` | ✅ | ✅ inst | ❌ student not verified | Mild |
| `GET /api/reports/:studentId` | ✅ | ✅ via student lookup | ✅ | No |
| `GET /api/reports/institution/:id` | ✅ | ✅ | N/A | No |
| `GET /api/progress/:studentId` | ✅ | ❌ | ❌ | **Yes** (write only) |
| `POST /api/progress/:studentId` | ✅ | ❌ | ❌ | **Yes** |
| `DELETE /api/progress/:studentId` | ✅ | ❌ | ❌ | **Yes** |

---

## §5. Institution Deletion Edge-Cases

Current delete logic (`DELETE /api/institutions/:id`, lines 264-297):

```js
// What it DOES:
batch.delete(instRef);           // ✅ Delete institution doc
memberSnap.docs → batch.delete   // ✅ Delete membership docs

// What it does NOT do:
// ❌ Students are NOT deleted (orphaned)
// ❌ Reports are NOT deleted (orphaned)
// ❌ Progress docs are NOT deleted (orphaned)
// ❌ Invite code is NOT invalidated (it's in the institution doc, which IS deleted)
```

### Edge-Case Analysis

| Scenario | What Happens | Severity |
|----------|-------------|----------|
| **Orphan students** | Student docs remain with `institutionId` pointing to deleted institution. No endpoint can access them (membership check will fail). **Data leak in Firestore.** | 🟡 Medium — data persists indefinitely |
| **Orphan reports** | Report docs remain with `institutionId` pointing to deleted institution. Same as above — inaccessible but not cleaned up. | 🟡 Medium |
| **Orphan progress** | Progress docs (keyed by `uid_studentId`) remain. Can still be accessed via progress endpoints since they don't check membership. | 🟢 Low |
| **Orphan memberships** | ✅ Correctly deleted in batch | ✅ Fixed |
| **Stale invite codes** | ✅ Invite code lives on institution doc, which is deleted. Code becomes invalid. | ✅ Fixed |
| **Race: join while deleting** | If user submits join request while admin is deleting: join code lookup may succeed (institution still exists), membership is created, then institution is deleted. Result: **orphan membership** pointing to deleted institution. | 🟡 Medium — user sees empty state, no crash |
| **Race: finalize report while deleting** | Report POST has membership check. If membership is deleted first (in batch), report POST will fail with 403. If institution is deleted first but membership hasn't been cleaned yet, report succeeds and becomes orphaned. | 🟡 Medium |
| **Batch size limit** | Firestore batch limit is 500 operations. If institution has >498 members, batch will fail silently or throw. Unlikely for PAUD school use case. | 🟢 Low |

### Student Deletion Edge-Cases

`DELETE /api/students/:id` (students.js line 67-87):

```js
// Deletes student doc ONLY
// ❌ Reports referencing this studentId are NOT deleted
// ❌ Progress docs are NOT deleted
```

**Impact:** Orphan reports visible to anyone who queries by institution. Ghost entries in XLSX export.

---

## §6. Existence Enumeration Audit

### Information leakage by error message differentiation

| Endpoint | 404 Message | 403 Message | Leaks Existence? |
|----------|-------------|-------------|-----------------|
| `GET /api/reports/:studentId` | "Siswa tidak ditemukan" | "Akses ditolak" | 🔴 **YES** — attacker can distinguish "doesn't exist" from "exists but unauthorized" |
| `PUT /api/students/:id` | "Data siswa tidak ditemukan" | "Akses ditolak" | 🔴 **YES** |
| `DELETE /api/students/:id` | "Data siswa tidak ditemukan" | "Akses ditolak" | 🔴 **YES** |
| `PUT /api/institutions/:id` | "Instansi tidak ditemukan" | "Hanya pembuat yang dapat mengedit" | 🔴 **YES** |
| `DELETE /api/institutions/:id` | "Instansi tidak ditemukan" | "Hanya pembuat yang dapat menghapus" | 🔴 **YES** |
| `DELETE /api/institutions/:id/leave` | "Instansi tidak ditemukan" | "Admin tidak bisa keluar" | 🔴 **YES** |
| `POST /api/institutions/join` | "Kode undangan tidak ditemukan" | N/A (just 409 for already-joined) | ⚠️ Partial — confirms code validity |
| `GET /api/institutions/:id/details` | N/A (404 after membership check) | "Akses ditolak" | ✅ OK — membership checked first |
| `GET /api/institutions/:id/students` | N/A | "Akses ditolak" | ✅ OK — membership checked first |

### Pattern: Check-Then-Authorize (Wrong Order)

The problematic endpoints follow this pattern:
```js
// ❌ WRONG: Reveals existence
const doc = await db.doc(id).get();
if (!doc.exists) return 404;        // Tells attacker "doesn't exist"
if (!authorized) return 403;         // Tells attacker "exists!"

// ✅ CORRECT: Uniform response
const doc = await db.doc(id).get();
if (!doc.exists || !authorized) return 403;  // Same response either way
```

### Practical Impact

For SiCAPAI's context (PAUD schools, not banking), this is **low severity**. Firestore document IDs are random 20-char strings — blind enumeration is infeasible. But it's still a bad practice that should be fixed in the uniform-403 pattern.

---

## §7. Remediation Plan

### 🏁 PHASE A — Quick Patch Before Competition (2-4 hours)

These are the minimum changes to make the app defensible. Focus on **highest-impact, lowest-effort** fixes.

#### A1. Create `escapeHTML` utility (15 min)

```js
// src/utils/escape.js
export function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

#### A2. Apply `esc()` to all 26 dangerous interpolations (60 min)

Wrap every user-data interpolation:
```js
// BEFORE:
`<span class="student-name">${s.name}</span>`
// AFTER:
`<span class="student-name">${esc(s.name)}</span>`

// BEFORE (attribute):
`<input value="${student.name}" />`
// AFTER:
`<input value="${esc(student.name)}" />`
```

**Priority order** (do these first, they're the most dangerous):
1. `preview.js:86` — narrative display (`${displayText}`)
2. `preview.js:632` — paragraph display (`${p}`)
3. `app-shell.js:525-526` — sidebar student list (name + nickname)
4. `app-shell.js:573,577` — rename modal value attributes
5. `modal.js:21-22` — confirm dialog title/message
6. `app-shell.js:1483` — report viewer text
7. All remaining `${...name}` and `${...address}` interpolations

#### A3. Enable CSP in helmet (10 min)

```js
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://accounts.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://*.googleusercontent.com"],
      connectSrc: ["'self'", "https://*.googleapis.com", "https://*.firebaseio.com"],
      frameSrc: ["https://accounts.google.com"],
    },
  },
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false,
}));
```

#### A4. Deploy Firestore deny-all rules (5 min)

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

#### A5. Add membership check to progress routes (20 min)

```js
// In progress.js — add to GET, POST, DELETE:
const studentDoc = await db.collection('students').doc(req.params.studentId).get();
if (!studentDoc.exists) return res.status(403).json({ message: 'Akses ditolak' });
const isMember = await checkMembership(req.user.uid, studentDoc.data().institutionId);
if (!isMember) return res.status(403).json({ message: 'Akses ditolak' });
```

#### A6. Uniform 403 for existence leakage (15 min)

In `students.js` PUT/DELETE and `reports.js` GET — merge the 404 and 403 into one:
```js
if (!docSnap.exists) return res.status(403).json({ message: 'Akses ditolak' });
```

---

### 🛡️ PHASE B — Post-Competition Hardening (1-2 days)

| Task | Priority | Effort |
|------|----------|--------|
| **B1.** Verify `studentId` belongs to `institutionId` in `POST /api/reports` | High | 15 min |
| **B2.** Cascade delete students + reports on institution deletion | High | 45 min |
| **B3.** Cascade delete reports on student deletion | High | 15 min |
| **B4.** XLSX formula injection prevention — prefix text cells with `\t` | Medium | 20 min |
| **B5.** Error handler: generic messages in production | Medium | 10 min |
| **B6.** Add per-endpoint rate limit on `/join` (10 req/15min per IP) | Medium | 10 min |
| **B7.** Add membership check to AI endpoint | Medium | 15 min |
| **B8.** Validate `idempotencyKey` format (alphanumeric only) | Low | 10 min |
| **B9.** Add `X-Frame-Options: DENY` explicitly | Low | 5 min |
| **B10.** Audit Vite prod build for source maps | Low | 5 min |

---

### 🏗️ PHASE C — Architectural Long-Term (Future)

| Task | Rationale |
|------|-----------|
| **C1.** Migrate to DOMPurify for narrative rendering | Narratives are the highest-risk surface. Even with `esc()`, a future feature (markdown, rich text) could reopen XSS. DOMPurify is the gold standard. |
| **C2.** Move to `createElement` + `textContent` pattern | Eliminates entire innerHTML XSS class. Major refactor (~2889 lines in app-shell alone). Only worth it if app grows significantly. |
| **C3.** Implement Firestore Security Rules as defense-in-depth | Even with Admin SDK, rules protect against leaked service account keys and future direct-client-access features. |
| **C4.** Move service account to GCP Secret Manager | Eliminates file-on-disk risk. Required for production-grade deployment. |
| **C5.** Implement server-side input validation (zod/joi) | Validate and sanitize all request body fields at the API layer. Currently, the server stores whatever the client sends. |
| **C6.** Add audit logging | Log all destructive operations (delete institution, delete student, finalize report) with actor UID and timestamp for forensics. |
| **C7.** Implement soft-delete for institutions | Instead of hard-delete + orphan problem, set `deletedAt` timestamp and filter in queries. Enables recovery and avoids cascade complexity. |

---

## Quick Reference: What to `grep` and fix

```bash
# Find all dangerous innerHTML with user data — fix with esc()
grep -n 'student.name\|student.nickname\|studentName\|inst.name\|currentDetails.name\|currentDetails.address\|m.name\|m.email\|displayText' src/components/layout/app-shell.js src/components/report/preview.js

# Find attribute breakouts
grep -n 'value="${' src/components/layout/app-shell.js

# Verify fix coverage
grep -rn 'esc(' src/  # Should show 26+ usages after fix
```

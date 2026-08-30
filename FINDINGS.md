# Findings: Template Engine Defect Report

## Confirmed Defects

### Indicator-level mutual exclusivity flag locks out additive numerasi sub-indicators

**Claim:** `getChecklistStructure` assigns `isMutuallyExclusive: true` to the entire `mengenal-angka` indicator instead of scoping exclusivity between `ang-1-10` and `ang-1-20`, causing UI consumers to render all five sub-indicators as radio buttons.
**Evidence:** `src/services/template-engine.js:153-161`. The function computes `isMutuallyExclusive` on `mengenal-angka` if either `ang-1-10` or `ang-1-20` is present, and attaches it as a boolean property to the indicator object. In `src/components/report/checklist.js:241,247`, this flag converts all sub-indicators of the indicator into `<input type="radio" name="radio-mengenal-angka">`.
**Impact:** In the checklist UI, a teacher selecting number recognition (`ang-1-10` or `ang-1-20`) cannot simultaneously select number writing (`ang-tulis`), ordering (`ang-urutan`), or counting down (`ang-mundur`). Selecting any one sub-indicator deselects the others, so the resulting narrative can never report both number recognition and writing/ordering skills for the same student.
**Confidence:** High. The curriculum specification in `src/data/kurikulum-literasi-steam.json:22` (`catatan_khusus_numerasi`) explicitly documents that only `ang-1-10` and `ang-1-20` are mutually exclusive alternatives, while `ang-tulis`, `ang-urutan`, and `ang-mundur` are additive sub-skills designed to be combined with connectors (`serta mampu...`).

### Unused `religion` parameter in `generateTemplate` allows stale cross-religion sub-indicators into narratives

**Claim:** `generateTemplate` accepts `religion = null` but did not filter `indikator.sub_indikator` for `gerakan-ibadah`, allowing mismatched religion sub-indicators to leak into generated narratives when replaying persisted or stale selections.
**Evidence:** `src/services/template-engine.js:34, 55-56`. While UI rendering filters sub-indicators in `getChecklistStructure(religion)`, `selectedIndicators` is persisted and restored via `loadProgress()` and server sync in `src/components/layout/app-shell.js:793, 830-832, 892-897`, bypassing the UI filter when replaying directly into `generateTemplate`.
**Impact:** A student whose religion is updated (e.g. from Islam to Christian) or who has a stale cross-religion selection (e.g. `gi-sholat`) still produces narratives containing Islamic prayer descriptions (*"seperti gerakan berdiri, rukuk, dan sujud dalam sholat"*) on report cards sent to parents.
**Correction:** The previous report concluded this was "harmless by design" because it assumed inputs to `generateTemplate` always originate from the filtered UI checklist. That assumption was wrong because persisted state is restored directly into `generateTemplate` without passing through the UI filter.

## Checked and Considered Correct

- **Connector auto-injection regex (`src/services/template-engine.js:62`):** `/^(seperti|serta|dan)\s/i` properly checks the first selected sub-indicator across all 44 `has_sub` indicators and only prepends `'seperti '` when a leading conjunction is missing.
- **Modulo connector cycling in `buildParagraph` (`src/services/template-engine.js:112`):** Paragraphs with 3 to 6+ sentences cycle through the 5 transition phrases deterministically using `(i - 1) % connectors.length`.
- **Null / empty state handling across narrative generators (`src/services/template-engine.js:215, 247, 280`):** `generateNilaiPlusNarrative`, `generateSaranNarrative`, and `generateKokurikulerNarrative` safely return empty string `''` when given `null`, `undefined`, or empty selection maps.

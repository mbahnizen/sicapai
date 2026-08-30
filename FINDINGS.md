# Findings: Template Engine Defect Report

## Confirmed Defects

### Indicator-level mutual exclusivity flag locks out additive numerasi sub-indicators

**Claim:** `getChecklistStructure` assigns `isMutuallyExclusive: true` to the entire `mengenal-angka` indicator instead of scoping exclusivity between `ang-1-10` and `ang-1-20`, causing UI consumers to render all five sub-indicators as radio buttons.
**Evidence:** `src/services/template-engine.js:153-161`. The function computes `isMutuallyExclusive` on `mengenal-angka` if either `ang-1-10` or `ang-1-20` is present, and attaches it as a boolean property to the indicator object. In `src/components/report/checklist.js:241,247`, this flag converts all sub-indicators of the indicator into `<input type="radio" name="radio-mengenal-angka">`.
**Impact:** In the checklist UI, a teacher selecting number recognition (`ang-1-10` or `ang-1-20`) cannot simultaneously select number writing (`ang-tulis`), ordering (`ang-urutan`), or counting down (`ang-mundur`). Selecting any one sub-indicator deselects the others, so the resulting narrative can never report both number recognition and writing/ordering skills for the same student.
**Confidence:** High. The curriculum specification in `src/data/kurikulum-literasi-steam.json:22` (`catatan_khusus_numerasi`) explicitly documents that only `ang-1-10` and `ang-1-20` are mutually exclusive alternatives, while `ang-tulis`, `ang-urutan`, and `ang-mundur` are additive sub-skills designed to be combined with connectors (`serta mampu...`).

## Checked and Considered Correct

- **Unused `religion` parameter in `generateTemplate` (`src/services/template-engine.js:34`):** The signature accepts `religion = null` but does not use it. This is harmless by design because sub-indicator filtering by religion happens during UI structure generation (`getChecklistStructure(religion)`), and `generateTemplate` only resolves sub-indicators explicitly passed in `selectedIndicators`.
- **Connector auto-injection regex (`src/services/template-engine.js:62`):** `/^(seperti|serta|dan)\s/i` properly checks the first selected sub-indicator across all 44 `has_sub` indicators and only prepends `'seperti '` when a leading conjunction is missing.
- **Modulo connector cycling in `buildParagraph` (`src/services/template-engine.js:112`):** Paragraphs with 3 to 6+ sentences cycle through the 5 transition phrases deterministically using `(i - 1) % connectors.length`.
- **Null / empty state handling across narrative generators (`src/services/template-engine.js:215, 247, 280`):** `generateNilaiPlusNarrative`, `generateSaranNarrative`, and `generateKokurikulerNarrative` safely return empty string `''` when given `null`, `undefined`, or empty selection maps.

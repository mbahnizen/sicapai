/**
 * Sanitization Utilities — SiCAPAI
 *
 * Centralised escaping functions to prevent XSS and injection attacks.
 * Import ONLY the function you need at each call site.
 */

/**
 * Escape HTML entities for safe insertion into innerHTML / template literals.
 * Use for text content that should NEVER be interpreted as HTML.
 *
 * @param {*} str — value to escape (null/undefined → '')
 * @returns {string}
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
 * Escape a string for safe use inside HTML attribute values (e.g. value="...").
 *
 * ⚠️  WARNING: This function prevents quote-breakout and tag-injection inside
 *     attribute values, but it does NOT make arbitrary strings safe for use in
 *     event-handler attributes (onclick, onfocus, etc.) or javascript: URIs.
 *     For those contexts, use textContent / DOM property assignment instead.
 *
 * Functionally identical to escapeHTML — separated for semantic clarity
 * so code reviewers can distinguish "escaping text content" from
 * "escaping an attribute value".
 */
export const escapeAttr = escapeHTML;

/**
 * Sanitize a cell value to prevent Excel/Sheets formula injection.
 * Prefixes strings that start with formula-trigger characters with a
 * single-quote, which Excel treats as a text-force prefix (hidden from user).
 *
 * @param {*} val — cell value
 * @returns {*}
 */
export function sanitizeXlsxCell(val) {
  if (typeof val !== 'string') return val;
  if (/^[=+\-@]/.test(val)) return "'" + val;
  return val;
}

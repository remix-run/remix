// Safe HTML branding
const kSafeHtml = Symbol('safeHtml');
function createSafeHtml(value) {
    let s = new String(value);
    s[kSafeHtml] = true;
    return s;
}
/**
 * Checks if a value is a {@link SafeHtml} string.
 *
 * @param value The value to check
 * @returns `true` if the value is a {@link SafeHtml} string
 */
export function isSafeHtml(value) {
    return typeof value === 'object' && value != null && value[kSafeHtml] === true;
}
const escapeRe = /[&<>"']/g;
const escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};
function escapeHtml(text) {
    return text.replace(escapeRe, (c) => escapeMap[c]);
}
function stringifyInterpolation(value) {
    if (value == null)
        return '';
    if (Array.isArray(value))
        return value.map(stringifyInterpolation).join('');
    if (isSafeHtml(value))
        return String(value);
    if (typeof value === 'string')
        return escapeHtml(value);
    if (typeof value === 'number' || typeof value === 'boolean')
        return escapeHtml(String(value));
    return escapeHtml(String(value));
}
function stringifyRawInterpolation(value) {
    if (value == null)
        return '';
    if (Array.isArray(value))
        return value.map(stringifyRawInterpolation).join('');
    if (isSafeHtml(value))
        return String(value);
    if (typeof value === 'string')
        return value;
    if (typeof value === 'number' || typeof value === 'boolean')
        return String(value);
    return String(value);
}
function isTemplateStringsArray(obj) {
    return Array.isArray(obj) && 'raw' in obj;
}
function htmlHelper(strings, ...values) {
    if (!isTemplateStringsArray(strings)) {
        throw new TypeError('html must be used as a template tag');
    }
    let out = '';
    for (let i = 0; i < strings.length; i++) {
        out += strings[i];
        if (i < values.length)
            out += stringifyInterpolation(values[i]);
    }
    return createSafeHtml(out);
}
/**
 * Tagged template helper for creating {@link SafeHtml} values.
 *
 * ```ts
 * let unsafe = '<script>alert(1)</script>'
 * let safe = html`<h1>${unsafe}</h1>`
 * assert.equal(String(safe), '<h1>&lt;script&gt;alert(1)&lt;/script&gt;</h1>')
 * ```
 *
 * To interpolate raw HTML without escaping, use `html.raw` as a template tag.
 * This has the same semantics as `String.raw` but for HTML snippets that have
 * already been escaped or are from trusted sources.
 *
 * ```ts
 * let icon = '<b>OK</b>'
 * let safe = html.raw`<div>${icon}</div>`
 * assert.equal(String(safe), '<div><b>OK</b></div>')
 * ```
 *
 * @param strings The template strings
 * @param values The values to interpolate
 * @returns A `SafeHtml` value
 */
export const html = Object.assign(htmlHelper, {
    raw(strings, ...values) {
        if (!isTemplateStringsArray(strings)) {
            throw new TypeError('html.raw must be used as a template tag');
        }
        let out = '';
        for (let i = 0; i < strings.length; i++) {
            out += strings[i];
            if (i < values.length)
                out += stringifyRawInterpolation(values[i]);
        }
        return createSafeHtml(out);
    },
});

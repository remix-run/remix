declare const kSafeHtml: unique symbol;
/**
 * A string that is safe to render as HTML without escaping.
 */
export type SafeHtml = String & {
    readonly [kSafeHtml]: true;
};
/**
 * Checks if a value is a `SafeHtml` string.
 *
 * @param value The value to check
 * @returns `true` if the value is a `SafeHtml` string
 */
export declare function isSafeHtml(value: unknown): value is SafeHtml;
type Interpolation = SafeHtml | string | number | boolean | null | undefined | Array<Interpolation>;
/**
 * Use this helper to escape HTML and create a safe HTML string.
 *
 * ```ts
 * let unsafe = '<script>alert(1)</script>'
 * let safe = html`<h1>${unsafe}</h1>`
 * assert.equal(String(safe), '<h1>&lt;script&gt;alert(1)&lt;/script&gt;</h1>')
 * ```
 *
 * To interpolate raw HTML without escaping, use `html.raw` as a template tag:
 *
 * ```ts
 * let icon = '<b>OK</b>'
 * let safe = html.raw`<div>${icon}</div>`
 * assert.equal(String(safe), '<div><b>Bold</b></div>')
 * ```
 *
 * This has the same semantics as `String.raw` but for HTML snippets that have
 * already been escaped or are from trusted sources.
 */
type SafeHtmlHelper = {
    /**
     * A tagged template function that escapes interpolated values as HTML.
     *
     * @param strings The template strings
     * @param values The values to interpolate
     * @returns A `SafeHtml` value
     */
    (strings: TemplateStringsArray, ...values: Interpolation[]): SafeHtml;
    /**
     * A tagged template function that does not escape interpolated values.
     *
     * Similar to `String.raw`, this preserves the raw values without escaping.
     * Only use with trusted content or pre-escaped HTML.
     *
     * @param strings The template strings
     * @param values The values to interpolate
     * @returns A `SafeHtml` value
     */
    raw(strings: TemplateStringsArray, ...values: Interpolation[]): SafeHtml;
};
export declare const html: SafeHtmlHelper;
export {};
//# sourceMappingURL=safe-html.d.ts.map
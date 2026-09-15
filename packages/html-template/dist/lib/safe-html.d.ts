declare const kSafeHtml: unique symbol;
/**
 * A string that is safe to render as HTML without escaping.
 */
export type SafeHtml = String & {
    readonly [kSafeHtml]: true;
};
/**
 * Checks if a value is a {@link SafeHtml} string.
 *
 * @param value The value to check
 * @returns `true` if the value is a {@link SafeHtml} string
 */
export declare function isSafeHtml(value: unknown): value is SafeHtml;
type Interpolation = SafeHtml | string | number | boolean | null | undefined | Array<Interpolation>;
export interface HtmlTemplateTag {
    (strings: TemplateStringsArray, ...values: Interpolation[]): SafeHtml;
    raw(strings: TemplateStringsArray, ...values: Interpolation[]): SafeHtml;
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
export declare const html: HtmlTemplateTag;
export {};
//# sourceMappingURL=safe-html.d.ts.map
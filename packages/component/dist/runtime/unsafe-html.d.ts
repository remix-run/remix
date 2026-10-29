declare class UnsafeHTMLValue {
    #private;
    constructor(value: string);
    static read(value: UnsafeHTMLValue): string;
}
/**
 * An opaque value that Remix may insert into an element without HTML escaping.
 *
 * Create values with {@link unsafeHTML}. Remix does not sanitize or otherwise modify the HTML.
 */
export type UnsafeHTML = UnsafeHTMLValue;
/**
 * Explicitly allows a string to be inserted into an element as raw HTML.
 *
 * This function does not sanitize or otherwise modify the HTML. Only pass trusted content or
 * content that your application has already sanitized.
 *
 * @param value The raw HTML string to allow.
 * @returns An opaque value accepted by raw-HTML props such as `innerHTML` and iframe
 * `srcDoc`/`srcdoc`.
 */
export declare function unsafeHTML(value: string): UnsafeHTML;
/**
 * Reads the string from a value created by {@link unsafeHTML}.
 *
 * @param value The value to inspect.
 * @returns The raw HTML string, or `undefined` when the value is not an `UnsafeHTML` instance.
 * @internal
 */
export declare function readUnsafeHTML(value: unknown): string | undefined;
interface NormalizedUnsafeHTMLProps extends Record<string, unknown> {
    innerHTML?: string;
    srcDoc?: string;
    srcdoc?: string;
}
/**
 * Validates and unwraps every host prop that can cause the browser to parse raw HTML.
 *
 * @param props The authored host props to normalize.
 * @returns Host props with opaque raw-HTML values replaced by their strings.
 * @internal
 */
export declare function normalizeUnsafeHTMLProps(props: Record<string, unknown>): NormalizedUnsafeHTMLProps;
export {};

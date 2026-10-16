import { invariant } from './invariant.js';
class UnsafeHTMLValue {
    #value;
    constructor(value) {
        this.#value = value;
    }
    static read(value) {
        return value.#value;
    }
}
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
export function unsafeHTML(value) {
    let result = new UnsafeHTMLValue(value);
    Object.freeze(result);
    return result;
}
/**
 * Reads the string from a value created by {@link unsafeHTML}.
 *
 * @param value The value to inspect.
 * @returns The raw HTML string, or `undefined` when the value is not an `UnsafeHTML` instance.
 * @internal
 */
export function readUnsafeHTML(value) {
    return value instanceof UnsafeHTMLValue ? UnsafeHTMLValue.read(value) : undefined;
}
/**
 * Validates and unwraps every host prop that can cause the browser to parse raw HTML.
 *
 * @param props The authored host props to normalize.
 * @returns Host props with opaque raw-HTML values replaced by their strings.
 * @internal
 */
export function normalizeUnsafeHTMLProps(props) {
    let innerHTML = readUnsafeHTML(props.innerHTML);
    invariant(props.innerHTML === undefined || innerHTML !== undefined, 'Invalid innerHTML prop');
    let srcDoc = readUnsafeHTML(props.srcDoc);
    invariant(props.srcDoc === undefined || srcDoc !== undefined, 'Invalid srcDoc prop');
    let srcdoc = readUnsafeHTML(props.srcdoc);
    invariant(props.srcdoc === undefined || srcdoc !== undefined, 'Invalid srcdoc prop');
    invariant(props.outerHTML === undefined, 'Invalid outerHTML prop');
    if (innerHTML === undefined && srcDoc === undefined && srcdoc === undefined)
        return props;
    return {
        ...props,
        ...(innerHTML === undefined ? {} : { innerHTML }),
        ...(srcDoc === undefined ? {} : { srcDoc }),
        ...(srcdoc === undefined ? {} : { srcdoc }),
    };
}
//# sourceMappingURL=unsafe-html.js.map
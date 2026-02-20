import { type HeaderValue } from './header-value.ts';
export interface VaryInit {
    /**
     * The request header names that determine cache eligibility.
     */
    headerNames: string[];
}
/**
 * The value of a `Vary` HTTP header.
 *
 * The `Vary` header indicates which request headers affect whether a cached
 * response can be used, enabling proper content negotiation caching.
 *
 * Header names are normalized to lowercase for case-insensitive comparison.
 *
 * [MDN `Vary` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Vary)
 *
 * [HTTP/1.1 Specification](https://httpwg.org/specs/rfc9110.html#field.vary)
 */
export declare class Vary implements HeaderValue, VaryInit, Iterable<string> {
    #private;
    constructor(init?: string | string[] | VaryInit);
    /**
     * An array of the header names (normalized to lowercase).
     */
    get headerNames(): string[];
    /**
     * The number of header names in the Vary header.
     */
    get size(): number;
    /**
     * Checks if the Vary header includes the given header name (case-insensitive).
     * @param headerName The header name to check for.
     * @returns `true` if the header name is present, `false` otherwise.
     */
    has(headerName: string): boolean;
    /**
     * Adds a header name to the Vary header (case-insensitive).
     * If the header name already exists, this is a no-op.
     * @param headerName The header name to add.
     */
    add(headerName: string): void;
    /**
     * Removes a header name from the Vary header (case-insensitive).
     * @param headerName The header name to remove.
     */
    delete(headerName: string): void;
    /**
     * Removes all header names from the Vary header.
     */
    clear(): void;
    /**
     * Calls a callback function for each header name in the Vary header.
     * @param callback The callback function to call for each header name.
     * @param thisArg Optional value to use as `this` when executing the callback.
     */
    forEach(callback: (headerName: string, vary: Vary) => void, thisArg?: any): void;
    [Symbol.iterator](): IterableIterator<string>;
    toString(): string;
    /**
     * Parse a Vary header value.
     *
     * @param value The header value (string, string[], init object, or null)
     * @returns A Vary instance (empty if null)
     */
    static from(value: string | string[] | VaryInit | null): Vary;
}
//# sourceMappingURL=vary.d.ts.map
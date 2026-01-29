import { type HeaderValue } from './header-value.ts';
/**
 * Initializer for an `Accept-Encoding` header value.
 */
export type AcceptEncodingInit = Iterable<string | [string, number]> | Record<string, number>;
/**
 * The value of a `Accept-Encoding` HTTP header.
 *
 * [MDN `Accept-Encoding` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Encoding)
 *
 * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7231#section-5.3.4)
 */
export declare class AcceptEncoding implements HeaderValue, Iterable<[string, number]> {
    #private;
    constructor(init?: string | AcceptEncodingInit);
    /**
     * An array of all encodings in the header.
     */
    get encodings(): string[];
    /**
     * An array of all weights (q values) in the header.
     */
    get weights(): number[];
    /**
     * The number of encodings in the header.
     */
    get size(): number;
    /**
     * Returns `true` if the header matches the given encoding (i.e. it is "acceptable").
     *
     * @param encoding The encoding to check
     * @returns `true` if the encoding is acceptable, `false` otherwise
     */
    accepts(encoding: string): boolean;
    /**
     * Gets the weight an encoding. Performs wildcard matching so `*` matches all encodings.
     *
     * @param encoding The encoding to get
     * @returns The weight of the encoding, or `0` if it is not in the header
     */
    getWeight(encoding: string): number;
    /**
     * Returns the most preferred encoding from the given list of encodings.
     *
     * @param encodings The encodings to choose from
     * @returns The most preferred encoding or `null` if none match
     */
    getPreferred<encoding extends string>(encodings: readonly encoding[]): encoding | null;
    /**
     * Gets the weight of an encoding. If it is not in the header verbatim, this returns `null`.
     *
     * @param encoding The encoding to get
     * @returns The weight of the encoding, or `null` if it is not in the header
     */
    get(encoding: string): number | null;
    /**
     * Sets an encoding with the given weight.
     *
     * @param encoding The encoding to set
     * @param weight The weight of the encoding (default: `1`)
     */
    set(encoding: string, weight?: number): void;
    /**
     * Removes the given encoding from the header.
     *
     * @param encoding The encoding to remove
     */
    delete(encoding: string): void;
    /**
     * Checks if the header contains a given encoding.
     *
     * @param encoding The encoding to check
     * @returns `true` if the encoding is in the header, `false` otherwise
     */
    has(encoding: string): boolean;
    /**
     * Removes all encodings from the header.
     */
    clear(): void;
    /**
     * Returns an iterator of all encoding and weight pairs.
     *
     * @returns An iterator of `[encoding, weight]` tuples
     */
    entries(): IterableIterator<[string, number]>;
    [Symbol.iterator](): IterableIterator<[string, number]>;
    /**
     * Invokes the callback for each encoding and weight pair.
     *
     * @param callback The function to call for each pair
     * @param thisArg The value to use as `this` when calling the callback
     */
    forEach(callback: (encoding: string, weight: number, header: AcceptEncoding) => void, thisArg?: any): void;
    /**
     * Returns the string representation of the header value.
     *
     * @returns The header value as a string
     */
    toString(): string;
    /**
     * Parse an Accept-Encoding header value.
     *
     * @param value The header value (string, init object, or null)
     * @returns An AcceptEncoding instance (empty if null)
     */
    static from(value: string | AcceptEncodingInit | null): AcceptEncoding;
}
//# sourceMappingURL=accept-encoding.d.ts.map
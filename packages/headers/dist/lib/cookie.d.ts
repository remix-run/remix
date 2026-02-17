import { type HeaderValue } from './header-value.ts';
/**
 * Initializer for a `Cookie` header value.
 */
export type CookieInit = Iterable<[string, string]> | Record<string, string>;
/**
 * The value of a `Cookie` HTTP header.
 *
 * [MDN `Cookie` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cookie)
 *
 * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc6265#section-4.2)
 */
export declare class Cookie implements HeaderValue, Iterable<[string, string]> {
    #private;
    constructor(init?: string | CookieInit);
    /**
     * An array of the names of the cookies in the header.
     */
    get names(): string[];
    /**
     * An array of the values of the cookies in the header.
     */
    get values(): string[];
    /**
     * The number of cookies in the header.
     */
    get size(): number;
    /**
     * Gets the value of a cookie with the given name from the header.
     *
     * @param name The name of the cookie
     * @returns The value of the cookie, or `null` if the cookie does not exist
     */
    get(name: string): string | null;
    /**
     * Sets a cookie with the given name and value in the header.
     *
     * @param name The name of the cookie
     * @param value The value of the cookie
     */
    set(name: string, value: string): void;
    /**
     * Removes a cookie with the given name from the header.
     *
     * @param name The name of the cookie
     */
    delete(name: string): void;
    /**
     * True if a cookie with the given name exists in the header.
     *
     * @param name The name of the cookie
     * @returns `true` if a cookie with the given name exists in the header
     */
    has(name: string): boolean;
    /**
     * Removes all cookies from the header.
     */
    clear(): void;
    /**
     * Returns an iterator of all cookie name and value pairs.
     *
     * @returns An iterator of `[name, value]` tuples
     */
    entries(): IterableIterator<[string, string]>;
    [Symbol.iterator](): IterableIterator<[string, string]>;
    /**
     * Invokes the callback for each cookie name and value pair.
     *
     * @param callback The function to call for each pair
     * @param thisArg The value to use as `this` when calling the callback
     */
    forEach(callback: (name: string, value: string, header: Cookie) => void, thisArg?: any): void;
    /**
     * Returns the string representation of the header value.
     *
     * @returns The header value as a string
     */
    toString(): string;
    /**
     * Parse a Cookie header value.
     *
     * @param value The header value (string, init object, or null)
     * @returns A Cookie instance (empty if null)
     */
    static from(value: string | CookieInit | null): Cookie;
}
//# sourceMappingURL=cookie.d.ts.map
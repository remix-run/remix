import { type CookieProperties } from '@remix-run/headers';
/**
 * Options for creating a cookie.
 */
export interface CookieOptions extends CookieProperties {
    /**
     * A function that decodes the cookie value. Decodes any URL-encoded sequences into their
     * original characters.
     *
     * See [RFC 6265](https://tools.ietf.org/html/rfc6265#section-4.1.1) for more details.
     *
     * @default decodeURIComponent
     */
    decode?: (value: string) => string;
    /**
     * A function that encodes the cookie value. Percent-encodes all characters that are not allowed
     * in a cookie value.
     *
     * See [RFC 6265](https://tools.ietf.org/html/rfc6265#section-4.1.1) for more details.
     *
     * @default encodeURIComponent
     */
    encode?: (value: string) => string;
    /**
     * An array of secrets that may be used to sign/unsign the value of a cookie.
     *
     * The array makes it easy to rotate secrets. New secrets should be added to
     * the beginning of the array. `cookie.serialize()` will always use the first
     * value in the array, but `cookie.parse()` may use any of them so that
     * cookies that were signed with older secrets still work.
     */
    secrets?: string[];
}
type SameSiteValue = 'Strict' | 'Lax' | 'None';
/**
 * Represents a HTTP cookie.
 *
 * Supports parsing and serializing the cookie to/from `Cookie` and `Set-Cookie` headers.
 *
 * Also supports cryptographic signing of the cookie value to ensure it's not tampered with, and
 * secret rotation to easily rotate secrets without breaking existing cookies.
 */
export declare class Cookie implements CookieProperties {
    #private;
    /**
     * @param name The name of the cookie
     * @param options Options for the cookie
     */
    constructor(name: string, options?: CookieOptions);
    /**
     * The domain of the cookie.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/Web/HTTP/Headers/Set-Cookie#domaindomain-value)
     */
    get domain(): string | undefined;
    /**
     * The expiration date of the cookie.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/Web/HTTP/Headers/Set-Cookie#expiresdate)
     */
    get expires(): Date | undefined;
    /**
     * True if the cookie is HTTP-only.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/Web/HTTP/Headers/Set-Cookie#httponly)
     *
     * @default false
     */
    get httpOnly(): boolean;
    /**
     * The maximum age of the cookie in seconds.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#max-agenumber)
     */
    get maxAge(): number | undefined;
    /**
     * The name of the cookie.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#cookie-namecookie-value)
     */
    get name(): string;
    /**
     * Extracts the value of this cookie from a `Cookie` header value.
     *
     * @param headerValue The `Cookie` header to parse
     * @returns The value of this cookie, or `null` if it's not present
     */
    parse(headerValue: string | null): Promise<string | null>;
    /**
     * True if the cookie is partitioned.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/Web/HTTP/Headers/Set-Cookie#partitioned)
     *
     * @default false
     */
    get partitioned(): boolean;
    /**
     * The path of the cookie.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#pathpath-value)
     *
     * @default '/'
     */
    get path(): string;
    /**
     * The `SameSite` attribute of the cookie.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/Web/HTTP/Headers/Set-Cookie#samesitesamesite-value)
     *
     * @default 'Lax'
     */
    get sameSite(): SameSiteValue;
    /**
     * True if the cookie is secure (only sent over HTTPS).
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#secure)
     *
     * @default false
     */
    get secure(): boolean;
    /**
     * Returns the value to use in a `Set-Cookie` header for this cookie.
     *
     * @param value The value to serialize
     * @param props Additional properties to use when serializing the cookie
     * @returns The `Set-Cookie` header value for this cookie
     */
    serialize(value: string, props?: CookieProperties): Promise<string>;
    /**
     * True if this cookie uses one or more secrets for verification.
     */
    get signed(): boolean;
}
/**
 * Creates a new cookie object.
 *
 * @param name The name of the cookie
 * @param options Options for the cookie
 * @returns A new `Cookie` object
 */
export declare function createCookie(name: string, options?: CookieOptions): Cookie;
export {};
//# sourceMappingURL=cookie.d.ts.map
import { type HeaderValue } from './header-value.ts';
type SameSiteValue = 'Strict' | 'Lax' | 'None';
/**
 * Properties for a `Set-Cookie` header value.
 */
export interface CookieProperties {
    /**
     * The domain of the cookie. For example, `example.com`.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#domaindomain-value)
     */
    domain?: string;
    /**
     * The expiration date of the cookie. If not specified, the cookie is a session cookie that is
     * removed when the browser is closed.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#expiresdate)
     */
    expires?: Date;
    /**
     * Indicates this cookie should not be accessible via JavaScript.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#httponly)
     */
    httpOnly?: boolean;
    /**
     * The maximum age of the cookie in seconds.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#max-age)
     */
    maxAge?: number;
    /**
     * Indicates this cookie is a partitioned cookie.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#partitioned)
     */
    partitioned?: boolean;
    /**
     * The path of the cookie. For example, `/` or `/admin`.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#pathpath-value)
     */
    path?: string;
    /**
     * The `SameSite` attribute of the cookie. This attribute lets servers require that a cookie shouldn't be sent with
     * cross-site requests, which provides some protection against cross-site request forgery attacks.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#samesitesamesite-value)
     */
    sameSite?: SameSiteValue;
    /**
     * Indicates the cookie should only be sent over HTTPS.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#secure)
     */
    secure?: boolean;
}
/**
 * Initializer for a `Set-Cookie` header value.
 */
export interface SetCookieInit extends CookieProperties {
    /**
     * The name of the cookie.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#cookie-namecookie-value)
     */
    name?: string;
    /**
     * The value of the cookie.
     *
     * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#cookie-namecookie-value)
     */
    value?: string;
}
/**
 * The value of a `Set-Cookie` HTTP header.
 *
 * [MDN `Set-Cookie` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie)
 *
 * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc6265#section-4.1)
 */
export declare class SetCookie implements HeaderValue, SetCookieInit {
    domain?: string;
    expires?: Date;
    httpOnly?: boolean;
    maxAge?: number;
    name?: string;
    partitioned?: boolean;
    path?: string;
    sameSite?: SameSiteValue;
    secure?: boolean;
    value?: string;
    constructor(init?: string | SetCookieInit);
    /**
     * Returns the string representation of the header value.
     *
     * @returns The header value as a string
     */
    toString(): string;
    /**
     * Parse a Set-Cookie header value.
     *
     * @param value The header value (string, init object, or null)
     * @returns A SetCookie instance (empty if null)
     */
    static from(value: string | SetCookieInit | null): SetCookie;
}
export {};
//# sourceMappingURL=set-cookie.d.ts.map
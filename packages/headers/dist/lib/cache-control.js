import {} from "./header-value.js";
import { parseParams } from "./param-values.js";
/**
 * The value of a `Cache-Control` HTTP header.
 *
 * [MDN `Cache-Control` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control)
 *
 * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7234#section-5.2)
 */
export class CacheControl {
    maxAge;
    maxStale;
    minFresh;
    sMaxage;
    noCache;
    noStore;
    noTransform;
    onlyIfCached;
    mustRevalidate;
    proxyRevalidate;
    mustUnderstand;
    private;
    public;
    immutable;
    staleWhileRevalidate;
    staleIfError;
    constructor(init) {
        if (init)
            return CacheControl.from(init);
    }
    /**
     * Returns the string representation of the header value.
     *
     * @returns The header value as a string
     */
    toString() {
        let parts = [];
        if (this.public) {
            parts.push('public');
        }
        if (this.private) {
            parts.push('private');
        }
        if (typeof this.maxAge === 'number') {
            parts.push(`max-age=${this.maxAge}`);
        }
        if (typeof this.sMaxage === 'number') {
            parts.push(`s-maxage=${this.sMaxage}`);
        }
        if (this.noCache) {
            parts.push('no-cache');
        }
        if (this.noStore) {
            parts.push('no-store');
        }
        if (this.noTransform) {
            parts.push('no-transform');
        }
        if (this.onlyIfCached) {
            parts.push('only-if-cached');
        }
        if (this.mustRevalidate) {
            parts.push('must-revalidate');
        }
        if (this.proxyRevalidate) {
            parts.push('proxy-revalidate');
        }
        if (this.mustUnderstand) {
            parts.push('must-understand');
        }
        if (this.immutable) {
            parts.push('immutable');
        }
        if (typeof this.staleWhileRevalidate === 'number') {
            parts.push(`stale-while-revalidate=${this.staleWhileRevalidate}`);
        }
        if (typeof this.staleIfError === 'number') {
            parts.push(`stale-if-error=${this.staleIfError}`);
        }
        if (typeof this.maxStale === 'number') {
            parts.push(`max-stale=${this.maxStale}`);
        }
        if (typeof this.minFresh === 'number') {
            parts.push(`min-fresh=${this.minFresh}`);
        }
        return parts.join(', ');
    }
    /**
     * Parse a Cache-Control header value.
     *
     * @param value The header value (string, init object, or null)
     * @returns A CacheControl instance (empty if null)
     */
    static from(value) {
        let header = new CacheControl();
        if (value !== null) {
            if (typeof value === 'string') {
                let params = parseParams(value, ',');
                if (params.length > 0) {
                    for (let [name, val] of params) {
                        switch (name) {
                            case 'max-age':
                                header.maxAge = Number(val);
                                break;
                            case 'max-stale':
                                header.maxStale = Number(val);
                                break;
                            case 'min-fresh':
                                header.minFresh = Number(val);
                                break;
                            case 's-maxage':
                                header.sMaxage = Number(val);
                                break;
                            case 'no-cache':
                                header.noCache = true;
                                break;
                            case 'no-store':
                                header.noStore = true;
                                break;
                            case 'no-transform':
                                header.noTransform = true;
                                break;
                            case 'only-if-cached':
                                header.onlyIfCached = true;
                                break;
                            case 'must-revalidate':
                                header.mustRevalidate = true;
                                break;
                            case 'proxy-revalidate':
                                header.proxyRevalidate = true;
                                break;
                            case 'must-understand':
                                header.mustUnderstand = true;
                                break;
                            case 'private':
                                header.private = true;
                                break;
                            case 'public':
                                header.public = true;
                                break;
                            case 'immutable':
                                header.immutable = true;
                                break;
                            case 'stale-while-revalidate':
                                header.staleWhileRevalidate = Number(val);
                                break;
                            case 'stale-if-error':
                                header.staleIfError = Number(val);
                                break;
                        }
                    }
                }
            }
            else {
                header.maxAge = value.maxAge;
                header.maxStale = value.maxStale;
                header.minFresh = value.minFresh;
                header.sMaxage = value.sMaxage;
                header.noCache = value.noCache;
                header.noStore = value.noStore;
                header.noTransform = value.noTransform;
                header.onlyIfCached = value.onlyIfCached;
                header.mustRevalidate = value.mustRevalidate;
                header.proxyRevalidate = value.proxyRevalidate;
                header.mustUnderstand = value.mustUnderstand;
                header.private = value.private;
                header.public = value.public;
                header.immutable = value.immutable;
                header.staleWhileRevalidate = value.staleWhileRevalidate;
                header.staleIfError = value.staleIfError;
            }
        }
        return header;
    }
}

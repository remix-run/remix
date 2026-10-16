import { type HeaderValue } from './header-value.ts';
/**
 * Initializer for a `Content-Disposition` header value.
 */
export interface ContentDispositionInit {
    /**
     * The suggested filename for the content. Values received from clients are untrusted metadata
     * and must not be used directly as filesystem paths.
     */
    filename?: string;
    /**
     * The suggested filename encoded as an [RFC 8187](https://tools.ietf.org/html/rfc8187) `filename*` parameter.
     * Values received from clients are untrusted metadata, even after decoding, and must not be
     * used directly as filesystem paths.
     */
    filenameSplat?: string;
    /**
     * For `multipart/form-data` requests, the name of the `<input>` field associated with this content.
     */
    name?: string;
    /**
     * The disposition type of the content, such as `attachment` or `inline`.
     */
    type?: string;
}
/**
 * The value of a `Content-Disposition` HTTP header.
 *
 * [MDN `Content-Disposition` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Disposition)
 *
 * [RFC 6266](https://tools.ietf.org/html/rfc6266)
 */
export declare class ContentDisposition implements HeaderValue, ContentDispositionInit {
    /**
     * The `filename` parameter value. Values received from clients are untrusted metadata;
     * no filesystem sanitization is applied. Do not use this value directly as a filesystem path.
     */
    filename?: string;
    /**
     * The RFC 8187-encoded `filename*` parameter value. Values received from clients are untrusted
     * metadata, even after decoding. Do not use this value directly as a filesystem path.
     */
    filenameSplat?: string;
    /**
     * The associated multipart field name.
     */
    name?: string;
    /**
     * The disposition type such as `attachment` or `inline`.
     */
    type?: string;
    constructor(init?: string | ContentDispositionInit);
    /**
     * The preferred filename for the content, using the decoded `filename*` parameter when available,
     * falling back to the `filename` parameter, as described in [RFC 6266](https://tools.ietf.org/html/rfc6266).
     *
     * This selects and decodes metadata without sanitizing it for filesystem use. Values received
     * from clients are untrusted input and must not be used directly as filesystem paths. Generate
     * a storage name in your application instead.
     */
    get preferredFilename(): string | undefined;
    /**
     * Returns the string representation of the header value.
     *
     * @returns The header value as a string
     */
    toString(): string;
    /**
     * Parse a Content-Disposition header value.
     *
     * @param value The header value (string, init object, or null)
     * @returns A ContentDisposition instance (empty if null)
     */
    static from(value: string | ContentDispositionInit | null): ContentDisposition;
}
//# sourceMappingURL=content-disposition.d.ts.map
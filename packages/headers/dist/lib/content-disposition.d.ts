import { type HeaderValue } from './header-value.ts';
/**
 * Initializer for a `Content-Disposition` header value.
 */
export interface ContentDispositionInit {
    /**
     * For file uploads, the name of the file that the user selected.
     */
    filename?: string;
    /**
     * For file uploads, the name of the file that the user selected, encoded as a [RFC 8187](https://tools.ietf.org/html/rfc8187) `filename*` parameter.
     * This parameter allows non-ASCII characters in filenames, and specifies the character encoding.
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
    filename?: string;
    filenameSplat?: string;
    name?: string;
    type?: string;
    constructor(init?: string | ContentDispositionInit);
    /**
     * The preferred filename for the content, using the `filename*` parameter if present, falling back to the `filename` parameter.
     *
     * From [RFC 6266](https://tools.ietf.org/html/rfc6266):
     *
     * Many user agent implementations predating this specification do not understand the "filename*" parameter.
     * Therefore, when both "filename" and "filename*" are present in a single header field value, recipients SHOULD
     * pick "filename*" and ignore "filename". This way, senders can avoid special-casing specific user agents by
     * sending both the more expressive "filename*" parameter, and the "filename" parameter as fallback for legacy recipients.
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
import { type HeaderValue } from './header-value.ts';
/**
 * Initializer for a `Content-Range` header value.
 */
export interface ContentRangeInit {
    /**
     * The unit of the range, typically "bytes"
     */
    unit?: string;
    /**
     * The start position of the range (inclusive)
     * Set to null for unsatisfied ranges
     */
    start?: number | null;
    /**
     * The end position of the range (inclusive)
     * Set to null for unsatisfied ranges
     */
    end?: number | null;
    /**
     * The total size of the resource
     * Set to '*' for unknown size
     */
    size?: number | '*';
}
/**
 * The value of a `Content-Range` HTTP header.
 *
 * [MDN `Content-Range` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Range)
 *
 * [HTTP/1.1 Specification](https://httpwg.org/specs/rfc9110.html#field.content-range)
 */
export declare class ContentRange implements HeaderValue, ContentRangeInit {
    unit: string;
    start: number | null;
    end: number | null;
    size?: number | '*';
    constructor(init?: string | ContentRangeInit);
    /**
     * Returns the string representation of the header value.
     *
     * @returns The header value as a string
     */
    toString(): string;
    /**
     * Parse a Content-Range header value.
     *
     * @param value The header value (string, init object, or null)
     * @returns A ContentRange instance (empty if null)
     */
    static from(value: string | ContentRangeInit | null): ContentRange;
}
//# sourceMappingURL=content-range.d.ts.map
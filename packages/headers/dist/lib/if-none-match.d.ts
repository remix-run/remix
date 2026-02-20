import { type HeaderValue } from './header-value.ts';
/**
 * Initializer for an `If-None-Match` header value.
 */
export interface IfNoneMatchInit {
    /**
     * The entity tags to compare against the current entity.
     */
    tags: string[];
}
/**
 * The value of an `If-None-Match` HTTP header.
 *
 * [MDN `If-None-Match` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-None-Match)
 *
 * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7232#section-3.2)
 */
export declare class IfNoneMatch implements HeaderValue, IfNoneMatchInit {
    tags: string[];
    constructor(init?: string | string[] | IfNoneMatchInit);
    /**
     * Checks if the header contains the given entity tag.
     *
     * Note: This method checks only for exact matches and does not consider wildcards.
     *
     * @param tag The entity tag to check for
     * @returns `true` if the tag is present in the header, `false` otherwise
     */
    has(tag: string): boolean;
    /**
     * Checks if this header matches the given entity tag.
     *
     * @param tag The entity tag to check for
     * @returns `true` if the tag is present in the header (or the header contains a wildcard), `false` otherwise
     */
    matches(tag: string): boolean;
    /**
     * Returns the string representation of the header value.
     *
     * @returns The header value as a string
     */
    toString(): string;
    /**
     * Parse an If-None-Match header value.
     *
     * @param value The header value (string, string[], init object, or null)
     * @returns An IfNoneMatch instance (empty if null)
     */
    static from(value: string | string[] | IfNoneMatchInit | null): IfNoneMatch;
}
//# sourceMappingURL=if-none-match.d.ts.map
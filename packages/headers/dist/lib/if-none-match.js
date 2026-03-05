import {} from "./header-value.js";
import { quoteEtag } from "./utils.js";
/**
 * The value of an `If-None-Match` HTTP header.
 *
 * [MDN `If-None-Match` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-None-Match)
 *
 * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7232#section-3.2)
 */
export class IfNoneMatch {
    tags = [];
    constructor(init) {
        if (init)
            return IfNoneMatch.from(init);
    }
    /**
     * Checks if the header contains the given entity tag.
     *
     * Note: This method checks only for exact matches and does not consider wildcards.
     *
     * @param tag The entity tag to check for
     * @returns `true` if the tag is present in the header, `false` otherwise
     */
    has(tag) {
        return this.tags.includes(quoteEtag(tag));
    }
    /**
     * Checks if this header matches the given entity tag.
     *
     * @param tag The entity tag to check for
     * @returns `true` if the tag is present in the header (or the header contains a wildcard), `false` otherwise
     */
    matches(tag) {
        return this.has(tag) || this.tags.includes('*');
    }
    /**
     * Returns the string representation of the header value.
     *
     * @returns The header value as a string
     */
    toString() {
        return this.tags.join(', ');
    }
    /**
     * Parse an If-None-Match header value.
     *
     * @param value The header value (string, string[], init object, or null)
     * @returns An IfNoneMatch instance (empty if null)
     */
    static from(value) {
        let header = new IfNoneMatch();
        if (value !== null) {
            if (typeof value === 'string') {
                header.tags.push(...value.split(/\s*,\s*/).map(quoteEtag));
            }
            else if (Array.isArray(value)) {
                header.tags.push(...value.map(quoteEtag));
            }
            else {
                header.tags.push(...value.tags.map(quoteEtag));
            }
        }
        return header;
    }
}

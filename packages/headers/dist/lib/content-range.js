import {} from './header-value.js';
/**
 * Checks that the parsed parts of a `Content-Range` form a range RFC 9110 allows.
 *
 * `first-pos` must not exceed `last-pos`, and `last-pos` must fall inside the
 * resource when `complete-length` is known.
 *
 * @param start The inclusive start offset, or `null` for unsatisfied ranges
 * @param end The inclusive end offset, or `null` for unsatisfied ranges
 * @param size The total resource size, or `'*'` when unknown
 * @returns `true` when the range is valid
 */
function isValidContentRange(start, end, size) {
    // Incomplete bounds serialize as an unsatisfied range with no positions to validate.
    if (start === null || end === null)
        return true;
    // Range responses must have ordered bounds within the known complete length:
    // https://www.rfc-editor.org/rfc/rfc9110.html#section-14.4
    if (start > end)
        return false;
    if (typeof size === 'number' && end >= size)
        return false;
    return true;
}
/**
 * The value of a `Content-Range` HTTP header.
 *
 * [MDN `Content-Range` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Range)
 *
 * [HTTP/1.1 Specification](https://httpwg.org/specs/rfc9110.html#field.content-range)
 */
export class ContentRange {
    /**
     * The range unit, typically `bytes`.
     */
    unit = '';
    /**
     * The inclusive start offset, or `null` for unsatisfied ranges.
     */
    start = null;
    /**
     * The inclusive end offset, or `null` for unsatisfied ranges.
     */
    end = null;
    /**
     * The total resource size, or `'*'` when unknown.
     */
    size;
    constructor(init) {
        if (init)
            return ContentRange.from(init);
    }
    /**
     * Returns the string representation of the header value.
     *
     * @returns The header value as a string
     */
    toString() {
        if (!this.unit || this.size === undefined)
            return '';
        if (!isValidContentRange(this.start, this.end, this.size))
            return '';
        let range = this.start !== null && this.end !== null ? `${this.start}-${this.end}` : '*';
        return `${this.unit} ${range}/${this.size}`;
    }
    /**
     * Parse a Content-Range header value.
     *
     * @param value The header value (string, init object, or null)
     * @returns A ContentRange instance (empty if null or the range is invalid)
     */
    static from(value) {
        let header = new ContentRange();
        if (value !== null) {
            if (typeof value === 'string') {
                // Parse: "bytes 200-1000/67589" or "bytes */67589" or "bytes 200-1000/*"
                let match = value.match(/^(\w+)\s+(?:(\d+)-(\d+)|\*)\/((?:\d+|\*))$/);
                if (match) {
                    let unit = match[1];
                    let start = match[2] ? parseInt(match[2], 10) : null;
                    let end = match[3] ? parseInt(match[3], 10) : null;
                    let size = match[4] === '*' ? '*' : parseInt(match[4], 10);
                    if (!isValidContentRange(start, end, size))
                        return header;
                    header.unit = unit;
                    header.start = start;
                    header.end = end;
                    header.size = size;
                }
            }
            else {
                let { unit, start, end, size } = value;
                if (!isValidContentRange(start ?? null, end ?? null, size))
                    return header;
                if (unit !== undefined)
                    header.unit = unit;
                if (start !== undefined)
                    header.start = start;
                if (end !== undefined)
                    header.end = end;
                if (size !== undefined)
                    header.size = size;
            }
        }
        return header;
    }
}

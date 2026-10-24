import {} from './header-value.js';
const maxRangeBound = String(Number.MAX_SAFE_INTEGER);
function normalizeRangeBound(value) {
    return value.replace(/^0+/, '') || '0';
}
function compareRangeBounds(left, right) {
    left = normalizeRangeBound(left);
    right = normalizeRangeBound(right);
    if (left.length !== right.length)
        return left.length - right.length;
    if (left === right)
        return 0;
    return left < right ? -1 : 1;
}
function parseRangeBound(value) {
    if (value === '')
        return undefined;
    // RFC 9110 requires handling large decimal bounds without integer overflow.
    // https://www.rfc-editor.org/rfc/rfc9110.html#section-14.1.2
    let significantValue = normalizeRangeBound(value);
    if (significantValue.length > maxRangeBound.length ||
        (significantValue.length === maxRangeBound.length && significantValue > maxRangeBound)) {
        return Number.MAX_SAFE_INTEGER;
    }
    return Number(significantValue);
}
function isValidRangeBound(value) {
    return value === undefined || value === Infinity || (Number.isInteger(value) && value >= 0);
}
function isValidResourceSize(value) {
    return Number.isSafeInteger(value) && value >= 0;
}
/**
 * The value of a `Range` HTTP header.
 *
 * [MDN `Range` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Range)
 *
 * [HTTP/1.1 Specification](https://httpwg.org/specs/rfc9110.html#field.range)
 */
export class Range {
    /**
     * The range unit, typically `bytes`.
     */
    unit = '';
    /**
     * Requested byte ranges from the header.
     */
    ranges = [];
    constructor(init) {
        if (init)
            return Range.from(init);
    }
    /**
     * Checks if this range can be satisfied for a resource of the given size.
     * A non-zero suffix is satisfiable even for an empty resource, although
     * {@link Range.normalize | normalize()} returns no concrete byte positions for it.
     *
     * @param resourceSize The size of the resource in bytes as a non-negative safe integer
     * @returns `true` if the range set is valid and contains at least one satisfiable range
     */
    canSatisfy(resourceSize) {
        // No unit or no ranges means header was malformed or empty
        if (!this.unit || this.ranges.length === 0 || !isValidResourceSize(resourceSize))
            return false;
        // One invalid member invalidates the entire range set.
        // https://www.rfc-editor.org/rfc/rfc9110.html#section-14.1.1
        for (let range of this.ranges) {
            if (!isValidRangeBound(range.start) || !isValidRangeBound(range.end)) {
                return false;
            }
            // At least one bound must be specified
            if (range.start === undefined && range.end === undefined) {
                return false;
            }
            // If both are specified, start must be <= end
            if (range.start !== undefined && range.end !== undefined && range.start > range.end) {
                return false;
            }
        }
        // A valid set is satisfiable when any member is satisfiable.
        // https://www.rfc-editor.org/rfc/rfc9110.html#section-14.1.1
        for (let range of this.ranges) {
            if (range.start === undefined) {
                // A non-zero suffix is satisfiable even for a zero-length representation.
                // https://www.rfc-editor.org/rfc/rfc9110.html#section-14.1.2
                if (range.end !== undefined && range.end > 0)
                    return true;
                continue;
            }
            if (range.start < resourceSize) {
                // At least one range starts within the resource
                return true;
            }
        }
        return false;
    }
    /**
     * Normalizes the ranges for a resource of the given size.
     * Returns an array of ranges with resolved start and end values.
     * Returns an empty array if no concrete byte positions can be normalized, including for a
     * zero-length resource, even when {@link Range.canSatisfy | canSatisfy()} returns `true`.
     *
     * @param resourceSize The size of the resource in bytes as a non-negative safe integer
     * @returns An array of ranges with resolved start and end values
     */
    normalize(resourceSize) {
        // Empty resources have no concrete byte positions, even for a satisfiable suffix.
        // https://www.rfc-editor.org/rfc/rfc9110.html#section-14.1.2
        if (!isValidResourceSize(resourceSize) ||
            resourceSize === 0 ||
            !this.canSatisfy(resourceSize)) {
            return [];
        }
        // Resolve only satisfiable members, clamping end offsets and suffixes to the resource.
        // https://www.rfc-editor.org/rfc/rfc9110.html#section-14.1.2
        return this.ranges.flatMap(({ start, end }) => {
            if (!isValidRangeBound(start) || !isValidRangeBound(end)) {
                return [];
            }
            if (start !== undefined && end !== undefined) {
                if (start >= resourceSize)
                    return [];
                // Both bounds specified (e.g., "0-99")
                return [
                    {
                        start,
                        end: Math.min(end, resourceSize - 1),
                    },
                ];
            }
            else if (start !== undefined) {
                if (start >= resourceSize)
                    return [];
                // Only start specified (e.g., "100-")
                return [
                    {
                        start,
                        end: resourceSize - 1,
                    },
                ];
            }
            else {
                // Only end specified (e.g., "-500" means last 500 bytes)
                if (end === undefined || end === 0)
                    return [];
                return [
                    {
                        start: Math.max(0, resourceSize - end),
                        end: resourceSize - 1,
                    },
                ];
            }
        });
    }
    /**
     * Returns the string representation of the header value.
     *
     * @returns The header value as a string
     */
    toString() {
        if (!this.unit || this.ranges.length === 0)
            return '';
        let rangeParts = this.ranges.map((range) => {
            if (range.start !== undefined && range.end !== undefined) {
                return `${range.start}-${range.end}`;
            }
            else if (range.start !== undefined) {
                return `${range.start}-`;
            }
            else if (range.end !== undefined) {
                return `-${range.end}`;
            }
            return '';
        });
        return `${this.unit}=${rangeParts.join(',')}`;
    }
    /**
     * Parse a Range header value.
     *
     * @param value The header value (string, init object, or null)
     * @returns A Range instance (empty if null)
     */
    static from(value) {
        let header = new Range();
        if (value !== null) {
            if (typeof value === 'string') {
                // Parse: "bytes=200-1000" or "bytes=200-" or "bytes=-500" or "bytes=0-99,200-299"
                let match = value.match(/^(\w+)=(.+)$/);
                if (match) {
                    header.unit = match[1];
                    let rangeParts = match[2].split(',');
                    // Track if any range part is invalid to mark the entire header as malformed
                    let hasInvalidPart = false;
                    for (let part of rangeParts) {
                        let rangeMatch = part.trim().match(/^(\d*)-(\d*)$/);
                        if (!rangeMatch) {
                            // Invalid syntax for this range part
                            hasInvalidPart = true;
                            continue;
                        }
                        let [, startStr, endStr] = rangeMatch;
                        // At least one bound must be specified
                        if (!startStr && !endStr) {
                            hasInvalidPart = true;
                            continue;
                        }
                        // Compare decimal strings before capping oversized bounds.
                        if (startStr && endStr && compareRangeBounds(startStr, endStr) > 0) {
                            hasInvalidPart = true;
                            continue;
                        }
                        let start = parseRangeBound(startStr);
                        let end = parseRangeBound(endStr);
                        // If both bounds are specified, start must be <= end
                        if (start !== undefined && end !== undefined && start > end) {
                            hasInvalidPart = true;
                            continue;
                        }
                        header.ranges.push({ start, end });
                    }
                    // If any part was invalid, mark as malformed by clearing ranges
                    if (hasInvalidPart) {
                        header.ranges = [];
                    }
                }
            }
            else {
                if (value.unit !== undefined)
                    header.unit = value.unit;
                if (value.ranges !== undefined)
                    header.ranges = value.ranges;
            }
        }
        return header;
    }
}

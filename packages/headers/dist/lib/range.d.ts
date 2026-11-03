import { type HeaderValue } from './header-value.ts';
/**
 * Initializer for a {@link Range} header value.
 */
export interface RangeInit {
    /**
     * The unit of the range, typically "bytes"
     */
    unit?: string;
    /**
     * The ranges requested. Each range has optional start and end values.
     * - {start: 0, end: 99} = bytes 0-99
     * - {start: 100} = bytes 100- (from 100 to end)
     * - {end: 500} = bytes -500 (last 500 bytes)
     */
    ranges?: Array<{
        start?: number;
        end?: number;
    }>;
}
/**
 * The value of a `Range` HTTP header.
 *
 * [MDN `Range` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Range)
 *
 * [HTTP/1.1 Specification](https://httpwg.org/specs/rfc9110.html#field.range)
 */
export declare class Range implements HeaderValue, RangeInit {
    /**
     * The range unit, typically `bytes`.
     */
    unit: string;
    /**
     * Requested byte ranges from the header.
     */
    ranges: Array<{
        start?: number;
        end?: number;
    }>;
    constructor(init?: string | RangeInit);
    /**
     * Checks if this range can be satisfied for a resource of the given size.
     * A non-zero suffix is satisfiable even for an empty resource, although
     * {@link Range.normalize | normalize()} returns no concrete byte positions for it.
     *
     * @param resourceSize The size of the resource in bytes as a non-negative safe integer
     * @returns `true` if the range set is valid and contains at least one satisfiable range
     */
    canSatisfy(resourceSize: number): boolean;
    /**
     * Normalizes the ranges for a resource of the given size.
     * Returns an array of ranges with resolved start and end values.
     * Returns an empty array if no concrete byte positions can be normalized, including for a
     * zero-length resource, even when {@link Range.canSatisfy | canSatisfy()} returns `true`.
     *
     * @param resourceSize The size of the resource in bytes as a non-negative safe integer
     * @returns An array of ranges with resolved start and end values
     */
    normalize(resourceSize: number): Array<{
        start: number;
        end: number;
    }>;
    /**
     * Returns the string representation of the header value.
     *
     * @returns The header value as a string
     */
    toString(): string;
    /**
     * Parse a Range header value.
     *
     * @param value The header value (string, init object, or null)
     * @returns A Range instance (empty if null)
     */
    static from(value: string | RangeInit | null): Range;
}
//# sourceMappingURL=range.d.ts.map
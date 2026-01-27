import { type HeaderValue } from './header-value.ts';
/**
 * Initializer for a `Range` header value.
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
    unit: string;
    ranges: Array<{
        start?: number;
        end?: number;
    }>;
    constructor(init?: string | RangeInit);
    /**
     * Checks if this range can be satisfied for a resource of the given size.
     *
     * @param resourceSize The size of the resource in bytes
     * @returns `false` if the range is malformed or all ranges are beyond the resource size
     */
    canSatisfy(resourceSize: number): boolean;
    /**
     * Normalizes the ranges for a resource of the given size.
     * Returns an array of ranges with resolved start and end values.
     * Returns an empty array if the range cannot be satisfied.
     *
     * @param resourceSize The size of the resource in bytes
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
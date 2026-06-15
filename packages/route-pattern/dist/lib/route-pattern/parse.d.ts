import { type Span } from './split.ts';
import { RoutePattern } from '../route-pattern.ts';
import type { PartPattern } from '../route-pattern.ts';
/**
 * Parse a route pattern source string
 *
 * @param source The pattern source, e.g. `'/users/:id'` or `'https://:tenant.example.com/dashboard?tab'`.
 * @returns The parsed pattern.
 * @throws {ParseError} When the source is malformed.
 */
export declare function parsePattern<source extends string>(source: source): RoutePattern<source>;
/**
 * Parse a single URL part (hostname or pathname).
 *
 * @private
 */
export declare function parsePart(source: string, options: {
    span?: Span;
    type: 'hostname' | 'pathname';
}): PartPattern;
type ParseErrorType = 'unmatched (' | 'unmatched )' | 'missing variable name' | 'dangling escape' | 'invalid protocol';
/** Error thrown when a route pattern cannot be parsed. */
export declare class ParseError extends Error {
    /** The parse failure category. */
    type: ParseErrorType;
    /** Original pattern source being parsed. */
    source: string;
    /** Character index where parsing failed. */
    index: number;
    constructor(type: ParseErrorType, source: string, index: number);
}
export {};
//# sourceMappingURL=parse.d.ts.map
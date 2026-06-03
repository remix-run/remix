import { type Span } from './split.ts';
import type { PartPattern, ParsedRoutePattern } from './types.ts';
export declare function parsePatternParts(source: string): ParsedRoutePattern;
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
//# sourceMappingURL=parse-parts.d.ts.map
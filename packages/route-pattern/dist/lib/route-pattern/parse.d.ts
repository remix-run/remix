import type { Span } from './split.ts';
import type { RoutePattern } from '../route-pattern.ts';
export declare function parseProtocol(source: string, span: Span | null): RoutePattern['ast']['protocol'];
export declare function parseHostname(source: string, span: Span | null): RoutePattern['ast']['hostname'] | null;
export declare function parseSearch(source: string): RoutePattern['ast']['search'];
type ParseErrorType = 'unmatched (' | 'unmatched )' | 'missing variable name' | 'dangling escape' | 'invalid protocol';
/**
 * Error thrown when a route pattern cannot be parsed.
 */
export declare class ParseError extends Error {
    /**
     * The parse failure category.
     */
    type: ParseErrorType;
    /**
     * Original pattern source being parsed.
     */
    source: string;
    /**
     * Character index where parsing failed.
     */
    index: number;
    constructor(type: ParseErrorType, source: string, index: number);
}
export {};
//# sourceMappingURL=parse.d.ts.map
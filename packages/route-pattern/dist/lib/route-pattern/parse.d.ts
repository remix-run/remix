import type { Span } from './split.ts';
import type { RoutePattern } from '../route-pattern.ts';
export declare function protocol(source: string, span: Span | null): RoutePattern['ast']['protocol'];
export declare function hostname(source: string, span: Span | null): RoutePattern['ast']['hostname'] | null;
/**
 * Parse a search string into search constraints.
 *
 * Search constraints define what query params must be present:
 * - `null`: param must be present (e.g., `?q`, `?q=`, `?q=1`)
 * - Empty `Set`: param must be present with a value (e.g., `?q=1`)
 * - Non-empty `Set`: param must be present with all these values (e.g., `?q=x&q=y`)
 *
 * Examples:
 * ```ts
 * parse('q')       // -> Map([['q', null]])
 * parse('q=')      // -> Map([['q', new Set()]])
 * parse('q=x&q=y') // -> Map([['q', new Set(['x', 'y'])]])
 * ```
 *
 * @param source the search string to parse (without leading `?`)
 * @returns the parsed search constraints
 */
export declare function search(source: string): RoutePattern['ast']['search'];
type ParseErrorType = 'unmatched (' | 'unmatched )' | 'missing variable name' | 'dangling escape' | 'invalid protocol';
export declare class ParseError extends Error {
    type: ParseErrorType;
    source: string;
    index: number;
    constructor(type: ParseErrorType, source: string, index: number);
}
export {};
//# sourceMappingURL=parse.d.ts.map
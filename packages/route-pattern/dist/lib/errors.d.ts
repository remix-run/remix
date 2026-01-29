import type { RoutePattern } from './route-pattern.ts';
import type { PartPattern } from './route-pattern/part-pattern.ts';
import type * as Search from './route-pattern/search.ts';
type ParseErrorType = 'unmatched (' | 'unmatched )' | 'missing variable name' | 'dangling escape' | 'invalid protocol';
export declare class ParseError extends Error {
    type: ParseErrorType;
    source: string;
    index: number;
    constructor(type: ParseErrorType, source: string, index: number);
}
type HrefErrorDetails = {
    type: 'missing-hostname';
    pattern: RoutePattern;
} | {
    type: 'missing-params';
    pattern: RoutePattern;
    partPattern: PartPattern;
    params: Record<string, string | number>;
} | {
    type: 'missing-search-params';
    pattern: RoutePattern;
    missingParams: string[];
    searchParams: Search.HrefParams;
} | {
    type: 'nameless-wildcard';
    pattern: RoutePattern;
};
export declare class HrefError extends Error {
    details: HrefErrorDetails;
    constructor(details: HrefErrorDetails);
    static message(details: HrefErrorDetails): string;
}
export declare function unreachable(value?: never): never;
export {};
//# sourceMappingURL=errors.d.ts.map
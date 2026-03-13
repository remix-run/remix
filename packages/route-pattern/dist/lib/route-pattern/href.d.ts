import type { RoutePattern } from '../route-pattern.ts';
import type { PartPattern } from './part-pattern.ts';
import type { ParseParams } from './params.ts';
import type { Split, SplitPattern } from '../types/split.ts';
import type { Simplify } from '../types/utils.ts';
export type HrefArgs<source extends string> = _HrefArgs<ParseHrefParams<source>>;
type _HrefArgs<params> = {} extends params ? [
    params?: Simplify<params & Record<string, unknown>> | null | undefined,
    searchParams?: SearchParams
] : [
    params: Simplify<params & Record<string, unknown>>,
    searchParams?: SearchParams
];
type SearchParams = Record<string, string | number | null | undefined | Array<string | number | null | undefined>>;
type ParseHrefParams<source extends string> = Split<source> extends infer split extends SplitPattern ? split extends ({
    protocol: string;
    hostname: undefined;
} | {
    hostname: undefined;
    port: string;
}) ? never : ParseParams<split> extends infer params extends Record<string, string | undefined> ? params extends {
    '*': string;
} ? never : Optionalize<Omit<params, '*'>> : never : never;
type Optionalize<record extends Record<string, string | undefined>> = {
    [key in keyof record as undefined extends record[key] ? never : key]: string | number;
} & {
    [key in keyof record as undefined extends record[key] ? key : never]?: string | number | null | undefined;
};
/**
 * Generate a search query string from a pattern and params.
 *
 * @param pattern the route pattern containing search constraints
 * @param searchParams the search params to include in the href
 * @returns the query string (without leading `?`), or undefined if empty
 */
export declare function hrefSearch(pattern: RoutePattern, searchParams: SearchParams): string | undefined;
type HrefErrorDetails = {
    type: 'missing-hostname';
    pattern: RoutePattern;
} | {
    type: 'missing-params';
    pattern: RoutePattern;
    partPattern: PartPattern;
    missingParams: Array<string>;
    params: Record<string, unknown>;
} | {
    type: 'missing-search-params';
    pattern: RoutePattern;
    missingParams: Array<string>;
    searchParams: SearchParams;
} | {
    type: 'nameless-wildcard';
    pattern: RoutePattern;
};
export declare class HrefError extends Error {
    details: HrefErrorDetails;
    constructor(details: HrefErrorDetails);
    static message(details: HrefErrorDetails): string;
}
export {};
//# sourceMappingURL=href.d.ts.map
import type { RoutePattern } from '../route-pattern.ts';
import type { OptionalParams, RequiredParams } from '../types/params.ts';
import type { PartPattern } from './part-pattern.ts';
type ParamValue = string | number;
type Params = Record<string, ParamValue>;
export type Args<source extends string> = [
    RequiredParams<source>
] extends [never] ? [
] | [null | undefined | Record<string, any>] | [null | undefined | Record<string, any>, SearchParams] : [
    ParamsArg<source>,
    SearchParams
] | [ParamsArg<source>];
type ParamsArg<source extends string> = Record<RequiredParams<source>, ParamValue> & Partial<Record<OptionalParams<source>, ParamValue | null | undefined>> & Record<string, unknown>;
/**
 * Generate a partial href from a part pattern and params.
 *
 * @param pattern The route pattern containing the part pattern.
 * @param partPattern The part pattern to generate an href for.
 * @param params The parameters to substitute into the pattern.
 * @returns The href (URL) for the given params, or null if no variant matches.
 */
export declare function part(pattern: RoutePattern, partPattern: PartPattern, params: Params): string;
export type SearchParams = Record<string, string | number | null | undefined | Array<string | number | null | undefined>>;
/**
 * Generate a search query string from a pattern and params.
 *
 * @param pattern the route pattern containing search constraints
 * @param searchParams the search params to include in the href
 * @returns the query string (without leading `?`), or undefined if empty
 */
export declare function search(pattern: RoutePattern, searchParams: SearchParams): string | undefined;
type HrefErrorDetails = {
    type: 'missing-hostname';
    pattern: RoutePattern;
} | {
    type: 'missing-params';
    pattern: RoutePattern;
    partPattern: PartPattern;
    missingParams: Array<string>;
    params: Record<string, string | number>;
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
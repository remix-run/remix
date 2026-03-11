import type { RoutePattern } from '../route-pattern.ts';
import type { OptionalParams, RequiredParams } from '../types/params.ts';
import type { PartPattern } from './part-pattern.ts';
type HrefParamValue = string | number;
export type HrefParams = Record<string, HrefParamValue>;
export type HrefArgs<source extends string> = [
    RequiredParams<source>
] extends [never] ? [
] | [null | undefined | Record<string, any>] | [null | undefined | Record<string, any>, HrefSearchParams] : [
    HrefParamsArg<source>,
    HrefSearchParams
] | [HrefParamsArg<source>];
type HrefParamsArg<source extends string> = Record<RequiredParams<source>, HrefParamValue> & Partial<Record<OptionalParams<source>, HrefParamValue | null | undefined>> & Record<string, unknown>;
export type HrefSearchParams = Record<string, string | number | null | undefined | Array<string | number | null | undefined>>;
/**
 * Generate a search query string from a pattern and params.
 *
 * @param pattern the route pattern containing search constraints
 * @param searchParams the search params to include in the href
 * @returns the query string (without leading `?`), or undefined if empty
 */
export declare function hrefSearch(pattern: RoutePattern, searchParams: HrefSearchParams): string | undefined;
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
    searchParams: HrefSearchParams;
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
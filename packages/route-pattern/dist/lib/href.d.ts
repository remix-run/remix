import { RoutePattern } from './route-pattern.ts';
import type { ParseParams } from './types/params.ts';
import type { Split, SplitPattern } from './types/split.ts';
import type { Simplify } from './types/utils.ts';
/** Tuple of arguments accepted by `createHref` for a given pattern source. */
export type CreateHrefArgs<source extends string> = ParseHrefParams<source> extends infer params ? [params] extends [never] ? never : _CreateHrefArgs<params> : never;
type _CreateHrefArgs<params> = {} extends params ? [
    params?: Simplify<params & Record<string, unknown>> | null | undefined,
    searchParams?: SearchParams
] : [
    params: Simplify<params & Record<string, unknown>>,
    searchParams?: SearchParams
];
type SearchParams = Record<string, string | number | null | undefined | Array<string | number | null | undefined>>;
type ParseHrefParams<source extends string> = Split<source> extends infer split ? split extends never ? never : split extends SplitPattern ? split extends ({
    protocol: string;
    hostname: undefined;
} | {
    hostname: undefined;
    port: string;
}) ? never : ParseParams<source> extends infer params extends Record<string, string | undefined> ? params extends {
    '*': string;
} ? never : Optionalize<Omit<params, '*'>> : never : never : never;
type Optionalize<record extends Record<string, string | undefined>> = {
    [key in keyof record as undefined extends record[key] ? never : key]: string | number;
} & {
    [key in keyof record as undefined extends record[key] ? key : never]?: string | number | null | undefined;
};
/**
 * Generate an href from a route pattern and the supplied params.
 *
 * @param pattern The parsed route pattern.
 * @param args Path params and optional search params.
 * @returns The generated href string.
 * @throws {CreateHrefError} When the pattern requires a hostname, contains a nameless wildcard,
 * is missing required params, or receives invalid params.
 */
export declare function createHref<source extends string>(pattern: source | RoutePattern<source>, ...args: CreateHrefArgs<source>): string;
/** Structured details for a {@link CreateHrefError}. */
export type CreateHrefErrorDetails = {
    type: 'missing-hostname';
    pattern: RoutePattern;
} | {
    type: 'missing-params';
    pattern: RoutePattern;
    missingParams: Array<string>;
    params: Record<string, unknown>;
} | {
    type: 'nameless-wildcard';
    pattern: RoutePattern;
} | {
    type: 'invalid-hostname-variable';
    value: string;
    char: string;
} | {
    type: 'invalid-hostname-wildcard';
    value: string;
    char: string;
} | {
    type: 'invalid-pathname-variable';
    pattern: RoutePattern;
    paramName: string;
    value: string;
};
/** Error thrown when a route pattern cannot generate an href from the supplied args. */
export declare class CreateHrefError extends Error {
    details: CreateHrefErrorDetails;
    constructor(details: CreateHrefErrorDetails);
    static message(details: CreateHrefErrorDetails): string;
}
export declare function encodePathnameVariable(value: unknown): string;
export declare function encodePathnameWildcard(value: unknown): string;
export declare function validateHostnameVariable(value: unknown): string;
export declare function validateHostnameWildcard(value: unknown): string;
export {};
//# sourceMappingURL=href.d.ts.map
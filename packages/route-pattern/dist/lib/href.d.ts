import type { RequiredParams, OptionalParams } from './params.ts';
import { type ParseResult } from './parse.ts';
import type { RoutePattern } from './route-pattern.ts';
import type { Variant } from './variant.ts';
/**
 * An error thrown when a required parameter is missing when building an href.
 */
export declare class MissingParamError extends Error {
    /**
     * The name of the missing parameter.
     */
    readonly paramName: string;
    /**
     * @param paramName The name of the missing parameter
     */
    constructor(paramName: string);
}
/**
 * Create a reusable href builder function.
 *
 * @returns A function that builds hrefs from patterns and parameters
 */
export declare function createHrefBuilder<T extends string | RoutePattern = string>(): HrefBuilder<T>;
export declare function formatHref(parsed: ParseResult, params?: Record<string, any>, searchParams?: Record<string, any>): string;
/**
 * A function that builds hrefs from patterns and parameters.
 */
export interface HrefBuilder<T extends string | RoutePattern = string> {
    /**
     * @param pattern The pattern to build an href for
     * @param args The parameters and optional search params
     * @returns The built href
     */
    <P extends string extends T ? string : SourceOf<T> | Variant<SourceOf<T>>>(pattern: P | RoutePattern<P>, ...args: HrefBuilderArgs<P>): string;
}
type SourceOf<T> = T extends string ? T : T extends RoutePattern<infer S extends string> ? S : never;
/**
 * The arguments for a `href()` function.
 */
export type HrefBuilderArgs<T extends string> = [
    RequiredParams<T>
] extends [never] ? [
] | [null | undefined | Record<string, any>] | [null | undefined | Record<string, any>, HrefSearchParams] : [
    HrefParams<T>,
    HrefSearchParams
] | [HrefParams<T>];
type HrefParams<T extends string> = Record<RequiredParams<T>, ParamValue> & Partial<Record<OptionalParams<T>, ParamValue | null | undefined>>;
type HrefSearchParams = NonNullable<ConstructorParameters<typeof URLSearchParams>[0]> | Record<string, ParamValue | undefined | null>;
type ParamValue = string | number | bigint | boolean;
export {};
//# sourceMappingURL=href.d.ts.map
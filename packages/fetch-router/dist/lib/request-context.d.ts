import type { Router } from './router.ts';
import type { Simplify } from './type-utils.ts';
/**
 * Create a request context key with an optional default value.
 *
 * @param defaultValue The default value for the context key
 * @returns The new context key
 */
export declare function createContextKey<value>(): ContextKey<value>;
export declare function createContextKey<value>(defaultValue: value): ContextKey<value> & {
    defaultValue: value;
};
/**
 * A type-safe key for storing and retrieving values from {@link RequestContext}.
 */
export interface ContextKey<value> {
    /**
     * The default value for this key if no value has been set.
     */
    defaultValue?: value;
}
/**
 * A broad params shape for APIs that cannot know an exact route pattern ahead of time.
 */
export type AnyParams = Record<string, string>;
/**
 * A request-context entry provided by middleware. The optional `property` field installs the value
 * as a direct request-context property when the middleware sets the value.
 */
export interface ContextEntry<key extends object = object, value = unknown> {
    /**
     * The context key that stores the value.
     */
    key: key;
    /**
     * The value type stored for the context key.
     */
    value: value;
    /**
     * Optional direct property name installed on the request context.
     */
    property?: string;
}
/**
 * An ordered list of request-context entries. Later entries override earlier ones for the same key.
 */
export type ContextEntries = readonly ContextEntry[];
/**
 * Resolves the value type associated with a request-context key.
 */
export type ContextValue<key> = key extends ContextKey<infer value> ? value : key extends {
    prototype: infer instance;
} ? instance : never;
type ContextDefaultValue<key> = key extends {
    defaultValue: infer value;
} ? value : never;
type ContextFallbackValue<key> = [ContextDefaultValue<key>] extends [never] ? ContextValue<key> | undefined : ContextDefaultValue<key>;
export declare const requestContextTypes: unique symbol;
interface RequestContextTypes<params extends Record<string, any>, entries extends ContextEntries> {
    readonly [requestContextTypes]?: {
        params: params;
        entries: entries;
    };
}
/**
 * Extracts the route params type from a {@link RequestContext}.
 */
export type ContextParams<context> = context extends RequestContextTypes<infer params extends Record<string, any>, any> ? params : {};
type RequestContextEntries<context> = context extends RequestContextTypes<any, infer entries extends ContextEntries> ? entries : [];
/**
 * Resolves duplicate route params. Values in `right` win when present, but optional right-side
 * params may fall back to values in `left`, matching route-pattern's right-most param behavior.
 */
type MergeParamValue<left, right> = undefined extends right ? Exclude<right, undefined> | left : right;
type MergeParamValues<left extends Record<string, any>, right extends Record<string, any>> = {
    [key in keyof right]: key extends keyof left ? MergeParamValue<left[key], right[key]> : right[key];
};
/**
 * Merges two params objects, matching route-pattern's right-most param behavior.
 */
export type MergeContextParams<left extends Record<string, any>, right extends Record<string, any>> = Simplify<Omit<left, keyof right> & MergeParamValues<left, right>>;
/**
 * Adds route params to a {@link RequestContext} while preserving its existing context values.
 */
export type ContextWithParams<context, params extends Record<string, any>> = context extends RequestContextTypes<any, any> ? RequestContextWithEntries<MergeContextParams<ContextParams<context>, params>, RequestContextEntries<context>> : RequestContextWithEntries<params, []>;
type ResolveEntryValue<entries extends ContextEntries, key extends object, fallback> = entries extends readonly [...infer rest extends ContextEntries, infer last extends ContextEntry] ? [key] extends [last['key']] ? [last['key']] extends [key] ? last['value'] : ResolveEntryValue<rest, key, fallback> : ResolveEntryValue<rest, key, fallback> : fallback;
/**
 * Resolves the value type returned by `context.get(key)` for the given context and key.
 */
export type GetContextValue<context, key extends object> = context extends RequestContextTypes<any, any> ? ResolveEntryValue<RequestContextEntries<context>, key, ContextFallbackValue<key>> : ContextFallbackValue<key>;
type ContextEntryProperty<entry extends ContextEntry> = entry extends {
    property: infer property extends string;
} ? string extends property ? never : property : never;
type ContextProperties<entries extends ContextEntries> = entries extends readonly [
    ...infer rest extends ContextEntries,
    infer last extends ContextEntry
] ? Simplify<Omit<ContextProperties<rest>, ContextEntryProperty<last>> & {
    readonly [property in ContextEntryProperty<last>]: last['value'];
}> : {};
type RequestContextWithEntries<params extends Record<string, any>, entries extends ContextEntries> = RequestContext<params, entries> & ContextProperties<entries>;
/**
 * Appends context entries to an existing {@link RequestContext}.
 * This is useful when deriving a context shape without a middleware tuple.
 */
export type ContextWithEntries<context, additions extends ContextEntries> = context extends RequestContextTypes<any, any> ? RequestContextWithEntries<ContextParams<context>, [
    ...RequestContextEntries<context>,
    ...additions
]> : never;
/**
 * Replaces or adds the value type for a single context entry in a {@link RequestContext}.
 * This is useful when deriving a context shape without a middleware tuple.
 */
export type ContextWithEntry<context, entry extends ContextEntry> = ContextWithEntries<context, [
    entry
]>;
/**
 * A context object that contains information about the current request. Every request
 * handler or middleware in the lifecycle of a request receives the same context object.
 */
export declare class RequestContext<params extends Record<string, any> = {}, entries extends ContextEntries = []> {
    #private;
    /**
     * @param request The incoming request
     */
    constructor(request: Request);
    /**
     * A mutable copy of the request headers.
     */
    get headers(): Headers;
    set headers(headers: Headers);
    /**
     * The request method. This may differ from `request.method` when using the `methodOverride`
     * middleware, which allows HTML forms to simulate RESTful API request methods like `PUT` and
     * `DELETE` using a hidden input field.
     */
    method: string;
    /**
     * Params that were parsed from the URL.
     */
    params: params;
    /**
     * The original request that was dispatched to the router.
     *
     * Note: Various properties of the original request may not be available or may have been
     * modified by middleware. For example, the request's body may already have been consumed by the
     * `formData` middleware (available as `context.get(FormData)`), or its method may have been
     * overridden by the `methodOverride` middleware (available as `context.method`). You should
     * default to using properties of the `context` object instead of the original request.
     * However, the original request is made available in case you need it for some edge case.
     */
    request: Request;
    /**
     * Get a value from request context.
     *
     * @param key The key to read
     * @returns The value for the given key, or `undefined` if the value is not available
     */
    get: <key extends object>(key: key) => ResolveEntryValue<entries, key, ContextFallbackValue<key>>;
    /**
     * Check whether a value exists in request context.
     *
     * @param key The key to check
     * @returns `true` if a value has been set for the key
     */
    has: <key extends object>(key: key) => boolean;
    /**
     * Set a value in request context.
     *
     * @param key The key to write
     * @param value The value to write
     * @param options Options for installing the value as a direct context property
     */
    set: <key extends object>(key: key, value: ContextValue<key>, options?: {
        property: string;
    } | undefined) => void;
    /**
     * The router handling this request.
     */
    get router(): Router<RequestContext<any, entries>>;
    set router(router: Router<any>);
    /**
     * The URL of the current request.
     */
    url: URL;
}
export interface RequestContext<params extends Record<string, any> = {}, entries extends ContextEntries = []> extends RequestContextTypes<params, entries> {
}
export {};
//# sourceMappingURL=request-context.d.ts.map
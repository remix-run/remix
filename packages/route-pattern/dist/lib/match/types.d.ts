import type { RoutePattern } from '../route-pattern.ts';
import type { ParseParams } from '../types/params.ts';
import type { Simplify } from '../types/utils.ts';
/** Params extracted from a route pattern match. */
export type MatchParams<source extends string> = ParseParams<source> extends infer params ? [params] extends [never] ? never : Simplify<Omit<params, '*'>> : never;
/** Metadata describing where a matched param appeared in a normalized URL part. */
export type MatchParamMeta = {
    /** Param token kind: `:` for variables or `*` for wildcards. */
    type: ':' | '*';
    /** Param name, or `*` for an unnamed wildcard. */
    name: string;
    /** Matched param value after URL normalization and decoding. */
    value: string;
    /** Start offset after the URL part is normalized. */
    begin: number;
    /** End offset after the URL part is normalized. */
    end: number;
};
/** Result returned by route pattern matchers. */
export type Match<source extends string = string, data = unknown> = {
    /** URL object used for the match. */
    url: URL;
    /** Pattern that matched the URL. */
    pattern: RoutePattern<source>;
    /** Data attached to the matched pattern. */
    data: data;
    /** Params captured from the matched pattern. */
    params: MatchParams<source>;
    /** Metadata for hostname and pathname params captured during matching. */
    paramsMeta: {
        /** Params captured from the hostname pattern. */
        hostname: ReadonlyArray<MatchParamMeta>;
        /** Params captured from the pathname pattern. */
        pathname: ReadonlyArray<MatchParamMeta>;
    };
};
//# sourceMappingURL=types.d.ts.map
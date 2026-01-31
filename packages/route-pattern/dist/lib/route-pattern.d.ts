import { PartPattern, type PartPatternMatch } from './route-pattern/part-pattern.ts';
import type { Join, Params } from './types/index.ts';
import { type HrefArgs } from './route-pattern/href.ts';
type AST = {
    protocol: 'http' | 'https' | 'http(s)' | null;
    hostname: PartPattern | null;
    port: string | null;
    pathname: PartPattern;
    /**
     * - `null`: key must be present
     * - Empty `Set`: key must be present with a value
     * - Non-empty `Set`: key must be present with all these values
     *
     * ```ts
     * new Map([['q', null]])                // -> ?q, ?q=, ?q=1
     * new Map([['q', new Set()]])           // -> ?q=1
     * new Map([['q', new Set(['x', 'y'])]]) // -> ?q=x&q=y
     * ```
     */
    search: Map<string, Set<string> | null>;
};
export type RoutePatternOptions = {
    ignoreCase?: boolean;
};
export type RoutePatternMatch<source extends string = string> = {
    pattern: RoutePattern;
    url: URL;
    params: Params<source>;
    meta: {
        hostname: PartPatternMatch;
        pathname: PartPatternMatch;
    };
};
export declare class RoutePattern<source extends string = string> {
    readonly ast: AST;
    readonly ignoreCase: boolean;
    constructor(source: source, options?: RoutePatternOptions);
    private get hasOrigin();
    get protocol(): string;
    get hostname(): string;
    get port(): string;
    get pathname(): string;
    get search(): string;
    get source(): string;
    toString(): string;
    join<other extends string>(other: other | RoutePattern<other>, options?: RoutePatternOptions): RoutePattern<Join<source, other>>;
    href(...args: HrefArgs<source>): string;
    match(url: string | URL): RoutePatternMatch<source> | null;
    test(url: string | URL): boolean;
}
export {};
//# sourceMappingURL=route-pattern.d.ts.map
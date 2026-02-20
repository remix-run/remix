import { RoutePattern } from './route-pattern.ts';
import type { Match, Matcher } from './matcher.ts';
export declare class ArrayMatcher<data> implements Matcher<data> {
    #private;
    readonly ignoreCase: boolean;
    /**
     * @param options Constructor options
     * @param options.ignoreCase When `true`, pathname matching is case-insensitive for all patterns. Defaults to `false`.
     */
    constructor(options?: {
        ignoreCase?: boolean;
    });
    add(pattern: string | RoutePattern, data: data): void;
    match(url: string | URL, compareFn?: (a: import("./route-pattern.ts").RoutePatternMatch, b: import("./route-pattern.ts").RoutePatternMatch) => number): Match<string, data> | null;
    matchAll(url: string | URL, compareFn?: (a: import("./route-pattern.ts").RoutePatternMatch, b: import("./route-pattern.ts").RoutePatternMatch) => number): Array<Match<string, data>>;
}
//# sourceMappingURL=array-matcher.d.ts.map
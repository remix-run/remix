import type { PartPattern, PartPatternMatch, PartPatternToken } from './route-pattern/part-pattern.ts';
import { RoutePattern } from './route-pattern.ts';
import type { Match, Matcher } from './matcher.ts';
type Param = Extract<PartPatternToken, {
    type: ':' | '*';
}>;
export declare class TrieMatcher<data = unknown> implements Matcher<data> {
    trie: Trie<data>;
    constructor();
    add(pattern: string | RoutePattern, data: data): void;
    match(url: string | URL, compareFn?: (a: import("./route-pattern.ts").RoutePatternMatch, b: import("./route-pattern.ts").RoutePatternMatch) => number): Match<string, data> | null;
    matchAll(url: string | URL, compareFn?: (a: import("./route-pattern.ts").RoutePatternMatch, b: import("./route-pattern.ts").RoutePatternMatch) => number): Array<Match<string, data>>;
}
type ProtocolNode<data> = {
    http: HostnameNode<data>;
    https: HostnameNode<data>;
};
type HostnameNode<data> = {
    static: Map<string, PortNode<data>>;
    dynamic: Array<{
        part: PartPattern;
        portNode: PortNode<data>;
    }>;
    any: PortNode<data>;
};
type PortNode<data> = Map<string, PathnameNode<data>>;
type PathnameNode<data> = {
    static: Map<string, PathnameNode<data>>;
    variable: Map<string, {
        regexp: RegExp;
        pathnameNode: PathnameNode<data>;
    }>;
    wildcard: Map<string, {
        regexp: RegExp;
        pathnameNode: PathnameNode<data>;
    }>;
    value: {
        pattern: RoutePattern;
        data: data;
        requiredParams: Array<Param>;
        undefinedParams: Array<Param>;
    } | null;
};
type SearchResult<data> = Array<{
    pattern: RoutePattern;
    data: data;
    hostname: PartPatternMatch;
    pathname: PartPatternMatch;
    params: Record<string, string | undefined>;
}>;
export declare class Trie<data = unknown> {
    protocolNode: ProtocolNode<data>;
    constructor();
    insert(pattern: RoutePattern, data: data): void;
    search(url: URL): SearchResult<data>;
}
export {};
//# sourceMappingURL=trie-matcher.d.ts.map
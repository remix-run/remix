import type { RoutePatternParts, PartPattern } from '../route-pattern.ts';
export declare function serializePattern(pattern: RoutePatternParts): string;
export declare function serializePatternParts(pattern: RoutePatternParts): {
    protocol: string;
    hostname: string;
    port: string;
    pathname: string;
    search: string;
};
export declare function serializeProtocol(pattern: RoutePatternParts): string;
export declare function serializeHostname(pattern: RoutePatternParts): string;
export declare function serializePort(pattern: RoutePatternParts): string;
export declare function serializePathname(pattern: RoutePatternParts): string;
export declare function serializeSearch(pattern: RoutePatternParts): string;
export declare function serializePart(part: PartPattern): string;
//# sourceMappingURL=serialize.d.ts.map
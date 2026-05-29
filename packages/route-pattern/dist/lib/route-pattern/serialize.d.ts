import type { PartPattern, RoutePattern } from '../route-pattern.ts';
export declare function serializePattern(pattern: RoutePattern): string;
export declare function serializePatternParts(pattern: RoutePattern): {
    protocol: string;
    hostname: string;
    port: string;
    pathname: string;
    search: string;
};
export declare function serializeProtocol(pattern: RoutePattern): string;
export declare function serializeHostname(pattern: RoutePattern): string;
export declare function serializePort(pattern: RoutePattern): string;
export declare function serializePathname(pattern: RoutePattern): string;
export declare function serializeSearch(pattern: RoutePattern): string;
export declare function serializePart(part: PartPattern): string;
//# sourceMappingURL=serialize.d.ts.map
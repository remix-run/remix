export type RouteOwnerKind = 'controller' | 'directory';
export type RouteTreeNodeKind = 'group' | 'route';
export interface RouteTreeOwner {
    exists: boolean;
    kind: RouteOwnerKind;
    path: string;
}
export interface RouteTreeNode {
    children: RouteTreeNode[];
    key: string;
    kind: RouteTreeNodeKind;
    method?: string;
    name: string;
    owner: RouteTreeOwner;
    pattern?: string;
}
export interface LoadedRouteMap {
    appRoot: string;
    routesFile: string;
    tree: RouteTreeNode[];
}
export interface LoadedRouteManifest {
    appRoot: string;
    routesFile: string;
    tree: RawRouteTreeNode[];
}
export interface RawRouteTreeNode {
    children: RawRouteTreeNode[];
    key: string;
    kind: RouteTreeNodeKind;
    method?: string;
    name: string;
    pattern?: string;
}
export declare function loadRouteMap(cwd?: string): Promise<LoadedRouteMap>;
export declare function loadRouteManifest(cwd?: string): Promise<LoadedRouteManifest>;
export declare function loadRouteManifestFromAppRoot(appRoot: string): Promise<LoadedRouteManifest>;
//# sourceMappingURL=route-map.d.ts.map
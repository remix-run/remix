import type { RouteTreeNodeKind } from './route-map.ts';
export declare const ROOT_ROUTE_NAME = "<root>";
export interface OwnershipRouteNode {
    children: OwnershipRouteNode[];
    key: string;
    kind: RouteTreeNodeKind;
    method?: string;
    name: string;
}
export interface ControllerDirectoryScan {
    controllerEntryPaths: Set<string>;
    routeDirectoryPaths: Set<string>;
    routeLocalFilePaths: Set<string>;
}
export interface RouteDirectoryPlan {
    directoryPath: string;
    routeName: string;
}
export interface OwnedSubtreePlan {
    entryCandidates: string[];
    entryDisplayPath: string;
    routeName: string;
    subtreePath: string;
}
export interface OwnedSubtree extends OwnedSubtreePlan {
    actualEntryPath: string | null;
    actualEntryPaths: string[];
    claimedFilePaths: string[];
    claimedRouteLocalFilePaths: string[];
}
export interface ControllerOwnership {
    orphanControllerPaths: string[];
    orphanRouteDirectoryPaths: string[];
    routeDirectories: RouteDirectoryPlan[];
    scan: ControllerDirectoryScan;
    subtrees: OwnedSubtree[];
}
export declare function inspectControllerOwnership(appRoot: string, tree: OwnershipRouteNode[]): Promise<ControllerOwnership>;
export declare function buildOwnedSubtrees(tree: OwnershipRouteNode[], parentSegments?: string[], subtrees?: OwnedSubtreePlan[]): OwnedSubtreePlan[];
export declare function buildRouteDirectories(tree: OwnershipRouteNode[], parentSegments?: string[], directories?: RouteDirectoryPlan[]): RouteDirectoryPlan[];
//# sourceMappingURL=controller-ownership.d.ts.map
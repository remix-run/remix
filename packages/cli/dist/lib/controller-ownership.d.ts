import type { RouteOwnerKind, RouteTreeNodeKind } from './route-map.ts';
export interface OwnershipRouteNode {
    children: OwnershipRouteNode[];
    key: string;
    kind: RouteTreeNodeKind;
    method?: string;
    name: string;
}
export interface ControllerDirectoryScan {
    actionEntryPaths: Set<string>;
    controllerEntryPaths: Set<string>;
    rootDirectoryPaths: Set<string>;
    routeLocalFilePaths: Set<string>;
}
export interface OwnedSubtreePlan {
    alternateCandidates: string[];
    alternateDisplayPath: string;
    entryCandidates: string[];
    entryDisplayPath: string;
    kind: RouteOwnerKind;
    routeName: string;
    subtreePath: string;
}
export interface OwnedSubtree extends OwnedSubtreePlan {
    actualAlternatePath: string | null;
    actualAlternatePaths: string[];
    actualEntryPath: string | null;
    actualEntryPaths: string[];
    claimedFilePaths: string[];
    claimedRouteLocalFilePaths: string[];
}
export interface ControllerOwnership {
    orphanActionPaths: string[];
    orphanControllerPaths: string[];
    orphanRouteDirectoryPaths: string[];
    scan: ControllerDirectoryScan;
    subtrees: OwnedSubtree[];
}
export declare function inspectControllerOwnership(appRoot: string, tree: OwnershipRouteNode[]): Promise<ControllerOwnership>;
export declare function buildOwnedSubtrees(tree: OwnershipRouteNode[], parentSegments?: string[], subtrees?: OwnedSubtreePlan[]): OwnedSubtreePlan[];
//# sourceMappingURL=controller-ownership.d.ts.map
/** Access-policy result for an inspected asset file. */
export interface AssetAccessDetails {
    /** Whether the asset server may serve the file. */
    allowed: boolean;
    /** The first configured rule that allowed the file, when one matched. */
    allowedBy?: AssetAccessRule;
    /** The first matching `denyFiles` pattern, when access was denied. */
    deniedBy?: string;
}
/** Rule that allows an inspected asset file to be served. */
export type AssetAccessRule = 
/** A matching `allowFiles` entry. */
{
    kind: 'file';
    value: string;
}
/** A runtime file provided internally by the asset server. */
 | {
    kind: 'injected';
    value: string;
}
/** A matching `allowPackages` entry. */
 | {
    kind: 'package';
    value: string;
};
export type AccessPolicy = {
    getAllowedPackageRoots(): readonly string[];
    getPackageWatchDirectories(): readonly string[];
    handleFileEvent(filePath: string): void;
    inspect(filePath: string): AssetAccessDetails;
    isAllowed(filePath: string): boolean;
};
export declare function createAccessPolicy(options: {
    allowFiles: readonly string[];
    allowPackages?: readonly string[];
    denyFiles?: readonly string[];
    packageSearchRoots?: readonly string[];
    rootDir: string;
}): AccessPolicy;
//# sourceMappingURL=access.d.ts.map
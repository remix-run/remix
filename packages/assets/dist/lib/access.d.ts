type AccessPolicy = {
    getPackageWatchDirectories(): readonly string[];
    handleFileEvent(filePath: string): void;
    isAllowed(filePath: string): boolean;
};
export declare function createAccessPolicy(options: {
    allowFiles: readonly string[];
    allowPackages?: readonly string[];
    denyFiles?: readonly string[];
    denyPackages?: readonly string[];
    packageSearchRoots?: readonly string[];
    rootDir: string;
}): AccessPolicy;
export {};
//# sourceMappingURL=access.d.ts.map
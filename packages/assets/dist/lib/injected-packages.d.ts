export declare function isInjectedPackageFilePath(filePath: string): boolean;
export declare function getInjectedPackageRouteConfigs(): {
    fileMap: Record<string, string>;
    rootDir: string;
}[];
export declare function getInjectedPackageNameForSpecifier(specifier: string): string | null;
export declare function mayContainInjectedPackageSpecifier(sourceText: string): boolean;
export declare function maskAuthoredInjectedPackageSpecifier(specifier: string): string | null;
export declare function restoreAuthoredInjectedPackageSpecifier(specifier: string): string | null;
export declare function getInjectedPackageImporterPath(): string;
//# sourceMappingURL=injected-packages.d.ts.map
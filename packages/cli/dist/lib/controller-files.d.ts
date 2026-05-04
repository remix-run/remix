declare const OWNER_FILE_EXTENSIONS: readonly [".ts", ".tsx", ".js", ".jsx"];
export type OwnerFileExtension = (typeof OWNER_FILE_EXTENSIONS)[number];
export declare function getControllerOwnerCandidates(segments: string[]): string[];
export declare function getRouteSubtreePath(segments: string[]): string;
export declare function getPreferredOwnerDisplayPath(candidates: string[]): string;
export declare function getOwnerCandidateForExtension(candidates: string[], extension: OwnerFileExtension): string | null;
export declare function getOwnerFileExtension(filePath: string): OwnerFileExtension | null;
export declare function toDiskSegment(segment: string): string;
export declare function isControllerEntryFileName(fileName: string): boolean;
export declare function getOwnerModuleBaseName(fileName: string): string | null;
export declare function isActionFileName(fileName: string): boolean;
export {};
//# sourceMappingURL=controller-files.d.ts.map
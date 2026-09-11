export type FileMatcher = (filePath: string) => boolean;
export declare function createFileMatcher(pattern: string, rootDir: string, options?: {
    allowDirectories?: boolean;
    allowMissing?: boolean;
}): FileMatcher;
//# sourceMappingURL=file-matcher.d.ts.map
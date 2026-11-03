/**
 * Walks up from `startDir` looking for the closest directory that contains
 * `relativeFilePath`.
 *
 * @param startDir Directory the walk starts from.
 * @param relativeFilePath Slash-separated app file path, for example `app/routes.ts`.
 * @returns The closest ancestor directory that contains the file, or `null`
 *          when no ancestor contains it.
 */
export declare function findAppRoot(startDir: string, relativeFilePath: string): Promise<string | null>;
//# sourceMappingURL=app-root.d.ts.map
/**
 * Parses a migration filename into `{ id, name }`.
 *
 * Expected format: `YYYYMMDDHHmmss_name.(ts|js|mts|mjs|cts|cjs)`.
 * @param filename Migration file basename.
 * @returns Parsed migration id and name.
 */
export declare function parseMigrationFilename(filename: string): {
    id: string;
    name: string;
};
//# sourceMappingURL=filename.d.ts.map
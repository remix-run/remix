/**
 * Parses a migration directory name into `{ id, name }`.
 *
 * Expected format: `YYYYMMDDHHmmss_name`.
 * @param name Migration directory basename.
 * @returns Parsed migration id and name.
 */
export declare function parseMigrationDirectoryName(name: string): {
    id: string;
    name: string;
};
//# sourceMappingURL=directory-name.d.ts.map
/**
 * Parses a migration directory name into `{ id, name }`.
 *
 * Expected format: `<digits>_<name>`, such as `0001_create_users` or
 * `20260228090000_create_users` (`YYYYMMDDHHmmss`).
 * The prefix must contain 1 to 64 digits.
 * @param name Migration directory basename.
 * @returns Parsed migration id and name.
 */
export declare function parseMigrationDirectoryName(name: string): {
    id: string;
    name: string;
};
//# sourceMappingURL=directory-name.d.ts.map
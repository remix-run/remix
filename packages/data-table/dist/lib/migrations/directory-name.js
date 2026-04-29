const migrationDirectoryPattern = /^(\d{14})_(.+)$/;
/**
 * Parses a migration directory name into `{ id, name }`.
 *
 * Expected format: `YYYYMMDDHHmmss_name`.
 * @param name Migration directory basename.
 * @returns Parsed migration id and name.
 */
export function parseMigrationDirectoryName(name) {
    let match = name.match(migrationDirectoryPattern);
    if (!match) {
        throw new Error('Invalid migration directory name "' + name + '". Expected format YYYYMMDDHHmmss_name');
    }
    return {
        id: match[1],
        name: match[2],
    };
}

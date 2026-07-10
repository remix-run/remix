import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parseMigrationDirectoryName } from "./migrations/directory-name.js";
/**
 * Loads SQL-file migrations from a directory on Node.js.
 *
 * Each migration is a directory named `YYYYMMDDHHmmss_<slug>` containing:
 * - `up.sql` (required)
 * - `down.sql` (optional; omit for irreversible migrations)
 *
 * `id` and `name` are inferred from the directory name.
 * @param directory Absolute or relative directory containing migration directories.
 * @returns A sorted list of loaded migration descriptors.
 * @example
 * ```ts
 * import { loadMigrations } from 'remix/data-table/migrations/node'
 *
 * let migrations = await loadMigrations('./app/db/migrations')
 * ```
 */
export async function loadMigrations(directory) {
    let entries = await fs.readdir(directory, { withFileTypes: true });
    let directories = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((left, right) => left.localeCompare(right));
    let migrations = [];
    let seenIds = new Set();
    for (let directoryName of directories) {
        let parsed = parseMigrationDirectoryName(directoryName);
        if (seenIds.has(parsed.id)) {
            throw new Error('Duplicate migration id "' +
                parsed.id +
                '" inferred from directory "' +
                directoryName +
                '"');
        }
        seenIds.add(parsed.id);
        let directoryPath = path.join(directory, directoryName);
        let upPath = path.join(directoryPath, 'up.sql');
        let downPath = path.join(directoryPath, 'down.sql');
        let up;
        try {
            up = await fs.readFile(upPath, 'utf8');
        }
        catch (error) {
            if (isNodeFileNotFoundError(error)) {
                throw new Error('Migration directory "' + directoryName + '" is missing up.sql');
            }
            throw error;
        }
        let down;
        try {
            down = await fs.readFile(downPath, 'utf8');
        }
        catch (error) {
            if (!isNodeFileNotFoundError(error)) {
                throw error;
            }
        }
        migrations.push({
            id: parsed.id,
            name: parsed.name,
            up,
            down,
            path: directoryPath,
        });
    }
    return migrations;
}
function isNodeFileNotFoundError(error) {
    return (typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT');
}

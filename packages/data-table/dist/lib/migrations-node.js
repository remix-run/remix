import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parseMigrationDirectoryName } from './migrations/directory-name.js';
/**
 * Loads SQL-file migrations from a directory on Node.js.
 *
 * Each migration is a directory named `<digits>_<slug>` containing:
 * - `up.sql` (required)
 * - `down.sql` (optional; omit for irreversible migrations)
 *
 * `id` and `name` are inferred from the directory name. Ids must contain 1 to 64 digits,
 * for example `0001` or `20260228090000` (`YYYYMMDDHHmmss`). All ids in the directory must
 * be unique and have the same number of digits so migrations sort in numeric order.
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
    let idLength;
    for (let directoryName of directories) {
        let parsed = parseMigrationDirectoryName(directoryName);
        idLength ??= parsed.id.length;
        if (parsed.id.length !== idLength) {
            throw new Error('Migration directory "' +
                directoryName +
                '" has a ' +
                parsed.id.length +
                '-digit prefix; expected ' +
                idLength +
                ' digits. All migration prefixes must have the same number of digits.');
        }
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
/**
 * Loads a SQL seed file on Node.js.
 *
 * The file may contain multiple SQL statements. Seeds that must be safe to
 * run against an already-seeded database should use idempotent statements
 * (for example, `insert or ignore` on SQLite).
 *
 * @param filename Absolute or relative path to a SQL seed file.
 * @returns A seed function that executes the file's SQL script.
 * @example
 * ```ts
 * import { loadSeed } from 'remix/data-table/migrations/node'
 *
 * let seed = await loadSeed('./app/data/seed.sql')
 * await db.reset({ migrations, seed })
 * ```
 */
export async function loadSeed(filename) {
    let sql = await fs.readFile(filename, 'utf8');
    return (db) => db.executeScript(sql);
}
function isNodeFileNotFoundError(error) {
    return (typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT');
}

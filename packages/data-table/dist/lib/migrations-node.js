var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseMigrationFilename } from "./migrations/filename.js";
/**
 * Loads migration modules from a directory on Node.js.
 *
 * Filenames are used to infer migration `id` and `name`.
 * Each file must default-export `createMigration(...)`.
 * @param directory Absolute or relative directory containing migration files.
 * @returns A sorted list of loaded migration descriptors.
 * @example
 * ```ts
 * import { loadMigrations } from 'remix/data-table/migrations/node'
 *
 * let migrations = await loadMigrations('./app/db/migrations')
 * ```
 */
export async function loadMigrations(directory) {
    let allFiles = (await fs.readdir(directory, { withFileTypes: true }))
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .sort((left, right) => left.localeCompare(right));
    let files = [];
    for (let file of allFiles) {
        if (!/\.(?:m?ts|m?js|cts|cjs)$/.test(file)) {
            continue;
        }
        let parsed = parseMigrationFilename(file);
        files.push({ file, id: parsed.id, name: parsed.name });
    }
    let migrations = [];
    let seenIds = new Set();
    for (let entry of files) {
        if (seenIds.has(entry.id)) {
            throw new Error('Duplicate migration id "' + entry.id + '" inferred from filename "' + entry.file + '"');
        }
        seenIds.add(entry.id);
        let fullPath = path.join(directory, entry.file);
        let source = await fs.readFile(fullPath, 'utf8');
        let checksum = createHash('sha256').update(source).digest('hex');
        let module = (await import(__rewriteRelativeImportExtension(pathToFileURL(fullPath).href)));
        let migration = module.default;
        if (!migration || typeof migration.up !== 'function' || typeof migration.down !== 'function') {
            throw new Error('Migration file "' + entry.file + '" must default-export createMigration(...)');
        }
        migrations.push({
            id: entry.id,
            name: entry.name,
            path: fullPath,
            checksum,
            migration,
        });
    }
    return migrations;
}

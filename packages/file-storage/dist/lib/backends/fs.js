import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { openLazyFile } from '@remix-run/fs';
/**
 * Creates a {@link FileStorage} that is backed by a filesystem directory using `node:fs`.
 *
 * Important: No attempt is made to avoid overwriting existing files, so the directory used should
 * be a new directory solely dedicated to this storage object.
 *
 * Failed writes preserve the previous file. Callers must coordinate overlapping reads, writes,
 * removals, and listings across all instances and processes sharing the directory. This includes
 * consuming files returned by `get()` or `put()` before allowing replacement or removal.
 *
 * Note: Keys have no correlation to file names on disk, so they may be any string including
 * characters that are not valid in file names. Additionally, individual `File` names have no
 * correlation to names of files on disk, so multiple files with the same name may be stored in the
 * same storage object.
 *
 * @param directory The directory where files are stored
 * @returns A new {@link FileStorage} backed by a filesystem directory
 */
export function createFsFileStorage(directory) {
    let rootDir = path.resolve(directory);
    try {
        let stats = fs.statSync(rootDir);
        if (!stats.isDirectory()) {
            throw new Error(`Path "${rootDir}" is not a directory`);
        }
    }
    catch (error) {
        if (!isNoEntityError(error)) {
            throw error;
        }
        fs.mkdirSync(rootDir, { recursive: true });
    }
    async function getPaths(key) {
        let hash = await computeHash(key);
        let directory = path.join(rootDir, hash.slice(0, 2));
        return {
            directory,
            filePath: path.join(directory, `${hash}.dat`),
            metaPath: path.join(directory, `${hash}.meta.json`),
        };
    }
    async function putFile(key, file, prepareResult) {
        let { directory, filePath, metaPath } = await getPaths(key);
        let previous = await readMetadata(metaPath);
        let version = crypto.randomUUID();
        let dataPath = filePath.replace(/\.dat$/, `.${version}.dat`);
        let tempMetaPath = `${metaPath}.${version}.tmp`;
        await fsp.mkdir(directory, { recursive: true });
        let handle = await fsp.open(dataPath, 'wx');
        let tempMetadataCreated = false;
        let published = false;
        try {
            let metadata;
            try {
                for await (let chunk of file.stream()) {
                    await handle.writeFile(chunk);
                }
                // FileUpload metadata can change while its stream is consumed.
                metadata = {
                    key,
                    lastModified: file.lastModified,
                    name: file.name,
                    size: (await handle.stat()).size,
                    type: file.type,
                    dataFile: path.basename(dataPath),
                };
            }
            finally {
                await handle.close();
            }
            // Prepare the return value before publication so preparation errors preserve the old entry.
            let result = prepareResult(dataPath, metadata);
            let metaHandle = await fsp.open(tempMetaPath, 'wx');
            tempMetadataCreated = true;
            try {
                await metaHandle.writeFile(JSON.stringify(metadata));
            }
            finally {
                await metaHandle.close();
            }
            // Only the metadata rename publishes the replacement. Until then the old entry is intact.
            await fsp.rename(tempMetaPath, metaPath);
            published = true;
            // Cleanup must not turn a committed replacement into a reported failure.
            if (previous !== null) {
                await fsp.rm(getDataPath(metaPath, previous.dataFile), { force: true }).catch(() => { });
            }
            return result;
        }
        finally {
            if (!published) {
                await fsp.rm(dataPath, { force: true }).catch(() => { });
                if (tempMetadataCreated) {
                    await fsp.rm(tempMetaPath, { force: true }).catch(() => { });
                }
            }
        }
    }
    return {
        async get(key) {
            let { metaPath } = await getPaths(key);
            try {
                let meta = await readMetadata(metaPath);
                return meta === null ? null : openLazyFile(getDataPath(metaPath, meta.dataFile), meta);
            }
            catch (error) {
                if (!isNoEntityError(error)) {
                    throw error;
                }
                return null;
            }
        },
        async has(key) {
            let { metaPath } = await getPaths(key);
            try {
                await fsp.access(metaPath);
                return true;
            }
            catch {
                return false;
            }
        },
        async list(options) {
            let { cursor, includeMetadata = false, limit = 32, prefix } = options ?? {};
            let files = [];
            let foundCursor = cursor === undefined;
            let nextCursor;
            let lastHash;
            outerLoop: for await (let subdir of await fsp.opendir(rootDir)) {
                if (!subdir.isDirectory())
                    continue;
                for await (let file of await fsp.opendir(path.join(rootDir, subdir.name))) {
                    if (!file.isFile() || !file.name.endsWith('.meta.json'))
                        continue;
                    let hash = file.name.slice(0, -10); // Remove ".meta.json"
                    if (foundCursor) {
                        let metaPath = path.join(rootDir, subdir.name, file.name);
                        let record = await readMetadata(metaPath);
                        if (record === null)
                            continue;
                        let { dataFile, ...meta } = record;
                        if (prefix != null && !meta.key.startsWith(prefix)) {
                            continue;
                        }
                        if (files.length >= limit) {
                            nextCursor = lastHash;
                            break outerLoop;
                        }
                        // Older entries did not store their size in metadata.
                        files.push({
                            ...meta,
                            size: meta.size ?? (await fsp.stat(getDataPath(metaPath, dataFile))).size,
                        });
                    }
                    else if (hash === cursor) {
                        foundCursor = true;
                    }
                    lastHash = hash;
                }
            }
            return {
                cursor: nextCursor,
                files: (includeMetadata
                    ? files
                    : files.map(({ key }) => ({ key }))),
            };
        },
        put(key, file) {
            return putFile(key, file, openLazyFile);
        },
        async remove(key) {
            let { directory, filePath, metaPath } = await getPaths(key);
            let dataPaths;
            try {
                let metadata = await readMetadata(metaPath);
                if (metadata === null)
                    return;
                dataPaths = [getDataPath(metaPath, metadata.dataFile)];
            }
            catch (error) {
                if (!(error instanceof SyntaxError))
                    throw error;
                // Corrupt metadata cannot identify the current version. Callers serialize removal, so
                // all content versions belonging to this key can be removed without following its pointer.
                let hash = path.basename(filePath, '.dat');
                dataPaths = (await fsp.readdir(directory))
                    .filter((name) => name === `${hash}.dat` || isVersionedDataFile(name, hash))
                    .map((name) => path.join(directory, name));
            }
            await fsp.rm(metaPath, { force: true });
            for (let dataPath of dataPaths) {
                await fsp.rm(dataPath, { force: true });
            }
            try {
                await fsp.rmdir(directory);
            }
            catch (error) {
                if (!isNoEntityError(error) &&
                    !hasErrorCode(error, 'ENOTEMPTY') &&
                    !hasErrorCode(error, 'EEXIST')) {
                    throw error;
                }
            }
        },
        async set(key, file) {
            await putFile(key, file, () => { });
        },
    };
}
function getDataPath(metaPath, dataFile) {
    return dataFile === undefined
        ? metaPath.replace(/\.meta\.json$/, '.dat')
        : path.join(path.dirname(metaPath), dataFile);
}
function isVersionedDataFile(name, hash) {
    return /^[a-f0-9]{64}\.[a-f0-9-]{36}\.dat$/.test(name) && name.startsWith(`${hash}.`);
}
async function readMetadata(metaPath) {
    let json;
    try {
        json = await fsp.readFile(metaPath, 'utf-8');
    }
    catch (error) {
        if (isNoEntityError(error))
            return null;
        throw error;
    }
    let value = JSON.parse(json);
    if (value === null ||
        typeof value !== 'object' ||
        !('key' in value) ||
        typeof value.key !== 'string' ||
        !('name' in value) ||
        typeof value.name !== 'string' ||
        !('type' in value) ||
        typeof value.type !== 'string' ||
        !('lastModified' in value) ||
        typeof value.lastModified !== 'number') {
        throw new SyntaxError('Invalid stored file metadata');
    }
    let dataFile = 'dataFile' in value ? value.dataFile : undefined;
    if (dataFile !== undefined &&
        (typeof dataFile !== 'string' ||
            !isVersionedDataFile(dataFile, path.basename(metaPath, '.meta.json')))) {
        throw new SyntaxError('Invalid stored file content path');
    }
    let size = 'size' in value ? value.size : undefined;
    if (size !== undefined && typeof size !== 'number') {
        throw new SyntaxError('Invalid stored file metadata');
    }
    return {
        key: value.key,
        name: value.name,
        type: value.type,
        size,
        lastModified: value.lastModified,
        dataFile,
    };
}
async function computeHash(key, algorithm = 'SHA-256') {
    let digest = await crypto.subtle.digest(algorithm, new TextEncoder().encode(key));
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}
function hasErrorCode(error, code) {
    return error instanceof Error && 'code' in error && error.code === code;
}
function isNoEntityError(error) {
    return hasErrorCode(error, 'ENOENT');
}

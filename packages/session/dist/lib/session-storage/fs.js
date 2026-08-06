import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { createSession } from "../session.js";
/**
 * Creates a session storage that stores all session data in a filesystem directory using
 * Node's fs module.
 *
 * Note: No attempt is made to avoid overwriting existing files, so the directory used should
 * be a new directory solely dedicated to this storage object.
 *
 * @param directory The directory to store the session files in
 * @param options (optional) The options for the session storage
 * @returns The session storage
 */
export function createFsSessionStorage(directory, options) {
    let root = path.resolve(directory);
    let useUnknownIds = options?.useUnknownIds ?? false;
    try {
        let stats = fs.statSync(root);
        if (!stats.isDirectory()) {
            throw new Error(`Path "${root}" is not a directory`);
        }
    }
    catch (error) {
        if (!isNoEntityError(error)) {
            throw error;
        }
        fs.mkdirSync(root, { recursive: true });
    }
    async function getFilePath(id) {
        let hash = await computeHash(id);
        let subdir = hash.slice(0, 2);
        let filename = hash.slice(2);
        return path.join(root, subdir, filename);
    }
    async function deleteFile(id) {
        try {
            await fsp.unlink(await getFilePath(id));
        }
        catch (error) {
            if (!isNoEntityError(error)) {
                throw error;
            }
        }
    }
    return {
        async read(cookie) {
            let id = cookie;
            if (id) {
                try {
                    let file = await getFilePath(id);
                    let content = await fsp.readFile(file, 'utf-8');
                    let data = JSON.parse(content);
                    return createSession(id, data);
                }
                catch (error) {
                    if (!isNoEntityError(error)) {
                        throw error;
                    }
                    // File doesn't exist, fall through to create new session
                }
            }
            return createSession(useUnknownIds && id ? id : undefined);
        },
        async save(session) {
            if (session.deleteId) {
                await deleteFile(session.deleteId);
            }
            if (session.destroyed) {
                await deleteFile(session.id);
                return '';
            }
            if (session.dirty) {
                let file = await getFilePath(session.id);
                await fsp.mkdir(path.dirname(file), { recursive: true });
                await fsp.writeFile(file, JSON.stringify(session.data), 'utf-8');
                return session.id;
            }
            return null;
        },
    };
}
function isNoEntityError(error) {
    return (error instanceof Error && 'code' in error && error.code === 'ENOENT');
}
async function computeHash(id, algorithm = 'SHA-256') {
    let encoder = new TextEncoder();
    let data = encoder.encode(id);
    let hashBuffer = await crypto.subtle.digest(algorithm, data);
    let hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

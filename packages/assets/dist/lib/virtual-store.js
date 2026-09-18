import * as fs from 'node:fs';
import * as path from 'node:path';
import { getFilePathBaseName, getFilePathDirectory, normalizeFilePath, resolveFilePath, } from './paths.js';
import { resolveMountFileRoot } from './routes.js';
const modulesStateFileName = '.modules.yaml';
const virtualStoreBasePath = '/__@remix/virtual-store';
const virtualStoreDirLineRE = /^virtualStoreDir:[ \t]*(.+)$/m;
// pnpm's global virtual store links packages from a machine-wide directory, so package realpaths
// land outside `rootDir` and would otherwise have no public URL. The store location comes from
// `node_modules/.modules.yaml`, which pnpm rewrites on every install.
export function getVirtualStoreMountConfigs(options) {
    let virtualStoreDir = findVirtualStoreDir(options.rootDir);
    if (virtualStoreDir === null)
        return [];
    // A store inside a mount, such as pnpm's default `node_modules/.pnpm`, already has URLs.
    if (isWithinMounts(virtualStoreDir, options))
        return [];
    return [
        {
            mounts: {
                [virtualStoreBasePath]: getFilePathBaseName(virtualStoreDir),
            },
            rootDir: getFilePathDirectory(virtualStoreDir),
        },
    ];
}
function findVirtualStoreDir(rootDir) {
    let directory = normalizeFilePath(rootDir);
    // Workspace members share the workspace root's file, so walk up to the nearest one.
    while (true) {
        let modulesDir = `${directory}/node_modules`;
        let modulesState = readModulesState(`${modulesDir}/${modulesStateFileName}`);
        if (modulesState !== null) {
            let virtualStoreDir = readVirtualStoreDir(modulesState);
            if (virtualStoreDir === null)
                return null;
            return realpathDirectory(resolveFilePath(modulesDir, virtualStoreDir));
        }
        let parentDirectory = normalizeFilePath(path.dirname(directory));
        if (parentDirectory === directory)
            return null;
        directory = parentDirectory;
    }
}
function readVirtualStoreDir(modulesState) {
    // pnpm 10.34 and later write JSON, earlier versions write YAML, and package managers that
    // mirror the global virtual store write either one. Reading the one scalar this needs keeps
    // both formats working without a YAML parser.
    try {
        let parsedState = JSON.parse(modulesState);
        if (parsedState === null || typeof parsedState !== 'object')
            return null;
        let virtualStoreDir = parsedState.virtualStoreDir;
        return typeof virtualStoreDir === 'string' ? virtualStoreDir : null;
    }
    catch {
        let match = virtualStoreDirLineRE.exec(modulesState);
        return match === null ? null : unquoteScalar(match[1].trim());
    }
}
function unquoteScalar(value) {
    let quote = value[0];
    if (value.length > 1 && (quote === "'" || quote === '"') && value.endsWith(quote)) {
        return value.slice(1, -1);
    }
    return value;
}
function isWithinMounts(directory, options) {
    return Object.values(options.mounts).some((fileRoot) => {
        let mountRoot = resolveMountFileRoot(options.rootDir, fileRoot);
        return directory === mountRoot || directory.startsWith(`${mountRoot}/`);
    });
}
function readModulesState(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf-8');
    }
    catch (error) {
        if (isPathNotFoundError(error))
            return null;
        throw error;
    }
}
function realpathDirectory(filePath) {
    try {
        let realPath = fs.realpathSync(filePath);
        return fs.statSync(realPath).isDirectory() ? normalizeFilePath(realPath) : null;
    }
    catch (error) {
        if (isPathNotFoundError(error))
            return null;
        throw error;
    }
}
function isPathNotFoundError(error) {
    return (error instanceof Error &&
        'code' in error &&
        (error.code === 'ENOENT' ||
            error.code === 'ENOTDIR'));
}

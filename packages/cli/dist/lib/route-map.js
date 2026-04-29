import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inspectControllerOwnership } from "./controller-ownership.js";
import { routeMapLoaderFailed, routeMapLoaderInvalidJson, routeMapLoaderSignal, routeOwnerPlanUnresolved, routesFileNotFound, } from "./errors.js";
export async function loadRouteMap(cwd = process.cwd()) {
    let manifest = await loadRouteManifest(cwd);
    let ownership = await inspectControllerOwnership(manifest.appRoot, manifest.tree);
    let tree = decorateRouteTree(manifest.tree, ownership.subtrees);
    return {
        appRoot: manifest.appRoot,
        routesFile: manifest.routesFile,
        tree,
    };
}
export async function loadRouteManifest(cwd = process.cwd()) {
    let appRoot = await findRemixAppRoot(cwd);
    return loadRouteManifestFromAppRoot(appRoot);
}
export async function loadRouteManifestFromAppRoot(appRoot) {
    let routesFile = path.join(appRoot, 'app', 'routes.ts');
    let tree = await loadRawRouteMap(appRoot, routesFile);
    return {
        appRoot,
        routesFile,
        tree,
    };
}
async function loadRawRouteMap(appRoot, routesFile) {
    let workerPath = getRouteMapWorkerPath();
    let child = spawn(process.execPath, [workerPath, routesFile], {
        cwd: appRoot,
        env: createRouteMapWorkerEnv(),
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
        stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
        stderr += chunk;
    });
    let exitResult = await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('close', (code, signal) => {
            resolve({ code, signal });
        });
    });
    if (exitResult.signal != null) {
        throw routeMapLoaderSignal(exitResult.signal);
    }
    if (exitResult.code !== 0) {
        let message = stderr.trim();
        if (message.length === 0) {
            message = 'Route-map loader failed.';
        }
        throw routeMapLoaderFailed(message);
    }
    let parsed;
    try {
        parsed = JSON.parse(stdout);
    }
    catch {
        throw routeMapLoaderInvalidJson();
    }
    return assertRawRouteTree(parsed);
}
function decorateRouteTree(rawTree, subtrees, parentSegments = []) {
    let subtreesByRouteName = new Map(subtrees.map((subtree) => [subtree.routeName, subtree]));
    return decorateRouteTreeWithLookup(rawTree, subtreesByRouteName, parentSegments);
}
function decorateRouteTreeWithLookup(rawTree, subtreesByRouteName, parentSegments = []) {
    return rawTree.map((rawNode) => {
        let owner = getRouteOwner(rawNode, parentSegments, subtreesByRouteName);
        let nextParentSegments = rawNode.kind === 'group' ? [...parentSegments, rawNode.key] : parentSegments;
        return {
            children: rawNode.kind === 'group'
                ? decorateRouteTreeWithLookup(rawNode.children, subtreesByRouteName, nextParentSegments)
                : [],
            key: rawNode.key,
            kind: rawNode.kind,
            method: rawNode.method,
            name: rawNode.name,
            owner,
            pattern: rawNode.pattern,
        };
    });
}
function getRouteOwner(rawNode, parentSegments, subtreesByRouteName) {
    let ownerRouteName = rawNode.kind === 'group'
        ? rawNode.name
        : parentSegments.length === 0
            ? rawNode.name
            : parentSegments.join('.');
    let subtree = subtreesByRouteName.get(ownerRouteName);
    if (subtree == null) {
        throw routeOwnerPlanUnresolved(rawNode.name);
    }
    return {
        exists: subtree.actualEntryPath != null,
        kind: subtree.kind,
        path: subtree.actualEntryPath ?? subtree.entryDisplayPath,
    };
}
function assertRawRouteTree(value) {
    if (!Array.isArray(value)) {
        throw new Error('Route-map loader returned an invalid tree.');
    }
    return value.map((entry) => assertRawRouteTreeNode(entry));
}
function assertRawRouteTreeNode(value) {
    if (typeof value !== 'object' || value == null) {
        throw new Error('Route-map loader returned an invalid route node.');
    }
    let key = Reflect.get(value, 'key');
    let name = Reflect.get(value, 'name');
    let kind = Reflect.get(value, 'kind');
    let children = Reflect.get(value, 'children');
    if (typeof key !== 'string' || typeof name !== 'string') {
        throw new Error('Route-map loader returned a route node without a valid name.');
    }
    if (kind !== 'group' && kind !== 'route') {
        throw new Error(`Route-map loader returned an unknown node kind for "${name}".`);
    }
    if (!Array.isArray(children)) {
        throw new Error(`Route-map loader returned invalid children for "${name}".`);
    }
    if (kind === 'group') {
        return {
            children: children.map((child) => assertRawRouteTreeNode(child)),
            key,
            kind,
            name,
        };
    }
    let method = Reflect.get(value, 'method');
    let pattern = Reflect.get(value, 'pattern');
    if (typeof method !== 'string' || typeof pattern !== 'string') {
        throw new Error(`Route-map loader returned an invalid route leaf for "${name}".`);
    }
    return {
        children: [],
        key,
        kind,
        method,
        name,
        pattern,
    };
}
async function findRemixAppRoot(startDir) {
    let currentDir = path.resolve(startDir);
    while (true) {
        if (await pathExists(path.join(currentDir, 'app', 'routes.ts'))) {
            return currentDir;
        }
        let parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) {
            break;
        }
        currentDir = parentDir;
    }
    throw routesFileNotFound(startDir);
}
async function pathExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    }
    catch (error) {
        let nodeError = error;
        if (nodeError.code === 'ENOENT') {
            return false;
        }
        throw error;
    }
}
function getRouteMapWorkerPath() {
    let currentFilePath = fileURLToPath(import.meta.url);
    let extension = currentFilePath.endsWith('.ts') ? '.ts' : '.js';
    return fileURLToPath(new URL(`./load-route-map-worker${extension}`, import.meta.url));
}
function createRouteMapWorkerEnv() {
    let env = { ...process.env };
    for (let key of Object.keys(env)) {
        if (key.startsWith('NODE_TEST_')) {
            delete env[key];
        }
    }
    return env;
}

import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFingerprintSuffix } from './fingerprint.js';
import { getInjectedPackageRoots } from './injected-packages.js';
import { isAbsoluteFilePath, normalizeFilePath, resolveFilePath } from './paths.js';
import { supportedScriptExtensions } from './scripts/resolve.js';
import { isStyleFilePath } from './styles/compiler.js';
const scriptExtensions = new Set(supportedScriptExtensions);
const globSyntaxPattern = /[*?[\]{}()!+@]/;
export function createAssetInspector(options) {
    let fileExtensions = new Set(options.fileExtensions.map((extension) => extension.toLowerCase()));
    return {
        async getAssetDetails(input) {
            let routeMatch = await resolveInput(input, options);
            if (routeMatch === null)
                return { status: 'unmapped' };
            return inspectRouteMatch(routeMatch, options, fileExtensions);
        },
        async getAssets() {
            let filePaths = await discoverFilePaths(options);
            let assets = [];
            for (let filePath of filePaths) {
                let routeMatch = options.routes.matchFilePath(filePath);
                if (routeMatch === null)
                    continue;
                let details = await inspectRouteMatch(routeMatch, options, fileExtensions);
                if (details.status === 'reachable')
                    assets.push(details);
            }
            assets.sort((left, right) => {
                let urlOrder = (left.url ?? '').localeCompare(right.url ?? '');
                return urlOrder === 0 ? (left.filePath ?? '').localeCompare(right.filePath ?? '') : urlOrder;
            });
            return assets;
        },
    };
}
async function resolveInput(input, options) {
    if (input.startsWith('file://')) {
        return options.routes.matchFilePath(fileURLToPath(input));
    }
    if (/^[A-Za-z][A-Za-z\d+.-]*:\/\//.test(input)) {
        let pathname = parseFingerprintSuffix(new URL(input).pathname).pathname;
        return options.routes.matchUrlPathname(pathname);
    }
    let filePath = resolveFilePath(options.rootDir, input);
    if (!input.startsWith('/') || isAbsoluteFilePath(input)) {
        if (await pathExists(filePath))
            return options.routes.matchFilePath(filePath);
        if (!input.startsWith('/'))
            return options.routes.matchFilePath(filePath);
    }
    let pathname = parseFingerprintSuffix(new URL(input, 'http://remix.run').pathname).pathname;
    return options.routes.matchUrlPathname(pathname);
}
async function inspectRouteMatch(routeMatch, options, fileExtensions) {
    let exists = await pathExists(routeMatch.filePath);
    let identityPath = exists ? fs.realpathSync(routeMatch.filePath) : routeMatch.filePath;
    let normalizedIdentityPath = normalizeFilePath(identityPath);
    let access = options.accessPolicy.inspect(normalizedIdentityPath);
    let type = getAssetKind(routeMatch.filePath, fileExtensions);
    let details = {
        access,
        filePath: routeMatch.filePath,
        fileRoot: routeMatch.fileRoot,
        type,
        url: routeMatch.urlPathname,
        urlRoot: routeMatch.urlRoot,
    };
    if (!exists)
        return { ...details, status: 'missing' };
    if (!access.allowed) {
        return { ...details, status: access.deniedBy === undefined ? 'not-allowed' : 'denied' };
    }
    if (type === 'unsupported')
        return { ...details, status: 'unsupported' };
    return { ...details, status: 'reachable' };
}
function getAssetKind(filePath, fileExtensions) {
    let extension = path.extname(filePath).toLowerCase();
    if (scriptExtensions.has(extension))
        return 'script';
    if (isStyleFilePath(filePath))
        return 'style';
    if (fileExtensions.has(extension))
        return 'file';
    return 'unsupported';
}
async function discoverFilePaths(options) {
    let roots = new Set();
    for (let pattern of options.allowFiles) {
        roots.add(resolveDiscoveryRoot(options.rootDir, pattern));
    }
    for (let packageRoot of options.accessPolicy.getAllowedPackageRoots()) {
        roots.add(packageRoot);
    }
    for (let packageRoot of getInjectedPackageRoots()) {
        roots.add(packageRoot);
    }
    let filePaths = new Set();
    for (let root of roots) {
        await collectFiles(root, filePaths);
    }
    return [...filePaths];
}
function resolveDiscoveryRoot(rootDir, pattern) {
    let dynamicIndex = pattern.search(globSyntaxPattern);
    if (dynamicIndex === -1)
        return resolveFilePath(rootDir, pattern);
    let rawStaticPrefix = pattern.slice(0, dynamicIndex);
    let staticPrefix = rawStaticPrefix.replace(/[/\\]+$/, '');
    if (staticPrefix.length === 0)
        return rootDir;
    return resolveFilePath(rootDir, /[/\\]$/.test(rawStaticPrefix) ? staticPrefix : path.dirname(staticPrefix));
}
async function collectFiles(root, filePaths) {
    let stat;
    try {
        stat = await fsPromises.stat(root);
    }
    catch (error) {
        if (isPathNotFoundError(error))
            return;
        throw error;
    }
    if (stat.isFile()) {
        filePaths.add(normalizeFilePath(root));
        return;
    }
    if (!stat.isDirectory())
        return;
    let entries = await fsPromises.readdir(root, { withFileTypes: true });
    for (let entry of entries) {
        let entryPath = path.join(root, entry.name);
        if (entry.isDirectory()) {
            await collectFiles(entryPath, filePaths);
        }
        else if (entry.isFile()) {
            filePaths.add(normalizeFilePath(entryPath));
        }
    }
}
async function pathExists(filePath) {
    try {
        await fsPromises.access(filePath);
        return true;
    }
    catch (error) {
        if (isPathNotFoundError(error))
            return false;
        throw error;
    }
}
function isPathNotFoundError(error) {
    return (error instanceof Error &&
        'code' in error &&
        (error.code === 'ENOENT' || error.code === 'ENOTDIR'));
}

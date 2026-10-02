import * as fs from 'node:fs';
import * as path from 'node:path';
import { createFileMatcher } from './file-matcher.js';
import { isInjectedPackageFilePath } from './injected-packages.js';
import { normalizeFilePath } from './paths.js';
const packageStateFileNames = new Set([
    'bun.lock',
    'bun.lockb',
    'npm-shrinkwrap.json',
    'package-lock.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'yarn.lock',
]);
const packageManagerRootFileNames = packageStateFileNames;
const packageNamePartPattern = /^[A-Za-z0-9._~-]+$/;
export function createAccessPolicy(options) {
    let allowMatchers = options.allowFiles.map((pattern) => ({
        matcher: createFileMatcher(pattern, options.rootDir),
        pattern,
    }));
    let allowPackageNames = normalizePackageNames(options.allowPackages, 'allowPackages');
    let denyMatchers = (options.denyFiles ?? []).map((pattern) => ({
        matcher: createFileMatcher(pattern, options.rootDir),
        pattern,
    }));
    let packageSearchRoots = [options.rootDir, ...(options.packageSearchRoots ?? [])];
    let packageRootPaths = createPackageRootPaths({
        allowPackageNames,
        searchRoots: packageSearchRoots,
    });
    let allowPackageRootPathTrie = createPackageRootPathTrie(packageRootPaths);
    let packageStateDirectories = allowPackageNames.size === 0 ? [] : getPackageStateDirectories(packageSearchRoots);
    let packageRootsDirty = false;
    function refreshPackageRootPathTries() {
        if (!packageRootsDirty)
            return;
        packageRootPaths = createPackageRootPaths({
            allowPackageNames,
            searchRoots: packageSearchRoots,
        });
        allowPackageRootPathTrie = createPackageRootPathTrie(packageRootPaths);
        packageRootsDirty = false;
    }
    function getAllowedPackageName(filePath) {
        if (allowPackageNames.size === 0)
            return undefined;
        refreshPackageRootPathTries();
        return getPackageNameFromRootPathTrie(filePath, allowPackageRootPathTrie);
    }
    function inspect(filePath) {
        if (isInjectedPackageFilePath(filePath)) {
            return { allowed: true, allowedBy: { kind: 'injected', value: '@remix-run/assets' } };
        }
        let allowedBy;
        let allowMatch = allowMatchers.find(({ matcher }) => matcher(filePath));
        if (allowMatch) {
            allowedBy = { kind: 'file', value: allowMatch.pattern };
        }
        else {
            let packageName = getAllowedPackageName(filePath);
            if (packageName !== undefined) {
                allowedBy = { kind: 'package', value: packageName };
            }
        }
        if (!allowedBy)
            return { allowed: false };
        let denyMatch = denyMatchers.find(({ matcher }) => matcher(filePath));
        if (denyMatch) {
            return { allowed: false, allowedBy, deniedBy: denyMatch.pattern };
        }
        return { allowed: true, allowedBy };
    }
    return {
        getAllowedPackageRoots() {
            refreshPackageRootPathTries();
            return [...packageRootPaths.keys()];
        },
        getPackageWatchDirectories() {
            if (allowPackageNames.size === 0)
                return [];
            return packageStateDirectories;
        },
        handleFileEvent(filePath) {
            if (allowPackageNames.size === 0)
                return;
            if (!isPackageStateFileEvent(filePath, packageStateDirectories))
                return;
            packageRootsDirty = true;
        },
        inspect,
        isAllowed(filePath) {
            return inspect(filePath).allowed;
        },
    };
}
function normalizePackageNames(packageOption, optionName) {
    let packageNames = new Set();
    for (let packageName of packageOption ?? []) {
        if (typeof packageName !== 'string') {
            throw new TypeError(`${optionName} values must be strings`);
        }
        let normalizedPackageName = packageName.trim();
        if (!isValidPackageName(normalizedPackageName)) {
            throw new TypeError(`${optionName} values must be package names. Received "${packageName}".`);
        }
        packageNames.add(normalizedPackageName);
    }
    return packageNames;
}
function validatePackageName(packageName, message) {
    if (!isValidPackageName(packageName)) {
        throw new TypeError(message);
    }
}
function createPackageRootPaths(options) {
    let allowPackageRootPaths = new Map();
    let allowQueue = [];
    let seenAllowedPackageRoots = new Set();
    let searchRoots = normalizePackageSearchRoots(options.searchRoots);
    for (let packageName of options.allowPackageNames) {
        let foundPackage = false;
        for (let searchRoot of searchRoots) {
            let packageJsonPath = findPackageJsonPath(packageName, searchRoot);
            if (packageJsonPath === null)
                continue;
            foundPackage = true;
            allowQueue.push({ packageJsonPath, packageName });
        }
        if (!foundPackage) {
            throw new TypeError(`Could not resolve allowed package "${packageName}".`);
        }
    }
    while (allowQueue.length > 0) {
        let { packageJsonPath, packageName } = allowQueue.shift();
        let packageRootPath = normalizeFilePath(path.dirname(packageJsonPath));
        if (seenAllowedPackageRoots.has(packageRootPath))
            continue;
        seenAllowedPackageRoots.add(packageRootPath);
        let packageJson = readPackageJson(packageJsonPath);
        allowPackageRootPaths.set(packageRootPath, packageName);
        for (let dependencyName of Object.keys(packageJson.dependencies ?? {})) {
            validatePackageName(dependencyName, `Dependency "${dependencyName}" from ${packageJsonPath} must be a package name.`);
            let dependencyPackageJsonPath = findPackageJsonPath(dependencyName, packageRootPath);
            if (dependencyPackageJsonPath === null) {
                throw new TypeError(`Could not resolve dependency "${dependencyName}" from ${packageJsonPath}.`);
            }
            allowQueue.push({
                packageJsonPath: dependencyPackageJsonPath,
                packageName: dependencyName,
            });
        }
        for (let dependencyName of Object.keys(packageJson.optionalDependencies ?? {})) {
            validatePackageName(dependencyName, `Optional dependency "${dependencyName}" from ${packageJsonPath} must be a package name.`);
            let dependencyPackageJsonPath = findPackageJsonPath(dependencyName, packageRootPath);
            if (dependencyPackageJsonPath !== null) {
                allowQueue.push({
                    packageJsonPath: dependencyPackageJsonPath,
                    packageName: dependencyName,
                });
            }
        }
    }
    return allowPackageRootPaths;
}
function createPackageRootPathTrie(packageRootPaths) {
    let rootNode = createPackageRootPathTrieNode();
    for (let [packageRootPath, packageName] of packageRootPaths) {
        let node = rootNode;
        for (let segment of getFilePathSegments(packageRootPath)) {
            let childNode = node.children.get(segment);
            if (!childNode) {
                childNode = createPackageRootPathTrieNode();
                node.children.set(segment, childNode);
            }
            node = childNode;
        }
        node.packageName = packageName;
    }
    return rootNode;
}
function createPackageRootPathTrieNode() {
    return {
        children: new Map(),
    };
}
function getPackageNameFromRootPathTrie(filePath, trie) {
    let node = trie;
    if (node.packageName !== undefined)
        return node.packageName;
    for (let segment of getFilePathSegments(filePath)) {
        let childNode = node.children.get(segment);
        if (!childNode)
            return undefined;
        if (childNode.packageName !== undefined)
            return childNode.packageName;
        node = childNode;
    }
    return undefined;
}
function getFilePathSegments(filePath) {
    return normalizeFilePath(filePath).split('/');
}
function normalizePackageSearchRoots(searchRoots) {
    let normalizedSearchRoots = new Set();
    for (let searchRoot of searchRoots) {
        let normalizedSearchRoot = normalizeFilePath(searchRoot);
        normalizedSearchRoots.add(normalizedSearchRoot);
        if (path.basename(normalizedSearchRoot) === 'node_modules') {
            normalizedSearchRoots.add(path.dirname(normalizedSearchRoot));
        }
    }
    return [...normalizedSearchRoots];
}
function getPackageStateDirectories(searchRoots) {
    let packageStateDirectories = new Set();
    for (let searchRoot of searchRoots) {
        let packageManagerRoot = findPackageManagerRoot(searchRoot);
        if (packageManagerRoot !== null) {
            packageStateDirectories.add(packageManagerRoot);
        }
    }
    return [...packageStateDirectories];
}
function isPackageStateFileEvent(filePath, packageStateDirectories) {
    let normalizedFilePath = normalizeFilePath(filePath);
    let fileName = path.basename(normalizedFilePath);
    if (!packageStateFileNames.has(fileName))
        return false;
    let directory = path.dirname(normalizedFilePath);
    return packageStateDirectories.some((packageStateDirectory) => directory === packageStateDirectory);
}
function findPackageManagerRoot(startDirectory) {
    let directory = normalizePackageStateSearchRoot(startDirectory);
    while (true) {
        if (hasPackageManagerRootFile(directory))
            return directory;
        let parentDirectory = path.dirname(directory);
        if (parentDirectory === directory)
            return null;
        directory = parentDirectory;
    }
}
function normalizePackageStateSearchRoot(searchRoot) {
    let normalizedSearchRoot = normalizeFilePath(searchRoot);
    return path.basename(normalizedSearchRoot) === 'node_modules'
        ? path.dirname(normalizedSearchRoot)
        : normalizedSearchRoot;
}
function hasPackageManagerRootFile(directory) {
    for (let fileName of packageManagerRootFileNames) {
        try {
            let stat = fs.statSync(path.join(directory, fileName));
            if (stat.isFile())
                return true;
        }
        catch (error) {
            if (isPathNotFoundError(error))
                continue;
            throw error;
        }
    }
    return false;
}
function findPackageJsonPath(packageName, startDirectory) {
    let directory = normalizeFilePath(startDirectory);
    while (true) {
        let packageJsonPath = resolvePackageJsonPath(directory, packageName);
        if (packageJsonPath !== null)
            return packageJsonPath;
        let parentDirectory = path.dirname(directory);
        if (parentDirectory === directory)
            return null;
        directory = parentDirectory;
    }
}
function resolvePackageJsonPath(directory, packageName) {
    let packagePath = path.basename(directory) === 'node_modules'
        ? path.join(directory, packageName, 'package.json')
        : path.join(directory, 'node_modules', packageName, 'package.json');
    try {
        return normalizeFilePath(fs.realpathSync(packagePath));
    }
    catch (error) {
        if (isPathNotFoundError(error))
            return null;
        throw error;
    }
}
function readPackageJson(packageJsonPath) {
    let packageJson;
    try {
        packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    }
    catch (error) {
        if (isPathNotFoundError(error))
            return {};
        throw error;
    }
    if (packageJson === null || typeof packageJson !== 'object') {
        return {};
    }
    return {
        dependencies: readDependencyMap(packageJson, 'dependencies'),
        optionalDependencies: readDependencyMap(packageJson, 'optionalDependencies'),
    };
}
function readDependencyMap(packageJson, key) {
    if (!(key in packageJson))
        return undefined;
    let value = packageJson[key];
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }
    let dependencies = {};
    for (let [dependencyName, dependencyVersion] of Object.entries(value)) {
        if (typeof dependencyVersion === 'string') {
            dependencies[dependencyName] = dependencyVersion;
        }
    }
    return dependencies;
}
function isValidPackageName(packageName) {
    if (packageName.length === 0)
        return false;
    let packageNameParts = packageName.startsWith('@')
        ? packageName.slice(1).split('/')
        : packageName.split('/');
    if (packageNameParts.length !== (packageName.startsWith('@') ? 2 : 1))
        return false;
    return packageNameParts.every((part) => part.length > 0 && part !== '.' && part !== '..' && packageNamePartPattern.test(part));
}
function isPathNotFoundError(error) {
    return (error instanceof Error &&
        'code' in error &&
        (error.code === 'ENOENT' ||
            error.code === 'ENOTDIR'));
}

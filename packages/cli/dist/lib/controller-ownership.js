import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { getControllerOwnerCandidates, getOwnerModuleBaseName, getPreferredOwnerDisplayPath, getRouteSubtreePath, isControllerEntryFileName, toDiskSegment, } from "./controller-files.js";
const ACTIONS_PATH_PREFIX = 'app/actions/';
export const ROOT_ROUTE_NAME = '<root>';
export async function inspectControllerOwnership(appRoot, tree) {
    let subtreePlans = buildOwnedSubtrees(tree);
    let routeDirectories = buildRouteDirectories(tree);
    let scan = await scanControllersDirectory(appRoot);
    let subtrees = applyScanToSubtrees(subtreePlans, scan);
    return {
        orphanControllerPaths: getOrphanControllerPaths(subtreePlans, scan),
        orphanRouteDirectoryPaths: getOrphanRouteDirectoryPaths(routeDirectories, scan),
        routeDirectories,
        scan,
        subtrees,
    };
}
export function buildOwnedSubtrees(tree, parentSegments = [], subtrees = []) {
    if (parentSegments.length === 0 &&
        subtrees.length === 0 &&
        tree.some((node) => node.kind === 'route')) {
        addSubtreePlan(ROOT_ROUTE_NAME, [], subtrees);
    }
    for (let node of tree) {
        if (node.kind !== 'group') {
            continue;
        }
        let segments = [...parentSegments, toDiskSegment(node.key)];
        if (hasDirectRouteLeaf(node.children)) {
            addSubtreePlan(node.name, segments, subtrees);
        }
        buildOwnedSubtrees(node.children, segments, subtrees);
    }
    return subtrees;
}
export function buildRouteDirectories(tree, parentSegments = [], directories = []) {
    for (let node of tree) {
        if (node.kind !== 'group') {
            continue;
        }
        let segments = [...parentSegments, toDiskSegment(node.key)];
        directories.push({
            directoryPath: getRouteSubtreePath(segments),
            routeName: node.name,
        });
        buildRouteDirectories(node.children, segments, directories);
    }
    return directories;
}
function hasDirectRouteLeaf(tree) {
    return tree.some((node) => node.kind === 'route');
}
function addSubtreePlan(routeName, segments, subtrees) {
    let entryCandidates = getControllerOwnerCandidates(segments);
    subtrees.push({
        entryCandidates,
        entryDisplayPath: getPreferredOwnerDisplayPath(entryCandidates),
        routeName,
        subtreePath: getRouteSubtreePath(segments),
    });
}
async function scanControllersDirectory(appRoot) {
    let actionsDir = path.join(appRoot, 'app', 'actions');
    let controllerEntryPaths = new Set();
    let routeDirectoryPaths = new Set();
    let routeLocalFilePaths = new Set();
    async function walk(currentDir, isRoot) {
        let entries;
        try {
            entries = await fs.readdir(currentDir, { withFileTypes: true });
        }
        catch (error) {
            let nodeError = error;
            if (nodeError.code === 'ENOENT' && isRoot) {
                return;
            }
            throw error;
        }
        for (let entry of entries) {
            let entryPath = path.join(currentDir, entry.name);
            let relativePath = normalizeRelativePath(path.relative(appRoot, entryPath));
            if (entry.isDirectory()) {
                routeDirectoryPaths.add(relativePath);
                await walk(entryPath, false);
                continue;
            }
            if (!entry.isFile()) {
                continue;
            }
            if (isControllerEntryFileName(entry.name)) {
                controllerEntryPaths.add(relativePath);
                continue;
            }
            if (isRouteLocalFileName(entry.name)) {
                routeLocalFilePaths.add(relativePath);
            }
        }
    }
    await walk(actionsDir, true);
    return {
        controllerEntryPaths,
        routeDirectoryPaths,
        routeLocalFilePaths,
    };
}
function applyScanToSubtrees(subtreePlans, scan) {
    let claimedRouteLocalPaths = claimFilesToDeepestSubtree([...scan.routeLocalFilePaths], subtreePlans);
    let claimedContentPaths = claimFilesToDeepestSubtree(getNestedContentPaths(scan), subtreePlans);
    return subtreePlans.map((subtree) => {
        let actualEntryPaths = findOwnerPaths(scan, subtree.entryCandidates);
        return {
            ...subtree,
            actualEntryPath: actualEntryPaths[0] ?? null,
            actualEntryPaths,
            claimedFilePaths: claimedContentPaths.get(subtree.routeName) ?? [],
            claimedRouteLocalFilePaths: claimedRouteLocalPaths.get(subtree.routeName) ?? [],
        };
    });
}
function getNestedContentPaths(scan) {
    let nestedControllerPaths = [...scan.controllerEntryPaths].filter((filePath) => isNestedControllerPath(filePath));
    return [...new Set([...nestedControllerPaths, ...scan.routeLocalFilePaths])].sort();
}
function claimFilesToDeepestSubtree(filePaths, subtreePlans) {
    let subtreesByDepth = [...subtreePlans].sort((left, right) => {
        if (right.subtreePath.length !== left.subtreePath.length) {
            return right.subtreePath.length - left.subtreePath.length;
        }
        return left.routeName.localeCompare(right.routeName);
    });
    let claims = new Map();
    for (let filePath of filePaths.sort()) {
        let matchingSubtree = subtreesByDepth.find((subtree) => isWithinDirectory(filePath, subtree.subtreePath));
        if (matchingSubtree == null) {
            continue;
        }
        let claimedPaths = claims.get(matchingSubtree.routeName);
        if (claimedPaths == null) {
            claims.set(matchingSubtree.routeName, [filePath]);
            continue;
        }
        claimedPaths.push(filePath);
    }
    return claims;
}
function getOrphanControllerPaths(subtreePlans, scan) {
    let expectedControllerPaths = new Set(subtreePlans.flatMap((subtree) => subtree.entryCandidates));
    return [...scan.controllerEntryPaths]
        .filter((filePath) => !expectedControllerPaths.has(filePath))
        .sort();
}
function getOrphanRouteDirectoryPaths(routeDirectories, scan) {
    let expectedRouteDirectories = new Set(routeDirectories.map((routeDirectory) => routeDirectory.directoryPath));
    let actualControllerDirectories = [...scan.controllerEntryPaths].map((controllerPath) => normalizeRelativePath(path.dirname(controllerPath)));
    return [...scan.routeDirectoryPaths]
        .filter((directoryPath) => !expectedRouteDirectories.has(directoryPath))
        .filter((directoryPath) => !actualControllerDirectories.some((controllerPath) => isDirectoryWithinDirectory(controllerPath, directoryPath)))
        .sort();
}
function isRouteLocalFileName(fileName) {
    let baseName = getOwnerModuleBaseName(fileName);
    return (baseName != null &&
        baseName !== 'controller' &&
        !baseName.endsWith('.test') &&
        !baseName.endsWith('.spec'));
}
function findOwnerPaths(scan, candidatePaths) {
    let existingPaths = [];
    for (let candidatePath of candidatePaths) {
        if (scan.controllerEntryPaths.has(candidatePath)) {
            existingPaths.push(candidatePath);
        }
    }
    return existingPaths;
}
function isNestedControllerPath(filePath) {
    return (filePath.startsWith(ACTIONS_PATH_PREFIX) &&
        filePath.slice(ACTIONS_PATH_PREFIX.length).includes('/'));
}
function isWithinDirectory(filePath, directoryPath) {
    return filePath.startsWith(`${directoryPath}/`);
}
function isDirectoryWithinDirectory(directoryPath, parentDirectoryPath) {
    return (directoryPath === parentDirectoryPath || isWithinDirectory(directoryPath, parentDirectoryPath));
}
function normalizeRelativePath(filePath) {
    return filePath.split(path.sep).join('/');
}

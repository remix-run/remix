import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { getOwnerCandidateForExtension, getOwnerFileExtension, } from "../controller-files.js";
import { renderActionPlaceholder, renderControllerPlaceholder } from "./controller-placeholders.js";
const OWNER_EXTENSION_PRIORITY = ['.tsx', '.ts', '.jsx', '.js'];
export async function getControllerFixPlans(appRoot, tree, ownership) {
    let routeNodesByName = getRouteNodesByName(tree);
    let hasTsconfig = await pathExists(path.join(appRoot, 'tsconfig.json'));
    let resolvedEntryPathByRouteName = new Map();
    for (let subtree of ownership.subtrees) {
        if (subtree.actualEntryPath != null) {
            resolvedEntryPathByRouteName.set(subtree.routeName, subtree.actualEntryPath);
            continue;
        }
        let fixCode = getFixCodeForSubtree(subtree);
        if (fixCode == null) {
            continue;
        }
        let extension = inferOwnerExtension(subtree, ownership, hasTsconfig);
        let targetPath = getOwnerCandidateForExtension(subtree.entryCandidates, extension) ?? subtree.entryDisplayPath;
        resolvedEntryPathByRouteName.set(subtree.routeName, targetPath);
    }
    let fixPlans = [];
    for (let subtree of ownership.subtrees) {
        let code = getFixCodeForSubtree(subtree);
        if (code == null) {
            continue;
        }
        let routeNode = routeNodesByName.get(subtree.routeName);
        let entryPath = resolvedEntryPathByRouteName.get(subtree.routeName);
        if (routeNode == null || entryPath == null) {
            continue;
        }
        let contents = subtree.kind === 'action'
            ? renderActionPlaceholder(routeNode, entryPath)
            : renderControllerPlaceholder(routeNode, entryPath, resolvedEntryPathByRouteName);
        fixPlans.push({
            code,
            contents,
            kind: 'create-file',
            path: entryPath,
            routeName: subtree.routeName,
            suite: 'controllers',
        });
    }
    return fixPlans;
}
function getFixCodeForSubtree(subtree) {
    if (subtree.actualEntryPaths.length > 1 || subtree.actualAlternatePaths.length > 1) {
        return null;
    }
    if (subtree.actualEntryPath != null) {
        return null;
    }
    if (subtree.actualAlternatePath != null) {
        return 'wrong-owner-kind';
    }
    if (subtree.kind === 'controller') {
        return subtree.claimedFilePaths.length > 0 ? 'incomplete-controller' : 'missing-owner';
    }
    if (subtree.claimedFilePaths.length > 0) {
        return null;
    }
    return 'missing-owner';
}
function inferOwnerExtension(subtree, ownership, hasTsconfig) {
    let subtreeExtension = getMostCommonOwnerExtension(subtree.claimedRouteLocalFilePaths);
    if (subtreeExtension != null) {
        return subtreeExtension;
    }
    let alternateExtension = getMostCommonOwnerExtension(subtree.actualAlternatePaths);
    if (alternateExtension != null) {
        return alternateExtension;
    }
    let projectExtension = getMostCommonOwnerExtension([
        ...ownership.scan.actionEntryPaths,
        ...ownership.scan.controllerEntryPaths,
    ]);
    if (projectExtension != null) {
        return projectExtension;
    }
    return hasTsconfig ? '.tsx' : '.js';
}
function getMostCommonOwnerExtension(filePaths) {
    let counts = new Map();
    for (let filePath of filePaths) {
        let extension = getOwnerFileExtension(filePath);
        if (extension == null) {
            continue;
        }
        counts.set(extension, (counts.get(extension) ?? 0) + 1);
    }
    if (counts.size === 0) {
        return null;
    }
    let bestExtension = null;
    let bestCount = -1;
    for (let extension of OWNER_EXTENSION_PRIORITY) {
        let count = counts.get(extension) ?? 0;
        if (count > bestCount) {
            bestCount = count;
            bestExtension = extension;
        }
    }
    return bestExtension;
}
function getRouteNodesByName(tree) {
    let routeNodesByName = new Map();
    function visit(nodes) {
        for (let node of nodes) {
            routeNodesByName.set(node.name, node);
            visit(node.children);
        }
    }
    visit(tree);
    return routeNodesByName;
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

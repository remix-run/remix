import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { getControllerOwnerCandidates, getPreferredOwnerDisplayPath, getRouteSubtreePath, toDiskSegment, } from './controller-files.js';
export const ROOT_ROUTE_NAME = '<root>';
export async function inspectControllerOwnership(appRoot, tree) {
    let subtreePlans = buildOwnedSubtrees(tree);
    let routeDirectoryPlans = buildRouteDirectories(tree);
    let [routeDirectories, subtrees] = await Promise.all([
        inspectRouteDirectories(appRoot, routeDirectoryPlans),
        inspectOwnedSubtrees(appRoot, subtreePlans),
    ]);
    return {
        routeDirectories,
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
async function inspectRouteDirectories(appRoot, plans) {
    return Promise.all(plans.map(async (plan) => ({
        ...plan,
        exists: await pathHasType(appRoot, plan.directoryPath, 'directory'),
    })));
}
async function inspectOwnedSubtrees(appRoot, plans) {
    return Promise.all(plans.map(async (plan) => ({
        ...plan,
        actualEntryPath: await findControllerEntryPath(appRoot, plan.entryCandidates),
    })));
}
async function findControllerEntryPath(appRoot, candidatePaths) {
    for (let candidatePath of candidatePaths) {
        if (await pathHasType(appRoot, candidatePath, 'file')) {
            return candidatePath;
        }
    }
    return null;
}
async function pathHasType(appRoot, relativePath, type) {
    try {
        let stats = await fs.stat(path.join(appRoot, relativePath));
        return type === 'directory' ? stats.isDirectory() : stats.isFile();
    }
    catch (error) {
        let nodeError = error;
        if (nodeError.code === 'ENOENT' || nodeError.code === 'ENOTDIR') {
            return false;
        }
        throw error;
    }
}

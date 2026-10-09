import { ROOT_ROUTE_NAME, } from '../controller-ownership.js';
export function getControllerFindings(ownership) {
    let missingRouteNames = new Set(ownership.routeDirectories
        .filter((directory) => !directory.exists)
        .map((directory) => directory.routeName));
    return [
        ...getSubtreeFindings(ownership.subtrees, missingRouteNames),
        ...getRouteDirectoryFindings(ownership.routeDirectories),
    ];
}
function getRouteDirectoryFindings(directories) {
    return directories
        .filter((directory) => !directory.exists)
        .map((directory) => ({
        code: 'missing-route-directory',
        expectedPath: directory.directoryPath,
        message: `Route map "${directory.routeName}" is missing action directory ${directory.directoryPath}.`,
        routeName: directory.routeName,
        severity: 'warn',
        suite: 'actions',
    }));
}
function getSubtreeFindings(subtrees, missingRouteNames) {
    let findings = [];
    for (let subtree of subtrees) {
        if (missingRouteNames.has(subtree.routeName)) {
            continue;
        }
        if (subtree.actualEntryPath == null) {
            findings.push({
                code: 'missing-owner',
                expectedPath: subtree.entryDisplayPath,
                message: `${formatRouteMapName(subtree.routeName)} is missing action controller ${subtree.entryDisplayPath}.`,
                routeName: subtree.routeName,
                severity: 'warn',
                suite: 'actions',
            });
        }
    }
    return findings;
}
function formatRouteMapName(routeName) {
    return routeName === ROOT_ROUTE_NAME ? 'Root route map' : `Route map "${routeName}"`;
}

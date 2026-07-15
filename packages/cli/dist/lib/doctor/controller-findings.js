import { ROOT_ROUTE_NAME, } from "../controller-ownership.js";
export function getControllerFindings(ownership, fixPlans) {
    return [
        ...getSubtreeFindings(ownership.subtrees, fixPlans),
        ...ownership.orphanControllerPaths.map((actualPath) => ({
            actualPath,
            code: 'orphan-controller',
            message: `Action controller ${actualPath} does not match any route map.`,
            severity: 'warn',
            suite: 'actions',
        })),
        ...ownership.orphanRouteDirectoryPaths.map((actualPath) => ({
            actualPath,
            code: 'orphan-route-directory',
            message: `Directory ${actualPath} does not match any route-map key path.`,
            severity: 'warn',
            suite: 'actions',
        })),
    ];
}
function getSubtreeFindings(subtrees, fixPlans) {
    let findings = [];
    let fixableFindingKeys = new Set(fixPlans.map((fixPlan) => `${fixPlan.code}:${fixPlan.routeName ?? ''}`));
    for (let subtree of subtrees) {
        let routeMapName = formatRouteMapName(subtree.routeName);
        if (subtree.actualEntryPaths.length > 1) {
            findings.push({
                actualPath: subtree.actualEntryPaths[0],
                code: 'duplicate-owner-file',
                expectedPath: subtree.entryDisplayPath,
                message: `${routeMapName} has multiple action controller files: ${subtree.actualEntryPaths.join(', ')}. Keep only one controller owner file.`,
                routeName: subtree.routeName,
                severity: 'warn',
                suite: 'actions',
            });
            continue;
        }
        if (subtree.actualEntryPath == null) {
            let code = subtree.claimedFilePaths.length > 0
                ? 'incomplete-controller'
                : 'missing-owner';
            findings.push({
                actualPath: subtree.claimedFilePaths.length > 0 ? subtree.subtreePath : undefined,
                code,
                expectedPath: subtree.entryDisplayPath,
                fixable: fixableFindingKeys.has(`${code}:${subtree.routeName}`),
                message: subtree.claimedFilePaths.length > 0
                    ? `${routeMapName} has files under ${subtree.subtreePath}, but is missing action controller ${subtree.entryDisplayPath}.`
                    : `${routeMapName} is missing action controller ${subtree.entryDisplayPath}.`,
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

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { CliError } from '../errors.js';
import { loadRouteManifestFromAppRoot } from '../route-map.js';
import { createDoctorSuite, } from './types.js';
export async function checkProject(projectRoot) {
    let routesFile = path.join(projectRoot, 'app', 'routes.ts');
    if (!(await pathExists(routesFile))) {
        return {
            routesFile,
            suite: createDoctorSuite('project', [
                {
                    code: 'routes-file-missing',
                    expectedPath: 'app/routes.ts',
                    fixable: true,
                    message: 'Project is missing app/routes.ts.',
                    severity: 'warn',
                    suite: 'project',
                },
            ]),
        };
    }
    try {
        let routeManifest = await loadRouteManifestFromAppRoot(projectRoot);
        return {
            routeManifest,
            routesFile,
            suite: createDoctorSuite('project', []),
        };
    }
    catch (error) {
        let finding = toProjectFinding(error);
        return {
            routesFile,
            suite: createDoctorSuite('project', [finding]),
        };
    }
}
export async function getProjectFixPlans(projectRoot) {
    let routesFile = path.join(projectRoot, 'app', 'routes.ts');
    if (await pathExists(routesFile)) {
        let routesSource = await fs.readFile(routesFile, 'utf8');
        if (!hasOnlyWhitespaceAndComments(routesSource)) {
            return [];
        }
        return [
            {
                code: 'routes-export-missing',
                contents: renderDefaultRoutesFile(),
                kind: 'update-file',
                path: 'app/routes.ts',
                suite: 'project',
            },
        ];
    }
    return [
        {
            code: 'routes-file-missing',
            contents: renderDefaultRoutesFile(),
            kind: 'create-file',
            path: 'app/routes.ts',
            suite: 'project',
        },
    ];
}
function toProjectFinding(error) {
    if (error instanceof CliError) {
        if (error.code === 'RMX_ROUTE_MAP_LOADER_INVALID_JSON') {
            return {
                code: 'route-map-invalid-json',
                message: 'Route-map loader returned invalid JSON while loading app/routes.ts.',
                severity: 'warn',
                suite: 'project',
            };
        }
        if (error.code === 'RMX_ROUTE_MAP_LOADER_SIGNAL') {
            return {
                code: 'route-map-loader-signal',
                message: error.message,
                severity: 'warn',
                suite: 'project',
            };
        }
        if (error.code === 'RMX_ROUTE_MAP_LOADER_FAILED') {
            return classifyRouteMapLoaderFailure(error.message);
        }
    }
    let message = error instanceof Error ? error.message : String(error);
    return {
        code: 'route-module-import-failed',
        message: `Failed to load app/routes.ts: ${message}`,
        severity: 'warn',
        suite: 'project',
    };
}
function classifyRouteMapLoaderFailure(message) {
    if (message.includes('must export a named "routes" value')) {
        return {
            code: 'routes-export-missing',
            message: 'app/routes.ts must export a named "routes" value.',
            severity: 'warn',
            suite: 'project',
        };
    }
    if (message.startsWith('Invalid route map value at "') ||
        message.startsWith('Detected a route map cycle at "')) {
        return {
            code: 'route-map-invalid',
            message,
            severity: 'warn',
            suite: 'project',
        };
    }
    return {
        code: 'route-module-import-failed',
        message: `Failed to load app/routes.ts: ${message}`,
        severity: 'warn',
        suite: 'project',
    };
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
function hasOnlyWhitespaceAndComments(source) {
    for (let index = 0; index < source.length;) {
        let char = source[index];
        let next = source[index + 1];
        if (char == null || /\s/.test(char)) {
            index += 1;
            continue;
        }
        if (char === '/' && next === '/') {
            index += 2;
            while (index < source.length && source[index] !== '\n') {
                index += 1;
            }
            continue;
        }
        if (char === '/' && next === '*') {
            index += 2;
            while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
                index += 1;
            }
            index = Math.min(index + 2, source.length);
            continue;
        }
        return false;
    }
    return true;
}
function renderDefaultRoutesFile() {
    return [
        `import { route } from 'remix/routes'`,
        '',
        'export const routes = route({',
        `  home: '/',`,
        '})',
        '',
    ].join('\n');
}

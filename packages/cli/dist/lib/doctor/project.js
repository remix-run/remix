import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { getOwnerFileExtension, isActionFileName, isControllerEntryFileName, } from "../controller-files.js";
import { CliError } from "../errors.js";
import { loadRouteManifestFromAppRoot } from "../route-map.js";
import { createDoctorSuite, } from "./types.js";
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
    let homeActionPath = normalizeRelativePath(path.join('app', 'actions', `controller${await inferHomeOwnerExtension(projectRoot)}`));
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
            ...((await pathExists(path.join(projectRoot, homeActionPath)))
                ? []
                : [
                    {
                        code: 'missing-owner',
                        contents: renderDefaultHomeAction(homeActionPath),
                        kind: 'create-file',
                        path: homeActionPath,
                        routeName: 'home',
                        suite: 'project',
                    },
                ]),
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
        {
            code: 'missing-owner',
            contents: renderDefaultHomeAction(homeActionPath),
            kind: 'create-file',
            path: homeActionPath,
            routeName: 'home',
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
async function inferHomeOwnerExtension(projectRoot) {
    let actionsDir = path.join(projectRoot, 'app', 'actions');
    let extensions = await collectOwnerExtensions(actionsDir);
    if (extensions.length > 0) {
        return getMostCommonExtension(extensions);
    }
    if (await pathExists(path.join(projectRoot, 'tsconfig.json'))) {
        return '.tsx';
    }
    return '.js';
}
async function collectOwnerExtensions(directory) {
    try {
        let entries = await fs.readdir(directory, { withFileTypes: true });
        let extensions = [];
        for (let entry of entries) {
            let absolutePath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                extensions.push(...(await collectOwnerExtensions(absolutePath)));
                continue;
            }
            let fileName = path.basename(absolutePath);
            if (!isActionFileName(fileName) && !isControllerEntryFileName(fileName)) {
                continue;
            }
            let extension = getOwnerFileExtension(fileName);
            if (extension != null) {
                extensions.push(extension);
            }
        }
        return extensions;
    }
    catch (error) {
        let nodeError = error;
        if (nodeError.code === 'ENOENT') {
            return [];
        }
        throw error;
    }
}
function getMostCommonExtension(extensions) {
    let priority = ['.tsx', '.ts', '.jsx', '.js'];
    let counts = new Map();
    for (let extension of extensions) {
        counts.set(extension, (counts.get(extension) ?? 0) + 1);
    }
    let bestExtension = priority[0];
    let bestCount = -1;
    for (let extension of priority) {
        let count = counts.get(extension) ?? 0;
        if (count > bestCount) {
            bestCount = count;
            bestExtension = extension;
        }
    }
    return bestExtension;
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
function normalizeRelativePath(filePath) {
    return filePath.split(path.sep).join('/');
}
function renderDefaultHomeAction(entryPath) {
    let extension = getOwnerFileExtension(entryPath);
    if (extension === '.js') {
        return [
            `import { html } from 'remix/html-template'`,
            `import { createHtmlResponse } from 'remix/response/html'`,
            '',
            'export default {',
            '  actions: {',
            '    home() {',
            '      let page = html`',
            '        <html lang="en">',
            '          <head>',
            '            <meta charset="utf-8" />',
            '            <meta name="viewport" content="width=device-width, initial-scale=1" />',
            '            <title>Home</title>',
            '          </head>',
            '          <body>',
            '            <h1>Home</h1>',
            '            <p>Update app/routes.ts and app/actions/controller to keep building your app.</p>',
            '          </body>',
            '        </html>',
            '      `',
            '      return createHtmlResponse(page)',
            '    },',
            '  },',
            '}',
            '',
        ].join('\n');
    }
    if (extension === '.ts') {
        return [
            `import { createController } from 'remix/fetch-router'`,
            `import { html } from 'remix/html-template'`,
            `import { createHtmlResponse } from 'remix/response/html'`,
            '',
            `import { routes } from '../routes.ts'`,
            '',
            `export default createController(routes, {`,
            '  actions: {',
            '    home() {',
            '      let page = html`',
            '        <html lang="en">',
            '          <head>',
            '            <meta charset="utf-8" />',
            '            <meta name="viewport" content="width=device-width, initial-scale=1" />',
            '            <title>Home</title>',
            '          </head>',
            '          <body>',
            '            <h1>Home</h1>',
            '            <p>Update app/routes.ts and app/actions/controller to keep building your app.</p>',
            '          </body>',
            '        </html>',
            '      `',
            '      return createHtmlResponse(page)',
            '    },',
            '  },',
            `})`,
            '',
        ].join('\n');
    }
    if (extension === '.jsx') {
        return [
            `import { renderToStream } from 'remix/ui/server'`,
            `import { createHtmlResponse } from 'remix/response/html'`,
            '',
            'export default {',
            '  actions: {',
            '    home() {',
            '      let page = <HomePage />',
            '      return createHtmlResponse(renderToStream(page))',
            '    },',
            '  },',
            '}',
            '',
            'function HomePage() {',
            '  return () => (',
            '    <html lang="en">',
            '      <head>',
            '        <meta charSet="utf-8" />',
            '        <meta name="viewport" content="width=device-width, initial-scale=1" />',
            '        <title>Home</title>',
            '      </head>',
            '      <body>',
            '        <h1>Home</h1>',
            '        <p>Update app/routes.ts and app/actions/controller to keep building your app.</p>',
            '      </body>',
            '    </html>',
            '  )',
            '}',
            '',
        ].join('\n');
    }
    return [
        `import { createController } from 'remix/fetch-router'`,
        `import { renderToStream } from 'remix/ui/server'`,
        `import { createHtmlResponse } from 'remix/response/html'`,
        '',
        `import { routes } from '../routes.ts'`,
        '',
        `export default createController(routes, {`,
        '  actions: {',
        '    home() {',
        '      let page = <HomePage />',
        '      return createHtmlResponse(renderToStream(page))',
        '    },',
        '  },',
        `})`,
        '',
        'function HomePage() {',
        '  return () => (',
        '    <html lang="en">',
        '      <head>',
        '        <meta charSet="utf-8" />',
        '        <meta name="viewport" content="width=device-width, initial-scale=1" />',
        '        <title>Home</title>',
        '      </head>',
        '      <body>',
        '        <h1>Home</h1>',
        '        <p>Update app/routes.ts and app/actions/controller to keep building your app.</p>',
        '      </body>',
        '    </html>',
        '  )',
        '}',
        '',
    ].join('\n');
}

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createAssetServerCompilationError, isAssetServerCompilationError, } from "../compilation-error.js";
import { getInjectedPackageNameForSpecifier, getInjectedPackageImporterPath, restoreAuthoredInjectedPackageSpecifier, } from "../injected-packages.js";
import { normalizeFilePath } from "../paths.js";
import { scriptModuleHookConditions } from "./conditions.js";
export const resolverExtensionAlias = {
    '.js': ['.js', '.ts', '.tsx', '.jsx'],
    '.jsx': ['.jsx', '.tsx'],
    '.mjs': ['.mjs', '.mts'],
};
export const resolverExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs'];
export const supportedScriptExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs'];
const supportedScriptExtensionSet = new Set(supportedScriptExtensions);
export async function resolveModule(record, transformed, args) {
    let trackedFiles = new Set(transformed.trackedFiles);
    let trackedResolutions = [];
    let resolvedImports;
    try {
        resolvedImports =
            transformed.unresolvedImports.length > 0
                ? await batchResolveSpecifiers(getUniqueSpecifiers(transformed.unresolvedImports), transformed.resolvedPath, args.moduleHooks, args.getResolverFactory, args.resolverFactory)
                : new Map();
    }
    catch (error) {
        return failResolve(error, trackedFiles, trackedResolutions, transformed.resolvedPath, {
            isWatchIgnored: args.isWatchIgnored,
        });
    }
    let importsWithPaths = [];
    let acceptedDepsWithPaths = [];
    let deps = new Set();
    for (let unresolved of transformed.unresolvedImports) {
        let displaySpecifier = getDisplayImportSpecifier(unresolved.specifier);
        let trackedResolution = getTrackedRelativeImportResolution(transformed.importerDir, displaySpecifier, args.isWatchIgnored);
        let resolvedSpec = resolvedImports.get(unresolved.specifier);
        if (!resolvedSpec?.absolutePath) {
            return failResolve(createAssetServerCompilationError(`Failed to resolve import "${displaySpecifier}" in ${transformed.resolvedPath}. ` +
                `Ensure it resolves to a file within the configured asset server fileMap, or mark it as external.`, {
                code: 'IMPORT_RESOLUTION_FAILED',
            }), trackedFiles, trackedResolutions, transformed.resolvedPath, { isWatchIgnored: args.isWatchIgnored, trackedResolution });
        }
        let resolvedImport = args.resolveModulePath(resolvedSpec.absolutePath);
        if (!resolvedImport) {
            return failResolve(createAssetServerCompilationError(`Import "${displaySpecifier}" in ${transformed.resolvedPath}, resolved to "${resolvedSpec.absolutePath}", is not a supported script file. ` +
                `Supported extensions are ${supportedScriptExtensions.join(', ')}.`, {
                code: 'IMPORT_NOT_SUPPORTED',
            }), trackedFiles, trackedResolutions, transformed.resolvedPath, { isWatchIgnored: args.isWatchIgnored, trackedResolution });
        }
        if (!args.isAllowed(resolvedImport.identityPath)) {
            return failResolve(createAssetServerCompilationError(`Import "${displaySpecifier}" in ${transformed.resolvedPath}, resolved to "${resolvedImport.identityPath}", is not allowed by the asset server allow/deny configuration. ` +
                `Add a matching allow rule for this file path, remove a conflicting deny rule for this file path, or mark this import as external.`, {
                code: 'IMPORT_NOT_ALLOWED',
            }), trackedFiles, trackedResolutions, transformed.resolvedPath, { isWatchIgnored: args.isWatchIgnored, trackedResolution });
        }
        let stableUrlPathname = args.routes.toUrlPathname(resolvedImport.identityPath);
        if (!stableUrlPathname) {
            return failResolve(createAssetServerCompilationError(`Import "${displaySpecifier}" in ${transformed.resolvedPath}, resolved to "${resolvedImport.identityPath}", is outside all configured fileMap entries. ` +
                `Add a matching fileMap entry for this file path, or mark this import as external.`, {
                code: 'IMPORT_OUTSIDE_FILE_MAP',
            }), trackedFiles, trackedResolutions, transformed.resolvedPath, { isWatchIgnored: args.isWatchIgnored, trackedResolution });
        }
        deps.add(resolvedImport.identityPath);
        if (transformed.packageSpecifiers.includes(unresolved.specifier)) {
            let packageJsonPath = resolvedSpec.packageJsonPath ?? findNearestPackageJsonPath(resolvedImport.resolvedPath);
            if (packageJsonPath && !args.isWatchIgnored(packageJsonPath)) {
                trackedFiles.add(packageJsonPath);
            }
        }
        if (trackedResolution) {
            trackedResolutions.push({
                ...trackedResolution,
                resolvedIdentityPath: resolvedImport.identityPath,
            });
        }
        importsWithPaths.push({
            depPath: resolvedImport.identityPath,
            end: unresolved.end,
            quote: unresolved.quote,
            start: unresolved.start,
        });
    }
    for (let unresolved of transformed.hmr.acceptedDeps) {
        let displaySpecifier = getDisplayImportSpecifier(unresolved.specifier);
        let trackedResolution = getTrackedRelativeImportResolution(transformed.importerDir, displaySpecifier, args.isWatchIgnored);
        let resolvedSpec = resolvedImports.get(unresolved.specifier);
        if (!resolvedSpec) {
            try {
                resolvedSpec = await batchResolveSpecifiers([unresolved.specifier], transformed.resolvedPath, args.moduleHooks, args.getResolverFactory, args.resolverFactory).then((resolved) => resolved.get(unresolved.specifier));
            }
            catch (error) {
                return failResolve(error, trackedFiles, trackedResolutions, transformed.resolvedPath, {
                    isWatchIgnored: args.isWatchIgnored,
                    trackedResolution,
                });
            }
        }
        if (!resolvedSpec?.absolutePath) {
            return failResolve(createAssetServerCompilationError(`Failed to resolve accepted HMR dependency "${displaySpecifier}" in ${transformed.resolvedPath}. ` +
                `Ensure it resolves to a file within the configured asset server fileMap, or mark it as external.`, {
                code: 'IMPORT_RESOLUTION_FAILED',
            }), trackedFiles, trackedResolutions, transformed.resolvedPath, { isWatchIgnored: args.isWatchIgnored, trackedResolution });
        }
        let resolvedImport = args.resolveModulePath(resolvedSpec.absolutePath);
        if (!resolvedImport) {
            return failResolve(createAssetServerCompilationError(`Accepted HMR dependency "${displaySpecifier}" in ${transformed.resolvedPath}, resolved to "${resolvedSpec.absolutePath}", is not a supported script file. ` +
                `Supported extensions are ${supportedScriptExtensions.join(', ')}.`, {
                code: 'IMPORT_NOT_SUPPORTED',
            }), trackedFiles, trackedResolutions, transformed.resolvedPath, { isWatchIgnored: args.isWatchIgnored, trackedResolution });
        }
        if (!args.isAllowed(resolvedImport.identityPath)) {
            return failResolve(createAssetServerCompilationError(`Accepted HMR dependency "${displaySpecifier}" in ${transformed.resolvedPath}, resolved to "${resolvedImport.identityPath}", is not allowed by the asset server allow/deny configuration. ` +
                `Add a matching allow rule for this file path, remove a conflicting deny rule for this file path, or mark this import as external.`, {
                code: 'IMPORT_NOT_ALLOWED',
            }), trackedFiles, trackedResolutions, transformed.resolvedPath, { isWatchIgnored: args.isWatchIgnored, trackedResolution });
        }
        let stableUrlPathname = args.routes.toUrlPathname(resolvedImport.identityPath);
        if (!stableUrlPathname) {
            return failResolve(createAssetServerCompilationError(`Accepted HMR dependency "${displaySpecifier}" in ${transformed.resolvedPath}, resolved to "${resolvedImport.identityPath}", is outside all configured fileMap entries. ` +
                `Add a matching fileMap entry for this file path, or mark this import as external.`, {
                code: 'IMPORT_OUTSIDE_FILE_MAP',
            }), trackedFiles, trackedResolutions, transformed.resolvedPath, { isWatchIgnored: args.isWatchIgnored, trackedResolution });
        }
        if (trackedResolution) {
            trackedResolutions.push({
                ...trackedResolution,
                resolvedIdentityPath: resolvedImport.identityPath,
            });
        }
        acceptedDepsWithPaths.push({
            depPath: resolvedImport.identityPath,
            end: unresolved.end,
            quote: unresolved.quote,
            start: unresolved.start,
        });
    }
    return {
        ok: true,
        tracking: toResolveTracking(trackedFiles, trackedResolutions),
        value: {
            deps: [...deps],
            fingerprint: transformed.fingerprint,
            hmr: {
                acceptedDeps: acceptedDepsWithPaths,
                selfAccepting: transformed.hmr.selfAccepting,
                usesImportMetaHot: transformed.hmr.usesImportMetaHot,
            },
            identityPath: record.identityPath,
            imports: importsWithPaths,
            trackedFiles: [...trackedFiles],
            rawCode: transformed.rawCode,
            resolvedPath: transformed.resolvedPath,
            sourceMap: transformed.sourceMap,
            stableUrlPathname: transformed.stableUrlPathname,
        },
    };
}
function findNearestPackageJsonPath(filePath) {
    let directory = path.dirname(filePath);
    while (true) {
        let packageJsonPath = path.join(directory, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            return normalizeFilePath(packageJsonPath);
        }
        let parentDirectory = path.dirname(directory);
        if (parentDirectory === directory)
            return null;
        directory = parentDirectory;
    }
}
function isRelativeImportSpecifier(specifier) {
    return specifier.startsWith('./') || specifier.startsWith('../');
}
function getTrackedRelativeImportResolution(importerDir, specifier, isWatchIgnored) {
    if (!isRelativeImportSpecifier(specifier))
        return null;
    let candidatePath = resolveCandidateBasePath(importerDir, specifier);
    let candidatePrefixes = [`${candidatePath}/`].filter((candidatePrefix) => !isWatchIgnored(candidatePrefix.replace(/\/+$/, '') || '/'));
    let extension = path.extname(specifier);
    if (extension === '') {
        let candidatePaths = [
            candidatePath,
            ...supportedScriptExtensions.map((candidateExtension) => `${candidatePath}${candidateExtension}`),
        ].filter((candidatePath) => !isWatchIgnored(candidatePath));
        return candidatePaths.length === 0 && candidatePrefixes.length === 0
            ? null
            : {
                candidatePaths,
                candidatePrefixes,
                specifier,
            };
    }
    let candidateExtensions = resolverExtensionAlias[extension];
    if (!candidateExtensions && !supportedScriptExtensionSet.has(extension)) {
        let candidatePaths = [
            candidatePath,
            ...supportedScriptExtensions.map((candidateExtension) => `${candidatePath}${candidateExtension}`),
        ].filter((candidatePath) => !isWatchIgnored(candidatePath));
        return candidatePaths.length === 0 && candidatePrefixes.length === 0
            ? null
            : {
                candidatePaths,
                candidatePrefixes,
                specifier,
            };
    }
    if (!candidateExtensions)
        return null;
    let candidatePaths = [
        candidatePath,
        ...candidateExtensions.map((candidateExtension) => `${candidatePath.slice(0, candidatePath.length - extension.length)}${candidateExtension}`),
    ].filter((candidatePath) => !isWatchIgnored(candidatePath));
    return candidatePaths.length === 0 && candidatePrefixes.length === 0
        ? null
        : {
            candidatePaths,
            candidatePrefixes,
            specifier,
        };
}
function resolveCandidateBasePath(importerDir, specifier) {
    return normalizeFilePath(path.resolve(importerDir, specifier));
}
async function batchResolveSpecifiers(specifiers, importerPath, moduleHooks, getResolverFactory, resolverFactory) {
    let resolvedBySpecifier = new Map();
    if (specifiers.length === 0)
        return resolvedBySpecifier;
    try {
        for (let specifier of specifiers) {
            let normalizedResolution = normalizeSpecifierResolution(specifier, importerPath);
            let resolvedSpec = moduleHooks.length === 0
                ? await resolveSpecifierWithResolver(specifier, normalizedResolution, resolverFactory)
                : await resolveSpecifier(specifier, normalizedResolution, moduleHooks, getResolverFactory);
            if (resolvedSpec === null) {
                throw createAssetServerCompilationError(normalizedResolution.importerPath === getInjectedPackageImporterPath()
                    ? `Failed to resolve injected import "${specifier}" from asset server.`
                    : `Failed to resolve import "${normalizedResolution.specifier}" in ${normalizedResolution.importerPath}. ` +
                        `Ensure it resolves to a file within the configured asset server fileMap, or mark it as external.`, {
                    code: 'IMPORT_RESOLUTION_FAILED',
                });
            }
            resolvedBySpecifier.set(specifier, resolvedSpec);
        }
    }
    catch (error) {
        if (isAssetServerCompilationError(error) && error.code === 'IMPORT_RESOLUTION_FAILED') {
            throw error;
        }
        throw createAssetServerCompilationError(`Failed to resolve imports in ${importerPath}. ${formatUnknownError(error)}`, {
            cause: error,
            code: 'IMPORT_RESOLUTION_FAILED',
        });
    }
    return resolvedBySpecifier;
}
async function resolveSpecifierWithResolver(specifier, normalizedResolution, resolverFactory) {
    let resolutionResult = await resolverFactory.resolveFileAsync(normalizedResolution.importerPath, normalizedResolution.specifier);
    if (resolutionResult.error)
        return null;
    return {
        absolutePath: resolutionResult.path && path.isAbsolute(resolutionResult.path)
            ? normalizeFilePath(resolutionResult.path)
            : null,
        packageJsonPath: resolutionResult.packageJsonPath
            ? normalizeFilePath(resolutionResult.packageJsonPath)
            : null,
        specifier,
    };
}
function resolveSpecifierWithResolverSync(specifier, normalizedResolution, resolverFactory) {
    let resolutionResult = resolverFactory.resolveFileSync(normalizedResolution.importerPath, normalizedResolution.specifier);
    if (resolutionResult.error) {
        return {
            url: '',
        };
    }
    return {
        format: 'module',
        url: resolutionResult.path && path.isAbsolute(resolutionResult.path)
            ? pathToFileURL(resolutionResult.path).href
            : '',
    };
}
async function resolveSpecifier(displaySpecifier, normalizedResolution, moduleHooks, getResolverFactory) {
    let resolveHooks = moduleHooks
        .map((hook) => hook.resolve)
        .filter((resolve) => resolve !== undefined);
    let resolve = (specifier, context) => {
        let parentURL = context?.parentURL ?? pathToFileURL(normalizedResolution.importerPath).href;
        if (!parentURL.startsWith('file:')) {
            return {
                url: '',
            };
        }
        return resolveSpecifierWithResolverSync(specifier, normalizeSpecifierResolution(specifier, fileURLToPath(parentURL)), getResolverFactory(context?.conditions ?? scriptModuleHookConditions));
    };
    for (let hook of resolveHooks) {
        let nextResolve = resolve;
        resolve = (specifier, context) => {
            let nextResolveCalled = false;
            let wrappedNextResolve = (nextSpecifier, nextContext) => {
                nextResolveCalled = true;
                return nextResolve(nextSpecifier, nextContext);
            };
            let result = hook(specifier, {
                conditions: context?.conditions ?? [...scriptModuleHookConditions],
                importAttributes: context?.importAttributes ?? {},
                parentURL: context?.parentURL,
            }, wrappedNextResolve);
            if (!nextResolveCalled && result.shortCircuit !== true) {
                throw createAssetServerCompilationError(`Module resolve hook for ${specifier} returned without calling nextResolve or setting shortCircuit: true.`, {
                    code: 'IMPORT_RESOLUTION_FAILED',
                });
            }
            return result;
        };
    }
    let result = await resolve(displaySpecifier, {
        conditions: [...scriptModuleHookConditions],
        importAttributes: {},
        parentURL: pathToFileURL(normalizedResolution.importerPath).href,
    });
    return resolveResultToResolvedSpec(displaySpecifier, result);
}
function resolveResultToResolvedSpec(specifier, result) {
    if (!result.url)
        return null;
    try {
        let url = new URL(result.url);
        if (url.protocol !== 'file:') {
            return {
                absolutePath: null,
                packageJsonPath: null,
                specifier,
            };
        }
        return {
            absolutePath: normalizeFilePath(fileURLToPath(url)),
            packageJsonPath: null,
            specifier,
        };
    }
    catch {
        return null;
    }
}
function getUniqueSpecifiers(unresolvedImports) {
    return [...new Set(unresolvedImports.map((unresolved) => unresolved.specifier))];
}
function formatUnknownError(error) {
    return error instanceof Error ? error.message : String(error);
}
function normalizeSpecifierResolution(specifier, importerPath) {
    let authoredInjectedPackageSpecifier = restoreAuthoredInjectedPackageSpecifier(specifier);
    if (authoredInjectedPackageSpecifier) {
        return {
            importerPath,
            specifier: authoredInjectedPackageSpecifier,
        };
    }
    if (getInjectedPackageNameForSpecifier(specifier)) {
        return {
            importerPath: getInjectedPackageImporterPath(),
            specifier,
        };
    }
    return {
        importerPath,
        specifier,
    };
}
function getDisplayImportSpecifier(specifier) {
    return restoreAuthoredInjectedPackageSpecifier(specifier) ?? specifier;
}
function failResolve(error, trackedFiles, trackedResolutions, importerPath, options = {}) {
    return {
        ok: false,
        error: toResolveError(error, importerPath),
        tracking: toResolveTracking(trackedFiles, appendFailedTrackedResolution(trackedResolutions, options.trackedResolution)),
    };
}
function toResolveTracking(trackedFiles, trackedResolutions) {
    return {
        trackedFiles: [
            ...trackedFiles,
            ...trackedResolutions.flatMap((trackedResolution) => trackedResolution.candidatePaths),
        ],
        trackedDirectories: trackedResolutions.flatMap((trackedResolution) => trackedResolution.candidatePrefixes),
    };
}
function appendFailedTrackedResolution(trackedResolutions, trackedResolution) {
    if (trackedResolution == null)
        return [...trackedResolutions];
    return [
        ...trackedResolutions,
        {
            ...trackedResolution,
            resolvedIdentityPath: null,
        },
    ];
}
function toResolveError(error, importerPath) {
    if (isAssetServerCompilationError(error))
        return error;
    return createAssetServerCompilationError(`Failed to resolve imports in ${importerPath}. ${formatUnknownError(error)}`, {
        cause: error,
        code: 'IMPORT_RESOLUTION_FAILED',
    });
}

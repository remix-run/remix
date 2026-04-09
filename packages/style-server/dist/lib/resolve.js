import * as fs from 'node:fs';
import * as path from 'node:path';
import { createStyleServerCompilationError, isStyleServerCompilationError, } from "./compilation-error.js";
import { normalizeFilePath, normalizePathname } from "./paths.js";
export async function resolveStyle(record, transformed, args) {
    let trackedFiles = new Set(transformed.trackedFiles);
    let dependencies = [];
    let deps = new Set();
    for (let unresolved of transformed.unresolvedDependencies) {
        let trackedFile = unresolved.type === 'import'
            ? getTrackedDependencyFilePath(unresolved.url, transformed.resolvedPath, args.routes)
            : null;
        if (trackedFile)
            trackedFiles.add(trackedFile);
        try {
            let resolved = unresolved.type === 'import'
                ? resolveImportDependency(unresolved.url, transformed.resolvedPath, unresolved.placeholder, args)
                : resolveAssetDependency(unresolved.url, transformed.resolvedPath, unresolved.placeholder, args);
            dependencies.push(resolved);
            if (resolved.kind === 'local') {
                trackedFiles.add(resolved.depPath);
                if (resolved.dependencyType === 'import') {
                    deps.add(resolved.depPath);
                }
            }
        }
        catch (error) {
            return failResolve(error, trackedFiles, transformed.resolvedPath);
        }
    }
    return {
        ok: true,
        value: {
            dependencies,
            deps: [...deps],
            fingerprint: transformed.fingerprint,
            identityPath: record.identityPath,
            rawCode: transformed.rawCode,
            resolvedPath: transformed.resolvedPath,
            sourceMap: transformed.sourceMap,
            stableUrlPathname: transformed.stableUrlPathname,
            trackedFiles: [...trackedFiles],
        },
    };
}
export function resolveServedFileOrThrow(filePath, args) {
    let identityPath = resolveExistingFilePath(filePath);
    if (!identityPath) {
        throw createStyleServerCompilationError(`File not found: ${filePath}`, {
            code: 'FILE_NOT_FOUND',
        });
    }
    if (!args.isAllowed(identityPath)) {
        throw createStyleServerCompilationError(`File is not allowed: ${identityPath}`, {
            code: 'FILE_NOT_ALLOWED',
        });
    }
    let stableUrlPathname = args.routes.toUrlPathname(identityPath);
    if (!stableUrlPathname) {
        throw createStyleServerCompilationError(`File is outside configured style-server routes: ${identityPath}`, {
            code: 'FILE_OUTSIDE_ROUTES',
        });
    }
    return { identityPath, stableUrlPathname };
}
function resolveImportDependency(url, importerPath, placeholder, args) {
    return resolveDependency(url, importerPath, placeholder, args, {
        dependencyType: 'import',
        notAllowedCode: 'IMPORT_NOT_ALLOWED',
        notAllowedMessage: `Resolved import "${url}" in ${importerPath} points outside the style-server routing/allow configuration.`,
        resolveFailedCode: 'IMPORT_RESOLUTION_FAILED',
        resolveFailedMessage: `Failed to resolve import "${url}" in ${importerPath}.`,
    });
}
function resolveAssetDependency(url, _importerPath, placeholder, _args) {
    return {
        dependencyType: 'url',
        kind: 'external',
        placeholder,
        replacement: url,
    };
}
function resolveDependency(url, importerPath, placeholder, args, messages) {
    if (isExternalUrl(url)) {
        return {
            dependencyType: messages.dependencyType,
            kind: 'external',
            placeholder,
            replacement: url,
        };
    }
    let { pathname, suffix } = splitUrlSuffix(url);
    if (pathname.length === 0 || pathname === '#') {
        return {
            dependencyType: messages.dependencyType,
            kind: 'external',
            placeholder,
            replacement: url,
        };
    }
    if (pathname.startsWith('/')) {
        return {
            dependencyType: messages.dependencyType,
            kind: 'external',
            placeholder,
            replacement: url,
        };
    }
    let resolvedFilePath = normalizeFilePath(path.resolve(path.dirname(importerPath), pathname));
    if (!resolvedFilePath) {
        throw createStyleServerCompilationError(messages.resolveFailedMessage, {
            code: messages.resolveFailedCode,
        });
    }
    let identityPath = resolveExistingFilePath(resolvedFilePath);
    if (!identityPath) {
        throw createStyleServerCompilationError(messages.resolveFailedMessage, {
            code: messages.resolveFailedCode,
        });
    }
    if (!args.isAllowed(identityPath) || !args.routes.toUrlPathname(identityPath)) {
        throw createStyleServerCompilationError(messages.notAllowedMessage, {
            code: messages.notAllowedCode,
        });
    }
    return {
        depPath: identityPath,
        dependencyType: messages.dependencyType,
        kind: 'local',
        placeholder,
        suffix,
    };
}
function resolveExistingFilePath(filePath) {
    try {
        return normalizeFilePath(fs.realpathSync(filePath));
    }
    catch (error) {
        if (isNoEntityError(error))
            return null;
        throw error;
    }
}
function splitUrlSuffix(url) {
    let queryIndex = url.indexOf('?');
    let hashIndex = url.indexOf('#');
    let endIndex = [queryIndex, hashIndex].filter((index) => index >= 0).sort((a, b) => a - b)[0];
    if (endIndex == null) {
        return {
            pathname: url,
            suffix: '',
        };
    }
    return {
        pathname: url.slice(0, endIndex),
        suffix: url.slice(endIndex),
    };
}
function getTrackedDependencyFilePath(specifier, importerPath, _routes) {
    let { pathname } = splitUrlSuffix(specifier);
    if (pathname.startsWith('./') || pathname.startsWith('../')) {
        return normalizeFilePath(path.resolve(path.dirname(importerPath), pathname));
    }
    return null;
}
function isExternalUrl(url) {
    return url.startsWith('#') || url.startsWith('//') || /^[A-Za-z][A-Za-z\d+.-]*:/.test(url);
}
function isNoEntityError(error) {
    return (error instanceof Error && 'code' in error && error.code === 'ENOENT');
}
function toResolveError(error, importerPath) {
    if (isStyleServerCompilationError(error))
        return error;
    return createStyleServerCompilationError(`Failed to resolve CSS dependencies in ${importerPath}. ${error instanceof Error ? error.message : String(error)}`, {
        cause: error,
        code: 'IMPORT_RESOLUTION_FAILED',
    });
}
function failResolve(error, trackedFiles, importerPath) {
    return {
        ok: false,
        error: toResolveError(error, importerPath),
        tracking: {
            trackedFiles: [...trackedFiles],
        },
    };
}

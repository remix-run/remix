import * as fs from 'node:fs/promises';
import { transform } from 'lightningcss';
import { createAssetServerCompilationError, isAssetServerCompilationError, } from "../compilation-error.js";
import { generateFingerprint } from "../fingerprint.js";
import { rewriteSourceMapSources, stringifySourceMap } from "../source-maps.js";
export async function transformStyle(record, args) {
    let resolvedPath = record.identityPath;
    let trackedFiles = args.isWatchIgnored(resolvedPath) ? [] : [resolvedPath];
    let rawBytes;
    try {
        rawBytes = new Uint8Array(await fs.readFile(resolvedPath));
    }
    catch (error) {
        if (isNoEntityError(error)) {
            return {
                ok: false,
                error: createAssetServerCompilationError(`File not found: ${resolvedPath}`, {
                    cause: error,
                    code: 'FILE_NOT_FOUND',
                }),
                tracking: {
                    trackedFiles,
                },
            };
        }
        return {
            ok: false,
            error: toTransformFailedError(error, resolvedPath),
            tracking: {
                trackedFiles,
            },
        };
    }
    try {
        let stableUrlPathname = args.routes.toUrlPathname(record.identityPath);
        if (!stableUrlPathname) {
            throw createAssetServerCompilationError(`File ${record.identityPath} is outside all configured fileMap entries.`, {
                code: 'FILE_OUTSIDE_FILE_MAP',
            });
        }
        let transformResult = runLightningTransform(resolvedPath, rawBytes, {
            minify: args.minify,
            sourceMap: args.sourceMaps != null,
            targets: args.targets,
        });
        let sourceText = Buffer.from(rawBytes).toString('utf8');
        let sourceMap = stringifySourceMap(transformResult.map);
        sourceMap = sourceMap
            ? rewriteSourceMapSources(sourceMap, resolvedPath, stableUrlPathname, args.sourceMapSourcePaths, sourceText)
            : null;
        let unresolvedDependencies = [];
        for (let dependency of transformResult.dependencies ?? []) {
            if (dependency.type === 'import') {
                unresolvedDependencies.push({
                    placeholder: dependency.placeholder,
                    type: 'import',
                    url: dependency.url,
                });
                continue;
            }
            if (dependency.type === 'url') {
                unresolvedDependencies.push({
                    placeholder: dependency.placeholder,
                    type: 'url',
                    url: dependency.url,
                });
            }
        }
        return {
            ok: true,
            tracking: {
                trackedFiles,
            },
            value: {
                fingerprint: args.buildId === null
                    ? null
                    : await generateFingerprint({
                        buildId: args.buildId,
                        content: sourceText,
                    }),
                identityPath: record.identityPath,
                rawCode: Buffer.from(transformResult.code).toString('utf8'),
                resolvedPath,
                sourceMap,
                stableUrlPathname,
                trackedFiles,
                unresolvedDependencies,
            },
        };
    }
    catch (error) {
        return {
            ok: false,
            error: toTransformFailedError(error, resolvedPath),
            tracking: {
                trackedFiles,
            },
        };
    }
}
function runLightningTransform(identityPath, code, options) {
    try {
        return transform({
            analyzeDependencies: {
                preserveImports: true,
            },
            code,
            filename: identityPath,
            minify: options.minify,
            sourceMap: options.sourceMap,
            targets: options.targets ?? undefined,
        });
    }
    catch (error) {
        throw createAssetServerCompilationError(`Failed to transform style ${identityPath}. ${error instanceof Error ? error.message : String(error)}`, {
            cause: error,
            code: 'TRANSFORM_FAILED',
        });
    }
}
function toTransformFailedError(error, resolvedPath) {
    if (isAssetServerCompilationError(error))
        return error;
    return createAssetServerCompilationError(`Failed to transform style ${resolvedPath}. ${error instanceof Error ? error.message : String(error)}`, {
        cause: error,
        code: 'TRANSFORM_FAILED',
    });
}
function isNoEntityError(error) {
    return (error instanceof Error && 'code' in error && error.code === 'ENOENT');
}

import * as fs from 'node:fs/promises';
import { transform } from 'lightningcss';
import { createStyleServerCompilationError } from "./compilation-error.js";
import { generateFingerprint } from "./fingerprint.js";
import { rewriteSourceMapSources, stringifySourceMap } from "./source-maps.js";
export async function transformStyle(record, args) {
    let resolvedPath = record.identityPath;
    let trackedFiles = [resolvedPath];
    let rawBytes;
    try {
        rawBytes = new Uint8Array(await fs.readFile(resolvedPath));
    }
    catch (error) {
        if (isNoEntityError(error)) {
            return {
                ok: false,
                error: createStyleServerCompilationError(`File not found: ${resolvedPath}`, {
                    cause: error,
                    code: 'FILE_NOT_FOUND',
                }),
                trackedFiles,
            };
        }
        return {
            ok: false,
            error: toTransformFailedError(error, resolvedPath),
            trackedFiles,
        };
    }
    try {
        let stableUrlPathname = args.routes.toUrlPathname(record.identityPath);
        if (!stableUrlPathname) {
            throw createStyleServerCompilationError(`File is outside configured style-server routes: ${record.identityPath}`, {
                code: 'FILE_OUTSIDE_ROUTES',
            });
        }
        let transformResult = runLightningTransform(resolvedPath, rawBytes, {
            minify: args.minify,
            sourceMap: args.sourceMaps != null,
            targets: args.targets,
        });
        let sourceMap = stringifySourceMap(transformResult.map);
        sourceMap = sourceMap
            ? rewriteSourceMapSources(sourceMap, resolvedPath, stableUrlPathname, 'url')
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
            value: {
                fingerprint: args.buildId === null
                    ? null
                    : await generateFingerprint({
                        buildId: args.buildId,
                        content: rawBytes,
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
            trackedFiles,
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
        throw createStyleServerCompilationError(`Failed to transform CSS in ${identityPath}. ${error instanceof Error ? error.message : String(error)}`, {
            cause: error,
            code: 'STYLE_TRANSFORM_FAILED',
        });
    }
}
function toTransformFailedError(error, resolvedPath) {
    if (error instanceof Error && error.name === 'StyleServerCompilationError') {
        return error;
    }
    return createStyleServerCompilationError(`Failed to transform CSS in ${resolvedPath}. ${error instanceof Error ? error.message : String(error)}`, {
        cause: error,
        code: 'STYLE_TRANSFORM_FAILED',
    });
}
function isNoEntityError(error) {
    return (error instanceof Error && 'code' in error && error.code === 'ENOENT');
}

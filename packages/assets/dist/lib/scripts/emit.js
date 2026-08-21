import MagicString from 'magic-string';
import { createAssetServerCompilationError, isAssetServerCompilationError, } from '../compilation-error.js';
import { formatFingerprintedPathname, hashContent } from '../fingerprint.js';
import { restoreAuthoredInjectedPackageSpecifier } from '../injected-packages.js';
import { composeSourceMaps } from '../source-maps.js';
export async function emitResolvedModule(resolvedModule, options) {
    try {
        let importUrls = [];
        let rewriteResult = await rewriteImports(resolvedModule, options);
        let finalCode = prependHmrContext(resolvedModule, rewriteResult.code, options);
        let sourceMap = rewriteResult.sourceMap
            ? await createEmittedAsset(rewriteResult.sourceMap)
            : null;
        if (rewriteResult.sourceMap) {
            if (options.sourceMaps === 'inline') {
                let encoded = Buffer.from(rewriteResult.sourceMap).toString('base64');
                finalCode += `\n//# sourceMappingURL=data:application/json;base64,${encoded}`;
            }
            else if (options.sourceMaps === 'external') {
                finalCode += `\n//# sourceMappingURL=${formatFingerprintedPathname(resolvedModule.stableUrlPathname, options.fingerprintAssets && sourceMap ? sourceMap.fingerprint : null)}.map`;
            }
        }
        let code = await createEmittedAsset(finalCode);
        return {
            ok: true,
            value: {
                code,
                fingerprint: options.fingerprintAssets ? code.fingerprint : null,
                importUrls,
                sourceMap,
            },
        };
    }
    catch (error) {
        return {
            ok: false,
            error: toEmitError(error, resolvedModule.identityPath),
        };
    }
}
async function rewriteImports(resolvedModule, options) {
    let rewrittenSource = new MagicString(resolvedModule.rawCode);
    let changed = false;
    for (let imported of resolvedModule.imports) {
        let hmrImportTimestamp = options.getHmrImportTimestamp(imported.depPath);
        let url = hmrImportTimestamp === null
            ? restoreAuthoredInjectedPackageSpecifier(imported.specifier)
            : addTimestampQuery(await options.getServedUrl(imported.depPath), hmrImportTimestamp);
        if (url === null) {
            continue;
        }
        rewrittenSource.overwrite(imported.start, imported.end, imported.quote ? `${imported.quote}${url}${imported.quote}` : url);
        changed = true;
    }
    for (let acceptedDep of resolvedModule.hmr.acceptedDeps) {
        let url = options.getStableUrl(acceptedDep.depPath);
        rewrittenSource.overwrite(acceptedDep.start, acceptedDep.end, acceptedDep.quote ? `${acceptedDep.quote}${url}${acceptedDep.quote}` : url);
        changed = true;
    }
    let code = changed ? rewrittenSource.toString() : resolvedModule.rawCode;
    let sourceMap = resolvedModule.sourceMap && changed
        ? composeSourceMaps(rewrittenSource.generateMap({ hires: true }).toString(), resolvedModule.sourceMap)
        : resolvedModule.sourceMap;
    return { code, sourceMap };
}
function addTimestampQuery(pathname, timestamp) {
    return `${pathname}${pathname.includes('?') ? '&' : '?'}t=${timestamp}`;
}
function prependHmrContext(resolvedModule, code, options) {
    if (!options.hmrClientPathname || !resolvedModule.hmr.usesImportMetaHot)
        return code;
    return (`import { createHotContext as __remixCreateHotContext } from ${JSON.stringify(options.hmrClientPathname)};\n` +
        `import.meta.hot = __remixCreateHotContext(${JSON.stringify(resolvedModule.stableUrlPathname)});\n` +
        code);
}
async function createEmittedAsset(content) {
    let fingerprint = await hashContent(content);
    return {
        content,
        etag: `W/"${fingerprint}"`,
        fingerprint,
    };
}
function toEmitError(error, identityPath) {
    if (isAssetServerCompilationError(error))
        return error;
    return createAssetServerCompilationError(`Failed to emit script ${identityPath}. ${error instanceof Error ? error.message : String(error)}`, {
        cause: error,
        code: 'EMIT_FAILED',
    });
}

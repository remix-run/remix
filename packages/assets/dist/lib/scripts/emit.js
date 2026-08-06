import MagicString from 'magic-string';
import { createAssetServerCompilationError, isAssetServerCompilationError, } from "../compilation-error.js";
import { hashContent } from "../fingerprint.js";
import { composeSourceMaps } from "../source-maps.js";
export async function emitResolvedModule(resolvedModule, options) {
    try {
        let importUrls = await Promise.all(resolvedModule.deps.map((depPath) => options.getServedUrl(depPath)));
        let rewriteResult = await rewriteImports(resolvedModule, options);
        let finalCode = rewriteResult.code;
        if (rewriteResult.sourceMap) {
            if (options.sourceMaps === 'inline') {
                let encoded = Buffer.from(rewriteResult.sourceMap).toString('base64');
                finalCode += `\n//# sourceMappingURL=data:application/json;base64,${encoded}`;
            }
            else if (options.sourceMaps === 'external') {
                finalCode += `\n//# sourceMappingURL=${await options.getServedUrl(resolvedModule.identityPath)}.map`;
            }
        }
        return {
            ok: true,
            value: {
                code: await createEmittedAsset(finalCode),
                fingerprint: resolvedModule.fingerprint,
                importUrls,
                sourceMap: rewriteResult.sourceMap
                    ? await createEmittedAsset(rewriteResult.sourceMap)
                    : null,
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
    for (let imported of resolvedModule.imports) {
        let url = await options.getServedUrl(imported.depPath);
        rewrittenSource.overwrite(imported.start, imported.end, imported.quote ? `${imported.quote}${url}${imported.quote}` : url);
    }
    let code = rewrittenSource.toString();
    let sourceMap = resolvedModule.sourceMap && resolvedModule.imports.length > 0
        ? composeSourceMaps(rewrittenSource.generateMap({ hires: true }).toString(), resolvedModule.sourceMap)
        : resolvedModule.sourceMap;
    return { code, sourceMap };
}
async function createEmittedAsset(content) {
    return {
        content,
        etag: `W/"${await hashContent(content)}"`,
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

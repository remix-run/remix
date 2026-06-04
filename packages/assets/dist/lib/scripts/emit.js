import * as path from 'node:path';
import MagicString from 'magic-string';
import { createAssetServerCompilationError, isAssetServerCompilationError, } from "../compilation-error.js";
import { hashContent } from "../fingerprint.js";
import { composeSourceMaps } from "../source-maps.js";
export async function emitResolvedModule(resolvedModule, options) {
    try {
        let servedUrl = await options.getServedUrl(resolvedModule.identityPath);
        let importUrlEntries = await Promise.all(resolvedModule.deps.map(async (depPath) => [
            depPath,
            await options.getServedUrl(depPath),
        ]));
        let importUrlByDepPath = new Map(importUrlEntries);
        let importUrls = importUrlEntries.map(([, url]) => url);
        let rewriteResult = await rewriteImports(resolvedModule, {
            importUrlByDepPath,
            servedUrl,
        });
        let finalCode = rewriteResult.code;
        if (rewriteResult.sourceMap) {
            if (options.sourceMaps === 'inline') {
                let encoded = Buffer.from(rewriteResult.sourceMap).toString('base64');
                finalCode += `\n//# sourceMappingURL=data:application/json;base64,${encoded}`;
            }
            else if (options.sourceMaps === 'external') {
                finalCode += `\n//# sourceMappingURL=${toRelativeServedUrl(servedUrl, `${servedUrl}.map`)}`;
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
        let depUrl = options.importUrlByDepPath.get(imported.depPath);
        if (depUrl === undefined) {
            throw new Error(`Missing served URL for resolved import ${imported.depPath}`);
        }
        let url = toRelativeServedUrl(options.servedUrl, depUrl);
        rewrittenSource.overwrite(imported.start, imported.end, imported.quote ? `${imported.quote}${url}${imported.quote}` : url);
    }
    let code = rewrittenSource.toString();
    let sourceMap = resolvedModule.sourceMap && resolvedModule.imports.length > 0
        ? composeSourceMaps(rewrittenSource.generateMap({ hires: true }).toString(), resolvedModule.sourceMap)
        : resolvedModule.sourceMap;
    return { code, sourceMap };
}
function toRelativeServedUrl(fromUrl, toUrl) {
    let from = new URL(fromUrl, 'http://remix.local');
    let to = new URL(toUrl, from);
    if (from.origin !== to.origin) {
        return toUrl;
    }
    let relative = path.posix.relative(path.posix.dirname(from.pathname), to.pathname);
    if (relative === '' || (!relative.startsWith('.') && !relative.startsWith('/'))) {
        relative = `./${relative}`;
    }
    return `${relative}${to.search}${to.hash}`;
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

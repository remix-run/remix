import MagicString from 'magic-string';
import { createAssetServerCompilationError, isAssetServerCompilationError, } from '../compilation-error.js';
import { formatFingerprintedPathname, hashContent } from '../fingerprint.js';
import { composeSourceMaps, replaceSourceMapMappings } from '../source-maps.js';
export async function emitResolvedModule(resolvedModule, options) {
    try {
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
                let sourceMapUrl = `${formatFingerprintedPathname(resolvedModule.stableUrlPathname, options.fingerprintAssets && sourceMap ? sourceMap.fingerprint : null)}.map`;
                if (options.hmrTimestamp !== null) {
                    sourceMapUrl = addTimestampQuery(sourceMapUrl, options.hmrTimestamp);
                }
                finalCode += `\n//# sourceMappingURL=${sourceMapUrl}`;
            }
        }
        let code = await createEmittedAsset(finalCode);
        return {
            ok: true,
            value: {
                code,
                fingerprint: options.fingerprintAssets ? code.fingerprint : null,
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
    let edits = [];
    let rewriteMappings = [];
    let rewrittenRanges = resolvedModule.importRewrites.map(({ start, end }) => ({
        start,
        end,
    }));
    for (let declaration of resolvedModule.importRewrites) {
        let replacement = '';
        for (let { depPath, sourceStart, specifiers } of declaration.imports) {
            let hmrImportTimestamp = options.getHmrImportTimestamp(depPath);
            let url = hmrImportTimestamp === null
                ? (options.getRewrittenImportUrl?.(depPath) ?? options.getStableUrl(depPath))
                : addTimestampQuery(await options.getServedUrl(depPath), hmrImportTimestamp);
            if (replacement.length > 0)
                replacement += '\n';
            replacement += specifiers.length === 0 ? 'import ' : 'import { ';
            for (let index = 0; index < specifiers.length; index++) {
                let { authoredImportedName, importedName, importedStart, localName, localStart } = specifiers[index];
                if (index > 0)
                    replacement += ', ';
                rewriteMappings.push({
                    declarationStart: declaration.start,
                    replacementOffset: replacement.length,
                    originalOffset: importedStart,
                    name: authoredImportedName,
                });
                replacement += importedName;
                if (importedName !== localName) {
                    replacement += ' as ';
                    rewriteMappings.push({
                        declarationStart: declaration.start,
                        replacementOffset: replacement.length,
                        originalOffset: localStart,
                        name: localName,
                    });
                    replacement += localName;
                }
            }
            if (specifiers.length > 0)
                replacement += ' } from ';
            let stringifiedUrl = JSON.stringify(url);
            rewriteMappings.push({
                declarationStart: declaration.start,
                replacementOffset: replacement.length + 1,
                originalOffset: sourceStart,
            });
            replacement += `${stringifiedUrl};`;
        }
        overwrite(declaration.start, declaration.end, replacement);
        changed = true;
    }
    for (let imported of resolvedModule.imports) {
        if (rewrittenRanges.some((range) => imported.start >= range.start && imported.end <= range.end)) {
            continue;
        }
        let hmrImportTimestamp = options.getHmrImportTimestamp(imported.depPath);
        let replacementSpecifier = imported.specifier;
        if (hmrImportTimestamp !== null) {
            replacementSpecifier = addTimestampQuery(await options.getServedUrl(imported.depPath), hmrImportTimestamp);
        }
        else {
            let rewrittenImportUrl = options.getRewrittenImportUrl?.(imported.depPath);
            if (rewrittenImportUrl !== undefined) {
                replacementSpecifier = rewrittenImportUrl;
            }
            else if (imported.compiledSpecifier === imported.specifier) {
                continue;
            }
        }
        overwrite(imported.start, imported.end, imported.quote
            ? `${imported.quote}${replacementSpecifier}${imported.quote}`
            : replacementSpecifier);
        changed = true;
    }
    for (let acceptedDep of resolvedModule.hmr.acceptedDeps) {
        let url = options.getStableUrl(acceptedDep.depPath);
        overwrite(acceptedDep.start, acceptedDep.end, acceptedDep.quote ? `${acceptedDep.quote}${url}${acceptedDep.quote}` : url);
        changed = true;
    }
    let code = changed ? rewrittenSource.toString() : resolvedModule.rawCode;
    let sourceMap = resolvedModule.sourceMap && changed
        ? composeSourceMaps(replaceSourceMapMappings(rewrittenSource.generateMap({ hires: true }).toString(), code, resolvedModule.rawCode, rewriteMappings.map(({ declarationStart, replacementOffset, ...mapping }) => ({
            ...mapping,
            generatedOffset: getGeneratedOffset(declarationStart, edits) + replacementOffset,
        }))), resolvedModule.sourceMap)
        : resolvedModule.sourceMap;
    return { code, sourceMap };
    function overwrite(start, end, replacement) {
        rewrittenSource.overwrite(start, end, replacement);
        edits.push({ end, replacementLength: replacement.length, start });
    }
}
function getGeneratedOffset(originalOffset, edits) {
    let generatedOffset = originalOffset;
    for (let edit of edits) {
        if (edit.end <= originalOffset) {
            generatedOffset += edit.replacementLength - (edit.end - edit.start);
        }
    }
    return generatedOffset;
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

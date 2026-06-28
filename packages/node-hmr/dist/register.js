import { registerHooks } from 'node:module';
import { isAbsolute, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SourceMapConsumer, SourceMapGenerator } from 'source-map-js/source-map.js';
import { analyzeNodeHmrSource, } from "./lib/hmr-analysis.js";
import { markNodeHmrParentProcess } from "./lib/process-state.js";
import { installNodeHmrRuntime } from "./lib/runtime.js";
markNodeHmrParentProcess();
const runtime = installNodeHmrRuntime({
    browserEventUrl: getBrowserEventUrl(),
});
const rootPath = getRegisterUrlParam('rootPath');
let invalidatedUrlTimestamps = new Map();
let updateQueue = Promise.resolve();
registerHooks({
    resolve(specifier, context, nextResolve) {
        let result = nextResolve(specifier, context);
        reportModuleImport(context.parentURL, result.url);
        return result;
    },
    load(url, context, nextLoad) {
        let result = nextLoad(url, context);
        let source = result.source;
        if (!shouldTransformModule(url, result.format, source))
            return result;
        let canonicalUrl = getCanonicalUrl(url);
        let transformedSource = transformSource(canonicalUrl, source);
        transformedSource = rewriteInvalidatedImports(canonicalUrl, transformedSource);
        let hmrAnalysis = analyzeNodeHmrSource(canonicalUrl, transformedSource);
        if (!hmrAnalysis.usesImportMetaHot) {
            reportModuleUpdate(canonicalUrl, {
                acceptedDeps: [],
                selfAccepting: false,
                usesImportMetaHot: false,
            });
            return {
                ...result,
                source: transformedSource,
            };
        }
        reportModuleUpdate(canonicalUrl, {
            acceptedDeps: [],
            selfAccepting: hmrAnalysis.selfAccepting,
            usesImportMetaHot: true,
        });
        return {
            ...result,
            source: injectHotContext(canonicalUrl, transformedSource, hmrAnalysis),
        };
    },
});
function getRegisterUrlParam(name) {
    let value = new URL(import.meta.url).searchParams.get(name);
    return value ?? undefined;
}
function getBrowserEventUrl() {
    let eventUrl = getRegisterUrlParam('browserEventUrl');
    if (eventUrl === undefined)
        return undefined;
    return isHttpUrl(eventUrl) ? eventUrl : undefined;
}
function isHttpUrl(value) {
    try {
        let url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    }
    catch {
        return false;
    }
}
process.on('message', (message) => {
    if (isBrowserHmrFileEventsMessage(message)) {
        runtime.handleBrowserHmrFileEvents(message.requestId, message.events);
        return;
    }
    if (!isHmrUpdateMessage(message))
        return;
    updateQueue = updateQueue.then(() => handleHotUpdateMessage(message));
    void updateQueue;
});
process.once('SIGINT', () => disposeOnSignal('SIGINT'));
process.once('SIGTERM', () => disposeOnSignal('SIGTERM'));
function shouldTransformModule(url, format, source) {
    if (!url.startsWith('file:'))
        return false;
    if (format !== 'module')
        return false;
    if (typeof source !== 'string')
        return false;
    return true;
}
function injectHotContext(url, source, hmr) {
    let resolveDependencyExpression = `(specifier) => { let url = new URL(import.meta.resolve(specifier)); url.search = ''; url.hash = ''; return url.href }`;
    let sourceWithMap = extractInlineSourceMap(source);
    let prelude = [
        `const __remixNodeHmrResolveDependency = ${resolveDependencyExpression};`,
        `globalThis.__remixNodeHmr.reportAcceptedDependencies(${JSON.stringify(url)}, ${getAcceptedDependencyExpression(hmr)});`,
        `import.meta.hot = globalThis.__remixNodeHmr.createHotContext(${JSON.stringify(url)}, __remixNodeHmrResolveDependency);`,
    ].join('\n');
    let injectedSource = `${prelude}\n${sourceWithMap.code}`;
    let injectionSourceMap = createLineOffsetSourceMap(url, sourceWithMap.code, getLineCount(prelude));
    let sourceMap = sourceWithMap.sourceMap === null
        ? injectionSourceMap
        : composeSourceMaps(injectionSourceMap, sourceWithMap.sourceMap);
    return appendInlineSourceMap(injectedSource, sourceMap);
}
function getAcceptedDependencyExpression(hmr) {
    return `[${hmr.acceptedDeps
        .map((acceptedDep) => `__remixNodeHmrResolveDependency(${JSON.stringify(acceptedDep.specifier)})`)
        .join(', ')}]`;
}
function transformSource(url, source) {
    let filePath = fileURLToPath(url);
    if (url.includes('/node_modules/') ||
        (rootPath !== undefined && !isInsideRoot(filePath, rootPath))) {
        return source;
    }
    return source;
}
function rewriteInvalidatedImports(url, source) {
    if (invalidatedUrlTimestamps.size === 0)
        return source;
    let replacements = [];
    let staticSpecifierPattern = /\b(?:import\s+(?:[^'"()]*?\s+from\s*)?|export\s+[^'"()]*?\s+from\s*)(["'])([^"']+)\1/g;
    for (let match of source.matchAll(staticSpecifierPattern)) {
        let quote = match[1];
        let specifier = match[2];
        if (quote === undefined || specifier === undefined || match.index === undefined)
            continue;
        let resolvedUrl = new URL(specifier, url).href;
        let timestamp = invalidatedUrlTimestamps.get(getCanonicalUrl(resolvedUrl));
        if (timestamp === undefined)
            continue;
        let specifierStart = match.index + match[0].length - specifier.length - quote.length;
        replacements.push({
            end: specifierStart + specifier.length,
            specifier: addTimestampQuery(specifier, timestamp),
            start: specifierStart,
        });
    }
    if (replacements.length === 0)
        return source;
    let rewrittenSource = '';
    let position = 0;
    for (let replacement of replacements) {
        rewrittenSource += source.slice(position, replacement.start);
        rewrittenSource += replacement.specifier;
        position = replacement.end;
    }
    rewrittenSource += source.slice(position);
    return rewrittenSource;
}
function reportModuleUpdate(url, hmr) {
    process.send?.({
        type: 'node-hmr:child:module-analyzed',
        url,
        filePath: fileURLToPath(url),
        hmr,
    });
}
function reportModuleImport(parentUrl, url) {
    if (parentUrl === undefined)
        return;
    let canonicalParentUrl = getCanonicalUrl(parentUrl);
    let canonicalUrl = getCanonicalUrl(url);
    if (!canonicalParentUrl.startsWith('file:') || !canonicalUrl.startsWith('file:'))
        return;
    process.send?.({
        type: 'node-hmr:child:module-imported',
        importerFilePath: fileURLToPath(canonicalParentUrl),
        importerUrl: canonicalParentUrl,
        depFilePath: fileURLToPath(canonicalUrl),
        depUrl: canonicalUrl,
    });
}
function getCanonicalUrl(url) {
    let parsedUrl = new URL(url);
    parsedUrl.search = '';
    parsedUrl.hash = '';
    return parsedUrl.href;
}
function addTimestampQuery(specifier, timestamp) {
    return `${specifier}${specifier.includes('?') ? '&' : '?'}t=${timestamp}`;
}
function isInsideRoot(filePath, root) {
    let relativePath = relative(root, filePath);
    return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath));
}
function getLineCount(source) {
    return source.split('\n').length;
}
function extractInlineSourceMap(source) {
    let sourceMapPattern = /(?:\/\/# sourceMappingURL=data:application\/json;base64,([A-Za-z0-9+/=]+)|\/\*# sourceMappingURL=data:application\/json;base64,([A-Za-z0-9+/=]+) \*\/)\s*$/g;
    let sourceMap = null;
    let code = source.replace(sourceMapPattern, (_match, lineComment, blockComment) => {
        sourceMap = Buffer.from(lineComment ?? blockComment, 'base64').toString('utf-8');
        return '';
    });
    return { code: code.trimEnd(), sourceMap };
}
function appendInlineSourceMap(source, sourceMap) {
    let encoded = Buffer.from(sourceMap).toString('base64');
    return `${source}\n//# sourceMappingURL=data:application/json;base64,${encoded}`;
}
function createLineOffsetSourceMap(url, source, lineOffset) {
    let generator = new SourceMapGenerator({ file: url });
    let lines = source.split('\n');
    for (let index = 0; index < lines.length; index++) {
        generator.addMapping({
            generated: {
                column: 0,
                line: index + lineOffset + 1,
            },
            original: {
                column: 0,
                line: index + 1,
            },
            source: url,
        });
    }
    generator.setSourceContent(url, source);
    return JSON.stringify(generator.toJSON());
}
function composeSourceMaps(rewriteSourceMap, transformSourceMap) {
    let rewriteConsumer = new SourceMapConsumer(JSON.parse(rewriteSourceMap));
    let transformConsumer = new SourceMapConsumer(JSON.parse(transformSourceMap));
    let generator = new SourceMapGenerator();
    rewriteConsumer.eachMapping((mapping) => {
        if (mapping.originalLine == null ||
            mapping.originalColumn == null ||
            mapping.generatedLine == null ||
            mapping.generatedColumn == null) {
            return;
        }
        let original = transformConsumer.originalPositionFor({
            line: mapping.originalLine,
            column: mapping.originalColumn,
        });
        if (original.line == null || original.column == null || original.source == null)
            return;
        generator.addMapping({
            generated: {
                line: mapping.generatedLine,
                column: mapping.generatedColumn,
            },
            original: {
                line: original.line,
                column: original.column,
            },
            source: original.source,
            name: original.name ?? mapping.name ?? undefined,
        });
    });
    for (let source of transformConsumer.sources) {
        let sourceContent = transformConsumer.sourceContentFor(source, true);
        if (sourceContent !== null) {
            generator.setSourceContent(source, sourceContent);
        }
    }
    return JSON.stringify(generator.toJSON());
}
async function handleHotUpdateMessage(message) {
    invalidatedUrlTimestamps = new Map(Object.entries(message.invalidatedUrls ?? {}));
    try {
        await runtime.update(message.url, message.timestamp, message.acceptedUrl);
    }
    catch (error) {
        process.send?.({
            type: 'node-hmr:child:restart-requested',
            message: error instanceof Error ? error.message : String(error),
        });
    }
}
function isHmrUpdateMessage(message) {
    return (typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message.type === 'node-hmr:parent:hot-module-changed' &&
        'url' in message &&
        typeof message.url === 'string' &&
        'timestamp' in message &&
        typeof message.timestamp === 'number' &&
        (!('acceptedUrl' in message) || typeof message.acceptedUrl === 'string') &&
        (!('invalidatedUrls' in message) || isInvalidatedUrls(message.invalidatedUrls)));
}
function isBrowserHmrFileEventsMessage(message) {
    return (typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message.type === 'node-hmr:parent:browser-hmr-file-events' &&
        'requestId' in message &&
        typeof message.requestId === 'number' &&
        'events' in message &&
        Array.isArray(message.events) &&
        message.events.every((event) => typeof event === 'object' &&
            event !== null &&
            'filePath' in event &&
            typeof event.filePath === 'string' &&
            'event' in event &&
            (event.event === 'add' || event.event === 'change' || event.event === 'unlink')));
}
function isInvalidatedUrls(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    for (let timestamp of Object.values(value)) {
        if (typeof timestamp !== 'number')
            return false;
    }
    return true;
}
function disposeOnSignal(signal) {
    runtime.disposeAll().finally(() => {
        if (process.listenerCount(signal) === 0) {
            process.exit(signal === 'SIGINT' ? 130 : 143);
        }
    });
}

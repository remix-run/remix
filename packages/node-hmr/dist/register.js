import { registerHooks } from 'node:module';
import { createRequire } from 'node:module';
import { Server } from 'node:net';
import { dirname, isAbsolute, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformComponentHmr } from '@remix-run/ui-hmr/transform';
import { analyzeNodeHmrSource, } from "./lib/hmr-analysis.js";
import { markNodeHmrParentProcess } from "./lib/process-state.js";
import { installNodeHmrRuntime } from "./lib/runtime.js";
markNodeHmrParentProcess();
const runtime = installNodeHmrRuntime({ browserEventUrl: getBrowserEventUrl() });
const rootPath = getRegisterUrlParam('rootPath');
let invalidatedUrlTimestamps = new Map();
const componentHmrRuntimeUrl = import.meta.resolve('@remix-run/ui-hmr/runtime');
const componentHmrRefreshSpecifiers = ['remix/ui/dev/refresh', '@remix-run/ui/dev/refresh'];
patchServerListen();
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
    if (!isHmrUpdateMessage(message))
        return;
    invalidatedUrlTimestamps = new Map(Object.entries(message.invalidatedUrls ?? {}));
    runtime.update(message.url, message.timestamp, message.acceptedUrl).catch((error) => {
        process.send?.({
            type: 'hmr:restart',
            message: error instanceof Error ? error.message : String(error),
        });
    });
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
    return [
        `const __remixNodeHmrResolveDependency = ${resolveDependencyExpression};`,
        `globalThis.__remixNodeHmr.reportAcceptedDependencies(${JSON.stringify(url)}, ${getAcceptedDependencyExpression(hmr)});`,
        `import.meta.hot = globalThis.__remixNodeHmr.createHotContext(${JSON.stringify(url)}, __remixNodeHmrResolveDependency);`,
        source,
    ].join('\n');
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
    let componentHmrRefreshSpecifier = resolveComponentHmrRefreshSpecifier(url);
    if (componentHmrRefreshSpecifier === null)
        return source;
    let result = transformComponentHmr(source, {
        moduleUrl: url,
        refreshSpecifier: componentHmrRefreshSpecifier,
        runtimeSpecifier: componentHmrRuntimeUrl,
    });
    return result.code;
}
function resolveComponentHmrRefreshSpecifier(url) {
    let filePath = fileURLToPath(url);
    let require = createRequire(url);
    let paths = [dirname(filePath)];
    for (let refreshSpecifier of componentHmrRefreshSpecifiers) {
        try {
            require.resolve(refreshSpecifier, { paths });
            return refreshSpecifier;
        }
        catch { }
    }
    return null;
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
        type: 'module-update',
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
        type: 'module-import',
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
function isHmrUpdateMessage(message) {
    return (typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message.type === 'hmr:update' &&
        'url' in message &&
        typeof message.url === 'string' &&
        'timestamp' in message &&
        typeof message.timestamp === 'number' &&
        (!('acceptedUrl' in message) || typeof message.acceptedUrl === 'string') &&
        (!('invalidatedUrls' in message) || isInvalidatedUrls(message.invalidatedUrls)));
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
function patchServerListen() {
    let originalListen = Server.prototype.listen;
    function listen() {
        let server = this;
        server.once('listening', () => {
            process.send?.({
                type: 'server-ready',
            });
        });
        return Reflect.apply(originalListen, server, Array.from(arguments));
    }
    Server.prototype.listen = listen;
}

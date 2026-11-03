import { asURL, resolveAndComposeImportMap, resolveIfNotPlainOrUrl, resolveImportMap, } from './resolve.js';
let importMap = { imports: {}, scopes: {}, integrity: {} };
const processedScripts = new WeakSet();
const selector = 'script[type="importmap"]';
const observer = typeof document === 'undefined' ? undefined : new MutationObserver(processMutations);
if (observer) {
    observer.observe(document, { childList: true });
    observer.observe(document.head, { childList: true });
    processImportMaps();
}
export function resolveModuleUrl(specifier, parentUrl) {
    if (observer)
        processMutations(observer.takeRecords());
    processImportMaps();
    let normalized = resolveIfNotPlainOrUrl(specifier, parentUrl) || asURL(specifier) || specifier;
    let resolved = resolveImportMap(importMap, normalized, parentUrl);
    if (!resolved)
        throw new TypeError(`Unable to resolve specifier '${specifier}' from ${parentUrl}`);
    return resolved;
}
function processImportMaps() {
    for (let script of document.querySelectorAll(selector))
        processImportMap(script);
}
function processMutations(mutations) {
    for (let mutation of mutations) {
        for (let node of mutation.addedNodes) {
            if (node instanceof HTMLScriptElement && node.matches(selector))
                processImportMap(node);
        }
    }
}
function processImportMap(script) {
    if (processedScripts.has(script))
        return;
    processedScripts.add(script);
    if (script.src)
        return;
    let parsed;
    try {
        parsed = JSON.parse(script.textContent ?? '');
    }
    catch {
        return;
    }
    if (!isRecord(parsed))
        return;
    let scopes = {};
    if (isRecord(parsed.scopes)) {
        for (let [scope, entries] of Object.entries(parsed.scopes)) {
            if (isRecord(entries))
                scopes[scope] = entries;
        }
    }
    importMap = resolveAndComposeImportMap({ imports: isRecord(parsed.imports) ? parsed.imports : undefined, scopes }, script.baseURI, importMap);
}
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

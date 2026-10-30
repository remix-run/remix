const MANAGED_IMPORT_MAP_SELECTOR = 'script[data-rmx-import-map][type="importmap"]';
const IMPORT_MAP_SELECTOR = 'script[type="importmap"]';
const importMapManagers = new WeakMap();
class ImportMapConflictError extends Error {
}
export function getDocumentImportMapManager(doc) {
    let manager = importMapManagers.get(doc);
    if (!manager) {
        manager = createImportMapManager(doc);
        importMapManagers.set(doc, manager);
    }
    return manager;
}
export function resetDocumentImportMapManager(doc) {
    importMapManagers.get(doc)?.disconnect();
    importMapManagers.delete(doc);
}
function createImportMapManager(doc) {
    let nonce = doc.head.querySelector(MANAGED_IMPORT_MAP_SELECTOR)?.nonce;
    let installedImportMap = createInstalledImportMap();
    let processedScripts = new WeakSet();
    let conflicted = false;
    function processImportMap(script) {
        if (processedScripts.has(script))
            return;
        processedScripts.add(script);
        let importMap = parseImportMap(script.textContent ?? '');
        if (importMap)
            installImportMap(installedImportMap, importMap, script.baseURI);
    }
    function processImportMaps() {
        for (let script of doc.querySelectorAll(IMPORT_MAP_SELECTOR)) {
            processImportMap(script);
        }
    }
    function processMutations(mutations) {
        for (let mutation of mutations) {
            if (mutation.type !== 'childList')
                continue;
            for (let node of mutation.addedNodes) {
                if (node instanceof HTMLScriptElement && node.matches(IMPORT_MAP_SELECTOR)) {
                    processImportMap(node);
                }
            }
        }
    }
    let observer = new MutationObserver(processMutations);
    observer.observe(doc, { childList: true });
    observer.observe(doc.head, { childList: true });
    processImportMaps();
    return {
        consumeImportMaps(source) {
            if (conflicted)
                return 'blocked';
            processMutations(observer.takeRecords());
            processImportMaps();
            let scripts = Array.from(source.querySelectorAll(MANAGED_IMPORT_MAP_SELECTOR));
            if (scripts.length === 0)
                return 'ready';
            let pendingImportMap = cloneInstalledImportMap(installedImportMap);
            let deltas = [];
            let baseUrl = doc.baseURI;
            try {
                for (let script of scripts) {
                    let importMap = parseImportMap(script.textContent ?? '');
                    if (!importMap)
                        continue;
                    let delta = installImportMap(pendingImportMap, importMap, baseUrl, cloneInstalledImportMap(pendingImportMap));
                    if (delta)
                        deltas.push(delta);
                }
            }
            catch (error) {
                if (!(error instanceof ImportMapConflictError))
                    throw error;
                console.warn(error.message);
                conflicted = true;
                return 'conflict';
            }
            for (let delta of deltas) {
                let installedScript = appendImportMapScript(doc, delta, nonce);
                processedScripts.add(installedScript);
            }
            installedImportMap = pendingImportMap;
            for (let script of scripts)
                script.remove();
            return 'ready';
        },
        disconnect() {
            observer.disconnect();
        },
        shouldPreserveHeadNode(node) {
            return (node.isConnected &&
                node instanceof HTMLScriptElement &&
                node.matches(MANAGED_IMPORT_MAP_SELECTOR));
        },
    };
}
function createInstalledImportMap() {
    return {
        imports: new Map(),
        scopes: new Map(),
        integrity: new Map(),
    };
}
function cloneInstalledImportMap(importMap) {
    return {
        imports: new Map(importMap.imports),
        scopes: new Map(Array.from(importMap.scopes, ([scope, imports]) => [scope, new Map(imports)])),
        integrity: new Map(importMap.integrity),
    };
}
// Adds entries that are new to `installed` (defaults to `target`) to `target` and returns them.
// When `installed` is passed, entries it already maps to a different value throw a conflict.
function installImportMap(target, importMap, baseUrl, installed) {
    let imports = installImports(target.imports, installed?.imports, importMap.imports, baseUrl);
    let scopes = {};
    for (let [scope, scopeImports] of Object.entries(importMap.scopes ?? {})) {
        let normalizedScope = normalizeImportMapUrl(scope, baseUrl);
        if (normalizedScope === null)
            continue;
        let targetScopeImports = target.scopes.get(normalizedScope);
        if (!targetScopeImports) {
            targetScopeImports = new Map();
            target.scopes.set(normalizedScope, targetScopeImports);
        }
        let importsDelta = installImports(targetScopeImports, installed && (installed.scopes.get(normalizedScope) ?? new Map()), scopeImports, baseUrl, scope);
        if (importsDelta)
            scopes[scope] = importsDelta;
    }
    let integrity = {};
    for (let [url, metadata] of Object.entries(importMap.integrity ?? {})) {
        let normalizedUrl = normalizeImportMapUrl(url, baseUrl);
        if (normalizedUrl === null)
            continue;
        let installedMetadata = (installed ?? target).integrity.get(normalizedUrl);
        if (installedMetadata !== undefined) {
            if (installed && installedMetadata !== metadata) {
                throw new ImportMapConflictError(`[remix] Reloading page after import map integrity conflict for "${url}": ` +
                    `"${installedMetadata}" is already installed, but the new map points to "${metadata}"`);
            }
            continue;
        }
        integrity[url] = metadata;
        if (!target.integrity.has(normalizedUrl))
            target.integrity.set(normalizedUrl, metadata);
    }
    let delta = {};
    if (imports)
        delta.imports = imports;
    if (hasEntries(scopes))
        delta.scopes = scopes;
    if (hasEntries(integrity))
        delta.integrity = integrity;
    return hasEntries(delta) ? delta : undefined;
}
function installImports(target, installed, imports, baseUrl, scope) {
    let delta = {};
    for (let [specifier, href] of Object.entries(imports ?? {})) {
        let normalizedSpecifier = normalizeImportMapSpecifier(specifier, baseUrl);
        if (normalizedSpecifier === null)
            continue;
        let normalizedHref = normalizeImportMapAddress(href, baseUrl);
        let installedEntry = (installed ?? target).get(normalizedSpecifier);
        if (installedEntry) {
            if (installed && installedEntry.normalizedHref !== normalizedHref) {
                let scopeDescription = scope ? ` in scope "${scope}"` : '';
                throw new ImportMapConflictError(`[remix] Reloading page after import map conflict for "${specifier}"${scopeDescription}: ` +
                    `${formatImportMapAddress(installedEntry.href)} is already installed, but the new map points to ${formatImportMapAddress(href)}`);
            }
            continue;
        }
        delta[specifier] = href;
        if (!target.has(normalizedSpecifier))
            target.set(normalizedSpecifier, { href, normalizedHref });
    }
    return hasEntries(delta) ? delta : undefined;
}
function hasEntries(record) {
    return Object.keys(record).length > 0;
}
function appendImportMapScript(doc, importMap, nonce) {
    let script = doc.createElement('script');
    script.setAttribute('data-rmx-import-map', '');
    script.type = 'importmap';
    if (nonce)
        script.nonce = nonce;
    script.textContent = JSON.stringify(importMap);
    doc.head.appendChild(script);
    return script;
}
function parseImportMap(json) {
    let parsed;
    try {
        parsed = JSON.parse(json);
    }
    catch {
        return null;
    }
    if (!parsed || typeof parsed !== 'object')
        return null;
    let importMap = {};
    if ('imports' in parsed) {
        let imports = parsed.imports;
        if (!isImportMapImports(imports))
            return null;
        importMap.imports = imports;
    }
    if ('scopes' in parsed) {
        let scopes = parsed.scopes;
        if (!isScopedImportMapRecord(scopes))
            return null;
        importMap.scopes = scopes;
    }
    if ('integrity' in parsed) {
        let integrity = parsed.integrity;
        if (!isImportMapIntegrity(integrity))
            return null;
        importMap.integrity = integrity;
    }
    return importMap;
}
function isImportMapImports(value) {
    if (!value || typeof value !== 'object')
        return false;
    return Object.values(value).every((entry) => entry === null || typeof entry === 'string');
}
function isScopedImportMapRecord(value) {
    if (!value || typeof value !== 'object')
        return false;
    return Object.values(value).every(isImportMapImports);
}
function isImportMapIntegrity(value) {
    if (!value || typeof value !== 'object')
        return false;
    return Object.values(value).every((entry) => typeof entry === 'string');
}
function normalizeImportMapSpecifier(specifier, baseUrl) {
    if (specifier.startsWith('/') ||
        specifier.startsWith('./') ||
        specifier.startsWith('../') ||
        URL.canParse(specifier)) {
        return normalizeImportMapUrl(specifier, baseUrl);
    }
    return specifier;
}
function normalizeImportMapAddress(address, baseUrl) {
    if (address === null)
        return null;
    return normalizeImportMapUrl(address, baseUrl);
}
function normalizeImportMapUrl(value, baseUrl) {
    try {
        return new URL(value, baseUrl).href;
    }
    catch {
        return null;
    }
}
function formatImportMapAddress(address) {
    return address === null ? 'null' : `"${address}"`;
}
//# sourceMappingURL=import-map-manager.js.map
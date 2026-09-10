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
            mergeInstalledImportMap(installedImportMap, importMap, script.baseURI);
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
            let pendingImportMap = {
                imports: new Map(installedImportMap.imports),
                scopes: new Map(Array.from(installedImportMap.scopes, ([scope, imports]) => [scope, new Map(imports)])),
                integrity: new Map(installedImportMap.integrity),
            };
            let deltas = [];
            let baseUrl = doc.baseURI;
            try {
                for (let script of scripts) {
                    let importMap = parseImportMap(script.textContent ?? '');
                    if (!importMap)
                        continue;
                    let delta = getImportMapDelta(pendingImportMap, importMap, baseUrl);
                    if (delta) {
                        deltas.push(delta);
                        mergeInstalledImportMap(pendingImportMap, delta, baseUrl);
                    }
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
function getImportMapDelta(installedImportMap, importMap, baseUrl) {
    let imports = getImportMapImportsDelta(installedImportMap.imports, importMap.imports, baseUrl);
    let scopes = getImportMapScopesDelta(installedImportMap, importMap.scopes, baseUrl);
    let integrity = getImportMapIntegrityDelta(installedImportMap.integrity, importMap.integrity, baseUrl);
    if (!imports && !scopes && !integrity)
        return undefined;
    return {
        ...(imports ? { imports } : null),
        ...(scopes ? { scopes } : null),
        ...(integrity ? { integrity } : null),
    };
}
function getImportMapImportsDelta(installedImports, imports, baseUrl, scope) {
    if (!imports)
        return undefined;
    let delta = {};
    for (let [specifier, href] of Object.entries(imports)) {
        let normalizedSpecifier = normalizeImportMapSpecifier(specifier, baseUrl);
        if (normalizedSpecifier === null)
            continue;
        let normalizedHref = normalizeImportMapAddress(href, baseUrl);
        let installedEntry = installedImports.get(normalizedSpecifier);
        if (installedEntry?.normalizedHref === normalizedHref)
            continue;
        if (installedEntry) {
            let scopeDescription = scope ? ` in scope "${scope}"` : '';
            throw new ImportMapConflictError(`[remix] Reloading page after import map conflict for "${specifier}"${scopeDescription}: ` +
                `${formatImportMapAddress(installedEntry.href)} is already installed, but the new map points to ${formatImportMapAddress(href)}`);
        }
        delta[specifier] = href;
    }
    return Object.keys(delta).length > 0 ? delta : undefined;
}
function getImportMapScopesDelta(installedImportMap, scopes, baseUrl) {
    if (!scopes)
        return undefined;
    let delta = {};
    for (let [scope, imports] of Object.entries(scopes)) {
        let normalizedScope = normalizeImportMapUrl(scope, baseUrl);
        if (normalizedScope === null)
            continue;
        let installedScopeImports = installedImportMap.scopes.get(normalizedScope) ?? new Map();
        let importsDelta = getImportMapImportsDelta(installedScopeImports, imports, baseUrl, scope);
        if (importsDelta)
            delta[scope] = importsDelta;
    }
    return Object.keys(delta).length > 0 ? delta : undefined;
}
function getImportMapIntegrityDelta(installedIntegrity, integrity, baseUrl) {
    if (!integrity)
        return undefined;
    let delta = {};
    for (let [url, metadata] of Object.entries(integrity)) {
        let normalizedUrl = normalizeImportMapUrl(url, baseUrl);
        if (normalizedUrl === null)
            continue;
        let installedMetadata = installedIntegrity.get(normalizedUrl);
        if (installedMetadata === metadata)
            continue;
        if (installedMetadata !== undefined) {
            throw new ImportMapConflictError(`[remix] Reloading page after import map integrity conflict for "${url}": ` +
                `"${installedMetadata}" is already installed, but the new map points to "${metadata}"`);
        }
        delta[url] = metadata;
    }
    return Object.keys(delta).length > 0 ? delta : undefined;
}
function mergeInstalledImportMap(installedImportMap, importMap, baseUrl) {
    mergeInstalledImports(installedImportMap.imports, importMap.imports, baseUrl);
    if (importMap.scopes) {
        for (let [scope, imports] of Object.entries(importMap.scopes)) {
            let normalizedScope = normalizeImportMapUrl(scope, baseUrl);
            if (normalizedScope === null)
                continue;
            let installedScopeImports = installedImportMap.scopes.get(normalizedScope);
            if (!installedScopeImports) {
                installedScopeImports = new Map();
                installedImportMap.scopes.set(normalizedScope, installedScopeImports);
            }
            mergeInstalledImports(installedScopeImports, imports, baseUrl);
        }
    }
    if (importMap.integrity) {
        for (let [url, metadata] of Object.entries(importMap.integrity)) {
            let normalizedUrl = normalizeImportMapUrl(url, baseUrl);
            if (normalizedUrl === null || installedImportMap.integrity.has(normalizedUrl))
                continue;
            installedImportMap.integrity.set(normalizedUrl, metadata);
        }
    }
}
function mergeInstalledImports(installed, imports, baseUrl) {
    for (let [specifier, href] of Object.entries(imports ?? {})) {
        let normalizedSpecifier = normalizeImportMapSpecifier(specifier, baseUrl);
        if (normalizedSpecifier === null || installed.has(normalizedSpecifier))
            continue;
        installed.set(normalizedSpecifier, {
            href,
            normalizedHref: normalizeImportMapAddress(href, baseUrl),
        });
    }
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
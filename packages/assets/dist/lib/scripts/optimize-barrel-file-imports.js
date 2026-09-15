import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseSync } from 'oxc-parser';
import picomatch from 'picomatch';
export function createBarrelFileImportOptimizer() {
    let analysisCache = new WeakMap();
    return function optimizeBarrelFileImports(graph) {
        let sideEffectsCache = new Map();
        let rewrittenModules = new Map();
        for (let module of graph.values()) {
            let analysis = getExportAnalysis(module, analysisCache);
            let importRewrites = [];
            let replacedImports = new Set();
            for (let group of getImportDeclarationGroups(module, analysis.importDeclarations)) {
                let importedModule = graph.get(group.depPath);
                if (!importedModule)
                    continue;
                if (!getExportAnalysis(importedModule, analysisCache).isBarrelFile)
                    continue;
                let resolvedBindingsByDeclaration = new Map();
                let unresolved = false;
                for (let declaration of group.declarations) {
                    let resolvedBindings = [];
                    for (let binding of declaration.bindings) {
                        let resolution = resolveExport(importedModule.identityPath, binding.importedName, graph, analysisCache, new Set());
                        if (!resolution) {
                            unresolved = true;
                            break;
                        }
                        resolvedBindings.push({ ...binding, ...resolution });
                    }
                    if (unresolved)
                        break;
                    resolvedBindingsByDeclaration.set(declaration, resolvedBindings);
                }
                let resolvedBindings = [...resolvedBindingsByDeclaration.values()].flat();
                if (unresolved || resolvedBindings.length === 0)
                    continue;
                if (resolvedBindings.every((binding) => binding.depPath === importedModule.identityPath)) {
                    continue;
                }
                let targetPaths = [...new Set(resolvedBindings.map((binding) => binding.depPath))];
                if (!canOptimizeBarrelFileImport(module.identityPath, importedModule.identityPath, targetPaths, resolvedBindings.flatMap((binding) => binding.barrelFilePaths), graph, sideEffectsCache)) {
                    continue;
                }
                let replacementImportPaths = getReplacementImportPaths(importedModule.identityPath, targetPaths, graph);
                let [firstDeclaration, ...remainingDeclarations] = group.declarations;
                let firstBindings = resolvedBindingsByDeclaration.get(firstDeclaration) ?? [];
                importRewrites.push({
                    end: firstDeclaration.end,
                    // This first request originally evaluated the complete barrel file graph. Request every
                    // retained module needed to preserve that order, using authored bindings when possible.
                    imports: replacementImportPaths.map((depPath) => ({
                        depPath,
                        sourceStart: firstDeclaration.imported.start,
                        specifiers: getImportSpecifiers(firstBindings, depPath),
                    })),
                    start: firstDeclaration.start,
                });
                for (let declaration of remainingDeclarations) {
                    let bindings = resolvedBindingsByDeclaration.get(declaration) ?? [];
                    importRewrites.push({
                        end: declaration.end,
                        imports: replacementImportPaths.flatMap((depPath) => {
                            let specifiers = getImportSpecifiers(bindings, depPath);
                            return specifiers.length > 0
                                ? [{ depPath, sourceStart: declaration.imported.start, specifiers }]
                                : [];
                        }),
                        start: declaration.start,
                    });
                }
                for (let declaration of group.declarations) {
                    replacedImports.add(declaration.imported);
                }
            }
            if (importRewrites.length === 0) {
                continue;
            }
            importRewrites.sort((left, right) => left.start - right.start);
            let runtimeImports = module.imports.filter((imported) => !replacedImports.has(imported));
            let runtimeDependencies = runtimeImports.map((imported) => ({
                depPath: imported.depPath,
                dynamic: imported.dynamic === true,
                order: 0,
                start: imported.start,
            }));
            for (let rewrite of importRewrites) {
                for (let order = 0; order < rewrite.imports.length; order++) {
                    let imported = rewrite.imports[order];
                    runtimeDependencies.push({
                        depPath: imported.depPath,
                        dynamic: false,
                        order,
                        start: rewrite.start,
                    });
                }
            }
            runtimeDependencies.sort((left, right) => left.start - right.start || left.order - right.order);
            let remainingDeps = new Set(runtimeDependencies.map((dependency) => dependency.depPath));
            let remainingStaticDeps = new Set(runtimeDependencies
                .filter((dependency) => !dependency.dynamic)
                .map((dependency) => dependency.depPath));
            rewrittenModules.set(module.identityPath, {
                ...module,
                deps: [...remainingDeps],
                importRewrites,
                runtimeImports,
                staticDeps: [...remainingStaticDeps],
            });
        }
        return rewrittenModules;
    };
}
function getImportSpecifiers(bindings, depPath) {
    return bindings
        .filter((binding) => binding.depPath === depPath)
        .map((binding) => ({
        authoredImportedName: binding.authoredImportedName,
        importedName: binding.importedName,
        importedStart: binding.importedStart,
        localName: binding.localName,
        localStart: binding.localStart,
    }));
}
function getImportDeclarationGroups(module, declarations) {
    let groupsByDepPath = new Map();
    let supportedImports = new Set();
    for (let declaration of declarations) {
        let depPath = declaration.imported.depPath;
        let group = groupsByDepPath.get(depPath);
        if (group) {
            group.declarations.push(declaration);
        }
        else {
            groupsByDepPath.set(depPath, { declarations: [declaration], depPath });
        }
        supportedImports.add(declaration.imported);
    }
    // A module is evaluated at its first static request. Rewriting only the supported named
    // imports would move evaluation past an earlier side-effect, default, namespace, attributed,
    // or re-export request for the same module.
    for (let imported of module.imports) {
        if (!imported.dynamic && !supportedImports.has(imported)) {
            groupsByDepPath.delete(imported.depPath);
        }
    }
    return [...groupsByDepPath.values()];
}
function getReplacementImportPaths(barrelFilePath, targetPaths, graph) {
    let retained = getStaticallyReachableModules(targetPaths, graph);
    let replacementImports = [];
    let requested = new Set();
    let evaluated = new Set();
    let visited = new Set();
    function markEvaluated(identityPath) {
        let queue = [identityPath];
        while (queue.length > 0) {
            let currentPath = queue.pop();
            if (!currentPath || evaluated.has(currentPath))
                continue;
            let module = graph.get(currentPath);
            if (!module)
                continue;
            evaluated.add(currentPath);
            queue.push(...module.staticDeps);
        }
    }
    function visit(identityPath) {
        if (visited.has(identityPath))
            return;
        visited.add(identityPath);
        if (retained.has(identityPath)) {
            // A removed branch may have evaluated a retained dependency before the target that still
            // reaches it. Preserve that first request without retaining the intermediary barrel files.
            if (!evaluated.has(identityPath) && !requested.has(identityPath)) {
                replacementImports.push(identityPath);
                requested.add(identityPath);
            }
            markEvaluated(identityPath);
            return;
        }
        let module = graph.get(identityPath);
        if (!module)
            return;
        // Import specifier order does not control ESM evaluation. Follow the original module
        // requests so split declarations retain the barrel file graph's dependency order.
        for (let imported of module.imports) {
            if (!imported.dynamic)
                visit(imported.depPath);
        }
    }
    visit(barrelFilePath);
    // A target can be evaluated transitively by an earlier replacement import, but it still needs
    // a direct import for its rewritten bindings.
    for (let targetPath of targetPaths) {
        if (!requested.has(targetPath))
            replacementImports.push(targetPath);
    }
    return replacementImports;
}
function canOptimizeBarrelFileImport(importerPath, barrelFilePath, targetPaths, barrelFilePaths, graph, sideEffectsCache) {
    let retained = getStaticallyReachableModules(targetPaths, graph);
    let barrelFileGraph = getStaticallyReachableModules([barrelFilePath], graph);
    // Bypassing a barrel file within the importer's cycle can move another branch past the
    // importer's initialization, changing live binding and temporal dead zone behavior.
    if (barrelFileGraph.has(importerPath))
        return false;
    // Entering the same cycle through a target instead of the original import can change
    // initialization order.
    if (barrelFilePaths.some((modulePath) => retained.has(modulePath)))
        return false;
    for (let module of barrelFileGraph.values()) {
        if (retained.has(module.identityPath))
            continue;
        if (!isSideEffectFree(module, sideEffectsCache))
            return false;
    }
    return true;
}
function getStaticallyReachableModules(roots, graph) {
    let reachable = new Map();
    let queue = [...roots];
    while (queue.length > 0) {
        let identityPath = queue.pop();
        if (!identityPath || reachable.has(identityPath))
            continue;
        let module = graph.get(identityPath);
        if (!module)
            continue;
        reachable.set(identityPath, module);
        queue.push(...module.staticDeps);
    }
    return reachable;
}
function isSideEffectFree(module, cache) {
    let packageJsonPath = module.packageJsonPath;
    if (!packageJsonPath)
        return false;
    let sideEffects = cache.get(packageJsonPath);
    if (sideEffects === undefined) {
        sideEffects = readSideEffects(packageJsonPath);
        cache.set(packageJsonPath, sideEffects);
    }
    if (sideEffects === false)
        return true;
    if (!Array.isArray(sideEffects))
        return false;
    let packageRoot = path.dirname(packageJsonPath);
    let relativePath = path.relative(packageRoot, module.resolvedPath).replaceAll('\\', '/');
    return !sideEffects.some((pattern) => {
        let normalizedPattern = pattern.startsWith('./') ? pattern.slice(2) : pattern;
        try {
            return picomatch.isMatch(relativePath, normalizedPattern, {
                basename: !pattern.replaceAll('\\', '/').includes('/'),
                dot: true,
            });
        }
        catch {
            return true;
        }
    });
}
function readSideEffects(packageJsonPath) {
    try {
        let packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        if (packageJson === null ||
            typeof packageJson !== 'object' ||
            !('sideEffects' in packageJson)) {
            return null;
        }
        let sideEffects = packageJson.sideEffects;
        if (typeof sideEffects === 'boolean')
            return sideEffects;
        if (Array.isArray(sideEffects) &&
            sideEffects.every((pattern) => typeof pattern === 'string')) {
            return sideEffects;
        }
    }
    catch { }
    return null;
}
function getExportAnalysis(module, cache) {
    let cached = cache.get(module);
    if (cached)
        return cached;
    let parseResult = parseSync(module.resolvedPath, module.rawCode, {
        lang: 'js',
        sourceType: 'module',
    });
    let explicit = new Map();
    let importDeclarations = [];
    let importedLocals = new Map();
    let reexportedLocals = new Set();
    let stars = [];
    let isBarrelFile = parseResult.errors.length === 0 && parseResult.program.body.length > 0;
    for (let statement of parseResult.program.body) {
        if (statement.type === 'ImportDeclaration') {
            let imported = findResolvedImport(module.imports, statement.source.start, statement.source.end);
            let bindings = [];
            for (let specifier of statement.specifiers) {
                if (specifier.type !== 'ImportSpecifier' ||
                    specifier.imported.type !== 'Identifier' ||
                    specifier.local.type !== 'Identifier') {
                    bindings = [];
                    break;
                }
                bindings.push({
                    authoredImportedName: specifier.imported.name,
                    importedName: specifier.imported.name,
                    importedStart: specifier.imported.start,
                    localName: specifier.local.name,
                    localStart: specifier.local.start,
                });
            }
            if (imported &&
                statement.attributes.length === 0 &&
                bindings.length === statement.specifiers.length &&
                bindings.length > 0) {
                importDeclarations.push({
                    bindings,
                    end: statement.end,
                    imported,
                    start: statement.start,
                });
                for (let binding of bindings) {
                    importedLocals.set(binding.localName, {
                        depPath: imported.depPath,
                        importedName: binding.importedName,
                    });
                }
            }
            else {
                isBarrelFile = false;
            }
            continue;
        }
        if (statement.type === 'ExportNamedDeclaration' && !statement.source) {
            if (statement.specifiers.length === 0) {
                isBarrelFile = false;
                continue;
            }
            for (let specifier of statement.specifiers) {
                if (specifier.type !== 'ExportSpecifier' ||
                    specifier.local.type !== 'Identifier' ||
                    specifier.exported.type !== 'Identifier') {
                    isBarrelFile = false;
                    continue;
                }
                let imported = importedLocals.get(specifier.local.name);
                if (!imported) {
                    isBarrelFile = false;
                    continue;
                }
                explicit.set(specifier.exported.name, imported);
                reexportedLocals.add(specifier.local.name);
            }
            continue;
        }
        if (statement.type === 'ExportNamedDeclaration' && statement.source) {
            if (statement.attributes.length > 0) {
                isBarrelFile = false;
                continue;
            }
            let imported = findResolvedImport(module.imports, statement.source.start, statement.source.end);
            if (!imported) {
                isBarrelFile = false;
                continue;
            }
            for (let specifier of statement.specifiers) {
                if (specifier.type !== 'ExportSpecifier' ||
                    specifier.local.type !== 'Identifier' ||
                    specifier.exported.type !== 'Identifier') {
                    isBarrelFile = false;
                    continue;
                }
                explicit.set(specifier.exported.name, {
                    depPath: imported.depPath,
                    importedName: specifier.local.name,
                });
            }
            continue;
        }
        if (statement.type === 'ExportAllDeclaration' && statement.exported === null) {
            if (statement.attributes.length > 0) {
                isBarrelFile = false;
                continue;
            }
            let imported = findResolvedImport(module.imports, statement.source.start, statement.source.end);
            if (imported) {
                stars.push(imported.depPath);
            }
            else {
                isBarrelFile = false;
            }
            continue;
        }
        isBarrelFile = false;
    }
    if ([...importedLocals.keys()].some((localName) => !reexportedLocals.has(localName))) {
        isBarrelFile = false;
    }
    let analysis = { explicit, importDeclarations, isBarrelFile, stars };
    cache.set(module, analysis);
    return analysis;
}
function findResolvedImport(imports, sourceStart, sourceEnd) {
    return imports.find((imported) => imported.start === sourceStart + 1 && imported.end === sourceEnd - 1);
}
function resolveExport(identityPath, exportedName, graph, cache, seen) {
    let key = `${identityPath}\0${exportedName}`;
    if (seen.has(key))
        return null;
    seen.add(key);
    let module = graph.get(identityPath);
    if (!module)
        return null;
    let analysis = getExportAnalysis(module, cache);
    if (!analysis.isBarrelFile) {
        return { depPath: identityPath, importedName: exportedName, barrelFilePaths: [] };
    }
    let explicit = analysis.explicit.get(exportedName);
    if (explicit) {
        let resolution = resolveExport(explicit.depPath, explicit.importedName, graph, cache, seen);
        return resolution
            ? {
                ...resolution,
                barrelFilePaths: [identityPath, ...resolution.barrelFilePaths],
            }
            : null;
    }
    if (exportedName === 'default')
        return null;
    let resolution = null;
    for (let depPath of analysis.stars) {
        let candidate = resolveExport(depPath, exportedName, graph, cache, new Set(seen));
        if (!candidate)
            continue;
        candidate = {
            ...candidate,
            barrelFilePaths: [identityPath, ...candidate.barrelFilePaths],
        };
        if (!resolution) {
            resolution = candidate;
            continue;
        }
        if (resolution.depPath !== candidate.depPath ||
            resolution.importedName !== candidate.importedName) {
            return null;
        }
        resolution = {
            ...resolution,
            barrelFilePaths: [...resolution.barrelFilePaths, ...candidate.barrelFilePaths],
        };
    }
    return resolution;
}

import MagicString from 'magic-string';
import { parseSync } from 'oxc-parser';
import { SourceMapConsumer, SourceMapGenerator, } from 'source-map-js/source-map.js';
/**
 * Rewrites browser Remix UI component modules to keep component identity stable across HMR updates.
 *
 * @param source Component module source code.
 * @param options Browser transform options.
 * @returns The rewritten module source and metadata about transformed component exports.
 */
export function transformComponentsForBrowser(source, options) {
    let ast = parseModule(source);
    if (!ast)
        return createUnchangedResult(source);
    let matchResult = findMatches(ast, source);
    if (!isSafeComponentHmrBoundary(matchResult)) {
        return createUnchangedResult(source);
    }
    let { componentMatches, clientEntryMatches, runtimeExports } = matchResult;
    let importSpecifiers = getUiHmrImportSpecifiers(options.importSource);
    let rewritten = new MagicString(source);
    let componentNames = [];
    let sourceMapHints = [];
    for (let match of componentMatches) {
        componentNames.push(match.name);
        let implementation = createHmrImplementationBody(match, source, options.moduleUrl);
        let implementationName = `__remixHmrImpl_${match.name}__`;
        let exportPrefix = match.directExport ? 'export ' : '';
        let replacement = [
            `function ${implementationName}(${match.params}) ${implementation.body}`,
            `${exportPrefix}function ${match.name}(${match.params}) {`,
            `  return __remixHmr__.getCurrentComponentForHmr(${JSON.stringify(options.moduleUrl)}, ${JSON.stringify(match.name)}).apply(undefined, arguments);`,
            `}`,
            `__remixHmr__.registerComponentForHmr(__remixUIRefresh__, ${JSON.stringify(options.moduleUrl)}, ${JSON.stringify(match.name)}, ${implementationName}, ${JSON.stringify(match.setupHash)}, ${match.name});`,
        ].join('\n');
        sourceMapHints.push(...implementation.sourceMapHints);
        rewritten.overwrite(match.fullStart, match.fullEnd, replacement);
    }
    for (let match of clientEntryMatches) {
        componentNames.push(match.name);
        let implementation = createHmrImplementationBody(match, source, options.moduleUrl);
        let implementationName = `__remixHmrImpl_${match.name}__`;
        let wrapperSource = [
            `function ${match.functionName}(${match.params}) {`,
            `  return __remixHmr__.getCurrentComponentForHmr(${JSON.stringify(options.moduleUrl)}, ${JSON.stringify(match.name)}).apply(undefined, arguments);`,
            `}`,
        ].join('\n');
        rewritten.prependLeft(match.statementStart, `function ${implementationName}(${match.params}) ${implementation.body}\n`);
        sourceMapHints.push(...implementation.sourceMapHints);
        rewritten.overwrite(match.functionStart, match.functionEnd, wrapperSource);
        rewritten.appendLeft(match.statementEnd, `\n__remixHmr__.registerComponentForHmr(__remixUIRefresh__, ${JSON.stringify(options.moduleUrl)}, ${JSON.stringify(match.name)}, ${implementationName}, ${JSON.stringify(match.setupHash)}, ${match.name});`);
    }
    rewritten.prepend([
        `import { __uiHmrBrowserRuntime__ as __remixHmr__ } from ${JSON.stringify(importSpecifiers.browserRuntimeSpecifier)};`,
        `import * as __remixUIRefresh__ from ${JSON.stringify(importSpecifiers.refreshSpecifier)};`,
        ``,
    ].join('\n'));
    rewritten.append([
        ``,
        `if (import.meta.hot) {`,
        `  let __remixHmrAcceptComponentModule__ = ${createComponentNamesCheckSource(options.moduleUrl, componentNames, {
            invalidateOnMismatch: false,
            spaces: 0,
        })};`,
        `  let __remixHmrComponentExportNames__ = ${JSON.stringify(componentNames)};`,
        `  let __remixHmrRuntimeExports__ = ${createRuntimeExportsSource(runtimeExports)};`,
        `  import.meta.hot.accept((module) => {`,
        `    if (!__remixHmrAcceptComponentModule__) return;`,
        `    if (module && typeof module === 'object') {`,
        `      let __remixHmrInvalidationMessage__ = ${createRuntimeExportsCheckSource('module', '__remixHmrRuntimeExports__', '__remixHmrComponentExportNames__')};`,
        `      if (__remixHmrInvalidationMessage__) {`,
        `        import.meta.hot.invalidate(__remixHmrInvalidationMessage__);`,
        `        return;`,
        `      }`,
        `      __remixHmr__.updateComponentModuleForHmr(__remixUIRefresh__, ${JSON.stringify(options.moduleUrl)}, module);`,
        `    } else {`,
        `      import.meta.hot.invalidate('Updated component module did not evaluate to an object');`,
        `    }`,
        `  });`,
        `}`,
    ].join('\n'));
    let code = rewritten.toString();
    return {
        code,
        componentNames,
        map: options.sourceMap
            ? generateSourceMap(rewritten, code, source, options.moduleUrl, sourceMapHints)
            : null,
        transformed: true,
    };
}
/**
 * Rewrites server Remix UI component modules to keep component identity stable across HMR updates.
 *
 * @param source Component module source code.
 * @param options Server transform options.
 * @returns The rewritten module source and metadata about transformed component exports.
 */
export function transformComponentsForServer(source, options) {
    let ast = parseModule(source);
    if (!ast)
        return createUnchangedResult(source);
    let matchResult = findMatches(ast, source);
    if (!isSafeComponentHmrBoundary(matchResult)) {
        return createUnchangedResult(source);
    }
    let { componentMatches, clientEntryMatches, runtimeExports } = matchResult;
    let importSpecifiers = getUiHmrImportSpecifiers(options.importSource);
    let rewritten = new MagicString(source);
    let componentNames = [];
    let sourceMapHints = [];
    for (let match of componentMatches) {
        componentNames.push(match.name);
        let implementationName = `__remixHmrImpl_${match.name}__`;
        let exportPrefix = match.directExport ? 'export ' : '';
        let bodySource = source.slice(match.bodyStart, match.bodyEnd);
        let replacement = [
            `function ${implementationName}(${match.params}) ${bodySource}`,
            `${exportPrefix}function ${match.name}(${match.params}) {`,
            `  return __remixHmr__.getCurrentComponentForHmr(${JSON.stringify(options.moduleUrl)}, ${JSON.stringify(match.name)}).apply(undefined, arguments);`,
            `}`,
            `__remixHmr__.registerComponentForHmr(${JSON.stringify(options.moduleUrl)}, ${JSON.stringify(match.name)}, ${implementationName});`,
        ].join('\n');
        sourceMapHints.push({
            generatedSnippet: bodySource,
            originalSnippet: bodySource,
            originalStart: match.bodyStart,
        });
        rewritten.overwrite(match.fullStart, match.fullEnd, replacement);
    }
    for (let match of clientEntryMatches) {
        componentNames.push(match.name);
        let implementationName = `__remixHmrImpl_${match.name}__`;
        let bodySource = source.slice(match.bodyStart, match.bodyEnd);
        let wrapperSource = [
            `function ${match.functionName}(${match.params}) {`,
            `  return __remixHmr__.getCurrentComponentForHmr(${JSON.stringify(options.moduleUrl)}, ${JSON.stringify(match.name)}).apply(undefined, arguments);`,
            `}`,
        ].join('\n');
        rewritten.prependLeft(match.statementStart, `function ${implementationName}(${match.params}) ${bodySource}\n`);
        sourceMapHints.push({
            generatedSnippet: bodySource,
            originalSnippet: bodySource,
            originalStart: match.bodyStart,
        });
        rewritten.overwrite(match.functionStart, match.functionEnd, wrapperSource);
        rewritten.appendLeft(match.statementEnd, `\n__remixHmr__.registerComponentForHmr(${JSON.stringify(options.moduleUrl)}, ${JSON.stringify(match.name)}, ${implementationName});`);
    }
    rewritten.prepend([
        `import { __uiHmrServerRuntime__ as __remixHmr__ } from ${JSON.stringify(importSpecifiers.serverRuntimeSpecifier)};`,
        ``,
    ].join('\n'));
    rewritten.append([
        ``,
        `if (import.meta.hot) {`,
        `  let __remixHmrAcceptComponentModule__ = ${createComponentNamesCheckSource(options.moduleUrl, componentNames, {
            invalidateOnMismatch: false,
            spaces: 0,
        })};`,
        `  let __remixHmrComponentExportNames__ = ${JSON.stringify(componentNames)};`,
        `  let __remixHmrRuntimeExports__ = ${createRuntimeExportsSource(runtimeExports)};`,
        `  import.meta.hot.accept((module) => {`,
        `    if (!__remixHmrAcceptComponentModule__) return;`,
        `    if (!module || typeof module !== 'object') {`,
        `      import.meta.hot.invalidate('Updated component module did not evaluate to an object');`,
        `      return;`,
        `    }`,
        `    let __remixHmrInvalidationMessage__ = ${createRuntimeExportsCheckSource('module', '__remixHmrRuntimeExports__', '__remixHmrComponentExportNames__')};`,
        `    if (__remixHmrInvalidationMessage__) {`,
        `      import.meta.hot.invalidate(__remixHmrInvalidationMessage__);`,
        `    }`,
        `  });`,
        `}`,
    ].join('\n'));
    let code = rewritten.toString();
    return {
        code,
        componentNames,
        map: options.sourceMap
            ? generateSourceMap(rewritten, code, source, options.moduleUrl, sourceMapHints)
            : null,
        transformed: true,
    };
}
function getUiHmrImportSpecifiers(importSource) {
    return {
        browserRuntimeSpecifier: `${importSource}/ui-hmr/browser-runtime`,
        refreshSpecifier: `${importSource}/ui/dev/refresh`,
        serverRuntimeSpecifier: `${importSource}/ui-hmr/server-runtime`,
    };
}
function generateSourceMap(rewritten, code, source, sourceName, hints) {
    let sourceMap = rewritten.generateMap({
        hires: true,
        includeContent: true,
        source: sourceName,
    });
    if (hints.length === 0)
        return sourceMap.toString();
    let consumer = new SourceMapConsumer(JSON.parse(sourceMap.toString()));
    let generator = SourceMapGenerator.fromSourceMap(consumer);
    let generatedSearchStart = 0;
    for (let hint of hints) {
        let generatedStart = code.indexOf(hint.generatedSnippet, generatedSearchStart);
        if (generatedStart === -1) {
            generatedStart = code.indexOf(hint.generatedSnippet);
        }
        if (generatedStart === -1)
            continue;
        addSourceMapHint(generator, code, source, sourceName, hint, generatedStart);
        generatedSearchStart = generatedStart + hint.generatedSnippet.length;
    }
    return JSON.stringify(generator.toJSON());
}
function addSourceMapHint(generator, generatedSource, originalSource, sourceName, hint, generatedStart) {
    let generatedLines = hint.generatedSnippet.split('\n');
    let originalLines = hint.originalSnippet.split('\n');
    let generatedOffset = 0;
    let originalOffset = 0;
    for (let index = 0; index < Math.min(generatedLines.length, originalLines.length); index++) {
        let generatedLine = generatedLines[index] ?? '';
        let originalLine = originalLines[index] ?? '';
        let columns = Math.min(generatedLine.length, originalLine.length);
        for (let column = 0; column < columns; column++) {
            if (generatedLine[column] !== originalLine[column])
                continue;
            generator.addMapping({
                generated: getLineAndColumnAtIndex(generatedSource, generatedStart + generatedOffset + column),
                original: getLineAndColumnAtIndex(originalSource, hint.originalStart + originalOffset + column),
                source: sourceName,
            });
        }
        generatedOffset += generatedLine.length + 1;
        originalOffset += originalLine.length + 1;
    }
    generator.setSourceContent(sourceName, originalSource);
}
function getLineAndColumnAtIndex(source, index) {
    let lines = source.slice(0, index).split('\n');
    return {
        column: lines.at(-1)?.length ?? 0,
        line: lines.length,
    };
}
function parseModule(source) {
    try {
        let result = parseSync('module.tsx', source, {
            lang: 'tsx',
            sourceType: 'module',
        });
        return isAstNode(result.program) ? result.program : null;
    }
    catch {
        return null;
    }
}
function createUnchangedResult(source) {
    return {
        code: source,
        componentNames: [],
        map: null,
        transformed: false,
    };
}
function findMatches(program, source) {
    let runtimeExports = getRuntimeExports(program);
    let exportedNames = getExportedNames(program);
    let unsafeRuntimeExports = hasUnsafeRuntimeExports(program);
    let componentMatches = [];
    let clientEntryMatches = [];
    for (let item of getNodeArray(program, 'body')) {
        let exportDeclaration = getExportDeclaration(item);
        let statement = exportDeclaration ?? item;
        let directExport = exportDeclaration !== null;
        if (statement.type === 'FunctionDeclaration') {
            let match = getFunctionDeclarationMatch(statement, source, {
                directExport,
                exportedNames,
                fullEnd: directExport ? item.end : statement.end,
                fullStart: directExport ? item.start : statement.start,
            });
            if (match)
                componentMatches.push(match);
            continue;
        }
        if (statement.type !== 'VariableDeclaration')
            continue;
        for (let declaration of getNodeArray(statement, 'declarations')) {
            let clientEntryMatch = getClientEntryMatch(declaration, source, {
                directExport,
                exportedNames,
                statementEnd: directExport ? item.end : statement.end,
                statementStart: directExport ? item.start : statement.start,
            });
            if (clientEntryMatch) {
                clientEntryMatches.push(clientEntryMatch);
                continue;
            }
            let componentMatch = getVariableComponentMatch(declaration, source, {
                directExport,
                exportedNames,
                fullEnd: directExport ? item.end : statement.end,
                fullStart: directExport ? item.start : statement.start,
            });
            if (componentMatch)
                componentMatches.push(componentMatch);
        }
    }
    componentMatches = componentMatches.filter((match) => !clientEntryMatches.some((clientEntryMatch) => match.fullStart >= clientEntryMatch.functionStart &&
        match.fullEnd <= clientEntryMatch.functionEnd));
    return {
        componentMatches,
        clientEntryMatches,
        runtimeExports,
        unsafeRuntimeExports,
    };
}
function isSafeComponentHmrBoundary(matchResult) {
    if (matchResult.unsafeRuntimeExports)
        return false;
    return matchResult.componentMatches.length > 0 || matchResult.clientEntryMatches.length > 0;
}
function createComponentNamesCheckSource(moduleUrl, componentNames, options) {
    let indent = ' '.repeat(options.spaces);
    let lines = [
        `${indent}let __remixHmrComponentNames__ = ${JSON.stringify(componentNames)};`,
        `${indent}let __remixHmrPreviousComponentNames__ = import.meta.hot.data.componentNamesByModuleUrl?.[${JSON.stringify(moduleUrl)}];`,
        `${indent}if (__remixHmrPreviousComponentNames__ && (__remixHmrPreviousComponentNames__.length !== __remixHmrComponentNames__.length || __remixHmrPreviousComponentNames__.some((name, index) => name !== __remixHmrComponentNames__[index]))) {`,
        ...(options.invalidateOnMismatch === false
            ? []
            : [`${indent}  import.meta.hot.invalidate('Updated component module changed its exports');`]),
        `${indent}  return false;`,
        `${indent}}`,
        `${indent}import.meta.hot.data.componentNamesByModuleUrl = {`,
        `${indent}  ...import.meta.hot.data.componentNamesByModuleUrl,`,
        `${indent}  [${JSON.stringify(moduleUrl)}]: __remixHmrComponentNames__,`,
        `${indent}};`,
        `${indent}return true;`,
    ];
    lines.unshift(`(() => {`);
    lines.push(`})()`);
    return lines.join('\n');
}
function createRuntimeExportsSource(runtimeExports) {
    if (runtimeExports.length === 0)
        return `{}`;
    return [
        `{`,
        ...runtimeExports.map((runtimeExport) => `  ${JSON.stringify(runtimeExport.exportedName)}: ${runtimeExport.localName},`),
        `}`,
    ].join('\n');
}
function createRuntimeExportsCheckSource(nextExportsName, previousExportsName, componentExportNamesName) {
    return [
        `(() => {`,
        `  let __remixHmrPreviousExportNames__ = Object.keys(${previousExportsName});`,
        `  for (let name of __remixHmrPreviousExportNames__) {`,
        `    if (!Object.prototype.hasOwnProperty.call(${nextExportsName}, name)) {`,
        `      return 'Updated component module removed export "' + name + '"';`,
        `    }`,
        `  }`,
        `  for (let name of Object.keys(${nextExportsName})) {`,
        `    if (!Object.prototype.hasOwnProperty.call(${previousExportsName}, name)) {`,
        `      return 'Updated component module added export "' + name + '"';`,
        `    }`,
        `  }`,
        `  for (let name of __remixHmrPreviousExportNames__) {`,
        `    if (${componentExportNamesName}.includes(name)) continue;`,
        `    if (${previousExportsName}[name] !== ${nextExportsName}[name]) {`,
        `      return 'Updated component module changed non-component export "' + name + '"';`,
        `    }`,
        `  }`,
        `  return null;`,
        `})()`,
    ].join('\n');
}
function getFunctionDeclarationMatch(node, source, options) {
    let name = getIdentifierName(getNode(node, 'id'));
    if (!isComponentExport(name, options))
        return null;
    return createComponentMatch({
        body: getNode(node, 'body'),
        directExport: options.directExport,
        fullEnd: options.fullEnd,
        fullStart: options.fullStart,
        name,
        params: getParamsSource(node, source),
        source,
    });
}
function getVariableComponentMatch(node, source, options) {
    let name = getIdentifierName(getNode(node, 'id'));
    if (!isComponentExport(name, options))
        return null;
    let init = getNode(node, 'init');
    if (!init || init.type !== 'FunctionExpression')
        return null;
    return createComponentMatch({
        body: getNode(init, 'body'),
        directExport: options.directExport,
        fullEnd: options.fullEnd,
        fullStart: options.fullStart,
        name,
        params: getParamsSource(init, source),
        source,
    });
}
function getClientEntryMatch(node, source, options) {
    let name = getIdentifierName(getNode(node, 'id'));
    if (!isComponentExport(name, options))
        return null;
    let init = getNode(node, 'init');
    if (!isNamedCallExpression(init, 'clientEntry'))
        return null;
    let componentFunction = getClientEntryComponentFunction(init);
    if (!componentFunction)
        return null;
    let body = getNode(componentFunction, 'body');
    if (!body)
        return null;
    return {
        bodyEnd: body.end,
        bodyStart: body.start,
        functionEnd: componentFunction.end,
        functionName: getIdentifierName(getNode(componentFunction, 'id')) ?? name,
        functionStart: componentFunction.start,
        name,
        params: getParamsSource(componentFunction, source),
        renderArgument: getRenderArgument(body),
        setupHash: getSetupHash(body, source),
        setupStatements: getSetupStatements(body),
        statementEnd: options.statementEnd,
        statementStart: options.statementStart,
    };
}
function getClientEntryComponentFunction(call) {
    let args = getNodeArray(call, 'arguments');
    let candidate = args[1];
    if (!candidate)
        return null;
    if (candidate.type === 'FunctionExpression')
        return candidate;
    if (candidate.type !== 'CallExpression')
        return null;
    let firstArgument = getNodeArray(candidate, 'arguments')[0];
    return firstArgument?.type === 'FunctionExpression' ? firstArgument : null;
}
function createComponentMatch(options) {
    if (!options.body)
        return null;
    let renderArgument = getRenderArgument(options.body);
    if (!renderArgument)
        return null;
    return {
        bodyEnd: options.body.end,
        bodyStart: options.body.start,
        directExport: options.directExport,
        fullEnd: options.fullEnd,
        fullStart: options.fullStart,
        name: options.name,
        params: options.params,
        renderArgument,
        setupHash: getSetupHash(options.body, options.source),
        setupStatements: getSetupStatements(options.body),
    };
}
function createHmrImplementationBody(match, source, moduleUrl) {
    let stateNames = getSetupStateNames(match.setupStatements);
    let setupSource = createSetupSource(match.setupStatements, stateNames, source);
    let renderSource = rewriteReferences(match.renderArgument.start, match.renderArgument.end, stateNames, source);
    return {
        body: [
            `{`,
            `  let __remixHmrHandle__ = __remixHmr__.getComponentHandleForHmr(arguments[0], ${JSON.stringify(moduleUrl)}, ${JSON.stringify(match.name)});`,
            `  let __s__ = __remixHmr__.getComponentHmrState(__remixHmrHandle__);`,
            `  if (__remixHmr__.setupComponentForHmr(__remixHmrHandle__, __s__, ${JSON.stringify(moduleUrl)}, ${JSON.stringify(match.name)}, ${JSON.stringify(match.setupHash)}, (__s__) => {`,
            indent(setupSource, 4),
            `  }, ${match.name})) {`,
            `    return () => null;`,
            `  }`,
            `  __remixHmr__.registerComponentRenderForHmr(__remixUIRefresh__, ${JSON.stringify(moduleUrl)}, ${JSON.stringify(match.name)}, __remixHmrHandle__, ${renderSource}, ${match.name});`,
            `  return function () {`,
            `    return __remixHmr__.callComponentRenderForHmr(__remixHmrHandle__, ...arguments);`,
            `  };`,
            `}`,
        ].join('\n'),
        sourceMapHints: [
            {
                generatedSnippet: renderSource,
                originalSnippet: source.slice(match.renderArgument.start, match.renderArgument.end),
                originalStart: match.renderArgument.start,
            },
        ],
    };
}
function createSetupSource(statements, stateNames, source) {
    let lines = [];
    let initializedStateNames = new Set();
    for (let statement of statements) {
        if (statement.type === 'VariableDeclaration') {
            for (let declaration of getNodeArray(statement, 'declarations')) {
                let pattern = getNode(declaration, 'id');
                if (!pattern)
                    continue;
                let names = getBindingNames(pattern);
                names = names.filter((name) => stateNames.has(name));
                if (names.length === 0)
                    continue;
                let init = getNode(declaration, 'init');
                if (pattern?.type === 'Identifier') {
                    let name = names[0];
                    if (name === undefined)
                        continue;
                    lines.push(init
                        ? `__s__.${name} = ${rewriteReferences(init.start, init.end, initializedStateNames, source)};`
                        : `__s__.${name} = undefined;`);
                    initializedStateNames.add(name);
                    continue;
                }
                lines.push(`{`);
                lines.push(init
                    ? `  let ${source.slice(pattern.start, pattern.end)} = ${rewriteReferences(init.start, init.end, initializedStateNames, source)};`
                    : `  let ${source.slice(pattern.start, pattern.end)};`);
                for (let name of names) {
                    lines.push(`  __s__.${name} = ${name};`);
                    initializedStateNames.add(name);
                }
                lines.push(`}`);
            }
            continue;
        }
        lines.push(rewriteReferences(statement.start, statement.end, initializedStateNames, source));
    }
    return lines.join('\n');
}
function rewriteReferences(start, end, stateNames, source) {
    if (stateNames.size === 0)
        return source.slice(start, end);
    let rewritten = new MagicString(source.slice(start, end));
    let ast = parseModule(source.slice(start, end));
    if (!ast)
        return source.slice(start, end);
    let rewrittenRanges = new Set();
    visitWithScope(ast, null, new Set(), (node, parent, shadowedNames) => {
        if (node.type !== 'Identifier')
            return;
        let name = getIdentifierName(node);
        if (!name || !stateNames.has(name))
            return;
        if (shadowedNames.has(name))
            return;
        if (!shouldRewriteIdentifier(node, parent))
            return;
        if (parent && isShorthandProperty(parent, node)) {
            let key = `${parent.start}:${parent.end}`;
            if (rewrittenRanges.has(key))
                return;
            rewritten.overwrite(parent.start, parent.end, `${name}: __s__.${name}`);
            rewrittenRanges.add(key);
            return;
        }
        rewritten.overwrite(node.start, node.end, `__s__.${name}`);
    });
    return rewritten.toString();
}
function shouldRewriteIdentifier(node, parent) {
    if (!parent)
        return true;
    if (parent.type === 'VariableDeclarator' && getNode(parent, 'id') === node)
        return false;
    if (parent.type === 'FunctionDeclaration' && getNode(parent, 'id') === node)
        return false;
    if (parent.type === 'FunctionExpression' && getNode(parent, 'id') === node)
        return false;
    if (parent.type === 'MemberExpression' && parent.property === node && !parent.computed) {
        return false;
    }
    if (isStaticPropertyKey(parent, node)) {
        return isShorthandProperty(parent, node);
    }
    return true;
}
function visitWithScope(node, parent, shadowedNames, callback) {
    let nextShadowedNames = getShadowedNames(node, shadowedNames);
    callback(node, parent, nextShadowedNames);
    for (let value of Object.values(node)) {
        if (isAstNode(value)) {
            visitWithScope(value, node, nextShadowedNames, callback);
        }
        else if (Array.isArray(value)) {
            for (let item of value) {
                if (isAstNode(item))
                    visitWithScope(item, node, nextShadowedNames, callback);
            }
        }
    }
}
function getSetupStateNames(statements) {
    let names = new Set();
    for (let statement of statements) {
        if (statement.type !== 'VariableDeclaration')
            continue;
        for (let declaration of getNodeArray(statement, 'declarations')) {
            let pattern = getNode(declaration, 'id');
            if (!pattern)
                continue;
            for (let name of getBindingNames(pattern)) {
                names.add(name);
            }
        }
    }
    return names;
}
function getShadowedNames(node, inherited) {
    let bindings = getScopeBindings(node);
    if (bindings.length === 0)
        return inherited;
    let shadowed = new Set(inherited);
    for (let binding of bindings) {
        shadowed.add(binding);
    }
    return shadowed;
}
function getScopeBindings(node) {
    let bindings = [];
    if (node.type === 'FunctionDeclaration' ||
        node.type === 'FunctionExpression' ||
        node.type === 'ArrowFunctionExpression') {
        for (let param of getNodeArray(node, 'params')) {
            bindings.push(...getBindingNames(param));
        }
    }
    if (node.type === 'Program' || node.type === 'BlockStatement') {
        for (let statement of getNodeArray(node, 'body')) {
            if (statement.type === 'VariableDeclaration') {
                for (let declaration of getNodeArray(statement, 'declarations')) {
                    let pattern = getNode(declaration, 'id');
                    if (pattern)
                        bindings.push(...getBindingNames(pattern));
                }
            }
            if (statement.type === 'FunctionDeclaration') {
                let name = getIdentifierName(getNode(statement, 'id'));
                if (name)
                    bindings.push(name);
            }
        }
    }
    return bindings;
}
function getBindingNames(pattern) {
    let names = [];
    collectBindingNames(pattern, names);
    return names;
}
function collectBindingNames(pattern, names) {
    if (pattern.type === 'Identifier') {
        let name = getIdentifierName(pattern);
        if (name)
            names.push(name);
        return;
    }
    if (pattern.type === 'AssignmentPattern') {
        let left = getNode(pattern, 'left');
        if (left)
            collectBindingNames(left, names);
        return;
    }
    if (pattern.type === 'RestElement') {
        let argument = getNode(pattern, 'argument');
        if (argument)
            collectBindingNames(argument, names);
        return;
    }
    if (pattern.type === 'ArrayPattern') {
        for (let element of getNodeArray(pattern, 'elements')) {
            collectBindingNames(element, names);
        }
        return;
    }
    if (pattern.type === 'ObjectPattern') {
        for (let property of getNodeArray(pattern, 'properties')) {
            if (property.type === 'RestElement') {
                collectBindingNames(property, names);
                continue;
            }
            let value = getNode(property, 'value');
            if (value)
                collectBindingNames(value, names);
        }
    }
}
function isShorthandProperty(parent, node) {
    return (isPropertyNode(parent) &&
        parent.key === node &&
        parent.value === node &&
        parent.shorthand === true);
}
function isStaticPropertyKey(parent, node) {
    return isPropertyNode(parent) && parent.key === node && parent.computed !== true;
}
function isPropertyNode(node) {
    return node.type === 'Property' || node.type === 'ObjectProperty';
}
function getSetupStatements(body) {
    let statements = getNodeArray(body, 'body');
    let returnIndex = statements.findIndex((statement) => statement.type === 'ReturnStatement');
    return returnIndex === -1 ? statements : statements.slice(0, returnIndex);
}
function getRenderArgument(body) {
    let returnStatement = getNodeArray(body, 'body').find((statement) => statement.type === 'ReturnStatement');
    return returnStatement ? getNode(returnStatement, 'argument') : null;
}
function indent(source, spaces) {
    let prefix = ' '.repeat(spaces);
    return source
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => `${prefix}${line}`)
        .join('\n');
}
function getExportDeclaration(node) {
    if (node.type !== 'ExportNamedDeclaration')
        return null;
    return getNode(node, 'declaration');
}
function getExportedNames(program) {
    let names = new Set();
    for (let item of getNodeArray(program, 'body')) {
        if (item.type !== 'ExportNamedDeclaration')
            continue;
        for (let specifier of getNodeArray(item, 'specifiers')) {
            let name = getIdentifierName(getNode(specifier, 'local'));
            if (name && isPascalCase(name))
                names.add(name);
        }
    }
    return names;
}
function getRuntimeExports(program) {
    let runtimeExports = [];
    for (let item of getNodeArray(program, 'body')) {
        if (item.type !== 'ExportNamedDeclaration')
            continue;
        if (isTypeOnlyExport(item))
            continue;
        let declaration = getNode(item, 'declaration');
        if (declaration) {
            addDeclarationRuntimeExports(declaration, runtimeExports);
            continue;
        }
        for (let specifier of getNodeArray(item, 'specifiers')) {
            if (specifier.exportKind === 'type')
                continue;
            let exportedName = getIdentifierName(getNode(specifier, 'exported'));
            let localName = getIdentifierName(getNode(specifier, 'local'));
            if (exportedName && localName) {
                runtimeExports.push({ exportedName, localName });
            }
        }
    }
    return runtimeExports;
}
function hasUnsafeRuntimeExports(program) {
    for (let item of getNodeArray(program, 'body')) {
        if (item.type === 'ExportAllDeclaration' && item.exportKind !== 'type') {
            return true;
        }
        if (item.type !== 'ExportNamedDeclaration')
            continue;
        if (isTypeOnlyExport(item))
            continue;
        if (getNode(item, 'source'))
            return true;
        let declaration = getNode(item, 'declaration');
        if (declaration && !isRuntimeValueDeclaration(declaration)) {
            return true;
        }
    }
    return false;
}
function isTypeOnlyExport(node) {
    return node.exportKind === 'type';
}
function addDeclarationRuntimeExports(declaration, runtimeExports) {
    if (declaration.type === 'FunctionDeclaration' || declaration.type === 'ClassDeclaration') {
        let name = getIdentifierName(getNode(declaration, 'id'));
        if (name)
            runtimeExports.push({ exportedName: name, localName: name });
        return;
    }
    if (declaration.type === 'VariableDeclaration') {
        for (let declarator of getNodeArray(declaration, 'declarations')) {
            let id = getNode(declarator, 'id');
            if (!id)
                continue;
            for (let name of getBindingNames(id)) {
                runtimeExports.push({ exportedName: name, localName: name });
            }
        }
    }
}
function isRuntimeValueDeclaration(declaration) {
    return (declaration.type === 'FunctionDeclaration' ||
        declaration.type === 'ClassDeclaration' ||
        declaration.type === 'VariableDeclaration');
}
function isComponentExport(name, options) {
    if (!name || !isPascalCase(name))
        return false;
    return options.directExport || options.exportedNames.has(name);
}
function getParamsSource(node, source) {
    let params = getNodeArray(node, 'params');
    if (params.length === 0)
        return '';
    return source.slice(params[0].start, params[params.length - 1].end);
}
function getSetupHash(body, source) {
    let returnStatement = getNodeArray(body, 'body').find((statement) => statement.type === 'ReturnStatement');
    let setupStart = body.start + 1;
    let setupEnd = returnStatement?.start ?? body.end - 1;
    return hashSource(source.slice(setupStart, setupEnd));
}
function isNamedCallExpression(node, name) {
    if (!node || node.type !== 'CallExpression')
        return false;
    return getIdentifierName(getNode(node, 'callee')) === name;
}
function getIdentifierName(node) {
    if (!node || node.type !== 'Identifier')
        return null;
    return typeof node.name === 'string' ? node.name : null;
}
function getNode(node, key) {
    let value = node[key];
    return isAstNode(value) ? value : null;
}
function getNodeArray(node, key) {
    let value = node[key];
    return Array.isArray(value) ? value.filter(isAstNode) : [];
}
function isAstNode(value) {
    return typeof value === 'object' && value !== null && 'type' in value;
}
function isPascalCase(name) {
    return /^[A-Z]/.test(name);
}
function hashSource(source) {
    let hash = 0;
    for (let index = 0; index < source.length; index++) {
        hash = ((hash << 5) - hash + source.charCodeAt(index)) | 0;
    }
    return `h${Math.abs(hash).toString(36)}`;
}

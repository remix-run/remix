import MagicString from 'magic-string'
import { parseSync } from 'oxc-parser'
import { SourceMapGenerator } from 'source-map-js/source-map.js'

/**
 * Result of analyzing and optionally rewriting a Remix component module for HMR.
 */
export interface ComponentsHmrTransformResult {
  /** Rewritten source, or the input source unchanged when `transformed` is `false`. */
  code: string
  /** HMR-compatible component and client-entry export names found in the module. */
  componentNames: string[]
  /** Source map JSON when requested and transformed, otherwise `null`. */
  map: string | null
  /** Whether the module formed a safe HMR boundary and `code` was rewritten. */
  transformed: boolean
}

/**
 * Options for rewriting browser component modules.
 */
export interface BrowserComponentsHmrTransformOptions {
  /** Package prefix used to generate component refresh and browser HMR runtime imports, typically `'remix'` or `'@remix-run'`. */
  importSource: string
  /**
   * Stable public URL used to identify this module across browser updates.
   *
   * This must match the URL by which the browser imports the module, excluding transient cache
   * busting parameters.
   */
  moduleUrl: string
  /** Whether to generate a source map for rewritten code. (`false`) */
  sourceMap?: boolean
}

/**
 * Options for rewriting server component modules.
 */
export interface ServerComponentsHmrTransformOptions {
  /** Package prefix used to generate the server HMR runtime import, typically `'remix'` or `'@remix-run'`. */
  importSource: string
  /**
   * Stable module URL used to identify this module across server updates, typically its `file:` URL
   * without cache-busting search parameters.
   */
  moduleUrl: string
  /** Whether to generate a source map for rewritten code. (`false`) */
  sourceMap?: boolean
}

type AstNode = {
  end: number
  start: number
  type: string
  [key: string]: unknown
}

type ComponentMatch = {
  bodyEnd: number
  bodyStart: number
  directExport: boolean
  fullEnd: number
  fullStart: number
  name: string
  params: MagicString
  renderArgument: AstNode
  setupHash: string
  setupStatements: AstNode[]
}

type ClientEntryMatch = {
  bodyEnd: number
  bodyStart: number
  functionEnd: number
  functionName: string
  functionStart: number
  name: string
  params: MagicString
  renderArgument: AstNode
  setupHash: string
  setupStatements: AstNode[]
  statementEnd: number
  statementStart: number
}

type TrackedExport = {
  exportedName: string
  localName: string
}

type SourceFragment = string | MagicString

type SourceEdit = {
  kind: 'overwrite' | 'prepend' | 'append'
  start: number
  end: number
  fragments: SourceFragment[]
}

/**
 * Rewrites a browser Remix component module to preserve compatible component instances across HMR updates.
 *
 * The transform instruments supported component and client-entry exports, registers their latest
 * implementations with the browser runtime, and injects an `import.meta.hot` accept boundary. If
 * parsing fails, no supported exports are found, or the module cannot be updated safely as a whole,
 * the source is returned unchanged with `transformed: false`.
 *
 * @param source Component module source code.
 * @param options Browser transform options.
 * @returns Rewritten source, discovered component names, and an optional source map.
 */
export function transformComponentsForBrowser(
  source: string,
  options: BrowserComponentsHmrTransformOptions,
): ComponentsHmrTransformResult {
  let ast = parseModule(source)
  if (!ast) return createUnchangedResult(source)

  let matchResult = findMatches(ast, source)
  if (!isSafeComponentHmrBoundary(matchResult)) {
    return createUnchangedResult(source)
  }
  let { componentMatches, clientEntryMatches, trackedExports } = matchResult

  let importSpecifiers = getComponentHmrImportSpecifiers(options.importSource)
  let edits: SourceEdit[] = []
  let componentNames: string[] = []

  for (let match of componentMatches) {
    componentNames.push(match.name)

    let implementationName = `__remixComponentHmrImpl_${match.name}__`
    let implementation = createHmrImplementationBody(
      match,
      source,
      options.moduleUrl,
      implementationName,
    )
    let exportPrefix = match.directExport ? 'export ' : ''
    let wrapperPrefix = `${exportPrefix}function ${match.name}(`
    edits.push({
      kind: 'overwrite',
      start: match.fullStart,
      end: match.fullEnd,
      fragments: [
        ...implementation,
        '\n',
        ...createHmrWrapper(wrapperPrefix, match, options.moduleUrl),
        `\n__remixComponentHmr__.registerComponentForHmr(__remixComponentRefresh__, ${JSON.stringify(
          options.moduleUrl,
        )}, ${JSON.stringify(match.name)}, ${implementationName}, ${JSON.stringify(
          match.setupHash,
        )}, ${match.name});`,
      ],
    })
  }

  for (let match of clientEntryMatches) {
    componentNames.push(match.name)

    let implementationName = `__remixComponentHmrImpl_${match.name}__`
    let implementation = createHmrImplementationBody(
      match,
      source,
      options.moduleUrl,
      implementationName,
    )
    let wrapperPrefix = `function ${match.functionName}(`
    edits.push(
      {
        kind: 'prepend',
        start: match.statementStart,
        end: match.statementStart,
        fragments: [...implementation, '\n'],
      },
      {
        kind: 'overwrite',
        start: match.functionStart,
        end: match.functionEnd,
        fragments: createHmrWrapper(wrapperPrefix, match, options.moduleUrl),
      },
      {
        kind: 'append',
        start: match.statementEnd,
        end: match.statementEnd,
        fragments: [
          `\n__remixComponentHmr__.registerComponentForHmr(__remixComponentRefresh__, ${JSON.stringify(
            options.moduleUrl,
          )}, ${JSON.stringify(match.name)}, ${implementationName}, ${JSON.stringify(
            match.setupHash,
          )}, ${match.name});`,
        ],
      },
    )
  }

  let imports = [
    `import { __componentHmrBrowserRuntime__ as __remixComponentHmr__ } from ${JSON.stringify(
      importSpecifiers.browserRuntimeSpecifier,
    )};`,
    `import * as __remixComponentRefresh__ from ${JSON.stringify(importSpecifiers.refreshSpecifier)};`,
    ``,
  ].join('\n')
  let footer = [
    ``,
    `if (import.meta.hot) {`,
    `  let __remixComponentHmrComponentNames__ = ${JSON.stringify(componentNames)};`,
    `  let __remixComponentHmrAcceptComponentModule__ = ${createComponentNamesCheckSource(
      options.moduleUrl,
      '__remixComponentHmrComponentNames__',
      {
        spaces: 0,
        clientEntryNames: clientEntryMatches.map((match) => match.name),
      },
    )};`,
    `  let __remixComponentHmrPreviousExports__ = ${createPreviousExportsSource(trackedExports)};`,
    `  import.meta.hot.accept((module) => {`,
    `    if (!__remixComponentHmrAcceptComponentModule__) return;`,
    `    if (module && typeof module === 'object') {`,
    `      let __remixComponentHmrInvalidationMessage__ = ${createUpdatedExportsCheckSource(
      'module',
      '__remixComponentHmrPreviousExports__',
      '__remixComponentHmrComponentNames__',
    )};`,
    `      if (__remixComponentHmrInvalidationMessage__) {`,
    `        import.meta.hot.invalidate(__remixComponentHmrInvalidationMessage__);`,
    `        return;`,
    `      }`,
    `      __remixComponentHmr__.updateComponentModuleForHmr(__remixComponentRefresh__, ${JSON.stringify(
      options.moduleUrl,
    )}, module);`,
    `    } else {`,
    `      import.meta.hot.invalidate('Updated component module did not evaluate to an object');`,
    `    }`,
    `  });`,
    `}`,
  ].join('\n')

  let fragments = assembleModule(source, edits, imports, footer)
  let code = fragments.join('')

  return {
    code,
    componentNames,
    map: options.sourceMap ? generateSourceMap(fragments, code, source, options.moduleUrl) : null,
    transformed: true,
  }
}

/**
 * Rewrites a server Remix component module so existing component wrappers call the latest implementation.
 *
 * The transform instruments supported component and client-entry exports and registers their
 * implementations under `moduleUrl`. If parsing fails, no supported exports are found, or the
 * module cannot be updated safely as a whole, the source is returned unchanged with
 * `transformed: false`.
 *
 * @param source Component module source code.
 * @param options Server transform options.
 * @returns Rewritten source, discovered component names, and an optional source map.
 */
export function transformComponentsForServer(
  source: string,
  options: ServerComponentsHmrTransformOptions,
): ComponentsHmrTransformResult {
  let ast = parseModule(source)
  if (!ast) return createUnchangedResult(source)

  let matchResult = findMatches(ast, source)
  if (!isSafeComponentHmrBoundary(matchResult)) {
    return createUnchangedResult(source)
  }
  let { componentMatches, clientEntryMatches, trackedExports } = matchResult

  let importSpecifiers = getComponentHmrImportSpecifiers(options.importSource)
  let edits: SourceEdit[] = []
  let componentNames: string[] = []

  for (let match of componentMatches) {
    componentNames.push(match.name)

    let implementationName = `__remixComponentHmrImpl_${match.name}__`
    let exportPrefix = match.directExport ? 'export ' : ''
    let implementationPrefix = `function ${implementationName}(`
    let bodySource = new MagicString(source).snip(match.bodyStart, match.bodyEnd)
    let wrapperPrefix = `${exportPrefix}function ${match.name}(`
    edits.push({
      kind: 'overwrite',
      start: match.fullStart,
      end: match.fullEnd,
      fragments: [
        implementationPrefix,
        match.params,
        ') ',
        bodySource,
        '\n',
        ...createHmrWrapper(wrapperPrefix, match, options.moduleUrl),
        `\n__remixComponentHmr__.registerComponentForHmr(${JSON.stringify(
          options.moduleUrl,
        )}, ${JSON.stringify(match.name)}, ${implementationName});`,
      ],
    })
  }

  for (let match of clientEntryMatches) {
    componentNames.push(match.name)

    let implementationName = `__remixComponentHmrImpl_${match.name}__`
    let implementationPrefix = `function ${implementationName}(`
    let bodySource = new MagicString(source).snip(match.bodyStart, match.bodyEnd)
    let wrapperPrefix = `function ${match.functionName}(`
    edits.push(
      {
        kind: 'prepend',
        start: match.statementStart,
        end: match.statementStart,
        fragments: [implementationPrefix, match.params, ') ', bodySource, '\n'],
      },
      {
        kind: 'overwrite',
        start: match.functionStart,
        end: match.functionEnd,
        fragments: createHmrWrapper(wrapperPrefix, match, options.moduleUrl),
      },
      {
        kind: 'append',
        start: match.statementEnd,
        end: match.statementEnd,
        fragments: [
          `\n__remixComponentHmr__.registerComponentForHmr(${JSON.stringify(
            options.moduleUrl,
          )}, ${JSON.stringify(match.name)}, ${implementationName});`,
        ],
      },
    )
  }

  let imports = [
    `import { __componentHmrServerRuntime__ as __remixComponentHmr__ } from ${JSON.stringify(
      importSpecifiers.serverRuntimeSpecifier,
    )};`,
    ``,
  ].join('\n')
  let footer = [
    ``,
    `if (import.meta.hot) {`,
    `  let __remixComponentHmrComponentNames__ = ${JSON.stringify(componentNames)};`,
    `  let __remixComponentHmrAcceptComponentModule__ = ${createComponentNamesCheckSource(
      options.moduleUrl,
      '__remixComponentHmrComponentNames__',
      {
        spaces: 0,
        clientEntryNames: clientEntryMatches.map((match) => match.name),
      },
    )};`,
    `  let __remixComponentHmrPreviousExports__ = ${createPreviousExportsSource(trackedExports)};`,
    `  import.meta.hot.accept((module) => {`,
    `    if (!__remixComponentHmrAcceptComponentModule__) return;`,
    `    if (!module || typeof module !== 'object') {`,
    `      import.meta.hot.invalidate('Updated component module did not evaluate to an object');`,
    `      return;`,
    `    }`,
    `    let __remixComponentHmrInvalidationMessage__ = ${createUpdatedExportsCheckSource(
      'module',
      '__remixComponentHmrPreviousExports__',
      '__remixComponentHmrComponentNames__',
    )};`,
    `    if (__remixComponentHmrInvalidationMessage__) {`,
    `      import.meta.hot.invalidate(__remixComponentHmrInvalidationMessage__);`,
    `    }`,
    `  });`,
    `}`,
  ].join('\n')

  let fragments = assembleModule(source, edits, imports, footer)
  let code = fragments.join('')

  return {
    code,
    componentNames,
    map: options.sourceMap ? generateSourceMap(fragments, code, source, options.moduleUrl) : null,
    transformed: true,
  }
}

function getComponentHmrImportSpecifiers(importSource: string): {
  browserRuntimeSpecifier: string
  refreshSpecifier: string
  serverRuntimeSpecifier: string
} {
  return {
    browserRuntimeSpecifier: `${importSource}/component-hmr/runtime/browser`,
    refreshSpecifier: `${importSource}/component/dev/refresh`,
    serverRuntimeSpecifier: `${importSource}/component-hmr/runtime/server`,
  }
}

function createHmrWrapper(
  prefix: string,
  match: Pick<ComponentMatch, 'name' | 'params'>,
  moduleUrl: string,
): SourceFragment[] {
  return [
    prefix,
    match.params,
    [
      `) {`,
      `  return __remixComponentHmr__.getCurrentComponentForHmr(${JSON.stringify(
        moduleUrl,
      )}, ${JSON.stringify(match.name)}).apply(undefined, arguments);`,
      `}`,
    ].join('\n'),
  ]
}

function assembleModule(
  source: string,
  edits: readonly SourceEdit[],
  imports: string,
  footer: string,
): SourceFragment[] {
  // Match the existing transform: the final overwrite of a shared statement survives.
  let overwrites = new Map<string, SourceEdit>()
  for (let edit of edits) {
    if (edit.kind === 'overwrite') overwrites.set(`${edit.start}:${edit.end}`, edit)
  }
  let placements = { prepend: 0, append: 1, overwrite: 2 }
  let ordered = edits
    .filter(
      (edit) => edit.kind !== 'overwrite' || overwrites.get(`${edit.start}:${edit.end}`) === edit,
    )
    .map((edit, index) => ({ edit, index }))
    .sort(
      (left, right) =>
        left.edit.start - right.edit.start ||
        placements[left.edit.kind] - placements[right.edit.kind] ||
        (left.edit.kind === 'prepend' ? right.index - left.index : left.index - right.index),
    )
  let fragments: SourceFragment[] = [imports]
  let original = new MagicString(source)
  let offset = 0
  for (let { edit } of ordered) {
    if (edit.start < offset) throw new Error('Overlapping component HMR edits')
    if (edit.start > offset) fragments.push(original.snip(offset, edit.start))
    fragments.push(...edit.fragments)
    offset = edit.end
  }
  if (offset < source.length) fragments.push(original.snip(offset, source.length))
  fragments.push(footer)
  return fragments
}

function generateSourceMap(
  fragments: readonly SourceFragment[],
  code: string,
  source: string,
  sourceName: string,
): string {
  let generator = new SourceMapGenerator()
  let codePositions = createSourceMapPositions(code)
  let sourcePositions = createSourceMapPositions(source)
  let offset = 0
  for (let fragment of fragments) {
    let content = fragment.toString()
    if (content.length === 0) continue
    // Each fragment starts unmapped until an authored mapping supplies its location.
    generator.addMapping({ generated: codePositions.getPosition(offset) })
    if (typeof fragment !== 'string') {
      let fragmentPositions = createSourceMapPositions(content)
      let map = fragment.generateDecodedMap({ hires: true })
      for (let [line, segments] of map.mappings.entries()) {
        for (let segment of segments) {
          let generated = codePositions.getPosition(
            offset + fragmentPositions.getIndexFromLfPosition(line + 1, segment[0]),
          )
          generator.addMapping(
            segment.length === 1
              ? { generated }
              : {
                  generated,
                  original: sourcePositions.getPosition(
                    sourcePositions.getIndexFromLfPosition(segment[2] + 1, segment[3]),
                  ),
                  source: sourceName,
                },
          )
        }
      }
    }
    offset += content.length
  }
  generator.setSourceContent(sourceName, source)
  return generator.toString()
}

function createSourceMapPositions(source: string) {
  // MagicString counts LF only; translate through offsets into JavaScript line positions.
  let lfLineStarts = [0]
  let lineStarts = [0]
  for (let index = 0; index < source.length; index++) {
    let char = source[index]
    if (char === '\n') lfLineStarts.push(index + 1)
    if (
      char === '\n' ||
      (char === '\r' && source[index + 1] !== '\n') ||
      char === '\u2028' ||
      char === '\u2029'
    ) {
      lineStarts.push(index + 1)
    }
  }
  return {
    getIndexFromLfPosition(line: number, column: number): number {
      let start = lfLineStarts[line - 1]
      if (start === undefined) throw new Error('Unexpected component HMR source map position')
      return start + column
    },
    getPosition(index: number): { line: number; column: number } {
      let low = 0
      let high = lineStarts.length
      while (low + 1 < high) {
        let middle = Math.floor((low + high) / 2)
        if (lineStarts[middle] <= index) low = middle
        else high = middle
      }
      return { line: low + 1, column: index - lineStarts[low] }
    },
  }
}

function parseModule(source: string): AstNode | null {
  try {
    let result = parseSync('module.tsx', source, {
      lang: 'tsx',
      sourceType: 'module',
    })
    return isAstNode(result.program) ? result.program : null
  } catch {
    return null
  }
}

function createUnchangedResult(source: string): ComponentsHmrTransformResult {
  return {
    code: source,
    componentNames: [],
    map: null,
    transformed: false,
  }
}

function findMatches(
  program: AstNode,
  source: string,
): {
  componentMatches: ComponentMatch[]
  clientEntryMatches: ClientEntryMatch[]
  trackedExports: TrackedExport[]
  unsafeTrackedExports: boolean
} {
  let trackedExports = getTrackedExports(program)
  let exportedNames = getExportedNames(program)
  let unsafeTrackedExports = hasUnsafeTrackedExports(program)
  let componentMatches: ComponentMatch[] = []
  let clientEntryMatches: ClientEntryMatch[] = []

  for (let item of getNodeArray(program, 'body')) {
    let exportDeclaration = getExportDeclaration(item)
    let statement = exportDeclaration ?? item
    let directExport = exportDeclaration !== null

    if (statement.type === 'FunctionDeclaration') {
      let match = getFunctionDeclarationMatch(statement, source, {
        directExport,
        exportedNames,
        fullEnd: directExport ? item.end : statement.end,
        fullStart: directExport ? item.start : statement.start,
      })
      if (match) componentMatches.push(match)
      continue
    }

    if (statement.type !== 'VariableDeclaration') continue

    for (let declaration of getNodeArray(statement, 'declarations')) {
      let clientEntryMatch = getClientEntryMatch(declaration, source, {
        directExport,
        exportedNames,
        statementEnd: directExport ? item.end : statement.end,
        statementStart: directExport ? item.start : statement.start,
      })
      if (clientEntryMatch) {
        clientEntryMatches.push(clientEntryMatch)
        continue
      }

      let componentMatch = getVariableComponentMatch(declaration, source, {
        directExport,
        exportedNames,
        fullEnd: directExport ? item.end : statement.end,
        fullStart: directExport ? item.start : statement.start,
      })
      if (componentMatch) componentMatches.push(componentMatch)
    }
  }

  componentMatches = componentMatches.filter(
    (match) =>
      !clientEntryMatches.some(
        (clientEntryMatch) =>
          match.fullStart >= clientEntryMatch.functionStart &&
          match.fullEnd <= clientEntryMatch.functionEnd,
      ),
  )

  return {
    componentMatches,
    clientEntryMatches,
    trackedExports,
    unsafeTrackedExports,
  }
}

function isSafeComponentHmrBoundary(matchResult: {
  componentMatches: readonly ComponentMatch[]
  clientEntryMatches: readonly ClientEntryMatch[]
  unsafeTrackedExports: boolean
}): boolean {
  if (matchResult.unsafeTrackedExports) return false

  return matchResult.componentMatches.length > 0 || matchResult.clientEntryMatches.length > 0
}

function createComponentNamesCheckSource(
  moduleUrl: string,
  componentNamesName: string,
  options: {
    spaces: number
    clientEntryNames: readonly string[]
  },
): string {
  let indent = ' '.repeat(options.spaces)
  let lines = [
    `${indent}let __remixComponentHmrPreviousComponentNames__ = import.meta.hot.data.componentNamesByModuleUrl?.[${JSON.stringify(
      moduleUrl,
    )}];`,
    `${indent}if (__remixComponentHmrPreviousComponentNames__ && (__remixComponentHmrPreviousComponentNames__.length !== ${componentNamesName}.length || __remixComponentHmrPreviousComponentNames__.some((name, index) => name !== ${componentNamesName}[index]))) {`,
    `${indent}  import.meta.hot.invalidate('Updated component module changed its exports');`,
    `${indent}  return false;`,
    `${indent}}`,
    `${indent}let __remixComponentHmrClientEntryNames__ = ${JSON.stringify(options.clientEntryNames)};`,
    `${indent}let __remixComponentHmrPreviousClientEntryNames__ = import.meta.hot.data.clientEntryNamesByModuleUrl?.[${JSON.stringify(moduleUrl)}];`,
    `${indent}if (__remixComponentHmrPreviousClientEntryNames__ && (__remixComponentHmrPreviousClientEntryNames__.length !== __remixComponentHmrClientEntryNames__.length || __remixComponentHmrPreviousClientEntryNames__.some((name, index) => name !== __remixComponentHmrClientEntryNames__[index]))) {`,
    `${indent}  import.meta.hot.invalidate('Updated component module changed its client entries');`,
    `${indent}  return false;`,
    `${indent}}`,
    `${indent}import.meta.hot.data.clientEntryNamesByModuleUrl = {`,
    `${indent}  ...import.meta.hot.data.clientEntryNamesByModuleUrl,`,
    `${indent}  [${JSON.stringify(moduleUrl)}]: __remixComponentHmrClientEntryNames__,`,
    `${indent}};`,
    `${indent}import.meta.hot.data.componentNamesByModuleUrl = {`,
    `${indent}  ...import.meta.hot.data.componentNamesByModuleUrl,`,
    `${indent}  [${JSON.stringify(moduleUrl)}]: ${componentNamesName},`,
    `${indent}};`,
    `${indent}return true;`,
  ]

  lines.unshift(`(() => {`)
  lines.push(`})()`)

  return lines.join('\n')
}

function createPreviousExportsSource(trackedExports: readonly TrackedExport[]): string {
  if (trackedExports.length === 0) return `{}`

  return [
    `{`,
    ...trackedExports.map(
      (trackedExport) =>
        `  ${JSON.stringify(trackedExport.exportedName)}: ${trackedExport.localName},`,
    ),
    `}`,
  ].join('\n')
}

function createUpdatedExportsCheckSource(
  nextExportsName: string,
  previousExportsName: string,
  componentExportNamesName: string,
): string {
  return [
    `(() => {`,
    `  let __remixComponentHmrPreviousExportNames__ = Object.keys(${previousExportsName});`,
    `  for (let name of __remixComponentHmrPreviousExportNames__) {`,
    `    if (!Object.prototype.hasOwnProperty.call(${nextExportsName}, name)) {`,
    `      return 'Updated component module removed export "' + name + '"';`,
    `    }`,
    `  }`,
    `  for (let name of Object.keys(${nextExportsName})) {`,
    `    if (!Object.prototype.hasOwnProperty.call(${previousExportsName}, name)) {`,
    `      return 'Updated component module added export "' + name + '"';`,
    `    }`,
    `  }`,
    `  for (let name of __remixComponentHmrPreviousExportNames__) {`,
    `    if (${componentExportNamesName}.includes(name)) continue;`,
    `    if (${previousExportsName}[name] !== ${nextExportsName}[name]) {`,
    `      return 'Updated component module changed non-component export "' + name + '"';`,
    `    }`,
    `  }`,
    `  return null;`,
    `})()`,
  ].join('\n')
}

function getFunctionDeclarationMatch(
  node: AstNode,
  source: string,
  options: {
    directExport: boolean
    exportedNames: ReadonlySet<string>
    fullEnd: number
    fullStart: number
  },
): ComponentMatch | null {
  let name = getIdentifierName(getNode(node, 'id'))
  if (!isComponentExport(name, options)) return null

  return createComponentMatch({
    body: getNode(node, 'body'),
    directExport: options.directExport,
    fullEnd: options.fullEnd,
    fullStart: options.fullStart,
    name,
    params: getParamsSource(node, source),
    source,
  })
}

function getVariableComponentMatch(
  node: AstNode,
  source: string,
  options: {
    directExport: boolean
    exportedNames: ReadonlySet<string>
    fullEnd: number
    fullStart: number
  },
): ComponentMatch | null {
  let name = getIdentifierName(getNode(node, 'id'))
  if (!isComponentExport(name, options)) return null

  let init = getNode(node, 'init')
  if (!init || init.type !== 'FunctionExpression') return null

  return createComponentMatch({
    body: getNode(init, 'body'),
    directExport: options.directExport,
    fullEnd: options.fullEnd,
    fullStart: options.fullStart,
    name,
    params: getParamsSource(init, source),
    source,
  })
}

function getClientEntryMatch(
  node: AstNode,
  source: string,
  options: {
    directExport: boolean
    exportedNames: ReadonlySet<string>
    statementEnd: number
    statementStart: number
  },
): ClientEntryMatch | null {
  let name = getIdentifierName(getNode(node, 'id'))
  if (!isComponentExport(name, options)) return null

  let init = getNode(node, 'init')
  if (!isNamedCallExpression(init, 'clientEntry')) return null

  let componentFunction = getClientEntryComponentFunction(init)
  if (!componentFunction) return null

  let body = getNode(componentFunction, 'body')
  if (!body) return null

  return {
    bodyEnd: body.end,
    bodyStart: body.start,
    functionEnd: componentFunction.end,
    functionName: getIdentifierName(getNode(componentFunction, 'id')) ?? name,
    functionStart: componentFunction.start,
    name,
    params: getParamsSource(componentFunction, source),
    renderArgument: getRenderArgument(body)!,
    setupHash: getSetupHash(body, source),
    setupStatements: getSetupStatements(body),
    statementEnd: options.statementEnd,
    statementStart: options.statementStart,
  }
}

function getClientEntryComponentFunction(call: AstNode): AstNode | null {
  let args = getNodeArray(call, 'arguments')
  let candidate = args[1]
  if (!candidate) return null

  if (candidate.type === 'FunctionExpression') return candidate
  if (candidate.type !== 'CallExpression') return null

  let firstArgument = getNodeArray(candidate, 'arguments')[0]
  return firstArgument?.type === 'FunctionExpression' ? firstArgument : null
}

function createComponentMatch(options: {
  body: AstNode | null
  directExport: boolean
  fullEnd: number
  fullStart: number
  name: string
  params: MagicString
  source: string
}): ComponentMatch | null {
  if (!options.body) return null
  let renderArgument = getRenderArgument(options.body)
  if (!renderArgument) return null

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
  }
}

function createHmrImplementationBody(
  match: Pick<
    ComponentMatch,
    'name' | 'params' | 'renderArgument' | 'setupHash' | 'setupStatements'
  >,
  source: string,
  moduleUrl: string,
  implementationName: string,
): SourceFragment[] {
  let setupStateNames = getSetupStateNames(match.setupStatements)
  let renderReferencedDeclarationNames = getRenderReferencedSetupDeclarationNames(
    match.renderArgument,
    match.setupStatements,
  )
  let renderStateNames = new Set(setupStateNames)
  for (let name of renderReferencedDeclarationNames) renderStateNames.add(name)
  let body: SourceFragment[] = [`function ${implementationName}(`, match.params]
  body.push(
    [
      `) {`,
      `  let __remixComponentHmrHandle__ = __remixComponentHmr__.getComponentHandleForHmr(arguments[0], ${JSON.stringify(
        moduleUrl,
      )}, ${JSON.stringify(match.name)});`,
      `  let __s__ = __remixComponentHmr__.getComponentHmrState(__remixComponentHmrHandle__);`,
      `  if (__remixComponentHmr__.setupComponentForHmr(__remixComponentHmrHandle__, __s__, ${JSON.stringify(moduleUrl)}, ${JSON.stringify(match.name)}, ${JSON.stringify(match.setupHash)}, (__s__) => {`,
      ``,
    ].join('\n'),
  )
  createSetupSource(
    match.setupStatements,
    setupStateNames,
    renderReferencedDeclarationNames,
    source,
    body,
  )
  body.push(
    [
      `  }, ${match.name})) {`,
      `    return () => null;`,
      `  }`,
      `  __remixComponentHmr__.registerComponentRenderForHmr(__remixComponentRefresh__, ${JSON.stringify(moduleUrl)}, ${JSON.stringify(match.name)}, __remixComponentHmrHandle__, `,
    ].join('\n'),
  )
  let render = rewriteReferences(match.renderArgument, renderStateNames, source)
  body.push(render)
  body.push(
    [
      `, ${match.name});`,
      `  return function () {`,
      `    return __remixComponentHmr__.callComponentRenderForHmr(__remixComponentHmrHandle__, ...arguments);`,
      `  };`,
      `}`,
    ].join('\n'),
  )
  return body
}

function createSetupSource(
  statements: readonly AstNode[],
  setupStateNames: ReadonlySet<string>,
  renderReferencedDeclarationNames: ReadonlySet<string>,
  source: string,
  body: SourceFragment[],
): void {
  function appendLine(...parts: SourceFragment[]): void {
    body.push('    ')
    for (let part of parts) {
      if (typeof part !== 'string') {
        // Preserve setup's existing blank-line removal while retaining original locations.
        part.replaceAll(/\n(?=\n)/g, '').indent('    ', { indentStart: false })
      }
      body.push(part)
    }
    body.push('\n')
  }
  let initializedStateNames = new Set<string>()
  let hoistedFunctionStateNames = new Set<string>()

  // Function declarations initialize shared var bindings before any setup statements run.
  for (let statement of statements) {
    if (statement.type !== 'FunctionDeclaration') continue
    let name = getIdentifierName(getNode(statement, 'id'))
    if (name && setupStateNames.has(name) && renderReferencedDeclarationNames.has(name)) {
      hoistedFunctionStateNames.add(name)
    }
  }
  for (let name of hoistedFunctionStateNames) {
    appendLine(`__s__.${name} = ${name};`)
  }

  for (let statement of statements) {
    if (isSetupRuntimeDeclaration(statement)) {
      let name = getIdentifierName(getNode(statement, 'id'))
      if (name && renderReferencedDeclarationNames.has(name)) {
        appendLine(rewriteReferences(statement, setupStateNames, source))
        if (!hoistedFunctionStateNames.has(name)) appendLine(`__s__.${name} = ${name};`)
        continue
      }
    }

    if (statement.type === 'VariableDeclaration') {
      for (let declaration of getNodeArray(statement, 'declarations')) {
        let pattern = getNode(declaration, 'id')
        if (!pattern) continue

        let names = getBindingNames(pattern)
        names = names.filter((name) => setupStateNames.has(name))
        if (names.length === 0) continue

        let init = getNode(declaration, 'init')
        if (pattern?.type === 'Identifier') {
          let name = names[0]
          if (name === undefined) continue
          if (!init && statement.kind === 'var' && hoistedFunctionStateNames.has(name)) {
            initializedStateNames.add(name)
            continue
          }
          appendLine(
            '__s__.',
            new MagicString(source)
              .snip(pattern.start, pattern.end)
              .overwrite(pattern.start, pattern.end, name),
            ' = ',
            init
              ? rewriteReferences(init, initializedStateNames, source, setupStateNames)
              : 'undefined',
            ';',
          )
          initializedStateNames.add(name)
          continue
        }

        appendLine(`{`)
        let patternSource = rewriteBindingPatternReferences(
          pattern,
          initializedStateNames,
          setupStateNames,
          source,
        )
        appendLine(
          '  let ',
          patternSource,
          ...(init
            ? [' = ', rewriteReferences(init, initializedStateNames, source, setupStateNames)]
            : []),
          ';',
        )
        for (let name of names) {
          appendLine(`  __s__.${name} = ${name};`)
          initializedStateNames.add(name)
        }
        appendLine(`}`)
      }
      continue
    }

    appendLine(rewriteReferences(statement, initializedStateNames, source, setupStateNames))
  }
}

function rewriteReferences(
  root: AstNode,
  stateNames: ReadonlySet<string>,
  source: string,
  deferredStateNames: ReadonlySet<string> = stateNames,
  rewritten = new MagicString(source).snip(root.start, root.end),
): MagicString {
  if (stateNames.size === 0 && deferredStateNames.size === 0) return rewritten
  let rewrittenRanges = new Set<string>()
  let functions: AstNode[] = []

  visitWithScope(root, null, new Set(), (node, parent, shadowedNames) => {
    if (
      node.type === 'FunctionDeclaration' ||
      node.type === 'FunctionExpression' ||
      node.type === 'ArrowFunctionExpression'
    ) {
      functions.push(node)
    }
    if (node.type !== 'Identifier' && node.type !== 'JSXIdentifier') return
    let name = getIdentifierName(node)
    if (!name) return
    // Code inside a nested function can't run until it's called, so it may reference setup
    // variables declared after it.
    let isDeferred = functions.some((fn) => fn.start <= node.start && node.end <= fn.end)
    if (!(isDeferred ? deferredStateNames : stateNames).has(name)) return
    if (shadowedNames.has(name)) return
    if (!shouldRewriteIdentifier(node, parent)) return

    if (parent && isShorthandProperty(parent, node)) {
      let key = `${parent.start}:${parent.end}`
      if (rewrittenRanges.has(key)) return
      rewritten.overwrite(parent.start, parent.end, `${name}: __s__.${name}`)
      rewrittenRanges.add(key)
      return
    }

    rewritten.overwrite(node.start, node.end, `__s__.${name}`)
  })

  return rewritten
}

function rewriteBindingPatternReferences(
  pattern: AstNode,
  stateNames: ReadonlySet<string>,
  deferredStateNames: ReadonlySet<string>,
  source: string,
): MagicString {
  let rewritten = new MagicString(source).snip(pattern.start, pattern.end)
  if (stateNames.size === 0 && deferredStateNames.size === 0) return rewritten

  visitBindingPattern(pattern, (node) => {
    rewriteReferences(node, stateNames, source, deferredStateNames, rewritten)
  })

  return rewritten
}

function visitBindingPattern(pattern: AstNode, onExpression: (node: AstNode) => void): void {
  if (pattern.type === 'AssignmentPattern') {
    let left = getNode(pattern, 'left')
    let right = getNode(pattern, 'right')
    if (left) visitBindingPattern(left, onExpression)
    if (right) onExpression(right)
    return
  }

  if (pattern.type === 'RestElement') {
    let argument = getNode(pattern, 'argument')
    if (argument) visitBindingPattern(argument, onExpression)
    return
  }

  if (pattern.type === 'ArrayPattern') {
    for (let element of getNodeArray(pattern, 'elements')) {
      visitBindingPattern(element, onExpression)
    }
    return
  }

  if (pattern.type === 'ObjectPattern') {
    for (let property of getNodeArray(pattern, 'properties')) {
      if (property.type === 'RestElement') {
        visitBindingPattern(property, onExpression)
        continue
      }

      let key = getNode(property, 'key')
      if (property.computed === true && key) {
        onExpression(key)
      }

      let value = getNode(property, 'value')
      if (value) visitBindingPattern(value, onExpression)
    }
  }
}

function shouldRewriteIdentifier(node: AstNode, parent: AstNode | null): boolean {
  if (!parent) return true
  if (node.type === 'JSXIdentifier') {
    if (parent.type === 'JSXAttribute' && getNode(parent, 'name') === node) return false
    if (parent.type === 'JSXNamespacedName') return false
    if (parent.type === 'JSXMemberExpression' && getNode(parent, 'property') === node) return false
    return true
  }
  if (parent.type === 'VariableDeclarator' && getNode(parent, 'id') === node) return false
  if (parent.type === 'FunctionDeclaration' && getNode(parent, 'id') === node) return false
  if (parent.type === 'FunctionExpression' && getNode(parent, 'id') === node) return false
  if (parent.type === 'MemberExpression' && parent.property === node && !parent.computed) {
    return false
  }
  if (isStaticPropertyKey(parent, node)) {
    return isShorthandProperty(parent, node)
  }
  return true
}

function visitWithScope(
  node: AstNode,
  parent: AstNode | null,
  shadowedNames: ReadonlySet<string>,
  callback: (node: AstNode, parent: AstNode | null, shadowedNames: ReadonlySet<string>) => void,
): void {
  let nextShadowedNames = getShadowedNames(node, shadowedNames)

  callback(node, parent, nextShadowedNames)

  for (let value of Object.values(node)) {
    if (isAstNode(value)) {
      visitWithScope(value, node, nextShadowedNames, callback)
    } else if (Array.isArray(value)) {
      for (let item of value) {
        if (isAstNode(item)) visitWithScope(item, node, nextShadowedNames, callback)
      }
    }
  }
}

function getSetupStateNames(statements: readonly AstNode[]): Set<string> {
  let names = new Set<string>()

  for (let statement of statements) {
    if (statement.type !== 'VariableDeclaration') continue

    for (let declaration of getNodeArray(statement, 'declarations')) {
      let pattern = getNode(declaration, 'id')
      if (!pattern) continue
      for (let name of getBindingNames(pattern)) {
        names.add(name)
      }
    }
  }

  return names
}

function getRenderReferencedSetupDeclarationNames(
  renderArgument: AstNode,
  setupStatements: readonly AstNode[],
): Set<string> {
  let declarationNames = new Set<string>()

  for (let statement of setupStatements) {
    if (!isSetupRuntimeDeclaration(statement)) continue
    let name = getIdentifierName(getNode(statement, 'id'))
    if (name) declarationNames.add(name)
  }

  return getReferencedNames(renderArgument, declarationNames)
}

function isSetupRuntimeDeclaration(node: AstNode): boolean {
  return (
    node.type === 'FunctionDeclaration' ||
    node.type === 'ClassDeclaration' ||
    node.type === 'TSEnumDeclaration'
  )
}

function getReferencedNames(root: AstNode, names: ReadonlySet<string>): Set<string> {
  let referencedNames = new Set<string>()

  visitWithScope(root, null, new Set(), (node, parent, shadowedNames) => {
    if (node.type !== 'Identifier' && node.type !== 'JSXIdentifier') return
    let name = getIdentifierName(node)
    if (!name || !names.has(name)) return
    if (shadowedNames.has(name)) return
    if (!shouldRewriteIdentifier(node, parent)) return
    referencedNames.add(name)
  })

  return referencedNames
}

function getShadowedNames(node: AstNode, inherited: ReadonlySet<string>): ReadonlySet<string> {
  let bindings = getScopeBindings(node)
  if (bindings.length === 0) return inherited

  let shadowed = new Set(inherited)
  for (let binding of bindings) {
    shadowed.add(binding)
  }
  return shadowed
}

function getScopeBindings(node: AstNode): string[] {
  let bindings: string[] = []

  if (
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression'
  ) {
    for (let param of getNodeArray(node, 'params')) {
      bindings.push(...getBindingNames(param))
    }
  }

  if (node.type === 'Program' || node.type === 'BlockStatement') {
    for (let statement of getNodeArray(node, 'body')) {
      if (statement.type === 'VariableDeclaration') {
        for (let declaration of getNodeArray(statement, 'declarations')) {
          let pattern = getNode(declaration, 'id')
          if (pattern) bindings.push(...getBindingNames(pattern))
        }
      }

      if (statement.type === 'FunctionDeclaration') {
        let name = getIdentifierName(getNode(statement, 'id'))
        if (name) bindings.push(name)
      }

      if (statement.type === 'ClassDeclaration' || statement.type === 'TSEnumDeclaration') {
        let name = getIdentifierName(getNode(statement, 'id'))
        if (name) bindings.push(name)
      }
    }
  }

  return bindings
}

function getBindingNames(pattern: AstNode): string[] {
  let names: string[] = []

  collectBindingNames(pattern, names)

  return names
}

function collectBindingNames(pattern: AstNode, names: string[]): void {
  if (pattern.type === 'Identifier') {
    let name = getIdentifierName(pattern)
    if (name) names.push(name)
    return
  }

  if (pattern.type === 'AssignmentPattern') {
    let left = getNode(pattern, 'left')
    if (left) collectBindingNames(left, names)
    return
  }

  if (pattern.type === 'RestElement') {
    let argument = getNode(pattern, 'argument')
    if (argument) collectBindingNames(argument, names)
    return
  }

  if (pattern.type === 'ArrayPattern') {
    for (let element of getNodeArray(pattern, 'elements')) {
      collectBindingNames(element, names)
    }
    return
  }

  if (pattern.type === 'ObjectPattern') {
    for (let property of getNodeArray(pattern, 'properties')) {
      if (property.type === 'RestElement') {
        collectBindingNames(property, names)
        continue
      }

      let value = getNode(property, 'value')
      if (value) collectBindingNames(value, names)
    }
  }
}

function isShorthandProperty(parent: AstNode, node: AstNode): boolean {
  return (
    isPropertyNode(parent) &&
    isSameNodeRange(getNode(parent, 'key'), node) &&
    isSameNodeRange(getNode(parent, 'value'), node) &&
    parent.shorthand === true
  )
}

function isStaticPropertyKey(parent: AstNode, node: AstNode): boolean {
  return (
    isPropertyNode(parent) &&
    isSameNodeRange(getNode(parent, 'key'), node) &&
    parent.computed !== true
  )
}

function isPropertyNode(node: AstNode): boolean {
  return node.type === 'Property' || node.type === 'ObjectProperty'
}

function isSameNodeRange(left: AstNode | null, right: AstNode): boolean {
  return left !== null && left.start === right.start && left.end === right.end
}

function getSetupStatements(body: AstNode): AstNode[] {
  let statements = getNodeArray(body, 'body')
  let returnIndex = statements.findIndex((statement) => statement.type === 'ReturnStatement')
  if (returnIndex === -1) return statements

  return [
    ...statements.slice(0, returnIndex),
    ...statements
      .slice(returnIndex + 1)
      .filter((statement) => statement.type === 'FunctionDeclaration'),
  ]
}

function getRenderArgument(body: AstNode): AstNode | null {
  let returnStatement = getNodeArray(body, 'body').find(
    (statement) => statement.type === 'ReturnStatement',
  )
  return returnStatement ? getNode(returnStatement, 'argument') : null
}

function getExportDeclaration(node: AstNode): AstNode | null {
  if (node.type !== 'ExportNamedDeclaration') return null
  return getNode(node, 'declaration')
}

function getExportedNames(program: AstNode): Set<string> {
  let names = new Set<string>()

  for (let item of getNodeArray(program, 'body')) {
    if (item.type !== 'ExportNamedDeclaration') continue

    for (let specifier of getNodeArray(item, 'specifiers')) {
      let localName = getIdentifierName(getNode(specifier, 'local'))
      let exportedName = getIdentifierName(getNode(specifier, 'exported'))
      if (localName && localName === exportedName && isPascalCase(localName)) {
        names.add(localName)
      }
    }
  }

  return names
}

function getTrackedExports(program: AstNode): TrackedExport[] {
  let trackedExports: TrackedExport[] = []

  for (let item of getNodeArray(program, 'body')) {
    if (item.type !== 'ExportNamedDeclaration') continue
    if (isTypeOnlyExport(item)) continue

    let declaration = getNode(item, 'declaration')
    if (declaration) {
      addDeclarationTrackedExports(declaration, trackedExports)
      continue
    }

    for (let specifier of getNodeArray(item, 'specifiers')) {
      if (specifier.exportKind === 'type') continue
      let exportedName = getIdentifierName(getNode(specifier, 'exported'))
      let localName = getIdentifierName(getNode(specifier, 'local'))
      if (exportedName && localName) {
        trackedExports.push({ exportedName, localName })
      }
    }
  }

  return trackedExports
}

function hasUnsafeTrackedExports(program: AstNode): boolean {
  for (let item of getNodeArray(program, 'body')) {
    if (item.type === 'ExportAllDeclaration' && item.exportKind !== 'type') {
      return true
    }

    if (item.type !== 'ExportNamedDeclaration') continue
    if (isTypeOnlyExport(item)) continue

    if (getNode(item, 'source')) return true

    let declaration = getNode(item, 'declaration')
    if (declaration && !isRuntimeValueDeclaration(declaration)) {
      return true
    }
  }

  return false
}

function isTypeOnlyExport(node: AstNode): boolean {
  return node.exportKind === 'type'
}

function addDeclarationTrackedExports(declaration: AstNode, trackedExports: TrackedExport[]): void {
  if (declaration.type === 'FunctionDeclaration' || declaration.type === 'ClassDeclaration') {
    let name = getIdentifierName(getNode(declaration, 'id'))
    if (name) trackedExports.push({ exportedName: name, localName: name })
    return
  }

  if (declaration.type === 'VariableDeclaration') {
    for (let declarator of getNodeArray(declaration, 'declarations')) {
      let id = getNode(declarator, 'id')
      if (!id) continue
      for (let name of getBindingNames(id)) {
        trackedExports.push({ exportedName: name, localName: name })
      }
    }
  }
}

function isRuntimeValueDeclaration(declaration: AstNode): boolean {
  return (
    declaration.type === 'FunctionDeclaration' ||
    declaration.type === 'ClassDeclaration' ||
    declaration.type === 'VariableDeclaration'
  )
}

function isComponentExport(
  name: string | null,
  options: {
    directExport: boolean
    exportedNames: ReadonlySet<string>
  },
): name is string {
  if (!name || !isPascalCase(name)) return false
  return options.directExport || options.exportedNames.has(name)
}

function getParamsSource(node: AstNode, source: string): MagicString {
  let params = getNodeArray(node, 'params')
  if (params.length === 0) return new MagicString('')
  return new MagicString(source).snip(params[0].start, params[params.length - 1].end)
}

function getSetupHash(body: AstNode, source: string): string {
  let statements = getNodeArray(body, 'body')
  let returnIndex = statements.findIndex((statement) => statement.type === 'ReturnStatement')
  let setupStart = body.start + 1
  let returnStatement = statements[returnIndex]
  let setupEnd = returnStatement?.start ?? body.end - 1
  let hoistedDeclarations =
    returnIndex === -1
      ? []
      : statements
          .slice(returnIndex + 1)
          .filter((statement) => statement.type === 'FunctionDeclaration')
          .map((statement) => source.slice(statement.start, statement.end))

  return hashSource([source.slice(setupStart, setupEnd), ...hoistedDeclarations].join('\n'))
}

function isNamedCallExpression(node: AstNode | null, name: string): node is AstNode {
  if (!node || node.type !== 'CallExpression') return false
  return getIdentifierName(getNode(node, 'callee')) === name
}

function getIdentifierName(node: AstNode | null): string | null {
  if (!node || (node.type !== 'Identifier' && node.type !== 'JSXIdentifier')) return null
  return typeof node.name === 'string' ? node.name : null
}

function getNode(node: AstNode, key: string): AstNode | null {
  let value = node[key]
  return isAstNode(value) ? value : null
}

function getNodeArray(node: AstNode, key: string): AstNode[] {
  let value = node[key]
  return Array.isArray(value) ? value.filter(isAstNode) : []
}

function isAstNode(value: unknown): value is AstNode {
  return typeof value === 'object' && value !== null && 'type' in value
}

function isPascalCase(name: string): boolean {
  return /^[A-Z]/.test(name)
}

function hashSource(source: string): string {
  let hash = 0
  for (let index = 0; index < source.length; index++) {
    hash = ((hash << 5) - hash + source.charCodeAt(index)) | 0
  }
  return `h${Math.abs(hash).toString(36)}`
}

import { measureSync } from '../../../../scripts/hmr-performance-metrics.ts'
import {
  analyze,
  type Scope,
  type ScopeManager,
  type Variable,
} from '@typescript-eslint/scope-manager'
import MagicString from 'magic-string'
import { parseSync, visitorKeys } from 'oxc-parser'
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
  statementStart: number | null
  statementEnd: number | null
  fullEnd: number
  fullStart: number
  name: string
  params: SourceFragment
  wrapperParams: string
  functionExpressionName: string | null
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
  params: SourceFragment
  wrapperParams: string
  functionExpressionName: string | null
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
  return measureSync('component-browser', options.moduleUrl, source.length, () => {
    let ast = parseModule(source)
    if (!ast) return createUnchangedResult(source)

    let matchResult = findMatches(ast, source)
    if (!isSafeComponentHmrBoundary(matchResult)) {
      return createUnchangedResult(source)
    }
    let { componentMatches, clientEntryMatches, trackedExports } = matchResult

    let referenceInfo = createReferenceInfo(ast)
    if (!referenceInfo) return createUnchangedResult(source)
    let setupBindings = new Map<ComponentMatch | ClientEntryMatch, Variable[]>()
    for (let match of [...componentMatches, ...clientEntryMatches]) {
      let bindings = getComponentSetupBindings(match, referenceInfo)
      if (!bindings) return createUnchangedResult(source)
      setupBindings.set(match, bindings)
      let hoistedVarNames = getHoistedSetupVarNames(match, bindings)
      if (hoistedVarNames.length) {
        match.setupHash = hashSource([match.setupHash, ...hoistedVarNames].join('\n'))
      }
    }
    let identifiers = {
      componentHmr: getUnusedName('__remixComponentHmr__', referenceInfo.names),
      componentRefresh: getUnusedName('__remixComponentRefresh__', referenceInfo.names),
      componentNames: getUnusedName('__remixComponentHmrComponentNames__', referenceInfo.names),
      acceptComponentModule: getUnusedName(
        '__remixComponentHmrAcceptComponentModule__',
        referenceInfo.names,
      ),
      previousExports: getUnusedName('__remixComponentHmrPreviousExports__', referenceInfo.names),
      invalidationMessage: getUnusedName(
        '__remixComponentHmrInvalidationMessage__',
        referenceInfo.names,
      ),
    }
    let importSpecifiers = getComponentHmrImportSpecifiers(options.importSource)
    let edits: SourceEdit[] = []
    let componentNames: string[] = []
    let componentWrappers: string[] = []

    for (let match of componentMatches) {
      componentNames.push(match.name)

      let componentIdentifiers = {
        ...identifiers,
        implementation: getUnusedName(
          `__remixComponentHmrImpl_${match.name}__`,
          referenceInfo.names,
        ),
        wrapper: getUnusedName(`__remixComponentHmrWrapper_${match.name}__`, referenceInfo.names),
      }

      componentWrappers.push(componentIdentifiers.wrapper)

      let implementation = createHmrImplementationBody(
        match,
        source,
        options.moduleUrl,
        setupBindings.get(match) ?? [],
        referenceInfo,
        componentIdentifiers,
      )

      let implementationSource = createImplementationSource(
        match,
        componentIdentifiers.implementation,
        implementation,
        match.wrapperParams,
      )
      let wrapperSource = [
        `function ${match.functionExpressionName ?? match.name}(${match.wrapperParams}) {`,
        `  return ${componentIdentifiers.componentHmr}.getCurrentComponentForHmr(${JSON.stringify(options.moduleUrl)}, ${JSON.stringify(match.name)}, ${componentIdentifiers.wrapper}).apply(void 0, arguments);`,
        `}`,
      ].join('\n')
      let registrationSource = `${componentIdentifiers.wrapper} = ${match.name};\n${componentIdentifiers.componentHmr}.registerComponentForHmr(${componentIdentifiers.componentRefresh}, ${JSON.stringify(options.moduleUrl)}, ${JSON.stringify(match.name)}, ${componentIdentifiers.implementation}, ${JSON.stringify(match.setupHash)}, ${componentIdentifiers.wrapper});`
      rewriteComponentMatch(edits, match, implementationSource, wrapperSource, registrationSource)
    }

    for (let match of clientEntryMatches) {
      componentNames.push(match.name)

      let componentIdentifiers = {
        ...identifiers,
        implementation: getUnusedName(
          `__remixComponentHmrImpl_${match.name}__`,
          referenceInfo.names,
        ),
        wrapper: getUnusedName(`__remixComponentHmrWrapper_${match.name}__`, referenceInfo.names),
      }

      componentWrappers.push(componentIdentifiers.wrapper)

      let selfWrapper = getComponentSelfBindings(match, referenceInfo).length
        ? getUnusedName(`__remixComponentHmrSelfWrapper_${match.name}__`, referenceInfo.names)
        : null
      let implementation = createHmrImplementationBody(
        match,
        source,
        options.moduleUrl,
        setupBindings.get(match) ?? [],
        referenceInfo,
        componentIdentifiers,
        selfWrapper ?? componentIdentifiers.wrapper,
      )

      let wrapperSource = [
        `function ${match.functionName}(${match.wrapperParams}) {`,
        `  return ${componentIdentifiers.componentHmr}.getCurrentComponentForHmr(${JSON.stringify(
          options.moduleUrl,
        )}, ${JSON.stringify(match.name)}, ${componentIdentifiers.wrapper}).apply(void 0, arguments);`,
        `}`,
      ].join('\n')

      edits.push(
        {
          kind: 'prepend',
          start: match.statementStart,
          end: match.statementStart,
          fragments: [
            selfWrapper ? `let ${selfWrapper};\n` : '',
            ...createImplementationSource(
              match,
              componentIdentifiers.implementation,
              implementation,
              match.wrapperParams,
            ),
            '\n',
          ],
        },
        {
          kind: 'overwrite',
          start: match.functionStart,
          end: match.functionEnd,
          fragments: [selfWrapper ? `(${selfWrapper} = ${wrapperSource})` : wrapperSource],
        },
        {
          kind: 'append',
          start: match.statementEnd,
          end: match.statementEnd,
          fragments: [
            `\n${componentIdentifiers.wrapper} = ${match.name};\n${componentIdentifiers.componentHmr}.registerComponentForHmr(${componentIdentifiers.componentRefresh}, ${JSON.stringify(
              options.moduleUrl,
            )}, ${JSON.stringify(match.name)}, ${componentIdentifiers.implementation}, ${JSON.stringify(
              match.setupHash,
            )}, ${componentIdentifiers.wrapper});`,
          ],
        },
      )
    }

    let imports = [
      `import { __componentHmrBrowserRuntime__ as ${identifiers.componentHmr} } from ${JSON.stringify(
        importSpecifiers.browserRuntimeSpecifier,
      )};`,
      `import * as ${identifiers.componentRefresh} from ${JSON.stringify(importSpecifiers.refreshSpecifier)};`,
      `let ${componentWrappers.join(', ')};`,
      ``,
    ].join('\n')
    let footer = [
      ``,
      `if (import.meta.hot) {`,
      `  let ${identifiers.componentNames} = ${JSON.stringify(componentNames)};`,
      `  let ${identifiers.acceptComponentModule} = ${createComponentNamesCheckSource(
        options.moduleUrl,
        identifiers.componentNames,
        {
          spaces: 0,
          clientEntryNames: clientEntryMatches.map((match) => match.name),
        },
      )};`,
      `  let ${identifiers.previousExports} = ${createPreviousExportsSource(trackedExports)};`,
      `  import.meta.hot.accept((module) => {`,
      `    if (!${identifiers.acceptComponentModule}) return;`,
      `    if (module && typeof module === 'object') {`,
      `      let ${identifiers.invalidationMessage} = ${identifiers.componentHmr}.getComponentModuleInvalidationMessage(module, ${identifiers.previousExports}, ${identifiers.componentNames});`,
      `      if (${identifiers.invalidationMessage}) {`,
      `        import.meta.hot.invalidate(${identifiers.invalidationMessage});`,
      `        return;`,
      `      }`,
      `      ${identifiers.componentHmr}.updateComponentModuleForHmr(${identifiers.componentRefresh}, ${JSON.stringify(
        options.moduleUrl,
      )}, module);`,
      `    } else {`,
      `      import.meta.hot.invalidate('Updated component module did not evaluate to an object');`,
      `    }`,
      `  });`,
      `}`,
      `${identifiers.componentHmr}.commitComponentModuleForHmr([${componentWrappers.join(', ')}]);`,
    ].join('\n')

    let fragments = assembleModule(source, edits, imports, footer)
    let code = fragments.join('')

    return {
      code,
      componentNames,
      map: options.sourceMap ? generateSourceMap(fragments, code, source, options.moduleUrl) : null,
      transformed: true,
    }
  })
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
  return measureSync('component-server', options.moduleUrl, source.length, () => {
    let ast = parseModule(source)
    if (!ast) return createUnchangedResult(source)

    let matchResult = findMatches(ast, source)
    if (!isSafeComponentHmrBoundary(matchResult)) {
      return createUnchangedResult(source)
    }
    let { componentMatches, clientEntryMatches, trackedExports } = matchResult

    let referenceInfo = createReferenceInfo(ast)
    if (!referenceInfo) return createUnchangedResult(source)
    for (let match of [...componentMatches, ...clientEntryMatches]) {
      // Rewriting a named self-binding cannot preserve names looked up by direct eval.
      if (match.functionExpressionName && !getComponentSetupBindings(match, referenceInfo)) {
        return createUnchangedResult(source)
      }
    }
    let names = referenceInfo.names
    let identifiers = {
      componentHmr: getUnusedName('__remixComponentHmr__', names),
      componentNames: getUnusedName('__remixComponentHmrComponentNames__', names),
      acceptComponentModule: getUnusedName('__remixComponentHmrAcceptComponentModule__', names),
      previousExports: getUnusedName('__remixComponentHmrPreviousExports__', names),
      invalidationMessage: getUnusedName('__remixComponentHmrInvalidationMessage__', names),
    }
    let importSpecifiers = getComponentHmrImportSpecifiers(options.importSource)
    let edits: SourceEdit[] = []
    let componentNames: string[] = []
    let componentWrappers: string[] = []

    for (let match of componentMatches) {
      componentNames.push(match.name)

      let componentIdentifiers = {
        ...identifiers,
        implementation: getUnusedName(`__remixComponentHmrImpl_${match.name}__`, names),
        wrapper: getUnusedName(`__remixComponentHmrWrapper_${match.name}__`, names),
        self: getUnusedName(`__remixComponentHmrSelf_${match.name}__`, names),
      }

      componentWrappers.push(componentIdentifiers.wrapper)

      let selfBindings = getComponentSelfBindings(match, referenceInfo)
      let bodySnippet = rewriteReferences(
        { type: 'BlockStatement', start: match.bodyStart, end: match.bodyEnd },
        selfBindings,
        source,
        componentIdentifiers.self,
        referenceInfo,
      )
      let bodySource = [bodySnippet]
      let implementationSource = createImplementationSource(
        match,
        componentIdentifiers.implementation,
        bodySource,
        rewriteSelfParams(match, source, selfBindings, componentIdentifiers.self, referenceInfo),
      )
      let wrapperSource = [
        `function ${match.functionExpressionName ?? match.name}(${match.wrapperParams}) {`,
        `  return ${componentIdentifiers.componentHmr}.getCurrentComponentForHmr(${JSON.stringify(options.moduleUrl)}, ${JSON.stringify(match.name)}, ${componentIdentifiers.wrapper}).apply(void 0, arguments);`,
        `}`,
      ].join('\n')
      let registrationSource = `${componentIdentifiers.wrapper} = ${match.name};\n${createSelfBindingSource(selfBindings, componentIdentifiers.self, componentIdentifiers.wrapper)}\n${componentIdentifiers.componentHmr}.registerComponentForHmr(${JSON.stringify(options.moduleUrl)}, ${JSON.stringify(match.name)}, ${componentIdentifiers.implementation}, ${componentIdentifiers.wrapper});`
      rewriteComponentMatch(edits, match, implementationSource, wrapperSource, registrationSource)
    }

    for (let match of clientEntryMatches) {
      componentNames.push(match.name)

      let componentIdentifiers = {
        ...identifiers,
        implementation: getUnusedName(`__remixComponentHmrImpl_${match.name}__`, names),
        wrapper: getUnusedName(`__remixComponentHmrWrapper_${match.name}__`, names),
        self: getUnusedName(`__remixComponentHmrSelf_${match.name}__`, names),
      }

      componentWrappers.push(componentIdentifiers.wrapper)

      let selfBindings = getComponentSelfBindings(match, referenceInfo)
      let selfWrapper = selfBindings.length
        ? getUnusedName(`__remixComponentHmrSelfWrapper_${match.name}__`, names)
        : null
      let bodySnippet = rewriteReferences(
        { type: 'BlockStatement', start: match.bodyStart, end: match.bodyEnd },
        selfBindings,
        source,
        componentIdentifiers.self,
        referenceInfo,
      )
      let bodySource = [bodySnippet]
      let wrapperSource = [
        `function ${match.functionName}(${match.wrapperParams}) {`,
        `  return ${componentIdentifiers.componentHmr}.getCurrentComponentForHmr(${JSON.stringify(
          options.moduleUrl,
        )}, ${JSON.stringify(match.name)}, ${componentIdentifiers.wrapper}).apply(void 0, arguments);`,
        `}`,
      ].join('\n')

      let implementationSource = createImplementationSource(
        match,
        componentIdentifiers.implementation,
        bodySource,
        rewriteSelfParams(match, source, selfBindings, componentIdentifiers.self, referenceInfo),
      )
      edits.push(
        {
          kind: 'append',
          start: match.statementStart,
          end: match.statementStart,
          fragments: [selfWrapper ? `let ${selfWrapper};\n` : '', ...implementationSource, '\n'],
        },
        {
          kind: 'overwrite',
          start: match.functionStart,
          end: match.functionEnd,
          fragments: [selfWrapper ? `(${selfWrapper} = ${wrapperSource})` : wrapperSource],
        },
        {
          kind: 'append',
          start: match.statementEnd,
          end: match.statementEnd,
          fragments: [
            `\n${componentIdentifiers.wrapper} = ${match.name};\n${createSelfBindingSource(selfBindings, componentIdentifiers.self, selfWrapper ?? componentIdentifiers.wrapper)}\n${componentIdentifiers.componentHmr}.registerComponentForHmr(${JSON.stringify(
              options.moduleUrl,
            )}, ${JSON.stringify(match.name)}, ${componentIdentifiers.implementation}, ${componentIdentifiers.wrapper});`,
          ],
        },
      )
    }

    let imports = [
      `import { __componentHmrServerRuntime__ as ${identifiers.componentHmr} } from ${JSON.stringify(
        importSpecifiers.serverRuntimeSpecifier,
      )};`,
      `let ${componentWrappers.join(', ')};`,
      ``,
    ].join('\n')
    let footer = [
      ``,
      `if (import.meta.hot) {`,
      `  let ${identifiers.componentNames} = ${JSON.stringify(componentNames)};`,
      `  let ${identifiers.acceptComponentModule} = ${createComponentNamesCheckSource(
        options.moduleUrl,
        identifiers.componentNames,
        {
          spaces: 0,
          clientEntryNames: clientEntryMatches.map((match) => match.name),
        },
      )};`,
      `  let ${identifiers.previousExports} = ${createPreviousExportsSource(trackedExports)};`,
      `  import.meta.hot.accept((module) => {`,
      `    if (!${identifiers.acceptComponentModule}) return;`,
      `    if (!module || typeof module !== 'object') {`,
      `      import.meta.hot.invalidate('Updated component module did not evaluate to an object');`,
      `      return;`,
      `    }`,
      `    let ${identifiers.invalidationMessage} = ${identifiers.componentHmr}.getComponentModuleInvalidationMessage(module, ${identifiers.previousExports}, ${identifiers.componentNames});`,
      `    if (${identifiers.invalidationMessage}) {`,
      `      import.meta.hot.invalidate(${identifiers.invalidationMessage});`,
      `    }`,
      `  });`,
      `}`,
      `${identifiers.componentHmr}.commitComponentModuleForHmr([${componentWrappers.join(', ')}]);`,
    ].join('\n')

    let fragments = assembleModule(source, edits, imports, footer)
    let code = fragments.join('')

    return {
      code,
      componentNames,
      map: options.sourceMap ? generateSourceMap(fragments, code, source, options.moduleUrl) : null,
      transformed: true,
    }
  })
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
      astType: 'ts',
      range: true,
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
        fullEnd: declaration.end,
        fullStart: declaration.start,
        statementStart: directExport ? item.start : statement.start,
        statementEnd: directExport ? item.end : statement.end,
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
        `  [${JSON.stringify(trackedExport.exportedName)}]: ${trackedExport.localName},`,
    ),
    `}`,
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
    wrapperParams: getWrapperParamsSource(node, source),
    functionExpressionName: null,
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
    statementStart: number
    statementEnd: number
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
    statementStart: options.statementStart,
    statementEnd: options.statementEnd,
    name,
    params: getParamsSource(init, source),
    wrapperParams: getWrapperParamsSource(init, source),
    functionExpressionName: getIdentifierName(getNode(init, 'id')),
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
    wrapperParams: getWrapperParamsSource(componentFunction, source),
    functionExpressionName: getIdentifierName(getNode(componentFunction, 'id')),
    renderArgument: getRenderArgument(body)!,
    setupHash: getSetupHash(
      body,
      source,
      getParamsSource(componentFunction, source),
      getIdentifierName(getNode(componentFunction, 'id')),
    ),
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
  statementStart?: number
  statementEnd?: number
  fullEnd: number
  fullStart: number
  name: string
  params: SourceFragment
  wrapperParams: string
  functionExpressionName: string | null
  source: string
}): ComponentMatch | null {
  if (!options.body) return null
  let renderArgument = getRenderArgument(options.body)
  if (!renderArgument) return null

  return {
    bodyEnd: options.body.end,
    bodyStart: options.body.start,
    directExport: options.directExport,
    statementStart: options.statementStart ?? null,
    statementEnd: options.statementEnd ?? null,
    fullEnd: options.fullEnd,
    fullStart: options.fullStart,
    name: options.name,
    params: options.params,
    wrapperParams: options.wrapperParams,
    functionExpressionName: options.functionExpressionName,
    renderArgument,
    setupHash: getSetupHash(
      options.body,
      options.source,
      options.params,
      options.functionExpressionName,
    ),
    setupStatements: getSetupStatements(options.body),
  }
}

type ReferenceInfo = {
  manager: ScopeManager
  names: Set<string>
  nodes: Map<number, { node: AstNode; parent: AstNode | null }>
  parents: WeakMap<AstNode, AstNode | null>
}

function createReferenceInfo(program: AstNode): ReferenceInfo | null {
  // Oxc's astType: 'ts' output uses TS-ESTree shapes. scope-manager only consumes node
  // shapes and ranges, not the loc/comments/tokens metadata required by its types.
  let manager: ScopeManager
  try {
    manager = analyze(program as unknown as Parameters<typeof analyze>[0], {
      sourceType: 'module',
      childVisitorKeys: visitorKeys,
      lib: [],
      jsxPragma: null,
    })
  } catch {
    return null
  }
  resolveImplicitArguments(manager)
  return { manager, ...getAstInfo(program) }
}

function resolveImplicitArguments(manager: ScopeManager): void {
  // scope-manager excludes implicit arguments when resolving parameter defaults against
  // body declarations. Unlike body declarations, this binding exists while defaults run.
  for (let scope of manager.scopes) {
    for (let reference of scope.references) {
      if (!reference.isValueReference || reference.identifier.name !== 'arguments') continue
      let owner: Scope | null = reference.from
      while (
        owner &&
        (owner.type !== 'function' || owner.block.type === 'ArrowFunctionExpression')
      ) {
        owner = owner.upper
      }
      let binding = owner?.set.get('arguments')
      if (!binding || binding === reference.resolved) continue
      if (reference.resolved) {
        let index = reference.resolved.references.indexOf(reference)
        if (index !== -1) reference.resolved.references.splice(index, 1)
      }
      reference.resolved = binding
      binding.references.push(reference)
      for (let scope: Scope | null = owner; scope; scope = scope.upper) {
        scope.through = scope.through.filter((item) => item !== reference)
      }
    }
  }
}

function getAstInfo(program: AstNode): Omit<ReferenceInfo, 'manager'> {
  let names = new Set<string>()
  let nodes: ReferenceInfo['nodes'] = new Map()
  let parents: ReferenceInfo['parents'] = new WeakMap()
  function visit(node: AstNode, parent: AstNode | null): void {
    nodes.set(node.start, { node, parent })
    parents.set(node, parent)
    let name = getIdentifierName(node)
    if (name) names.add(name)
    for (let key of visitorKeys[node.type] ?? []) {
      let child = getNode(node, key)
      if (child) visit(child, node)
      else for (let item of getNodeArray(node, key)) visit(item, node)
    }
  }
  visit(program, null)
  return { names, nodes, parents }
}

function getUnusedName(base: string, names: Set<string>): string {
  let name = base
  let suffix = 0
  while (names.has(name)) name = `${base}${++suffix}`
  names.add(name)
  return name
}

function getComponentSetupBindings(
  match: ComponentMatch | ClientEntryMatch,
  referenceInfo: ReferenceInfo,
): Variable[] | null {
  let scope = referenceInfo.manager.scopes.find(
    (scope) =>
      scope.type === 'function' &&
      isAstNode(scope.block) &&
      getNode(scope.block, 'body')?.start === match.bodyStart,
  )
  if (!scope) return null
  for (let { node, parent } of referenceInfo.nodes.values()) {
    if (
      node.type !== 'ReturnStatement' ||
      getNode(node, 'argument') === match.renderArgument ||
      node.start >= match.renderArgument.start ||
      node.start < match.bodyStart
    )
      continue
    while (
      parent &&
      !['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(
        parent.type,
      )
    )
      parent = referenceInfo.parents.get(parent) ?? null
    if (parent && getNode(parent, 'body')?.start === match.bodyStart) return null
  }
  let inSetup = (start: number, end: number) =>
    match.setupStatements.some((statement) => start >= statement.start && end <= statement.end)
  let bindings: Variable[] = []
  // Named function expressions have an immutable self-binding in the enclosing name scope.
  if (scope.upper?.type === 'function-expression-name') {
    for (let variable of scope.upper.variables) {
      if (variable.references.some((ref) => ref.isValueReference)) bindings.push(variable)
    }
  }
  for (let variable of scope.variables) {
    // TypeScript's this parameter is erased and has no runtime binding.
    if (!variable.isValueVariable || variable.name === 'this') continue
    if (variable.identifiers.length === 0) {
      // The implicit arguments binding has references but no declaration identifier.
      if (variable.name === 'arguments' && variable.references.length > 0) bindings.push(variable)
      continue
    }
    let retained = variable.identifiers.some((id) => inSetup(...id.range))
    let parameter = variable.defs.some((def) => def.type === 'Parameter')
    let hoisted = variable.defs.some((def) => def.type === 'Variable' && def.parent.kind === 'var')
    if (retained || parameter || hoisted) bindings.push(variable)
    else if (
      variable.references.some(
        (ref) =>
          ref.isValueReference &&
          (inSetup(...ref.identifier.range) ||
            (ref.identifier.range[0] >= match.renderArgument.start &&
              ref.identifier.range[1] <= match.renderArgument.end)),
      )
    )
      return null
  }
  // Direct eval can reference lexical bindings that never appear as identifier nodes.
  for (let nestedScope of referenceInfo.manager.scopes) {
    for (let ref of nestedScope.references) {
      let [start, end] = ref.identifier.range
      if (
        ref.resolved ||
        ref.identifier.name !== 'eval' ||
        start < scope.block.range[0] ||
        end > match.bodyEnd
      )
        continue
      let entry = referenceInfo.nodes.get(start)
      if (entry) {
        let expression = entry.node
        let parent = entry.parent
        while (
          parent &&
          [
            'ParenthesizedExpression',
            'TSAsExpression',
            'TSSatisfiesExpression',
            'TSTypeAssertion',
            'TSNonNullExpression',
            'TSInstantiationExpression',
          ].includes(parent.type) &&
          getNode(parent, 'expression') === expression
        ) {
          expression = parent
          parent = referenceInfo.parents.get(parent) ?? null
        }
        if (parent?.type === 'CallExpression' && getNode(parent, 'callee') === expression)
          return null
      }
    }
  }
  return bindings
}

function getHoistedSetupVarNames(
  match: ComponentMatch | ClientEntryMatch,
  bindings: readonly Variable[],
): string[] {
  return bindings
    .filter((binding) =>
      binding.defs.some(
        (def) =>
          def.type === 'Variable' &&
          def.parent.kind === 'var' &&
          !match.setupStatements.some(
            (statement) =>
              def.name.range[0] >= statement.start && def.name.range[1] <= statement.end,
          ),
      ),
    )
    .map((binding) => binding.name)
}

function createHmrImplementationBody(
  match: ComponentMatch | ClientEntryMatch,
  source: string,
  moduleUrl: string,
  bindings: readonly Variable[],
  referenceInfo: ReferenceInfo,
  moduleIdentifiers: {
    componentHmr: string
    componentRefresh: string
    implementation: string
    wrapper: string
  },
  selfWrapper = moduleIdentifiers.wrapper,
): SourceFragment[] {
  let names = new Set(referenceInfo.names)
  let identifiers = {
    ...moduleIdentifiers,
    state: getUnusedName('__remixComponentHmrState__', names),
    handle: getUnusedName('__remixComponentHmrHandle__', names),
    next: getUnusedName('__remixComponentHmrNext__', names),
    self: getUnusedName('__remixComponentHmrSelf__', names),
  }
  let selfBindings = getComponentSelfBindings(match, referenceInfo)
  let setupSource: SourceFragment[] = []
  for (let statement of match.setupStatements) {
    setupSource.push(
      rewriteReferences(statement, selfBindings, source, identifiers.self, referenceInfo),
      '\n',
    )
  }
  // Unreachable var declarations still create function-scope cells. Retain those cells
  // without executing the initializers, destructuring, or enclosing statements.
  let hoistedVarNames = getHoistedSetupVarNames(match, bindings)
  if (hoistedVarNames.length) setupSource.push(`\nvar ${hoistedVarNames.join(', ')};`)
  for (let binding of bindings) {
    let immutable =
      (binding.name === 'arguments' && binding.identifiers.length === 0) ||
      binding.defs.some(
        (def) =>
          (def.type === 'Variable' && def.parent.kind === 'const') ||
          (def.type === 'FunctionName' && def.node.type === 'FunctionExpression'),
      )
    let setter = immutable
      ? ''
      : `, (${identifiers.next}) => { ${binding.name} = ${identifiers.next}; }`
    setupSource.push(
      `\n${identifiers.componentHmr}.retainComponentHmrBinding(${identifiers.state}, ${JSON.stringify(binding.name)}, () => ${selfBindings.includes(binding) ? `${identifiers.self}.${binding.name}` : binding.name}${setter});`,
    )
  }
  let renderSnippet = rewriteReferences(
    match.renderArgument,
    bindings,
    source,
    identifiers.state,
    referenceInfo,
  )

  // Evaluate native parameters only when setup runs, and retain their lexical cells with
  // the body bindings. Refreshed renders must share defaults and destructured values too.
  return [
    `{\n`,
    createSelfBindingSource(selfBindings, identifiers.self, selfWrapper),
    '\n',
    `  let ${identifiers.handle} = ${identifiers.componentHmr}.getComponentHandleForHmr(arguments[0], ${JSON.stringify(moduleUrl)}, ${JSON.stringify(match.name)});\n`,
    `  let ${identifiers.state} = ${identifiers.componentHmr}.getComponentHmrState(${identifiers.handle});\n`,
    `  if (${identifiers.componentHmr}.setupComponentForHmr(${identifiers.handle}, ${identifiers.state}, ${JSON.stringify(moduleUrl)}, ${JSON.stringify(match.name)}, ${JSON.stringify(match.setupHash)}, () => {\n`,
    `    (function (`,
    rewriteSelfParams(match, source, selfBindings, identifiers.self, referenceInfo),
    `) {\n`,
    ...setupSource,
    '\n',
    `    }).apply(this, arguments);\n`,
    `  }, ${identifiers.wrapper})) {\n`,
    `    return () => null;\n`,
    `  }\n`,
    `  ${identifiers.componentHmr}.registerComponentRenderForHmr(${identifiers.componentRefresh}, ${JSON.stringify(moduleUrl)}, ${JSON.stringify(match.name)}, ${identifiers.handle}, `,
    renderSnippet,
    `, ${identifiers.wrapper});\n`,
    `  return function () {\n`,
    `    return ${identifiers.componentHmr}.callComponentRenderForHmr(${identifiers.handle}, ...arguments);\n`,
    `  };\n`,
    `}`,
  ]
}

function getComponentSelfBindings(
  match: ComponentMatch | ClientEntryMatch,
  info: ReferenceInfo,
): Variable[] {
  let scope = info.manager.scopes.find(
    (scope) =>
      scope.type === 'function' &&
      isAstNode(scope.block) &&
      getNode(scope.block, 'body')?.start === match.bodyStart,
  )
  return scope?.upper?.type === 'function-expression-name'
    ? scope.upper.variables.filter((binding) =>
        binding.references.some((ref) => ref.isValueReference),
      )
    : []
}

function createSelfBindingSource(
  bindings: readonly Variable[],
  selfName: string,
  wrapperName: string,
): string {
  return bindings.length
    ? `const ${selfName} = { ${bindings.map((binding) => `get ${binding.name}() { return ${wrapperName}; }`).join(', ')} };`
    : ''
}

function rewriteSelfParams(
  match: ComponentMatch | ClientEntryMatch,
  source: string,
  bindings: readonly Variable[],
  stateName: string,
  info: ReferenceInfo,
): SourceFragment {
  let scope = info.manager.scopes.find(
    (scope) =>
      scope.type === 'function' &&
      isAstNode(scope.block) &&
      getNode(scope.block, 'body')?.start === match.bodyStart,
  )
  if (!scope || !isAstNode(scope.block)) return match.params
  let params = getNodeArray(scope.block, 'params')
  if (!params.length) return ''
  return rewriteReferences(
    { type: 'Parameters', start: params[0].start, end: params[params.length - 1].end },
    bindings,
    source,
    stateName,
    info,
  )
}

function rewriteReferences(
  root: AstNode,
  bindings: readonly Variable[],
  source: string,
  stateName: string,
  info: ReferenceInfo,
): MagicString {
  let rewritten = new MagicString(source).snip(root.start, root.end)
  let starts = new Set<number>()
  let nameWrappers: { start: number; end: number; key: string }[] = []
  for (let binding of bindings) {
    for (let reference of binding.references) {
      let [start, end] = reference.identifier.range
      if (!reference.isValueReference || start < root.start || end > root.end || starts.has(start))
        continue
      starts.add(start)
      let entry = info.nodes.get(start)
      if (!entry) continue
      let { node, parent } = entry
      let expression = node
      let expressionParent = parent
      while (
        expressionParent &&
        [
          'TSAsExpression',
          'TSSatisfiesExpression',
          'TSTypeAssertion',
          'TSNonNullExpression',
          'TSInstantiationExpression',
          'ParenthesizedExpression',
          'ChainExpression',
        ].includes(expressionParent.type) &&
        getNode(expressionParent, 'expression') === expression
      ) {
        expression = expressionParent
        expressionParent = info.parents.get(expression) ?? null
      }
      if (
        expressionParent &&
        ((expressionParent.type === 'AssignmentPattern' &&
          getNode(expressionParent, 'left') === expression) ||
          (expressionParent.type === 'AssignmentExpression' &&
            getNode(expressionParent, 'left') === expression &&
            ['=', '||=', '&&=', '??='].includes(String(expressionParent.operator))))
      ) {
        let right = getNode(expressionParent, 'right')
        let initializer = right
        while (
          initializer &&
          [
            'TSAsExpression',
            'TSSatisfiesExpression',
            'TSTypeAssertion',
            'TSNonNullExpression',
            'TSInstantiationExpression',
            'ParenthesizedExpression',
          ].includes(initializer.type)
        )
          initializer = getNode(initializer, 'expression')
        if (
          right &&
          initializer &&
          (initializer.type === 'ArrowFunctionExpression' ||
            (['FunctionExpression', 'ClassExpression'].includes(initializer.type) &&
              !getNode(initializer, 'id')))
        ) {
          // Identifier assignments infer names; property assignments do not. A property
          // initializer preserves that inference without introducing another lexical scope.
          let key = JSON.stringify(binding.name)
          nameWrappers.push({ start: right.start, end: right.end, key })
        }
      }
      let replacement = `${stateName}.${binding.name}`
      let property = parent?.type === 'AssignmentPattern' ? info.parents.get(parent) : parent
      if (
        property &&
        property.type === 'Property' &&
        property.shorthand === true &&
        isSameNodeRange(getNode(property, 'key'), node)
      ) {
        replacement = `[${JSON.stringify(binding.name)}]: ${replacement}`
      } else if (
        expressionParent &&
        ((expressionParent.type === 'CallExpression' &&
          getNode(expressionParent, 'callee') === expression) ||
          (expressionParent.type === 'TaggedTemplateExpression' &&
            getNode(expressionParent, 'tag') === expression))
      ) {
        // A bare function call must not acquire the HMR state object as its receiver.
        replacement = `(0, ${replacement})`
      }
      rewritten.overwrite(start, end, replacement)
    }
  }
  // Nested initializers can share an end offset. Close inner wrappers first,
  // independently of the order their bindings were declared.
  for (let { start, end, key } of nameWrappers.sort((a, b) => b.start - a.start)) {
    rewritten.prependLeft(start, `({ [${key}]: `)
    rewritten.appendLeft(end, ` })[${key}]`)
  }
  return rewritten
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

function rewriteComponentMatch(
  edits: SourceEdit[],
  match: ComponentMatch,
  implementationSource: SourceFragment[],
  wrapperSource: string,
  registrationSource: string,
): void {
  if (match.statementStart !== null && match.statementEnd !== null) {
    edits.push(
      {
        kind: 'append',
        start: match.statementStart,
        end: match.statementStart,
        fragments: [...implementationSource, '\n'],
      },
      {
        kind: 'overwrite',
        start: match.fullStart,
        end: match.fullEnd,
        fragments: [`${match.name} = ${wrapperSource}`],
      },
      {
        kind: 'append',
        start: match.statementEnd,
        end: match.statementEnd,
        fragments: [`\n${registrationSource}`],
      },
    )
  } else {
    let exportPrefix = match.directExport ? 'export ' : ''
    edits.push({
      kind: 'overwrite',
      start: match.fullStart,
      end: match.fullEnd,
      fragments: [
        ...implementationSource,
        `\n${exportPrefix}${wrapperSource}\n${registrationSource}`,
      ],
    })
  }
}

function createImplementationSource(
  match: ComponentMatch | ClientEntryMatch,
  implementationName: string,
  body: SourceFragment[],
  params = match.params,
): SourceFragment[] {
  return [
    match.functionExpressionName
      ? `let ${implementationName} = function ${match.functionExpressionName}(`
      : `function ${implementationName}(`,
    params,
    ') ',
    ...body,
    match.functionExpressionName ? ';' : '',
  ]
}

function getWrapperParamsSource(node: AstNode, source: string): string {
  let { names } = getAstInfo(node)
  return getNodeArray(node, 'params')
    .map((param, index) => {
      if (param.type === 'Identifier') return source.slice(param.start, param.end)
      if (param.type === 'AssignmentPattern') {
        let left = getNode(param, 'left')
        let name =
          left?.type === 'Identifier'
            ? source.slice(left.start, left.end)
            : getUnusedName(`__remixComponentHmrArg${index}__`, names)
        return `${name} = void 0`
      }
      if (param.type === 'RestElement')
        return `...${getUnusedName(`__remixComponentHmrArg${index}__`, names)}`
      return getUnusedName(`__remixComponentHmrArg${index}__`, names)
    })
    .join(', ')
}

function getParamsSource(node: AstNode, source: string): SourceFragment {
  let params = getNodeArray(node, 'params')
  if (params.length === 0) return ''
  return new MagicString(source).snip(params[0].start, params[params.length - 1].end)
}

function getSetupHash(
  body: AstNode,
  source: string,
  params: SourceFragment,
  functionExpressionName: string | null,
): string {
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

  return hashSource(
    [
      params,
      functionExpressionName ?? '',
      source.slice(setupStart, setupEnd),
      ...hoistedDeclarations,
    ].join('\n'),
  )
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

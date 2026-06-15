import MagicString from 'magic-string'
import { parseSync } from 'oxc-parser'

export interface ComponentHmrTransformResult {
  code: string
  componentNames: string[]
  map: string | null
  transformed: boolean
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
  params: string
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
  params: string
  renderArgument: AstNode
  setupHash: string
  setupStatements: AstNode[]
  statementEnd: number
  statementStart: number
}

const runtimeSpecifier = '@remix-run/ui-hmr/runtime'
const refreshSpecifier = '@remix-run/ui/dev/refresh'

export function transformComponentHmr(
  source: string,
  options: {
    moduleUrl: string
    refreshSpecifier?: string
    runtimeSpecifier?: string
    sourceMap?: boolean
  },
): ComponentHmrTransformResult {
  let ast = parseModule(source)
  if (!ast) return createUnchangedResult(source)

  let { componentMatches, clientEntryMatches } = findMatches(ast, source)
  if (componentMatches.length === 0 && clientEntryMatches.length === 0) {
    return createUnchangedResult(source)
  }

  let rewritten = new MagicString(source)
  let componentNames: string[] = []

  for (let match of componentMatches) {
    componentNames.push(match.name)

    let body = createHmrImplementationBody(match, source, options.moduleUrl)
    let implementationName = `__remixHmrImpl_${match.name}`
    let exportPrefix = match.directExport ? 'export ' : ''
    let replacement = [
      `function ${implementationName}(${match.params}) ${body}`,
      `${exportPrefix}function ${match.name}(${match.params}) {`,
      `  return __remixHmr.getCurrentComponentForHmr(${JSON.stringify(
        options.moduleUrl,
      )}, ${JSON.stringify(match.name)}).apply(undefined, arguments);`,
      `}`,
      `__remixHmr.registerComponentForHmr(__remixUIRefresh, ${JSON.stringify(
        options.moduleUrl,
      )}, ${JSON.stringify(match.name)}, ${implementationName}, ${JSON.stringify(
        match.setupHash,
      )}, ${match.name});`,
    ].join('\n')

    rewritten.overwrite(match.fullStart, match.fullEnd, replacement)
  }

  for (let match of clientEntryMatches) {
    componentNames.push(match.name)

    let body = createHmrImplementationBody(match, source, options.moduleUrl)
    let implementationName = `__remixHmrImpl_${match.name}`
    let wrapperSource = [
      `function ${match.functionName}(${match.params}) {`,
      `  return __remixHmr.getCurrentComponentForHmr(${JSON.stringify(
        options.moduleUrl,
      )}, ${JSON.stringify(match.name)}).apply(undefined, arguments);`,
      `}`,
    ].join('\n')

    rewritten.prependLeft(
      match.statementStart,
      `function ${implementationName}(${match.params}) ${body}\n`,
    )
    rewritten.overwrite(match.functionStart, match.functionEnd, wrapperSource)
    rewritten.appendLeft(
      match.statementEnd,
      `\n__remixHmr.registerComponentForHmr(__remixUIRefresh, ${JSON.stringify(
        options.moduleUrl,
      )}, ${JSON.stringify(match.name)}, ${implementationName}, ${JSON.stringify(
        match.setupHash,
      )}, ${match.name});`,
    )
  }

  rewritten.prepend(
    [
      `import * as __remixHmr from ${JSON.stringify(options.runtimeSpecifier ?? runtimeSpecifier)};`,
      `import * as __remixUIRefresh from ${JSON.stringify(
        options.refreshSpecifier ?? refreshSpecifier,
      )};`,
      ``,
    ].join('\n'),
  )
  rewritten.append(
    [
      ``,
      `if (import.meta.hot) {`,
      `  import.meta.hot.accept((module) => {`,
      `    if (module && typeof module === 'object') {`,
      `      __remixHmr.updateComponentModuleForHmr(__remixUIRefresh, ${JSON.stringify(
        options.moduleUrl,
      )}, module);`,
      `    } else {`,
      `      import.meta.hot.invalidate('Updated component module did not evaluate to an object');`,
      `    }`,
      `  });`,
      `}`,
    ].join('\n'),
  )

  return {
    code: rewritten.toString(),
    componentNames,
    map: options.sourceMap
      ? rewritten
          .generateMap({
            hires: true,
          })
          .toString()
      : null,
    transformed: true,
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

function createUnchangedResult(source: string): ComponentHmrTransformResult {
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
} {
  let exportedNames = getExportedNames(program)
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

  return { componentMatches, clientEntryMatches }
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
  params: string
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
  match: Pick<ComponentMatch, 'name' | 'renderArgument' | 'setupHash' | 'setupStatements'>,
  source: string,
  moduleUrl: string,
): string {
  let stateNames = getSetupStateNames(match.setupStatements)
  let setupSource = createSetupSource(match.setupStatements, stateNames, source)
  let renderSource = rewriteReferences(
    match.renderArgument.start,
    match.renderArgument.end,
    stateNames,
    source,
  )

  return [
    `{`,
    `  let __remixHmrHandle = __remixHmr.getComponentHandleForHmr(arguments[0], ${JSON.stringify(
      moduleUrl,
    )}, ${JSON.stringify(match.name)});`,
    `  let __s = __remixHmr.getComponentHmrState(__remixHmrHandle);`,
    `  if (__remixHmr.setupComponentForHmr(__remixHmrHandle, __s, ${JSON.stringify(
      moduleUrl,
    )}, ${JSON.stringify(match.name)}, ${JSON.stringify(match.setupHash)}, (__s) => {`,
    indent(setupSource, 4),
    `  }, ${match.name})) {`,
    `    return () => null;`,
    `  }`,
    `  __remixHmr.registerComponentRenderForHmr(__remixUIRefresh, ${JSON.stringify(
      moduleUrl,
    )}, ${JSON.stringify(match.name)}, __remixHmrHandle, ${renderSource}, ${match.name});`,
    `  return function () {`,
    `    return __remixHmr.callComponentRenderForHmr(__remixHmrHandle, ...arguments);`,
    `  };`,
    `}`,
  ].join('\n')
}

function createSetupSource(
  statements: readonly AstNode[],
  stateNames: ReadonlySet<string>,
  source: string,
): string {
  let lines: string[] = []
  let initializedStateNames = new Set<string>()

  for (let statement of statements) {
    if (statement.type === 'VariableDeclaration') {
      for (let declaration of getNodeArray(statement, 'declarations')) {
        let pattern = getNode(declaration, 'id')
        if (!pattern) continue

        let names = getBindingNames(pattern)
        names = names.filter((name) => stateNames.has(name))
        if (names.length === 0) continue

        let init = getNode(declaration, 'init')
        if (pattern?.type === 'Identifier') {
          let name = names[0]
          if (name === undefined) continue
          lines.push(
            init
              ? `__s.${name} = ${rewriteReferences(
                  init.start,
                  init.end,
                  initializedStateNames,
                  source,
                )};`
              : `__s.${name} = undefined;`,
          )
          initializedStateNames.add(name)
          continue
        }

        lines.push(`{`)
        lines.push(
          init
            ? `  let ${source.slice(pattern.start, pattern.end)} = ${rewriteReferences(
                init.start,
                init.end,
                initializedStateNames,
                source,
              )};`
            : `  let ${source.slice(pattern.start, pattern.end)};`,
        )
        for (let name of names) {
          lines.push(`  __s.${name} = ${name};`)
          initializedStateNames.add(name)
        }
        lines.push(`}`)
      }
      continue
    }

    lines.push(rewriteReferences(statement.start, statement.end, initializedStateNames, source))
  }

  return lines.join('\n')
}

function rewriteReferences(
  start: number,
  end: number,
  stateNames: ReadonlySet<string>,
  source: string,
): string {
  if (stateNames.size === 0) return source.slice(start, end)

  let rewritten = new MagicString(source.slice(start, end))
  let ast = parseModule(source.slice(start, end))
  if (!ast) return source.slice(start, end)
  let rewrittenRanges = new Set<string>()

  visitWithScope(ast, null, new Set(), (node, parent, shadowedNames) => {
    if (node.type !== 'Identifier') return
    let name = getIdentifierName(node)
    if (!name || !stateNames.has(name)) return
    if (shadowedNames.has(name)) return
    if (!shouldRewriteIdentifier(node, parent)) return

    if (parent && isShorthandProperty(parent, node)) {
      let key = `${parent.start}:${parent.end}`
      if (rewrittenRanges.has(key)) return
      rewritten.overwrite(parent.start, parent.end, `${name}: __s.${name}`)
      rewrittenRanges.add(key)
      return
    }

    rewritten.overwrite(node.start, node.end, `__s.${name}`)
  })

  return rewritten.toString()
}

function shouldRewriteIdentifier(node: AstNode, parent: AstNode | null): boolean {
  if (!parent) return true
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
    parent.key === node &&
    parent.value === node &&
    parent.shorthand === true
  )
}

function isStaticPropertyKey(parent: AstNode, node: AstNode): boolean {
  return isPropertyNode(parent) && parent.key === node && parent.computed !== true
}

function isPropertyNode(node: AstNode): boolean {
  return node.type === 'Property' || node.type === 'ObjectProperty'
}

function getSetupStatements(body: AstNode): AstNode[] {
  let statements = getNodeArray(body, 'body')
  let returnIndex = statements.findIndex((statement) => statement.type === 'ReturnStatement')
  return returnIndex === -1 ? statements : statements.slice(0, returnIndex)
}

function getRenderArgument(body: AstNode): AstNode | null {
  let returnStatement = getNodeArray(body, 'body').find(
    (statement) => statement.type === 'ReturnStatement',
  )
  return returnStatement ? getNode(returnStatement, 'argument') : null
}

function indent(source: string, spaces: number): string {
  let prefix = ' '.repeat(spaces)
  return source
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => `${prefix}${line}`)
    .join('\n')
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
      let name = getIdentifierName(getNode(specifier, 'local'))
      if (name && isPascalCase(name)) names.add(name)
    }
  }

  return names
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

function getParamsSource(node: AstNode, source: string): string {
  let params = getNodeArray(node, 'params')
  if (params.length === 0) return ''
  return source.slice(params[0].start, params[params.length - 1].end)
}

function getSetupHash(body: AstNode, source: string): string {
  let returnStatement = getNodeArray(body, 'body').find(
    (statement) => statement.type === 'ReturnStatement',
  )
  let setupStart = body.start + 1
  let setupEnd = returnStatement?.start ?? body.end - 1
  return hashSource(source.slice(setupStart, setupEnd))
}

function isNamedCallExpression(node: AstNode | null, name: string): node is AstNode {
  if (!node || node.type !== 'CallExpression') return false
  return getIdentifierName(getNode(node, 'callee')) === name
}

function getIdentifierName(node: AstNode | null): string | null {
  if (!node || node.type !== 'Identifier') return null
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

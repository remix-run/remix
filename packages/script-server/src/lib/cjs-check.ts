import { parseSync, visitorKeys } from 'oxc-parser'

const suspiciousCommonJSPattern =
  /\brequire\s*(?:\(|\.|\[)|\bmodule\s*(?:\.\s*exports|\[\s*['"`]exports['"`]\s*\])|\bexports\s*(?:\.|=|\[)/

interface AstNode {
  type: string
  [key: string]: unknown
}

interface IdentifierNode extends AstNode {
  name: string
}

type Scope = {
  bindings: Set<string>
  kind: 'block' | 'function' | 'module'
  parent: Scope | null
}

export function mayContainCommonJSModuleGlobals(source: string): boolean {
  return suspiciousCommonJSPattern.test(source)
}

// Detects CommonJS module globals that cannot be served as ES modules.
export function isCommonJS(source: string): boolean {
  try {
    let result = parseSync('module.js', source, {
      lang: 'js',
      sourceType: 'module',
    })
    if (result.errors.length > 0) {
      return suspiciousCommonJSPattern.test(source)
    }
    return containsCommonJSModuleGlobals(result.program as unknown as AstNode)
  } catch {
    return suspiciousCommonJSPattern.test(source)
  }
}

function containsCommonJSModuleGlobals(program: AstNode): boolean {
  let moduleScope = createScope(null, 'module')
  let nodeScopes = new WeakMap<object, Scope>()
  nodeScopes.set(program, moduleScope)
  collectScopeBindings(program, moduleScope, nodeScopes)
  return walkForCommonJS(program, nodeScopes, moduleScope)
}

function walkForCommonJS(
  node: AstNode,
  nodeScopes: WeakMap<object, Scope>,
  currentScope: Scope,
  parent: AstNode | null = null,
  key?: string,
): boolean {
  let nextScope = nodeScopes.get(node) ?? currentScope

  switch (node.type) {
    case 'ImportDeclaration':
      return false
    case 'VariableDeclarator':
      if (isAstNode(node.init) && walkForCommonJS(node.init, nodeScopes, nextScope, node, 'init')) {
        return true
      }
      return walkPatternForCommonJS(node.id, nodeScopes, nextScope)
    case 'FunctionDeclaration':
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
      for (let param of getNodeArray(node.params)) {
        if (walkPatternForCommonJS(param, nodeScopes, nextScope)) return true
      }
      return isAstNode(node.body)
        ? walkForCommonJS(node.body, nodeScopes, nextScope, node, 'body')
        : false
    case 'CatchClause':
      if (walkPatternForCommonJS(node.param, nodeScopes, nextScope)) return true
      return isAstNode(node.body)
        ? walkForCommonJS(node.body, nodeScopes, nextScope, node, 'body')
        : false
    case 'Property':
      if (
        node.computed &&
        isAstNode(node.key) &&
        walkForCommonJS(node.key, nodeScopes, nextScope, node, 'key')
      ) {
        return true
      }
      return isAstNode(node.value)
        ? walkForCommonJS(node.value, nodeScopes, nextScope, node, 'value')
        : false
    case 'MemberExpression':
      if (
        isAstNode(node.object) &&
        walkForCommonJS(node.object, nodeScopes, nextScope, node, 'object')
      ) {
        return true
      }
      return (
        !!node.computed &&
        isAstNode(node.property) &&
        walkForCommonJS(node.property, nodeScopes, nextScope, node, 'property')
      )
    case 'ExportSpecifier':
      return isAstNode(node.local)
        ? walkForCommonJS(node.local, nodeScopes, nextScope, node, 'local')
        : false
    case 'Identifier':
      if (!isIdentifier(node) || !isReferenceIdentifier(node, parent, key)) return false
      if (resolveBindingKind(node.name, nextScope) !== null) return false
      return isCommonJSReference(node, parent, key)
  }

  for (let child of getChildNodes(node)) {
    if (walkForCommonJS(child.node, nodeScopes, nextScope, node, child.key)) {
      return true
    }
  }

  return false
}

function walkPatternForCommonJS(
  node: unknown,
  nodeScopes: WeakMap<object, Scope>,
  currentScope: Scope,
): boolean {
  if (!isAstNode(node)) return false

  switch (node.type) {
    case 'Identifier':
      return false
    case 'AssignmentPattern':
      return (
        walkPatternForCommonJS(node.left, nodeScopes, currentScope) ||
        (isAstNode(node.right) && walkForCommonJS(node.right, nodeScopes, currentScope))
      )
    case 'RestElement':
      return walkPatternForCommonJS(node.argument, nodeScopes, currentScope)
    case 'ArrayPattern':
      return getNodeArray(node.elements).some((element) =>
        walkPatternForCommonJS(element, nodeScopes, currentScope),
      )
    case 'ObjectPattern':
      return getNodeArray(node.properties).some((property) => {
        if (property.type === 'Property') {
          return (
            (property.computed &&
              isAstNode(property.key) &&
              walkForCommonJS(property.key, nodeScopes, currentScope, property, 'key')) ||
            walkPatternForCommonJS(property.value, nodeScopes, currentScope)
          )
        }
        return walkPatternForCommonJS(property.argument, nodeScopes, currentScope)
      })
  }

  return false
}

function collectScopeBindings(node: AstNode, currentScope: Scope, nodeScopes: WeakMap<object, Scope>) {
  switch (node.type) {
    case 'Program':
      forEachChildNode(node, (child) => collectScopeBindings(child, currentScope, nodeScopes))
      return
    case 'ImportDeclaration':
      for (let specifier of getNodeArray(node.specifiers)) {
        if (isAstNode(specifier) && isIdentifier(specifier.local)) {
          currentScope.bindings.add(specifier.local.name)
        }
      }
      return
    case 'VariableDeclaration': {
      let targetScope = node.kind === 'var' ? getFunctionScope(currentScope) : currentScope
      for (let declaration of getNodeArray(node.declarations)) {
        collectPatternBindings(declaration.id, targetScope)
        if (isAstNode(declaration.init)) {
          collectScopeBindings(declaration.init, currentScope, nodeScopes)
        }
      }
      return
    }
    case 'FunctionDeclaration': {
      if (isIdentifier(node.id)) {
        currentScope.bindings.add(node.id.name)
      }
      let functionScope = createScope(currentScope, 'function')
      nodeScopes.set(node, functionScope)
      if (isIdentifier(node.id)) {
        functionScope.bindings.add(node.id.name)
      }
      for (let param of getNodeArray(node.params)) {
        collectPatternBindings(param, functionScope)
        collectPatternScopeBindings(param, functionScope, nodeScopes)
      }
      if (isAstNode(node.body)) {
        collectScopeBindings(node.body, functionScope, nodeScopes)
      }
      return
    }
    case 'FunctionExpression':
    case 'ArrowFunctionExpression': {
      let functionScope = createScope(currentScope, 'function')
      nodeScopes.set(node, functionScope)
      if (node.type === 'FunctionExpression' && isIdentifier(node.id)) {
        functionScope.bindings.add(node.id.name)
      }
      for (let param of getNodeArray(node.params)) {
        collectPatternBindings(param, functionScope)
        collectPatternScopeBindings(param, functionScope, nodeScopes)
      }
      if (isAstNode(node.body)) {
        collectScopeBindings(node.body, functionScope, nodeScopes)
      }
      return
    }
    case 'ClassDeclaration':
      if (isIdentifier(node.id)) {
        currentScope.bindings.add(node.id.name)
      }
      break
    case 'ClassExpression':
      if (isIdentifier(node.id)) {
        let classScope = createScope(currentScope, 'block')
        classScope.bindings.add(node.id.name)
        nodeScopes.set(node, classScope)
        forEachChildNode(node, (child, key) => {
          if (key !== 'id') {
            collectScopeBindings(child, classScope, nodeScopes)
          }
        })
        return
      }
      break
    case 'BlockStatement':
    case 'ForStatement':
    case 'ForInStatement':
    case 'ForOfStatement':
    case 'SwitchStatement': {
      let blockScope = createScope(currentScope, 'block')
      nodeScopes.set(node, blockScope)
      forEachChildNode(node, (child) => collectScopeBindings(child, blockScope, nodeScopes))
      return
    }
    case 'CatchClause': {
      let catchScope = createScope(currentScope, 'block')
      nodeScopes.set(node, catchScope)
      collectPatternBindings(node.param, catchScope)
      collectPatternScopeBindings(node.param, catchScope, nodeScopes)
      if (isAstNode(node.body)) {
        collectScopeBindings(node.body, catchScope, nodeScopes)
      }
      return
    }
  }

  forEachChildNode(node, (child) => collectScopeBindings(child, currentScope, nodeScopes))
}

function collectPatternBindings(node: unknown, scope: Scope): void {
  if (!isAstNode(node)) return

  switch (node.type) {
    case 'Identifier':
      if (isIdentifier(node)) {
        scope.bindings.add(node.name)
      }
      return
    case 'RestElement':
      collectPatternBindings(node.argument, scope)
      return
    case 'AssignmentPattern':
      collectPatternBindings(node.left, scope)
      return
    case 'ArrayPattern':
      for (let element of getNodeArray(node.elements)) {
        collectPatternBindings(element, scope)
      }
      return
    case 'ObjectPattern':
      for (let property of getNodeArray(node.properties)) {
        if (property.type === 'Property') {
          collectPatternBindings(property.value, scope)
        } else {
          collectPatternBindings(property.argument, scope)
        }
      }
      return
  }
}

function collectPatternScopeBindings(
  node: unknown,
  currentScope: Scope,
  nodeScopes: WeakMap<object, Scope>,
): void {
  if (!isAstNode(node)) return

  switch (node.type) {
    case 'AssignmentPattern':
      collectPatternScopeBindings(node.left, currentScope, nodeScopes)
      if (isAstNode(node.right)) {
        collectScopeBindings(node.right, currentScope, nodeScopes)
      }
      return
    case 'ArrayPattern':
      for (let element of getNodeArray(node.elements)) {
        collectPatternScopeBindings(element, currentScope, nodeScopes)
      }
      return
    case 'ObjectPattern':
      for (let property of getNodeArray(node.properties)) {
        if (property.type === 'Property') {
          if (property.computed && isAstNode(property.key)) {
            collectScopeBindings(property.key, currentScope, nodeScopes)
          }
          collectPatternScopeBindings(property.value, currentScope, nodeScopes)
        } else {
          collectPatternScopeBindings(property.argument, currentScope, nodeScopes)
        }
      }
      return
    case 'RestElement':
      collectPatternScopeBindings(node.argument, currentScope, nodeScopes)
      return
  }
}

function isCommonJSReference(
  node: IdentifierNode,
  parent: AstNode | null,
  key?: string,
): boolean {
  if (parent === null) return false

  if (node.name === 'require') {
    return (
      (parent.type === 'CallExpression' && key === 'callee') ||
      (parent.type === 'MemberExpression' && key === 'object')
    )
  }

  if (node.name === 'exports') {
    return (
      (parent.type === 'AssignmentExpression' && key === 'left') ||
      (parent.type === 'MemberExpression' && key === 'object')
    )
  }

  return (
    node.name === 'module' &&
    parent.type === 'MemberExpression' &&
    key === 'object' &&
    isMemberPropertyNamed(parent.property, 'exports')
  )
}

function resolveBindingKind(name: string, currentScope: Scope): 'local' | null {
  let scope: Scope | null = currentScope
  while (scope !== null) {
    if (scope.bindings.has(name)) return 'local'
    scope = scope.parent
  }
  return null
}

function createScope(parent: Scope | null, kind: Scope['kind']): Scope {
  return {
    bindings: new Set(),
    kind,
    parent,
  }
}

function getFunctionScope(scope: Scope): Scope {
  let current = scope
  while (current.kind === 'block' && current.parent !== null) {
    current = current.parent
  }
  return current
}

function isReferenceIdentifier(
  node: IdentifierNode,
  parent: AstNode | null,
  key?: string,
): boolean {
  if (parent === null) return false
  if (parent.type === 'ClassDeclaration' || parent.type === 'ClassExpression') {
    return key !== 'id'
  }
  if (parent.type === 'Property' && key === 'key' && !parent.computed) {
    return false
  }
  if (
    (parent.type === 'PropertyDefinition' || parent.type === 'MethodDefinition') &&
    key === 'key' &&
    !parent.computed
  ) {
    return false
  }
  if (parent.type === 'MemberExpression' && key === 'property' && !parent.computed) {
    return false
  }
  if (parent.type === 'MetaProperty') return false
  if (
    (parent.type === 'LabeledStatement' ||
      parent.type === 'BreakStatement' ||
      parent.type === 'ContinueStatement') &&
    key === 'label'
  ) {
    return false
  }
  if (parent.type === 'ExportSpecifier' && key === 'exported') return false
  return true
}

function getChildNodes(node: AstNode): Array<{ key: string; node: AstNode }> {
  let children: Array<{ key: string; node: AstNode }> = []
  forEachChildNode(node, (child, key) => {
    children.push({ key, node: child })
  })
  return children
}

function forEachChildNode(
  node: AstNode,
  callback: (child: AstNode, key: string) => void,
): void {
  for (let key of visitorKeys[node.type] ?? []) {
    let value = node[key]
    if (Array.isArray(value)) {
      for (let child of value) {
        if (isAstNode(child)) {
          callback(child, key)
        }
      }
      continue
    }
    if (isAstNode(value)) {
      callback(value, key)
    }
  }
}

function getNodeArray(value: unknown): AstNode[] {
  return Array.isArray(value) ? value.filter(isAstNode) : []
}

function isMemberPropertyNamed(node: unknown, name: string): boolean {
  if (isIdentifier(node)) return node.name === name
  return isStaticStringValue(node, name)
}

function isStaticStringValue(node: unknown, value: string): boolean {
  if (!isAstNode(node)) return false

  if (node.type === 'Literal') return node.value === value

  return (
    node.type === 'TemplateLiteral' &&
    Array.isArray(node.expressions) &&
    node.expressions.length === 0 &&
    Array.isArray(node.quasis) &&
    node.quasis.length === 1 &&
    isAstNode(node.quasis[0]) &&
    !!node.quasis[0].value &&
    typeof node.quasis[0].value === 'object' &&
    'raw' in node.quasis[0].value &&
    node.quasis[0].value.raw === value
  )
}

function isAstNode(node: unknown): node is AstNode {
  return !!node && typeof node === 'object' && 'type' in node && typeof node.type === 'string'
}

function isIdentifier(node: unknown): node is IdentifierNode {
  return isAstNode(node) && node.type === 'Identifier' && typeof node.name === 'string'
}

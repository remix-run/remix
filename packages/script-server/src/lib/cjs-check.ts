import { parseSync } from '@swc/core'

const suspiciousCommonJSPattern =
  /\brequire\s*(?:\(|\.|\[)|\bmodule\s*(?:\.\s*exports|\[\s*['"`]exports['"`]\s*\])|\bexports\s*(?:\.|=|\[)/

interface AstNode {
  type: string
  [key: string]: unknown
}

export function mayContainCommonJSModuleGlobals(source: string): boolean {
  return suspiciousCommonJSPattern.test(source)
}

// Detects CommonJS module globals that cannot be served as ES modules.
export function isCommonJS(source: string): boolean {
  try {
    let ast = parseSync(source, { syntax: 'ecmascript' })
    return containsCommonJSModuleGlobals(ast)
  } catch {
    return suspiciousCommonJSPattern.test(source)
  }
}

function containsCommonJSModuleGlobals(node: unknown): boolean {
  if (isRequireCall(node) || isRequireMemberAccess(node) || isExportsAssignment(node)) return true
  if (isExportsMemberAccess(node) || isModuleExportsAccess(node)) return true

  if (Array.isArray(node)) {
    for (let child of node) {
      if (containsCommonJSModuleGlobals(child)) return true
    }
    return false
  }

  if (!isAstNode(node)) return false

  for (let value of Object.values(node)) {
    if (containsCommonJSModuleGlobals(value)) return true
  }

  return false
}

function isRequireCall(node: unknown): boolean {
  return (
    isAstNode(node) && node.type === 'CallExpression' && isGlobalIdentifier(node.callee, 'require')
  )
}

function isRequireMemberAccess(node: unknown): boolean {
  return isMemberAccessOnGlobal(node, 'require')
}

function isExportsMemberAccess(node: unknown): boolean {
  return isMemberAccessOnGlobal(node, 'exports')
}

function isModuleExportsAccess(node: unknown): boolean {
  return (
    isAstNode(node) &&
    node.type === 'MemberExpression' &&
    isGlobalIdentifier(node.object, 'module') &&
    isMemberPropertyNamed(node.property, 'exports')
  )
}

function isExportsAssignment(node: unknown): boolean {
  return (
    isAstNode(node) &&
    node.type === 'AssignmentExpression' &&
    isGlobalIdentifier(node.left, 'exports')
  )
}

function isMemberAccessOnGlobal(node: unknown, name: string): boolean {
  return (
    isAstNode(node) && node.type === 'MemberExpression' && isGlobalIdentifier(node.object, name)
  )
}

function isGlobalIdentifier(node: unknown, name: string): boolean {
  return isAstNode(node) && node.type === 'Identifier' && node.value === name && node.ctxt === 1
}

function isMemberPropertyNamed(node: unknown, name: string): boolean {
  if (!isAstNode(node)) return false

  if (node.type === 'Identifier') return node.value === name

  if (node.type !== 'Computed') return false

  return isStaticStringValue(node.expression, name)
}

function isStaticStringValue(node: unknown, value: string): boolean {
  if (!isAstNode(node)) return false

  if (node.type === 'StringLiteral') return node.value === value

  return (
    node.type === 'TemplateLiteral' &&
    Array.isArray(node.expressions) &&
    node.expressions.length === 0 &&
    Array.isArray(node.quasis) &&
    node.quasis.length === 1 &&
    isAstNode(node.quasis[0]) &&
    node.quasis[0].raw === value
  )
}

function isAstNode(node: unknown): node is AstNode {
  return !!node && typeof node === 'object' && 'type' in node && typeof node.type === 'string'
}

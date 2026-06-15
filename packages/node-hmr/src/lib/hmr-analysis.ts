import { parseSync, visitorKeys } from 'oxc-parser'
import type { Node, Program } from 'oxc-parser'

export interface NodeHmrAnalysis {
  acceptedDeps: string[]
  selfAccepting: boolean
  usesImportMetaHot: boolean
}

const invalidAcceptMessage =
  'import.meta.hot.accept() can only accept a callback, a string literal, or an array of string literals.'

export function analyzeNodeHmrSource(importerUrl: string, source: string): NodeHmrAnalysis {
  if (!source.includes('import.meta.hot')) {
    return {
      acceptedDeps: [],
      selfAccepting: false,
      usesImportMetaHot: false,
    }
  }

  let acceptedDeps = new Set<string>()
  let selfAccepting = false
  let usesImportMetaHot = false
  let parseResult = parseSync('node-hmr-analysis.js', source, {
    lang: 'js',
    sourceType: 'module',
  })

  if (parseResult.errors.length > 0) {
    return {
      acceptedDeps: [],
      selfAccepting: false,
      usesImportMetaHot: false,
    }
  }

  walkAst(parseResult.program, (node) => {
    if (isImportMetaHotNode(node)) {
      usesImportMetaHot = true
    }

    if (node.type !== 'CallExpression') return
    if (!isImportMetaHotAcceptCallee(node.callee)) return

    let [firstArgument] = node.arguments
    if (firstArgument === undefined || isSelfAcceptArgument(firstArgument)) {
      selfAccepting = true
      return
    }

    let deps = getAcceptedDependencies(firstArgument)
    if (deps === null) {
      throw new TypeError(invalidAcceptMessage)
    }

    for (let dep of deps) {
      acceptedDeps.add(new URL(dep, importerUrl).href)
    }
  })

  return {
    acceptedDeps: [...acceptedDeps],
    selfAccepting,
    usesImportMetaHot,
  }
}

function isImportMetaHotAcceptCallee(node: Node): boolean {
  let callee = unwrapChainExpression(node)
  if (callee.type !== 'MemberExpression') return false
  if (callee.computed || !isIdentifierNode(callee.property, 'accept')) return false

  return isImportMetaHotNode(callee.object)
}

function isImportMetaHotNode(node: Node): boolean {
  let hot = unwrapChainExpression(node)
  if (hot.type !== 'MemberExpression') return false
  if (hot.computed || !isIdentifierNode(hot.property, 'hot')) return false

  let meta = unwrapChainExpression(hot.object)
  return (
    meta.type === 'MetaProperty' &&
    isIdentifierNode(meta.meta, 'import') &&
    isIdentifierNode(meta.property, 'meta')
  )
}

function unwrapChainExpression(node: Node): Node {
  return node.type === 'ChainExpression' ? node.expression : node
}

function isIdentifierNode(node: Node, name: string): boolean {
  return node.type === 'Identifier' && node.name === name
}

function isSelfAcceptArgument(node: Node): boolean {
  return (
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression' ||
    isIdentifierNode(node, 'undefined')
  )
}

function getAcceptedDependencies(node: Node): string[] | null {
  if (isStringLiteralNode(node)) {
    return [node.value]
  }

  if (node.type !== 'ArrayExpression') return null

  let deps: string[] = []
  for (let element of node.elements) {
    if (!isStringLiteralNode(element)) return null
    deps.push(element.value)
  }
  return deps
}

function walkAst(node: Program | Node, visit: (node: Program | Node) => void): void {
  visit(node)

  let keys = visitorKeys[node.type]
  if (!keys) return

  let walkableNode = node as unknown as Record<string, unknown>
  for (let key of keys) {
    let value = walkableNode[key]
    if (Array.isArray(value)) {
      for (let child of value) {
        if (isAstNode(child)) {
          walkAst(child, visit)
        }
      }
      continue
    }

    if (isAstNode(value)) {
      walkAst(value, visit)
    }
  }
}

function isAstNode(value: unknown): value is Node {
  return typeof value === 'object' && value !== null && 'type' in value
}

function isStringLiteralNode(node: Node | null | undefined): node is Node & {
  value: string
} {
  return node?.type === 'Literal' && typeof node.value === 'string'
}

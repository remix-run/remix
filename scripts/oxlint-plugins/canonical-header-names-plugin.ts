import { definePlugin, defineRule } from '@oxlint/plugins'
import type { Context, ESTree, Fixer } from '@oxlint/plugins'

const HeaderWordCasingExceptions: Record<string, string> = {
  ct: 'CT',
  dpop: 'DPoP',
  etag: 'ETag',
  te: 'TE',
  www: 'WWW',
  x: 'X',
  xss: 'XSS',
}

const headerNamePattern = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/
const headerMethods = new Set(['append', 'delete', 'get', 'has', 'set'])

function canonicalHeaderName(name: string): string {
  return name
    .toLowerCase()
    .split('-')
    .map((word) => HeaderWordCasingExceptions[word] || word.charAt(0).toUpperCase() + word.slice(1))
    .join('-')
}

function isStringLiteral(node: ESTree.Argument): node is ESTree.StringLiteral {
  return node.type === 'Literal' && typeof node.value === 'string'
}

function isStaticMemberExpression(node: ESTree.Expression): node is ESTree.StaticMemberExpression {
  return node.type === 'MemberExpression' && !node.computed && node.property.type === 'Identifier'
}

function isIdentifierReference(node: ESTree.Expression): node is ESTree.IdentifierReference {
  return node.type === 'Identifier'
}

function isHeadersIdentifierName(name: string): boolean {
  return name === 'headers' || name.endsWith('Headers')
}

function isNewHeadersExpression(node: ESTree.Expression): boolean {
  return (
    node.type === 'NewExpression' &&
    isIdentifierReference(node.callee) &&
    node.callee.name === 'Headers'
  )
}

function isLikelyHeadersReceiver(node: ESTree.Expression): boolean {
  if (isIdentifierReference(node)) {
    return isHeadersIdentifierName(node.name)
  }

  if (isStaticMemberExpression(node)) {
    return node.property.name === 'headers'
  }

  return isNewHeadersExpression(node)
}

function quoteLike(raw: string | null, value: string): string {
  let quote = raw?.startsWith('"') ? '"' : "'"
  let escaped = value.replace(/\\/g, '\\\\').replaceAll(quote, `\\${quote}`)

  return `${quote}${escaped}${quote}`
}

function getStaticPropertyName(node: ESTree.ObjectProperty): string | null {
  if (node.computed) {
    return null
  }

  if (node.key.type === 'Identifier') {
    return node.key.name
  }

  if (node.key.type === 'Literal' && typeof node.key.value === 'string') {
    return node.key.value
  }

  return null
}

function getHeaderPropertyKeyFixText(
  node: ESTree.IdentifierName | ESTree.StringLiteral,
  canonicalName: string,
): string {
  if (node.type === 'Literal') {
    return quoteLike(node.raw, canonicalName)
  }

  return canonicalName
}

function isHeaderPropertyKey(
  node: ESTree.PropertyKey,
): node is ESTree.IdentifierName | ESTree.StringLiteral {
  return node.type === 'Identifier' || (node.type === 'Literal' && typeof node.value === 'string')
}

function reportHeaderName(
  context: Context,
  node: ESTree.IdentifierName | ESTree.StringLiteral,
  name: string,
): void {
  if (!headerNamePattern.test(name)) {
    return
  }

  let canonicalName = canonicalHeaderName(name)
  if (name === canonicalName) {
    return
  }

  context.report({
    node,
    message: `Use canonical HTTP header name '${canonicalName}'.`,
    fix(fixer: Fixer) {
      return fixer.replaceText(node, getHeaderPropertyKeyFixText(node, canonicalName))
    },
  })
}

function checkHeadersInitObject(context: Context, node: ESTree.ObjectExpression): void {
  for (let property of node.properties) {
    if (property.type !== 'Property') {
      continue
    }

    let headerName = getStaticPropertyName(property)
    if (headerName == null) {
      continue
    }

    if (!isHeaderPropertyKey(property.key)) {
      continue
    }

    reportHeaderName(context, property.key, headerName)
  }
}

function isHeadersInitPropertyValue(node: ESTree.ObjectExpression): boolean {
  let parent = node.parent

  if (parent.type !== 'Property' || parent.value !== node) {
    return false
  }

  return getStaticPropertyName(parent) === 'headers'
}

const canonicalHeaderNamesRule = defineRule({
  meta: {
    type: 'suggestion',
    fixable: 'code',
  },
  create(context: Context) {
    return {
      CallExpression(node: ESTree.CallExpression) {
        if (!isStaticMemberExpression(node.callee)) {
          return
        }

        let methodName = node.callee.property.name
        if (!headerMethods.has(methodName)) {
          return
        }

        if (!isLikelyHeadersReceiver(node.callee.object)) {
          return
        }

        let headerName = node.arguments[0]
        if (headerName == null || !isStringLiteral(headerName)) {
          return
        }

        reportHeaderName(context, headerName, headerName.value)
      },
      NewExpression(node: ESTree.NewExpression) {
        if (!isNewHeadersExpression(node)) {
          return
        }

        let headersInit = node.arguments[0]
        if (headersInit?.type !== 'ObjectExpression') {
          return
        }

        checkHeadersInitObject(context, headersInit)
      },
      ObjectExpression(node: ESTree.ObjectExpression) {
        if (!isHeadersInitPropertyValue(node)) {
          return
        }

        checkHeadersInitObject(context, node)
      },
    }
  },
})

/**
 * Encourages canonical HTTP header names in direct `Headers` method calls and
 * static `HeadersInit` objects, while staying conservative enough to avoid
 * unrelated `Map`, session, and form data APIs.
 */
export default definePlugin({
  meta: {
    name: 'remix-headers',
  },
  rules: {
    'canonical-header-name': canonicalHeaderNamesRule,
  },
})

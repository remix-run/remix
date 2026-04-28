import * as path from 'node:path'

import { getOwnerFileExtension } from '../controller-files.ts'
import type { OwnershipRouteNode } from '../controller-ownership.ts'

const RESERVED_BINDING_IDENTIFIERS = new Set([
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'implements',
  'import',
  'in',
  'instanceof',
  'interface',
  'let',
  'new',
  'null',
  'package',
  'private',
  'protected',
  'public',
  'return',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
])

export function renderActionPlaceholder(routeNode: OwnershipRouteNode, entryPath: string): string {
  let routeMessage = `TODO: implement routes.${routeNode.name}`
  let extension = getOwnerFileExtension(entryPath)
  let exportName = getActionExportName(routeNode.key)

  if (extension === '.js' || extension === '.jsx') {
    return [
      `export const ${exportName} = {`,
      `  handler() {`,
      `    return new Response(${JSON.stringify(routeMessage)})`,
      `  },`,
      `}`,
      '',
    ].join('\n')
  }

  let routeExpression = getRouteAccessExpression(routeNode.name)
  let routesImportPath = getRelativeImportPath(entryPath, 'app/routes.ts')
  let method = routeNode.method ?? 'ANY'

  return [
    `import type { BuildAction } from 'remix/fetch-router'`,
    '',
    `import type { routes } from '${routesImportPath}'`,
    '',
    `export const ${exportName}: BuildAction<'${method}', typeof ${routeExpression}> = {`,
    `  handler() {`,
    `    return new Response(${JSON.stringify(routeMessage)})`,
    `  },`,
    `}`,
    '',
  ].join('\n')
}

export function renderControllerPlaceholder(
  routeNode: OwnershipRouteNode,
  entryPath: string,
  resolvedEntryPathByRouteName: Map<string, string>,
): string {
  let extension = getOwnerFileExtension(entryPath)
  let lines: string[] = []
  let childImports = getControllerChildImports(routeNode, entryPath, resolvedEntryPathByRouteName)
  let actionEntries = routeNode.children.map((childNode) =>
    renderControllerActionEntry(childNode, entryPath, resolvedEntryPathByRouteName),
  )

  if (extension === '.js' || extension === '.jsx') {
    if (childImports.length > 0) {
      lines.push(...childImports, '')
    }

    lines.push('export default {', '  actions: {')
    lines.push(...actionEntries)
    lines.push('  },', '}', '')
    return lines.join('\n')
  }

  let routeExpression = getRouteAccessExpression(routeNode.name)
  let routesImportPath = getRelativeImportPath(entryPath, 'app/routes.ts')

  lines.push(`import type { Controller } from 'remix/fetch-router'`, '')
  lines.push(`import type { routes } from '${routesImportPath}'`)

  if (childImports.length > 0) {
    lines.push('', ...childImports)
  }

  lines.push('', 'export default {', '  actions: {')
  lines.push(...actionEntries)
  lines.push('  },', `} satisfies Controller<typeof ${routeExpression}>`, '')

  return lines.join('\n')
}

function getControllerChildImports(
  routeNode: OwnershipRouteNode,
  entryPath: string,
  resolvedEntryPathByRouteName: Map<string, string>,
): string[] {
  let imports: string[] = []

  for (let childNode of routeNode.children) {
    if (childNode.kind !== 'group') {
      continue
    }

    let childEntryPath = resolvedEntryPathByRouteName.get(childNode.name)
    if (childEntryPath == null) {
      continue
    }

    imports.push(
      `import ${getControllerImportName(childNode.key)} from '${getRelativeImportPath(entryPath, childEntryPath)}'`,
    )
  }

  return imports
}

function renderControllerActionEntry(
  childNode: OwnershipRouteNode,
  entryPath: string,
  resolvedEntryPathByRouteName: Map<string, string>,
): string {
  if (childNode.kind === 'route') {
    return [
      `    ${formatObjectKey(childNode.key)}() {`,
      `      return new Response(${JSON.stringify(`TODO: implement routes.${childNode.name}`)})`,
      `    },`,
    ].join('\n')
  }

  let childEntryPath = resolvedEntryPathByRouteName.get(childNode.name)
  if (childEntryPath != null) {
    return `    ${formatObjectKey(childNode.key)}: ${getControllerImportName(childNode.key)},`
  }

  return `    ${formatObjectKey(childNode.key)}: ${renderInlineControllerPlaceholder(childNode)},`
}

function renderInlineControllerPlaceholder(routeNode: OwnershipRouteNode): string {
  let childEntries = routeNode.children.map((childNode) =>
    childNode.kind === 'route'
      ? `${formatObjectKey(childNode.key)}() { return new Response(${JSON.stringify(`TODO: implement routes.${childNode.name}`)}) }`
      : `${formatObjectKey(childNode.key)}: ${renderInlineControllerPlaceholder(childNode)}`,
  )

  return `{ actions: { ${childEntries.join(', ')} } }`
}

function getControllerImportName(key: string): string {
  return `${toIdentifier(key)}Controller`
}

function getActionExportName(key: string): string {
  return toIdentifier(key)
}

function getRouteAccessExpression(routeName: string): string {
  let segments = routeName.split('.')
  let expression = 'routes'

  for (let segment of segments) {
    expression += isIdentifier(segment) ? `.${segment}` : `[${JSON.stringify(segment)}]`
  }

  return expression
}

function getRelativeImportPath(fromFilePath: string, toFilePath: string): string {
  let relativePath = path.posix.relative(path.posix.dirname(fromFilePath), toFilePath)
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`
}

function formatObjectKey(key: string): string {
  return isIdentifier(key) ? key : JSON.stringify(key)
}

function toIdentifier(value: string): string {
  let parts = value.split(/[^A-Za-z0-9_$]+/).filter(Boolean)
  if (parts.length === 0) {
    return 'route'
  }

  let identifier = parts
    .map((part, index) =>
      index === 0 ? part.replace(/^./, (char) => char.toLowerCase()) : capitalize(part),
    )
    .join('')

  if (!/^[A-Za-z_$]/.test(identifier)) {
    return `route${capitalize(identifier)}`
  }

  if (RESERVED_BINDING_IDENTIFIERS.has(identifier)) {
    return `route${capitalize(identifier)}`
  }

  return identifier
}

function capitalize(value: string): string {
  return value.length === 0 ? value : `${value[0].toUpperCase()}${value.slice(1)}`
}

function isIdentifier(value: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value)
}

import * as path from 'node:path'

import { getOwnerFileExtension } from '../controller-files.ts'
import { ROOT_ROUTE_NAME, type OwnershipRouteNode } from '../controller-ownership.ts'

export function renderControllerPlaceholder(
  routeNode: OwnershipRouteNode,
  entryPath: string,
): string {
  let extension = getOwnerFileExtension(entryPath)
  let lines: string[] = []
  let actionEntries = routeNode.children
    .filter((childNode) => childNode.kind === 'route')
    .map((childNode) => renderControllerActionEntry(childNode))

  if (extension === '.js' || extension === '.jsx') {
    lines.push('export default {', '  actions: {')
    lines.push(...actionEntries)
    lines.push('  },', '}', '')
    return lines.join('\n')
  }

  let routeExpression = getRouteAccessExpression(routeNode.name)
  let routesImportPath = getRelativeImportPath(entryPath, 'app/routes.ts')

  lines.push(`import { createController } from 'remix/fetch-router'`, '')
  lines.push(`import { routes } from '${routesImportPath}'`)

  lines.push('', `export default createController(${routeExpression}, {`, '  actions: {')
  lines.push(...actionEntries)
  lines.push('  },', '})', '')

  return lines.join('\n')
}

function renderControllerActionEntry(childNode: OwnershipRouteNode): string {
  return [
    `    ${formatObjectKey(childNode.key)}() {`,
    `      return new Response(${JSON.stringify(`TODO: implement routes.${childNode.name}`)})`,
    `    },`,
  ].join('\n')
}

function getRouteAccessExpression(routeName: string): string {
  if (routeName === ROOT_ROUTE_NAME) {
    return 'routes'
  }

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

function isIdentifier(value: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value)
}

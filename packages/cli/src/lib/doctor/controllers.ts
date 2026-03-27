import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import {
  getOwnerCandidateForExtension,
  getOwnerFileExtension,
  type OwnerFileExtension,
} from '../controller-files.ts'
import {
  inspectControllerOwnership,
  type ControllerOwnership,
  type OwnedSubtree,
  type OwnershipRouteNode,
} from '../controller-ownership.ts'
import {
  createDoctorSuite,
  type DoctorFinding,
  type DoctorFixPlan,
  type DoctorSuiteResult,
} from './types.ts'

const OWNER_EXTENSION_PRIORITY: OwnerFileExtension[] = ['.tsx', '.ts', '.jsx', '.js']

export interface ControllerDoctorResult {
  fixPlans: DoctorFixPlan[]
  suite: DoctorSuiteResult
}

export async function checkControllerConventions(
  appRoot: string,
  tree: OwnershipRouteNode[],
): Promise<ControllerDoctorResult> {
  let ownership = await inspectControllerOwnership(appRoot, tree)
  let fixPlans = await getControllerFixPlans(appRoot, tree, ownership)
  let findings = [
    ...getSubtreeFindings(ownership.subtrees, fixPlans),
    ...ownership.orphanActionPaths.map((actualPath) => ({
      actualPath,
      code: 'orphan-action' as const,
      message: `Standalone action ${actualPath} does not match any top-level route.`,
      severity: 'warn' as const,
      suite: 'controllers' as const,
    })),
    ...ownership.orphanControllerPaths.map((actualPath) => ({
      actualPath,
      code: 'orphan-controller' as const,
      message: `Controller ${actualPath} does not match any route group.`,
      severity: 'warn' as const,
      suite: 'controllers' as const,
    })),
    ...ownership.orphanRouteDirectoryPaths.map((actualPath) => ({
      actualPath,
      code: 'orphan-route-directory' as const,
      message: `Directory ${actualPath} does not match any route subtree.`,
      severity: 'warn' as const,
      suite: 'controllers' as const,
    })),
  ]

  return {
    fixPlans,
    suite: createDoctorSuite('controllers', findings),
  }
}

async function getControllerFixPlans(
  appRoot: string,
  tree: OwnershipRouteNode[],
  ownership: ControllerOwnership,
): Promise<DoctorFixPlan[]> {
  let routeNodesByName = getRouteNodesByName(tree)
  let hasTsconfig = await pathExists(path.join(appRoot, 'tsconfig.json'))
  let resolvedEntryPathByRouteName = new Map<string, string>()

  for (let subtree of ownership.subtrees) {
    if (subtree.actualEntryPath != null) {
      resolvedEntryPathByRouteName.set(subtree.routeName, subtree.actualEntryPath)
      continue
    }

    let fixCode = getFixCodeForSubtree(subtree)
    if (fixCode == null) {
      continue
    }

    let extension = inferOwnerExtension(subtree, ownership, hasTsconfig)
    let targetPath =
      getOwnerCandidateForExtension(subtree.entryCandidates, extension) ?? subtree.entryDisplayPath

    resolvedEntryPathByRouteName.set(subtree.routeName, targetPath)
  }

  let fixPlans: DoctorFixPlan[] = []

  for (let subtree of ownership.subtrees) {
    let code = getFixCodeForSubtree(subtree)
    if (code == null) {
      continue
    }

    let routeNode = routeNodesByName.get(subtree.routeName)
    let entryPath = resolvedEntryPathByRouteName.get(subtree.routeName)
    if (routeNode == null || entryPath == null) {
      continue
    }

    let contents =
      subtree.kind === 'action'
        ? renderActionPlaceholder(routeNode, entryPath)
        : renderControllerPlaceholder(routeNode, entryPath, resolvedEntryPathByRouteName)

    fixPlans.push({
      code,
      contents,
      kind: 'create-file',
      path: entryPath,
      routeName: subtree.routeName,
      suite: 'controllers',
    })
  }

  return fixPlans
}

function getSubtreeFindings(subtrees: OwnedSubtree[], fixPlans: DoctorFixPlan[]): DoctorFinding[] {
  let findings: DoctorFinding[] = []
  let fixableFindingKeys = new Set(
    fixPlans.map((fixPlan) => `${fixPlan.code}:${fixPlan.routeName ?? ''}`),
  )

  for (let subtree of subtrees) {
    let actualEntryPath = subtree.actualEntryPath ?? undefined
    let actualAlternatePath = subtree.actualAlternatePath ?? undefined

    if (subtree.actualEntryPaths.length > 1) {
      findings.push({
        actualPath: subtree.actualEntryPaths[0],
        code: 'duplicate-owner-file',
        expectedPath: subtree.entryDisplayPath,
        message: `Route "${subtree.routeName}" has multiple ${subtree.kind} files: ${subtree.actualEntryPaths.join(', ')}. Keep only one ${subtree.kind} owner file.`,
        routeName: subtree.routeName,
        severity: 'warn',
        suite: 'controllers',
      })
      continue
    }

    if (subtree.actualAlternatePaths.length > 1) {
      let alternateKind = subtree.kind === 'action' ? 'controller' : 'action'

      findings.push({
        actualPath: subtree.actualAlternatePaths[0],
        code: 'duplicate-owner-file',
        expectedPath: subtree.entryDisplayPath,
        message: `Route "${subtree.routeName}" has multiple ${alternateKind} files: ${subtree.actualAlternatePaths.join(', ')}. Keep only one ${alternateKind} owner file.`,
        routeName: subtree.routeName,
        severity: 'warn',
        suite: 'controllers',
      })
      continue
    }

    if (actualEntryPath != null && actualAlternatePath != null) {
      findings.push({
        actualPath: actualAlternatePath,
        code: 'ambiguous-owner',
        expectedPath: actualEntryPath,
        message:
          subtree.kind === 'action'
            ? `Route "${subtree.routeName}" has both action ${actualEntryPath} and controller ${actualAlternatePath}.`
            : `Route "${subtree.routeName}" has both controller ${actualEntryPath} and standalone action ${actualAlternatePath}.`,
        routeName: subtree.routeName,
        severity: 'warn',
        suite: 'controllers',
      })
      continue
    }

    if (actualAlternatePath != null) {
      findings.push({
        actualPath: actualAlternatePath,
        code: 'wrong-owner-kind',
        expectedPath: subtree.entryDisplayPath,
        message:
          subtree.kind === 'action'
            ? `Route "${subtree.routeName}" expects action ${subtree.entryDisplayPath}, but found controller ${actualAlternatePath}.`
            : `Route "${subtree.routeName}" expects controller ${subtree.entryDisplayPath}, but found standalone action ${actualAlternatePath}.`,
        routeName: subtree.routeName,
        severity: 'warn',
        suite: 'controllers',
      })
      continue
    }

    if (subtree.kind === 'controller' && subtree.actualEntryPath == null) {
      let code =
        subtree.claimedFilePaths.length > 0
          ? ('incomplete-controller' as const)
          : ('missing-owner' as const)

      findings.push({
        actualPath: subtree.claimedFilePaths.length > 0 ? subtree.subtreePath : undefined,
        code,
        expectedPath: subtree.entryDisplayPath,
        fixable: fixableFindingKeys.has(`${code}:${subtree.routeName}`),
        message:
          subtree.claimedFilePaths.length > 0
            ? `Route "${subtree.routeName}" has files under ${subtree.subtreePath}, but is missing controller ${subtree.entryDisplayPath}.`
            : `Route "${subtree.routeName}" is missing controller ${subtree.entryDisplayPath}.`,
        routeName: subtree.routeName,
        severity: 'warn',
        suite: 'controllers',
      })
      continue
    }

    if (subtree.kind === 'action' && subtree.claimedFilePaths.length > 0) {
      findings.push({
        actualPath: subtree.subtreePath,
        code: 'promotion-drift',
        expectedPath: actualEntryPath ?? subtree.entryDisplayPath,
        message:
          actualEntryPath == null
            ? `Route "${subtree.routeName}" has files under ${subtree.subtreePath}, but is still expected to use action ${subtree.entryDisplayPath}. Promote it to controller ${subtree.alternateDisplayPath} or move the files back into ${subtree.entryDisplayPath}.`
            : `Route "${subtree.routeName}" uses action ${actualEntryPath}, but also has files under ${subtree.subtreePath}. Promote it to controller ${subtree.alternateDisplayPath} or keep the route in ${actualEntryPath}.`,
        routeName: subtree.routeName,
        severity: 'warn',
        suite: 'controllers',
      })
      continue
    }

    if (subtree.actualEntryPath == null) {
      findings.push({
        code: 'missing-owner',
        expectedPath: subtree.entryDisplayPath,
        fixable: fixableFindingKeys.has(`missing-owner:${subtree.routeName}`),
        message: `Route "${subtree.routeName}" is missing action ${subtree.entryDisplayPath}.`,
        routeName: subtree.routeName,
        severity: 'warn',
        suite: 'controllers',
      })
    }
  }

  return findings
}

function getFixCodeForSubtree(subtree: OwnedSubtree): DoctorFixPlan['code'] | null {
  if (subtree.actualEntryPath != null || subtree.actualAlternatePath != null) {
    return null
  }

  if (subtree.actualEntryPaths.length > 1 || subtree.actualAlternatePaths.length > 1) {
    return null
  }

  if (subtree.kind === 'controller') {
    return subtree.claimedFilePaths.length > 0 ? 'incomplete-controller' : 'missing-owner'
  }

  if (subtree.claimedFilePaths.length > 0) {
    return null
  }

  return 'missing-owner'
}

function inferOwnerExtension(
  subtree: OwnedSubtree,
  ownership: ControllerOwnership,
  hasTsconfig: boolean,
): OwnerFileExtension {
  let subtreeExtension = getMostCommonOwnerExtension(subtree.claimedRouteLocalFilePaths)
  if (subtreeExtension != null) {
    return subtreeExtension
  }

  let alternateExtension = getMostCommonOwnerExtension(subtree.actualAlternatePaths)
  if (alternateExtension != null) {
    return alternateExtension
  }

  let projectExtension = getMostCommonOwnerExtension([
    ...ownership.scan.actionEntryPaths,
    ...ownership.scan.controllerEntryPaths,
  ])
  if (projectExtension != null) {
    return projectExtension
  }

  return hasTsconfig ? '.tsx' : '.js'
}

function getMostCommonOwnerExtension(filePaths: string[]): OwnerFileExtension | null {
  let counts = new Map<OwnerFileExtension, number>()

  for (let filePath of filePaths) {
    let extension = getOwnerFileExtension(filePath)
    if (extension == null) {
      continue
    }

    counts.set(extension, (counts.get(extension) ?? 0) + 1)
  }

  if (counts.size === 0) {
    return null
  }

  let bestExtension: OwnerFileExtension | null = null
  let bestCount = -1

  for (let extension of OWNER_EXTENSION_PRIORITY) {
    let count = counts.get(extension) ?? 0
    if (count > bestCount) {
      bestCount = count
      bestExtension = extension
    }
  }

  return bestExtension
}

function renderActionPlaceholder(routeNode: OwnershipRouteNode, entryPath: string): string {
  let routeMessage = `TODO: implement routes.${routeNode.name}`
  let extension = getOwnerFileExtension(entryPath)

  if (extension === '.js' || extension === '.jsx') {
    return [
      `export const ${routeNode.key} = {`,
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
    `export const ${routeNode.key}: BuildAction<'${method}', typeof ${routeExpression}> = {`,
    `  handler() {`,
    `    return new Response(${JSON.stringify(routeMessage)})`,
    `  },`,
    `}`,
    '',
  ].join('\n')
}

function renderControllerPlaceholder(
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

function getRouteNodesByName(tree: OwnershipRouteNode[]): Map<string, OwnershipRouteNode> {
  let routeNodesByName = new Map<string, OwnershipRouteNode>()

  function visit(nodes: OwnershipRouteNode[]): void {
    for (let node of nodes) {
      routeNodesByName.set(node.name, node)
      visit(node.children)
    }
  }

  visit(tree)
  return routeNodesByName
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

  return identifier
}

function capitalize(value: string): string {
  return value.length === 0 ? value : `${value[0].toUpperCase()}${value.slice(1)}`
}

function isIdentifier(value: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value)
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch (error) {
    let nodeError = error as NodeJS.ErrnoException
    if (nodeError.code === 'ENOENT') {
      return false
    }

    throw error
  }
}

import * as process from 'node:process'

import { bold, lightRed } from '../color.ts'
import {
  invalidFlagCombination,
  renderCliError,
  toCliError,
  unknownArgument,
  unexpectedExtraArgument,
} from '../errors.ts'
import { loadRouteMap, type LoadedRouteMap, type RouteTreeNode } from '../route-map.ts'

const CONTROLLERS_PATH_PREFIX = 'app/controllers/'

export async function runRoutesCommand(argv: string[]): Promise<number> {
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(getRoutesCommandHelpText())
    return 0
  }

  try {
    let options = parseRoutesCommandArgs(argv)
    let routeMap = await loadRouteMap()

    if (options.json) {
      process.stdout.write(`${JSON.stringify(routeMap, null, 2)}\n`)
    } else {
      process.stdout.write(renderRouteMap(routeMap, options))
    }

    return 0
  } catch (error) {
    let cliError = toCliError(error)
    process.stderr.write(lightRed(renderCliError(cliError, { helpText: getRoutesCommandHelpText() }), 'stderr'))
    return 1
  }
}

export function getRoutesCommandHelpText(): string {
  return `Usage:
  remix routes [--json | --table] [--no-headers] [--verbose] [--no-color]

Show the Remix route tree for the current app.

Options:
  --json       Print the normalized route tree as JSON
  --table      Print routes as a flat table
  --no-headers Omit the table header row when using --table
  --verbose    Show full owner paths in tree or table output

Examples:
  remix routes
  remix routes --table
  remix routes --table --no-headers
  remix routes --verbose
  remix routes --json
`
}

interface RoutesCommandOptions {
  json: boolean
  noHeaders: boolean
  table: boolean
  verbose: boolean
}

function parseRoutesCommandArgs(argv: string[]): RoutesCommandOptions {
  let json = false
  let noHeaders = false
  let table = false
  let verbose = false

  for (let arg of argv) {
    if (arg === '--json') {
      json = true
      continue
    }

    if (arg === '--table') {
      table = true
      continue
    }

    if (arg === '--no-headers') {
      noHeaders = true
      continue
    }

    if (arg === '--verbose') {
      verbose = true
      continue
    }

    if (arg.startsWith('-')) {
      throw unknownArgument(arg)
    }

    throw unexpectedExtraArgument(arg)
  }

  if (json && table) {
    throw invalidFlagCombination('Cannot combine --json with --table.')
  }

  if (json && verbose) {
    throw invalidFlagCombination('Cannot combine --json with --verbose.')
  }

  if (noHeaders && !table) {
    throw invalidFlagCombination('Cannot use --no-headers without --table.')
  }

  return { json, noHeaders, table, verbose }
}

function renderRouteMap(routeMap: LoadedRouteMap, options: RoutesCommandOptions): string {
  if (routeMap.tree.length === 0) {
    return 'No routes.\n'
  }

  if (options.table) {
    return renderRouteTable(routeMap, options)
  }

  let lines: string[] = []
  renderRouteNodes(lines, routeMap.tree, '', true, null, options)

  return `${lines.join('\n')}\n`
}

function renderRouteNodes(
  lines: string[],
  nodes: RouteTreeNode[],
  prefix: string,
  isRoot: boolean,
  parentOwnerPath: string | null,
  options: RoutesCommandOptions,
): void {
  let leafKeyWidth = getLeafKeyWidth(nodes)

  nodes.forEach((node, index) => {
    renderRouteNode(
      lines,
      node,
      prefix,
      index === nodes.length - 1,
      isRoot,
      parentOwnerPath,
      leafKeyWidth,
      options,
    )
  })
}

function renderRouteNode(
  lines: string[],
  node: RouteTreeNode,
  prefix: string,
  isLast: boolean,
  isRoot: boolean,
  parentOwnerPath: string | null,
  leafKeyWidth: number,
  options: RoutesCommandOptions,
): void {
  let branch = isRoot ? '' : isLast ? '└─ ' : '├─ '
  let line = `${prefix}${branch}${formatRouteNode(node, parentOwnerPath, leafKeyWidth, options)}`
  lines.push(colorRouteLine(line, node))

  if (node.kind !== 'group') {
    return
  }

  let childPrefix = isRoot ? '' : `${prefix}${isLast ? '   ' : '│  '}`
  renderRouteNodes(lines, node.children, childPrefix, false, node.owner.path, options)
}

function getLeafKeyWidth(nodes: RouteTreeNode[]): number {
  let leafNodes = nodes.filter((node) => node.kind === 'route')

  return leafNodes.reduce((width, node) => Math.max(width, node.key.length), 0)
}

function formatRouteNode(
  node: RouteTreeNode,
  parentOwnerPath: string | null,
  leafKeyWidth: number,
  options: RoutesCommandOptions,
): string {
  let owner = formatOwner(node, options)

  if (node.kind === 'group') {
    return `${node.key} -> ${owner}`
  }

  let leaf = `${node.key.padEnd(leafKeyWidth)}  ${node.method!.padEnd(6)} ${node.pattern}`

  if (options.verbose || parentOwnerPath == null || parentOwnerPath !== node.owner.path) {
    return `${leaf} -> ${owner}`
  }

  return leaf
}

function renderRouteTable(routeMap: LoadedRouteMap, options: RoutesCommandOptions): string {
  let rows = flattenRoutes(routeMap.tree).map((node) => ({
    method: node.method!,
    node,
    owner: formatOwner(node, options),
    path: node.pattern!,
    route: node.name,
  }))
  let routeWidth = rows.reduce((width, row) => Math.max(width, row.route.length), 'Route'.length)
  let methodWidth = rows.reduce((width, row) => Math.max(width, row.method.length), 'Method'.length)
  let pathWidth = rows.reduce((width, row) => Math.max(width, row.path.length), 'Path'.length)
  let lines =
    options.noHeaders
      ? []
      : [
          [
            bold('Route'.padEnd(routeWidth)),
            bold('Method'.padEnd(methodWidth)),
            bold('Path'.padEnd(pathWidth)),
            bold('Owner'),
          ].join('  '),
        ]

  for (let row of rows) {
    lines.push(
      colorRouteLine(
        [
          row.route.padEnd(routeWidth),
          row.method.padEnd(methodWidth),
          row.path.padEnd(pathWidth),
          row.owner,
        ].join('  '),
        row.node,
      ),
    )
  }

  return `${lines.join('\n')}\n`
}

function flattenRoutes(nodes: RouteTreeNode[], routes: RouteTreeNode[] = []): RouteTreeNode[] {
  for (let node of nodes) {
    if (node.kind === 'route') {
      routes.push(node)
      continue
    }

    flattenRoutes(node.children, routes)
  }

  return routes
}

function formatOwner(node: RouteTreeNode, options: RoutesCommandOptions): string {
  let ownerPath = options.verbose ? node.owner.path : getCompactOwnerPath(node.owner.path)

  return `${ownerPath}${node.owner.exists ? '' : ' [missing]'}`
}

function colorRouteLine(line: string, node: RouteTreeNode): string {
  return node.owner.exists ? line : lightRed(line)
}

function getCompactOwnerPath(ownerPath: string): string {
  if (ownerPath.startsWith(CONTROLLERS_PATH_PREFIX)) {
    return ownerPath.slice(CONTROLLERS_PATH_PREFIX.length)
  }

  return ownerPath
}

import * as process from 'node:process'

import type { CliContext } from '../cli-context.ts'
import { invalidFlagCombination, renderCliError, toCliError } from '../errors.ts'
import { formatHelpText } from '../help-text.ts'
import { parseArgs } from '../parse-args.ts'
import { createCommandReporter, type TextChannel } from '../reporter.ts'
import { loadRouteMap, type LoadedRouteMap, type RouteTreeNode } from '../route-map.ts'
import { lightRed } from '../terminal.ts'

const CONTROLLERS_PATH_PREFIX = 'app/controllers/'

export async function runRoutesCommand(argv: string[], context: CliContext): Promise<number> {
  if (argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(getRoutesCommandHelpText())
    return 0
  }

  try {
    let options = parseRoutesCommandArgs(argv)
    let routeMap = await loadRouteMap(context.cwd)

    if (options.json) {
      process.stdout.write(`${JSON.stringify(routeMap, null, 2)}\n`)
    } else {
      let reporter = createCommandReporter({ remixVersion: context.remixVersion })
      writeRouteMap(reporter.out, routeMap, options)
      reporter.finish()
    }

    return 0
  } catch (error) {
    process.stderr.write(
      renderCliError(toCliError(error), { helpText: getRoutesCommandHelpText(process.stderr) }),
    )
    return 1
  }
}

export function getRoutesCommandHelpText(target: NodeJS.WriteStream = process.stdout): string {
  return formatHelpText(
    {
      description: 'Show the Remix route tree for the current app.',
      examples: [
        'remix routes',
        'remix routes --table',
        'remix routes --table --no-headers',
        'remix routes --verbose',
        'remix routes --json',
      ],
      options: [
        { description: 'Print the normalized route tree as JSON', label: '--json' },
        { description: 'Print routes as a flat table', label: '--table' },
        {
          description: 'Omit the table header row when using --table',
          label: '--no-headers',
        },
        { description: 'Show full owner paths in tree or table output', label: '--verbose' },
      ],
      usage: ['remix routes [--json | --table] [--no-headers] [--verbose] [--no-color]'],
    },
    target,
  )
}

interface RoutesCommandOptions {
  json: boolean
  noHeaders: boolean
  table: boolean
  verbose: boolean
}

function parseRoutesCommandArgs(argv: string[]): RoutesCommandOptions {
  let parsed = parseArgs(
    argv,
    {
      json: { flag: '--json', type: 'boolean' },
      noHeaders: { flag: '--no-headers', type: 'boolean' },
      table: { flag: '--table', type: 'boolean' },
      verbose: { flag: '--verbose', type: 'boolean' },
    },
    { maxPositionals: 0 },
  )

  let json = parsed.options.json
  let noHeaders = parsed.options.noHeaders
  let table = parsed.options.table
  let verbose = parsed.options.verbose

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

function writeRouteMap(
  out: TextChannel,
  routeMap: LoadedRouteMap,
  options: RoutesCommandOptions,
): void {
  if (routeMap.tree.length === 0) {
    out.line('No routes.')
    return
  }

  if (options.table) {
    writeRouteTable(out, routeMap, options)
    return
  }

  let lines: string[] = []
  renderRouteNodes(lines, routeMap.tree, '', true, null, options)
  for (let line of lines) {
    out.line(line)
  }
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

function writeRouteTable(
  out: TextChannel,
  routeMap: LoadedRouteMap,
  options: RoutesCommandOptions,
): void {
  let rows = flattenRoutes(routeMap.tree).map((node) => ({
    method: node.method!,
    node,
    owner: formatOwner(node, options),
    path: node.pattern!,
    route: node.name,
  }))
  out.table({
    formatRow(line, rowIndex) {
      return colorRouteLine(line, rows[rowIndex]!.node)
    },
    headers: ['Route', 'Method', 'Path', 'Owner'],
    noHeaders: options.noHeaders,
    rows: rows.map((row) => [row.route, row.method, row.path, row.owner]),
  })
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

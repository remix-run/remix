import * as process from 'node:process'

import { UsageError } from '../errors.ts'
import { loadRouteMap, type LoadedRouteMap, type RouteTreeNode } from '../route-map.ts'

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
      process.stdout.write(renderRouteMap(routeMap))
    }

    return 0
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`${error.message}\n\n`)
      process.stderr.write(getRoutesCommandHelpText())
      return 1
    }

    if (error instanceof Error) {
      process.stderr.write(`${error.message}\n`)
      return 1
    }

    throw error
  }
}

export function getRoutesCommandHelpText(): string {
  return `Usage:
  remix routes [--json]

Show the Remix route tree for the current app.

Options:
  --json       Print the normalized route tree as JSON

Examples:
  remix routes
  remix routes --json
`
}

function parseRoutesCommandArgs(argv: string[]): { json: boolean } {
  let json = false

  for (let arg of argv) {
    if (arg === '--json') {
      json = true
      continue
    }

    if (arg.startsWith('-')) {
      throw new UsageError(`Unknown argument: ${arg}`)
    }

    throw new UsageError(`Unexpected extra argument: ${arg}`)
  }

  return { json }
}

function renderRouteMap(routeMap: LoadedRouteMap): string {
  if (routeMap.tree.length === 0) {
    return 'No routes.\n'
  }

  let lines: string[] = []

  routeMap.tree.forEach((node, index) => {
    renderRouteNode(lines, node, '', index === routeMap.tree.length - 1, true)
  })

  return `${lines.join('\n')}\n`
}

function renderRouteNode(
  lines: string[],
  node: RouteTreeNode,
  prefix: string,
  isLast: boolean,
  isRoot: boolean,
): void {
  let branch = isRoot ? '' : isLast ? '└─ ' : '├─ '
  lines.push(`${prefix}${branch}${formatRouteNode(node)}`)

  if (node.kind !== 'group') {
    return
  }

  let childPrefix = isRoot ? '' : `${prefix}${isLast ? '   ' : '│  '}`
  node.children.forEach((child, index) => {
    renderRouteNode(lines, child, childPrefix, index === node.children.length - 1, false)
  })
}

function formatRouteNode(node: RouteTreeNode): string {
  let owner = `${node.owner.path}${node.owner.exists ? '' : ' [missing]'}`

  if (node.kind === 'group') {
    return `${node.key} -> ${owner}`
  }

  return `${node.key} ${node.method!.padEnd(6)} ${node.pattern} -> ${owner}`
}

import * as process from 'node:process'
import { pathToFileURL } from 'node:url'

import type { RawRouteTreeNode } from './route-map.ts'

void run().catch((error: unknown) => {
  if (error instanceof Error) {
    process.stderr.write(`${error.message}\n`)
  } else {
    process.stderr.write(`${String(error)}\n`)
  }

  setExitCode(1)
})

async function run(): Promise<void> {
  let routesFile = process.argv[2]
  if (typeof routesFile !== 'string' || routesFile.length === 0) {
    throw new Error('Missing app/routes.ts path.')
  }

  let tree = await loadRawRouteTree(routesFile)
  process.stdout.write(JSON.stringify(tree))
}

async function loadRawRouteTree(routesFile: string): Promise<RawRouteTreeNode[]> {
  let routeModule = await import(pathToFileURL(routesFile).href)

  if (!('routes' in routeModule)) {
    throw new Error(`Route module ${routesFile} must export a named "routes" value.`)
  }

  return normalizeRouteGroup(Reflect.get(routeModule, 'routes'), [], new Map())
}

function normalizeRouteGroup(
  value: unknown,
  parentSegments: string[],
  seen: Map<object, string>,
): RawRouteTreeNode[] {
  if (!isPlainObject(value)) {
    let location = parentSegments.length === 0 ? 'routes' : parentSegments.join('.')
    throw new Error(`Invalid route map value at "${location}". Expected a nested route object.`)
  }

  let existingPath = seen.get(value)
  let currentPath = parentSegments.length === 0 ? 'routes' : parentSegments.join('.')
  if (existingPath != null) {
    throw new Error(`Detected a route map cycle at "${currentPath}" via "${existingPath}".`)
  }

  seen.set(value, currentPath)

  try {
    return Object.entries(value).map(([key, entryValue]) => {
      let nameSegments = [...parentSegments, key]
      let name = nameSegments.join('.')

      if (isRouteLeaf(entryValue)) {
        return {
          children: [],
          key,
          kind: 'route',
          method: entryValue.method,
          name,
          pattern: entryValue.pattern.source,
        } satisfies RawRouteTreeNode
      }

      if (isPlainObject(entryValue)) {
        return {
          children: normalizeRouteGroup(entryValue, nameSegments, seen),
          key,
          kind: 'group',
          name,
        } satisfies RawRouteTreeNode
      }

      throw new Error(`Invalid route map value at "${name}". Expected a route or nested route object.`)
    })
  } finally {
    seen.delete(value)
  }
}

function isRouteLeaf(
  value: unknown,
): value is { method: string; pattern: { source: string } } {
  return (
    typeof value === 'object' &&
    value != null &&
    typeof Reflect.get(value, 'method') === 'string' &&
    typeof Reflect.get(value, 'pattern') === 'object' &&
    Reflect.get(value, 'pattern') != null &&
    typeof Reflect.get(Reflect.get(value, 'pattern'), 'source') === 'string'
  )
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value == null) {
    return false
  }

  let prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function setExitCode(exitCode: number) {
  globalThis.process.exitCode = exitCode
}

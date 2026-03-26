import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as process from 'node:process'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import {
  getActionOwnerCandidates,
  getControllerOwnerCandidates,
  getPreferredOwnerDisplayPath,
} from './controller-files.ts'

export type RouteOwnerKind = 'action' | 'controller'
export type RouteTreeNodeKind = 'group' | 'route'

export interface RouteTreeOwner {
  exists: boolean
  kind: RouteOwnerKind
  path: string
}

export interface RouteTreeNode {
  children: RouteTreeNode[]
  key: string
  kind: RouteTreeNodeKind
  method?: string
  name: string
  owner: RouteTreeOwner
  pattern?: string
}

export interface LoadedRouteMap {
  appRoot: string
  routesFile: string
  tree: RouteTreeNode[]
}

export interface RawRouteTreeNode {
  children: RawRouteTreeNode[]
  key: string
  kind: RouteTreeNodeKind
  method?: string
  name: string
  pattern?: string
}

export async function loadRouteMap(cwd: string = process.cwd()): Promise<LoadedRouteMap> {
  let appRoot = await findRemixAppRoot(cwd)
  let routesFile = path.join(appRoot, 'app', 'routes.ts')
  let rawTree = await loadRawRouteMap(appRoot, routesFile)
  let tree = await decorateRouteTree(appRoot, rawTree)

  return {
    appRoot,
    routesFile,
    tree,
  }
}

async function loadRawRouteMap(appRoot: string, routesFile: string): Promise<RawRouteTreeNode[]> {
  let workerPath = getRouteMapWorkerPath()
  let child = spawn(process.execPath, [workerPath, routesFile], {
    cwd: appRoot,
    env: createRouteMapWorkerEnv(),
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let stdout = ''
  let stderr = ''

  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')

  child.stdout.on('data', (chunk: string) => {
    stdout += chunk
  })

  child.stderr.on('data', (chunk: string) => {
    stderr += chunk
  })

  let exitResult = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolve, reject) => {
      child.once('error', reject)
      child.once('close', (code, signal) => {
        resolve({ code, signal })
      })
    },
  )

  if (exitResult.signal != null) {
    throw new Error(`Route-map loader exited from signal ${exitResult.signal}.`)
  }

  if (exitResult.code !== 0) {
    let message = stderr.trim()
    if (message.length === 0) {
      message = 'Route-map loader failed.'
    }

    throw new Error(message)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(stdout)
  } catch {
    throw new Error('Route-map loader returned invalid JSON.')
  }

  return assertRawRouteTree(parsed)
}

async function decorateRouteTree(
  appRoot: string,
  rawTree: RawRouteTreeNode[],
  parentSegments: string[] = [],
): Promise<RouteTreeNode[]> {
  return Promise.all(
    rawTree.map(async (rawNode) => {
      let owner = await getRouteOwner(appRoot, rawNode, parentSegments)
      let nextParentSegments =
        rawNode.kind === 'group' ? [...parentSegments, rawNode.key] : parentSegments

      return {
        children:
          rawNode.kind === 'group'
            ? await decorateRouteTree(appRoot, rawNode.children, nextParentSegments)
            : [],
        key: rawNode.key,
        kind: rawNode.kind,
        method: rawNode.method,
        name: rawNode.name,
        owner,
        pattern: rawNode.pattern,
      } satisfies RouteTreeNode
    }),
  )
}

async function getRouteOwner(
  appRoot: string,
  rawNode: RawRouteTreeNode,
  parentSegments: string[],
): Promise<RouteTreeOwner> {
  let kind: RouteOwnerKind
  let candidatePaths: string[]

  if (rawNode.kind === 'group') {
    kind = 'controller'
    candidatePaths = getControllerOwnerCandidates([...parentSegments, rawNode.key])
  } else if (parentSegments.length === 0) {
    kind = 'action'
    candidatePaths = getActionOwnerCandidates([rawNode.key])
  } else {
    kind = 'controller'
    candidatePaths = getControllerOwnerCandidates(parentSegments)
  }

  let existingPath = await findFirstExistingPath(appRoot, candidatePaths)

  return {
    exists: existingPath != null,
    kind,
    path: existingPath ?? getPreferredOwnerDisplayPath(candidatePaths),
  }
}

function assertRawRouteTree(value: unknown): RawRouteTreeNode[] {
  if (!Array.isArray(value)) {
    throw new Error('Route-map loader returned an invalid tree.')
  }

  return value.map((entry) => assertRawRouteTreeNode(entry))
}

function assertRawRouteTreeNode(value: unknown): RawRouteTreeNode {
  if (typeof value !== 'object' || value == null) {
    throw new Error('Route-map loader returned an invalid route node.')
  }

  let key = Reflect.get(value, 'key')
  let name = Reflect.get(value, 'name')
  let kind = Reflect.get(value, 'kind')
  let children = Reflect.get(value, 'children')

  if (typeof key !== 'string' || typeof name !== 'string') {
    throw new Error('Route-map loader returned a route node without a valid name.')
  }

  if (kind !== 'group' && kind !== 'route') {
    throw new Error(`Route-map loader returned an unknown node kind for "${name}".`)
  }

  if (!Array.isArray(children)) {
    throw new Error(`Route-map loader returned invalid children for "${name}".`)
  }

  if (kind === 'group') {
    return {
      children: children.map((child) => assertRawRouteTreeNode(child)),
      key,
      kind,
      name,
    }
  }

  let method = Reflect.get(value, 'method')
  let pattern = Reflect.get(value, 'pattern')

  if (typeof method !== 'string' || typeof pattern !== 'string') {
    throw new Error(`Route-map loader returned an invalid route leaf for "${name}".`)
  }

  return {
    children: [],
    key,
    kind,
    method,
    name,
    pattern,
  }
}

async function findRemixAppRoot(startDir: string): Promise<string> {
  let currentDir = path.resolve(startDir)

  while (true) {
    if (await pathExists(path.join(currentDir, 'app', 'routes.ts'))) {
      return currentDir
    }

    let parentDir = path.dirname(currentDir)
    if (parentDir === currentDir) {
      break
    }

    currentDir = parentDir
  }

  throw new Error('Could not find app/routes.ts. Run this command inside a Remix app.')
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

async function findFirstExistingPath(
  appRoot: string,
  candidatePaths: string[],
): Promise<string | null> {
  for (let candidatePath of candidatePaths) {
    if (await pathExists(path.join(appRoot, candidatePath))) {
      return candidatePath
    }
  }

  return null
}

function getRouteMapWorkerPath(): string {
  let currentFilePath = fileURLToPath(import.meta.url)
  let extension = currentFilePath.endsWith('.ts') ? '.ts' : '.js'

  return fileURLToPath(new URL(`./load-route-map-worker${extension}`, import.meta.url))
}

function createRouteMapWorkerEnv(): NodeJS.ProcessEnv {
  let env = { ...process.env }

  for (let key of Object.keys(env)) {
    if (key.startsWith('NODE_TEST_')) {
      delete env[key]
    }
  }

  return env
}

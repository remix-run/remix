import type { Component } from '@remix-run/reconciler'
import { jsx } from './jsx/jsx-runtime.ts'
import { createDomReconciler } from './dom-reconciler.ts'

type HydrationData = {
  moduleUrl: string
  exportName: string
  props: Record<string, unknown>
}

type RmxData = {
  h?: Record<string, HydrationData>
}

type HydrationBoundary = {
  id: string
  start: Comment
  end: Comment
}

export type ClientModuleLoader = (
  moduleUrl: string,
  exportName: string,
) => Promise<unknown> | unknown

export type HydrateClientEntriesOptions = {
  document?: Document
  loadModule: ClientModuleLoader
  onError?: (error: unknown, boundaryId: null | string) => void
}

export type HydratedRoot = {
  flush(): void
  dispose(): void
}

export async function hydrateClientEntries(
  options: HydrateClientEntriesOptions,
): Promise<HydratedRoot> {
  let doc = options.document ?? document
  let data = readRmxData(doc)
  let entries = data.h ?? {}
  let boundaries = findHydrationBoundaries(doc, (error) => options.onError?.(error, null))
  let roots: ReconcilerRoot[] = []
  if (boundaries.length === 0) {
    return createHydratedRoot(roots)
  }

  let moduleCache = new Map<string, Component<any, any, any>>()
  let moduleLoads = new Map<string, Promise<Component<any, any, any> | undefined>>()
  let reconciler = createDomReconciler(doc)

  let jobs = boundaries.map(async (boundary) => {
    let entry = entries[boundary.id]
    if (!entry) {
      return
    }
    let component = await getOrLoadModule(
      `${entry.moduleUrl}#${entry.exportName}`,
      entry,
      options.loadModule,
      moduleCache,
      moduleLoads,
      (error) => options.onError?.(error, boundary.id),
    )
    if (!component) {
      return
    }
    if (!isBoundaryLive(boundary)) {
      return
    }
    try {
      let root = createBoundaryRoot(reconciler, boundary)
      let element = jsx(component, reviveSerializedObject(entry.props) as any)
      root.render(element)
      roots.push(root)
    } catch (error) {
      options.onError?.(error, boundary.id)
    }
  })

  await Promise.all(jobs)
  let hydratedRoot = createHydratedRoot(roots)
  hydratedRoot.flush()
  return hydratedRoot
}

type ReconcilerRoot = ReturnType<ReturnType<typeof createDomReconciler>['createRoot']>

function createHydratedRoot(roots: ReconcilerRoot[]): HydratedRoot {
  return {
    flush() {
      for (let root of roots) {
        root.flush()
      }
    },
    dispose() {
      for (let root of roots) {
        root.dispose()
      }
    },
  }
}

function createBoundaryRoot(
  reconciler: ReturnType<typeof createDomReconciler>,
  boundary: HydrationBoundary,
) {
  return reconciler.createRoot([boundary.start, boundary.end])
}

function readRmxData(doc: Document): RmxData {
  let node = doc.getElementById('rmx-data')
  if (!node) return {}
  let json = node.textContent ?? ''
  if (!json.trim()) return {}
  try {
    let parsed = JSON.parse(json) as RmxData
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function findHydrationBoundaries(doc: Document, onError: (error: unknown) => void) {
  let root = doc.body ?? doc
  let boundaries: HydrationBoundary[] = []
  walkCommentsInNodes(Array.from(root.childNodes), (comment) => {
    let marker = comment.data.trim()
    if (!marker.startsWith('rmx:h:')) return
    let id = marker.slice('rmx:h:'.length)
    if (!id) return
    try {
      let end = findEndMarker(comment, isHydrationStart, isHydrationEnd)
      boundaries.push({ id, start: comment, end })
    } catch (error) {
      onError(error)
    }
  })
  return boundaries
}

function walkCommentsInNodes(nodes: Node[], onComment: (comment: Comment) => void) {
  for (let index = 0; index < nodes.length; index++) {
    let node = nodes[index]
    if (isFrameStart(node)) {
      let end = findEndMarker(node, isFrameStart, isFrameEnd)
      index = nodes.indexOf(end)
      continue
    }
    if (node.nodeType === Node.COMMENT_NODE) {
      onComment(node as Comment)
    }
    if (node.childNodes && node.childNodes.length > 0) {
      walkCommentsInNodes(Array.from(node.childNodes), onComment)
    }
  }
}

function isBoundaryLive(boundary: HydrationBoundary) {
  if (!boundary.start.isConnected || !boundary.end.isConnected) return false
  if (boundary.start.parentNode == null) return false
  if (boundary.start.parentNode !== boundary.end.parentNode) return false
  if (boundary.start.data.trim() !== `rmx:h:${boundary.id}`) return false
  if (boundary.end.data.trim() !== '/rmx:h') return false
  return true
}

function isHydrationStart(node: Comment) {
  return node.data.trim().startsWith('rmx:h:')
}

function isHydrationEnd(node: Comment) {
  return node.data.trim() === '/rmx:h'
}

function isFrameStart(node: Node): node is Comment {
  return node instanceof Comment && node.data.trim().startsWith('f:')
}

function isFrameEnd(node: Comment) {
  return node.data.trim() === '/f'
}

function findEndMarker(
  start: Comment,
  isStart: (node: Comment) => boolean,
  isEnd: (node: Comment) => boolean,
) {
  let cursor: Node | null = start.nextSibling
  let depth = 1
  while (cursor) {
    if (cursor.nodeType === Node.COMMENT_NODE) {
      let comment = cursor as Comment
      if (isStart(comment)) {
        depth++
      } else if (isEnd(comment)) {
        depth--
        if (depth === 0) return comment
      }
    }
    cursor = cursor.nextSibling
  }
  throw new Error('End marker not found')
}

async function getOrLoadModule(
  key: string,
  entry: HydrationData,
  loadModule: ClientModuleLoader,
  cache: Map<string, Component<any, any, any>>,
  inFlight: Map<string, Promise<Component<any, any, any> | undefined>>,
  onError: (error: unknown) => void,
) {
  let cached = cache.get(key)
  if (cached) return cached
  let existing = inFlight.get(key)
  if (existing) return existing
  let promise = (async () => {
    try {
      let loaded = await loadModule(entry.moduleUrl, entry.exportName)
      if (typeof loaded !== 'function') {
        throw new Error(
          `Export "${entry.exportName}" from "${entry.moduleUrl}" is not a component function`,
        )
      }
      let component = loaded as Component<any, any, any>
      cache.set(key, component)
      return component
    } catch (error) {
      onError(error)
      return undefined
    } finally {
      inFlight.delete(key)
    }
  })()
  inFlight.set(key, promise)
  return promise
}

function reviveSerializedObject(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  let revived = reviveSerializedValue(value)
  if (!revived || typeof revived !== 'object' || Array.isArray(revived)) return {}
  return revived as Record<string, unknown>
}

function reviveSerializedValue(value: unknown): unknown {
  if (value == null) return value
  if (typeof value !== 'object') return value
  if (Array.isArray(value)) {
    return value.map((entry) => reviveSerializedValue(entry))
  }
  let record = value as Record<string, unknown>
  if (record.$rmx === true && typeof record.type === 'string') {
    let props = reviveSerializedObject(record.props)
    let key = reviveSerializedValue(record.key)
    return jsx(record.type as any, props as any, key as any)
  }
  let output: Record<string, unknown> = {}
  for (let key in record) {
    output[key] = reviveSerializedValue(record[key])
  }
  return output
}

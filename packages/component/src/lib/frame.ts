import { jsx } from './jsx.ts'
import { createFrameHandle, type FrameContent } from './component.ts'
import { invariant } from './invariant.ts'
import type { RemixElement } from './jsx.ts'
import type { FrameHandle } from './component.ts'
import type { Scheduler } from './vdom.ts'
import { createRangeRoot, createScheduler } from './vdom.ts'
import { diffNodes } from './diff-dom.ts'

type FrameRoot = [Comment, Comment] | Element | Document | DocumentFragment

type FrameData = {
  status: 'pending' | 'resolved'
  name?: string
  src: string
}

type HydrationData = {
  moduleUrl: string
  exportName: string
  props: Record<string, unknown>
}

type RmxData = {
  h?: Record<string, HydrationData>
  f?: Record<string, FrameData>
}

export type VirtualRootMarker = Comment & {
  $rmx: ReturnType<typeof createRangeRoot>
}

type FrameMarkerData = FrameData & {
  id: string
}

type PendingHydrationRoots = Map<Comment, [Comment, RemixElement]>

type LoadModule = (moduleUrl: string, exportName: string) => Promise<Function> | Function

type ResolveFrame = (src: string) => Promise<FrameContent> | FrameContent

export type FrameContext = {
  loadModule: LoadModule
  resolveFrame: ResolveFrame
  pendingRoots: PendingHydrationRoots
  scheduler: Scheduler
  frame: FrameHandle
  data: RmxData
  moduleCache: Map<string, Function>
  frameInstances: WeakMap<Comment, Frame>
  regionTailRef?: ChildNode | null
  regionParent?: ParentNode | null
}

export type FrameInit = {
  src: string
  loadModule: LoadModule
  resolveFrame: ResolveFrame
  pendingHydrationRoots: PendingHydrationRoots
  scheduler?: Scheduler
  marker?: FrameMarkerData
  data: RmxData
  moduleCache: Map<string, Function>
  frameInstances: WeakMap<Comment, Frame>
}

export type Frame = {
  render: (content: FrameContent) => Promise<void>
  ready: () => Promise<void>
  flush: () => void
}

let defaultInit: FrameInit = {
  src: '/',
  loadModule: async () => {
    throw new Error('loadModule not implemented')
  },
  resolveFrame: async () => {
    throw new Error('resolveFrame not implemented')
  },
  pendingHydrationRoots: new Map(),
  data: {},
  moduleCache: new Map(),
  frameInstances: new WeakMap(),
}

export function createFrame(root: FrameRoot, init?: Partial<FrameInit>): Frame {
  let config: FrameInit = { ...defaultInit, ...init }
  let container = createContainer(root)

  // Merge any rmx-data found in the current document once at startup.
  mergeRmxDataFromDocument(config.data, container.doc)

  let frame = createFrameHandle({
    src: config.src,
    reload: async () => {
      let content = await config.resolveFrame(config.src)
      await render(content)
    },
    replace: async (content: FrameContent) => {
      await render(content)
    },
  })

  let context: FrameContext = {
    loadModule: config.loadModule,
    resolveFrame: config.resolveFrame,
    pendingRoots: config.pendingHydrationRoots,
    scheduler: config.scheduler ?? createScheduler(container.doc, frame),
    frame,
    data: config.data,
    moduleCache: config.moduleCache,
    frameInstances: config.frameInstances,
    regionTailRef: container.regionTailRef,
    regionParent: container.regionParent,
  }

  async function render(content: FrameContent): Promise<void> {
    let fragment =
      typeof content === 'string' ? createFragmentFromString(container.doc, content) : content
    hoistHeadElements(container.doc, fragment)
    mergeRmxDataFromFragment(context.data, fragment)

    let nextContainer = createContainer(fragment)
    await populatePendingRoots(nextContainer, context)

    diffNodes(container.childNodes, Array.from(nextContainer.childNodes), {
      ...context,
      regionTailRef: container.regionTailRef,
      regionParent: container.regionParent,
    })

    hydratedAndCreateSubFrames(container.childNodes, context)
  }

  async function hydrateInitial(): Promise<void> {
    await populatePendingRoots(container, context)
    hydratedAndCreateSubFrames(container.childNodes, context)

    if (config.marker?.status === 'pending') {
      let early = getEarlyFrameContent(config.marker.id)
      if (early) {
        hoistHeadElements(container.doc, early)
        mergeRmxDataFromFragment(context.data, early)
        await render(early)
      } else {
        setupTemplateObserver(config.marker.id, async (fragment) => {
          hoistHeadElements(container.doc, fragment)
          mergeRmxDataFromFragment(context.data, fragment)
          await render(fragment)
        })
      }
    }
  }

  let readyPromise = hydrateInitial()

  return {
    render,
    ready: () => readyPromise,
    flush: () => context.scheduler.dequeue(),
  }
}

function mergeRmxDataFromDocument(into: RmxData, doc: Document): void {
  let scripts = Array.from(doc.querySelectorAll('script#rmx-data'))
  for (let script of scripts) {
    if (!(script instanceof HTMLScriptElement)) continue
    mergeRmxData(into, parseRmxDataScript(script))
    script.remove()
  }
}

function mergeRmxDataFromFragment(into: RmxData, fragment: DocumentFragment): void {
  let scripts = Array.from(fragment.querySelectorAll('script#rmx-data'))
  for (let script of scripts) {
    if (!(script instanceof HTMLScriptElement)) continue
    mergeRmxData(into, parseRmxDataScript(script))
    script.remove()
  }
}

function hoistHeadElements(doc: Document, fragment: DocumentFragment): void {
  let heads = Array.from(fragment.querySelectorAll('head'))
  if (heads.length === 0) return

  let target = doc.head
  if (!target) return

  for (let head of heads) {
    while (head.firstChild) {
      target.appendChild(head.firstChild)
    }
    head.remove()
  }
}

function parseRmxDataScript(script: HTMLScriptElement): RmxData {
  try {
    return JSON.parse(script.textContent || '{}')
  } catch {
    console.error('[createFrame] Failed to parse rmx-data script')
    return {}
  }
}

function mergeRmxData(into: RmxData, from: RmxData): void {
  if (from.h) {
    if (!into.h) into.h = {}
    Object.assign(into.h, from.h)
  }

  if (from.f) {
    if (!into.f) into.f = {}
    Object.assign(into.f, from.f)
  }
}

async function populatePendingRoots(
  container: FrameContainer,
  context: FrameContext,
): Promise<void> {
  let hydrationMarkers = findHydrationMarkers(container)
  if (hydrationMarkers.length === 0) return

  let hydrationData = context.data.h
  if (!hydrationData) return

  // Load all modules in parallel (with caching).
  let loadPromises: Array<Promise<void>> = []
  let requested = new Set<string>()
  for (let { id } of hydrationMarkers) {
    let entry = hydrationData[id]
    if (!entry) continue

    let key = `${entry.moduleUrl}#${entry.exportName}`
    if (context.moduleCache.has(key) || requested.has(key)) continue
    requested.add(key)

    loadPromises.push(
      (async () => {
        try {
          let mod = await context.loadModule(entry.moduleUrl, entry.exportName)
          if (typeof mod !== 'function') {
            throw new Error(
              `Export "${entry.exportName}" from "${entry.moduleUrl}" is not a function`,
            )
          }
          context.moduleCache.set(key, mod)
        } catch (error) {
          console.error(`[createFrame] Failed to load module for ${id}:`, error)
        }
      })(),
    )
  }

  await Promise.all(loadPromises)

  for (let marker of hydrationMarkers) {
    let entry = hydrationData[marker.id]
    if (!entry) continue
    let key = `${entry.moduleUrl}#${entry.exportName}`
    let component = context.moduleCache.get(key)
    if (!component) continue
    let vElement = createElement(component, entry.props)
    context.pendingRoots.set(marker.start, [marker.end, vElement])
  }
}

function createElement(component: Function, props: Record<string, unknown>): RemixElement {
  return jsx(component as any, props as any)
}

function hydrateRegion(
  vElement: RemixElement,
  start: Comment,
  end: Comment,
  context: FrameContext,
): void {
  context.pendingRoots.delete(start)

  let root = createRangeRoot([start, end], {
    scheduler: context.scheduler,
    frame: context.frame,
  })

  Object.defineProperty(start, '$rmx', { value: root, enumerable: false })
  root.render(vElement)
}

function hydratedAndCreateSubFrames(nodes: Node[], context: FrameContext) {
  for (let i = 0; i < nodes.length; i++) {
    let node = nodes[i]

    if (node instanceof Comment && context.pendingRoots.has(node)) {
      let info = context.pendingRoots.get(node)
      invariant(info, 'Expected hydration element')
      let [end, element] = info
      hydrateRegion(element, node, end, context)
      i = nodes.indexOf(end)
      continue
    }

    if (isFrameStart(node)) {
      let end = findEndMarker(node, isFrameStart, isFrameEnd)

      if (!context.frameInstances.has(node)) {
        let id = getFrameId(node)
        let marker = context.data.f?.[id]
        if (marker) {
          let frameMarker: FrameMarkerData = { ...marker, id }
          let subFrame = createFrame([node, end], {
            src: frameMarker.src,
            marker: frameMarker,
            loadModule: context.loadModule,
            resolveFrame: context.resolveFrame,
            pendingHydrationRoots: context.pendingRoots,
            scheduler: context.scheduler,
            data: context.data,
            moduleCache: context.moduleCache,
            frameInstances: context.frameInstances,
          })
          context.frameInstances.set(node, subFrame)
        }
      }

      i = nodes.indexOf(end)
      continue
    }

    if (node.childNodes && node.childNodes.length > 0) {
      hydratedAndCreateSubFrames(Array.from(node.childNodes), context)
    }
  }
}

function getEarlyFrameContent(id: string): DocumentFragment | null {
  let template = document.querySelector(`template#${id}`)
  if (template instanceof HTMLTemplateElement) {
    let fragment = template.content
    template.remove()
    return fragment
  }
  return null
}

function setupTemplateObserver(id: string, cb: (fragment: DocumentFragment) => void) {
  let root = document.body ?? document.documentElement ?? document
  let observer = new MutationObserver((mutations) => {
    for (let mutation of mutations) {
      for (let node of mutation.addedNodes) {
        if (node instanceof HTMLTemplateElement && node.id === id) {
          observer.disconnect()
          node.remove()
          cb(node.content)
          return
        }
      }
    }
  })

  observer.observe(root, { childList: true })
}

type FrameContainer = {
  doc: Document
  root: ParentNode
  childNodes: Node[]
  regionTailRef?: ChildNode | null
  regionParent?: ParentNode | null
}

function createContainer(root: FrameRoot): FrameContainer {
  return Array.isArray(root) ? createCommentContainer(root) : createElementContainer(root)
}

function createElementContainer(root: Document | Element | DocumentFragment): FrameContainer {
  let doc = root instanceof Document ? root : (root.ownerDocument ?? document)
  return {
    doc,
    root,
    get childNodes() {
      return Array.from(root.childNodes)
    },
  }
}

function createCommentContainer([start, end]: [Comment, Comment]): FrameContainer {
  let parent = end.parentNode
  invariant(parent, 'Invalid comment container')
  invariant(start.parentNode === parent, 'Boundaries must share parent')
  let doc = parent.ownerDocument ?? document

  let getChildNodesBetween = (): Node[] => {
    let nodes: Node[] = []
    let node = start.nextSibling
    while (node && node !== end) {
      nodes.push(node)
      node = node.nextSibling
    }
    return nodes
  }

  return {
    doc,
    root: parent,
    get childNodes() {
      return getChildNodesBetween()
    },
    regionTailRef: end,
    regionParent: parent,
  }
}

function createFragmentFromString(doc: Document, content: string): DocumentFragment {
  let template = doc.createElement('template')
  template.innerHTML = content.trim()
  return template.content
}

type HydrationMarker = {
  id: string
  start: Comment
  end: Comment
}

function findHydrationMarkers(container: FrameContainer): HydrationMarker[] {
  let results: HydrationMarker[] = []

  forEachComment(container, (comment) => {
    let trimmed = comment.data.trim()
    if (!trimmed.startsWith('rmx:h:')) return

    let id = trimmed.slice('rmx:h:'.length)
    let end = findEndMarker(comment, isHydrationStart, isHydrationEnd)
    results.push({ id, start: comment, end })
  })

  return results
}

function forEachComment(container: FrameContainer, cb: (comment: Comment) => void): void {
  if (container.regionTailRef && container.regionParent) {
    // Bounded region: walk between boundaries and recurse
    walkCommentsInNodes(container.childNodes, cb)
    return
  }

  let walker = container.doc.createTreeWalker(container.root, NodeFilter.SHOW_COMMENT)
  let node: Comment | null
  while ((node = walker.nextNode() as Comment | null)) {
    cb(node)
  }
}

function walkCommentsInNodes(nodes: Node[], cb: (comment: Comment) => void): void {
  for (let node of nodes) {
    if (node.nodeType === Node.COMMENT_NODE) cb(node as Comment)
    if (node.childNodes && node.childNodes.length > 0) {
      walkCommentsInNodes(Array.from(node.childNodes), cb)
    }
  }
}

function isHydrationStart(node: Comment): boolean {
  return node.data.trim().startsWith('rmx:h:')
}

function isHydrationEnd(node: Comment): boolean {
  return node.data.trim() === '/rmx:h'
}

function isFrameStart(node: Node): node is Comment {
  return node instanceof Comment && node.data.trim().startsWith('rmx:f:')
}

function isFrameEnd(node: Comment): boolean {
  return node.data.trim() === '/rmx:f'
}

function getFrameId(start: Comment): string {
  let trimmed = start.data.trim()
  invariant(trimmed.startsWith('rmx:f:'), 'Invalid frame start marker')
  return trimmed.slice('rmx:f:'.length)
}

function findEndMarker(
  start: Comment,
  isStart: (node: Comment) => boolean,
  isEnd: (node: Comment) => boolean,
): Comment {
  let node: Node | null = start.nextSibling
  let depth = 1

  while (node) {
    if (node.nodeType === Node.COMMENT_NODE) {
      let comment = node as Comment
      if (isStart(comment)) depth++
      else if (isEnd(comment)) {
        depth--
        if (depth === 0) return comment
      }
    }
    node = node.nextSibling
  }

  throw new Error('End marker not found')
}

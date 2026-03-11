import type { FrameContent, FrameHandle } from './component.ts'
import type { Frame as FrameInstance, FrameRuntime } from './frame.ts'
import { createFrame } from './frame.ts'
import { invariant } from './invariant.ts'
import type { StyleManager } from './style/index.ts'
import type { Scheduler } from './scheduler.ts'
import { createRangeRoot } from './vdom.ts'
import type { VNode } from './vnode.ts'

export function insertFrame(
  node: VNode,
  domParent: ParentNode,
  frame: FrameHandle,
  scheduler: Scheduler,
  styles: StyleManager,
  vParent: VNode,
  anchor?: Node,
  cursor?: Node | null,
): Node | null | undefined {
  let runtime = getFrameRuntime(frame)
  if (!runtime || (runtime as { canResolveFrames?: boolean }).canResolveFrames === false) {
    throw new Error(
      'Cannot render <Frame /> without frame runtime. Use run() or pass frameInit to createRoot/createRangeRoot.',
    )
  }

  if (isFrameStartComment(cursor)) {
    let start = cursor
    let end = findFrameEndComment(start)
    if (end) {
      node._rangeStart = start
      node._rangeEnd = end
      node._parent = vParent
      node._frameResolveToken = 0
      node._frameResolveController = undefined
      node._frameFallbackRoot = undefined
      node._frameResolved = true
      node._range = { first: start, last: end }

      let frameId = getFrameIdFromComment(start)
      let marker = frameId ? runtime.data.f?.[frameId] : undefined
      let src = marker?.src ?? getFrameSrc(node)
      let instance = runtime.frameInstances.get(start)
      if (!instance) {
        instance = createFrame([start, end], {
          name: getFrameName(node),
          src,
          marker: frameId && marker ? { ...marker, id: frameId } : undefined,
          loadModule: runtime.loadModule,
          resolveFrame: runtime.resolveFrame,
          pendingClientEntries: runtime.pendingClientEntries,
          scheduler: runtime.scheduler,
          styleManager: runtime.styleManager,
          data: runtime.data,
          moduleCache: runtime.moduleCache,
          moduleLoads: runtime.moduleLoads,
          frameInstances: runtime.frameInstances,
          namedFrames: runtime.namedFrames,
        })
        runtime.frameInstances.set(start, instance)
      }

      node._frameInstance = instance

      return end.nextSibling
    }
  }

  let doc = (domParent as Node).ownerDocument ?? scheduler.runtime.document
  let start = doc.createComment(` rmx:f:${randomFrameId()} `)
  let end = doc.createComment(' /rmx:f ')
  let doInsert = anchor
    ? (dom: Node) => domParent.insertBefore(dom, anchor)
    : (dom: Node) => domParent.appendChild(dom)

  doInsert(start)
  doInsert(end)

  node._rangeStart = start
  node._rangeEnd = end
  node._parent = vParent
  node._range = { first: start, last: end }

  let fallbackRoot = createRangeRoot([start, end], {
    frame,
    scheduler,
    styleManager: styles,
  })
  fallbackRoot.render(node.props?.fallback ?? null)
  node._frameFallbackRoot = fallbackRoot
  node._frameResolved = false
  node._frameResolveToken = 0

  let instance = createFrame([start, end], {
    name: getFrameName(node),
    src: getFrameSrc(node),
    loadModule: runtime.loadModule,
    resolveFrame: runtime.resolveFrame,
    pendingClientEntries: runtime.pendingClientEntries,
    scheduler: runtime.scheduler,
    styleManager: runtime.styleManager,
    data: runtime.data,
    moduleCache: runtime.moduleCache,
    moduleLoads: runtime.moduleLoads,
    frameInstances: runtime.frameInstances,
    namedFrames: runtime.namedFrames,
  })
  node._frameInstance = instance
  runtime.frameInstances.set(start, instance)

  resolveClientFrame(node, runtime)

  return cursor
}

export function resolveClientFrame(node: VNode, runtime: FrameRuntime): void {
  let frameSrc = getFrameSrc(node)
  let instance = node._frameInstance as FrameInstance | undefined
  if (!instance) return

  let token = (node._frameResolveToken ?? 0) + 1
  node._frameResolveToken = token
  node._frameResolveController?.abort()
  let resolveController = new AbortController()
  node._frameResolveController = resolveController

  Promise.resolve(runtime.resolveFrame(frameSrc, resolveController.signal))
    .then(async (content) => {
      if (node._frameResolveToken !== token || resolveController.signal.aborted) return
      node._frameFallbackRoot?.dispose()
      node._frameFallbackRoot = undefined
      let nextContent = asAbortableFrameContent(content, resolveController.signal)
      await instance.render(nextContent, { signal: resolveController.signal })
      if (node._frameResolveToken !== token || resolveController.signal.aborted) return
      node._frameResolved = true
    })
    .catch(() => {})
    .finally(() => {
      if (node._frameResolveController === resolveController) {
        node._frameResolveController = undefined
      }
    })
}

export function disposeFrameResources(node: VNode): void {
  node._frameResolveToken = (node._frameResolveToken ?? 0) + 1
  node._frameResolveController?.abort()
  node._frameResolveController = undefined
  node._frameFallbackRoot?.dispose()
  node._frameFallbackRoot = undefined
  node._range = undefined

  let frameInstance = node._frameInstance as FrameInstance | undefined
  if (frameInstance) {
    frameInstance.dispose()
    node._frameInstance = undefined
  }
}

function asAbortableFrameContent(content: FrameContent, signal: AbortSignal): FrameContent {
  if (!(content instanceof ReadableStream)) return content
  return createAbortableReadableStream(content, signal)
}

function createAbortableReadableStream(
  source: ReadableStream<Uint8Array>,
  signal: AbortSignal,
): ReadableStream<Uint8Array> {
  let reader = source.getReader()
  let aborted = false

  let onAbort = () => {
    aborted = true
    void reader.cancel(signal.reason)
  }

  if (signal.aborted) onAbort()
  else signal.addEventListener('abort', onAbort, { once: true })

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (aborted) {
        controller.close()
        return
      }

      let removeAbortReadListener: undefined | (() => void)
      let abortRead = new Promise<ReadableStreamReadResult<Uint8Array>>((resolve) => {
        if (signal.aborted) {
          resolve({ done: true, value: undefined as unknown as Uint8Array })
          return
        }
        let onAbortRead = () => {
          resolve({ done: true, value: undefined as unknown as Uint8Array })
        }
        removeAbortReadListener = () => signal.removeEventListener('abort', onAbortRead)
        signal.addEventListener('abort', onAbortRead, { once: true })
      })

      let { done, value } = await Promise.race([reader.read(), abortRead])
      removeAbortReadListener?.()

      if (done) {
        controller.close()
        return
      }
      controller.enqueue(value)
    },
    cancel(reason) {
      signal.removeEventListener('abort', onAbort)
      return reader.cancel(reason)
    },
  })
}

export function removeFrameDomRange(node: VNode, domParent: ParentNode): void {
  let start = node._rangeStart
  let end = node._rangeEnd
  if (!(start instanceof Comment) || !(end instanceof Comment)) return

  let cursor: Node | null = start
  while (cursor) {
    let nextSibling: Node | null = cursor.nextSibling
    if (cursor.parentNode === domParent) {
      domParent.removeChild(cursor)
    }
    if (cursor === end) break
    cursor = nextSibling
  }

  node._rangeStart = undefined
  node._rangeEnd = undefined
  node._range = undefined
}

export function getFrameRuntime(frame: FrameHandle): FrameRuntime | undefined {
  return frame.$runtime as FrameRuntime | undefined
}

export function getFrameSrc(node: VNode): string {
  let src = node.props?.src
  invariant(typeof src === 'string' && src.length > 0, '<Frame /> requires a src prop')
  return src
}

export function getFrameName(node: VNode): string | undefined {
  let name = node.props?.name
  return typeof name === 'string' && name.length > 0 ? name : undefined
}

function randomFrameId(): string {
  return `f${crypto.randomUUID().slice(0, 8)}`
}

export function skipCommentsExceptFrameStart(cursor: Node | null): Node | null {
  while (cursor && cursor.nodeType === Node.COMMENT_NODE) {
    if (isFrameStartComment(cursor)) return cursor
    cursor = cursor.nextSibling
  }
  return cursor
}

function isFrameStartComment(node: Node | null | undefined): node is Comment {
  return node instanceof Comment && node.data.trim().startsWith('rmx:f:')
}

function isFrameEndComment(node: Node | null | undefined): node is Comment {
  return node instanceof Comment && node.data.trim() === '/rmx:f'
}

function getFrameIdFromComment(comment: Comment): string | undefined {
  let text = comment.data.trim()
  if (!text.startsWith('rmx:f:')) return undefined
  return text.slice('rmx:f:'.length)
}

function findFrameEndComment(start: Comment): Comment | null {
  let depth = 1
  let node: Node | null = start.nextSibling

  while (node) {
    if (isFrameStartComment(node)) depth++
    else if (isFrameEndComment(node)) {
      depth--
      if (depth === 0) return node
    }
    node = node.nextSibling
  }

  return null
}

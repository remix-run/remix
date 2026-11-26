import type {
  ComponentHandle,
  FrameHandle,
  Handle,
  Key,
  RemixNode,
  RenderFn,
} from '../runtime/component.ts'

import { isEntry, type EntryComponent } from '../runtime/client-entries.ts'
import {
  createFrameHandle,
  EXEC_URL_ATTR,
  getSelectValues,
  isAllowedHostPropName,
  normalizeAttributeName,
  sanitizeUrlAttribute,
  shouldStringifyBooleanAttribute,
} from '../runtime/vdom.ts'
import { DOCUMENT_NONCE_META_NAME } from '../runtime/nonce.ts'
import {
  appendFlushMarker,
  createFrameStartMarker,
  createHydrationStartMarker,
  ESCAPED_OBJECT,
  FRAME_END_MARKER,
  FRAME_TEMPLATE_END_MARKER,
  HYDRATION_END_MARKER,
  type FlushKind,
  stripFlushMarkers,
} from '../runtime/stream-protocol.ts'
import { composeMixedProps } from '../runtime/mixins/mixin.ts'
import { REMIX_UI_STYLE_LAYER, serializeStyleObject } from '../style/stylesheet.ts'
import { cssMixinType } from '../style/css-mixin.ts'
import {
  Fragment,
  FRAME_NODE,
  invariant,
  isMixinDescriptor,
  isRemixElement,
  jsx,
  normalizeUnsafeHTMLProps,
  Portal,
  type ElementFunction,
  type ElementProps,
  type ElementType,
  type Props,
  type RemixElement,
} from '../runtime/vnode.ts'

interface VNode {
  type: ElementType
  props: ElementProps
  key?: Key
  _handle?: ComponentHandle
  _parent?: VNode
}

/**
 * Creates a server renderer node record from an element type and props.
 *
 * Application components normally use JSX or `createElement` from `remix/component` instead.
 *
 * @param type Host tag, component, or fragment to render.
 * @param props Props passed to the element.
 * @param key Optional reconciliation key.
 * @returns A node record used by the server renderer.
 */
export function createVNode(type: ElementType, props: ElementProps, key?: Key): VNode {
  return { type, props, key }
}

/**
 * Options for server-side rendering to an HTML string.
 */
export interface RenderToStringOptions {
  /**
   * Content Security Policy nonce for generated import maps, module preloads, and CSS mixin styles.
   */
  nonce?: string
}

/**
 * Options for server-side rendering to a byte stream.
 */
export interface RenderToStreamOptions {
  /** Source URL to associate with the current frame render. */
  frameSrc?: string | URL
  /** Source URL for the top-level frame in nested frame renders. */
  topFrameSrc?: string | URL
  /** Signal that cancels pending server rendering work. */
  signal?: AbortSignal
  /** Error hook invoked when rendering work throws. */
  onError?: (error: unknown) => void
  /**
   * Content Security Policy nonce for generated import maps, module preloads, and CSS mixin styles.
   */
  nonce?: string
  /** Callback used to resolve nested frame content during streaming SSR. */
  resolveFrame?: (
    src: string,
    target?: string,
    context?: ResolveFrameContext,
  ) => Promise<string | ReadableStream<Uint8Array>> | string | ReadableStream<Uint8Array>
  /**
   * Callback used to resolve runtime module metadata for client entry modules during SSR.
   */
  resolveClientEntry?: (
    entryId: string,
    component: EntryComponent,
  ) => Promise<ResolvedClientEntry> | ResolvedClientEntry
}

/**
 * Context passed to `resolveFrame` during server rendering.
 */
export interface ResolveFrameContext {
  /** Source URL for the frame currently being resolved. */
  currentFrameSrc: string
  /** Source URL for the top-level frame in the current render. */
  topFrameSrc: string
  /**
   * Nonce from the enclosing render. Pass it to nested `renderToStream()` calls so generated
   * elements use the document's Content Security Policy nonce.
   */
  nonce?: string
}

interface HydrationData {
  moduleUrl: string
  exportName: string
  propsJson: string
}

interface UnresolvedHydrationData {
  entryId: string
  component: EntryComponent
  propsJson: string
}

interface ResolvedClientEntry {
  href: string
  exportName: string
  /** Browser module hrefs to begin preloading before hydrating this entry. */
  preloads?: readonly string[]
  importMap?: ImportMapData
}

/** Import map data accepted by the server renderer. */
export interface ImportMapData {
  /** Top-level module specifier mappings. */
  imports?: ImportMapImports
  /** Module specifier mappings scoped by URL. */
  scopes?: Record<string, ImportMapImports>
  /** Subresource integrity metadata keyed by module URL. */
  integrity?: Record<string, string>
}

type ImportMapAddress = string | null
type ImportMapImports = Record<string, ImportMapAddress>
type AuthoredImportMapEntries = Map<string, ImportMapAddress>
type AuthoredImportMapScope = { imports: AuthoredImportMapEntries }
type StaticSegment = { kind: 'static'; html: string }
interface DocumentElementSegments {
  open: StaticSegment
  close: StaticSegment
}

interface DocumentSegments {
  depth?: number
  html?: DocumentElementSegments
  head?: DocumentElementSegments
  body?: DocumentElementSegments
}

type ManagedImportMap = {
  attrs: string
  segment: StaticSegment
  value: ImportMapData
}

/**
 * Props for {@link ImportMap}, including authored mappings and optional script attributes.
 * The component owns the script's type and contents; external sources and children are excluded.
 */
export type ImportMapProps = Omit<
  Props<'script'>,
  'children' | 'innerHTML' | 'integrity' | 'src' | 'type'
> & {
  /** Initial import map entries to render and merge with resolved client entries. */
  value: ImportMapData
}

/**
 * Renders the document import map and merges maps from server-resolved client entries.
 *
 * @param handle Server component handle containing the initial import map and script attributes.
 * @returns This component is handled directly by the server renderer.
 */
export function ImportMap(handle: Handle<ImportMapProps>): RenderFn {
  void handle
  return () => null
}

interface ClientEntryHeadResources {
  // Preload tags stay nonce-free until the enclosing render serializes its head.
  modulePreloadTags: Set<string>
  importMap?: ImportMapData
}

interface FrameData {
  status: 'pending' | 'resolved' | 'lazy'
  fallback?: boolean
  name?: string
  src: string
}

interface RenderContext {
  selectValues?: Set<string>
  selectScalar?: boolean
  optionText?: string
  insideSvg: boolean
  insideHead: boolean
  elementDepth: number
  documentSegments: DocumentSegments
  onError: (error: unknown) => void
  parentHandle?: SsrComponentHandle
  frameSrc: string
  topFrameSrc: string
  frameState?: SsrFrameState
  styleCache?: Map<string, { selector: string; css: string }>
  resolveFrame: (
    src: string,
    target?: string,
    context?: ResolveFrameContext,
  ) => Promise<string | ReadableStream<Uint8Array>> | string | ReadableStream<Uint8Array>
  pendingFrames?: Array<{ frameId: string; promise: Promise<ResolvedFrameHtml> }>
  blockingFrames?: Promise<void>[]
  hydrationData?: Map<string, HydrationData>
  unresolvedHydrationData?: Map<string, UnresolvedHydrationData>
  authoredImportMapImports?: AuthoredImportMapEntries
  authoredImportMapScopes?: Map<string, AuthoredImportMapScope>
  authoredImportMapIntegrity?: Map<string, string>
  managedImportMaps?: ManagedImportMap[]
  frameData?: Map<string, FrameData>
  clientEntryHeadResources?: ClientEntryHeadResources
  blockingFrameTails?: ReadableStream<Uint8Array>[]
  signal: AbortSignal
  flushKind: FlushKind
  serverIdScope?: string
  serverIdCounter: number
  nonce?: string
}

interface ResolvedFrameHtml {
  html: string
  tail?: ReadableStream<Uint8Array>
}

interface SsrFrameState {
  frame: FrameHandle
  topFrame: FrameHandle
  frames: Handle['frames']
}

type FrameSegment = { kind: 'frame'; frameId: string; content: SsrBuffer | string | null }
type Segment = string | StaticSegment | FrameSegment

interface SsrBuffer {
  html: string
  segments: Segment[] | null
}

let sharedTextEncoder: TextEncoder | undefined
function getTextEncoder(): TextEncoder {
  return (sharedTextEncoder ??= new TextEncoder())
}

function getFrameState(context: RenderContext): SsrFrameState {
  return (context.frameState ??= createSsrFrameState(context.frameSrc, context.topFrameSrc))
}

const MAX_BUFFERED_HTML_LENGTH = 64 * 1024
// UTF-8 needs at most three bytes per UTF-16 code unit.
let htmlEncodingBuffer: Uint8Array | undefined

interface HtmlAttrMeta {
  skip: boolean
  name: string
  isUrl: boolean
  isBoolish: boolean
}

const htmlAttrMetaCache = new Map<string, HtmlAttrMeta>()
const MAX_ATTR_META_CACHE = 512

function getHtmlAttrMeta(key: string): HtmlAttrMeta {
  let cached = htmlAttrMetaCache.get(key)
  if (cached !== undefined) return cached

  let omitted = SSR_OMITTED_PROPS.has(key)
  let allowed = !omitted && isAllowedHostPropName(key)
  let skip = !allowed
  let name = skip ? '' : normalizeAttributeName(key, false)
  let meta: HtmlAttrMeta = {
    skip,
    name,
    isUrl: !skip && EXEC_URL_ATTR.has(name),
    isBoolish: !skip && shouldStringifyBooleanAttribute(name),
  }
  // Only cache valid or omitted host prop names so arbitrary invalid keys cannot evict hot entries.
  if (allowed || omitted) {
    if (htmlAttrMetaCache.size >= MAX_ATTR_META_CACHE) {
      let oldest = htmlAttrMetaCache.keys().next()
      if (!oldest.done) htmlAttrMetaCache.delete(oldest.value)
    }
    htmlAttrMetaCache.set(key, meta)
  }
  return meta
}

function fastSanitizeUrl(tag: string, attrName: string, isUrl: boolean, value: unknown): unknown {
  if (
    !isUrl &&
    !(
      attrName.length === 4 &&
      (attrName === 'data' || attrName.toLowerCase() === 'data') &&
      tag.length === 6 &&
      (tag === 'object' || tag.toLowerCase() === 'object')
    )
  ) {
    return value
  }
  let str = String(value)
  if (str.length === 0) return str
  let code = str.charCodeAt(0)
  // Leading non-whitespace ASCII other than 'j'/'J' cannot start with "javascript:".
  if (code > 32 && code !== 106 && code !== 74) return str
  return sanitizeUrlAttribute(tag, attrName, str)
}

function pushSegment(buf: SsrBuffer, seg: StaticSegment | FrameSegment): void {
  if (!buf.segments) buf.segments = []
  if (buf.html.length > 0) {
    buf.segments.push(buf.html)
    buf.html = ''
  }
  buf.segments.push(seg)
}

function getStyleCache(context: RenderContext): Map<string, { selector: string; css: string }> {
  return (context.styleCache ??= new Map())
}

function getClientEntryHeadResources(context: RenderContext): ClientEntryHeadResources {
  return (context.clientEntryHeadResources ??= { modulePreloadTags: new Set() })
}

const TEXTAREA_VALUE_PROPS = new Set(['value', 'defaultValue'])
const INPUT_DEFAULT_PROPS = new Set(['defaultValue', 'defaultChecked'])
const SELECT_VALUE_PROPS = new Set(['value', 'defaultValue'])

const DOCTYPE_PATTERN = /<!doctype(?:\s[^>]*)?>/gi
function stripDoctypeMarkup(html: string): string {
  return html.replace(DOCTYPE_PATTERN, '')
}

function hasRenderableHtml(html: string): boolean {
  return stripDoctypeMarkup(html).trim() !== ''
}

function emptyReadableStream(): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.close()
    },
  })
}

function getStyleLayerName(selector: string, layer: string = REMIX_UI_STYLE_LAYER): string {
  return `${layer}.${selector}`
}

const SSR_OMITTED_PROPS = new Set(['children', 'mix', 'key', 'animate', 'innerHTML', 'on'])

// 1 = self-closing (void) tags, 0 = non-void tags needing special SSR handling.
const SPECIAL_TAGS: Record<string, number> = Object.assign(Object.create(null), {
  area: 1,
  base: 1,
  br: 1,
  col: 1,
  embed: 1,
  hr: 1,
  img: 1,
  input: 1,
  link: 1,
  meta: 1,
  param: 1,
  source: 1,
  track: 1,
  wbr: 1,
  html: 0,
  head: 0,
  body: 0,
  svg: 0,
  foreignObject: 0,
  textarea: 0,
  option: 0,
  select: 0,
  script: 0,
})

const ssrSignal = Object.freeze({
  get aborted() {
    return false
  },
  get reason() {
    return undefined
  },
  get onabort() {
    return null
  },
  set onabort(_: AbortSignal['onabort']) {},
  addEventListener(
    _type: string,
    _listener: EventListenerOrEventListenerObject | null,
    _options?: AddEventListenerOptions | boolean,
  ) {},
  removeEventListener(
    _type: string,
    _listener: EventListenerOrEventListenerObject | null,
    _options?: EventListenerOptions | boolean,
  ) {},
  dispatchEvent(_event: Event) {
    return true
  },
  throwIfAborted() {},
}) as AbortSignal

function createRenderContext(
  frameSrc: string,
  topFrameSrc: string,
  resolveFrame: RenderContext['resolveFrame'],
  nonce: string | undefined,
  signal: AbortSignal,
  onError: (error: unknown) => void,
): RenderContext {
  return {
    insideSvg: false,
    insideHead: false,
    elementDepth: 0,
    documentSegments: {},
    onError,
    frameSrc,
    topFrameSrc,
    resolveFrame,
    signal,
    flushKind: 'fragment',
    serverIdCounter: 0,
    nonce,
  }
}

/**
 * Renders a node tree to a streaming HTML response body.
 *
 * @param node Node tree to render.
 * @param options Stream rendering options.
 * @returns A readable byte stream of HTML.
 */
export function renderToStream(
  node: RemixNode,
  options?: RenderToStreamOptions,
): ReadableStream<Uint8Array> {
  let onError = options?.onError ?? ((error) => console.error(error))
  let currentFrameSrc = normalizeFrameSrc(options?.frameSrc ?? options?.topFrameSrc)
  let topFrameSrc = normalizeFrameSrc(options?.topFrameSrc ?? currentFrameSrc)
  let renderAbortController: AbortController | undefined
  let signal = options?.signal
  let cancelled = false
  let cancelReason: unknown

  let context = createRenderContext(
    currentFrameSrc,
    topFrameSrc,
    options?.resolveFrame ?? defaultResolveFrame,
    options?.nonce,
    signal ? (renderAbortController = new AbortController()).signal : ssrSignal,
    onError,
  )

  function cancel(reason: unknown): void {
    cancelled = true
    cancelReason = reason
    signal?.removeEventListener('abort', onAbort)
    if (!renderAbortController) {
      renderAbortController = new AbortController()
      context.signal = renderAbortController.signal
    }
    if (!renderAbortController.signal.aborted) {
      renderAbortController.abort(reason)
    }
  }

  function onAbort(): void {
    cancel(signal?.reason)
  }
  if (signal?.aborted) {
    cancel(signal.reason)
  } else if (signal) {
    signal.addEventListener('abort', onAbort, { once: true })
  }

  return new ReadableStream({
    async start(controller) {
      try {
        if (cancelled) {
          closeStream(controller)
          return
        }
        let root: SsrBuffer = { html: '', segments: null }
        buildSegment(node, context, root)
        // Await in document order so the first rejecting frame determines the error.
        if (context.blockingFrames) {
          for (let frame of context.blockingFrames) await frame
          if (closeIfCancelled(controller, context)) return
        }
        if (context.unresolvedHydrationData && context.unresolvedHydrationData.size > 0) {
          await resolveClientEntries(context, options?.resolveClientEntry)
          if (closeIfCancelled(controller, context)) return
          validateClientEntriesForHydration(context)
        }
        if (context.managedImportMaps && context.managedImportMaps.length > 0) {
          finalizeManagedImportMap(context)
        }
        let finalHtml = finalizeHtml(root, context)
        let bytes = encodeHtml(appendFlushMarker(finalHtml, context.flushKind))
        if (closeIfCancelled(controller, context)) return
        controller.enqueue(bytes)

        let blockingTails = context.blockingFrameTails
        let hasPending = context.pendingFrames !== undefined && context.pendingFrames.length > 0
        if (blockingTails !== undefined && blockingTails.length > 0) {
          let tails = streamByteStreams(blockingTails, controller, context)
          if (hasPending) {
            await Promise.all([tails, streamPendingFrames(context, controller)])
          } else {
            await tails
          }
        } else if (hasPending) {
          await streamPendingFrames(context, controller)
        }

        if (closeIfCancelled(controller, context)) return
        controller.close()
      } catch (error) {
        if (isSignalAbortError(context.signal, error) || (cancelled && error === cancelReason)) {
          closeStream(controller)
          return
        }
        onError(error)
        controller.error(error)
      } finally {
        signal?.removeEventListener('abort', onAbort)
      }
    },
    cancel(reason) {
      cancel(reason)
    },
  })
}

function encodeHtml(html: string): Uint8Array {
  let encoder = getTextEncoder()
  if (html.length > MAX_BUFFERED_HTML_LENGTH) return encoder.encode(html)

  // Encoding is synchronous. Copy the written bytes so streams never share the scratch buffer.
  let scratch = (htmlEncodingBuffer ??= new Uint8Array(MAX_BUFFERED_HTML_LENGTH * 3))
  let { written } = encoder.encodeInto(html, scratch)
  return scratch.slice(0, written)
}

function isSignalAbortError(signal: AbortSignal, error: unknown): boolean {
  return signal.aborted && error === signal.reason
}

function closeIfCancelled(
  controller: ReadableStreamDefaultController,
  context: RenderContext,
): boolean {
  if (!context.signal.aborted) return false
  closeStream(controller)
  return true
}

function closeStream(controller: ReadableStreamDefaultController): void {
  try {
    controller.close()
  } catch {
    // The consumer may already have cancelled the stream.
  }
}

function defaultResolveFrame(): never {
  throw new Error('No resolveFrame provided')
}

function normalizeFrameSrc(value?: string | URL): string {
  return value == null ? '' : String(value)
}

function createSsrFrameState(frameSrc: string, topFrameSrc = frameSrc): SsrFrameState {
  let topFrame = createFrameHandle({ src: topFrameSrc })
  let frame = frameSrc === topFrameSrc ? topFrame : createFrameHandle({ src: frameSrc })
  let frames: Handle['frames'] = {
    top: topFrame,
    get: () => undefined,
  }
  return { frame, topFrame, frames }
}

function getResolveFrameContext(frameState: SsrFrameState, nonce?: string): ResolveFrameContext {
  return {
    currentFrameSrc: frameState.frame.src,
    topFrameSrc: frameState.topFrame.src,
    nonce,
  }
}

function randomId(prefix: string): string {
  return prefix + crypto.randomUUID().slice(0, 8)
}

function createServerComponentId(context: RenderContext): string {
  context.serverIdCounter++
  let scope = (context.serverIdScope ??= crypto.randomUUID().slice(0, 8))
  return `s${scope}-${context.serverIdCounter}`
}

async function splitFirstChunk(stream: ReadableStream<Uint8Array>): Promise<ResolvedFrameHtml> {
  let reader = stream.getReader()
  let decoder = new TextDecoder()

  // Decode every chunk up to and including the first renderable one exactly once. The bytes of a
  // character cut off at the end of that chunk belong to the tail, which is forwarded as raw bytes.
  let html = ''
  let pendingBytes: Uint8Array = new Uint8Array(0)
  let found = false
  while (true) {
    let { value, done } = await reader.read()
    if (done || !value) break

    html += decoder.decode(value, { stream: true })
    let bytes = new Uint8Array(pendingBytes.length + value.length)
    bytes.set(pendingBytes)
    bytes.set(value, pendingBytes.length)
    pendingBytes = getIncompleteUtf8Suffix(bytes)

    if (hasRenderableHtml(html)) {
      found = true
      break
    }
  }

  if (!found) {
    reader.releaseLock()
    return { html: '', tail: emptyReadableStream() }
  }

  let released = false
  function release() {
    if (released) return
    released = true
    try {
      reader.releaseLock()
    } catch {
      // ignore
    }
  }

  let tail = new ReadableStream<Uint8Array>({
    start(controller) {
      if (pendingBytes.length > 0) controller.enqueue(pendingBytes)
    },
    async pull(controller) {
      let next = await reader.read()
      if (next.done) {
        controller.close()
        release()
        return
      }
      controller.enqueue(next.value)
    },
    cancel(reason) {
      release()
      return reader.cancel(reason)
    },
  })

  return { html: stripFlushMarkers(stripDoctypeMarkup(html)), tail }
}

function getIncompleteUtf8Suffix(bytes: Uint8Array): Uint8Array {
  for (let index = bytes.length - 1; index >= Math.max(0, bytes.length - 3); index--) {
    let byte = bytes[index]
    if ((byte & 0xc0) === 0x80) continue
    let length = byte >= 0xf0 ? 4 : byte >= 0xe0 ? 3 : byte >= 0xc0 ? 2 : 1
    return bytes.length - index < length ? bytes.slice(index) : new Uint8Array(0)
  }
  return new Uint8Array(0)
}

async function resolveFrameHtml(
  input: string | ReadableStream<Uint8Array>,
): Promise<ResolvedFrameHtml> {
  if (typeof input === 'string') {
    let html = stripFlushMarkers(stripDoctypeMarkup(input))
    return { html }
  }

  return splitFirstChunk(input)
}

function buildSegment(node: RemixNode, context: RenderContext, output: SsrBuffer): void {
  if (typeof node === 'string') {
    if (context.optionText !== undefined) context.optionText += node
    output.html += escapeTextContent(node)
    return
  }

  if (typeof node === 'number' || typeof node === 'bigint') {
    if (context.optionText !== undefined) context.optionText += String(node)
    output.html += node
    return
  }

  if (node === null || node === undefined || typeof node === 'boolean') {
    return
  }

  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      buildSegment(node[i], context, output)
    }
    return
  }

  if (isRemixElement(node)) {
    let type = node.type
    let props = node.props

    if (typeof type === 'string') {
      if (type === 'html') {
        context.flushKind = 'document'
      }

      if (type === 'head') {
        buildHeadElementSegment(type, props, context, output)
      } else {
        buildElementSegment(type, props, context, output)
      }
      return
    }

    if (type === Fragment) {
      let children = props.children
      if (children != null) buildSegment(children, context, output)
      return
    }

    if (isElementFunction(type)) {
      if (type === ImportMap) {
        pushSegment(output, buildImportMapSegment(props, context))
      } else if (isFrameComponent(type)) {
        pushSegment(output, buildFrameSegment(node, context))
      } else if (isEntry(type)) {
        buildEntrySegment(type, props, context, output)
      } else {
        buildComponentSegment(type, props, context, undefined, output)
      }
    }
  }
}

function buildFrameSegment(node: RemixElement, context: RenderContext): FrameSegment {
  let props = node.props
  let frameId = randomId('f')

  // Store frame data in context for aggregation
  ;(context.frameData ??= new Map()).set(frameId, {
    status: props.loading === 'lazy' ? 'lazy' : props.fallback ? 'pending' : 'resolved',
    fallback: props.loading === 'lazy' ? !!props.fallback : undefined,
    name: props.name,
    src: props.src,
  })

  let seg: FrameSegment = {
    kind: 'frame',
    frameId,
    content: null,
  }

  if (props.loading === 'lazy') {
    let fallbackBuf: SsrBuffer = { html: '', segments: null }
    buildSegment(props.fallback, context, fallbackBuf)
    seg.content = fallbackBuf
    return seg
  }

  let resolveFrameContext = getResolveFrameContext(getFrameState(context), context.nonce)
  let nonBlocking = !!props.fallback
  if (nonBlocking) {
    let fallbackBuf: SsrBuffer = { html: '', segments: null }
    buildSegment(props.fallback, context, fallbackBuf)
    seg.content = fallbackBuf
    let framePromise = Promise.resolve(
      context.resolveFrame(props.src, props.name, resolveFrameContext),
    ).then(async (resolved) => resolveFrameHtml(resolved))
    // The response stream can be cancelled before pending frames are drained.
    // Keep the promise observed so request aborts don't become unhandled.
    framePromise.catch(() => {})
    ;(context.pendingFrames ??= []).push({ frameId, promise: framePromise })
  } else {
    let framePromise = Promise.resolve(
      context.resolveFrame(props.src, props.name, resolveFrameContext),
    ).then(async (resolved) => {
      let { html, tail } = await resolveFrameHtml(resolved)
      html = hoistClientEntryResourcesFromFrameHead(html, getClientEntryHeadResources(context))
      seg.content = html
      if (tail) {
        ;(context.blockingFrameTails ??= []).push(tail)
      }
    })
    // An earlier blocking frame may reject before this promise is awaited.
    framePromise.catch(() => {})
    ;(context.blockingFrames ??= []).push(framePromise)
  }

  return seg
}

function assertSelectInnerHtmlAllowed(
  tag: string,
  props: ElementProps,
  context: RenderContext,
): void {
  if (tag === 'select' || tag === 'optgroup') {
    invariant(
      tag === 'select'
        ? props.value == null && props.defaultValue == null
        : context.selectValues === undefined,
      'select value and defaultValue require options rendered as JSX children, not through select or optgroup innerHTML',
    )
  }
}

function buildElementSegment(
  tag: string,
  props: any,
  context: RenderContext,
  output: SsrBuffer,
): void {
  let tagFlags = SPECIAL_TAGS[tag]
  let currentIsSvg = context.insideSvg

  // Fast path: ordinary non-SVG HTML element with no special tag behavior.
  if (tagFlags === undefined && !currentIsSvg) {
    let resolved = normalizeUnsafeHTMLProps(props)
    let innerHTML = resolved.innerHTML
    let finalProps =
      resolved.mix !== undefined ? resolveSsrMixedProps(tag, resolved, context) : resolved

    output.html += '<' + tag
    appendAttributes(tag, finalProps, false, undefined, output)
    output.html += '>'

    if (innerHTML !== undefined) {
      assertSelectInnerHtmlAllowed(tag, finalProps, context)
      output.html += innerHTML + '</' + tag + '>'
      return
    }

    let children = props.children
    if (children != null) {
      let trackDepth = context.documentSegments.depth !== undefined
      if (trackDepth) context.elementDepth++
      buildSegment(children, context, output)
      if (trackDepth) context.elementDepth--
    }
    output.html += '</' + tag + '>'
    return
  }

  let normalizedProps = normalizeUnsafeHTMLProps(props)
  let innerHTML = normalizedProps.innerHTML
  let mixedProps =
    normalizedProps.mix !== undefined
      ? resolveSsrMixedProps(tag, normalizedProps, context)
      : normalizedProps
  // Determine namespace context for the current element and its children
  currentIsSvg = currentIsSvg || tag === 'svg'

  if (!currentIsSvg && tag === 'textarea') {
    output.html += buildTextareaElementSegment(tag, mixedProps)
    return
  }

  if (!currentIsSvg && tag === 'option' && context.selectValues !== undefined) {
    buildSelectedOptionSegment(mixedProps, context, output)
    return
  }

  let attrs =
    !currentIsSvg && tag === 'input'
      ? renderInputAttributes(mixedProps)
      : renderAttributes(
          tag,
          mixedProps,
          currentIsSvg,
          !currentIsSvg && tag === 'select' ? SELECT_VALUE_PROPS : undefined,
        )

  if (tagFlags === 1) {
    output.html += `<${tag}${attrs} />`
    return
  }

  let documentElement =
    !currentIsSvg && (tag === 'html' || tag === 'body')
      ? createDocumentElementSegments(tag, attrs, context)
      : undefined

  if (innerHTML !== undefined) {
    if (!currentIsSvg) assertSelectInnerHtmlAllowed(tag, mixedProps, context)
    if (documentElement) {
      pushSegment(output, documentElement.open)
      output.html += innerHTML
      pushSegment(output, documentElement.close)
    } else {
      output.html += `<${tag}${attrs}>${innerHTML}</${tag}>`
    }
    return
  }

  if (tag === 'script') {
    if (typeof props.children === 'string') {
      if (context.insideHead) {
        collectAuthoredImportMap(context, tag, mixedProps, props.children)
      }
      output.html += `<${tag}${attrs}>${escapeScriptTextContent(props.children)}</${tag}>`
      return
    }
    if (props.children != null) {
      console.error(new Error('script elements with children must have a single string child'))
    }
    output.html += `<${tag}${attrs}></${tag}>`
    return
  }

  if (documentElement) {
    pushSegment(output, documentElement.open)
  } else {
    output.html += `<${tag}${attrs}>`
  }

  let children = props.children
  if (children != null) {
    // Adjust svg context for children: foreignObject switches back to HTML
    let previousInsideSvg = context.insideSvg
    context.insideSvg = tag === 'foreignObject' ? false : currentIsSvg
    let previousSelectValues = context.selectValues
    let previousSelectScalar = context.selectScalar
    if (!currentIsSvg && tag === 'select') {
      let value = mixedProps.value ?? mixedProps.defaultValue
      context.selectValues = getSelectValues(value)
      context.selectScalar =
        (mixedProps.multiple !== '' && !mixedProps.multiple) ||
        (mixedProps.value != null && !Array.isArray(value))
    }
    context.elementDepth++
    buildSegment(children, context, output)
    context.elementDepth--
    context.selectValues = previousSelectValues
    context.selectScalar = previousSelectScalar
    context.insideSvg = previousInsideSvg
  }

  if (documentElement) {
    pushSegment(output, documentElement.close)
  } else {
    output.html += `</${tag}>`
  }
}

function buildSelectedOptionSegment(
  props: ElementProps,
  context: RenderContext,
  output: SsrBuffer,
): void {
  invariant(
    props.innerHTML === undefined || props.value != null,
    'option elements with innerHTML must have an explicit value when their select has a value or defaultValue',
  )
  let previousOptionText = context.optionText
  context.optionText = ''
  context.elementDepth++
  let childBuf: SsrBuffer = { html: '', segments: null }
  if (props.innerHTML === undefined) {
    buildSegment(props.children, context, childBuf)
  } else {
    childBuf.html = props.innerHTML
  }
  context.elementDepth--
  // Native options without a value use their text with ASCII whitespace collapsed.
  let value = props.value ?? context.optionText.replace(/[\t\n\f\r ]+/g, ' ').replace(/^ | $/g, '')
  context.optionText = previousOptionText
  let selected = context.selectValues?.has(String(value))
  if (selected && context.selectScalar) context.selectValues?.clear()
  let attrs = renderAttributes('option', { ...props, selected }, false)
  output.html += `<option${attrs}>`
  if (childBuf.segments) {
    for (let seg of childBuf.segments) {
      if (typeof seg === 'string') output.html += seg
      else pushSegment(output, seg)
    }
  }
  output.html += `${childBuf.html}</option>`
}

function buildTextareaElementSegment(tag: string, props: any): string {
  let attrs = renderAttributes(tag, props, false, TEXTAREA_VALUE_PROPS)
  let value = props.value ?? props.defaultValue ?? ''
  return `<${tag}${attrs}>${escapeTextContent(String(value))}</${tag}>`
}

function collectAuthoredImportMap(
  context: RenderContext,
  tag: string,
  props: Record<string, unknown>,
  children: unknown,
): void {
  if (
    tag !== 'script' ||
    typeof props.type !== 'string' ||
    props.type.toLowerCase() !== 'importmap' ||
    (props.src !== undefined && props.src !== null && props.src !== false) ||
    typeof children !== 'string'
  ) {
    return
  }

  let importMap = parseAuthoredImportMap(children)
  if (!importMap) return

  if (importMap.imports) {
    collectAuthoredImportMapEntries(
      (context.authoredImportMapImports ??= new Map()),
      importMap.imports,
    )
  }
  if (importMap.scopes) {
    let scopes = (context.authoredImportMapScopes ??= new Map())
    for (let [scope, imports] of Object.entries(importMap.scopes)) {
      let authoredScope = scopes.get(scope)
      if (!authoredScope) {
        authoredScope = { imports: new Map() }
        scopes.set(scope, authoredScope)
      }
      collectAuthoredImportMapEntries(authoredScope.imports, imports)
    }
  }
  if (importMap.integrity) {
    let integrity = (context.authoredImportMapIntegrity ??= new Map())
    for (let [url, hash] of Object.entries(importMap.integrity)) {
      if (!integrity.has(url)) {
        integrity.set(url, hash)
      }
    }
  }
}

function collectAuthoredImportMapEntries(
  target: AuthoredImportMapEntries,
  source: ImportMapImports,
): void {
  for (let [specifier, address] of Object.entries(source)) {
    if (!target.has(specifier)) target.set(specifier, address)
  }
}

function buildImportMapSegment(props: ElementProps, context: RenderContext): StaticSegment {
  if (context.flushKind !== 'document' || !context.insideHead) {
    throw new Error('ImportMap must be rendered inside a document head')
  }
  if (context.managedImportMaps && context.managedImportMaps.length > 0) {
    throw new Error('Only one ImportMap can be rendered per document')
  }
  let value = props.value
  if (!isImportMap(value)) {
    throw new TypeError('ImportMap value must be a valid import map')
  }

  let { value: _value, ...scriptProps } = props
  if (scriptProps.nonce === undefined && context.nonce !== undefined) {
    scriptProps.nonce = context.nonce
  }
  let attrs = renderAttributes('script', scriptProps, false)
  let segment: StaticSegment = { kind: 'static', html: '' }
  ;(context.managedImportMaps ??= []).push({ attrs, segment, value })
  return segment
}

function renderInputAttributes(props: any): string {
  let value =
    props.value === undefined && props.defaultValue !== undefined ? props.defaultValue : props.value
  let checked =
    props.checked === undefined && props.defaultChecked !== undefined
      ? props.defaultChecked
      : props.checked
  if (value === props.value && checked === props.checked) {
    return renderAttributes('input', props, false, INPUT_DEFAULT_PROPS)
  }
  let inputProps = {
    ...props,
    ...(value === undefined ? {} : { value }),
    ...(checked === undefined ? {} : { checked }),
  }
  return renderAttributes('input', inputProps, false, INPUT_DEFAULT_PROPS)
}

function buildHeadElementSegment(
  tag: string,
  props: any,
  context: RenderContext,
  output: SsrBuffer,
): void {
  let attrs = renderAttributes(tag, props, false)
  let head = createDocumentElementSegments('head', attrs, context)

  pushSegment(output, head.open)
  let previousInsideHead = context.insideHead
  context.insideHead = true
  context.elementDepth++
  if (props.children != null) buildSegment(props.children, context, output)
  context.elementDepth--
  context.insideHead = previousInsideHead
  pushSegment(output, head.close)
}

function createDocumentElementSegments(
  tag: 'html' | 'head' | 'body',
  attrs: string,
  context: RenderContext,
): DocumentElementSegments {
  let segments: DocumentElementSegments = {
    open: { kind: 'static', html: `<${tag}${attrs}>` },
    close: { kind: 'static', html: `</${tag}>` },
  }
  let document = context.documentSegments
  if (tag === 'html') {
    if (!document.html) {
      document.html = segments
      document.depth = context.elementDepth
    }
  } else if (document.depth !== undefined && context.elementDepth === document.depth + 1) {
    document[tag] ??= segments
  }
  return segments
}

function appendAttributes(
  tag: string,
  props: any,
  isSvg: boolean,
  excludedProps: Set<string> | undefined,
  output: SsrBuffer,
): void {
  let emittedClass = false
  let html = output.html

  for (let key in props) {
    if (!Object.hasOwn(props, key)) continue
    if (key === 'children' || key === 'mix' || key === 'key') continue

    let value = props[key]
    if (value === undefined || value === null) continue

    if (key === 'class' || key === 'className') {
      if (emittedClass) continue
      emittedClass = true
      let otherKey = key === 'class' ? 'className' : 'class'
      let otherVal = Object.hasOwn(props, otherKey) ? props[otherKey] : undefined
      let merged: unknown
      if (otherVal === undefined || otherVal === null) {
        merged = value
      } else {
        let classAttr = key === 'class' ? value : otherVal
        let className = key === 'class' ? otherVal : value
        merged =
          typeof classAttr === 'string' && typeof className === 'string' && classAttr && className
            ? `${classAttr} ${className}`
            : typeof classAttr === 'string' && classAttr
              ? classAttr
              : typeof className === 'string' && className
                ? className
                : (classAttr ?? className)
      }
      if (typeof merged === 'string') {
        html += ` class="${escapeHtml(merged)}"`
      } else if (typeof merged === 'boolean') {
        if (merged) html += ' class'
      } else if (merged != null) {
        html += ` class="${escapeHtml(String(merged))}"`
      }
      continue
    }

    if (key === 'style') {
      if (typeof value === 'object') {
        html += ` style="${escapeHtml(serializeStyleObject(value))}"`
      } else if (typeof value === 'boolean') {
        if (value) html += ' style'
      } else {
        html += ` style="${escapeHtml(String(value))}"`
      }
      continue
    }

    if (excludedProps !== undefined && excludedProps.has(key)) continue

    let attrName: string
    let isUrl: boolean
    let isBoolish: boolean
    if (!isSvg) {
      let meta = getHtmlAttrMeta(key)
      if (meta.skip) continue
      attrName = meta.name
      isUrl = meta.isUrl
      isBoolish = meta.isBoolish
    } else {
      if (SSR_OMITTED_PROPS.has(key) || !isAllowedHostPropName(key)) continue
      attrName = normalizeAttributeName(key, true)
      isUrl = EXEC_URL_ATTR.has(attrName.toLowerCase())
      isBoolish = shouldStringifyBooleanAttribute(attrName)
    }

    if (typeof value === 'boolean') {
      if (isBoolish) {
        html += ` ${attrName}="${value}"`
      } else if (value) {
        html += ` ${attrName}`
      }
    } else {
      let safeValue = fastSanitizeUrl(tag, attrName, isUrl, value)
      html += ` ${attrName}="${escapeHtml(typeof safeValue === 'string' ? safeValue : String(safeValue))}"`
    }
  }

  output.html = html
}

function renderAttributes(
  tag: string,
  props: any,
  isSvg: boolean,
  excludedProps?: Set<string>,
): string {
  let tmp: SsrBuffer = { html: '', segments: null }
  appendAttributes(tag, props, isSvg, excludedProps, tmp)
  return tmp.html
}

function isBrowserOnlyMixinDescriptor(value: unknown): boolean {
  let type = (
    value as { type?: ((...args: never[]) => unknown) & { __rmxMixinSsr?: boolean } } | null
  )?.type
  return typeof type === 'function' && type.__rmxMixinSsr === false
}

function resolveSsrMixedProps(
  hostType: string,
  initialProps: ElementProps,
  context: RenderContext,
): ElementProps {
  let mix = initialProps.mix
  if (!mix) return initialProps
  if (Array.isArray(mix)) {
    let hasServerMixin = false
    for (let i = 0; i < mix.length; i++) {
      let descriptor = mix[i]
      if (descriptor && !isBrowserOnlyMixinDescriptor(descriptor)) {
        hasServerMixin = true
        break
      }
    }
    if (!hasServerMixin) return initialProps
  } else if (isBrowserOnlyMixinDescriptor(mix)) {
    return initialProps
  }

  return composeMixedProps(hostType, initialProps, (descriptor, _index, mixinProps) => {
    if (isBrowserOnlyMixinDescriptor(descriptor)) return undefined
    let runner = resolveSsrMixinRunner(hostType, descriptor, context)
    if (!runner) return undefined
    // Unlike the client runtime, a throwing mixin is isolated here so a
    // single bad mixin cannot take down the whole stream.
    try {
      return runner(...descriptor.args, mixinProps)
    } catch (error) {
      console.error(error)
      return undefined
    }
  })
}

function resolveSsrMixinRunner(
  hostType: string,
  descriptor: { type?: unknown; args?: readonly unknown[] },
  context: RenderContext,
): ((...args: unknown[]) => unknown) | null {
  if (typeof descriptor.type !== 'function') return null
  try {
    let handle = createSsrMixinHandle(hostType, descriptor, context)
    let runner = descriptor.type(handle, hostType)
    if (typeof runner !== 'function') return null
    return runner
  } catch (error) {
    console.error(error)
    return null
  }
}

function createSsrMixinHandle(
  hostType: string,
  _descriptor: { type?: unknown },
  context: RenderContext,
) {
  // Context lookups read the shared render context, so capture the parent before it moves on.
  let parentHandle = context.parentHandle
  let element = ((handle: { props: ElementProps; update(): Promise<AbortSignal> }) => () =>
    jsx(hostType, handle.props, null)) as ((handle: {
    props: ElementProps
    update(): Promise<AbortSignal>
  }) => () => RemixElement) & {
    __rmxMixinElementType: string
  }
  element.__rmxMixinElementType = hostType

  return {
    id: 'ssr-mixin',
    context: {
      get(providerType: ElementType | symbol) {
        if (typeof providerType !== 'function') {
          return undefined
        }
        return parentHandle?.lookupContext(providerType)
      },
    },
    frame: createFrameHandle({
      src: context.frameState ? context.frameState.frame.src : context.frameSrc,
      $runtime: {
        styleCache: getStyleCache(context),
      },
    }),
    element,
    signal: ssrSignal,
    update: () => {
      throw new Error('handle.update() is not available during SSR.')
    },
    queueTask: () => {},
    on: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  }
}

class SsrComponentHandle implements Handle<ElementProps, unknown> {
  props: ElementProps
  #type: ElementFunction
  #parent: SsrComponentHandle | undefined
  #contextValue: unknown = undefined
  #renderContext: RenderContext
  #id: string | undefined
  #phase: 'setup' | 'render' | 'idle' = 'setup'
  #context: Handle<ElementProps, unknown>['context'] | undefined
  #update: (() => Promise<AbortSignal>) | undefined

  constructor(
    type: ElementFunction,
    props: ElementProps,
    renderContext: RenderContext,
    explicitId: string | undefined,
  ) {
    this.#type = type
    this.props = props
    this.#parent = renderContext.parentHandle
    this.#renderContext = renderContext
    this.#id = explicitId
  }

  get id(): string {
    return (this.#id ??= createServerComponentId(this.#renderContext))
  }

  get frame(): FrameHandle {
    return getFrameState(this.#renderContext).frame
  }

  get frames(): Handle['frames'] {
    return getFrameState(this.#renderContext).frames
  }

  get signal(): AbortSignal {
    return ssrSignal
  }

  get context(): Handle<ElementProps, unknown>['context'] {
    return (this.#context ??= {
      set: (value: unknown) => {
        this.#contextValue = value
      },
      get: ((providerType: ElementType | symbol) =>
        typeof providerType === 'function'
          ? this.#parent?.lookupContext(providerType)
          : undefined) as Handle<ElementProps, unknown>['context']['get'],
    })
  }

  get update(): () => Promise<AbortSignal> {
    return (this.#update ??= () => {
      let name = this.#type.name || 'Anonymous'
      if (this.#phase === 'setup') {
        console.warn(
          `Ignored handle.update() while ${name} is running its setup function. The initial render includes setup changes.`,
        )
        // Never resolves on the server so post-commit `.then()` callbacks do not run during SSR.
        return new Promise<AbortSignal>(() => {})
      }
      let when =
        this.#phase !== 'idle'
          ? `while ${name} is running its ${this.#phase} function`
          : `before ${name}'s initial render commits`
      throw new Error(
        `Cannot call handle.update() ${when}. Call it from an event handler or handle.queueTask() instead.`,
      )
    })
  }

  lookupContext(providerType: Function): unknown {
    let current: SsrComponentHandle | undefined = this
    while (current !== undefined) {
      if (current.#type === providerType) {
        return current.#contextValue
      }
      current = current.#parent
    }
    return undefined
  }

  renderOnce(): RemixNode {
    let result = (this.#type as unknown as (h: SsrComponentHandle) => unknown)(this)
    if (typeof result !== 'function') {
      throw new Error(
        `${this.#type.name || 'Anonymous'} must return a render function, received ${typeof result}`,
      )
    }
    this.#phase = 'render'
    try {
      return (result as RenderFn)()
    } finally {
      this.#phase = 'idle'
    }
  }

  queueTask(): void {}
}

function isElementFunction(value: unknown): value is ElementFunction {
  return typeof value === 'function'
}

function isFrameComponent(type: unknown): boolean {
  return typeof type === 'function' && Object.hasOwn(type, FRAME_NODE)
}

function buildComponentSegment(
  type: ElementFunction,
  props: any,
  context: RenderContext,
  componentId: string | undefined,
  output: SsrBuffer,
): void {
  let handle = new SsrComponentHandle(type, props, context, componentId)
  let renderedNode = handle.renderOnce()
  let previousParent = context.parentHandle
  context.parentHandle = handle
  buildSegment(renderedNode, context, output)
  context.parentHandle = previousParent
}

const SERIALIZATION_TAGS = [
  '$rmx',
  '$rmxFrame',
  '$rmxFragment',
  '$rmxPortal',
  '$rmxMixin',
  ESCAPED_OBJECT,
]

function createHydrationPropsReplacer(context: RenderContext) {
  let escapedObjects = new WeakMap<object, { [ESCAPED_OBJECT]: Record<string, unknown> }>()
  let escapedContents = new WeakSet<object>()

  function unwrapElement(element: RemixElement): unknown {
    let type = element.type
    let props = element.props

    // Preserve placement when a portal is passed as JSX in client-entry props.
    if (type === Portal) {
      invariant(
        props.container === undefined,
        'Portals with custom containers cannot be serialized.',
      )
      return { $rmxPortal: true, props, key: serializeKey(element.key) }
    }

    // Preserve Frame semantics through serialized props by emitting
    // a dedicated descriptor that can be revived on the client.
    if (isFrameComponent(type)) {
      return {
        $rmxFrame: true,
        props,
        key: element.key,
      }
    }

    // Fragment renders null and relies on the reconciler to render its
    // children, so it can't go through the component branch below.
    if (type === Fragment) {
      return {
        $rmxFragment: true,
        props,
        key: serializeKey(element.key),
      }
    }

    // JSON visits the descriptor's props next, transforming each nested value once.
    if (typeof type === 'string') {
      return { $rmx: true, type, props, key: serializeKey(element.key) }
    }

    // Component function: render synchronously, then unwrap its result
    if (isElementFunction(type)) {
      let handle = new SsrComponentHandle(type, props, context, 'SERIALIZED')
      let renderedNode = handle.renderOnce()
      let previousParent = context.parentHandle
      context.parentHandle = handle
      try {
        return replacer('', renderedNode)
      } finally {
        context.parentHandle = previousParent
      }
    }

    return null
  }

  function replacer(_key: string, value: unknown): unknown {
    if (typeof value !== 'object' || value === null || escapedContents.has(value)) return value
    // Mixin descriptors hold their setup function, which JSON drops. `css()`
    // only holds style data, so it's revived in the browser by name.
    if (isMixinDescriptor(value)) {
      return value.type === cssMixinType
        ? { $rmxMixin: 'css', args: value.args }
        : { $rmxMixin: null }
    }
    if (isRemixElement(value)) {
      return unwrapElement(value)
    }
    if (!Array.isArray(value) && SERIALIZATION_TAGS.some((tag) => Object.hasOwn(value, tag))) {
      // Keep values in object properties so JSON still omits undefined, functions,
      // symbols, and values whose toJSON returns them. JSON already called toJSON
      // on this object, so don't copy that method into the wrapper's contents.
      let contents = Object.fromEntries(
        Object.entries(value).filter(
          ([key, item]) => key !== 'toJSON' || typeof item !== 'function',
        ),
      )
      let escaped = escapedObjects.get(value) ?? { [ESCAPED_OBJECT]: contents }
      escaped[ESCAPED_OBJECT] = contents
      // Reuse wrappers so circular input still triggers JSON's circular-reference error.
      escapedObjects.set(value, escaped)
      escapedContents.add(contents)
      return escaped
    }
    return value
  }

  return replacer
}

// Other key types don't survive JSON: bigints throw, and objects are revived
// with a new identity on every render, so keyed diffs would remount them.
function serializeKey(key: unknown): string | number | undefined {
  if (typeof key === 'string') return key
  if (typeof key === 'number' && Number.isFinite(key)) return key
  return undefined
}

function buildEntrySegment(
  type: EntryComponent,
  props: any,
  context: RenderContext,
  output: SsrBuffer,
): void {
  let instanceId = randomId('h')
  output.html += `<!--${createHydrationStartMarker(instanceId)}-->`
  // Copy props for the server handle so mutations during SSR cannot alter serialized entry props.
  buildComponentSegment(type, { ...props }, context, instanceId, output)

  // Store hydration data in context for aggregation
  let replacer = createHydrationPropsReplacer(context)
  let propsJson = JSON.stringify(props, replacer)
  if (propsJson === undefined) throw new TypeError('Client entry props must serialize to JSON')
  ;(context.unresolvedHydrationData ??= new Map()).set(instanceId, {
    entryId: type.$entryId,
    component: type,
    propsJson,
  })

  output.html += `<!--${HYDRATION_END_MARKER}-->`
}

function resolveDefaultClientEntry(
  entryId: string,
  component: EntryComponent,
): ResolvedClientEntry {
  let fallbackExportName = component.name || ''
  let hashIndex = entryId.lastIndexOf('#')
  if (hashIndex === -1 && fallbackExportName) {
    return {
      exportName: fallbackExportName,
      href: entryId,
    }
  }

  if (hashIndex !== -1) {
    let exportName = entryId.slice(hashIndex + 1) || fallbackExportName
    if (exportName) {
      return {
        exportName,
        href: entryId.slice(0, hashIndex),
      }
    }
  }

  throw new Error(
    `clientEntry() requires either an export name in the entry ID (e.g., "/js/module.js#ComponentName"), a named component function, or a resolveClientEntry hook that resolves one. Received "${entryId}".`,
  )
}

async function resolveClientEntries(
  context: RenderContext,
  resolveClientEntry?: (
    entryId: string,
    component: EntryComponent,
  ) => Promise<ResolvedClientEntry> | ResolvedClientEntry,
): Promise<void> {
  if (!context.unresolvedHydrationData || context.unresolvedHydrationData.size === 0) return

  let resolvedEntries = new Map<EntryComponent, ResolvedClientEntry>()
  let hydrationData = (context.hydrationData ??= new Map())

  for (let [hydrationId, unresolvedHydrationData] of context.unresolvedHydrationData) {
    let { entryId, component, propsJson } = unresolvedHydrationData
    let resolvedEntry = resolvedEntries.get(component)
    if (!resolvedEntry) {
      resolvedEntry = resolveClientEntry
        ? await Promise.resolve(resolveClientEntry(entryId, component))
        : resolveDefaultClientEntry(entryId, component)
      validateResolvedClientEntry(entryId, resolvedEntry)
      resolvedEntries.set(component, resolvedEntry)
      collectResolvedClientEntryResources(getClientEntryHeadResources(context), resolvedEntry)
    }

    hydrationData.set(hydrationId, {
      exportName: resolvedEntry.exportName,
      moduleUrl: resolvedEntry.href,
      propsJson,
    })
  }

  context.unresolvedHydrationData.clear()
}

function collectResolvedClientEntryResources(
  resources: ClientEntryHeadResources,
  resolvedEntry: ResolvedClientEntry,
): void {
  for (let preload of resolvedEntry.preloads ?? []) {
    resources.modulePreloadTags.add(createModulePreloadTag(preload))
  }
  if (resolvedEntry.importMap) {
    mergeImportMap(resources, resolvedEntry.importMap)
  }
}

function validateResolvedClientEntry(
  entryId: string,
  resolvedEntry: ResolvedClientEntry,
): asserts resolvedEntry is ResolvedClientEntry {
  if (!resolvedEntry || typeof resolvedEntry !== 'object') {
    throw new Error(
      `resolveClientEntry must return an object with href and exportName. Received "${entryId}".`,
    )
  }

  if (!resolvedEntry.href) {
    throw new Error(`resolveClientEntry must return a non-empty href. Received "${entryId}".`)
  }

  if (!resolvedEntry.exportName) {
    throw new Error(`resolveClientEntry must return a non-empty exportName. Received "${entryId}".`)
  }

  if (resolvedEntry.preloads !== undefined) {
    if (!Array.isArray(resolvedEntry.preloads)) {
      throw new Error(`resolveClientEntry preloads must be an array. Received "${entryId}".`)
    }
    for (let preload of resolvedEntry.preloads) {
      if (typeof preload !== 'string' || preload.length === 0) {
        throw new Error(
          `resolveClientEntry preloads must contain non-empty strings. Received "${entryId}".`,
        )
      }
    }
  }

  if (resolvedEntry.importMap !== undefined && !isImportMap(resolvedEntry.importMap)) {
    throw new Error(
      `resolveClientEntry importMap must be a valid import map. Received "${entryId}".`,
    )
  }
}

function validateClientEntriesForHydration(context: RenderContext): void {
  if (context.unresolvedHydrationData && context.unresolvedHydrationData.size > 0) {
    let [hydrationId, unresolvedHydrationData] = context.unresolvedHydrationData.entries().next()
      .value as [string, UnresolvedHydrationData]
    throw new Error(
      `Client entry was not resolved for hydration. Received "${unresolvedHydrationData.entryId}" (${hydrationId}).`,
    )
  }
}

function serializeBuffer(buf: SsrBuffer): string {
  if (!buf.segments) return buf.html
  let parts: string[] = []
  for (let seg of buf.segments) {
    if (typeof seg === 'string') {
      parts.push(seg)
    } else if (seg.kind === 'static') {
      parts.push(seg.html)
    } else {
      parts.push(`<!--${createFrameStartMarker(seg.frameId)}-->`)
      if (typeof seg.content === 'string') parts.push(seg.content)
      else if (seg.content) parts.push(serializeBuffer(seg.content))
      parts.push(`<!--${FRAME_END_MARKER}-->`)
    }
  }
  if (buf.html.length > 0) parts.push(buf.html)
  return parts.join('')
}

const HTML_ESCAPE_RE = /[&<>"']/
const TEXT_ESCAPE_RE = /[&<>]/

function escapeHtml(str: string): string {
  if (!HTML_ESCAPE_RE.test(str)) return str
  let len = str.length
  let lastIndex = 0
  let out = ''
  for (let i = 0; i < len; i++) {
    let c = str.charCodeAt(i)
    if (c > 62) continue
    let esc: string
    if (c === 38) esc = '&amp;'
    else if (c === 60) esc = '&lt;'
    else if (c === 62) esc = '&gt;'
    else if (c === 34) esc = '&quot;'
    else if (c === 39) esc = '&#39;'
    else continue
    if (lastIndex !== i) out += str.slice(lastIndex, i)
    out += esc
    lastIndex = i + 1
  }
  return lastIndex < len ? out + str.slice(lastIndex) : out
}

function escapeTextContent(str: string): string {
  if (!TEXT_ESCAPE_RE.test(str)) return str
  let len = str.length
  let lastIndex = 0
  let out = ''
  for (let i = 0; i < len; i++) {
    let c = str.charCodeAt(i)
    if (c > 62) continue
    let esc: string
    if (c === 38) esc = '&amp;'
    else if (c === 60) esc = '&lt;'
    else if (c === 62) esc = '&gt;'
    else continue
    if (lastIndex !== i) out += str.slice(lastIndex, i)
    out += esc
    lastIndex = i + 1
  }
  return lastIndex < len ? out + str.slice(lastIndex) : out
}

function escapeTemplateContent(html: string): string {
  return html.replace(/<\/template/gi, '<\\/template')
}

const SCRIPT_TAG_PATTERN = /(<\/|<)(s)(cript)/gi

function escapeScriptTextContent(value: string): string {
  return value.replace(
    SCRIPT_TAG_PATTERN,
    (_match, prefix: string, firstLetter: string, suffix: string) =>
      `${prefix}${firstLetter === 's' ? '\\u0073' : '\\u0053'}${suffix}`,
  )
}

function finalizeHtml(root: SsrBuffer, context: RenderContext): string {
  let resources = context.clientEntryHeadResources
  let preloads = resources ? collectModulePreloadTags(resources, context.nonce) : ''
  let styles = collectStyleTags(context)
  let importMapScript = resources ? collectImportMapScript(context, resources) : ''
  let nonceMeta =
    context.flushKind === 'document' && context.nonce !== undefined
      ? `<meta name="${DOCUMENT_NONCE_META_NAME}" content=""${renderNonceAttribute(context.nonce)}>`
      : ''
  let headContent = nonceMeta + importMapScript + preloads + styles
  let rmxData = buildRmxDataScript(context)
  if (context.flushKind !== 'document') {
    if (!headContent && !rmxData) return serializeBuffer(root)
    return (headContent ? `<head>${headContent}</head>` : '') + serializeBuffer(root) + rmxData
  }
  if (!headContent && !rmxData) return serializeBuffer(root)

  // Use the rendered element boundaries so raw script and frame contents cannot
  // be mistaken for document tags.
  let { html, head, body } = context.documentSegments
  invariant(html, 'Missing document element segments')
  if (headContent) {
    if (head) head.close.html = headContent + head.close.html
    else html.open.html += `<head>${headContent}</head>`
  }
  if (rmxData) {
    let close = (body ?? html).close
    close.html = rmxData + close.html
  }
  return serializeBuffer(root)
}

const FRAME_HEAD_OPEN_TAG = '<head>'
const FRAME_HEAD_CLOSE_TAG = '</head>'
const MARKED_MODULE_PRELOAD_START = '<link data-rmx-module-preload rel="modulepreload" href="'
const MODULE_PRELOAD_END = '" />'
const MANAGED_IMPORT_MAP_OPEN_TAG =
  /^<script data-rmx-import-map type="importmap"(?: nonce="[^"]*")?>/
const IMPORT_MAP_SCRIPT_END = '</script>'

function createModulePreloadTag(href: string): string {
  return `${MARKED_MODULE_PRELOAD_START}${escapeHtml(href)}${MODULE_PRELOAD_END}`
}

function collectModulePreloadTags(resources: ClientEntryHeadResources, nonce?: string): string {
  return Array.from(resources.modulePreloadTags, (tag) =>
    tag.replace(' />', () => `${renderNonceAttribute(nonce)} />`),
  ).join('')
}

function hoistClientEntryResourcesFromFrameHead(
  html: string,
  resources: ClientEntryHeadResources,
): string {
  if (!html.startsWith(FRAME_HEAD_OPEN_TAG)) return html

  let headClose = html.indexOf(FRAME_HEAD_CLOSE_TAG, FRAME_HEAD_OPEN_TAG.length)
  if (headClose === -1) return html

  let preloadTags: string[] = []
  let importMaps: ImportMapData[] = []
  let cursor = FRAME_HEAD_OPEN_TAG.length
  let importMapOpenTag = html.slice(cursor).match(MANAGED_IMPORT_MAP_OPEN_TAG)
  if (importMapOpenTag) {
    let contentStart = cursor + importMapOpenTag[0].length
    let scriptEnd = html.indexOf(IMPORT_MAP_SCRIPT_END, contentStart)
    if (scriptEnd === -1 || scriptEnd >= headClose) return html
    importMaps.push(parseFrameworkImportMap(html.slice(contentStart, scriptEnd)))
    cursor = scriptEnd + IMPORT_MAP_SCRIPT_END.length
  }

  while (html.startsWith(MARKED_MODULE_PRELOAD_START, cursor)) {
    let hrefStart = cursor + MARKED_MODULE_PRELOAD_START.length
    let hrefEnd = html.indexOf('"', hrefStart)
    if (hrefEnd === -1 || hrefEnd >= headClose) return html

    let tagEnd = html.indexOf(MODULE_PRELOAD_END, hrefEnd)
    if (tagEnd === -1) return html
    tagEnd += MODULE_PRELOAD_END.length
    if (tagEnd > headClose) return html

    // Preserve the escaped href and discard the child response's nonce.
    // The enclosing render applies its nonce when serializing the head.
    preloadTags.push(html.slice(cursor, hrefEnd) + MODULE_PRELOAD_END)
    cursor = tagEnd
  }

  if (preloadTags.length === 0 && importMaps.length === 0) return html

  for (let tag of preloadTags) {
    resources.modulePreloadTags.add(tag)
  }
  for (let importMap of importMaps) {
    mergeImportMap(resources, importMap)
  }

  let remainingHeadHtml = html.slice(cursor, headClose)
  let contentAfterHead = html.slice(headClose + FRAME_HEAD_CLOSE_TAG.length)
  if (!remainingHeadHtml) return contentAfterHead

  return `${FRAME_HEAD_OPEN_TAG}${remainingHeadHtml}${FRAME_HEAD_CLOSE_TAG}${contentAfterHead}`
}

function collectStyleTags(context: RenderContext): string {
  let styleCache = context.styleCache
  if (!styleCache || styleCache.size === 0) return ''

  let tags: string[] = []
  for (let { selector, css } of styleCache.values()) {
    let tag = renderStyleTag(selector, css, context.nonce)
    if (tag) tags.push(tag)
  }
  return tags.join('')
}

function wrapStyleForLayer(
  selector: string,
  css: string,
  layer: string = REMIX_UI_STYLE_LAYER,
): string {
  let trimmed = css.trim()
  if (!trimmed) return ''
  return `@layer ${getStyleLayerName(selector, layer)} { ${trimmed} }`
}

function renderStyleTag(
  selector: string,
  css: string,
  nonce?: string,
  layer: string = REMIX_UI_STYLE_LAYER,
): string {
  let wrappedCss = wrapStyleForLayer(selector, css, layer)
  if (!wrappedCss) return ''
  return `<style data-rmx-style="${escapeHtml(selector)}"${renderNonceAttribute(nonce)}>${escapeStyleText(
    wrappedCss,
  )}</style>`
}

function renderNonceAttribute(nonce: string | undefined): string {
  return nonce === undefined ? '' : ` nonce="${escapeHtml(nonce)}"`
}

function escapeStyleText(css: string): string {
  // Only neutralize literal style end tags. Escaping every '<' breaks valid range media queries.
  return css.replace(/<\/style/gi, '\\3C/style')
}

function buildRmxDataScript(context: RenderContext): string {
  let hydrationData = context.hydrationData
  let frameData = context.frameData
  if ((!hydrationData || hydrationData.size === 0) && (!frameData || frameData.size === 0)) {
    return ''
  }

  let fields: string[] = []
  if (hydrationData && hydrationData.size > 0) {
    let entries: string[] = []
    for (let [id, { exportName, moduleUrl, propsJson }] of hydrationData) {
      entries.push(
        `${JSON.stringify(id)}:{"exportName":${JSON.stringify(exportName)},"moduleUrl":${JSON.stringify(moduleUrl)},"props":${propsJson}}`,
      )
    }
    fields.push(`"h":{${entries.join(',')}}`)
  }

  if (frameData && frameData.size > 0) {
    fields.push(`"f":${JSON.stringify(Object.fromEntries(frameData))}`)
  }

  let serializedData = escapeScriptJson(`{${fields.join(',')}}`)
  return `<script type="application/json" id="rmx-data">${serializedData}</script>`
}

function buildImportMapScript(importMap: ImportMapData, attrs: string = ''): string {
  let serializedData = escapeScriptJson(JSON.stringify(importMap))
  return `<script data-rmx-import-map type="importmap"${attrs}>${serializedData}</script>`
}

function collectImportMapScript(
  context: RenderContext,
  resources: ClientEntryHeadResources,
): string {
  let importMap = getImportMapDelta(context, resources.importMap)
  return importMap ? buildImportMapScript(importMap, renderNonceAttribute(context.nonce)) : ''
}

function finalizeManagedImportMap(context: RenderContext): void {
  let managed = context.managedImportMaps?.[0]
  if (!managed) return

  let resources: ClientEntryHeadResources = { modulePreloadTags: new Set() }
  mergeImportMap(resources, managed.value)
  if (context.clientEntryHeadResources?.importMap) {
    mergeImportMap(resources, context.clientEntryHeadResources.importMap)
  }
  managed.segment.html = buildImportMapScript(resources.importMap ?? {}, managed.attrs)
  if (context.clientEntryHeadResources) {
    context.clientEntryHeadResources.importMap = undefined
  }
}

const EMPTY_AUTHORED_IMPORTS: AuthoredImportMapEntries = new Map()
const EMPTY_AUTHORED_INTEGRITY = new Map<string, string>()

function getImportMapDelta(
  context: RenderContext,
  importMap: ImportMapData | undefined,
): ImportMapData | null {
  if (!importMap) return null

  let imports = importMap.imports
    ? getImportMapImportsDelta(
        context.authoredImportMapImports ?? EMPTY_AUTHORED_IMPORTS,
        importMap.imports,
      )
    : undefined
  let scopes: Record<string, ImportMapImports> = {}
  for (let [scope, scopedImports] of Object.entries(importMap.scopes ?? {})) {
    let authoredImports =
      context.authoredImportMapScopes?.get(scope)?.imports ?? EMPTY_AUTHORED_IMPORTS
    let importsDelta = getImportMapImportsDelta(authoredImports, scopedImports, scope)
    if (importsDelta) scopes[scope] = importsDelta
  }
  let integrity = importMap.integrity
    ? getImportMapIntegrityDelta(
        context.authoredImportMapIntegrity ?? EMPTY_AUTHORED_INTEGRITY,
        importMap.integrity,
      )
    : undefined

  if (!imports && Object.keys(scopes).length === 0 && !integrity) return null
  return {
    ...(imports ? { imports } : null),
    ...(Object.keys(scopes).length > 0 ? { scopes } : null),
    ...(integrity ? { integrity } : null),
  }
}

function getImportMapImportsDelta(
  authoredImports: AuthoredImportMapEntries,
  discoveredImports: ImportMapImports,
  scope?: string,
): ImportMapImports | undefined {
  let delta: ImportMapImports = {}
  for (let [specifier, address] of Object.entries(discoveredImports)) {
    if (!authoredImports.has(specifier)) {
      delta[specifier] = address
      continue
    }

    let authoredAddress = authoredImports.get(specifier)
    if (authoredAddress === address) continue

    let scopeDescription = scope ? ` in scope "${scope}"` : ''
    console.warn(
      `[remix] Ignoring conflicting import map entry for "${specifier}"${scopeDescription}: ` +
        `${formatImportMapAddress(authoredAddress)} is already authored, but the discovered map points to ${formatImportMapAddress(address)}`,
    )
  }

  return Object.keys(delta).length > 0 ? delta : undefined
}

function getImportMapIntegrityDelta(
  authoredIntegrity: Map<string, string>,
  discoveredIntegrity: Record<string, string>,
): Record<string, string> | undefined {
  let delta: Record<string, string> = {}
  for (let [url, integrity] of Object.entries(discoveredIntegrity)) {
    if (!authoredIntegrity.has(url)) {
      delta[url] = integrity
      continue
    }

    let authoredIntegrityValue = authoredIntegrity.get(url)
    if (authoredIntegrityValue === integrity) continue

    console.warn(
      `[remix] Ignoring conflicting import map integrity entry for "${url}": ` +
        `"${authoredIntegrityValue}" is already authored, but the discovered map points to "${integrity}"`,
    )
  }

  return Object.keys(delta).length > 0 ? delta : undefined
}

function parseAuthoredImportMap(json: string): ImportMapData | null {
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch {
    return null
  }
  if (!isObjectRecord(value)) return null

  let importMap: ImportMapData = {}
  if (value.imports !== undefined) {
    if (!isObjectRecord(value.imports)) return null
    importMap.imports = parseAuthoredImportMapImports(value.imports)
  }
  if (value.scopes !== undefined) {
    if (!isObjectRecord(value.scopes)) return null
    let scopes: Array<[string, ImportMapImports]> = []
    for (let [scope, imports] of Object.entries(value.scopes)) {
      if (!isObjectRecord(imports)) continue
      scopes.push([scope, parseAuthoredImportMapImports(imports)])
    }
    importMap.scopes = Object.fromEntries(scopes)
  }
  if (value.integrity !== undefined) {
    if (!isObjectRecord(value.integrity)) return null
    importMap.integrity = Object.fromEntries(
      Object.entries(value.integrity).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    )
  }
  return importMap
}

function parseAuthoredImportMapImports(value: Record<string, unknown>): ImportMapImports {
  return Object.fromEntries(
    Object.entries(value).map(([specifier, address]) => [
      specifier,
      address === null || typeof address === 'string' ? address : null,
    ]),
  )
}

function parseFrameworkImportMap(json: string): ImportMapData {
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch {
    throw new Error('Invalid framework-owned import map in frame head')
  }
  if (!isImportMap(value)) {
    throw new Error('Invalid framework-owned import map in frame head')
  }
  return value
}

function isImportMap(value: unknown): value is ImportMapData {
  if (!isObjectRecord(value)) return false
  if (value.imports !== undefined && !isImportMapImports(value.imports)) return false
  if (value.scopes !== undefined) {
    if (!isObjectRecord(value.scopes)) return false
    for (let imports of Object.values(value.scopes)) {
      if (!isImportMapImports(imports)) return false
    }
  }
  if (value.integrity !== undefined && !isImportMapIntegrity(value.integrity)) return false
  return true
}

function isImportMapImports(value: unknown): value is ImportMapImports {
  if (!isObjectRecord(value)) return false
  return Object.values(value).every((address) => address === null || typeof address === 'string')
}

function isImportMapIntegrity(value: unknown): value is Record<string, string> {
  if (!isObjectRecord(value)) return false
  return Object.values(value).every((integrity) => typeof integrity === 'string')
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function mergeImportMap(resources: ClientEntryHeadResources, source: ImportMapData): void {
  let target = (resources.importMap ??= {})
  if (source.imports) {
    target.imports ??= {}
    mergeImportMapImports(target.imports, source.imports)
  }
  if (source.scopes) {
    target.scopes ??= {}
    for (let [scope, imports] of Object.entries(source.scopes)) {
      let targetImports = (target.scopes[scope] ??= {})
      mergeImportMapImports(targetImports, imports, scope)
    }
  }
  if (source.integrity) {
    target.integrity ??= {}
    mergeImportMapIntegrity(target.integrity, source.integrity)
  }
}

function mergeImportMapImports(
  target: ImportMapImports,
  source: ImportMapImports,
  scope?: string,
): void {
  for (let [specifier, address] of Object.entries(source)) {
    if (!Object.hasOwn(target, specifier)) {
      target[specifier] = address
      continue
    }
    if (target[specifier] !== address) {
      let scopeDescription = scope ? ` in scope "${scope}"` : ''
      throw new Error(
        `Conflicting framework import map entry for "${specifier}"${scopeDescription}`,
      )
    }
  }
}

function mergeImportMapIntegrity(
  target: Record<string, string>,
  source: Record<string, string>,
): void {
  for (let [url, integrity] of Object.entries(source)) {
    if (!Object.hasOwn(target, url)) {
      target[url] = integrity
      continue
    }
    if (target[url] !== integrity) {
      throw new Error(`Conflicting framework import map integrity entry for "${url}"`)
    }
  }
}

function escapeScriptJson(json: string): string {
  // Avoid prematurely closing the script tag when serialized data contains "</script>".
  return json.replace(/</g, '\\u003c')
}

function formatImportMapAddress(address: ImportMapAddress | undefined): string {
  return address === null ? 'null' : `"${address}"`
}

// Frame styles work end-to-end when frame handlers use their own `renderToStream`:
// the handler's `finalizeHtml` emits selector-addressed `<style>` tags in its HTML, and on the client,
// the `adoptServerStyleTag` MutationObserver (stylesheet.ts) picks it up anywhere in the
// document and adopts the CSS into an adopted stylesheet.
//
// Style tags are intentionally NOT deduped across frame boundaries: each frame
// owns its style rules independently on the client (per-frame refcounted
// adoption), so every frame's HTML must carry the full set of style tags its
// content references — even when a sibling frame or the enclosing document
// already emitted the same selector.
async function streamPendingFrames(
  context: RenderContext,
  controller: ReadableStreamDefaultController,
): Promise<void> {
  let pendingFrames = context.pendingFrames
  if (!pendingFrames || pendingFrames.length === 0) return
  let processedFrames = new Set<string>()

  while (true) {
    if (context.signal.aborted) break

    let batch = pendingFrames.filter(({ frameId }) => !processedFrames.has(frameId))
    if (batch.length === 0) break

    await Promise.all(
      batch.map(async ({ frameId, promise }) => {
        if (context.signal.aborted) return
        processedFrames.add(frameId)
        try {
          let { html, tail } = await promise
          if (context.signal.aborted) return

          // Stream as a template element (first chunk only)
          let templateHtml = `<template id="${frameId}">${escapeTemplateContent(html)}<!--${FRAME_TEMPLATE_END_MARKER}--></template>`
          if (context.signal.aborted) return
          controller.enqueue(encodeHtml(templateHtml))

          // Forward any additional chunks from a stream-valued resolveFrame result.
          if (tail) {
            await streamByteStreams([tail], controller, context)
          }
        } catch (error) {
          if (!isSignalAbortError(context.signal, error)) {
            context.onError(error)
          }
        }
      }),
    )
  }
}

async function streamByteStreams(
  streams: ReadableStream<Uint8Array>[],
  controller: ReadableStreamDefaultController,
  context: RenderContext,
): Promise<void> {
  await Promise.all(
    streams.map(async (stream) => {
      let reader = stream.getReader()
      try {
        while (true) {
          if (context.signal.aborted) break
          let { done, value } = await reader.read()
          if (done) break
          if (context.signal.aborted) break
          controller.enqueue(value)
        }
      } catch (error) {
        if (!isSignalAbortError(context.signal, error)) {
          context.onError(error)
        }
      } finally {
        reader.releaseLock()
      }
    }),
  )
}

/**
 * Renders a node tree to a complete HTML string.
 * Render errors reject the returned promise.
 *
 * @param node Node tree to render.
 * @param options Rendering options.
 * @returns Rendered HTML.
 */
export async function renderToString(
  node: RemixNode,
  options?: RenderToStringOptions,
): Promise<string> {
  let context = createRenderContext(
    '',
    '',
    defaultResolveFrame,
    options?.nonce,
    ssrSignal,
    (error) => {
      throw error
    },
  )
  let root: SsrBuffer = { html: '', segments: null }
  buildSegment(node, context, root)
  if (context.unresolvedHydrationData && context.unresolvedHydrationData.size > 0) {
    await resolveClientEntries(context)
    validateClientEntriesForHydration(context)
  }
  if (context.managedImportMaps && context.managedImportMaps.length > 0) {
    finalizeManagedImportMap(context)
  }
  return finalizeHtml(root, context)
}

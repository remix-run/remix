import type { StreamingPolicy } from '@remix-run/reconciler'
import type { StreamingRenderValue } from '@remix-run/reconciler'
import type { StreamingRendererRoot } from '@remix-run/reconciler'
import {
  isEntry,
  serializeHydrationProps,
  type HydrationData,
} from './client-entry.ts'
import { readHtmlStreamingHeadHtml } from './html-streaming-contributions.ts'

let encoder = new TextEncoder()
export let HTML_STREAMING_FINALIZE_PREFIX = '<!-- rmx:finalize:'
export let HTML_STREAMING_FINALIZE_SUFFIX = ' -->'

type FrameMeta = {
  status: 'pending' | 'resolved'
  name?: string
  src: string
}

type HtmlRootContext = {
  root: StreamingRendererRoot<Uint8Array>
  insideHead: number
  hasHtmlRoot: boolean
  hoistedHeadElements: string[]
  sinkStack: Array<'main' | 'hoist'>
  frameData: Map<string, FrameMeta>
  hydrationData: Map<string, HydrationData>
}

type HtmlElementState = {
  type: string
  voidElement: boolean
  sink: 'main' | 'hoist'
  enteredHead: boolean
}

let voidElements = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

export type ResolveFrame = (
  src: string,
  signal: AbortSignal,
) =>
  | Promise<ResolveFrameValue>
  | ResolveFrameValue

type ResolveFrameValue = string | Uint8Array | ReadableStream<Uint8Array> | StreamingRenderValue

type ResolvedFrameHtml = {
  html: string
  tail?: ReadableStream<Uint8Array>
}

type HtmlStreamingPolicyOptions = {
  resolveFrame?: ResolveFrame
  renderFrameValueToString?: (
    value: null | StreamingRenderValue,
    signal: AbortSignal,
  ) => Promise<string>
}

export function createHtmlStreamingPolicy(
  options: HtmlStreamingPolicyOptions = {},
): StreamingPolicy<Uint8Array, HtmlRootContext, HtmlElementState> {
  return {
    beginRoot(root) {
      return {
        root,
        insideHead: 0,
        hasHtmlRoot: false,
        hoistedHeadElements: [],
        sinkStack: ['main'],
        frameData: new Map(),
        hydrationData: new Map(),
      }
    },
    resolveBoundary(input, context, signal) {
      if (input.kind === 'component' && isEntry(input.type)) {
        if (!input.props || typeof input.props !== 'object' || Array.isArray(input.props)) {
          throw new Error('clientEntry props must be an object')
        }
        let hydrationId = crypto.randomUUID()
        let hydrationProps =
          input.setup === undefined ? input.props : { ...input.props, setup: input.setup }
        context.hydrationData.set(hydrationId, {
          moduleUrl: input.type.$moduleUrl,
          exportName: input.type.$exportName,
          props: serializeHydrationProps(hydrationProps),
        })
        return {
          open: encoder.encode(`<!-- rmx:h:${hydrationId} -->`),
          content: input.rendered,
          close: encoder.encode('<!-- /rmx:h -->'),
        }
      }

      if (input.kind !== 'host') return null
      if (input.type !== 'frame') return null
      let src = input.props.src
      if (typeof src !== 'string') {
        throw new Error('<frame> requires a "src" string prop')
      }
      if (!options.resolveFrame) {
        throw new Error('No resolveFrame provided')
      }
      let frameId = crypto.randomUUID()
      let fallbackContent =
        'fallback' in input.props ? (input.props.fallback as null | StreamingRenderValue) : null
      let frameName = typeof input.props.name === 'string' ? input.props.name : undefined
      context.frameData.set(frameId, {
        status: fallbackContent == null ? 'resolved' : 'pending',
        name: frameName,
        src,
      })
      if (fallbackContent != null) {
        let deferred = resolveFrameTemplate(
          options.resolveFrame,
          options.renderFrameValueToString,
          frameId,
          src,
          signal,
        ).catch((error) => {
          if (signal.aborted) return new Uint8Array()
          throw error
        })
        return {
          open: encoder.encode(`<!-- f:${frameId} -->`),
          content: fallbackContent,
          close: encoder.encode('<!-- /f -->'),
          deferred,
        }
      }
      let blocking = resolveFrameBlockingContent(
        options.resolveFrame,
        options.renderFrameValueToString,
        src,
        signal,
      )
      return {
        open: emitBlockingFrameBoundaryOpen(frameId, blocking, signal),
        close: encoder.encode('<!-- /f -->'),
        deferred: blocking.then((resolved) => {
          if (!resolved.tail) return null
          return streamByteTail(resolved.tail, signal)
        }),
      }
    },
    beginElement(input, context) {
      if (input.type === 'html') {
        context.hasHtmlRoot = true
      }
      let attrs = serializeAttributes(input.props)
      let voidElement = voidElements.has(input.type)
      let open = `<${input.type}${attrs}>`
      let body =
        typeof input.props.innerHTML === 'string' ? encoder.encode(String(input.props.innerHTML)) : undefined
      let enteredHead = input.type === 'head'
      if (enteredHead) {
        context.insideHead += 1
      }
      let shouldHoist = isHeadManagedElement(input.type, input.props) && context.insideHead === 0
      let sink = shouldHoist ? 'hoist' : currentSink(context)
      context.sinkStack.push(sink)
      if (sink === 'hoist') {
        context.hoistedHeadElements.push(open)
        if (body) {
          context.hoistedHeadElements.push(new TextDecoder().decode(body))
          body = undefined
        }
      }
      return {
        state: { type: input.type, voidElement, sink, enteredHead },
        open: sink === 'main' ? encoder.encode(open) : undefined,
        body,
        skipChildren: body !== undefined || voidElement,
      }
    },
    text(value, context) {
      let escaped = escapeHtml(value)
      if (currentSink(context) === 'hoist') {
        context.hoistedHeadElements.push(escaped)
        return
      }
      return encoder.encode(escaped)
    },
    endElement(state, context) {
      if (!state.voidElement) {
        let close = `</${state.type}>`
        if (state.sink === 'hoist') {
          context.hoistedHeadElements.push(close)
        } else {
          context.sinkStack.pop()
          if (state.enteredHead) {
            context.insideHead -= 1
          }
          return encoder.encode(close)
        }
      }
      context.sinkStack.pop()
      if (state.enteredHead) {
        context.insideHead -= 1
      }
      return
    },
    finalize(context) {
      let headContributions = readHtmlStreamingHeadHtml(context.root)
      if (headContributions.length > 0) {
        context.hoistedHeadElements.push(...headContributions)
      }
      let headHtml = context.hoistedHeadElements.join('')
      let rmxDataScript = serializeRmxDataScript(context.hydrationData, context.frameData)
      if (!headHtml && !rmxDataScript) return
      let payload = encodeURIComponent(
        JSON.stringify({
          headHtml,
          rmxDataScript,
        }),
      )
      return encoder.encode(
        `${HTML_STREAMING_FINALIZE_PREFIX}${payload}${HTML_STREAMING_FINALIZE_SUFFIX}`,
      )
    },
  }
}

function serializeAttributes(props: Record<string, unknown>) {
  let attrs = ''
  for (let key in props) {
    if (isFrameworkProp(key)) continue
    let value = props[key]
    if (value == null || value === false) continue
    if (typeof value === 'function') continue
    if (key === 'innerHTML') continue
    let attrName = toAttributeName(key)
    if (value === true) {
      attrs += ` ${attrName}`
      continue
    }
    attrs += ` ${attrName}="${escapeHtmlAttribute(String(value))}"`
  }
  return attrs
}

function isFrameworkProp(name: string) {
  return name === 'children' || name === 'key' || name === 'mix' || name === 'fallback'
}

function isHeadManagedElement(type: string, props: Record<string, unknown>) {
  return (
    type === 'title' ||
    type === 'meta' ||
    type === 'link' ||
    type === 'style' ||
    (type === 'script' && props.type === 'application/ld+json')
  )
}

function currentSink(context: HtmlRootContext) {
  return context.sinkStack[context.sinkStack.length - 1] ?? 'main'
}

function toAttributeName(name: string) {
  return name
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function escapeHtmlAttribute(value: string) {
  return escapeHtml(value).replaceAll('"', '&quot;')
}

async function resolveFrameTemplate(
  resolveFrame: ResolveFrame,
  renderFrameValueToString: HtmlStreamingPolicyOptions['renderFrameValueToString'],
  frameId: string,
  src: string,
  signal: AbortSignal,
) {
  let resolved = await resolveFrame(src, signal)
  let frame = await resolvedFrameToHtml(resolved, renderFrameValueToString, signal)
  let extracted = extractNamedTemplates(frame.html)
  if (!frame.tail) {
    let escaped = escapeTemplateClosers(extracted.htmlWithoutTemplates)
    return encoder.encode(
      `<template id="${frameId}">${escaped}</template>${extracted.templatesHtml.join('')}`,
    )
  }
  if (extracted.templatesHtml.length > 0) {
    let escaped = escapeTemplateClosers(extracted.htmlWithoutTemplates)
    let prefix = encoder.encode(
      `<template id="${frameId}">${escaped}</template>${extracted.templatesHtml.join('')}`,
    )
    return streamTemplateAndTail(prefix, frame.tail, signal)
  }
  return streamTemplateUntilNamedTemplate(frameId, extracted.htmlWithoutTemplates, frame.tail, signal)
}

async function resolveFrameBlockingContent(
  resolveFrame: ResolveFrame,
  renderFrameValueToString: HtmlStreamingPolicyOptions['renderFrameValueToString'],
  src: string,
  signal: AbortSignal,
) {
  let resolved = await resolveFrame(src, signal)
  return await resolvedFrameToHtml(resolved, renderFrameValueToString, signal)
}

async function* emitBlockingFrameBoundaryOpen(
  frameId: string,
  blocking: Promise<ResolvedFrameHtml>,
  signal: AbortSignal,
) {
  yield encoder.encode(`<!-- f:${frameId} -->`)
  let resolved = await blocking
  if (signal.aborted) throw signal.reason ?? new Error('stream aborted')
  if (resolved.html) {
    yield encoder.encode(resolved.html)
  }
}

async function resolvedFrameToHtml(
  value: ResolveFrameValue,
  renderFrameValueToString: HtmlStreamingPolicyOptions['renderFrameValueToString'],
  signal: AbortSignal,
): Promise<ResolvedFrameHtml> {
  if (signal.aborted) throw signal.reason ?? new Error('stream aborted')
  if (typeof value === 'string') return { html: value }
  if (value instanceof Uint8Array) return { html: new TextDecoder().decode(value) }
  if (isByteStream(value)) {
    let { first, tail } = await splitFirstChunk(value)
    return {
      html: new TextDecoder().decode(first),
      tail,
    }
  }
  if (!renderFrameValueToString) {
    throw new Error('Missing frame renderer')
  }
  return { html: await renderFrameValueToString(value, signal) }
}

function isByteStream(value: unknown): value is ReadableStream<Uint8Array> {
  return (
    typeof value === 'object' &&
    value != null &&
    'getReader' in value &&
    typeof (value as ReadableStream<Uint8Array>).getReader === 'function'
  )
}

async function splitFirstChunk(stream: ReadableStream<Uint8Array>) {
  let reader = stream.getReader()
  let first: null | Uint8Array = null
  while (true) {
    let next = await reader.read()
    if (next.done) break
    if (next.value.byteLength === 0) continue
    first = next.value
    break
  }
  if (!first) {
    reader.releaseLock()
    return {
      first: new Uint8Array(),
      tail: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close()
        },
      }),
    }
  }
  let released = false
  let release = () => {
    if (released) return
    released = true
    try {
      reader.releaseLock()
    } catch {
      // Ignore release failures from already-closed streams.
    }
  }
  let tail = new ReadableStream<Uint8Array>({
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
  return { first, tail }
}

async function* streamTemplateAndTail(
  initialTemplateChunk: Uint8Array,
  tail: ReadableStream<Uint8Array>,
  signal: AbortSignal,
) {
  yield initialTemplateChunk
  yield* streamByteTail(tail, signal)
}

async function* streamTemplateUntilNamedTemplate(
  frameId: string,
  firstChunkHtml: string,
  tail: ReadableStream<Uint8Array>,
  signal: AbortSignal,
) {
  yield encoder.encode(`<template id="${frameId}">${escapeTemplateClosers(firstChunkHtml)}`)
  let reader = tail.getReader()
  let decoder = new TextDecoder()
  let open = true
  let buffer = ''
  try {
    while (true) {
      if (signal.aborted) throw signal.reason ?? new Error('stream aborted')
      let { done, value } = await reader.read()
      if (done) break
      if (open) {
        buffer += decoder.decode(value, { stream: true })
        let namedTemplateStart = findNamedTemplateStart(buffer)
        if (namedTemplateStart !== -1) {
          let before = buffer.slice(0, namedTemplateStart)
          let fromTemplate = buffer.slice(namedTemplateStart)
          if (before) {
            yield encoder.encode(escapeTemplateClosers(before))
          }
          yield encoder.encode('</template>')
          if (fromTemplate) {
            yield encoder.encode(fromTemplate)
          }
          open = false
          buffer = ''
          continue
        }
        if (buffer.length > 24) {
          let flush = buffer.slice(0, -24)
          if (flush) {
            yield encoder.encode(escapeTemplateClosers(flush))
          }
          buffer = buffer.slice(-24)
        }
        continue
      }
      if (!value) continue
      yield value
    }
    if (open) {
      buffer += decoder.decode()
      if (buffer) {
        yield encoder.encode(escapeTemplateClosers(buffer))
      }
      yield encoder.encode('</template>')
      return
    }
    let remainder = decoder.decode()
    if (remainder) {
      yield encoder.encode(remainder)
    }
  } finally {
    reader.releaseLock()
  }
}

async function* streamByteTail(tail: ReadableStream<Uint8Array>, signal: AbortSignal) {
  let reader = tail.getReader()
  try {
    while (true) {
      if (signal.aborted) throw signal.reason ?? new Error('stream aborted')
      let { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      yield value
    }
  } finally {
    reader.releaseLock()
  }
}

function extractNamedTemplates(html: string) {
  let templatePattern = /<template\b[^>]*\bid=(?:"[^"]+"|'[^']+')[^>]*>[\s\S]*?<\/template>/gi
  let templatesHtml: string[] = []
  let htmlWithoutTemplates = html.replace(templatePattern, (templateHtml) => {
    templatesHtml.push(templateHtml)
    return ''
  })
  return { htmlWithoutTemplates, templatesHtml }
}

function escapeTemplateClosers(html: string) {
  return html.replace(/<\/template/gi, '<\\/template')
}

function findNamedTemplateStart(html: string) {
  return html.search(/<template\b[^>]*\bid=(?:"[^"]+"|'[^']+')[^>]*>/i)
}

function serializeRmxDataScript(
  hydrationData: Map<string, HydrationData>,
  frameData: Map<string, FrameMeta>,
) {
  if (frameData.size === 0 && hydrationData.size === 0) return ''
  let data: {
    h?: Record<string, HydrationData>
    f?: Record<string, FrameMeta>
  } = {}
  if (hydrationData.size > 0) {
    data.h = Object.fromEntries(hydrationData)
  }
  if (frameData.size > 0) {
    data.f = Object.fromEntries(frameData)
  }
  let json = JSON.stringify(data).replaceAll('<', '\\u003c')
  return `<script type="application/json" id="rmx-data">${json}</script>`
}

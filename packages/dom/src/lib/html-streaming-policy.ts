import type { StreamingPolicy } from '@remix-run/reconciler'
import type { StreamingRenderValue } from '@remix-run/reconciler'
import {
  isEntry,
  serializeHydrationProps,
  type HydrationData,
} from './client-entry.ts'

let encoder = new TextEncoder()

type FrameMeta = {
  status: 'pending' | 'resolved'
  src: string
}

type HtmlRootContext = {
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
) => Promise<string | Uint8Array | ReadableStream<Uint8Array>> | string | Uint8Array | ReadableStream<Uint8Array>

type HtmlStreamingPolicyOptions = {
  resolveFrame?: ResolveFrame
}

export function createHtmlStreamingPolicy(
  options: HtmlStreamingPolicyOptions = {},
): StreamingPolicy<Uint8Array, HtmlRootContext, HtmlElementState> {
  return {
    beginRoot() {
      return {
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
        context.hydrationData.set(hydrationId, {
          moduleUrl: input.type.$moduleUrl,
          exportName: input.type.$exportName,
          props: serializeHydrationProps(input.props),
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
      let frameId = crypto.randomUUID()
      let content =
        'fallback' in input.props ? (input.props.fallback as null | StreamingRenderValue) : null
      context.frameData.set(frameId, {
        status: content == null ? 'resolved' : 'pending',
        src,
      })
      let deferred = options.resolveFrame
        ? resolveFrameTemplate(options.resolveFrame, frameId, src, signal)
        : Promise.resolve(undefined)
      return {
        open: encoder.encode(`<!-- f:${frameId} -->`),
        content,
        close: encoder.encode('<!-- /f -->'),
        deferred,
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
      let chunks: Uint8Array[] = []
      if (context.hoistedHeadElements.length > 0) {
        let wrapped = context.hasHtmlRoot
          ? `<head>${context.hoistedHeadElements.join('')}</head>`
          : `<head>${context.hoistedHeadElements.join('')}</head>`
        chunks.push(encoder.encode(wrapped))
      }
      let rmxDataScript = serializeRmxDataScript(context.hydrationData, context.frameData)
      if (rmxDataScript) {
        chunks.push(encoder.encode(rmxDataScript))
      }
      return chunks
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
  if (name === 'className') return 'class'
  if (name === 'htmlFor') return 'for'
  if (name.startsWith('aria-') || name.startsWith('data-')) return name
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
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
  frameId: string,
  src: string,
  signal: AbortSignal,
) {
  if (signal.aborted) throw signal.reason ?? new Error('stream aborted')
  let resolved = await resolveFrame(src, signal)
  let html = ''
  if (typeof resolved === 'string') {
    html = resolved
  } else if (resolved instanceof Uint8Array) {
    html = new TextDecoder().decode(resolved)
  } else {
    html = await readByteStream(resolved, signal)
  }
  let escaped = html.replace(/<\/template/gi, '<\\/template')
  return encoder.encode(`<template id="${frameId}">${escaped}</template>`)
}

async function readByteStream(stream: ReadableStream<Uint8Array>, signal: AbortSignal) {
  let reader = stream.getReader()
  let decoder = new TextDecoder()
  let output = ''
  try {
    while (true) {
      if (signal.aborted) throw signal.reason ?? new Error('stream aborted')
      let { done, value } = await reader.read()
      if (done) break
      output += decoder.decode(value, { stream: true })
    }
    output += decoder.decode()
    return output
  } finally {
    reader.releaseLock()
  }
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

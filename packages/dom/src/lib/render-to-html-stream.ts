import { createStreamingRenderer } from '@remix-run/reconciler'
import type { StreamingRenderValue } from '@remix-run/reconciler'
import { createHtmlStreamingPlugins } from './html-streaming-plugins.ts'
import { createHtmlStreamingPolicy } from './html-streaming-policy.ts'
import { HTML_STREAMING_FINALIZE_PREFIX, HTML_STREAMING_FINALIZE_SUFFIX } from './html-streaming-policy.ts'
import type { ResolveFrame } from './html-streaming-policy.ts'

export type RenderToHTMLStreamOptions = {
  onError?: (error: unknown) => void
  signal?: AbortSignal
  resolveFrame?: ResolveFrame
}

export function renderToHTMLStream(
  value: null | StreamingRenderValue,
  options: RenderToHTMLStreamOptions = {},
): ReadableStream<Uint8Array> {
  let renderer!: ReturnType<typeof createStreamingRenderer<Uint8Array>>
  let renderFrameValueToString = async (
    frameValue: null | StreamingRenderValue,
    signal: AbortSignal,
  ) => {
    let frameRoot = renderer.createRoot(frameValue)
    signal.addEventListener('abort', () => frameRoot.abort(signal.reason), { once: true })
    let stream = createFinalizedHtmlStream(frameRoot.stream())
    return readStreamToString(stream)
  }
  renderer = createStreamingRenderer({
    policy: createHtmlStreamingPolicy({
      resolveFrame: options.resolveFrame,
      renderFrameValueToString,
    }),
    plugins: createHtmlStreamingPlugins(),
  })
  let root = renderer.createRoot(value)
  if (options.onError) {
    root.addEventListener('error', (event: Event) => {
      let errorEvent = event as Event & { cause?: unknown }
      options.onError?.(errorEvent.cause ?? event)
    })
  }
  if (options.signal) {
    if (options.signal.aborted) {
      root.abort(options.signal.reason)
    } else {
      options.signal.addEventListener(
        'abort',
        () => {
          root.abort(options.signal?.reason)
        },
        { once: true },
      )
    }
  }
  return createFinalizedHtmlStream(root.stream())
}

async function readStreamToString(stream: ReadableStream<Uint8Array>) {
  let reader = stream.getReader()
  let decoder = new TextDecoder()
  let output = ''
  try {
    while (true) {
      let result = await reader.read()
      if (result.done) break
      output += decoder.decode(result.value, { stream: true })
    }
    output += decoder.decode()
    return output
  } finally {
    reader.releaseLock()
  }
}

function createFinalizedHtmlStream(source: ReadableStream<Uint8Array>) {
  let encoder = new TextEncoder()
  let decoder = new TextDecoder()
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let reader = source.getReader()
      let output = ''
      let finalized = false
      try {
        while (true) {
          let result = await reader.read()
          if (result.done) break
          output += decoder.decode(result.value, { stream: true })
          if (!finalized) {
            let markerStart = output.indexOf(HTML_STREAMING_FINALIZE_PREFIX)
            if (markerStart === -1) continue
            let markerEnd = output.indexOf(HTML_STREAMING_FINALIZE_SUFFIX, markerStart)
            if (markerEnd === -1) continue
            let before = output.slice(0, markerStart)
            let encodedPayload = output.slice(
              markerStart + HTML_STREAMING_FINALIZE_PREFIX.length,
              markerEnd,
            )
            let after = output.slice(markerEnd + HTML_STREAMING_FINALIZE_SUFFIX.length)
            let payload = JSON.parse(decodeURIComponent(encodedPayload)) as {
              headHtml: string
              rmxDataScript: string
            }
            let html = applyFinalizeInsertions(before, payload.headHtml, payload.rmxDataScript)
            controller.enqueue(encoder.encode(html))
            controller.enqueue(encoder.encode(after))
            output = ''
            finalized = true
            continue
          }
          controller.enqueue(encoder.encode(output))
          output = ''
        }
        output += decoder.decode()
        if (output) {
          controller.enqueue(encoder.encode(output))
        }
        controller.close()
      } catch (error) {
        controller.error(error)
      } finally {
        reader.releaseLock()
      }
    },
  })
}

function applyFinalizeInsertions(mainHtml: string, headHtml: string, rmxDataScript: string) {
  let html = mainHtml
  let hasHtmlRoot = html.trimStart().toLowerCase().startsWith('<html')
  if (headHtml) {
    if (hasHtmlRoot) {
      let headCloseIndex = html.indexOf('</head>')
      if (headCloseIndex !== -1) {
        html = html.slice(0, headCloseIndex) + headHtml + html.slice(headCloseIndex)
      } else {
        let htmlOpenMatch = html.match(/<html[^>]*>/i)
        if (htmlOpenMatch) {
          let insertIndex = (htmlOpenMatch.index ?? 0) + htmlOpenMatch[0].length
          html = html.slice(0, insertIndex) + `<head>${headHtml}</head>` + html.slice(insertIndex)
        }
      }
    } else {
      html = `<head>${headHtml}</head>${html}`
      hasHtmlRoot = false
    }
  }
  if (rmxDataScript) {
    if (hasHtmlRoot) {
      let bodyCloseIndex = html.indexOf('</body>')
      if (bodyCloseIndex !== -1) {
        html = html.slice(0, bodyCloseIndex) + rmxDataScript + html.slice(bodyCloseIndex)
      } else {
        let htmlCloseIndex = html.indexOf('</html>')
        if (htmlCloseIndex !== -1) {
          html = html.slice(0, htmlCloseIndex) + rmxDataScript + html.slice(htmlCloseIndex)
        }
      }
    } else {
      html += rmxDataScript
    }
  }
  return html
}

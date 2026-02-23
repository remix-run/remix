import { createStreamingRenderer } from '@remix-run/reconciler'
import type { StreamingRenderValue } from '@remix-run/reconciler'
import { createHtmlStreamingPlugins } from './html-streaming-plugins.ts'
import { createHtmlStreamingPolicy } from './html-streaming-policy.ts'
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
  let renderer = createStreamingRenderer({
    policy: createHtmlStreamingPolicy({ resolveFrame: options.resolveFrame }),
    plugins: createHtmlStreamingPlugins(),
  })
  let root = renderer.createRoot(value)
  if (options.onError) {
    root.addEventListener('error', (event) => {
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
  return root.stream()
}

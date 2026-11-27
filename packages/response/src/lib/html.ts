import { isSafeHtml, type SafeHtml } from '@remix-run/html-template'

const DOCTYPE = '<!DOCTYPE html>'
const DOCTYPE_SNIFF_BYTES = 64
const DOCTYPE_BYTES = new TextEncoder().encode(DOCTYPE)
const DEFAULT_HTML_HEADERS = { 'Content-Type': 'text/html; charset=UTF-8' }

type HtmlBody = string | SafeHtml | Blob | BufferSource | ReadableStream<Uint8Array>

/**
 * Creates an HTML [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response)
 * that ensures the response has a valid DOCTYPE and appropriate `Content-Type` header.
 *
 * @param body The body of the response
 * @param init The `ResponseInit` object for the response
 * @returns A `Response` object with a HTML body and the appropriate `Content-Type` header
 */
export function createHtmlResponse(body: HtmlBody, init?: ResponseInit): Response {
  let payload: BodyInit = ensureDoctype(body)

  if (init?.headers == null) {
    return new Response(
      payload,
      init ? { ...init, headers: DEFAULT_HTML_HEADERS } : { headers: DEFAULT_HTML_HEADERS },
    )
  }

  let headers = new Headers(init.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'text/html; charset=UTF-8')
  }

  return new Response(payload, { ...init, headers })
}

function ensureDoctype(body: HtmlBody): BodyInit {
  if (isSafeHtml(body)) {
    let str = String(body)
    return startsWithDoctype(str) ? str : DOCTYPE + str
  }

  if (typeof body === 'string') {
    return startsWithDoctype(body) ? body : DOCTYPE + body
  }

  if (body instanceof Blob) {
    return prependDoctypeToStream(body.stream())
  }

  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
    let text = new TextDecoder().decode(body)
    return startsWithDoctype(text) ? text : DOCTYPE + text
  }

  if (body instanceof ReadableStream) {
    return prependDoctypeToStream(body)
  }

  return body
}

function startsWithDoctype(str: string): boolean {
  return /^\s*<!doctype html/i.test(str)
}

function startsWithDoctypeBytes(bytes: Uint8Array): boolean {
  let decoder = new TextDecoder()
  let prefix = decoder.decode(bytes.subarray(0, DOCTYPE_SNIFF_BYTES), { stream: true })
  // Long leading whitespace or a partial declaration needs the rest of the chunk.
  if (bytes.length > DOCTYPE_SNIFF_BYTES && prefix.trimStart().length < '<!doctype html'.length) {
    prefix += decoder.decode(bytes.subarray(DOCTYPE_SNIFF_BYTES), { stream: true })
  }
  return startsWithDoctype(prefix)
}

function prependDoctypeToStream(stream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  let reader = stream.getReader()

  return new ReadableStream({
    async start(controller) {
      try {
        // Read first chunk to check for DOCTYPE
        let firstChunk = await reader.read()

        if (firstChunk.done) {
          // Empty stream, just add DOCTYPE (copy so consumers cannot mutate shared bytes)
          controller.enqueue(DOCTYPE_BYTES.slice())
          controller.close()
          return
        }

        // Check if the first chunk starts with DOCTYPE
        if (startsWithDoctypeBytes(firstChunk.value)) {
          // Already has DOCTYPE, pass through
          controller.enqueue(firstChunk.value)
        } else {
          // Combine DOCTYPE with the first chunk to avoid an extra write.
          let combined = new Uint8Array(DOCTYPE_BYTES.byteLength + firstChunk.value.byteLength)
          combined.set(DOCTYPE_BYTES, 0)
          combined.set(firstChunk.value, DOCTYPE_BYTES.byteLength)
          controller.enqueue(combined)
        }

        // Pass through remaining chunks
        while (true) {
          // Keep the result intact so TypeScript 7 can narrow value from done. The abortable UI
          // stream uses the same pattern.
          let result = await reader.read()
          if (result.done) break
          controller.enqueue(result.value)
        }

        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
    cancel(reason) {
      return reader.cancel(reason).catch(() => {})
    },
  })
}

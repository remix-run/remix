import { isSafeHtml, type SafeHtml } from '@remix-run/html-template'

const DOCTYPE = '<!DOCTYPE html>'

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

  let headers = new Headers(init?.headers)
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

function prependDoctypeToStream(stream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  let doctypeBytes = new TextEncoder().encode(DOCTYPE)
  let reader = stream.getReader()

  return new ReadableStream({
    async start(controller) {
      try {
        // Read first chunk to check for DOCTYPE
        let firstChunk = await reader.read()

        if (firstChunk.done) {
          // Empty stream, just add DOCTYPE
          controller.enqueue(doctypeBytes)
          controller.close()
          return
        }

        // Check if the first chunk starts with DOCTYPE
        let text = new TextDecoder().decode(firstChunk.value, { stream: true })
        if (startsWithDoctype(text)) {
          // Already has DOCTYPE, pass through
          controller.enqueue(firstChunk.value)
        } else {
          // Prepend DOCTYPE
          controller.enqueue(doctypeBytes)
          controller.enqueue(firstChunk.value)
        }

        // Pass through remaining chunks
        while (true) {
          let { done, value } = await reader.read()
          if (done) break
          controller.enqueue(value)
        }

        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
  })
}

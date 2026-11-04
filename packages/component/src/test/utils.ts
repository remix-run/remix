import type { TestContext } from '@remix-run/test'

import { invariant } from '../runtime/invariant.ts'
import { stripFlushMarkers } from '../runtime/stream-protocol.ts'

export type Assert<T extends true> = T

export type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false

export async function drain(stream: ReadableStream<Uint8Array>): Promise<string> {
  let reader = stream.getReader()
  let decoder = new TextDecoder()
  let html = ''

  while (true) {
    let { done, value } = await reader.read()
    if (done) break
    html += decoder.decode(value)
  }

  return stripFlushMarkers(html)
}

export async function renderNonceDocument(
  t: TestContext,
  html: string,
  completionMessage: string,
): Promise<Document> {
  // Each document needs fresh CSP and import-map state, including real script execution.
  let iframe = document.createElement('iframe')
  t.after(() => iframe.remove())
  let completed = new Promise<void>((resolve) => {
    function onMessage(event: MessageEvent) {
      if (event.source !== iframe.contentWindow || event.data !== completionMessage) return
      window.removeEventListener('message', onMessage)
      resolve()
    }
    window.addEventListener('message', onMessage, { signal: t.signal })
  })
  iframe.srcdoc = html
  document.body.append(iframe)
  await completed

  let doc = iframe.contentDocument
  invariant(doc)
  return doc
}

export function readChunks(stream: ReadableStream<Uint8Array>): AsyncGenerator<string, void, void> {
  let reader = stream.getReader()
  let decoder = new TextDecoder()

  return (async function* () {
    while (true) {
      let { done, value } = await reader.read()
      if (done) break
      yield decoder.decode(value)
    }
  })()
}

export function withResolvers<T = unknown>(): [
  Promise<T>,
  (value: T) => void,
  (error: unknown) => void,
] {
  let { promise, resolve, reject } = Promise.withResolvers<T>()
  return [promise, resolve, reject]
}

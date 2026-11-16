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
    html += decoder.decode(value, { stream: true })
  }
  html += decoder.decode()

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

// Collects unhandled rejections for the rest of the test. Browsers report unhandled rejections in
// the order the promises were rejected, so the returned function resolves once every rejection
// made before the call has been reported.
export function trackUnhandledRejections(t: TestContext): () => Promise<unknown[]> {
  let reasons: unknown[] = []
  let sentinels = new Map<unknown, () => void>()
  let controller = new AbortController()
  t.after(() => controller.abort())
  window.addEventListener(
    'unhandledrejection',
    (event) => {
      event.preventDefault()
      let resolve = sentinels.get(event.reason)
      if (resolve) resolve()
      else reasons.push(event.reason)
    },
    { signal: controller.signal },
  )
  return async () => {
    let sentinel = new Error('Unhandled rejection sentinel')
    let { promise, resolve } = Promise.withResolvers<void>()
    sentinels.set(sentinel, resolve)
    void Promise.reject(sentinel)
    await promise
    return reasons
  }
}

const domMutations: MutationObserverInit = {
  attributes: true,
  characterData: true,
  childList: true,
  subtree: true,
}

// Resolves once the DOM satisfies `predicate`, re-checking after each DOM mutation.
export function waitForDom(predicate: () => boolean, root: Node = document): Promise<void> {
  if (predicate()) return Promise.resolve()

  return new Promise((resolve) => {
    let observer = new MutationObserver(() => {
      if (!predicate()) return
      observer.disconnect()
      resolve()
    })
    observer.observe(root, domMutations)
  })
}

// Mutation observer callbacks run in creation order, so once this observer sees the next DOM
// mutation, every observer the runtime created earlier has already handled the same records.
export function nextDomMutation(root: Node = document): Promise<void> {
  return new Promise((resolve) => {
    let observer = new MutationObserver(() => {
      observer.disconnect()
      resolve()
    })
    observer.observe(root, domMutations)
  })
}

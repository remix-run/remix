import type { TestContext } from '@remix-run/test'
import { expect } from '@remix-run/assert'

import { invariant } from '../runtime/invariant.ts'
import { stripFlushMarkers } from '../runtime/stream-protocol.ts'

export function expectNodeOrder(actual: Iterable<Node>, expected: readonly Node[]): void {
  let nodes = Array.from(actual)
  expect(nodes.length).toBe(expected.length)
  for (let [index, node] of expected.entries()) expect(nodes[index]).toBe(node)
}

// Capture native browser state so a reorder cannot pass by restoring focus or
// reusing element objects after their browsing contexts and animations reset.
export async function prepareMoveState(t: TestContext, container: HTMLElement) {
  let iframe = container.querySelector('iframe')
  let input = container.querySelector('input')
  let animated = container.querySelector('[data-move-animation]')
  let dialog = container.querySelector('dialog')
  let popover = container.querySelector('[popover]')
  invariant(iframe && input && animated && dialog && popover instanceof HTMLElement)

  let loaded = new Promise<void>((resolve) => {
    iframe.addEventListener('load', () => resolve(), { once: true, signal: t.signal })
  })
  iframe.srcdoc = ''
  await loaded
  let iframeDocument = iframe.contentDocument
  invariant(iframeDocument)
  iframeDocument.body.dataset.state = 'retained'

  let style = document.createElement('style')
  style.textContent = `
    @keyframes rmx-move-test { from { opacity: 0.5 } to { opacity: 1 } }
    [data-move-animation] { animation: rmx-move-test 10s infinite }
  `
  document.head.append(style)
  t.after(() => style.remove())
  let animation = animated.getAnimations()[0]
  invariant(animation)
  animation.pause()
  await animation.ready
  animation.currentTime = 500

  dialog.showModal()
  popover.showPopover()
  input.value = 'Hello World'
  input.focus()
  input.setSelectionRange(6, 11)
  let blurCount = 0
  input.addEventListener('blur', () => blurCount++, { signal: t.signal })

  let observer = new MutationObserver(() => {})
  observer.observe(container, { childList: true, subtree: true })
  t.after(() => observer.disconnect())

  return () => {
    let removed = observer.takeRecords().flatMap((record) => Array.from(record.removedNodes))
    expect(removed.some((node) => node.contains(iframe))).toBe(true)
    expect(iframe.contentDocument).toBe(iframeDocument)
    expect(iframe.contentDocument?.body.dataset.state).toBe('retained')
    expect(animated.getAnimations()[0]).toBe(animation)
    expect(animation.currentTime).toBe(500)
    expect(animation.playState).toBe('paused')
    expect(dialog.matches(':modal')).toBe(true)
    expect(popover.matches(':popover-open')).toBe(true)
    expect(document.activeElement).toBe(input)
    expect(blurCount).toBe(0)
    expect(input.value).toBe('Hello World')
    expect(input.selectionStart).toBe(6)
    expect(input.selectionEnd).toBe(11)
  }
}

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

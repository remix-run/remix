import * as assert from 'remix/assert'
import { describe, it, type TestContext } from 'remix/test'
import { on, type Handle } from 'remix/ui'
import { render, type RenderResult } from 'remix/ui/test'

import { LazyFrame } from './lazy-frame.tsx'

describe('LazyFrame', () => {
  it('loads only the intersecting Frame once and keeps sibling hosts observed', async (t) => {
    let observers = captureIntersectionObservers(t)
    let requests: string[] = []
    let result = render(
      <div>
        <LazyFrame src="/frames/one" pauseAnimationsWhenInactive>
          <span data-placeholder="one">Waiting for one</span>
        </LazyFrame>
        <LazyFrame src="/frames/two" pauseAnimationsWhenInactive>
          <span data-placeholder="two">Waiting for two</span>
        </LazyFrame>
        <LazyFrame src="/frames/three" rootMargin="640px 0px">
          <span data-placeholder="three">Waiting for three</span>
        </LazyFrame>
      </div>,
      {
        frameInit: {
          resolveFrame(src) {
            requests.push(src)
            return <p>{src}</p>
          },
        },
      },
    )
    t.after(result.cleanup)

    assert.equal(observers.length, 3)

    let defaultLoadObserver = findObserver(observers, '320px 0px')
    let customLoadObserver = findObserver(observers, '640px 0px')
    let activityObserver = findObserver(observers, '0px 0px 0px 0px')
    let oneHost = findHost(result, 'one')
    let twoHost = findHost(result, 'two')

    assert.equal(defaultLoadObserver.targets.size, 2)
    assert.equal(customLoadObserver.targets.size, 1)
    assert.equal(activityObserver.targets.size, 2)

    await result.act(() => defaultLoadObserver.intersect(oneHost, true))

    assert.deepEqual(requests, ['/frames/one'])
    assert.equal(defaultLoadObserver.targets.has(oneHost), false)
    assert.equal(defaultLoadObserver.targets.has(twoHost), true)
    assert.equal(result.container.textContent?.includes('Waiting for two'), true)
    assert.equal(result.container.textContent?.includes('Waiting for three'), true)

    await result.act(() => defaultLoadObserver.intersect(oneHost, true))
    assert.deepEqual(requests, ['/frames/one'])

    result.cleanup()

    assert.equal(defaultLoadObserver.targets.size, 0)
    assert.equal(customLoadObserver.targets.size, 0)
    assert.equal(activityObserver.targets.size, 0)
    assert.equal(defaultLoadObserver.disconnected, true)
    assert.equal(customLoadObserver.disconnected, true)
    assert.equal(activityObserver.disconnected, true)
  })

  it('keeps observing siblings when one host is removed', async (t) => {
    let observers = captureIntersectionObservers(t)
    let requests: string[] = []
    let result = render(<RemovableLazyFrames />, {
      frameInit: {
        resolveFrame(src) {
          requests.push(src)
          return <p>{src}</p>
        },
      },
    })
    t.after(result.cleanup)

    let loadObserver = findObserver(observers, '320px 0px')
    let oneHost = findHost(result, 'one')
    let twoHost = findHost(result, 'two')

    assert.equal(loadObserver.targets.size, 2)

    await result.act(() => result.$('button')?.click())

    assert.equal(loadObserver.targets.has(oneHost), false)
    assert.equal(loadObserver.targets.has(twoHost), true)
    assert.equal(loadObserver.disconnected, false)

    await result.act(() => loadObserver.intersect(twoHost, true))

    assert.deepEqual(requests, ['/frames/two'])
    assert.equal(loadObserver.targets.size, 0)
    assert.equal(loadObserver.disconnected, true)
  })

  it('pauses and resumes each host independently without remounting its Frame', async (t) => {
    let observers = captureIntersectionObservers(t)
    let requests: string[] = []
    let result = render(
      <div>
        <LazyFrame src="/frames/one" pauseAnimationsWhenInactive>
          <span data-placeholder="one">Waiting for one</span>
        </LazyFrame>
        <LazyFrame src="/frames/two" pauseAnimationsWhenInactive>
          <span data-placeholder="two">Waiting for two</span>
        </LazyFrame>
      </div>,
      {
        frameInit: {
          resolveFrame(src) {
            requests.push(src)
            return <p>{src}</p>
          },
        },
      },
    )
    t.after(result.cleanup)

    let loadObserver = findObserver(observers, '320px 0px')
    let activityObserver = findObserver(observers, '0px 0px 0px 0px')
    let oneHost = findHost(result, 'one')
    let twoHost = findHost(result, 'two')
    let pausedClassName = oneHost.className

    assert.match(pausedClassName, /rmxc-/)
    assert.equal(twoHost.className, pausedClassName)

    await result.act(() => {
      loadObserver.intersect(oneHost, true)
      loadObserver.intersect(twoHost, true)
    })
    assert.deepEqual(requests, ['/frames/one', '/frames/two'])

    await result.act(() => activityObserver.intersect(oneHost, true))

    assert.notEqual(oneHost.className, pausedClassName)
    assert.equal(twoHost.className, pausedClassName)
    assert.deepEqual(requests, ['/frames/one', '/frames/two'])

    await result.act(() => {
      activityObserver.intersect(oneHost, false)
      activityObserver.intersect(twoHost, true)
    })

    assert.equal(oneHost.className, pausedClassName)
    assert.notEqual(twoHost.className, pausedClassName)
    assert.deepEqual(requests, ['/frames/one', '/frames/two'])
  })
})

function RemovableLazyFrames(handle: Handle) {
  let showOne = true

  return () => (
    <div>
      <button
        mix={on('click', () => {
          showOne = false
          handle.update()
        })}
      >
        Remove one
      </button>
      {showOne && (
        <LazyFrame key="one" src="/frames/one">
          <span data-placeholder="one">Waiting for one</span>
        </LazyFrame>
      )}
      <LazyFrame key="two" src="/frames/two">
        <span data-placeholder="two">Waiting for two</span>
      </LazyFrame>
    </div>
  )
}

function captureIntersectionObservers(t: TestContext): TestIntersectionObserver[] {
  let originalIntersectionObserver = globalThis.IntersectionObserver
  let observers: TestIntersectionObserver[] = []

  globalThis.IntersectionObserver = class extends TestIntersectionObserver {
    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      super(callback, options)
      observers.push(this)
    }
  }
  t.after(() => {
    globalThis.IntersectionObserver = originalIntersectionObserver
  })

  return observers
}

function findObserver(
  observers: TestIntersectionObserver[],
  rootMargin: string,
): TestIntersectionObserver {
  let observer = observers.find((candidate) => candidate.rootMargin === rootMargin)
  assert.ok(observer)
  return observer
}

function findHost(result: RenderResult, placeholder: string): HTMLElement {
  let child = result.$(`[data-placeholder="${placeholder}"]`)
  assert.ok(child)
  let host = child.parentElement
  assert.ok(host)
  return host
}

class TestIntersectionObserver implements IntersectionObserver {
  readonly delay = 0
  readonly root: Element | Document | null
  readonly rootMargin: string
  readonly scrollMargin = '0px 0px 0px 0px'
  readonly thresholds: readonly number[]
  readonly trackVisibility = false
  readonly targets = new Set<Element>()
  disconnected = false
  #callback: IntersectionObserverCallback

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.#callback = callback
    this.root = options?.root ?? null
    this.rootMargin = options?.rootMargin ?? '0px 0px 0px 0px'
    this.thresholds = Array.isArray(options?.threshold)
      ? options.threshold
      : [options?.threshold ?? 0]
  }

  disconnect() {
    this.disconnected = true
    this.targets.clear()
  }

  intersect(target: Element, isIntersecting: boolean) {
    if (!this.targets.has(target)) return

    let rect = target.getBoundingClientRect()
    this.#callback(
      [
        {
          boundingClientRect: rect,
          intersectionRatio: isIntersecting ? 1 : 0,
          intersectionRect: isIntersecting ? rect : new DOMRectReadOnly(),
          isIntersecting,
          rootBounds: null,
          target,
          time: performance.now(),
        },
      ],
      this,
    )
  }

  observe(target: Element) {
    this.disconnected = false
    this.targets.add(target)
  }

  takeRecords(): IntersectionObserverEntry[] {
    return []
  }

  unobserve(target: Element) {
    this.targets.delete(target)
  }
}

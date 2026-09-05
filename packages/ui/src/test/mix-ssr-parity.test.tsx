import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import type { RemixNode } from '../runtime/component.ts'
import { createMixin } from '../index.ts'
import { MAX_MIX_DESCRIPTORS } from '../runtime/core/mix.ts'
import { createRoot } from '../runtime/vdom.ts'
import { renderToString } from '../server/stream.ts'
import { invariant } from '../runtime/invariant.ts'

function getClientAttributes(element: RemixNode): Record<string, string> {
  let container = document.createElement('div')
  let root = createRoot(container)
  root.render(element)
  root.flush()
  let div = container.querySelector('div')
  invariant(div)
  let attributes = collectAttributes(div)
  root.dispose()
  return attributes
}

async function getServerAttributes(element: RemixNode): Promise<Record<string, string>> {
  let html = await renderToString(element)
  let container = document.createElement('div')
  container.innerHTML = html
  let div = container.querySelector('div')
  invariant(div)
  return collectAttributes(div)
}

function collectAttributes(element: Element): Record<string, string> {
  let attributes: Record<string, string> = {}
  for (let attribute of Array.from(element.attributes)) {
    attributes[attribute.name] = attribute.value
  }
  return attributes
}

async function expectParity(element: RemixNode, expected: Record<string, string>) {
  expect(getClientAttributes(element)).toEqual(expected)
  expect(await getServerAttributes(element)).toEqual(expected)
}

describe('mixin composition ssr/client parity', () => {
  it('composes mixins in order with the same result on both sides', async () => {
    let withTitle = createMixin((handle) => (title: string, props: { title?: string }) => (
      <handle.element {...props} title={title} />
    ))
    let appendTitle = createMixin((handle) => (suffix: string, props: { title?: string }) => (
      <handle.element {...props} title={`${props.title ?? ''}${suffix}`} />
    ))

    await expectParity(<div id="host" mix={[withTitle('hello'), appendTitle('-world')]} />, {
      id: 'host',
      title: 'hello-world',
    })
  })

  it('expands nested mix descriptors identically', async () => {
    let withData = createMixin((handle) => (value: string, props: { ['data-mixed']?: string }) => (
      <handle.element {...props} data-mixed={value} />
    ))
    let withNested = createMixin(
      (handle) => (value: string, props: { ['data-mixed']?: string }) => (
        <handle.element {...props} mix={[withData(value)]} />
      ),
    )

    await expectParity(<div mix={[withNested('nested')]} />, { 'data-mixed': 'nested' })
  })

  it('expands descriptors returned directly from a mixin identically', async () => {
    let withData = createMixin((handle) => (value: string, props: { ['data-mixed']?: string }) => (
      <handle.element {...props} data-mixed={value} />
    ))
    let returnsMoreMixins = createMixin<Element, [string]>(() => (value, _props) => [
      withData(value),
    ])

    await expectParity(<div mix={[returnsMoreMixins('returned')]} />, { 'data-mixed': 'returned' })
  })

  it('strips children and innerHTML from mixin-visible props on both sides', async () => {
    let sawTreeProps = false
    let inspect = createMixin(() => (props: Record<string, unknown>) => {
      if ('children' in props || 'innerHTML' in props) sawTreeProps = true
    })

    await expectParity(<div mix={[inspect()]}>child</div>, {})
    expect(sawTreeProps).toBe(false)
  })

  it('ignores falsy mix entries identically', async () => {
    let withTitle = createMixin((handle) => (title: string, props: { title?: string }) => (
      <handle.element {...props} title={title} />
    ))

    await expectParity(<div mix={[null, false, withTitle('kept')] as any} />, { title: 'kept' })
  })

  it('treats an unused mixin element function result as a no-op on both sides', async (t) => {
    let errorSpy = t.mock.method(console, 'error', () => {})
    let returnsElementFunction = createMixin((handle) => () => handle.element)

    await expectParity(<div id="host" mix={[returnsElementFunction()]} />, { id: 'host' })
    expect(errorSpy).toHaveBeenCalledTimes(0)
  })

  it('drops a mixin result with a mismatched host type on both sides', async (t) => {
    let errorSpy = t.mock.method(console, 'error', () => {})
    let wrongHost = createMixin(() => () => <span title="bad" />)

    await expectParity(<div id="host" mix={[wrongHost()]} />, { id: 'host' })
    expect(errorSpy).toHaveBeenCalledTimes(2)
    for (let call of errorSpy.mock.calls) {
      let error = call.arguments[0]
      invariant(error instanceof Error)
      expect(error.message).toBe('mixins must return an element with the same host type')
    }
  })

  it('drops a mixin result that is not a remix element on both sides', async (t) => {
    let errorSpy = t.mock.method(console, 'error', () => {})
    let wrongResult = createMixin(() => () => ({ title: 'bad' }) as any)

    await expectParity(<div id="host" mix={[wrongResult()]} />, { id: 'host' })
    expect(errorSpy).toHaveBeenCalledTimes(2)
    for (let call of errorSpy.mock.calls) {
      let error = call.arguments[0]
      invariant(error instanceof Error)
      expect(error.message).toBe('mixins must return a remix element')
    }
  })

  it('caps runaway descriptor expansion identically on both sides', async () => {
    let clientRuns = 0
    let recurse: () => any = null as never
    let recursiveMixin = createMixin(() => () => {
      clientRuns++
      return [recurse()]
    })
    recurse = () => recursiveMixin()

    let element = <div mix={[recursiveMixin()]} />

    getClientAttributes(element)
    expect(clientRuns).toBe(MAX_MIX_DESCRIPTORS)

    clientRuns = 0
    await getServerAttributes(element)
    expect(clientRuns).toBe(MAX_MIX_DESCRIPTORS)
  })

  it('isolates a throwing mixin during ssr but aborts the render on the client', async (t) => {
    let errorSpy = t.mock.method(console, 'error', () => {})
    let boom = createMixin(() => () => {
      throw new Error('mixin boom')
    })
    let withTitle = createMixin((handle) => (title: string, props: { title?: string }) => (
      <handle.element {...props} title={title} />
    ))

    let element = <div mix={[boom(), withTitle('ok')]} />

    // The server isolates the failure so one bad mixin cannot take down the
    // stream; mixins after it still apply.
    expect(await getServerAttributes(element)).toEqual({ title: 'ok' })
    expect(errorSpy).toHaveBeenCalledTimes(1)
    let error = errorSpy.mock.calls[0]?.arguments[0]
    invariant(error instanceof Error)
    expect(error.message).toBe('mixin boom')

    // The client deliberately does not: the error aborts the element's
    // render and surfaces through the root error event.
    let container = document.createElement('div')
    let root = createRoot(container)
    let forwarded: unknown
    root.addEventListener('error', (event) => {
      forwarded = event.error
    })
    try {
      root.render(element)
      root.flush()
    } finally {
      root.dispose()
    }
    invariant(forwarded instanceof Error)
    expect(forwarded.message).toBe('mixin boom')
    expect(container.querySelector('div[title="ok"]')).toBe(null)
  })
})

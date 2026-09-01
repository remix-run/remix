import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import type { RemixNode } from '../runtime/component.ts'
import { createMixin } from '../index.ts'
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
})

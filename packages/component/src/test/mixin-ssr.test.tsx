import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { createMixin, createRoot, on, ref } from '../index.ts'
import type { ElementProps, MixinHandle, MixinOptions } from '../index.ts'
import { renderToString } from '../server/stream.ts'
import { invariant } from '../runtime/invariant.ts'

describe('createMixin server rendering options', () => {
  it('keeps options separate for factories using the same setup function', async () => {
    let setups = 0
    let rendered: string[] = []
    function setup(handle: MixinHandle) {
      setups++
      return (title: string, props: ElementProps) => {
        rendered.push(title)
        return <handle.element {...props} title={title} />
      }
    }
    let normal = createMixin(setup)
    let browser = createMixin(setup, { ssr: false })
    let server = createMixin(setup, { ssr: true })

    let html = await renderToString(
      <>
        <div mix={normal('default')} />
        <div mix={browser('browser')} />
        <div mix={server('enabled')} />
      </>,
    )

    expect(html).toBe('<div title="default"></div><div></div><div title="enabled"></div>')
    expect(setups).toBe(2)
    expect(rendered).toEqual(['default', 'enabled'])
  })

  it('reads options when the factory is created', async () => {
    let setups = 0
    let options: MixinOptions = { ssr: false }
    let browser = createMixin(() => {
      setups++
    }, options)
    options.ssr = true

    expect(await renderToString(<div mix={browser()} />)).toBe('<div></div>')
    expect(setups).toBe(0)
  })

  it('can enable server rendering when reusing a browser-only descriptor setup', async () => {
    let setups = 0
    let browser = createMixin(
      (handle) => {
        setups++
        return () => <handle.element title="enabled" />
      },
      { ssr: false },
    )
    let normal = createMixin(browser().type)
    let enabled = createMixin(browser().type, { ssr: true })

    expect(await renderToString(<div mix={normal()} />)).toBe('<div title="enabled"></div>')
    expect(await renderToString(<div mix={enabled()} />)).toBe('<div title="enabled"></div>')
    expect(await renderToString(<div mix={browser()} />)).toBe('<div></div>')
    expect(setups).toBe(2)
  })

  it('preserves host content with conditional and nested browser-only mixins', async () => {
    let setups = 0
    let browser = createMixin(
      () => {
        setups++
        return () => {
          throw new Error('browser render should be skipped')
        }
      },
      { ssr: false },
    )

    let html = await renderToString(
      <div id="host" title="unchanged" mix={[false, [browser(), null, browser()]]}>
        Child content
      </div>,
    )

    expect(html).toBe('<div id="host" title="unchanged">Child content</div>')
    expect(setups).toBe(0)
  })

  it('keeps server mixins in order around browser-only mixins', async () => {
    let setups = 0
    let browser = createMixin(
      () => {
        setups++
      },
      { ssr: false },
    )
    let title = createMixin((handle) => (value: string, props: ElementProps) => (
      <handle.element {...props} title={value} />
    ))
    let suffix = createMixin((handle) => (value: string, props: ElementProps) => (
      <handle.element {...props} title={`${props.title}${value}`} />
    ))

    let html = await renderToString(
      <div mix={[browser(), title('hello'), browser(), suffix('-world'), browser()]} />,
    )

    expect(html).toBe('<div title="hello-world"></div>')
    expect(setups).toBe(0)
  })

  it('skips browser-only descriptors returned by server mixins', async () => {
    let setups = 0
    let browser = createMixin(
      () => {
        setups++
      },
      { ssr: false },
    )
    let title = createMixin((handle) => (props: ElementProps) => (
      <handle.element {...props} title="nested" />
    ))
    let nested = createMixin(() => () => [browser(), [false, title(), browser()]])

    expect(await renderToString(<div mix={nested()} />)).toBe('<div title="nested"></div>')
    expect(setups).toBe(0)
  })

  it('skips browser-only mixins added through handle.element', async () => {
    let setups = 0
    let browser = createMixin(
      () => {
        setups++
      },
      { ssr: false },
    )
    let nested = createMixin((handle) => (props: ElementProps) => (
      <handle.element {...props} title="nested" mix={browser()} />
    ))

    expect(await renderToString(<div mix={nested()} />)).toBe('<div title="nested"></div>')
    expect(setups).toBe(0)
  })

  it('initializes browser-only mixins during hydration and keeps their lifecycle', async () => {
    let setups = 0
    let calls: string[] = []
    let browser = createMixin<HTMLButtonElement, [label: string]>(
      (handle, type) => {
        setups++
        expect(type).toBe('button')
        handle.addEventListener('insert', () => calls.push('insert'))
        handle.addEventListener('remove', () => calls.push('remove'))
        return (label) =>
          on('click', () => {
            calls.push(label)
          })
      },
      { ssr: false },
    )
    let container = document.createElement('div')
    container.innerHTML = await renderToString(<button mix={browser('first')}>Click</button>)
    expect(setups).toBe(0)
    let button = container.querySelector('button')
    invariant(button)
    let root = createRoot(container)
    try {
      root.render(<button mix={browser('first')}>Click</button>)
      root.flush()
      expect(container.querySelector('button')).toBe(button)
      button.click()

      root.render(<button mix={browser('second')}>Click</button>)
      root.flush()
      button.click()

      expect(setups).toBe(1)
      expect(calls).toEqual(['insert', 'first', 'second'])
    } finally {
      root.dispose()
    }
    expect(calls).toEqual(['insert', 'first', 'second', 'remove'])
  })

  it('keeps on and ref working together after hydration', async () => {
    let clicks = 0
    let nodes: Element[] = []
    let container = document.createElement('div')
    function button() {
      return (
        <button
          mix={[
            on('click', () => {
              clicks++
            }),
            ref((node) => nodes.push(node)),
          ]}
        >
          Click
        </button>
      )
    }
    container.innerHTML = await renderToString(button())
    expect(nodes).toEqual([])
    let root = createRoot(container)
    try {
      root.render(button())
      root.flush()
      let node = container.querySelector('button')
      invariant(node)
      expect(nodes).toEqual([node])
      node.click()
      expect(clicks).toBe(1)
    } finally {
      root.dispose()
    }
  })
})

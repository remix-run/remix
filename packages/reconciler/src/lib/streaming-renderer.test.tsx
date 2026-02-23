import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createStreamingRenderer } from './streaming-renderer.ts'
import { defineStreamingPlugin } from './types.ts'
import type { StreamingPolicy } from './types.ts'

type ElementState = {
  type: string
}

let testPolicy: StreamingPolicy<string, void, ElementState> = {
  beginElement(input) {
    let attrs = ''
    for (let key in input.props) {
      if (key === 'children' || key === 'innerHTML') continue
      attrs += ` ${key}="${String(input.props[key])}"`
    }
    return {
      state: { type: input.type },
      open: `<${input.type}${attrs}>`,
      body: typeof input.props.innerHTML === 'string' ? String(input.props.innerHTML) : undefined,
      skipChildren: typeof input.props.innerHTML === 'string',
    }
  },
  text(value) {
    return value
  },
  endElement(state) {
    return `</${state.type}>`
  },
}

describe('createStreamingRenderer', () => {
  it('streams sync and async render values', async () => {
    let renderer = createStreamingRenderer({
      policy: testPolicy,
    })
    let root = renderer.createRoot(
      <root>
        <title>hello</title>
        {Promise.resolve(<tail>later</tail>)}
      </root>,
    )
    let html = await root.toString()
    assert.equal(html, '<root><title>hello</title><tail>later</tail></root>')
  })

  it('runs streaming plugins to transform props', async () => {
    let plugin = defineStreamingPlugin({
      phase: 'special',
      keys: ['flag'],
      shouldActivate(context) {
        return context.delta.nextProps.flag === true
      },
      setup() {
        return {
          commit(context) {
            let props = context.remainingPropsView()
            delete props.flag
            context.replaceProps({
              ...props,
              'data-flag': 'on',
            })
            context.consume('flag')
          },
        }
      },
    })
    let renderer = createStreamingRenderer({
      policy: testPolicy,
      plugins: [plugin],
    })
    let root = renderer.createRoot(<item flag={true} />)
    let html = await root.toString()
    assert.equal(html, '<item data-flag="on"></item>')
  })

  it('aborts pending async rendering', async () => {
    let resolveValue = (_value: unknown) => {}
    let pending = new Promise((resolve) => {
      resolveValue = resolve
    })
    let renderer = createStreamingRenderer({
      policy: testPolicy,
    })
    let root = renderer.createRoot(
      <root>
        <a>first</a>
        {pending}
      </root>,
    )
    let reader = root.stream().getReader()
    root.abort(new Error('stopped'))
    await assert.rejects(async () => {
      while (true) {
        let result = await reader.read()
        if (result.done) break
      }
    }, /stopped/)
    resolveValue(<b>ignored</b>)
  })

  it('supports readable stream consumption', async () => {
    let renderer = createStreamingRenderer({
      policy: testPolicy,
    })
    let root = renderer.createRoot(<x>y</x>)
    let reader = root.stream().getReader()
    let chunks: string[] = []
    while (true) {
      let result = await reader.read()
      if (result.done) break
      chunks.push(result.value)
    }
    assert.equal(chunks.join(''), '<x>y</x>')
  })

  it('supports boundaries and deferred chunks', async () => {
    let renderer = createStreamingRenderer({
      policy: {
        resolveBoundary(input) {
          if (input.type !== 'frame') return null
          return {
            open: '<b-open>',
            fallback: input.props.fallback as any,
            close: '</b-close>',
            deferred: Promise.resolve('<b-deferred/>'),
          }
        },
        beginElement(input) {
          return { state: { type: input.type }, open: `<${input.type}>` }
        },
        text(value) {
          return value
        },
        endElement(state) {
          return `</${state.type}>`
        },
      },
    })
    let html = await renderer
      .createRoot(
        <root>
          <frame fallback={<p>wait</p>} />
        </root>,
      )
      .toString()
    assert.equal(html, '<root><b-open><p>wait</p></b-close></root><b-deferred/>')
  })

  it('reports deferred chunk errors', async () => {
    let renderer = createStreamingRenderer({
      policy: {
        resolveBoundary(input) {
          if (input.type !== 'frame') return null
          return {
            open: '<start>',
            close: '</end>',
            deferred: Promise.reject(new Error('deferred boom')),
          }
        },
        beginElement(input) {
          return { state: { type: input.type }, open: `<${input.type}>` }
        },
        text(value) {
          return value
        },
        endElement(state) {
          return `</${state.type}>`
        },
      },
    })
    let root = renderer.createRoot(<frame />)
    await assert.rejects(() => root.toString(), /deferred boom/)
  })

  it('supports iterable and async iterable chunk outputs', async () => {
    let renderer = createStreamingRenderer<string, void, ElementState>({
      policy: {
        beginElement(input) {
          async function* asyncClose() {
            yield `</${input.type}`
            yield '>'
          }
          return {
            state: { type: input.type },
            open: [`<${input.type}`, '>'],
            body: asyncClose(),
            skipChildren: true,
          }
        },
        text(value) {
          return value
        },
        endElement() {
          return undefined
        },
      },
    })
    let html = await renderer.createRoot(<x />).toString()
    assert.equal(html, '<x></x>')
  })

  it('supports Uint8Array chunk output and decoding in toString', async () => {
    let encoder = new TextEncoder()
    let renderer = createStreamingRenderer<Uint8Array, void, ElementState>({
      policy: {
        beginElement(input) {
          return {
            state: { type: input.type },
            open: encoder.encode(`<${input.type}>`),
          }
        },
        text(value) {
          return encoder.encode(value)
        },
        endElement(state) {
          return encoder.encode(`</${state.type}>`)
        },
      },
    })
    let html = await renderer.createRoot(<u8>ok</u8>).toString()
    assert.equal(html, '<u8>ok</u8>')
  })

  it('aborts while beginRoot is pending', async () => {
    let resolveRoot = () => {}
    let beginRootPending = new Promise<void>((resolve) => {
      resolveRoot = resolve
    })
    let renderer = createStreamingRenderer({
      policy: {
        async beginRoot() {
          await beginRootPending
        },
        beginElement(input) {
          return { state: { type: input.type }, open: `<${input.type}>` }
        },
        text(value) {
          return value
        },
        endElement(state) {
          return `</${state.type}>`
        },
      },
    })
    let root = renderer.createRoot(<a />)
    let pending = root.toString()
    root.abort(new Error('aborted early'))
    resolveRoot()
    await assert.rejects(() => pending, /aborted early/)
  })

  it('supports plugin factories and non-activating plugins', async () => {
    let activated = 0
    let removed = 0
    let renderer = createStreamingRenderer({
      policy: testPolicy,
      plugins: [
        () => ({
          phase: 'special',
          shouldActivate() {
            return false
          },
          setup() {
            activated++
            return {
              remove() {
                removed++
              },
            }
          },
        }),
      ],
    })
    let html = await renderer.createRoot(<x value="1" />).toString()
    assert.equal(html, '<x value="1"></x>')
    assert.equal(activated, 0)
    assert.equal(removed, 0)
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createStreamingRenderer } from './streaming-renderer.ts'
import { defineStreamingPlugin } from './types.ts'
import type { StreamingPolicy } from './types.ts'
import { RECONCILER_NODE_CHILDREN } from '../testing/jsx.ts'

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
            content: input.props.fallback as any,
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

  it('allows plugin factories to use empty streaming root facade', async () => {
    let seen = {
      toString: '',
      streamIsReadable: false,
    }
    let pendingToString: null | Promise<void> = null
    let renderer = createStreamingRenderer({
      policy: testPolicy,
      plugins: [
        (pluginRoot) => {
          let reader = pluginRoot.root.stream().getReader()
          seen.streamIsReadable = typeof reader.read === 'function'
          pendingToString = pluginRoot.root.toString().then((value) => {
            seen.toString = value
          })
          return {
            phase: 'special',
          }
        },
      ],
    })
    await renderer.createRoot(<x>y</x>).toString()
    await pendingToString
    assert.equal(seen.streamIsReadable, true)
    assert.equal(seen.toString, '')
  })

  it('decodes mixed Uint8Array and string chunk outputs', async () => {
    let encoder = new TextEncoder()
    let renderer = createStreamingRenderer<Uint8Array | string, void, ElementState>({
      policy: {
        beginElement(input) {
          return {
            state: { type: input.type },
            open: [encoder.encode(`<${input.type}>`), ''],
          }
        },
        text(value) {
          return value
        },
        endElement(state) {
          return [encoder.encode(`</${state.type}>`), '']
        },
      },
    })
    let html = await renderer.createRoot(<m>ok</m>).toString()
    assert.equal(html, '<m>ok</m>')
  })

  it('supports manual reconciler elements without cached children metadata', async () => {
    let renderer = createStreamingRenderer({
      policy: testPolicy,
    })
    let manualSingle = {
      $rmx: true as const,
      type: 'single',
      key: null,
      props: { children: 'one' },
    }
    let manualArray = {
      $rmx: true as const,
      type: 'array',
      key: null,
      props: { children: ['a', 'b'] },
    }
    let manualEmpty = {
      $rmx: true as const,
      type: 'empty',
      key: null,
      props: {},
    }
    let html = await renderer
      .createRoot([manualSingle as any, manualArray as any, manualEmpty as any])
      .toString()
    assert.equal(html, '<single>one</single><array>ab</array><empty></empty>')
  })

  it('tracks removed keys when plugins replace host props', async () => {
    let renderer = createStreamingRenderer({
      policy: testPolicy,
      plugins: [
        defineStreamingPlugin({
          phase: 'special',
          keys: ['remove-me'],
          shouldActivate() {
            return true
          },
          setup() {
            return {
              commit(context) {
                context.replaceProps({ keep: context.delta.nextProps.keep })
              },
            }
          },
        }),
      ],
    })
    let html = await renderer.createRoot(<x keep="yes" remove-me="nope" />).toString()
    assert.equal(html, '<x keep="yes"></x>')
  })

  it('prefers cached children metadata over props.children fallback', async () => {
    let renderer = createStreamingRenderer({
      policy: testPolicy,
    })
    let manualWithCache = {
      $rmx: true as const,
      type: 'node',
      key: null,
      props: { children: 'props-child' },
      [RECONCILER_NODE_CHILDREN]: ['cached-child'],
    }
    let html = await renderer.createRoot(manualWithCache as any).toString()
    assert.equal(html, '<node>cached-child</node>')
  })

  it('runs component queued tasks and exposes update signal', async () => {
    let queued = 0
    let updatePromise: null | Promise<AbortSignal> = null
    let Comp = (handle: any) => {
      updatePromise = handle.update()
      handle.queueTask(() => {
        queued++
      })
      return () => <tasked>ok</tasked>
    }
    let renderer = createStreamingRenderer({
      policy: testPolicy,
    })
    let html = await renderer.createRoot(<Comp />).toString()
    assert.equal(html, '<tasked>ok</tasked>')
    assert.equal(queued, 1)
    assert.ok(updatePromise)
    let signal = await updatePromise
    assert.equal(signal.aborted, false)
  })

  it('handles beginRoot promise rejection', async () => {
    let renderer = createStreamingRenderer({
      policy: {
        beginRoot() {
          return Promise.reject(new Error('beginRoot failed'))
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
    await assert.rejects(() => renderer.createRoot(<x />).toString(), /beginRoot failed/)
  })

  it('orders multiple streaming plugins by priority', async () => {
    let order: string[] = []
    let renderer = createStreamingRenderer({
      policy: testPolicy,
      plugins: [
        defineStreamingPlugin({
          phase: 'special',
          priority: 10,
          shouldActivate() {
            return true
          },
          setup() {
            return {
              commit() {
                order.push('late')
              },
            }
          },
        }),
        defineStreamingPlugin({
          phase: 'special',
          priority: -10,
          shouldActivate() {
            return true
          },
          setup() {
            return {
              commit() {
                order.push('early')
              },
            }
          },
        }),
      ],
    })
    await renderer.createRoot(<x />).toString()
    assert.deepEqual(order, ['early', 'late'])
  })

  it('exposes consume/isConsumed/remainingPropsView in streaming plugin context', async () => {
    let seen: Array<Record<string, unknown>> = []
    let renderer = createStreamingRenderer({
      policy: testPolicy,
      plugins: [
        defineStreamingPlugin({
          phase: 'special',
          keys: ['x', 'y'],
          shouldActivate() {
            return true
          },
          setup() {
            return {
              commit(context) {
                context.consume('x')
                context.replaceProps(context.remainingPropsView())
                seen.push({
                  xConsumed: context.isConsumed('x'),
                  yConsumed: context.isConsumed('y'),
                  remaining: context.remainingPropsView(),
                })
              },
            }
          },
        }),
      ],
    })
    let html = await renderer.createRoot(<ctx x="one" y="two" />).toString()
    assert.equal(html, '<ctx y="two"></ctx>')
    assert.deepEqual(seen, [{ xConsumed: true, yConsumed: false, remaining: { y: 'two' } }])
  })

  it('skips routed plugins whose keys are unchanged on mount routing', async () => {
    let runs: string[] = []
    let renderer = createStreamingRenderer({
      policy: testPolicy,
      plugins: [
        defineStreamingPlugin({
          phase: 'special',
          keys: ['a'],
          shouldActivate() {
            return true
          },
          setup() {
            return {
              commit() {
                runs.push('a')
              },
            }
          },
        }),
        defineStreamingPlugin({
          phase: 'special',
          keys: ['b'],
          shouldActivate() {
            return true
          },
          setup() {
            return {
              commit() {
                runs.push('b')
              },
            }
          },
        }),
      ],
    })
    await renderer.createRoot(<route a="yes" />).toString()
    assert.deepEqual(runs, ['a'])
  })

  it('runs plugin queued tasks during pending task flush', async () => {
    let queued = 0
    let renderer = createStreamingRenderer({
      policy: testPolicy,
      plugins: [
        defineStreamingPlugin({
          phase: 'special',
          shouldActivate() {
            return true
          },
          setup(handle) {
            handle.queueTask(() => {
              queued++
            })
            return null
          },
        }),
      ],
    })
    await renderer.createRoot(<queued />).toString()
    assert.equal(queued, 1)
  })
})

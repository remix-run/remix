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
})

import { strict as assert } from 'node:assert'
import { createHash } from 'node:crypto'
import { parseArgs } from 'node:util'
import { attrs, createElement, createMixin, on, ref } from '../src/index.ts'
import { renderToString } from '../src/server.ts'

async function main(): Promise<void> {
  let { values } = parseArgs({
    options: {
      case: { type: 'string', default: 'mixed' },
      size: { type: 'string', default: '100' },
      warmup: { type: 'string', default: '1' },
      duration: { type: 'string', default: '3' },
    },
  })
  let scenario = values.case
  assert.ok(['on', 'ref', 'browser-only', 'mixed'].includes(scenario))
  let size = Number(values.size)
  let warmup = Number(values.warmup)
  let duration = Number(values.duration)
  assert.ok(Number.isSafeInteger(size) && size > 0)
  assert.ok(Number.isFinite(warmup) && warmup > 0)
  assert.ok(Number.isFinite(duration) && duration > 0)

  let effects = createMixin<Element, [label: string]>(
    (handle) => {
      let label = ''
      handle.addEventListener('insert', ({ node }) => node.setAttribute('data-label', label))
      return (nextLabel) => {
        label = nextLabel
        return handle.element
      }
    },
    { ssr: false },
  )
  function noop(): void {}

  function tree() {
    let children = []
    for (let index = 0; index < size; index++) {
      let label = `Item ${index}`
      let mix =
        scenario === 'on'
          ? on<HTMLElement>('click', noop)
          : scenario === 'ref'
            ? ref(noop)
            : scenario === 'browser-only'
              ? effects(label)
              : [attrs({ title: label }), effects(label), on<HTMLElement>('click', noop), ref(noop)]
      children.push(createElement('div', { id: `item-${index}`, mix }, label))
    }
    return createElement('section', undefined, ...children)
  }

  async function run(seconds: number) {
    let renders = 0
    let html = ''
    let start = performance.now()
    do {
      html = await renderToString(tree())
      renders++
    } while (performance.now() - start < seconds * 1000)
    return { renders, elapsedMs: performance.now() - start, html }
  }

  let expected = await renderToString(tree())
  await run(warmup)
  globalThis.gc?.()
  let before = process.memoryUsage()
  let result = await run(duration)
  assert.equal(result.html, expected)
  let after = process.memoryUsage()
  globalThis.gc?.()
  let afterGc = globalThis.gc ? process.memoryUsage() : null
  console.log(
    JSON.stringify({
      node: process.version,
      scenario,
      size,
      warmup,
      duration,
      renders: result.renders,
      elapsedMs: result.elapsedMs,
      rendersPerSecond: (result.renders * 1000) / result.elapsedMs,
      htmlBytes: Buffer.byteLength(result.html),
      htmlSha256: createHash('sha256').update(result.html).digest('hex'),
      before,
      after,
      afterGc,
      maxRssKiB: process.resourceUsage().maxRSS,
    }),
  )
}

await main()

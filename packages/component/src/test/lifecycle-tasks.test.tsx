import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { createMixin, createRoot } from '../index.ts'
import type { Handle } from '../index.ts'

// Read phases must finish before rendering, and commit phases before queued host work.
describe('Mixin lifecycle tasks', () => {
  it('groups scheduler listeners before phase tasks and preserves host task ordering', (t) => {
    let calls: string[] = []
    let update: (() => void) | undefined
    let observe = createMixin((handle) => {
      handle.addEventListener('beforeUpdate', (event) => {
        calls.push('before')
        event.afterDispatch(() => calls.push(`read:${event.node.textContent}`))
      })
      handle.addEventListener('commit', (event) => {
        calls.push('commit')
        event.afterDispatch(() => calls.push(`measure:${event.node.textContent}`))
      })
      return () => handle.element
    })
    function App(handle: Handle) {
      let value = 0
      update = () => {
        handle.queueTask(() => calls.push('host task'))
        value++
        handle.update()
      }
      return () => (
        <section>
          <div mix={observe()}>{value}</div>
          <div mix={observe()}>{value}</div>
        </section>
      )
    }
    let container = document.createElement('div')
    let root = createRoot(container)
    t.after(() => root.dispose())
    root.render(<App />)
    root.flush()
    calls = []
    update?.()
    root.flush()
    assert.deepEqual(calls, [
      'before',
      'before',
      'read:0',
      'read:0',
      'commit',
      'commit',
      'measure:1',
      'measure:1',
      'host task',
    ])
  })

  it('groups inline commits before their tasks and before queued mixin work', (t) => {
    let calls: string[] = []
    let queues = new Set<(task: () => void) => void>()
    let observe = createMixin((handle) => {
      handle.addEventListener('commit', (event) => {
        calls.push('commit')
        queues.add(event.afterDispatch)
        event.afterDispatch(() => calls.push('measure'))
      })
      return () => {
        handle.queueTask(() => calls.push('host task'))
        return handle.element
      }
    })
    let container = document.createElement('div')
    let root = createRoot(container)
    t.after(() => root.dispose())
    root.render(
      <section>
        <div mix={observe()}>0</div>
        <div mix={observe()}>0</div>
      </section>,
    )
    root.flush()
    calls = []
    root.render(
      <section>
        <div mix={observe()}>1</div>
        <div mix={observe()}>1</div>
      </section>,
    )
    root.flush()
    assert.deepEqual(calls, ['commit', 'commit', 'measure', 'measure', 'host task', 'host task'])
    assert.equal(queues.size, 1)
  })
})

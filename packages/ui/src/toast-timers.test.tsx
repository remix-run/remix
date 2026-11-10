import * as assert from '@remix-run/assert'
import type { Handle } from '@remix-run/component'
import { render } from '@remix-run/component/test'
import { describe, it } from '@remix-run/test'
import type { TestContext } from '@remix-run/test'
import * as toast from './toast.tsx'

function clock(t: TestContext) {
  let timers = t.useFakeTimers()
  let now = 0
  t.mock.method(performance, 'now', () => now)
  return {
    advance(ms: number) {
      now += ms
      timers.advance(ms)
    },
  }
}

function Notifications<data>(handle: Handle<Omit<toast.ToastContextProps<data>, 'children'>>) {
  return () => (
    <toast.Context manager={handle.props.manager}>
      {(toastItems) => (
        <section mix={toast.root({ label: 'Notifications' })}>
          {toastItems.map((notification) => (
            <toast.ItemContext key={notification.id} value={notification.id}>
              <article key={notification.id} mix={toast.item()}>
                {notification.title}
              </article>
            </toast.ItemContext>
          ))}
        </section>
      )}
    </toast.Context>
  )
}

function region(container: ParentNode): HTMLElement {
  let node = container.querySelector('section')
  assert.ok(node instanceof HTMLElement)
  return node
}

describe('toast UI timers', () => {
  it('starts the full timeout when a buffered notification is presented', async (t) => {
    let time = clock(t)
    let manager = toast.createToastManager()
    manager.add({ title: 'Saved', timeout: 1000 })
    time.advance(10000)
    let result = render(<Notifications manager={manager} />)
    t.after(result.cleanup)
    await result.act(() => time.advance(999))
    assert.equal(manager.items.length, 1)
    await result.act(() => time.advance(1))
    assert.equal(manager.items.length, 0)
    assert.equal(result.container.querySelector('article'), null)
  })

  it('keeps existing and arriving clocks paused until overlapping UI conditions end', async (t) => {
    let time = clock(t)
    let manager = toast.createToastManager()
    manager.add({ id: 'first', timeout: 1000 })
    let result = render(<Notifications manager={manager} />)
    t.after(result.cleanup)
    let node = region(result.container)
    await result.act(() => time.advance(300))
    await result.act(() =>
      node.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' })),
    )
    await result.act(() => window.dispatchEvent(new Event('blur')))
    await result.act(() =>
      node.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' })),
    )
    await result.act(() => manager.add({ id: 'second', timeout: 1000 }))
    await result.act(() => time.advance(5000))
    assert.equal(manager.items.length, 2)
    await result.act(() => window.dispatchEvent(new Event('focus')))
    await result.act(() => time.advance(699))
    assert.equal(manager.items.length, 2)
    await result.act(() => time.advance(1))
    assert.deepEqual(
      manager.items.map((item) => item.id),
      ['second'],
    )
    await result.act(() => time.advance(300))
    assert.equal(manager.items.length, 0)
  })

  it('cancels clocks on unmount while retaining data and starts fresh clocks on remount', async (t) => {
    let time = clock(t)
    let manager = toast.createToastManager()
    manager.add({ title: 'Saved', timeout: 1000 })
    let first = render(<Notifications manager={manager} />)
    await first.act(() => time.advance(300))
    first.cleanup()
    time.advance(10000)
    assert.equal(manager.items.length, 1)
    let second = render(<Notifications manager={manager} />)
    t.after(second.cleanup)
    await second.act(() => time.advance(999))
    assert.equal(manager.items.length, 1)
    await second.act(() => time.advance(1))
    assert.equal(manager.items.length, 0)
  })

  it('keeps clocks paused after hover ends while keyboard focus remains in the region', async (t) => {
    let time = clock(t)
    let manager = toast.createToastManager()
    manager.add({ title: 'Saved', timeout: 1000 })
    let result = render(<Notifications manager={manager} />)
    t.after(result.cleanup)
    let node = region(result.container)
    await result.act(() => time.advance(100))
    await result.act(() =>
      node.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' })),
    )
    await result.act(() =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'F6', bubbles: true, cancelable: true }),
      ),
    )
    assert.equal(document.activeElement, node)
    await result.act(() =>
      node.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' })),
    )
    await result.act(() => time.advance(5000))
    assert.equal(manager.items.length, 1)
    await result.act(() =>
      node.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'F6', bubbles: true, cancelable: true }),
      ),
    )
    await result.act(() => time.advance(899))
    assert.equal(manager.items.length, 1)
    await result.act(() => time.advance(1))
    assert.equal(manager.items.length, 0)
  })

  it('restarts a replaced notification without allowing its previous clock to dismiss it', async (t) => {
    let time = clock(t)
    let manager = toast.createToastManager()
    manager.add({ id: 'saved', timeout: 1000 })
    let result = render(<Notifications manager={manager} />)
    t.after(result.cleanup)
    await result.act(() => time.advance(300))
    await result.act(() => manager.add({ id: 'saved', timeout: 1000 }))
    await result.act(() => time.advance(700))
    assert.equal(manager.items.length, 1)
    await result.act(() => time.advance(300))
    assert.equal(manager.items.length, 0)
  })

  it('does not let an expiring clock close a replacement before the UI updates', async (t) => {
    let time = clock(t)
    let manager = toast.createToastManager()
    manager.add({ id: 'saved', title: 'Original', timeout: 1000 })
    let result = render(<Notifications manager={manager} />)
    t.after(result.cleanup)
    await result.act(() => time.advance(999))
    await result.act(() => {
      manager.add({ id: 'saved', title: 'Replacement', timeout: 1000 })
      time.advance(1)
    })
    assert.equal(manager.items[0]?.title, 'Replacement')
    await result.act(() => time.advance(999))
    assert.equal(manager.items.length, 1)
    await result.act(() => time.advance(1))
    assert.equal(manager.items.length, 0)
  })

  it('keeps persistent items open and dismisses zero timeouts only when presented', async (t) => {
    let time = clock(t)
    let manager = toast.createToastManager()
    manager.add({ id: 'persistent' })
    manager.add({ id: 'immediate', timeout: 0 })
    time.advance(10000)
    assert.equal(manager.items.length, 2)
    let result = render(<Notifications manager={manager} />)
    t.after(result.cleanup)
    await result.act(() => time.advance(0))
    assert.deepEqual(
      manager.items.map((item) => item.id),
      ['persistent'],
    )
    await result.act(() => time.advance(10000))
    assert.equal(manager.items.length, 1)
  })
})

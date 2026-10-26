import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { on } from '@remix-run/component'
import { render } from '@remix-run/component/test'
import type { TestContext } from '@remix-run/test'
import { renderToString } from '@remix-run/component/server'
import { animateExit } from './animation.ts'
import { countdown, createToastManager, Context, root, ItemContext, item } from './toast.tsx'
import type { ToastManager, ToastOptions, ToastRecord } from './toast.tsx'

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

function first<action>(manager: ToastManager<action>): ToastRecord<action> {
  let toast = manager.toasts[0]
  assert.ok(toast)
  return toast
}

function element(container: ParentNode, selector: string): HTMLElement {
  let node = container.querySelector(selector)
  assert.ok(node instanceof HTMLElement)
  return node
}

describe('toast manager', () => {
  it('retains publications before a renderer subscribes or mounts', (t) => {
    let time = clock(t)
    let manager = createToastManager()
    let id = manager.add({ title: 'Saved', duration: 1000 })
    time.advance(10000)
    assert.equal(first(manager).id, id)
    assert.equal(first(manager).remaining, 1000)
    assert.equal(first(manager).presented, false)
    let presentation = new AbortController()
    manager.present(id, presentation.signal)
    assert.equal(first(manager).paused, false)
    time.advance(1000)
    assert.equal(manager.toasts.length, 0)
    presentation.abort()
  })

  it('merges duplicates in place and restarts the lifetime without losing presentation', (t) => {
    let time = clock(t)
    let manager = createToastManager()
    manager.add({ id: 'save', title: 'Saving', description: 'Settings', duration: 1000 })
    manager.add({ id: 'other', title: 'Other', duration: 0 })
    let presentation = new AbortController()
    manager.present('save', presentation.signal)
    time.advance(400)
    manager.add({ id: 'save', title: 'Saved' })
    assert.deepEqual(
      manager.toasts.map((toast) => toast.id),
      ['other', 'save'],
    )
    assert.equal(manager.toasts.find((toast) => toast.id === 'save')?.title, 'Saved')
    assert.equal(manager.toasts.find((toast) => toast.id === 'save')?.description, 'Settings')
    assert.equal(manager.toasts.find((toast) => toast.id === 'save')?.remaining, 1000)
    assert.equal(manager.toasts.find((toast) => toast.id === 'save')?.presented, true)
    time.advance(900)
    assert.equal(manager.toasts.find((toast) => toast.id === 'save')?.remaining, 100)
    presentation.abort()
    time.advance(1000)
    assert.equal(manager.toasts.find((toast) => toast.id === 'save')?.remaining, 100)
    manager.close()
  })

  it('composes independent pause reasons and applies them to new arrivals', (t) => {
    let time = clock(t)
    let manager = createToastManager()
    let hover = Symbol()
    let focus = Symbol()
    manager.pause(hover)
    let id = manager.add({ title: 'Saved', duration: 1000 })
    let presentation = new AbortController()
    manager.present(id, presentation.signal)
    manager.pause(focus)
    manager.resume(hover)
    time.advance(2000)
    assert.equal(first(manager).paused, true)
    assert.equal(first(manager).remaining, 1000)
    manager.resume(focus)
    time.advance(250)
    assert.equal(first(manager).remaining, 750)
    manager.pause(hover)
    manager.pause(hover)
    time.advance(1000)
    manager.resume(hover)
    time.advance(750)
    assert.equal(manager.toasts.length, 0)
    presentation.abort()
  })

  it('pauses while unpresented and resumes with the remaining lifetime', (t) => {
    let time = clock(t)
    let manager = createToastManager()
    let id = manager.add({ title: 'Saved', duration: 1000 })
    let firstMount = new AbortController()
    let secondMount = new AbortController()
    manager.present(id, firstMount.signal)
    manager.present(id, secondMount.signal)
    time.advance(300)
    firstMount.abort()
    assert.equal(first(manager).paused, false)
    secondMount.abort()
    time.advance(10000)
    assert.equal(first(manager).remaining, 700)
    let remount = new AbortController()
    manager.present(id, remount.signal)
    time.advance(700)
    assert.equal(manager.toasts.length, 0)
    remount.abort()
  })

  it('does not detach a new toast when an old presentation of the same identity aborts', () => {
    let manager = createToastManager()
    manager.add({ id: 'same', title: 'Old', duration: 0 })
    let old = new AbortController()
    manager.present('same', old.signal)
    manager.close('same')
    manager.add({ id: 'same', title: 'New', duration: 0 })
    let current = new AbortController()
    manager.present('same', current.signal)
    old.abort()
    assert.equal(first(manager).presented, true)
    current.abort()
    assert.equal(first(manager).presented, false)
  })

  it('updates content without extending the deadline', (t) => {
    let time = clock(t)
    let manager = createToastManager<{ label: string }>()
    let id = manager.add({ title: 'Uploading', duration: 1000 })
    let presentation = new AbortController()
    manager.present(id, presentation.signal)
    time.advance(800)
    manager.update(id, { title: 'Uploaded', description: 'Ready', action: { label: 'Open' } })
    assert.equal(first(manager).description, 'Ready')
    assert.equal(first(manager).priority, 'low')
    assert.equal(first(manager).remaining, 200)
    manager.update(id, { action: { label: 'View' } })
    assert.equal(first(manager).action?.label, 'View')
    time.advance(200)
    assert.equal(manager.toasts.length, 0)
    presentation.abort()
  })

  it('persists actions by default without inspecting arbitrary action values', () => {
    let manager = createToastManager<unknown>()
    manager.add({ title: 'Text' })
    manager.add({ title: 'Empty string action', action: '' })
    manager.add({ title: 'False action', action: false })
    manager.add({ title: 'Null action', action: null })
    manager.add({ title: 'Explicit timeout', action: {}, duration: 1000 })
    assert.deepEqual(
      manager.toasts.map((toast) => toast.duration),
      [1000, 5000, 0, 0, 5000],
    )
  })

  it('notifies state changes with native abortable subscriptions and immutable snapshots', () => {
    let manager = createToastManager()
    let subscription = new AbortController()
    let count = 0
    manager.addEventListener('change', () => count++, { signal: subscription.signal })
    manager.add({ id: 'save', title: 'Saving' })
    let snapshot = first(manager)
    manager.update('save', { title: 'Saved' })
    assert.equal(snapshot.title, 'Saving')
    assert.equal(Object.isFrozen(snapshot), true)
    assert.equal(count, 2)
    subscription.abort()
    manager.close()
    assert.equal(count, 2)
  })

  it('rejects invalid lifetimes before changing an existing record', () => {
    let manager = createToastManager()
    manager.add({ id: 'save', title: 'Saved' })
    assert.throws(() => manager.add({ id: 'save', title: 'Invalid', duration: -1 }), RangeError)
    assert.throws(() => manager.update('save', { duration: Infinity }), RangeError)
    assert.equal(first(manager).title, 'Saved')
  })
})

describe('toast.root()', () => {
  it('preserves custom and array action inference in the context render callback', async () => {
    interface Action {
      label: string
      run(): void
    }
    let notifications = createToastManager<Action[]>()
    function publish<action>(manager: ToastManager<action>, options: ToastOptions<action>) {
      return manager.add(options)
    }
    publish(notifications, { title: 'Saved', action: [{ label: 'Undo', run() {} }] })
    let html = await renderToString(
      <Context manager={notifications}>
        {(toasts) => (
          <section mix={root({ label: 'Notifications' })}>
            {toasts.map((toast) => (
              <div>
                {toast.action?.map((action) => (
                  <button mix={on('click', action.run)}>{action.label}</button>
                ))}
              </div>
            ))}
          </section>
        )}
      </Context>,
    )
    assert.match(html, /Undo/)
    assert.equal(first(notifications).presented, false)
  })

  it('presents buffered content, announces it, enters on F6, and restores focus on close', async (t) => {
    let notifications = createToastManager<{ label: string }>()
    let id = notifications.add({ title: 'File deleted', action: { label: 'Undo' } })
    let result = render(
      <>
        <button>Publish</button>
        <Context manager={notifications}>
          {(toasts) => (
            <section mix={root({ label: 'Notifications' })}>
              {toasts.map((toast) => (
                <ItemContext key={toast.id} toast={toast}>
                  <div key={toast.id} data-id={toast.id} mix={item()}>
                    <strong>{toast.title}</strong>
                    <button mix={on('click', () => notifications.close(toast.id))}>
                      {toast.action?.label}
                    </button>
                  </div>
                </ItemContext>
              ))}
            </section>
          )}
        </Context>
      </>,
    )
    t.after(result.cleanup)
    let publish = element(result.container, 'button')
    publish.focus()
    await result.act(() =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'F6', bubbles: true, cancelable: true }),
      ),
    )
    assert.equal(document.activeElement, element(result.container, '[role="region"]'))
    let undo = element(result.container, '[data-toast] button')
    undo.focus()
    assert.equal(first(notifications).paused, true)
    assert.equal(element(result.container, '[role="region"]').getAttribute('aria-live'), 'polite')
    await result.act(() => undo.click())
    assert.equal(document.activeElement, publish)
    assert.equal(notifications.toasts.length, 0)
    assert.equal(result.container.querySelector('[data-toast]'), null)
    assert.ok(id)
  })

  it('keeps focus pause after hover ends and returns from the region with F6', async (t) => {
    let notifications = createToastManager()
    notifications.add({ title: 'Saved', duration: 10000 })
    let result = render(
      <>
        <button>Publish</button>
        <Context manager={notifications}>
          {(toasts) => (
            <section mix={root({ label: 'Notifications' })}>
              {toasts.map((toast) => (
                <ItemContext key={toast.id} toast={toast}>
                  <div key={toast.id} data-id={toast.id} mix={item()}>
                    {toast.title}
                  </div>
                </ItemContext>
              ))}
            </section>
          )}
        </Context>
      </>,
    )
    t.after(result.cleanup)
    t.after(() => notifications.close())
    let publish = element(result.container, 'button')
    let region = element(result.container, '[role="region"]')
    publish.focus()
    await result.act(() =>
      region.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' })),
    )
    region.focus()
    await result.act(() =>
      region.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' })),
    )
    assert.equal(first(notifications).paused, true)
    await result.act(() =>
      region.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'F6', bubbles: true, cancelable: true }),
      ),
    )
    assert.equal(document.activeElement, publish)
    assert.equal(first(notifications).paused, false)
  })

  it('makes a logically closed toast inert while retaining its exit animation', async (t) => {
    let notifications = createToastManager()
    let id = notifications.add({ title: 'Saved', duration: 0 })
    let result = render(
      <Context manager={notifications}>
        {(toasts) => (
          <section mix={root({ label: 'Notifications' })}>
            {toasts.map((toast) => (
              <ItemContext key={toast.id} toast={toast}>
                <div
                  key={toast.id}
                  data-id={toast.id}
                  mix={[
                    item(),
                    animateExit({
                      opacity: 0,
                      duration: 200,
                    }),
                  ]}
                >
                  {toast.title}
                </div>
              </ItemContext>
            ))}
          </section>
        )}
      </Context>,
    )
    t.after(result.cleanup)
    let node = element(result.container, '[data-toast]')
    await result.act(() => notifications.close(id))
    assert.equal(notifications.toasts.length, 0)
    assert.equal(node.inert, true)
    assert.equal(node.getAttribute('aria-hidden'), 'true')
    assert.equal(node.isConnected, true)
    await Promise.all(node.getAnimations().map((animation) => animation.finished))
  })
})

describe('toast gestures and clocks', () => {
  it('expands the region on touch and collapses on an outside touch', async (t) => {
    let manager = createToastManager()
    manager.add({ title: 'Saved', duration: 1000 })
    let result = render(
      <Context manager={manager}>
        {(records) => (
          <section mix={root({ label: 'Notifications' })}>
            {records.map((record) => (
              <ItemContext key={record.id} toast={record}>
                <article key={record.id} data-id={record.id} mix={item()}>
                  {record.title}
                </article>
              </ItemContext>
            ))}
          </section>
        )}
      </Context>,
    )
    t.after(result.cleanup)
    let region = element(result.container, 'section')
    let card = element(region, 'article')
    await result.act(() =>
      card.dispatchEvent(
        new PointerEvent('pointerdown', {
          pointerType: 'touch',
          isPrimary: true,
          bubbles: true,
        }),
      ),
    )
    assert.equal(region.hasAttribute('data-expanded'), true)
    assert.equal(first(manager).paused, true)
    await result.act(() =>
      document.dispatchEvent(
        new PointerEvent('pointerdown', {
          pointerType: 'touch',
          isPrimary: true,
          bubbles: true,
        }),
      ),
    )
    assert.equal(region.hasAttribute('data-expanded'), false)
    assert.equal(first(manager).paused, false)
  })

  it('replaces countdown animations on pause, restart and persistent updates', async (t) => {
    let notifications = createToastManager()
    let id = notifications.add({ title: 'Saved', duration: 10000 })
    let result = render(
      <Context manager={notifications}>
        {(toasts) => (
          <section mix={root({ label: 'Notifications' })}>
            {toasts.map((toast) => (
              <ItemContext key={toast.id} toast={toast}>
                <div key={toast.id} data-id={toast.id} mix={item()}>
                  <div data-countdown mix={countdown(toast)} />
                </div>
              </ItemContext>
            ))}
          </section>
        )}
      </Context>,
    )
    t.after(result.cleanup)
    t.after(() => notifications.close())
    let bar = element(result.container, '[data-countdown]')
    assert.equal(bar.getAnimations().length, 1)
    let original = bar.getAnimations()[0]
    await result.act(() => notifications.pause('manual'))
    assert.equal(original.playState, 'idle')
    assert.equal(bar.getAnimations().length, 1)
    assert.equal(bar.getAnimations()[0].playState, 'paused')
    await result.act(() => notifications.resume('manual'))
    assert.equal(bar.getAnimations().length, 1)
    assert.equal(bar.getAnimations()[0].playState, 'running')
    await result.act(() => notifications.update(id, { duration: 20000 }))
    assert.equal(bar.getAnimations().length, 1)
    assert.ok(Number(bar.getAnimations()[0].effect?.getTiming().duration) > 19000)
    await result.act(() => notifications.update(id, { duration: 0 }))
    assert.equal(bar.hidden, true)
    assert.equal(bar.getAttribute('aria-hidden'), 'true')
    assert.equal(bar.getAnimations().length, 0)
  })

  it('moves focus out of a retained last toast without a remembered return target', async (t) => {
    let notifications = createToastManager()
    let id = notifications.add({ title: 'Saved', duration: 0 })
    let result = render(
      <Context manager={notifications}>
        {(toasts) => (
          <section mix={root({ label: 'Notifications' })}>
            {toasts.map((toast) => (
              <ItemContext key={toast.id} toast={toast}>
                <article
                  key={toast.id}
                  data-id={toast.id}
                  mix={[item(), animateExit({ opacity: 0, duration: 200 })]}
                >
                  <button>Dismiss</button>
                </article>
              </ItemContext>
            ))}
          </section>
        )}
      </Context>,
    )
    t.after(result.cleanup)
    let node = element(result.container, 'article')
    element(node, 'button').focus()
    await result.act(() => notifications.close(id))
    assert.equal(node.isConnected, true)
    assert.equal(node.inert, true)
    assert.equal(node.contains(document.activeElement), false)
  })

  it('reclaims a closed identity without leaving its new toast inert or unpresented', async (t) => {
    let notifications = createToastManager()
    notifications.add({ id: 'same', title: 'First', duration: 0 })
    let result = render(
      <Context manager={notifications}>
        {(toasts) => (
          <section mix={root({ label: 'Notifications' })}>
            {toasts.map((toast) => (
              <ItemContext key={toast.id} toast={toast}>
                <div
                  key={toast.id}
                  data-id={toast.id}
                  mix={[
                    item(),
                    animateExit({
                      opacity: 0,
                      duration: 200,
                    }),
                  ]}
                >
                  {toast.title}
                </div>
              </ItemContext>
            ))}
          </section>
        )}
      </Context>,
    )
    t.after(result.cleanup)
    let node = element(result.container, '[data-toast]')
    await result.act(() => notifications.close('same'))
    await result.act(() => notifications.add({ id: 'same', title: 'Second', duration: 0 }))
    let current = element(result.container, '[data-toast]')
    assert.equal(current, node)
    assert.equal(current.inert, false)
    assert.equal(current.getAttribute('aria-hidden'), null)
    assert.equal(current.textContent, 'Second')
    assert.equal(first(notifications).presented, true)
  })
})

describe('toast availability', () => {
  it('limits newest records independently of rendering and promotes retained overflow', () => {
    let manager = createToastManager({ limit: 2 })
    manager.add({ id: 'first', title: 'First', duration: 0 })
    manager.add({ id: 'second', title: 'Second', duration: 0 })
    manager.add({ id: 'third', title: 'Third', duration: 0 })
    assert.equal(manager.limit, 2)
    assert.deepEqual(
      manager.toasts.map(({ id, limited }) => [id, limited]),
      [
        ['third', false],
        ['second', false],
        ['first', true],
      ],
    )
    manager.add({ id: 'first', title: 'First updated' })
    assert.equal(manager.toasts[2]?.limited, true)
    manager.close('second')
    assert.deepEqual(
      manager.toasts.map(({ id, limited }) => [id, limited]),
      [
        ['third', false],
        ['first', false],
      ],
    )
    assert.throws(() => createToastManager({ limit: 0 }), RangeError)
    assert.throws(() => createToastManager({ limit: 1.5 }), RangeError)
    assert.throws(() => createToastManager({ limit: Infinity }), RangeError)
  })

  it('keeps limited timers running and composes window blur with manual pause', async (t) => {
    let time = clock(t)
    let manager = createToastManager({ limit: 1 })
    manager.add({ id: 'old', title: 'Old', duration: 1000 })
    manager.add({ id: 'new', title: 'New', duration: 0 })
    let result = render(
      <Context manager={manager}>
        {(toasts) => (
          <section mix={root({ label: 'Notifications' })}>
            {toasts.map((toast) => (
              <ItemContext key={toast.id} toast={toast}>
                <article key={toast.id} data-id={toast.id} mix={item()}>
                  {toast.title}
                </article>
              </ItemContext>
            ))}
          </section>
        )}
      </Context>,
    )
    t.after(result.cleanup)
    let old = element(result.container, '[data-id="old"]')
    assert.equal(old.inert, true)
    assert.equal(manager.toasts[1]?.paused, false)
    await result.act(() => window.dispatchEvent(new Event('blur')))
    manager.pause('manual')
    await result.act(() => window.dispatchEvent(new Event('focus')))
    time.advance(2000)
    assert.equal(manager.toasts.length, 2)
    manager.resume('manual')
    await result.act(() => time.advance(1000))
    assert.equal(manager.toasts.length, 1)
    assert.equal(old.isConnected, false)
  })

  it('does not steal focus later when an arrival limits the focused card', async (t) => {
    let manager = createToastManager({ limit: 1 })
    manager.add({ id: 'old', title: 'Old', duration: 0 })
    let result = render(
      <Context manager={manager}>
        {(toasts) => (
          <section mix={root({ label: 'Notifications' })}>
            {toasts.map((toast) => (
              <ItemContext key={toast.id} toast={toast}>
                <article key={toast.id} data-id={toast.id} mix={item()}>
                  <button>{toast.title}</button>
                </article>
              </ItemContext>
            ))}
          </section>
        )}
      </Context>,
    )
    t.after(result.cleanup)
    element(result.container, 'button').focus()
    await result.act(() => manager.add({ id: 'new', title: 'New', duration: 0 }))
    let old = element(result.container, '[data-id="old"]')
    let current = element(result.container, '[data-id="new"]')
    assert.equal(old.inert, true)
    assert.equal(old.getAttribute('aria-hidden'), 'true')
    assert.notEqual(document.activeElement, current)
    await result.act(() => manager.close('new'))
    assert.equal(old.inert, false)
    assert.equal(old.getAttribute('aria-hidden'), null)
    assert.notEqual(document.activeElement, old)
  })
})

describe('toast.root() interactions', () => {
  it('keeps touch expansion through release and resumes only its own pause on an outside touch', async (t) => {
    let time = clock(t)
    let manager = createToastManager()
    manager.add({ title: 'Saved', duration: 1000 })
    let activations = 0
    let result = render(
      <>
        <button data-outside="">Outside</button>
        <Context manager={manager}>
          {(records) => (
            <section mix={root({ label: 'Notifications' })}>
              {records.map((record) => (
                <ItemContext key={record.id} toast={record}>
                  <article key={record.id} data-id={record.id} mix={item()}>
                    <button
                      mix={on('click', () => {
                        activations++
                      })}
                    >
                      Undo
                    </button>
                  </article>
                </ItemContext>
              ))}
            </section>
          )}
        </Context>
      </>,
    )
    t.after(result.cleanup)
    let region = element(result.container, 'section')
    let action = element(region, 'button')
    let outside = element(result.container, '[data-outside]')
    await result.act(() =>
      action.dispatchEvent(
        new PointerEvent('pointerdown', {
          pointerType: 'touch',
          isPrimary: true,
          bubbles: true,
        }),
      ),
    )
    assert.equal(region.hasAttribute('data-expanded'), true)
    assert.equal(first(manager).paused, true)
    await result.act(() => {
      action.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', bubbles: true }))
      region.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'touch' }))
      action.click()
    })
    assert.equal(activations, 1)
    assert.equal(region.hasAttribute('data-expanded'), true)
    time.advance(2000)
    assert.equal(manager.toasts.length, 1)
    manager.pause('manual')
    await result.act(() => action.focus())
    await result.act(() =>
      outside.dispatchEvent(
        new PointerEvent('pointerdown', {
          pointerType: 'touch',
          isPrimary: true,
          bubbles: true,
        }),
      ),
    )
    assert.equal(region.hasAttribute('data-expanded'), false)
    assert.equal(first(manager).paused, true)
    assert.equal(region.contains(document.activeElement), false)
    manager.resume('manual')
    await result.act(() => time.advance(1000))
    assert.equal(manager.toasts.length, 0)
  })

  it('ignores mouse and secondary touches and clears touch engagement when the stack empties', async (t) => {
    let manager = createToastManager()
    manager.add({ title: 'Saved', duration: 0 })
    let result = render(
      <Context manager={manager}>
        {(records) => (
          <section mix={root({ label: 'Notifications' })}>
            {records.map((record) => (
              <ItemContext key={record.id} toast={record}>
                <article key={record.id} data-id={record.id} mix={item()}>
                  {record.title}
                </article>
              </ItemContext>
            ))}
          </section>
        )}
      </Context>,
    )
    t.after(result.cleanup)
    let region = element(result.container, 'section')
    await result.act(() =>
      region.dispatchEvent(
        new PointerEvent('pointerdown', {
          pointerType: 'mouse',
          isPrimary: true,
          bubbles: true,
        }),
      ),
    )
    assert.equal(region.hasAttribute('data-expanded'), false)
    await result.act(() =>
      region.dispatchEvent(
        new PointerEvent('pointerdown', {
          pointerType: 'touch',
          isPrimary: false,
          bubbles: true,
        }),
      ),
    )
    assert.equal(region.hasAttribute('data-expanded'), false)
    await result.act(() =>
      region.dispatchEvent(
        new PointerEvent('pointerdown', {
          pointerType: 'touch',
          isPrimary: true,
          bubbles: true,
        }),
      ),
    )
    await result.act(() =>
      region.dispatchEvent(
        new PointerEvent('pointercancel', {
          pointerType: 'touch',
          bubbles: true,
        }),
      ),
    )
    assert.equal(region.hasAttribute('data-expanded'), true)
    await result.act(() => manager.close())
    await result.act(() => manager.add({ title: 'New', duration: 1000 }))
    assert.equal(region.hasAttribute('data-expanded'), false)
    assert.equal(first(manager).paused, false)
  })

  it('releases touch pauses and document listeners when the region unmounts', async () => {
    let manager = createToastManager()
    manager.add({ title: 'Saved', duration: 1000 })
    let result = render(
      <Context manager={manager}>
        {(records) => (
          <section mix={root({ label: 'Notifications' })}>
            {records.map((record) => (
              <ItemContext key={record.id} toast={record}>
                <article key={record.id} data-id={record.id} mix={item()} />
              </ItemContext>
            ))}
          </section>
        )}
      </Context>,
    )
    await result.act(() =>
      element(result.container, 'section').dispatchEvent(
        new PointerEvent('pointerdown', {
          pointerType: 'touch',
          isPrimary: true,
          bubbles: true,
        }),
      ),
    )
    assert.equal(first(manager).paused, true)
    result.cleanup()
    let presentation = new AbortController()
    manager.present(first(manager).id, presentation.signal)
    assert.equal(first(manager).paused, false)
    document.dispatchEvent(
      new PointerEvent('pointerdown', {
        pointerType: 'touch',
        isPrimary: true,
        bubbles: true,
      }),
    )
    assert.equal(first(manager).paused, false)
    presentation.abort()
  })

  it('skips a hidden region when the default F6 shortcut selects the active one', async (t) => {
    let hidden = createToastManager()
    let active = createToastManager()
    hidden.add({ title: 'Hidden notification', duration: 0 })
    active.add({ title: 'Active notification', duration: 0 })
    let result = await render(
      <>
        <Context manager={hidden}>
          {(records) => (
            <section hidden data-hidden-region="" mix={root({ label: 'Notifications' })}>
              {records.map((record) => (
                <ItemContext key={record.id} toast={record}>
                  <article key={record.id} data-id={record.id} mix={item()}>
                    {record.title}
                  </article>
                </ItemContext>
              ))}
            </section>
          )}
        </Context>
        <Context manager={active}>
          {(records) => (
            <section data-active-region="" mix={root({ label: 'Notifications' })}>
              {records.map((record) => (
                <ItemContext key={record.id} toast={record}>
                  <article key={record.id} data-id={record.id} mix={item()}>
                    {record.title}
                  </article>
                </ItemContext>
              ))}
            </section>
          )}
        </Context>
      </>,
    )
    t.after(result.cleanup)
    await result.act(() =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'F6', bubbles: true, cancelable: true }),
      ),
    )
    assert.equal(document.activeElement, element(result.container, '[data-active-region]'))
  })
})

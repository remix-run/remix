import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { on } from '@remix-run/component'
import { render } from '@remix-run/component/test'
import type { TestContext } from '@remix-run/test'
import { renderToString } from '@remix-run/component/server'
import { animateExit } from './animation.ts'
import { countdown, createToastManager, Context, root, ItemContext, item } from './toast.tsx'
import type { ToastManager, ToastOptions, ToastItem } from './toast.tsx'

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

function first<action>(toastManager: ToastManager<action>): ToastItem<action> {
  let toastItem = toastManager.toastItems[0]
  assert.ok(toastItem)
  return toastItem
}

function element(container: ParentNode, selector: string): HTMLElement {
  let node = container.querySelector(selector)
  assert.ok(node instanceof HTMLElement)
  return node
}

describe('toast manager', () => {
  it('retains publications before a renderer subscribes or mounts', (t) => {
    let time = clock(t)
    let toastManager = createToastManager()
    let id = toastManager.add({ title: 'Saved', timeout: 1000 })
    time.advance(10000)
    assert.equal(first(toastManager).id, id)
    assert.equal(first(toastManager).remaining, 1000)
    assert.equal(first(toastManager).presented, false)
    let presentation = new AbortController()
    toastManager.present(id, presentation.signal)
    assert.equal(first(toastManager).paused, false)
    time.advance(1000)
    assert.equal(toastManager.toastItems.length, 0)
    presentation.abort()
  })

  it('merges duplicates in place and restarts the lifetime without losing presentation', (t) => {
    let time = clock(t)
    let toastManager = createToastManager()
    toastManager.add({ id: 'save', title: 'Saving', description: 'Settings', timeout: 1000 })
    toastManager.add({ id: 'other', title: 'Other', timeout: false })
    let presentation = new AbortController()
    toastManager.present('save', presentation.signal)
    time.advance(400)
    toastManager.add({ id: 'save', title: 'Saved' })
    assert.deepEqual(
      toastManager.toastItems.map((toastItem) => toastItem.id),
      ['other', 'save'],
    )
    assert.equal(
      toastManager.toastItems.find((toastItem) => toastItem.id === 'save')?.title,
      'Saved',
    )
    assert.equal(
      toastManager.toastItems.find((toastItem) => toastItem.id === 'save')?.description,
      'Settings',
    )
    assert.equal(
      toastManager.toastItems.find((toastItem) => toastItem.id === 'save')?.remaining,
      1000,
    )
    assert.equal(
      toastManager.toastItems.find((toastItem) => toastItem.id === 'save')?.presented,
      true,
    )
    time.advance(900)
    assert.equal(
      toastManager.toastItems.find((toastItem) => toastItem.id === 'save')?.remaining,
      100,
    )
    presentation.abort()
    time.advance(1000)
    assert.equal(
      toastManager.toastItems.find((toastItem) => toastItem.id === 'save')?.remaining,
      100,
    )
    toastManager.close()
  })

  it('composes independent pause reasons and applies them to new arrivals', (t) => {
    let time = clock(t)
    let toastManager = createToastManager()
    let hover = Symbol()
    let focus = Symbol()
    toastManager.pause(hover)
    let id = toastManager.add({ title: 'Saved', timeout: 1000 })
    let presentation = new AbortController()
    toastManager.present(id, presentation.signal)
    toastManager.pause(focus)
    toastManager.resume(hover)
    time.advance(2000)
    assert.equal(first(toastManager).paused, true)
    assert.equal(first(toastManager).remaining, 1000)
    toastManager.resume(focus)
    time.advance(250)
    assert.equal(first(toastManager).remaining, 750)
    toastManager.pause(hover)
    toastManager.pause(hover)
    time.advance(1000)
    toastManager.resume(hover)
    time.advance(750)
    assert.equal(toastManager.toastItems.length, 0)
    presentation.abort()
  })

  it('pauses while unpresented and resumes with the remaining lifetime', (t) => {
    let time = clock(t)
    let toastManager = createToastManager()
    let id = toastManager.add({ title: 'Saved', timeout: 1000 })
    let firstMount = new AbortController()
    let secondMount = new AbortController()
    toastManager.present(id, firstMount.signal)
    toastManager.present(id, secondMount.signal)
    time.advance(300)
    firstMount.abort()
    assert.equal(first(toastManager).paused, false)
    secondMount.abort()
    time.advance(10000)
    assert.equal(first(toastManager).remaining, 700)
    let remount = new AbortController()
    toastManager.present(id, remount.signal)
    time.advance(700)
    assert.equal(toastManager.toastItems.length, 0)
    remount.abort()
  })

  it('does not detach a new toast when an old presentation of the same identity aborts', () => {
    let toastManager = createToastManager()
    toastManager.add({ id: 'same', title: 'Old', timeout: false })
    let old = new AbortController()
    toastManager.present('same', old.signal)
    toastManager.close('same')
    toastManager.add({ id: 'same', title: 'New', timeout: false })
    let current = new AbortController()
    toastManager.present('same', current.signal)
    old.abort()
    assert.equal(first(toastManager).presented, true)
    current.abort()
    assert.equal(first(toastManager).presented, false)
  })

  it('updates content without extending the deadline', (t) => {
    let time = clock(t)
    let toastManager = createToastManager<{ label: string }>()
    let id = toastManager.add({ title: 'Uploading', timeout: 1000 })
    let presentation = new AbortController()
    toastManager.present(id, presentation.signal)
    time.advance(800)
    toastManager.update(id, { title: 'Uploaded', description: 'Ready', action: { label: 'Open' } })
    assert.equal(first(toastManager).description, 'Ready')
    assert.equal(first(toastManager).priority, 'low')
    assert.equal(first(toastManager).remaining, 200)
    toastManager.update(id, { action: { label: 'View' } })
    assert.equal(first(toastManager).action?.label, 'View')
    time.advance(200)
    assert.equal(toastManager.toastItems.length, 0)
    presentation.abort()
  })

  it('persists actions by default without inspecting arbitrary action values', () => {
    let toastManager = createToastManager<unknown>()
    toastManager.add({ title: 'Text' })
    toastManager.add({ title: 'Empty string action', action: '' })
    toastManager.add({ title: 'False action', action: false })
    toastManager.add({ title: 'Null action', action: null })
    toastManager.add({ title: 'Explicit timeout', action: {}, timeout: 1000 })
    assert.deepEqual(
      toastManager.toastItems.map((toastItem) => toastItem.timeout),
      [1000, 5000, false, false, 5000],
    )
  })

  it('keeps explicitly persistent items open until their timeout is enabled', (t) => {
    let time = clock(t)
    let toastManager = createToastManager()
    let id = toastManager.add({ title: 'Saved', timeout: false })
    let presentation = new AbortController()
    toastManager.present(id, presentation.signal)
    time.advance(10000)
    assert.equal(first(toastManager).timeout, false)
    assert.equal(first(toastManager).paused, true)
    assert.equal(first(toastManager).remaining, 0)
    toastManager.update(id, { timeout: 1000 })
    time.advance(1000)
    assert.equal(toastManager.toastItems.length, 0)
    presentation.abort()
  })

  it('dismisses a zero-timeout item as soon as it is presented', (t) => {
    let time = clock(t)
    let toastManager = createToastManager()
    let id = toastManager.add({ title: 'Saved', timeout: 0 })
    time.advance(10000)
    assert.equal(first(toastManager).timeout, 0)
    let presentation = new AbortController()
    toastManager.present(id, presentation.signal)
    time.advance(1)
    assert.equal(toastManager.toastItems.length, 0)
    presentation.abort()
  })

  it('notifies state changes with native abortable subscriptions and immutable snapshots', () => {
    let toastManager = createToastManager()
    let subscription = new AbortController()
    let count = 0
    toastManager.addEventListener('change', () => count++, { signal: subscription.signal })
    toastManager.add({ id: 'save', title: 'Saving' })
    let snapshot = first(toastManager)
    toastManager.update('save', { title: 'Saved' })
    assert.equal(snapshot.title, 'Saving')
    assert.equal(Object.isFrozen(snapshot), true)
    assert.equal(count, 2)
    subscription.abort()
    toastManager.close()
    assert.equal(count, 2)
  })

  it('rejects invalid lifetimes before changing an existing item', () => {
    let toastManager = createToastManager()
    toastManager.add({ id: 'save', title: 'Saved' })
    assert.throws(() => toastManager.add({ id: 'save', title: 'Invalid', timeout: -1 }), RangeError)
    assert.throws(() => toastManager.update('save', { timeout: Infinity }), RangeError)
    assert.throws(() => toastManager.update('save', { timeout: NaN }), RangeError)
    assert.equal(first(toastManager).title, 'Saved')
  })
})

describe('toast.root()', () => {
  it('preserves custom and array action inference in the context render callback', async () => {
    interface Action {
      label: string
      run(): void
    }
    let toastManager = createToastManager<Action[]>()
    function publish<action>(toastManager: ToastManager<action>, options: ToastOptions<action>) {
      return toastManager.add(options)
    }
    publish(toastManager, { title: 'Saved', action: [{ label: 'Undo', run() {} }] })
    let html = await renderToString(
      <Context manager={toastManager}>
        {(toastItems) => (
          <section mix={root({ label: 'Notifications' })}>
            {toastItems.map((toastItem) => (
              <div>
                {toastItem.action?.map((action) => (
                  <button mix={on('click', action.run)}>{action.label}</button>
                ))}
              </div>
            ))}
          </section>
        )}
      </Context>,
    )
    assert.match(html, /Undo/)
    assert.equal(first(toastManager).presented, false)
  })

  it('presents buffered content, announces it, enters on F6, and restores focus on close', async (t) => {
    let toastManager = createToastManager<{ label: string }>()
    let id = toastManager.add({ title: 'File deleted', action: { label: 'Undo' } })
    let result = render(
      <>
        <button>Publish</button>
        <Context manager={toastManager}>
          {(toastItems) => (
            <section mix={root({ label: 'Notifications' })}>
              {toastItems.map((toastItem) => (
                <ItemContext key={toastItem.id} value={toastItem.id}>
                  <div key={toastItem.id} data-id={toastItem.id} mix={item()}>
                    <strong>{toastItem.title}</strong>
                    <button mix={on('click', () => toastManager.close(toastItem.id))}>
                      {toastItem.action?.label}
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
    assert.equal(first(toastManager).paused, true)
    assert.equal(element(result.container, '[role="region"]').getAttribute('aria-live'), 'polite')
    await result.act(() => undo.click())
    assert.equal(document.activeElement, publish)
    assert.equal(toastManager.toastItems.length, 0)
    assert.equal(result.container.querySelector('[data-toast]'), null)
    assert.ok(id)
  })

  it('keeps focus pause after hover ends and returns from the region with F6', async (t) => {
    let toastManager = createToastManager()
    toastManager.add({ title: 'Saved', timeout: 10000 })
    let result = render(
      <>
        <button>Publish</button>
        <Context manager={toastManager}>
          {(toastItems) => (
            <section mix={root({ label: 'Notifications' })}>
              {toastItems.map((toastItem) => (
                <ItemContext key={toastItem.id} value={toastItem.id}>
                  <div key={toastItem.id} data-id={toastItem.id} mix={item()}>
                    {toastItem.title}
                  </div>
                </ItemContext>
              ))}
            </section>
          )}
        </Context>
      </>,
    )
    t.after(result.cleanup)
    t.after(() => toastManager.close())
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
    assert.equal(first(toastManager).paused, true)
    await result.act(() =>
      region.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'F6', bubbles: true, cancelable: true }),
      ),
    )
    assert.equal(document.activeElement, publish)
    assert.equal(first(toastManager).paused, false)
  })

  it('makes a logically closed toast inert while retaining its exit animation', async (t) => {
    let toastManager = createToastManager()
    let id = toastManager.add({ title: 'Saved', timeout: false })
    let result = render(
      <Context manager={toastManager}>
        {(toastItems) => (
          <section mix={root({ label: 'Notifications' })}>
            {toastItems.map((toastItem) => (
              <ItemContext key={toastItem.id} value={toastItem.id}>
                <div
                  key={toastItem.id}
                  data-id={toastItem.id}
                  mix={[
                    item(),
                    animateExit({
                      opacity: 0,
                      duration: 200,
                    }),
                  ]}
                >
                  {toastItem.title}
                </div>
              </ItemContext>
            ))}
          </section>
        )}
      </Context>,
    )
    t.after(result.cleanup)
    let node = element(result.container, '[data-toast]')
    await result.act(() => toastManager.close(id))
    assert.equal(toastManager.toastItems.length, 0)
    assert.equal(node.inert, true)
    assert.equal(node.getAttribute('aria-hidden'), 'true')
    assert.equal(node.isConnected, true)
    await Promise.all(node.getAnimations().map((animation) => animation.finished))
  })
})

describe('toast gestures and clocks', () => {
  it('expands the region on touch and collapses on an outside touch', async (t) => {
    let toastManager = createToastManager()
    toastManager.add({ title: 'Saved', timeout: 1000 })
    let result = render(
      <Context manager={toastManager}>
        {(toastItems) => (
          <section mix={root({ label: 'Notifications' })}>
            {toastItems.map((toastItem) => (
              <ItemContext key={toastItem.id} value={toastItem.id}>
                <article key={toastItem.id} data-id={toastItem.id} mix={item()}>
                  {toastItem.title}
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
    assert.equal(first(toastManager).paused, true)
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
    assert.equal(first(toastManager).paused, false)
  })

  it('replaces countdown animations on pause, restart and persistent updates', async (t) => {
    let toastManager = createToastManager()
    let id = toastManager.add({ title: 'Saved', timeout: 10000 })
    let result = render(
      <Context manager={toastManager}>
        {(toastItems) => (
          <section mix={root({ label: 'Notifications' })}>
            {toastItems.map((toastItem) => (
              <ItemContext key={toastItem.id} value={toastItem.id}>
                <div key={toastItem.id} data-id={toastItem.id} mix={item()}>
                  <div data-countdown mix={countdown(toastItem)} />
                </div>
              </ItemContext>
            ))}
          </section>
        )}
      </Context>,
    )
    t.after(result.cleanup)
    t.after(() => toastManager.close())
    let bar = element(result.container, '[data-countdown]')
    assert.equal(bar.getAnimations().length, 1)
    let original = bar.getAnimations()[0]
    await result.act(() => toastManager.pause('manual'))
    assert.equal(original.playState, 'idle')
    assert.equal(bar.getAnimations().length, 1)
    assert.equal(bar.getAnimations()[0].playState, 'paused')
    await result.act(() => toastManager.resume('manual'))
    assert.equal(bar.getAnimations().length, 1)
    assert.equal(bar.getAnimations()[0].playState, 'running')
    await result.act(() => toastManager.update(id, { timeout: 20000 }))
    assert.equal(bar.getAnimations().length, 1)
    assert.ok(Number(bar.getAnimations()[0].effect?.getTiming().duration) > 19000)
    await result.act(() => toastManager.update(id, { timeout: false }))
    assert.equal(bar.hidden, true)
    assert.equal(bar.getAttribute('aria-hidden'), 'true')
    assert.equal(bar.getAnimations().length, 0)
  })

  it('moves focus out of a retained last toast without a remembered return target', async (t) => {
    let toastManager = createToastManager()
    let id = toastManager.add({ title: 'Saved', timeout: false })
    let result = render(
      <Context manager={toastManager}>
        {(toastItems) => (
          <section mix={root({ label: 'Notifications' })}>
            {toastItems.map((toastItem) => (
              <ItemContext key={toastItem.id} value={toastItem.id}>
                <article
                  key={toastItem.id}
                  data-id={toastItem.id}
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
    await result.act(() => toastManager.close(id))
    assert.equal(node.isConnected, true)
    assert.equal(node.inert, true)
    assert.equal(node.contains(document.activeElement), false)
  })

  it('reclaims a closed identity without leaving its new toast inert or unpresented', async (t) => {
    let toastManager = createToastManager()
    toastManager.add({ id: 'same', title: 'First', timeout: false })
    let result = render(
      <Context manager={toastManager}>
        {(toastItems) => (
          <section mix={root({ label: 'Notifications' })}>
            {toastItems.map((toastItem) => (
              <ItemContext key={toastItem.id} value={toastItem.id}>
                <div
                  key={toastItem.id}
                  data-id={toastItem.id}
                  mix={[
                    item(),
                    animateExit({
                      opacity: 0,
                      duration: 200,
                    }),
                  ]}
                >
                  {toastItem.title}
                </div>
              </ItemContext>
            ))}
          </section>
        )}
      </Context>,
    )
    t.after(result.cleanup)
    let node = element(result.container, '[data-toast]')
    await result.act(() => toastManager.close('same'))
    await result.act(() => toastManager.add({ id: 'same', title: 'Second', timeout: false }))
    let current = element(result.container, '[data-toast]')
    assert.equal(current, node)
    assert.equal(current.inert, false)
    assert.equal(current.getAttribute('aria-hidden'), null)
    assert.equal(current.textContent, 'Second')
    assert.equal(first(toastManager).presented, true)
  })
})

describe('toast availability', () => {
  it('applies the context limit and promotes retained overflow without reordering updates', async (t) => {
    let toastManager = createToastManager()
    toastManager.add({ id: 'first', title: 'First', timeout: false })
    toastManager.add({ id: 'second', title: 'Second', timeout: false })
    toastManager.add({ id: 'third', title: 'Third', timeout: false })
    toastManager.add({ id: 'fourth', title: 'Fourth', timeout: false })
    function view(limit?: number) {
      return (
        <Context manager={toastManager} limit={limit}>
          {(toastItems) => (
            <section mix={root({ label: 'Notifications' })}>
              {toastItems.map((toastItem) => (
                <ItemContext key={toastItem.id} value={toastItem.id}>
                  <article key={toastItem.id} data-id={toastItem.id} mix={item()}>
                    {toastItem.title}
                  </article>
                </ItemContext>
              ))}
            </section>
          )}
        </Context>
      )
    }
    let result = render(view())
    t.after(result.cleanup)
    let firstNode = element(result.container, '[data-id="first"]')
    let secondNode = element(result.container, '[data-id="second"]')
    assert.equal(firstNode.inert, true)
    assert.equal(firstNode.hasAttribute('data-limited'), true)
    assert.equal(secondNode.inert, false)
    assert.equal(result.$$('[data-limited]').length, 1)
    assert.equal(toastManager.toastItems.length, 4)

    await result.act(() => result.root.render(view(2)))
    assert.equal(secondNode.inert, true)
    assert.equal(result.$$('[data-limited]').length, 2)
    await result.act(() => toastManager.add({ id: 'first', title: 'First updated' }))
    assert.equal(firstNode.inert, true)
    assert.deepEqual(
      toastManager.toastItems.map((toastItem) => toastItem.id),
      ['fourth', 'third', 'second', 'first'],
    )

    await result.act(() => toastManager.close('third'))
    assert.equal(secondNode.inert, false)
    assert.equal(secondNode.getAttribute('aria-hidden'), null)
    assert.equal(secondNode.hasAttribute('data-limited'), false)
    assert.equal(firstNode.inert, true)

    await result.act(() => result.root.render(view(3)))
    assert.equal(element(result.container, '[data-id="first"]'), firstNode)
    assert.equal(firstNode.inert, false)
    assert.equal(firstNode.getAttribute('aria-hidden'), null)
    assert.equal(firstNode.hasAttribute('data-limited'), false)
    await result.act(() => result.root.render(view(1)))
    assert.equal(secondNode.inert, true)
    assert.equal(firstNode.inert, true)
    await result.act(() => result.root.render(view()))
    assert.equal(firstNode.inert, false)
    assert.equal(result.$$('[data-limited]').length, 0)
  })

  it('preserves remaining lifetimes when the context limit changes', async (t) => {
    let time = clock(t)
    let toastManager = createToastManager()
    toastManager.add({ id: 'old', title: 'Old', timeout: 1000 })
    toastManager.add({ id: 'new', title: 'New', timeout: false })
    function view(limit: number) {
      return (
        <Context manager={toastManager} limit={limit}>
          {(toastItems) => (
            <section mix={root({ label: 'Notifications' })}>
              {toastItems.map((toastItem) => (
                <ItemContext key={toastItem.id} value={toastItem.id}>
                  <article key={toastItem.id} data-id={toastItem.id} mix={item()}>
                    {toastItem.title}
                  </article>
                </ItemContext>
              ))}
            </section>
          )}
        </Context>
      )
    }
    let result = render(view(1))
    t.after(result.cleanup)
    await result.act(() => time.advance(400))
    await result.act(() => result.root.render(view(2)))
    let old = element(result.container, '[data-id="old"]')
    assert.equal(old.inert, false)
    assert.equal(toastManager.toastItems[1]?.remaining, 600)
    assert.equal(toastManager.toastItems[1]?.paused, false)
    await result.act(() => result.root.render(view(1)))
    assert.equal(old.inert, true)
    await result.act(() => time.advance(200))
    await result.act(() => result.root.render(view(2)))
    assert.equal(toastManager.toastItems[1]?.remaining, 400)
    await result.act(() => time.advance(400))
    assert.equal(old.isConnected, false)
    assert.deepEqual(
      toastManager.toastItems.map((toastItem) => toastItem.id),
      ['new'],
    )
  })

  it('moves keyboard focus to an available notification when the context limit shrinks', async (t) => {
    let toastManager = createToastManager()
    toastManager.add({ id: 'old', title: 'Old', timeout: false })
    toastManager.add({ id: 'new', title: 'New', timeout: false })
    function view(limit: number) {
      return (
        <>
          <button data-origin="">Publish</button>
          <Context manager={toastManager} limit={limit}>
            {(toastItems) => (
              <section mix={root({ label: 'Notifications' })}>
                {toastItems.map((toastItem) => (
                  <ItemContext key={toastItem.id} value={toastItem.id}>
                    <article key={toastItem.id} data-id={toastItem.id} mix={item()}>
                      {toastItem.title}
                    </article>
                  </ItemContext>
                ))}
              </section>
            )}
          </Context>
        </>
      )
    }
    let result = render(view(2))
    t.after(result.cleanup)
    let origin = element(result.container, '[data-origin]')
    origin.focus()
    await result.act(() =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'F6', bubbles: true, cancelable: true }),
      ),
    )
    let old = element(result.container, '[data-id="old"]')
    await result.act(() => old.focus())
    assert.equal(document.activeElement, old)
    await result.act(() => result.root.render(view(1)))
    let current = element(result.container, '[data-id="new"]')
    assert.equal(old.inert, true)
    assert.equal(document.activeElement, current)
    assert.equal(result.$$('[data-toast-focus-guard][tabindex="0"]').length, 2)
    await result.act(() => result.root.render(view(2)))
    assert.equal(document.activeElement, current)
    await result.act(() =>
      current.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'F6', bubbles: true, cancelable: true }),
      ),
    )
    assert.equal(document.activeElement, origin)
  })

  it('requires a positive integer context limit', async () => {
    let toastManager = createToastManager()
    await assert.rejects(
      renderToString(
        <Context manager={toastManager} limit={0}>
          {() => null}
        </Context>,
      ),
      RangeError,
    )
    await assert.rejects(
      renderToString(
        <Context manager={toastManager} limit={1.5}>
          {() => null}
        </Context>,
      ),
      RangeError,
    )
    await assert.rejects(
      renderToString(
        <Context manager={toastManager} limit={Infinity}>
          {() => null}
        </Context>,
      ),
      RangeError,
    )
  })

  it('keeps limited timers running and composes window blur with manual pause', async (t) => {
    let time = clock(t)
    let toastManager = createToastManager()
    toastManager.add({ id: 'old', title: 'Old', timeout: 1000 })
    toastManager.add({ id: 'new', title: 'New', timeout: false })
    let result = render(
      <Context manager={toastManager} limit={1}>
        {(toastItems) => (
          <section mix={root({ label: 'Notifications' })}>
            {toastItems.map((toastItem) => (
              <ItemContext key={toastItem.id} value={toastItem.id}>
                <article key={toastItem.id} data-id={toastItem.id} mix={item()}>
                  {toastItem.title}
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
    assert.equal(toastManager.toastItems[1]?.paused, false)
    await result.act(() => window.dispatchEvent(new Event('blur')))
    toastManager.pause('manual')
    await result.act(() => window.dispatchEvent(new Event('focus')))
    time.advance(2000)
    assert.equal(toastManager.toastItems.length, 2)
    toastManager.resume('manual')
    await result.act(() => time.advance(1000))
    assert.equal(toastManager.toastItems.length, 1)
    assert.equal(old.isConnected, false)
  })

  it('does not steal focus later when an arrival limits the focused card', async (t) => {
    let toastManager = createToastManager()
    toastManager.add({ id: 'old', title: 'Old', timeout: false })
    let result = render(
      <Context manager={toastManager} limit={1}>
        {(toastItems) => (
          <section mix={root({ label: 'Notifications' })}>
            {toastItems.map((toastItem) => (
              <ItemContext key={toastItem.id} value={toastItem.id}>
                <article key={toastItem.id} data-id={toastItem.id} mix={item()}>
                  <button>{toastItem.title}</button>
                </article>
              </ItemContext>
            ))}
          </section>
        )}
      </Context>,
    )
    t.after(result.cleanup)
    element(result.container, 'button').focus()
    await result.act(() => toastManager.add({ id: 'new', title: 'New', timeout: false }))
    let old = element(result.container, '[data-id="old"]')
    let current = element(result.container, '[data-id="new"]')
    assert.equal(old.inert, true)
    assert.equal(old.getAttribute('aria-hidden'), 'true')
    assert.notEqual(document.activeElement, current)
    await result.act(() => toastManager.close('new'))
    assert.equal(old.inert, false)
    assert.equal(old.getAttribute('aria-hidden'), null)
    assert.notEqual(document.activeElement, old)
  })
})

describe('toast.root() interactions', () => {
  it('keeps touch expansion through release and resumes only its own pause on an outside touch', async (t) => {
    let time = clock(t)
    let toastManager = createToastManager()
    toastManager.add({ title: 'Saved', timeout: 1000 })
    let activations = 0
    let result = render(
      <>
        <button data-outside="">Outside</button>
        <Context manager={toastManager}>
          {(toastItems) => (
            <section mix={root({ label: 'Notifications' })}>
              {toastItems.map((toastItem) => (
                <ItemContext key={toastItem.id} value={toastItem.id}>
                  <article key={toastItem.id} data-id={toastItem.id} mix={item()}>
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
    assert.equal(first(toastManager).paused, true)
    await result.act(() => {
      action.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', bubbles: true }))
      region.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'touch' }))
      action.click()
    })
    assert.equal(activations, 1)
    assert.equal(region.hasAttribute('data-expanded'), true)
    time.advance(2000)
    assert.equal(toastManager.toastItems.length, 1)
    toastManager.pause('manual')
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
    assert.equal(first(toastManager).paused, true)
    assert.equal(region.contains(document.activeElement), false)
    toastManager.resume('manual')
    await result.act(() => time.advance(1000))
    assert.equal(toastManager.toastItems.length, 0)
  })

  it('ignores mouse and secondary touches and clears touch engagement when the stack empties', async (t) => {
    let toastManager = createToastManager()
    toastManager.add({ title: 'Saved', timeout: false })
    let result = render(
      <Context manager={toastManager}>
        {(toastItems) => (
          <section mix={root({ label: 'Notifications' })}>
            {toastItems.map((toastItem) => (
              <ItemContext key={toastItem.id} value={toastItem.id}>
                <article key={toastItem.id} data-id={toastItem.id} mix={item()}>
                  {toastItem.title}
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
    await result.act(() => toastManager.close())
    await result.act(() => toastManager.add({ title: 'New', timeout: 1000 }))
    assert.equal(region.hasAttribute('data-expanded'), false)
    assert.equal(first(toastManager).paused, false)
  })

  it('releases touch pauses and document listeners when the region unmounts', async () => {
    let toastManager = createToastManager()
    toastManager.add({ title: 'Saved', timeout: 1000 })
    let result = render(
      <Context manager={toastManager}>
        {(toastItems) => (
          <section mix={root({ label: 'Notifications' })}>
            {toastItems.map((toastItem) => (
              <ItemContext key={toastItem.id} value={toastItem.id}>
                <article key={toastItem.id} data-id={toastItem.id} mix={item()} />
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
    assert.equal(first(toastManager).paused, true)
    result.cleanup()
    let presentation = new AbortController()
    toastManager.present(first(toastManager).id, presentation.signal)
    assert.equal(first(toastManager).paused, false)
    document.dispatchEvent(
      new PointerEvent('pointerdown', {
        pointerType: 'touch',
        isPrimary: true,
        bubbles: true,
      }),
    )
    assert.equal(first(toastManager).paused, false)
    presentation.abort()
  })

  it('skips a hidden region when the default F6 shortcut selects the active one', async (t) => {
    let hidden = createToastManager()
    let active = createToastManager()
    hidden.add({ title: 'Hidden notification', timeout: false })
    active.add({ title: 'Active notification', timeout: false })
    let result = await render(
      <>
        <Context manager={hidden}>
          {(toastItems) => (
            <section hidden data-hidden-region="" mix={root({ label: 'Notifications' })}>
              {toastItems.map((toastItem) => (
                <ItemContext key={toastItem.id} value={toastItem.id}>
                  <article key={toastItem.id} data-id={toastItem.id} mix={item()}>
                    {toastItem.title}
                  </article>
                </ItemContext>
              ))}
            </section>
          )}
        </Context>
        <Context manager={active}>
          {(toastItems) => (
            <section data-active-region="" mix={root({ label: 'Notifications' })}>
              {toastItems.map((toastItem) => (
                <ItemContext key={toastItem.id} value={toastItem.id}>
                  <article key={toastItem.id} data-id={toastItem.id} mix={item()}>
                    {toastItem.title}
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

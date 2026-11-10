import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { on } from '@remix-run/component'
import type { Handle } from '@remix-run/component'
import { render } from '@remix-run/component/test'
import type { TestContext } from '@remix-run/test'
import { renderToString } from '@remix-run/component/server'
import { animateExit } from './animation.ts'
import { createToastManager, Context, root, ItemContext, item } from './toast.tsx'
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

function first<data>(toastManager: ToastManager<data>): ToastItem<data> {
  let toastItem = toastManager.toastItems[0]
  assert.ok(toastItem)
  return toastItem
}

function element(container: ParentNode, selector: string): HTMLElement {
  let node = container.querySelector(selector)
  assert.ok(node instanceof HTMLElement)
  return node
}

function RetainedNotifications(handle: Handle<{ manager: ToastManager }>) {
  return () => (
    <Context manager={handle.props.manager}>
      {(toastItems) => (
        <section mix={root({ label: 'Notifications' })}>
          {toastItems.map((toastItem) => (
            <ItemContext key={toastItem.id} value={toastItem.id}>
              <article
                key={toastItem.id}
                data-id={toastItem.id}
                mix={[item(), animateExit({ opacity: 0, duration: 10000 })]}
              >
                {toastItem.title}
              </article>
            </ItemContext>
          ))}
        </section>
      )}
    </Context>
  )
}

function pauseExit(node: Element) {
  let animations = node.getAnimations()
  assert.ok(animations.length > 0)
  for (let animation of animations) animation.pause()
}

async function finishExit(node: Element) {
  let animations = node.getAnimations()
  for (let animation of animations) animation.finish()
  await Promise.all(animations.map((animation) => animation.finished))
  await new Promise((resolve) => requestAnimationFrame(resolve))
}

describe('toast manager', () => {
  it('retains publications without running timers before a renderer mounts', (t) => {
    let time = clock(t)
    let toastManager = createToastManager()
    let id = toastManager.add({ title: 'Saved', timeout: 1000 })
    time.advance(10000)
    assert.equal(first(toastManager).id, id)
    assert.equal(first(toastManager).timeout, 1000)
  })

  it('replaces an existing identity without changing notification order', () => {
    let toastManager = createToastManager()
    toastManager.add({ id: 'save', title: 'Saving' })
    toastManager.add({ id: 'other', title: 'Other' })
    toastManager.add({ id: 'save', title: 'Saved', timeout: 5000 })
    assert.deepEqual(
      toastManager.toastItems.map((toastItem) => toastItem.id),
      ['other', 'save'],
    )
    assert.equal(toastManager.toastItems[1].title, 'Saved')
    toastManager.close('save')
    assert.deepEqual(
      toastManager.toastItems.map((toastItem) => toastItem.id),
      ['other'],
    )
    toastManager.close()
    assert.equal(toastManager.toastItems.length, 0)
  })

  it('uses the same content and options whether the previous toast is open or dismissed', () => {
    let toastManager = createToastManager<{ label: string }>()
    toastManager.add({
      id: 'save',
      title: 'Failed',
      description: 'Try again',
      data: { label: 'Retry' },
      timeout: false,
      announcement: 'Save failed.',
    })
    toastManager.add({ id: 'save', description: 'Ready' })
    let replacement = first(toastManager)
    assert.equal(replacement.title, undefined)
    assert.equal(replacement.description, 'Ready')
    assert.equal(replacement.data, undefined)
    assert.equal(replacement.timeout, undefined)
    assert.equal(replacement.announcement, undefined)
    assert.equal(replacement.revision, 1)
    toastManager.close('save')
    toastManager.add({ id: 'save', description: 'Ready' })
    assert.deepEqual({ ...replacement, revision: 0 }, first(toastManager))
  })

  it('increments revision for duplicate publications, including unchanged content', () => {
    let toastManager = createToastManager()
    toastManager.add({ id: 'save', title: 'Saved', timeout: false })
    let initial = first(toastManager)
    assert.equal(initial.revision, 0)
    toastManager.add({ id: 'save', title: 'Saved' })
    assert.equal(first(toastManager).revision, 1)
    toastManager.add({ id: 'save', title: 'Saved' })
    assert.equal(first(toastManager).revision, 2)
    toastManager.add({ id: 'save' })
    assert.equal(first(toastManager).revision, 3)
    assert.equal(initial.revision, 0)
    assert.throws(() => toastManager.add({ id: 'save', timeout: -1 }), RangeError)
    assert.equal(first(toastManager).revision, 3)
    toastManager.close('save')
    toastManager.add({ id: 'save', title: 'Saved', timeout: false })
    assert.equal(first(toastManager).revision, 0)
  })

  it('notifies state changes with native abortable subscriptions and immutable snapshots', () => {
    let toastManager = createToastManager()
    let subscription = new AbortController()
    let count = 0
    toastManager.addEventListener('change', () => count++, { signal: subscription.signal })
    toastManager.add({ id: 'save', title: 'Saving' })
    let snapshot = first(toastManager)
    toastManager.add({ id: 'save', title: 'Saved' })
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
    assert.throws(() => toastManager.add({ id: 'save', timeout: Infinity }), RangeError)
    assert.throws(() => toastManager.add({ id: 'save', timeout: NaN }), RangeError)
    assert.equal(first(toastManager).title, 'Saved')
  })
})

describe('toast.root()', () => {
  it('preserves array data inference in the context render callback', async () => {
    interface Action {
      label: string
      run(): void
    }
    let toastManager = createToastManager<Action[]>()
    function publish<data>(toastManager: ToastManager<data>, options: ToastOptions<data>) {
      return toastManager.add(options)
    }
    publish(toastManager, { title: 'Saved', data: [{ label: 'Undo', run() {} }] })
    let html = await renderToString(
      <Context manager={toastManager}>
        {(toastItems) => (
          <section mix={root({ label: 'Notifications' })}>
            {toastItems.map((toastItem) => (
              <div>
                {toastItem.data?.map((action) => (
                  <button mix={on('click', action.run)}>{action.label}</button>
                ))}
              </div>
            ))}
          </section>
        )}
      </Context>,
    )
    assert.match(html, /Undo/)
  })

  it('presents buffered content, announces it, enters on F6, and restores focus on close', async (t) => {
    let toastManager = createToastManager<{ label: string }>()
    let id = toastManager.add({ title: 'File deleted', data: { label: 'Undo' } })
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
                      {toastItem.data?.label}
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
    assert.equal(element(result.container, '[role="region"]').getAttribute('aria-live'), null)
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
    await result.act(() =>
      publish.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'F6', bubbles: true, cancelable: true }),
      ),
    )
    assert.equal(document.activeElement, region)
    await result.act(() =>
      region.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' })),
    )
    await result.act(() =>
      region.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'F6', bubbles: true, cancelable: true }),
      ),
    )
    assert.equal(document.activeElement, publish)
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
                <div key={toastItem.id} data-id={toastItem.id} mix={item({ countdown: true })}>
                  <div data-countdown aria-hidden="true" />
                </div>
              </ItemContext>
            ))}
          </section>
        )}
      </Context>,
    )
    t.after(result.cleanup)
    t.after(() => toastManager.close())
    let bar = element(result.container, '[data-id]')
    assert.equal(bar.getAnimations().length, 1)
    let original = bar.getAnimations()[0]
    await result.act(() =>
      element(result.container, 'section').dispatchEvent(
        new PointerEvent('pointerenter', { pointerType: 'mouse' }),
      ),
    )
    assert.equal(original.playState, 'idle')
    assert.equal(bar.getAnimations().length, 1)
    assert.equal(bar.getAnimations()[0].playState, 'paused')
    await result.act(() =>
      element(result.container, 'section').dispatchEvent(
        new PointerEvent('pointerleave', { pointerType: 'mouse' }),
      ),
    )
    assert.equal(bar.getAnimations().length, 1)
    assert.equal(bar.getAnimations()[0].playState, 'running')
    await result.act(() => toastManager.add({ id, title: 'Saved', timeout: 20000 }))
    assert.equal(bar.getAnimations().length, 1)
    assert.ok(Number(bar.getAnimations()[0].effect?.getTiming().duration) > 19000)
    await result.act(() => toastManager.add({ id, title: 'Saved', timeout: false }))
    assert.equal(bar.hidden, false)
    assert.equal(bar.getAttribute('aria-hidden'), null)
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

  it('reclaims a closed identity without leaving its new toast inert', async (t) => {
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
  })
})

describe('toast availability', () => {
  it('limits availability only when configured and promotes retained overflow without reordering updates', async (t) => {
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
    assert.equal(result.$$('[data-toast]').length, 4)
    assert.equal(result.$$('[data-limited]').length, 0)
    for (let node of result.$$('[data-toast]')) {
      assert.equal(node.inert, false)
      assert.equal(node.getAttribute('aria-hidden'), null)
    }

    await result.act(() => result.root.render(view(3)))
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
    assert.equal(secondNode.inert, false)
    assert.equal(firstNode.getAttribute('aria-hidden'), null)
    assert.equal(secondNode.getAttribute('aria-hidden'), null)
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
    await result.act(() => result.root.render(view(1)))
    assert.equal(old.inert, true)
    await result.act(() => time.advance(200))
    await result.act(() => result.root.render(view(2)))
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

  it('keeps limited timers running and pauses them while the window is blurred', async (t) => {
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
    await result.act(() => window.dispatchEvent(new Event('blur')))
    time.advance(2000)
    assert.equal(toastManager.toastItems.length, 2)
    await result.act(() => window.dispatchEvent(new Event('focus')))
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
  it('collapses on pointer leave and resumes timers while a dismissed toast animates out', async (t) => {
    let toastManager = createToastManager()
    toastManager.add({ id: 'outgoing', timeout: false })
    toastManager.add({ id: 'remaining', timeout: 100000 })
    let result = render(<RetainedNotifications manager={toastManager} />)
    t.after(result.cleanup)
    let region = element(result.container, 'section')
    let outgoing = element(region, '[data-id="outgoing"]')
    await result.act(() =>
      region.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' })),
    )
    await result.act(() => toastManager.close('outgoing'))
    pauseExit(outgoing)
    await result.act(() =>
      region.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' })),
    )
    assert.equal(outgoing.isConnected, true)
    assert.equal(region.hasAttribute('data-expanded'), false)
    await result.act(() => finishExit(outgoing))
    assert.equal(outgoing.isConnected, false)
    assert.equal(region.hasAttribute('data-expanded'), false)
  })

  it('keeps hover expansion when the pointer returns before a retained exit finishes', async (t) => {
    let toastManager = createToastManager()
    toastManager.add({ id: 'outgoing', timeout: false })
    toastManager.add({ id: 'remaining', timeout: 100000 })
    let result = render(<RetainedNotifications manager={toastManager} />)
    t.after(result.cleanup)
    let region = element(result.container, 'section')
    let outgoing = element(region, '[data-id="outgoing"]')
    await result.act(() =>
      region.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' })),
    )
    await result.act(() => toastManager.close('outgoing'))
    pauseExit(outgoing)
    await result.act(() =>
      region.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' })),
    )
    await result.act(() =>
      region.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' })),
    )
    await result.act(() => finishExit(outgoing))
    assert.equal(outgoing.isConnected, false)
    assert.equal(region.hasAttribute('data-expanded'), true)
    await result.act(() =>
      region.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' })),
    )
    assert.equal(region.hasAttribute('data-expanded'), false)
  })

  it('keeps touch expansion through release and resumes timers on an outside touch', async (t) => {
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
    await result.act(() => {
      action.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', bubbles: true }))
      region.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'touch' }))
      action.click()
    })
    assert.equal(activations, 1)
    assert.equal(region.hasAttribute('data-expanded'), true)
    time.advance(2000)
    assert.equal(toastManager.toastItems.length, 1)
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
    assert.equal(region.contains(document.activeElement), false)
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

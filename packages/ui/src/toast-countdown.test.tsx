import * as assert from '@remix-run/assert'
import type { RemixNode } from '@remix-run/component'
import { render } from '@remix-run/component/test'
import { describe, it } from '@remix-run/test'
import type { TestContext } from '@remix-run/test'
import { createToastManager, Context, ItemContext, item, root } from './toast.tsx'

async function mount(t: TestContext, node: RemixNode) {
  let result = render(node)
  t.after(result.cleanup)
  await frame()
  await frame()
  return result
}

function element(container: ParentNode, selector: string): HTMLElement {
  let node = container.querySelector(selector)
  assert.ok(node instanceof HTMLElement)
  return node
}

function frame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

function Indicators() {
  return () => (
    <div data-indicators aria-hidden="true">
      <div
        data-bar
        style={{
          width: '100px',
          height: '4px',
          transformOrigin: 'left',
          transform: 'scaleX(var(--toast-countdown))',
        }}
      />
      <svg width="40" height="40" viewBox="0 0 40 40">
        <circle
          data-ring
          cx="20"
          cy="20"
          r="16"
          pathLength="100"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          stroke-dasharray="100"
          style={{ strokeDashoffset: 'calc((1 - var(--toast-countdown)) * 100px)' }}
        />
      </svg>
    </div>
  )
}

function fraction(node: Element) {
  return Number(getComputedStyle(node).getPropertyValue('--toast-countdown'))
}

function near(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 0.001, `${actual} should equal ${expected}`)
}

describe('Toast countdown indicators', () => {
  it('drives a bar and an SVG ring from the same sampled fraction without component updates', async (t) => {
    let toastManager = createToastManager()
    toastManager.add({ title: 'Saved', timeout: 10000 })
    let result = await mount(
      t,
      <Context manager={toastManager}>
        {(toastItems) => (
          <section mix={root({ label: 'Notifications' })}>
            {toastItems.map((toastItem) => (
              <ItemContext key={toastItem.id} value={toastItem.id}>
                <article mix={item({ countdown: true })}>
                  <Indicators />
                </article>
              </ItemContext>
            ))}
          </section>
        )}
      </Context>,
    )
    t.after(() => toastManager.close())
    let host = element(result.container, 'article')
    let bar = element(result.container, '[data-bar]')
    let ring = result.container.querySelector('[data-ring]')
    assert.ok(ring)
    await result.act(() =>
      element(result.container, 'section').dispatchEvent(
        new PointerEvent('pointerenter', { pointerType: 'mouse' }),
      ),
    )
    let animation = host.getAnimations()[0]
    assert.equal(animation.playState, 'paused')
    animation.currentTime = 4000
    await frame()
    near(fraction(host), 0.6)
    near(new DOMMatrix(getComputedStyle(bar).transform).a, 0.6)
    near(Number.parseFloat(getComputedStyle(ring).strokeDashoffset), 40)
    animation.currentTime = 7500
    await frame()
    near(new DOMMatrix(getComputedStyle(bar).transform).a, 0.25)
    near(Number.parseFloat(getComputedStyle(ring).strokeDashoffset), 75)
    animation.currentTime = 10000
    await frame()
    near(fraction(host), 0)
    near(Number.parseFloat(getComputedStyle(ring).strokeDashoffset), 100)
  })

  it('uses the local item clock for pause, resume, restart and persistent updates', async (t) => {
    let toastManager = createToastManager()
    let id = toastManager.add({ title: 'Saved', timeout: 10000 })
    let result = await mount(
      t,
      <Context manager={toastManager}>
        {(toastItems) => (
          <section mix={root({ label: 'Notifications' })}>
            {toastItems.map((toastItem) => (
              <ItemContext key={toastItem.id} value={toastItem.id}>
                <article key={toastItem.id} data-id={toastItem.id} mix={item({ countdown: true })}>
                  <Indicators />
                </article>
              </ItemContext>
            ))}
          </section>
        )}
      </Context>,
    )
    t.after(() => toastManager.close())
    let host = element(result.container, 'article')
    let original = host.getAnimations()[0]
    await result.act(() =>
      element(result.container, 'section').dispatchEvent(
        new PointerEvent('pointerenter', { pointerType: 'mouse' }),
      ),
    )
    let paused = fraction(host)
    assert.ok(paused > 0.9 && paused <= 1)
    assert.equal(original.playState, 'idle')
    assert.equal(host.getAnimations()[0].playState, 'paused')
    await frame()
    await frame()
    near(fraction(host), paused)
    await result.act(() =>
      element(result.container, 'section').dispatchEvent(
        new PointerEvent('pointerleave', { pointerType: 'mouse' }),
      ),
    )
    assert.equal(host.getAnimations()[0].playState, 'running')
    await result.act(() => toastManager.add({ id, title: 'Saved', timeout: 20000 }))
    assert.equal(host.getAnimations().length, 1)
    assert.equal(host.getAnimations()[0].effect?.getTiming().duration, 20000)
    assert.ok(fraction(host) > 0.99)
    await result.act(() => toastManager.add({ id, title: 'Saved', timeout: false }))
    assert.equal(host.hidden, false)
    assert.equal(host.getAnimations().length, 0)
    assert.equal(host.getAttribute('aria-hidden'), null)
    await result.act(() => toastManager.add({ id, title: 'Saved', timeout: 10000 }))
    let last = host.getAnimations()[0]
    result.cleanup()
    assert.equal(last.playState, 'idle')
  })

  it('only animates the countdown when enabled and cancels it when disabled', async (t) => {
    let toastManager = createToastManager()
    toastManager.add({ title: 'Saved', timeout: 10000 })
    function view(countdown?: boolean) {
      return (
        <Context manager={toastManager}>
          {(toastItems) => (
            <section mix={root({ label: 'Notifications' })}>
              {toastItems.map((toastItem) => (
                <ItemContext key={toastItem.id} value={toastItem.id}>
                  <article mix={item({ countdown })}>{toastItem.title}</article>
                </ItemContext>
              ))}
            </section>
          )}
        </Context>
      )
    }
    let result = await mount(t, view())
    t.after(() => toastManager.close())
    let host = element(result.container, 'article')
    assert.equal(host.getAnimations().length, 0)
    await result.act(() => result.root.render(view(true)))
    let animation = host.getAnimations()[0]
    assert.equal(animation.playState, 'running')
    await result.act(() => result.root.render(view(false)))
    assert.equal(animation.playState, 'idle')
    assert.equal(host.getAnimations().length, 0)
    assert.equal(host.hidden, false)
    assert.equal(host.getAttribute('aria-hidden'), null)
  })
})

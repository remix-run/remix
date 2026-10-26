import * as assert from '@remix-run/assert'
import type { Handle } from '@remix-run/component'
import { describe, it } from '@remix-run/test'
import { createToastManager, Context, ItemContext, item, countdown } from './toast.tsx'
import type { ToastRecord } from './toast.tsx'
import { element, frame, mount } from './test/animation.ts'

type Clock = Pick<ToastRecord, 'duration' | 'remaining' | 'paused'>
function Indicators({ props }: Handle<{ clock: Clock }>) {
  return () => (
    <div data-indicators mix={countdown(props.clock)}>
      <div
        data-bar
        style={{
          width: '100px',
          height: '4px',
          transformOrigin: 'left',
          transform: 'scaleX(var(--toast-remaining))',
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
          style={{ strokeDashoffset: 'calc((1 - var(--toast-remaining)) * 100px)' }}
        />
      </svg>
    </div>
  )
}

function fraction(node: Element) {
  return Number(getComputedStyle(node).getPropertyValue('--toast-remaining'))
}

function near(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 0.001, `${actual} should equal ${expected}`)
}

describe('Toast countdown indicators', () => {
  it('drives a bar and an SVG ring from the same sampled fraction without component updates', async (t) => {
    let result = await mount(
      t,
      <Indicators clock={{ duration: 10000, remaining: 6000, paused: true }} />,
    )
    let host = element(result.container, '[data-indicators]')
    let bar = element(result.container, '[data-bar]')
    let ring = result.container.querySelector('[data-ring]')
    assert.ok(ring)
    near(fraction(host), 0.6)
    near(new DOMMatrix(getComputedStyle(bar).transform).a, 0.6)
    near(Number.parseFloat(getComputedStyle(ring).strokeDashoffset), 40)
    let animation = host.getAnimations()[0]
    assert.equal(animation.playState, 'paused')
    animation.currentTime = 7500
    await frame()
    near(new DOMMatrix(getComputedStyle(bar).transform).a, 0.25)
    near(Number.parseFloat(getComputedStyle(ring).strokeDashoffset), 75)
    animation.currentTime = 10000
    await frame()
    near(fraction(host), 0)
    near(Number.parseFloat(getComputedStyle(ring).strokeDashoffset), 100)
  })

  it('uses the real manager clock for pause, resume, restart and persistent updates', async (t) => {
    let notifications = createToastManager()
    let id = notifications.add({ title: 'Saved', duration: 10000 })
    let result = await mount(
      t,
      <Context manager={notifications}>
        {(toasts) =>
          toasts.map((notification) => (
            <ItemContext key={notification.id} toast={notification}>
              <article key={notification.id} data-id={notification.id} mix={item()}>
                <Indicators clock={notification} />
              </article>
            </ItemContext>
          ))
        }
      </Context>,
    )
    t.after(() => notifications.close())
    let host = element(result.container, '[data-indicators]')
    let original = host.getAnimations()[0]
    await result.act(() => notifications.pause('manual'))
    let paused = fraction(host)
    assert.ok(paused > 0.9 && paused <= 1)
    assert.equal(original.playState, 'idle')
    assert.equal(host.getAnimations()[0].playState, 'paused')
    await frame()
    await frame()
    near(fraction(host), paused)
    await result.act(() => notifications.resume('manual'))
    assert.equal(host.getAnimations()[0].playState, 'running')
    await result.act(() => notifications.update(id, { duration: 20000 }))
    assert.equal(host.getAnimations().length, 1)
    assert.equal(host.getAnimations()[0].effect?.getTiming().duration, 20000)
    assert.ok(fraction(host) > 0.99)
    await result.act(() => notifications.update(id, { duration: 0 }))
    assert.equal(host.hidden, true)
    assert.equal(host.getAnimations().length, 0)
    assert.equal(host.getAttribute('aria-hidden'), 'true')
    await result.act(() => notifications.update(id, { duration: 10000 }))
    let last = host.getAnimations()[0]
    result.cleanup()
    assert.equal(last.playState, 'idle')
  })
})

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './iterator.example.tsx'
import { button, element, mount, waitFor } from '../../test-helpers.ts'

describe('Spring iterator example', () => {
  it('slides between highlights with intermediate positions and bounded navigation', async (t) => {
    let result = await mount(t, <Example />)
    let previous = button(result.container, 'Previous slide')
    let next = button(result.container, 'Next slide')
    let track = element(result.container, '[inert]').parentElement
    assert.ok(track)
    assert.equal(previous.disabled, true)
    assert.ok(Math.abs(track.children[0].getBoundingClientRect().width - track.clientWidth) < 1)
    let x = () => new DOMMatrixReadOnly(getComputedStyle(track).transform).m41
    let started = performance.now()
    let samples: { phase: string; time: number; x: number; width: number; transform: string }[] = []

    let frames: { name: string; requested: number; fired: number; timestamp: number }[] = []
    let heartbeats: number[] = []
    let workerHeartbeats: { sent: number; received: number }[] = []
    let workerUrl = URL.createObjectURL(
      new Blob(['setInterval(() => postMessage(Date.now()), 100)'], { type: 'text/javascript' }),
    )
    let worker = new Worker(workerUrl)
    worker.addEventListener('message', (event: MessageEvent<number>) => {
      workerHeartbeats.push({
        sent: event.data - (performance.timeOrigin + started),
        received: performance.now() - started,
      })
    })
    t.after(() => {
      worker.terminate()
      URL.revokeObjectURL(workerUrl)
    })
    let lastTick = started
    let requestFrame = window.requestAnimationFrame.bind(window)
    t.mock.method(window, 'requestAnimationFrame', (callback: FrameRequestCallback) => {
      let requested = performance.now() - started
      return requestFrame((timestamp) => {
        if (callback.name === 'tick') {
          let now = performance.now()
          if (now - lastTick > 500) console.log('Spring frame pause', now - lastTick)
          lastTick = now
        }
        frames.push({
          name: callback.name,
          requested,
          fired: performance.now() - started,
          timestamp,
        })
        callback(timestamp)
      })
    })
    let heartbeat = setInterval(() => heartbeats.push(performance.now() - started), 100)
    t.after(() => clearInterval(heartbeat))

    async function expectPosition(phase: string, check: () => void) {
      let target = track
      assert.ok(target)
      try {
        await waitFor(() => {
          samples.push({
            phase,
            time: performance.now() - started,
            x: x(),
            width: target.clientWidth,
            transform: target.style.transform,
          })
          check()
        })
      } catch (error) {
        throw new Error(
          `Spring position diagnostics: ${JSON.stringify({
            phase,
            startedAt: performance.timeOrigin + started,
            reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
            visibility: document.visibilityState,
            connected: target.isConnected,
            previousDisabled: previous.disabled,
            nextDisabled: next.disabled,
            frameBounds: window.frameElement?.getBoundingClientRect().toJSON(),
            parentVisibility: window.parent.document.visibilityState,
            focused: document.hasFocus(),
            samples,
            frames,
            heartbeats,
            workerHeartbeats,
          })}`,
          { cause: error },
        )
      }
    }

    await result.act(() => next.click())
    await expectPosition('first slide intermediate', () =>
      assert.ok(x() < 0 && x() > -track.clientWidth),
    )
    await expectPosition('first slide destination', () =>
      assert.ok(Math.abs(x() + track.clientWidth) < 1),
    )
    assert.equal(previous.disabled, false)
    assert.equal(track.children[1].getAttribute('aria-hidden'), 'false')
    await result.act(() => next.click())
    await expectPosition('second slide destination', () =>
      assert.ok(Math.abs(x() + track.clientWidth * 2) < 1),
    )
    assert.equal(next.disabled, true)
    await result.act(() => previous.click())
    await expectPosition('previous slide destination', () =>
      assert.ok(Math.abs(x() + track.clientWidth) < 1),
    )
    assert.equal(next.disabled, false)
    console.log(
      'Spring diagnostics passed:',
      JSON.stringify({
        startedAt: performance.timeOrigin + started,
        samples,
        frames,
        heartbeats,
        workerHeartbeats,
      }),
    )
  })
})

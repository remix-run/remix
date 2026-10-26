import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { on, ref } from '@remix-run/component'
import type { Handle } from '@remix-run/component'
import { animateEntrance, animateExit } from './animate-mixins.ts'
import type { AnimateMixinConfig } from './animate-mixins.ts'
import { animateLayout } from './animate-layout-mixin.ts'
import { drag } from './drag-mixin.ts'
import { createNativeAnimationPlayback, retainAnimationHost } from './animation-host.ts'
import { button, element, frame, mount, waitFor, pointer, position } from '../test/animation.ts'

function referenceEntrance(config: AnimateMixinConfig) {
  let { duration, easing, delay, composite, transition, initial, ...styles } = config
  return ref((node: HTMLElement) => {
    let keyframe: Keyframe = {}
    for (let [property, value] of Object.entries(styles)) {
      if (typeof value === 'number' || typeof value === 'string') keyframe[property] = value
    }
    node.animate([keyframe, {}], {
      duration,
      easing,
      delay,
      composite,
    })
  })
}

function pause(node: HTMLElement, time: number) {
  for (let animation of node.getAnimations()) {
    animation.pause()
    animation.currentTime = time
  }
}
function finish(node: HTMLElement) {
  for (let animation of node.getAnimations()) animation.finish()
}
function near(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 0.15, `${actual} should equal ${expected}`)
}

describe('Animation mixin composition', () => {
  it('matches native entrance pixels, opacity, delay and easing without a gesture', async (t) => {
    let config = {
      translate: '20px 80px',
      opacity: 0,
      duration: 1000,
      delay: 100,
      easing: 'ease-out',
    }
    let result = await mount(
      t,
      <div>
        <article aria-label="reference" mix={referenceEntrance(config)} />
        <article aria-label="shared" mix={animateEntrance(config)} />
      </div>,
    )
    let current = element(result.container, '[aria-label="reference"]')
    let shared = element(result.container, '[aria-label="shared"]')
    pause(current, 600)
    pause(shared, 600)
    near(position(shared).x, position(current).x)
    near(position(shared).y, position(current).y)
    near(Number(getComputedStyle(shared).opacity), Number(getComputedStyle(current).opacity))
    finish(current)
    finish(shared)
    await frame()
    near(position(shared).x, 0)
    near(position(shared).y, 0)
  })

  it('takes over the visible entrance on x while y and opacity keep playing', async (t) => {
    let result = await mount(
      t,
      <article
        mix={[
          drag({ axis: 'x', momentum: false }),
          animateEntrance({
            translate: '80px 40px',
            opacity: 0,
            duration: 1000,
            easing: 'linear',
          }),
        ]}
      />,
    )
    let note = element(result.container, 'article')
    pause(note, 500)
    near(position(note).x, 40)
    near(position(note).y, 20)
    pointer(note, 'pointerdown', 0, 0)
    pointer(note, 'pointermove', 20, 0)
    near(position(note).x, 60)
    near(position(note).y, 20)
    near(Number(getComputedStyle(note).opacity), 0.5)
    finish(note)
    await frame()
    near(position(note).x, 60)
    near(position(note).y, 0)
    pointer(note, 'pointerup', 20, 0)
  })

  it('preserves the pointer position across same-axis layout movement and further moves', async (t) => {
    let move: (() => void) | undefined
    function Fixture(handle: Handle) {
      let down = false
      move = () => {
        down = !down
        handle.update()
      }
      return () => (
        <article
          style={{
            position: 'absolute',
            left: '20px',
            top: down ? '140px' : '40px',
            width: '80px',
            height: '80px',
          }}
          mix={[drag({ momentum: false }), animateLayout({ size: false, duration: 500 })]}
        />
      )
    }
    let result = await mount(t, <Fixture />)
    let note = element(result.container, 'article')
    let before = note.getBoundingClientRect()
    pointer(note, 'pointerdown', 0, 0)
    pointer(note, 'pointermove', 20, 20)
    assert.ok(move)
    move()
    await frame()
    finish(note)
    await frame()
    near(note.getBoundingClientRect().top, before.top + 20)
    pointer(note, 'pointermove', 35, 30)
    near(note.getBoundingClientRect().top, before.top + 30)
    near(note.getBoundingClientRect().left, before.left + 35)
    pointer(note, 'pointerup', 35, 30)
    near(note.getBoundingClientRect().top, before.top + 30)
  })

  it('projects layout position and size with linear playback', async (t) => {
    let move: (() => void) | undefined
    function Fixture(handle: Handle) {
      let moved = false
      move = () => {
        moved = !moved
        handle.update()
      }
      let config = { duration: 1000, easing: 'linear' }
      return () => (
        <div>
          {(['reference', 'shared'] as const).map((system) => (
            <div style={{ position: 'relative', width: '400px', height: '160px' }}>
              <article
                aria-label={system}
                style={{
                  position: 'absolute',
                  left: moved ? '120px' : '20px',
                  top: '20px',
                  width: moved ? '140px' : '80px',
                  height: moved ? '100px' : '60px',
                }}
                mix={system === 'shared' ? animateLayout(config) : []}
              />
            </div>
          ))}
        </div>
      )
    }
    let result = await mount(t, <Fixture />)
    let current = element(result.container, '[aria-label="reference"]')
    let shared = element(result.container, '[aria-label="shared"]')
    assert.ok(move)
    move()
    await frame()
    pause(current, 500)
    pause(shared, 500)
    near(shared.getBoundingClientRect().left, current.getBoundingClientRect().left - 50)
    near(shared.getBoundingClientRect().width, 110)
    near(shared.getBoundingClientRect().height, 80)
    finish(current)
    finish(shared)
    await frame()
    near(shared.getBoundingClientRect().width, 140)
    move()
    await frame()
    finish(current)
    finish(shared)
    await frame()
    near(shared.getBoundingClientRect().width, 80)
  })

  it('keeps authored translation, rotation and scale after all mixins detach', async (t) => {
    let detach: (() => void) | undefined
    function Fixture(handle: Handle) {
      let active = true
      detach = () => {
        active = false
        handle.update()
      }
      return () => (
        <article
          style={{
            width: '100px',
            height: '80px',
            translate: '25% 10px',
            transform: 'rotate(-8deg)',
            scale: '1.1',
          }}
          mix={active ? [drag({ momentum: false }), animateLayout()] : []}
        />
      )
    }
    let result = await mount(t, <Fixture />)
    let note = element(result.container, 'article')
    near(position(note).x, 25)
    near(position(note).y, 10)
    assert.ok(detach)
    detach()
    await frame()
    assert.equal(note.style.translate, '25% 10px')
    assert.equal(note.style.transform, 'rotate(-8deg)')
    assert.equal(note.style.scale, '1.1')
    assert.equal(note.style.getPropertyValue('--rmx-animation-x'), '')
  })

  it('retains exits and immediate structural styles, then reclaims the same DOM', async (t) => {
    function Fixture(handle: Handle) {
      let visible = true
      let config = {
        translate: '80px 0',
        opacity: 0,
        zIndex: -1,
        duration: 1000,
        easing: 'linear',
        transition: {
          zIndex: { duration: 0 },
        },
      }
      return () => (
        <div>
          <button
            mix={on('click', () => {
              visible = !visible
              handle.update()
            })}
          >
            Toggle
          </button>
          {visible && (
            <article
              key="shared"
              aria-label="shared"
              mix={[drag({ momentum: false }), animateLayout(), animateExit(config)]}
            />
          )}
        </div>
      )
    }
    let result = await mount(t, <Fixture />)
    let shared = element(result.container, '[aria-label="shared"]')
    button(result.container, 'Toggle').click()
    await frame()
    pause(shared, 500)
    assert.equal(shared.inert, true)
    assert.equal(getComputedStyle(shared).zIndex, '-1')
    near(position(shared).x, 40)
    near(Number(getComputedStyle(shared).opacity), 0.5)
    button(result.container, 'Toggle').click()
    await frame()
    assert.equal(element(result.container, '[aria-label="shared"]'), shared)
    assert.equal(shared.inert, false)
    finish(shared)
    await frame()
    near(position(shared).x, 0)
    pointer(shared, 'pointerdown', 0, 0)
    pointer(shared, 'pointermove', 20, 0)
    near(position(shared).x, 20)
    pointer(shared, 'pointerup', 20, 0)
  })

  it('ends an active gesture when exit takes over and removes after playback', async (t) => {
    function Fixture(handle: Handle) {
      let visible = true
      return () => (
        <div>
          <button
            mix={on('click', () => {
              visible = false
              handle.update()
            })}
          >
            Remove
          </button>
          {visible && (
            <article
              mix={[animateExit({ translate: '80px 0', duration: 1000 }), animateLayout(), drag()]}
            />
          )}
        </div>
      )
    }
    let result = await mount(t, <Fixture />)
    let note = element(result.container, 'article')
    pointer(note, 'pointerdown', 0, 0)
    pointer(note, 'pointermove', 30, 20)
    button(result.container, 'Remove').click()
    await frame()
    assert.equal(note.hasAttribute('data-dragging'), false)
    assert.ok(note.inert)
    pause(note, 500)
    let held = position(note).x
    pointer(note, 'pointermove', 100, 100)
    near(position(note).x, held)
    finish(note)
    await waitFor(() => assert.equal(note.isConnected, false))
  })
  it('restores idle CSS semantics instead of retaining identity transforms', async (t) => {
    let result = await mount(
      t,
      <article
        style={{ position: 'absolute', left: '80px', top: '60px' }}
        mix={[
          drag({ momentum: false }),
          animateLayout(),
          animateEntrance({ opacity: 0, duration: 1000 }),
        ]}
      >
        <div style={{ position: 'fixed', left: '5px', top: '7px' }} />
      </article>,
    )
    let note = element(result.container, 'article')
    finish(note)
    await frame()
    assert.equal(getComputedStyle(note).translate, 'none')
    assert.equal(getComputedStyle(note).transform, 'none')
    let fixed = element(note, 'div')
    near(fixed.getBoundingClientRect().left, 5)
    pointer(note, 'pointerdown', 0, 0)
    pointer(note, 'pointermove', 20, 10)
    pointer(note, 'pointermove', 0, 0)
    pointer(note, 'pointerup', 0, 0)
    assert.equal(getComputedStyle(note).translate, 'none')
    near(fixed.getBoundingClientRect().left, 5)
  })

  it('absorbs an active layout projection when picked up without stopping the other axis', async (t) => {
    let move: (() => void) | undefined
    function Fixture(handle: Handle) {
      let moved = false
      move = () => {
        moved = true
        handle.update()
      }
      return () => (
        <article
          style={{
            position: 'absolute',
            left: moved ? '120px' : '20px',
            top: moved ? '120px' : '20px',
            width: '80px',
            height: '80px',
          }}
          mix={[
            animateLayout({ size: false, duration: 1000, easing: 'linear' }),
            drag({ axis: 'x', momentum: false }),
          ]}
        />
      )
    }
    let result = await mount(t, <Fixture />)
    let note = element(result.container, 'article')
    assert.ok(move)
    move()
    await frame()
    pause(note, 500)
    let before = note.getBoundingClientRect()
    pointer(note, 'pointerdown', 0, 0)
    pointer(note, 'pointermove', 20, 0)
    near(note.getBoundingClientRect().left, before.left + 20)
    finish(note)
    await frame()
    near(note.getBoundingClientRect().left, before.left + 20)
    near(note.getBoundingClientRect().top, 120)
    pointer(note, 'pointerup', 20, 0)
  })

  it('keeps raw transform entrance interpolation independent from position and preserves the authored endpoint', async (t) => {
    let result = await mount(
      t,
      <div>
        <article
          aria-label="reference"
          style={{ transform: 'rotate(-8deg)' }}
          mix={referenceEntrance({
            transform: 'scale(0.5)',
            duration: 1000,
            easing: 'linear',
          })}
        />
        <article
          aria-label="shared"
          style={{ transform: 'rotate(-8deg)' }}
          mix={[
            drag({ momentum: false }),
            animateLayout(),
            animateEntrance({
              transform: 'scale(0.5)',
              duration: 1000,
              easing: 'linear',
            }),
          ]}
        />
      </div>,
    )
    let current = element(result.container, '[aria-label="reference"]')
    let shared = element(result.container, '[aria-label="shared"]')
    pause(current, 500)
    pause(shared, 500)
    let a = new DOMMatrix(getComputedStyle(current).transform)
    let b = new DOMMatrix(getComputedStyle(shared).transform)
    near(a.a, b.a)
    near(a.b, b.b)
    pointer(shared, 'pointerdown', 0, 0)
    pointer(shared, 'pointermove', 20, 0)
    near(position(shared).x, 20)
    finish(current)
    finish(shared)
    await frame()
    assert.equal(shared.style.transform, 'rotate(-8deg)')
    pointer(shared, 'pointerup', 20, 0)
  })
  it('matches native additive translation on all three axes', async (t) => {
    let config = {
      translate: '20px 40px 30px',
      duration: 1000,
      easing: 'linear',
      composite: 'add' as const,
    }
    let result = await mount(
      t,
      <div>
        <article
          aria-label="reference"
          style={{ translate: '10px 5px 2px' }}
          mix={referenceEntrance(config)}
        />
        <article
          aria-label="shared"
          style={{ translate: '10px 5px 2px' }}
          mix={[drag({ momentum: false }), animateEntrance(config)]}
        />
      </div>,
    )
    let current = element(result.container, '[aria-label="reference"]')
    let shared = element(result.container, '[aria-label="shared"]')
    pause(current, 500)
    pause(shared, 500)
    let currentPosition = getComputedStyle(current).translate.split(' ').map(Number.parseFloat)
    let sharedPosition = getComputedStyle(shared).translate.split(' ').map(Number.parseFloat)
    near(sharedPosition[0], currentPosition[0])
    near(sharedPosition[1], currentPosition[1])
    near(sharedPosition[2], currentPosition[2])
    finish(current)
    finish(shared)
    await frame()
    assert.equal(getComputedStyle(shared).translate, getComputedStyle(current).translate)
  })
  it('replaces a competing opacity playback without stopping the other animated properties', async (t) => {
    let result = await mount(
      t,
      <article
        mix={[
          drag(),
          animateEntrance({
            opacity: 0,
            scale: '0.5',
            duration: 1000,
            easing: 'linear',
          }),
        ]}
      />,
    )
    let note = element(result.container, 'article')
    pause(note, 500)
    let registration = retainAnimationHost(note)
    t.after(() => registration.dispose())
    let playback = registration.playStyle('opacity', [{}, { opacity: 0.2 }], {
      duration: 1000,
      easing: 'linear',
      fill: 'forwards',
    })
    playback.animation.pause()
    playback.animation.currentTime = 500
    near(Number(getComputedStyle(note).opacity), 0.35)
    near(parseFloat(getComputedStyle(note).scale), 0.75)
    for (let animation of note.getAnimations())
      if (animation !== playback.animation) animation.finish()
    await frame()
    near(Number(getComputedStyle(note).opacity), 0.35)
    near(parseFloat(getComputedStyle(note).scale) || 1, 1)
    playback.stop()
  })

  it('applies layout projection before host tasks queued ahead of the update', async (t) => {
    let move: (() => void) | undefined
    let observed = 0
    let node: HTMLElement | undefined
    function Fixture(handle: Handle) {
      let moved = false
      move = () => {
        handle.queueTask(() => {
          observed = node?.getBoundingClientRect().left ?? 0
        })
        moved = true
        handle.update()
      }
      return () => (
        <article
          style={{ width: '60px', height: '60px', marginLeft: moved ? '100px' : '0' }}
          mix={animateLayout({ duration: 10000, easing: 'linear' })}
        />
      )
    }
    let result = await mount(t, <Fixture />)
    node = element(result.container, 'article')
    let initial = node.getBoundingClientRect().left
    await result.act(() => move?.())
    near(observed, initial)
    assert.ok(node.getAnimations().length > 0)
  })

  it('resolves additive exit targets once after a previous drag', async (t) => {
    let remove: (() => void) | undefined
    function Fixture(handle: Handle) {
      let visible = true
      remove = () => {
        visible = false
        handle.update()
      }
      return () =>
        visible && (
          <article
            mix={[
              drag({ axis: 'x', momentum: false }),
              animateExit({
                translate: '80px 0',
                duration: 1000,
                easing: 'linear',
                composite: 'add',
              }),
            ]}
          />
        )
    }
    let result = await mount(t, <Fixture />)
    let node = element(result.container, 'article')
    pointer(node, 'pointerdown', 0, 0)
    pointer(node, 'pointermove', 40, 0)
    pointer(node, 'pointerup', 40, 0)
    near(position(node).x, 40)
    assert.ok(remove)
    remove()
    await frame()
    pause(node, 500)
    near(position(node).x, 80)
  })

  it('allows direction locking to leave the unused entrance axis playing', async (t) => {
    let result = await mount(
      t,
      <article
        mix={[
          drag({ directionLock: true, momentum: false }),
          animateEntrance({
            translate: '80px 40px',
            duration: 1000,
            easing: 'linear',
          }),
        ]}
      />,
    )
    let node = element(result.container, 'article')
    pause(node, 500)
    pointer(node, 'pointerdown', 0, 0)
    pointer(node, 'pointermove', 20, 1)
    near(position(node).x, 60)
    for (let animation of node.getAnimations()) animation.finish()
    await frame()
    near(position(node).y, 0)
    near(position(node).x, 60)
    pointer(node, 'pointerup', 20, 1)
  })

  it('restores inline style priority when the last animation mixin detaches', async (t) => {
    let detach: (() => void) | undefined
    function Fixture(handle: Handle) {
      let active = true
      detach = () => {
        active = false
        handle.update()
      }
      return () => (
        <article
          mix={[
            ref((node) => node.style.setProperty('translate', '10px 5px', 'important')),
            ...(active ? [drag({ momentum: false }), animateLayout()] : []),
          ]}
        />
      )
    }
    let result = await mount(t, <Fixture />)
    let node = element(result.container, 'article')
    pointer(node, 'pointerdown', 0, 0)
    pointer(node, 'pointermove', 20, 0)
    pointer(node, 'pointerup', 20, 0)
    assert.ok(detach)
    detach()
    await frame()
    assert.equal(node.style.getPropertyPriority('translate'), 'important')
    assert.equal(node.style.translate, '10px 5px')
  })
  it('hands the current native playback position to a new owner without stale cleanup', async (t) => {
    let result = await mount(t, <article />)
    let node = element(result.container, 'article')
    let animation = retainAnimationHost(node)
    let gesture = retainAnimationHost(node)
    t.after(() => {
      animation.dispose()
      gesture.dispose()
    })
    let value = animation.claim('x', 'animation')
    assert.ok(value)
    let playback = createNativeAnimationPlayback(node, 'x', 0, 80, {
      duration: 1000,
      easing: 'linear',
    })
    value.start(playback.backend)
    playback.animation.pause()
    playback.animation.currentTime = 500
    let pickedUp = gesture.claim('x', 'gesture')
    assert.ok(pickedUp)
    near(pickedUp.read(), 40)
    pickedUp.set(65)
    value.release()
    await frame()
    near(position(node).x, 65)
    assert.equal(animation.claim('x', 'animation'), undefined)
  })

  it('preserves an active layout animation when only drag is detached', async (t) => {
    let update: (() => void) | undefined
    let detach: (() => void) | undefined
    function Fixture(handle: Handle) {
      let changed = false
      let draggable = true
      update = () => {
        changed = true
        handle.update()
      }
      detach = () => {
        draggable = false
        handle.update()
      }
      return () => (
        <article
          style={{
            position: 'absolute',
            left: changed ? '100px' : '0px',
            width: '80px',
            height: '80px',
          }}
          mix={[
            animateLayout({ size: false, duration: 1000, easing: 'linear' }),
            ...(draggable ? [drag({ axis: 'y' })] : []),
          ]}
        />
      )
    }
    let result = await mount(t, <Fixture />)
    let node = element(result.container, 'article')
    assert.ok(update && detach)
    update()
    await frame()
    pause(node, 500)
    let before = node.getBoundingClientRect().left
    detach()
    await frame()
    near(node.getBoundingClientRect().left, before)
    for (let animation of node.getAnimations()) animation.finish()
    await frame()
    near(node.getBoundingClientRect().left, 100)
    assert.equal(getComputedStyle(node).transform, 'none')
  })

  it('composes drag and presence in reversed attachment order', async (t) => {
    let result = await mount(
      t,
      <article
        mix={[
          animateEntrance({
            translate: '80px 40px',
            duration: 1000,
            easing: 'linear',
          }),
          animateLayout(),
          drag({ axis: 'x', momentum: false }),
        ]}
      />,
    )
    let node = element(result.container, 'article')
    pause(node, 500)
    pointer(node, 'pointerdown', 0, 0)
    pointer(node, 'pointermove', 20, 0)
    near(position(node).x, 60)
    near(position(node).y, 20)
    for (let animation of node.getAnimations()) animation.finish()
    await frame()
    near(position(node).x, 60)
    near(position(node).y, 0)
    pointer(node, 'pointerup', 20, 0)
  })
})

import assert, { expect } from '@remix-run/assert'
import { describe, it, mock } from '@remix-run/test'
import type { TestContext } from '@remix-run/test'
import { createMixin, createRoot } from '@remix-run/component'
import type { Handle } from '@remix-run/component'
import { animateEntrance, animateExit } from './animate-mixins.ts'
import { animateLayout } from './animate-layout-mixin.ts'

describe('animate entrance/exit mixins', () => {
  it('reclaims persisted nodes by type/key and reuses the same DOM element', () => {
    let container = document.createElement('div')
    let root = createRoot(container)

    root.render(
      <div key="item" id="reclaim-target" mix={[animateExit({ opacity: 0, duration: 150 })]} />,
    )
    root.flush()

    let first = container.querySelector('#reclaim-target')
    assert(first)

    root.render(null)
    root.flush()
    expect(container.querySelector('#reclaim-target')).toBe(first)

    root.render(
      <div key="item" id="reclaim-target" mix={[animateExit({ opacity: 0, duration: 150 })]} />,
    )
    root.flush()

    let second = container.querySelector('#reclaim-target')
    expect(second).toBe(first)
  })

  it('retargets reclaim to natural styles instead of reversing exit animation', async () => {
    let reverse = mock.fn()
    let commitStyles = mock.fn()
    let cancel = mock.fn()
    let animateSpy = mock.method(
      HTMLElement.prototype,
      'animate',
      () =>
        ({
          playState: 'running',
          reverse,
          commitStyles,
          cancel,
          finished: new Promise(() => {}),
        }) as unknown as Animation,
    )

    let container = document.createElement('div')
    let root = createRoot(container)

    root.render(
      <div key="item" id="reverse-target" mix={[animateExit({ opacity: 0, duration: 150 })]} />,
    )
    root.flush()

    root.render(null)
    root.flush()
    await Promise.resolve()
    expect(animateSpy).toHaveBeenCalledTimes(1)

    root.render(
      <div key="item" id="reverse-target" mix={[animateExit({ opacity: 0, duration: 150 })]} />,
    )
    root.flush()
    await Promise.resolve()

    expect(reverse).toHaveBeenCalledTimes(0)
    expect(commitStyles).toHaveBeenCalledTimes(1)
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(animateSpy).toHaveBeenCalledTimes(2)
    animateSpy.mock.restore!()
  })

  it('does not reverse on initial insert when entrance and exit mixins are both present', () => {
    let reverse = mock.fn()
    let animateSpy = mock.method(
      HTMLElement.prototype,
      'animate',
      () =>
        ({
          playState: 'running',
          reverse,
          finished: new Promise(() => {}),
        }) as unknown as Animation,
    )

    let container = document.createElement('div')
    let root = createRoot(container)
    root.render(
      <div
        key="both"
        id="both-mixins-target"
        mix={[
          animateEntrance({ opacity: 0, duration: 150 }),
          animateExit({ opacity: 0, duration: 150 }),
        ]}
      />,
    )
    root.flush()

    expect(animateSpy).toHaveBeenCalledTimes(1)
    expect(reverse).toHaveBeenCalledTimes(0)
    animateSpy.mock.restore!()
  })

  it('keeps persist behavior after reclaim interruption completes', async (t) => {
    let { root, container } = createTestRoot(t)
    let mix = [
      animateEntrance({ opacity: 0, duration: 1000 }),
      animateExit({ opacity: 0, duration: 1000 }),
    ]

    root.render(<div key="item" id="persist-after-interrupt" mix={mix} />)
    root.flush()

    root.render(null)
    root.flush()
    expect(container.querySelector('#persist-after-interrupt')).not.toBe(null)

    root.render(<div key="item" id="persist-after-interrupt" mix={mix} />)
    root.flush()
    let node = container.firstElementChild
    assert(node)
    let returning = node.getAnimations()[0]
    assert(returning)
    returning.finish()
    await new Promise(requestAnimationFrame)

    root.render(null)
    root.flush()
    expect(container.querySelector('#persist-after-interrupt')).not.toBe(null)
  })

  it('skips first entrance when initial is false, but animates on reclaimed add', async () => {
    let animateSpy = mock.method(
      HTMLElement.prototype,
      'animate',
      () =>
        ({
          playState: 'running',
          reverse: mock.fn(),
          commitStyles: mock.fn(),
          cancel: mock.fn(),
          finished: new Promise(() => {}),
        }) as unknown as Animation,
    )

    let container = document.createElement('div')
    let root = createRoot(container)
    let mix = [
      animateEntrance({ initial: false, opacity: 0, duration: 100 }),
      animateExit({ opacity: 0, duration: 100 }),
    ]

    root.render(<div key="initial-false" id="initial-false-target" mix={mix} />)
    root.flush()
    expect(animateSpy).toHaveBeenCalledTimes(0)

    root.render(null)
    root.flush()
    await Promise.resolve()
    expect(animateSpy).toHaveBeenCalledTimes(1)

    root.render(<div key="initial-false" id="initial-false-target" mix={mix} />)
    root.flush()
    await Promise.resolve()
    expect(animateSpy).toHaveBeenCalledTimes(2)

    animateSpy.mock.restore!()
  })
})

function createTestRoot(t: TestContext) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  t.after(() => {
    root.dispose()
    container.remove()
  })
  return { root, container }
}

function animationFor(node: Element, property: string): Animation {
  let animation = node.getAnimations().find((animation) => {
    let effect = animation.effect
    return (
      effect instanceof KeyframeEffect && effect.getKeyframes().some((frame) => property in frame)
    )
  })
  assert(animation, `Missing animation for ${property}`)
  return animation
}

describe('per-property animation transitions', () => {
  it('uses per-property entrance overrides while other properties inherit shared settings', (t) => {
    let { root, container } = createTestRoot(t)
    root.render(
      <div
        style={{ opacity: 1, translate: '10px 0' }}
        mix={animateEntrance({
          opacity: 0,
          translate: '20px 0',
          duration: 1000,
          delay: 100,
          easing: 'ease-in',
          composite: 'replace',
          transition: {
            opacity: { duration: undefined },
            translate: { duration: 500, delay: 0, easing: 'linear', composite: 'add' },
          },
        })}
      />,
    )
    root.flush()
    let node = container.firstElementChild
    assert(node)
    let fade = animationFor(node, 'opacity')
    let slide = animationFor(node, 'translate')
    fade.pause()
    slide.pause()
    fade.currentTime = 600
    slide.currentTime = 250
    expect(Number(getComputedStyle(node).opacity)).toBeCloseTo(0.315, 2)
    expect(getComputedStyle(node).translate).toBe('20px')
  })

  it('applies zero-duration exits immediately and waits for longer animations', async (t) => {
    let { root, container } = createTestRoot(t)
    root.render(
      <>
        <div
          style={{ position: 'relative', translate: '10px 0' }}
          mix={animateExit({
            position: 'absolute',
            translate: '5px 0',
            opacity: 0,
            scale: 0.5,
            duration: 1000,
            transition: {
              position: { duration: 0 },
              translate: { duration: 0, composite: 'add' },
              opacity: { duration: 500 },
            },
          })}
        />
        <div mix={animateExit({ position: 'absolute', duration: 0 })} />
      </>,
    )
    root.flush()
    let [node, immediate] = container.children
    root.render(null)
    root.flush()
    expect(getComputedStyle(node).position).toBe('absolute')
    expect(getComputedStyle(immediate).position).toBe('absolute')
    expect(getComputedStyle(node).translate).toBe('15px')
    let fade = animationFor(node, 'opacity')
    let scale = animationFor(node, 'scale')
    fade.pause()
    scale.pause()
    fade.currentTime = 500
    scale.currentTime = 500
    expect(getComputedStyle(node).opacity).toBe('0')
    expect(getComputedStyle(node).scale).toBe('0.75')
    fade.finish()
    await new Promise(requestAnimationFrame)
    expect(node.isConnected).toBe(true)
    expect(immediate.isConnected).toBe(false)
    scale.finish()
    await new Promise(requestAnimationFrame)
    expect(node.isConnected).toBe(false)
  })

  it('inherits a positive exit delay and allows a property to override it', async (t) => {
    let { root, container } = createTestRoot(t)
    root.render(
      <div
        mix={animateExit({
          position: 'absolute',
          opacity: 0,
          duration: 1000,
          delay: 10000,
          transition: { position: { duration: 0 }, opacity: { delay: 0 } },
        })}
      />,
    )
    root.flush()
    let node = container.firstElementChild
    assert(node)
    root.render(null)
    root.flush()
    let position = animationFor(node, 'position')
    let fade = animationFor(node, 'opacity')
    position.pause()
    fade.pause()
    position.currentTime = 9999
    fade.currentTime = 500
    expect(getComputedStyle(node).position).toBe('static')
    expect(getComputedStyle(node).opacity).toBe('0.5')
    fade.finish()
    await new Promise(requestAnimationFrame)
    expect(node.isConnected).toBe(true)
    position.finish()
    await new Promise(requestAnimationFrame)
    expect(node.isConnected).toBe(false)
  })
})

describe('interrupted exit animations', () => {
  it('returns smoothly from the current exit appearance to updated styles', async (t) => {
    let { root, container } = createTestRoot(t)
    let exit = animateExit({
      position: 'absolute',
      opacity: 0,
      duration: 1000,
      transition: { position: { duration: 0 } },
    })
    root.render(<div key="item" style={{ position: 'relative', opacity: 1 }} mix={exit} />)
    root.flush()
    let node = container.firstElementChild
    assert(node)
    root.render(null)
    root.flush()
    await Promise.resolve()
    let fade = animationFor(node, 'opacity')
    fade.pause()
    fade.currentTime = 500
    let opacity = getComputedStyle(node).opacity
    root.render(<div key="item" style={{ position: 'fixed', opacity: 0.8 }} mix={exit} />)
    root.flush()
    let returning = animationFor(node, 'opacity')
    returning.pause()
    returning.currentTime = 0
    expect(getComputedStyle(node).position).toBe('fixed')
    expect(getComputedStyle(node).opacity).toBe(opacity)
    returning.finish()
    await new Promise(requestAnimationFrame)
    expect(container.firstElementChild).toBe(node)
    expect(getComputedStyle(node).opacity).toBe('0.8')
  })
})

describe('exit animations with other mixins', () => {
  it('removes elements even when another removal listener cancels their animations', async (t) => {
    let { root, container } = createTestRoot(t)
    let cancelAnimations = createMixin((handle) => {
      let node: Element | undefined
      handle.addEventListener('insert', (event) => {
        node = event.node
      })
      handle.addEventListener('beforeRemove', () => {
        for (let animation of node?.getAnimations() ?? []) animation.cancel()
      })
    })
    root.render(
      <>
        <div mix={[animateExit({ opacity: 0, duration: 1000 }), cancelAnimations()]} />
        <div mix={[animateExit({ opacity: 0, duration: 0 }), cancelAnimations()]} />
      </>,
    )
    root.flush()
    root.render(null)
    root.flush()
    await new Promise(requestAnimationFrame)
    expect(container.childElementCount).toBe(0)
  })

  it('measures sibling layout after a negative exit delay changes height', (t) => {
    let { root, container } = createTestRoot(t)
    let visible = true
    let update: (() => void) | undefined
    function List(handle: Handle) {
      update = () => {
        handle.update()
      }
      return () => (
        <section>
          {visible && (
            <div
              key="exiting"
              style={{ height: '60px' }}
              mix={animateExit({ height: '0px', duration: 1000, delay: -500 })}
            />
          )}
          <div key="remaining" style={{ height: '60px' }} mix={animateLayout({ duration: 1000 })} />
        </section>
      )
    }
    root.render(<List />)
    root.flush()
    let exiting = container.firstElementChild?.firstElementChild
    let remaining = exiting?.nextElementSibling
    assert(exiting && remaining && update)
    let previousTop = remaining.getBoundingClientRect().top
    visible = false
    update()
    root.flush()
    let layout = animationFor(remaining, 'transform')
    layout.pause()
    layout.currentTime = 0
    expect(remaining.getBoundingClientRect().top).toBe(previousTop)
    layout.finish()
    expect(remaining.getBoundingClientRect().top).toBe(previousTop - 30)
  })

  it('cancels exit effects when their parent is removed', async (t) => {
    let { root, container } = createTestRoot(t)
    root.render(
      <section>
        <div mix={animateExit({ opacity: 0, duration: 1000 })} />
      </section>,
    )
    root.flush()
    let node = container.firstElementChild?.firstElementChild
    assert(node)
    root.render(<section />)
    root.flush()
    let exiting = animationFor(node, 'opacity')
    root.render(null)
    root.flush()
    await Promise.resolve()
    expect(node.isConnected).toBe(false)
    expect(exiting.playState).toBe('idle')
  })

  it("cleans up failed exit setup without ending another mixin's deferred removal", async (t) => {
    let { root, container } = createTestRoot(t)
    let removal = Promise.withResolvers<void>()
    t.after(() => removal.resolve())
    let retain = createMixin((handle) => {
      handle.addEventListener('beforeRemove', (event) => event.persistNode(() => removal.promise))
    })
    root.render(
      <div
        mix={[
          animateExit({
            position: 'absolute',
            opacity: 0,
            scale: 0.5,
            duration: 1000,
            transition: { position: { duration: 0 }, scale: { easing: 'invalid-easing' } },
          }),
          retain(),
        ]}
      />,
    )
    root.flush()
    let node = container.firstElementChild
    assert(node)
    root.render(null)
    root.flush()
    await new Promise(requestAnimationFrame)
    expect(node.isConnected).toBe(true)
    expect(getComputedStyle(node).position).toBe('static')
    expect(getComputedStyle(node).opacity).toBe('1')
    removal.resolve()
    await new Promise(requestAnimationFrame)
    expect(node.isConnected).toBe(false)
  })
})

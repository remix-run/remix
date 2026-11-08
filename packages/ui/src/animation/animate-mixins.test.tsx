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
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    t.after(() => {
      root.dispose()
      container.remove()
    })
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
  it('inherits entrance timing and groups properties with matching overrides', (t) => {
    let { root, container } = createTestRoot(t)
    root.render(
      <div
        mix={animateEntrance({
          opacity: 0,
          scale: 0.8,
          translate: '20px 0',
          duration: 1000,
          delay: 100,
          easing: 'ease-in',
          composite: 'add',
          transition: {
            opacity: { duration: 500, delay: 0, easing: 'linear', composite: 'replace' },
            scale: { duration: 500, delay: 0, easing: 'linear', composite: 'replace' },
            translate: { duration: undefined },
          },
        })}
      />,
    )
    root.flush()
    let node = container.firstElementChild
    assert(node)
    let shorter = animationFor(node, 'opacity')
    let shared = animationFor(node, 'translate')
    expect(node.getAnimations().length).toBe(2)
    expect(animationFor(node, 'scale')).toBe(shorter)
    expect(shorter.effect?.getTiming()).toMatchObject({ duration: 500, delay: 0, easing: 'linear' })
    expect(shared.effect?.getTiming()).toMatchObject({
      duration: 1000,
      delay: 100,
      easing: 'ease-in',
    })
    assert(shorter.effect instanceof KeyframeEffect && shared.effect instanceof KeyframeEffect)
    expect(shorter.effect.getKeyframes()[0].scale).toBe('0.8')
    expect(shorter.effect.composite).toBe('replace')
    expect(shared.effect.composite).toBe('add')
  })

  it('applies zero-duration exit styles and waits for every other property to finish', async (t) => {
    let { root, container } = createTestRoot(t)
    root.render(
      <div
        style={{ position: 'relative', translate: '10px 0' }}
        mix={animateExit({
          position: 'absolute',
          translate: '5px 0',
          opacity: 0,
          scale: 0.5,
          duration: 1000,
          easing: 'ease-in',
          transition: {
            position: { duration: 0 },
            translate: { duration: 0, composite: 'add' },
            opacity: { duration: 500 },
          },
        })}
      />,
    )
    root.flush()
    let node = container.firstElementChild
    assert(node instanceof HTMLElement)
    root.render(null)
    root.flush()
    expect(getComputedStyle(node).position).toBe('absolute')
    expect(getComputedStyle(node).translate).toBe('15px')
    expect(node.style.position).toBe('relative')
    let fade = animationFor(node, 'opacity')
    let scale = animationFor(node, 'scale')
    fade.pause()
    scale.pause()
    expect(fade.effect?.getTiming().duration).toBe(500)
    fade.finish()
    await new Promise(requestAnimationFrame)
    expect(node.isConnected).toBe(true)
    scale.finish()
    await new Promise(requestAnimationFrame)
    expect(node.isConnected).toBe(false)
    expect(node.getAnimations().length).toBe(0)
  })

  it('applies shared and per-property zero-duration exits synchronously', async (t) => {
    let { root, container } = createTestRoot(t)
    root.render(
      <>
        <div mix={animateExit({ position: 'absolute', duration: 0 })} />
        <div
          mix={animateExit({
            position: 'absolute',
            duration: 1000,
            transition: { position: { duration: 0 } },
          })}
        />
      </>,
    )
    root.flush()
    let [shared, overridden] = container.children
    root.render(null)
    root.flush()
    expect(getComputedStyle(shared).position).toBe('absolute')
    expect(getComputedStyle(overridden).position).toBe('absolute')
    await new Promise(requestAnimationFrame)
    expect(container.childElementCount).toBe(0)
    expect(shared.getAnimations().length + overridden.getAnimations().length).toBe(0)
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
    expect(getComputedStyle(node).position).toBe('static')
    expect(position.effect?.getTiming()).toMatchObject({ duration: 0, delay: 10000 })
    expect(fade.effect?.getTiming().delay).toBe(0)
    fade.finish()
    await new Promise(requestAnimationFrame)
    expect(node.isConnected).toBe(true)
    position.finish()
    await new Promise(requestAnimationFrame)
    expect(node.isConnected).toBe(false)
  })
})

describe('interrupted exit animations', () => {
  it('restores current styles when an exiting element returns, even without animateExit', async (t) => {
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
    root.render(<div key="item" style={{ position: 'fixed', opacity: 1 }} mix={exit} />)
    root.flush()
    let returning = animationFor(node, 'opacity')
    returning.pause()
    returning.currentTime = 0
    expect(getComputedStyle(node).position).toBe('fixed')
    expect(getComputedStyle(node).opacity).toBe(opacity)
    returning.finish()
    await new Promise(requestAnimationFrame)
    root.render(null)
    root.flush()
    root.render(<div key="item" style={{ position: 'sticky' }} />)
    root.flush()
    await new Promise(requestAnimationFrame)
    expect(container.firstElementChild).toBe(node)
    expect(getComputedStyle(node).position).toBe('sticky')
    expect(node.getAnimations().length).toBe(0)
  })

  it('preserves additive compositing when an exiting element returns', async (t) => {
    let { root, container } = createTestRoot(t)
    let exit = animateExit({
      translate: '20px 0',
      duration: 1000,
      composite: 'add',
      transition: { translate: { duration: 500 } },
    })
    root.render(<div key="item" style={{ translate: '10px 0' }} mix={exit} />)
    root.flush()
    let node = container.firstElementChild
    assert(node)
    root.render(null)
    root.flush()
    await Promise.resolve()
    let exiting = animationFor(node, 'translate')
    exiting.pause()
    exiting.currentTime = 250
    root.render(<div key="item" style={{ translate: '10px 0' }} mix={exit} />)
    root.flush()
    let returning = animationFor(node, 'translate')
    assert(returning.effect instanceof KeyframeEffect)
    expect(returning.effect.composite).toBe('add')
  })

  it('returns from completed exit styles while another mixin retains the elements', async (t) => {
    let { root, container } = createTestRoot(t)
    let removal = Promise.withResolvers<void>()
    t.after(() => removal.resolve())
    let retain = createMixin((handle) => {
      handle.addEventListener('beforeRemove', (event) => event.persistNode(() => removal.promise))
    })
    let shared = [animateExit({ opacity: 0, duration: 1000 }), retain()]
    let overridden = [
      animateExit({ opacity: 0, duration: 1000, transition: { opacity: { duration: 500 } } }),
      retain(),
    ]
    root.render(
      <>
        <div key="shared" style={{ opacity: 1 }} mix={shared} />
        <div key="overridden" style={{ opacity: 1 }} mix={overridden} />
      </>,
    )
    root.flush()
    let [first, second] = container.children
    root.render(null)
    root.flush()
    animationFor(first, 'opacity').finish()
    animationFor(second, 'opacity').finish()
    await new Promise(requestAnimationFrame)
    root.render(
      <>
        <div key="shared" style={{ opacity: 0.4 }} mix={shared} />
        <div key="overridden" style={{ opacity: 0.6 }} mix={overridden} />
      </>,
    )
    root.flush()
    let firstReturn = animationFor(first, 'opacity')
    let secondReturn = animationFor(second, 'opacity')
    firstReturn.pause()
    firstReturn.currentTime = 0
    secondReturn.pause()
    secondReturn.currentTime = 0
    expect(getComputedStyle(first).opacity).toBe('0')
    expect(getComputedStyle(second).opacity).toBe('0')
    removal.resolve()
    firstReturn.finish()
    secondReturn.finish()
    await new Promise(requestAnimationFrame)
    expect(container.firstElementChild).toBe(first)
    expect(container.lastElementChild).toBe(second)
    expect(getComputedStyle(first).opacity).toBe('0.4')
    expect(getComputedStyle(second).opacity).toBe('0.6')
    expect(first.getAnimations().length + second.getAnimations().length).toBe(0)
  })

  it('returns from finished exit styles before removal callbacks settle', async (t) => {
    let { root, container } = createTestRoot(t)
    let exit = animateExit({ opacity: 0, duration: 1000 })
    root.render(<div key="item" style={{ opacity: 1 }} mix={exit} />)
    root.flush()
    let node = container.firstElementChild
    assert(node)
    root.render(null)
    root.flush()
    animationFor(node, 'opacity').finish()
    root.render(<div key="item" style={{ opacity: 0.4 }} mix={exit} />)
    root.flush()
    let returning = animationFor(node, 'opacity')
    returning.pause()
    returning.currentTime = 0
    expect(getComputedStyle(node).opacity).toBe('0')
    await Promise.resolve()
    expect(returning.playState).toBe('paused')
    returning.finish()
    await new Promise(requestAnimationFrame)
    expect(container.firstElementChild).toBe(node)
    expect(getComputedStyle(node).opacity).toBe('0.4')
  })

  it('keeps the new exit running when an element leaves, returns and immediately leaves again', async (t) => {
    let { root, container } = createTestRoot(t)
    let exit = animateExit({
      opacity: 0,
      position: 'absolute',
      duration: 1000,
      transition: { position: { duration: 0 } },
    })
    let item = <div key="item" style={{ opacity: 1, position: 'relative' }} mix={exit} />
    root.render(item)
    root.flush()
    let node = container.firstElementChild
    assert(node)
    root.render(null)
    root.flush()
    let firstExit = node.getAnimations()
    root.render(item)
    root.flush()
    let returning = animationFor(node, 'opacity')
    root.render(null)
    root.flush()
    let secondExit = node.getAnimations()
    await Promise.resolve()
    expect(firstExit.every((animation) => animation.playState === 'idle')).toBe(true)
    expect(secondExit.every((animation) => animation.playState !== 'idle')).toBe(true)
    await returning.ready
    for (let animation of new Set([returning, ...secondExit])) animation.finish()
    await new Promise(requestAnimationFrame)
    expect(node.isConnected).toBe(false)
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
    let effects = node.getAnimations()
    expect(effects.length).toBe(1)
    root.render(null)
    root.flush()
    await Promise.resolve()
    expect(node.isConnected).toBe(false)
    expect(effects[0].playState).toBe('idle')
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
    expect(node.getAnimations().length).toBe(0)
    removal.resolve()
    await new Promise(requestAnimationFrame)
    expect(node.isConnected).toBe(false)
  })
})

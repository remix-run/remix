import assert, { expect } from '@remix-run/assert'
import { describe, it, mock } from '@remix-run/test'
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

describe('per-property animation transitions', () => {
  it('applies entrance overrides and shares animations with matching timing', (t) => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    t.after(() => {
      root.dispose()
      container.remove()
    })
    root.render(
      <div
        mix={animateEntrance({
          opacity: 0,
          scale: 0.8,
          translate: '20px 0',
          rotate: '20deg',
          duration: 1000,
          delay: 100,
          easing: 'ease-in',
          transition: {
            opacity: { duration: 500, delay: 0, easing: 'linear' },
            scale: { duration: 500, delay: 0, easing: 'linear', composite: 'replace' },
            rotate: {
              duration: undefined,
              delay: undefined,
              easing: undefined,
              composite: undefined,
            },
          },
        })}
      />,
    )
    root.flush()
    let node = container.firstElementChild
    assert(node)
    let animations = node.getAnimations()
    expect(animations.length).toBe(2)
    let shorter = animations.find((animation) => animation.effect?.getTiming().duration === 500)
    let shared = animations.find((animation) => animation.effect?.getTiming().duration === 1000)
    assert(shorter?.effect instanceof KeyframeEffect && shared?.effect instanceof KeyframeEffect)
    expect(shorter.effect.getTiming().easing).toBe('linear')
    expect(shared.effect.getTiming().duration).toBe(1000)
    expect(shared.effect.getTiming().delay).toBe(100)
    expect(shared.effect.getTiming().easing).toBe('ease-in')
    expect(shared.effect.composite).toBe('replace')
    shorter.pause()
    shorter.currentTime = 250
    shared.pause()
    shared.currentTime = 500
    expect(getComputedStyle(node).opacity).toBe('0.5')
    let shortFrames = shorter.effect.getKeyframes()
    let sharedFrames = shared.effect.getKeyframes()
    expect(shortFrames[0].opacity).toBe('0')
    expect(shortFrames[0].scale).toBe('0.8')
    expect(sharedFrames[0].translate).toBe('20px')
    expect(sharedFrames[0].rotate).toBe('20deg')
  })

  it('applies per-property exit timing and keeps the element until every property finishes', async (t) => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    t.after(() => {
      root.dispose()
      container.remove()
    })
    root.render(
      <div
        key="item"
        style={{ position: 'relative', opacity: 1 }}
        mix={animateExit({
          position: 'absolute',
          opacity: 0,
          translate: '32px 0',
          duration: 1000,
          easing: 'ease-in',
          transition: {
            position: { duration: 0 },
            opacity: { duration: 500, delay: 100 },
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
    expect(node.style.position).toBe('relative')
    for (let animation of node.getAnimations()) {
      if (animation.playState !== 'finished') animation.pause()
    }
    let movement = node
      .getAnimations()
      .find((animation) => animation.effect?.getTiming().duration === 1000)
    assert(movement)
    expect(movement.effect?.getTiming().easing).toBe('ease-in')
    movement.currentTime = 500
    expect(getComputedStyle(node).translate).not.toBe('none')
    expect(getComputedStyle(node).position).toBe('absolute')
    expect(node.isConnected).toBe(true)
    let fade = node
      .getAnimations()
      .find((animation) => animation.effect?.getTiming().duration === 500)
    assert(fade)
    expect(fade.effect?.getTiming().easing).toBe('ease-in')
    expect(fade.effect?.getTiming().delay).toBe(100)
    fade.currentTime = 350
    expect(Number(getComputedStyle(node).opacity)).toBeGreaterThan(0)
    expect(Number(getComputedStyle(node).opacity)).toBeLessThan(1)
    fade.finish()
    await new Promise(requestAnimationFrame)
    expect(node.isConnected).toBe(true)
    movement.finish()
    await new Promise(requestAnimationFrame)
    expect(node.isConnected).toBe(false)
    expect(node.style.position).toBe('relative')
    expect(node.getAnimations().length).toBe(0)
  })

  it('applies zero-duration exits immediately for both shared and per-property timing', async (t) => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    t.after(() => {
      root.dispose()
      container.remove()
    })
    root.render(
      <>
        <div
          style={{ position: 'relative' }}
          mix={animateExit({ position: 'absolute', duration: 0 })}
        />
        <div
          style={{ position: 'relative' }}
          mix={animateExit({
            position: 'absolute',
            duration: 10000,
            transition: { position: { duration: 0 } },
          })}
        />
      </>,
    )
    root.flush()
    let shared = container.firstElementChild
    let overridden = container.lastElementChild
    assert(shared && overridden && shared !== overridden)
    root.render(null)
    root.flush()
    expect(getComputedStyle(shared).position).toBe('absolute')
    expect(getComputedStyle(overridden).position).toBe('absolute')
    await new Promise(requestAnimationFrame)
    expect(shared.isConnected).toBe(false)
    expect(overridden.isConnected).toBe(false)
    expect(shared.getAnimations().length).toBe(0)
    expect(overridden.getAnimations().length).toBe(0)
  })

  it('inherits the shared delay and allows a property to start without it', async (t) => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    t.after(() => {
      root.dispose()
      container.remove()
    })
    root.render(
      <div
        key="item"
        style={{ position: 'relative', opacity: 1 }}
        mix={animateExit({
          position: 'absolute',
          opacity: 0,
          duration: 1000,
          delay: 10000,
          transition: {
            position: { duration: 0 },
            opacity: { duration: 500, delay: 0 },
          },
        })}
      />,
    )
    root.flush()
    let node = container.firstElementChild
    assert(node instanceof HTMLElement)
    root.render(null)
    root.flush()
    expect(getComputedStyle(node).position).toBe('relative')
    for (let animation of node.getAnimations()) {
      if (animation.playState !== 'finished') animation.pause()
    }
    let animations = node.getAnimations()
    let position = animations.find((animation) => animation.effect?.getTiming().delay === 10000)
    let fade = animations.find((animation) => animation.effect?.getTiming().duration === 500)
    assert(position && fade)
    expect(position.effect?.getTiming().duration).toBe(0)
    expect(fade.effect?.getTiming().delay).toBe(0)
    fade.finish()
    await new Promise(requestAnimationFrame)
    expect(getComputedStyle(node).position).toBe('relative')
    expect(node.isConnected).toBe(true)
    position.finish()
    await new Promise(requestAnimationFrame)
    expect(node.isConnected).toBe(false)
  })

  it('groups zero-duration exit properties while respecting per-property compositing', async (t) => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    t.after(() => {
      root.dispose()
      container.remove()
    })
    root.render(
      <div
        style={{ position: 'relative', zIndex: 2, translate: '10px 0' }}
        mix={animateExit({
          position: 'absolute',
          zIndex: 100,
          translate: '5px 0',
          opacity: 0,
          duration: 1000,
          transition: {
            position: { duration: 0 },
            zIndex: { duration: 0 },
            translate: { duration: 0, composite: 'add' },
          },
        })}
      />,
    )
    root.flush()
    let node = container.firstElementChild
    assert(node instanceof HTMLElement)
    root.render(null)
    root.flush()
    expect(node.getAnimations().length).toBe(3)
    expect(getComputedStyle(node).position).toBe('absolute')
    expect(getComputedStyle(node).zIndex).toBe('100')
    expect(getComputedStyle(node).translate).toBe('15px')
    for (let animation of node.getAnimations()) animation.finish()
    await new Promise(requestAnimationFrame)
    expect(node.isConnected).toBe(false)
    expect(node.getAnimations().length).toBe(0)
    expect(node.style.translate).toBe('10px')
  })
})

describe('interrupted exit animations', () => {
  it('restores updated styles when an element returns, including when animateExit is removed', async (t) => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    t.after(() => {
      root.dispose()
      container.remove()
    })
    let exit = animateExit({
      position: 'absolute',
      opacity: 0,
      duration: 1000,
      transition: { position: { duration: 0 } },
    })
    root.render(<div key="item" style={{ position: 'relative', opacity: 1 }} mix={exit} />)
    root.flush()
    let node = container.firstElementChild
    assert(node instanceof HTMLElement)
    root.render(null)
    root.flush()
    await Promise.resolve()
    let fade = node
      .getAnimations()
      .find((animation) => animation.effect?.getTiming().duration === 1000)
    assert(fade)
    fade.pause()
    fade.currentTime = 500
    let opacity = getComputedStyle(node).opacity
    root.render(<div key="item" style={{ position: 'fixed', opacity: 1 }} mix={exit} />)
    root.flush()
    expect(container.firstElementChild).toBe(node)
    expect(getComputedStyle(node).position).toBe('fixed')
    let returning = node.getAnimations()[0]
    assert(returning)
    returning.pause()
    returning.currentTime = 0
    expect(getComputedStyle(node).opacity).toBe(opacity)
    returning.finish()
    await new Promise(requestAnimationFrame)
    root.render(null)
    root.flush()
    root.render(<div key="item" style={{ position: 'sticky' }} />)
    root.flush()
    expect(container.firstElementChild).toBe(node)
    expect(getComputedStyle(node).position).toBe('sticky')
    await new Promise(requestAnimationFrame)
    expect(node.isConnected).toBe(true)
    expect(node.getAnimations().length).toBe(0)
  })

  it('preserves additive compositing when an exiting element returns', async (t) => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    t.after(() => {
      root.dispose()
      container.remove()
    })
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
    let animation = node.getAnimations()[0]
    assert(animation)
    animation.pause()
    animation.currentTime = 250
    expect(getComputedStyle(node).translate).toBe('20px')
    root.render(<div key="item" style={{ translate: '10px 0' }} mix={exit} />)
    root.flush()
    let returning = node.getAnimations()[0]
    assert(returning?.effect instanceof KeyframeEffect)
    returning.pause()
    returning.currentTime = 0
    expect(returning.effect.composite).toBe('add')
    expect(getComputedStyle(node).translate).toBe('30px')
  })

  it('returns from completed exit values when another mixin keeps elements mounted', async (t) => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    let removal = Promise.withResolvers<void>()
    let retain = createMixin((handle) => {
      handle.addEventListener('beforeRemove', (event) => event.persistNode(() => removal.promise))
      return () => handle.element
    })
    t.after(() => {
      removal.resolve()
      root.dispose()
      container.remove()
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
    let first = container.firstElementChild
    let second = container.lastElementChild
    assert(first && second && first !== second)
    root.render(null)
    root.flush()
    for (let animation of [...first.getAnimations(), ...second.getAnimations()]) animation.finish()
    await new Promise(requestAnimationFrame)
    expect(first.isConnected && second.isConnected).toBe(true)
    expect(getComputedStyle(first).opacity).toBe('0')
    expect(getComputedStyle(second).opacity).toBe('0')
    root.render(
      <>
        <div key="shared" style={{ opacity: 0.4 }} mix={shared} />
        <div key="overridden" style={{ opacity: 0.6 }} mix={overridden} />
      </>,
    )
    root.flush()
    expect(container.firstElementChild).toBe(first)
    expect(container.lastElementChild).toBe(second)
    let firstReturn = first.getAnimations()[0]
    let secondReturn = second.getAnimations()[0]
    assert(firstReturn && secondReturn)
    firstReturn.pause()
    firstReturn.currentTime = 0
    secondReturn.pause()
    secondReturn.currentTime = 0
    expect(getComputedStyle(first).opacity).toBe('0')
    expect(getComputedStyle(second).opacity).toBe('0')
    firstReturn.currentTime = 500
    secondReturn.currentTime = 250
    expect(getComputedStyle(first).opacity).toBe('0.2')
    expect(getComputedStyle(second).opacity).toBe('0.3')
    removal.resolve()
    await new Promise(requestAnimationFrame)
    expect(first.isConnected && second.isConnected).toBe(true)
    firstReturn.finish()
    secondReturn.finish()
    await new Promise(requestAnimationFrame)
    expect(getComputedStyle(first).opacity).toBe('0.4')
    expect(getComputedStyle(second).opacity).toBe('0.6')
    expect(first.getAnimations().length + second.getAnimations().length).toBe(0)
  })

  it('returns to updated styles immediately after its exit animation finishes', async (t) => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    t.after(() => {
      root.dispose()
      container.remove()
    })
    let exit = animateExit({ opacity: 0, duration: 1000 })
    root.render(<div key="item" style={{ opacity: 1 }} mix={exit} />)
    root.flush()
    let node = container.firstElementChild
    assert(node instanceof HTMLElement)
    root.render(null)
    root.flush()
    let exiting = node.getAnimations()[0]
    assert(exiting)
    exiting.finish()
    root.render(<div key="item" style={{ opacity: 0.4 }} mix={exit} />)
    root.flush()
    expect(container.firstElementChild).toBe(node)
    expect(node.style.opacity).toBe('0.4')
    let returning = node.getAnimations()[0]
    assert(returning)
    returning.pause()
    returning.currentTime = 0
    expect(getComputedStyle(node).opacity).toBe('0')
    returning.currentTime = 500
    expect(getComputedStyle(node).opacity).toBe('0.2')
    await Promise.resolve()
    expect(returning.playState).toBe('paused')
    returning.finish()
    await new Promise(requestAnimationFrame)
    expect(node.isConnected).toBe(true)
    expect(getComputedStyle(node).opacity).toBe('0.4')
    expect(node.getAnimations().length).toBe(0)
  })

  it('keeps the latest exit running when an element leaves, returns and leaves again immediately', async (t) => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    t.after(() => {
      root.dispose()
      container.remove()
    })
    let exit = animateExit({
      opacity: 0,
      position: 'absolute',
      duration: 1000,
      transition: { position: { duration: 0 } },
    })
    function item() {
      return <div key="item" style={{ opacity: 1, position: 'relative' }} mix={exit} />
    }
    root.render(item())
    root.flush()
    let node = container.firstElementChild
    assert(node)
    root.render(null)
    root.flush()
    let firstExit = node.getAnimations()
    root.render(item())
    root.flush()
    expect(container.firstElementChild).toBe(node)
    expect(getComputedStyle(node).position).toBe('relative')
    let returning = node.getAnimations()[0]
    assert(returning)
    root.render(null)
    root.flush()
    let secondExit = node.getAnimations()
    expect(firstExit.length).toBeGreaterThan(0)
    expect(secondExit.length).toBeGreaterThan(0)
    await Promise.resolve()
    expect(firstExit.every((animation) => animation.playState === 'idle')).toBe(true)
    expect(secondExit.every((animation) => animation.playState !== 'idle')).toBe(true)
    expect(returning.playState).not.toBe('idle')
    await returning.ready
    for (let animation of new Set([returning, ...secondExit])) animation.finish()
    await new Promise(requestAnimationFrame)
    expect(node.isConnected).toBe(false)
  })
})

describe('exit animations with other mixins', () => {
  it('removes elements when another beforeRemove listener cancels their exit animations', async (t) => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    let cancelAnimations = createMixin((handle) => {
      let node: Element | undefined
      handle.addEventListener('insert', (event) => {
        node = event.node
      })
      handle.addEventListener('beforeRemove', () => {
        for (let animation of node?.getAnimations() ?? []) animation.cancel()
      })
      return () => handle.element
    })
    t.after(() => {
      root.dispose()
      container.remove()
    })
    root.render(
      <>
        <div mix={[animateExit({ opacity: 0, duration: 1000 }), cancelAnimations()]} />
        <div mix={[animateExit({ opacity: 0, duration: 0 }), cancelAnimations()]} />
      </>,
    )
    root.flush()
    let animated = container.firstElementChild
    let immediate = container.lastElementChild
    assert(animated && immediate && animated !== immediate)
    root.render(null)
    root.flush()
    await new Promise(requestAnimationFrame)
    expect(animated.isConnected).toBe(false)
    expect(immediate.isConnected).toBe(false)
  })

  it('animates sibling layout from its previous position when a negative exit delay changes height', (t) => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    let visible = true
    let update: (() => void) | undefined
    function List(handle: Handle) {
      update = () => {
        void handle.update()
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
    t.after(() => {
      root.dispose()
      container.remove()
    })
    root.render(<List />)
    root.flush()
    let exiting = container.firstElementChild?.firstElementChild
    let remaining = exiting?.nextElementSibling
    assert(exiting && remaining && update)
    let previousTop = remaining.getBoundingClientRect().top
    visible = false
    update()
    root.flush()
    expect(getComputedStyle(exiting).height).toBe('30px')
    expect(remaining.getBoundingClientRect().top).toBe(previousTop)
    let layout = remaining.getAnimations()[0]
    assert(layout)
    layout.pause()
    layout.currentTime = 0
    expect(remaining.getBoundingClientRect().top).toBe(previousTop)
    layout.finish()
    expect(remaining.getBoundingClientRect().top).toBe(previousTop - 30)
  })

  it('cancels exit animations if their parent is removed immediately afterwards', async (t) => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    t.after(() => {
      root.dispose()
      container.remove()
    })
    root.render(
      <section>
        <div key="item" mix={animateExit({ opacity: 0, duration: 1000 })} />
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
    expect(node.isConnected).toBe(false)
    await Promise.resolve()
    expect(effects.every((animation) => animation.playState === 'idle')).toBe(true)
  })

  it("cleans up invalid exit animations without ending another mixin's deferred removal", async (t) => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    let removal = Promise.withResolvers<void>()
    let retain = createMixin((handle) => {
      handle.addEventListener('beforeRemove', (event) => event.persistNode(() => removal.promise))
      return () => handle.element
    })
    t.after(() => {
      removal.resolve()
      root.dispose()
      container.remove()
    })
    root.render(
      <div
        style={{ position: 'relative' }}
        mix={[
          animateExit({
            position: 'absolute',
            opacity: 0,
            scale: 0.5,
            duration: 1000,
            transition: {
              position: { duration: 0 },
              scale: { easing: 'invalid-easing' },
            },
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
    expect(getComputedStyle(node).position).toBe('relative')
    expect(node.getAnimations().length).toBe(0)
    removal.resolve()
    await new Promise(requestAnimationFrame)
    expect(node.isConnected).toBe(false)
  })
})

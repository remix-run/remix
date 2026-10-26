import assert, { expect } from '@remix-run/assert'
import { describe, it, mock } from '@remix-run/test'
import { createRoot } from '@remix-run/component'
import { spring } from './spring.ts'
import { animateEntrance, animateExit } from './animate-mixins.ts'

describe('animate entrance/exit mixins', () => {
  it('passes zero-duration entrance properties to WAAPI', (t) => {
    let animations: Animation[] = []
    let animate = HTMLElement.prototype.animate
    let spy = mock.method(
      HTMLElement.prototype,
      'animate',
      function (
        this: HTMLElement,
        frames: Keyframe[] | PropertyIndexedKeyframes | null,
        options?: number | KeyframeAnimationOptions,
      ) {
        let animation = animate.call(this, frames, options)
        animations.push(animation)
        return animation
      },
    )
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    t.after(() => {
      root.dispose()
      container.remove()
      spy.mock.restore?.()
    })
    root.render(<div mix={animateEntrance({ opacity: 0, duration: 0 })} />)
    root.flush()
    expect(animations.length).toBe(1)
    let effect = animations[0].effect
    assert(effect instanceof KeyframeEffect)
    expect(effect.getTiming().duration).toBe(0)
    expect(effect.getKeyframes()[0].opacity).toBe('0')
  })

  it('inherits shared entrance timing and compositing for a property duration override', (t) => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    t.after(() => {
      root.dispose()
      container.remove()
    })
    root.render(
      <div
        style={{ opacity: 0.4 }}
        mix={animateEntrance({
          opacity: 0.2,
          duration: 1000,
          easing: 'ease-in',
          delay: 100,
          composite: 'add',
          transition: {
            opacity: { duration: 500, easing: undefined, delay: undefined },
          },
        })}
      />,
    )
    root.flush()
    let node = container.firstElementChild
    assert(node)
    let animations = node.getAnimations()
    expect(animations.length).toBe(1)
    let animation = animations[0]
    animation.pause()
    animation.currentTime = 0
    let effect = animation.effect
    assert(effect instanceof KeyframeEffect)
    expect(effect.getTiming().duration).toBe(500)
    expect(effect.getTiming().easing).toBe('ease-in')
    expect(effect.getTiming().delay).toBe(100)
    expect(effect.getTiming().fill).toBe('backwards')
    expect(effect.composite).toBe('add')
    expect(Number(getComputedStyle(node).opacity)).toBeCloseTo(0.6)
  })

  it('preserves flat exit timing and accumulating compositing', async (t) => {
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
        style={{ opacity: 0.4 }}
        mix={animateExit({
          opacity: 0.2,
          duration: 1000,
          easing: 'ease-out',
          delay: 100,
          composite: 'accumulate',
        })}
      />,
    )
    root.flush()
    let node = container.firstElementChild
    assert(node)
    root.render(null)
    root.flush()
    await Promise.resolve()
    let animations = node.getAnimations()
    expect(animations.length).toBe(1)
    let animation = animations[0]
    animation.pause()
    animation.currentTime = 1100
    let effect = animation.effect
    assert(effect instanceof KeyframeEffect)
    expect(effect.getTiming().duration).toBe(1000)
    expect(effect.getTiming().easing).toBe('ease-out')
    expect(effect.getTiming().delay).toBe(100)
    expect(effect.getTiming().fill).toBe('forwards')
    expect(effect.composite).toBe('accumulate')
    expect(Number(getComputedStyle(node).opacity)).toBeCloseTo(0.6)
  })

  it('reclaims persisted nodes by type/key and reuses the same DOM element', () => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)

    root.render(
      <div
        key="item"
        id="reclaim-target"
        mix={[
          animateExit({
            opacity: 0,
            duration: 150,
          }),
        ]}
      />,
    )
    root.flush()

    let first = container.querySelector('#reclaim-target')
    assert(first)

    root.render(null)
    root.flush()
    expect(container.querySelector('#reclaim-target')).toBe(first)

    root.render(
      <div
        key="item"
        id="reclaim-target"
        mix={[
          animateExit({
            opacity: 0,
            duration: 150,
          }),
        ]}
      />,
    )
    root.flush()

    let second = container.querySelector('#reclaim-target')
    expect(second).toBe(first)
  })

  it('makes retained exits inert immediately and restores interaction on reclaim', async (t) => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    t.after(() => {
      root.dispose()
      container.remove()
    })
    function render(inert = false) {
      root.render(
        <div
          key="item"
          inert={inert}
          mix={animateExit({
            opacity: 0,
            duration: 1000,
            delay: 100,
          })}
        >
          <button>Action</button>
        </div>,
      )
      root.flush()
    }
    render()
    let host = container.firstElementChild
    let button = container.querySelector('button')
    assert(host instanceof HTMLElement)
    assert(button)
    button.focus()
    expect(document.activeElement).toBe(button)

    root.render(null)
    root.flush()
    expect(host.inert).toBe(true)
    button.blur()
    button.focus()
    expect(document.activeElement).not.toBe(button)

    // Reclaim before the deferred exit callback starts.
    render()
    expect(container.firstElementChild).toBe(host)
    expect(host.inert).toBe(false)
    await Promise.resolve()
    button.focus()
    expect(document.activeElement).toBe(button)

    root.render(null)
    root.flush()
    await Promise.resolve()
    expect(host.inert).toBe(true)
    render(true)
    expect(host.inert).toBe(true)

    root.render(null)
    root.flush()
    await Promise.resolve()
    render()
    expect(host.inert).toBe(false)
  })

  it('preserves authored inertness when an exiting element is reclaimed', async (t) => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    t.after(() => root.dispose())
    function render() {
      root.render(
        <div
          key="item"
          inert
          mix={animateExit({
            duration: 1000,
          })}
        />,
      )
      root.flush()
    }
    render()
    let host = container.firstElementChild
    assert(host instanceof HTMLElement)
    root.render(null)
    root.flush()
    await Promise.resolve()
    render()
    expect(host.inert).toBe(true)
  })

  it('releases exit inertness when a reclaimed element no longer uses animateExit', async (t) => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    t.after(() => root.dispose())
    root.render(
      <div
        key="item"
        mix={animateExit({
          duration: 1000,
        })}
      />,
    )
    root.flush()
    let host = container.firstElementChild
    assert(host instanceof HTMLElement)
    root.render(null)
    root.flush()
    expect(host.inert).toBe(true)
    await Promise.resolve()
    root.render(<div key="item" />)
    root.flush()
    expect(container.firstElementChild).toBe(host)
    expect(host.inert).toBe(false)
  })

  it('honours new authored inertness when the returning element drops its exit mixin', (t) => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    t.after(() => root.dispose())
    root.render(
      <div
        key="item"
        mix={animateExit({
          duration: 1000,
        })}
      />,
    )
    root.flush()
    let host = container.firstElementChild
    assert(host instanceof HTMLElement)
    root.render(null)
    root.flush()
    root.render(<div key="item" inert />)
    root.flush()
    expect(container.firstElementChild).toBe(host)
    expect(host.inert).toBe(true)
  })

  it('leaves a retained exit inert until physical removal', async (t) => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    t.after(() => {
      root.dispose()
      container.remove()
    })
    root.render(
      <button
        key="item"
        mix={animateExit({
          duration: 1000,
        })}
      >
        Action
      </button>,
    )
    root.flush()
    let host = container.firstElementChild
    assert(host instanceof HTMLElement)
    root.render(null)
    root.flush()
    await Promise.resolve()
    expect(host.inert).toBe(true)
    let animations = host.getAnimations()
    expect(animations.length).toBe(1)
    animations[0].finish()
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(host.isConnected).toBe(false)
    expect(host.inert).toBe(false)
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
    document.body.append(container)
    let root = createRoot(container)

    root.render(
      <div
        key="item"
        id="reverse-target"
        mix={[
          animateExit({
            opacity: 0,
            duration: 150,
          }),
        ]}
      />,
    )
    root.flush()

    root.render(null)
    root.flush()
    await Promise.resolve()
    expect(animateSpy).toHaveBeenCalledTimes(1)

    root.render(
      <div
        key="item"
        id="reverse-target"
        mix={[
          animateExit({
            opacity: 0,
            duration: 150,
          }),
        ]}
      />,
    )
    root.flush()
    await Promise.resolve()

    expect(reverse).toHaveBeenCalledTimes(0)
    expect(commitStyles).toHaveBeenCalledTimes(0)
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
    document.body.append(container)
    let root = createRoot(container)
    root.render(
      <div
        key="both"
        id="both-mixins-target"
        mix={[
          animateEntrance({
            opacity: 0,
            duration: 150,
          }),
          animateExit({
            opacity: 0,
            duration: 150,
          }),
        ]}
      />,
    )
    root.flush()

    expect(animateSpy).toHaveBeenCalledTimes(1)
    expect(reverse).toHaveBeenCalledTimes(0)
    animateSpy.mock.restore!()
  })

  it('keeps persist behavior after reclaim interruption completes', async () => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    let mix = [
      animateEntrance({
        opacity: 0,
        duration: 40,
      }),
      animateExit({
        opacity: 0,
        duration: 40,
      }),
    ]

    root.render(<div key="item" id="persist-after-interrupt" mix={mix} />)
    root.flush()

    root.render(null)
    root.flush()
    expect(container.querySelector('#persist-after-interrupt')).not.toBe(null)

    root.render(<div key="item" id="persist-after-interrupt" mix={mix} />)
    root.flush()
    await new Promise((resolve) => setTimeout(resolve, 80))

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
    document.body.append(container)
    let root = createRoot(container)
    let mix = [
      animateEntrance({
        initial: false,
        opacity: 0,
        duration: 100,
      }),
      animateExit({
        opacity: 0,
        duration: 100,
      }),
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
  it('uses independent property transitions and waits for the longest exit', async (t) => {
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
        style={{ opacity: 1, translate: '0px', position: 'relative', zIndex: 2 }}
        mix={animateExit({
          opacity: 0,
          translate: '32px 0',
          position: 'absolute',
          zIndex: 101,
          duration: 1000,
          easing: 'ease-in',
          transition: {
            opacity: {
              duration: 500,
              delay: 100,
            },
            position: {
              duration: 0,
            },
            zIndex: {
              duration: 0,
            },
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
    expect(getComputedStyle(node).zIndex).toBe('101')
    await Promise.resolve()
    let animations = node.getAnimations()
    expect(animations.length).toBe(4)
    let fade = animations.find((animation) => animation.effect?.getTiming().duration === 500)
    let movement = animations.find((animation) => animation.effect?.getTiming().duration === 1000)
    assert(fade && movement)
    expect(fade.effect?.getTiming().easing).toBe('ease-in')
    expect(fade.effect?.getTiming().delay).toBe(100)
    expect(movement.effect?.getTiming().easing).toBe('ease-in')
    fade.finish()
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(node.isConnected).toBe(true)
    for (let animation of animations) animation.finish()
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(node.isConnected).toBe(false)
    expect(node.style.position).toBe('relative')
    expect(node.style.zIndex).toBe('2')
  })

  it('restores immediate exit styles before new props, including when the mixin is dropped', async (t) => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    t.after(() => root.dispose())
    function render() {
      root.render(
        <div
          key="item"
          style={{ position: 'relative', '--card-height': 'auto' }}
          mix={animateExit({
            opacity: 0,
            position: 'absolute',
            '--card-height': '100%',
            duration: 1000,
            transition: {
              position: {
                duration: 0,
              },
              '--card-height': {
                duration: 0,
              },
            },
          })}
        />,
      )
      root.flush()
    }
    render()
    let node = container.firstElementChild
    assert(node instanceof HTMLElement)
    root.render(null)
    root.flush()
    expect(node.style.position).toBe('absolute')
    expect(node.style.getPropertyValue('--card-height')).toBe('100%')
    render()
    expect(node.style.position).toBe('relative')
    expect(node.style.getPropertyValue('--card-height')).toBe('auto')
    await Promise.resolve()
    expect(node.getAnimations().length).toBe(0)
    root.render(null)
    root.flush()
    await Promise.resolve()
    root.render(<div key="item" style={{ position: 'fixed', '--card-height': '48px' }} />)
    root.flush()
    expect(container.firstElementChild).toBe(node)
    expect(node.style.position).toBe('fixed')
    expect(node.style.getPropertyValue('--card-height')).toBe('48px')
    expect(node.inert).toBe(false)
    expect(node.getAnimations().length).toBe(0)
  })

  it('does not reapply instant exit styles when a returning node changes its transition', async (t) => {
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
          transition: {
            position: { duration: 0 },
          },
        })}
      />,
    )
    root.flush()
    let node = container.firstElementChild
    assert(node instanceof HTMLElement)
    root.render(null)
    root.flush()
    await Promise.resolve()
    root.render(
      <div
        key="item"
        style={{ position: 'fixed', opacity: 1 }}
        mix={animateExit({ opacity: 0, duration: 1000 })}
      />,
    )
    root.flush()
    for (let animation of node.getAnimations()) {
      animation.pause()
      animation.currentTime = 0
    }
    expect(getComputedStyle(node).position).toBe('fixed')
    expect(node.style.position).toBe('fixed')
  })

  it('supports shared and per-property springs on entrance', (t) => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    t.after(() => {
      root.dispose()
      container.remove()
    })
    let movement = spring('snappy')
    let scale = spring('bouncy')
    root.render(
      <div
        style={{ opacity: 1, scale: 1, translate: '0px' }}
        mix={animateEntrance({
          opacity: 0,
          scale: 0.9,
          translate: '0 24px',
          ...movement,
          transition: {
            scale,
            opacity: {
              duration: 0,
            },
          },
        })}
      />,
    )
    root.flush()
    let node = container.firstElementChild
    assert(node)
    let animations = node.getAnimations()
    expect(animations.length).toBe(4)
    expect(getComputedStyle(node).opacity).toBe('1')
    expect(
      animations.some((animation) => animation.effect?.getTiming().duration === movement.duration),
    ).toBe(true)
    expect(
      animations.some((animation) => animation.effect?.getTiming().duration === scale.duration),
    ).toBe(true)
  })

  it('runs the configured exit from an interrupted entrance and reclaims every property', async (t) => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    t.after(() => {
      root.dispose()
      container.remove()
    })
    function render() {
      root.render(
        <div
          key="item"
          style={{ opacity: 1, translate: '0px', zIndex: 2 }}
          mix={[
            animateEntrance({
              opacity: 0,
              translate: '0 24px',
              duration: 1000,
            }),
            animateExit({
              opacity: 0,
              translate: '32px 0',
              zIndex: 101,
              duration: 800,
              transition: {
                opacity: {
                  duration: 400,
                },
                zIndex: {
                  duration: 0,
                },
              },
            }),
          ]}
        />,
      )
      root.flush()
    }
    render()
    let node = container.firstElementChild
    assert(node instanceof HTMLElement)
    let entrance = node.getAnimations()[0]
    entrance.pause()
    entrance.currentTime = 500
    let opacity = getComputedStyle(node).opacity
    let translate = getComputedStyle(node).translate
    root.render(null)
    root.flush()
    expect(node.style.zIndex).toBe('101')
    await Promise.resolve()
    let exits = node.getAnimations()
    expect(exits.length).toBe(4)
    for (let exit of exits) {
      exit.pause()
      exit.currentTime = 0
    }
    expect(getComputedStyle(node).opacity).toBe(opacity)
    expect(getComputedStyle(node).translate).toBe(translate)
    let movement = exits.find((animation) => animation.effect?.getTiming().duration === 800)
    assert(movement?.effect instanceof KeyframeEffect)
    expect(
      exits.some(
        (animation) =>
          animation.effect instanceof KeyframeEffect &&
          animation.effect.getKeyframes()[1]['--rmx-animation-x'] === '32',
      ),
    ).toBe(true)
    for (let exit of exits) exit.currentTime = 100
    render()
    expect(container.firstElementChild).toBe(node)
    expect(node.style.zIndex).toBe('2')
    expect(node.inert).toBe(false)
    expect(exits.every((animation) => animation.playState === 'idle')).toBe(true)
    for (let animation of node.getAnimations()) animation.finish()
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(getComputedStyle(node).opacity).toBe('1')
    expect(getComputedStyle(node).translate).toBe('0px')
  })
  it('preserves additive compositing for immediate exit properties', (t) => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    t.after(() => {
      root.dispose()
      container.remove()
    })
    function render() {
      root.render(
        <div
          key="item"
          style={{ opacity: 0.4 }}
          mix={animateExit({
            opacity: 0.2,
            duration: 0,
            composite: 'add',
          })}
        />,
      )
      root.flush()
    }
    render()
    let node = container.firstElementChild
    assert(node instanceof HTMLElement)
    root.render(null)
    root.flush()
    expect(Number(getComputedStyle(node).opacity)).toBeCloseTo(0.6)
    expect(node.getAnimations().length).toBe(0)
    render()
    expect(Number(getComputedStyle(node).opacity)).toBeCloseTo(0.4)
  })

  it('inherits shared delay for an instant property and lets another property override it with zero', async (t) => {
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
        style={{ opacity: 1, zIndex: 2 }}
        mix={animateExit({
          opacity: 0,
          zIndex: 101,
          duration: 1000,
          delay: 200,
          transition: {
            zIndex: { duration: 0 },
            opacity: { delay: 0 },
          },
        })}
      />,
    )
    root.flush()
    let node = container.firstElementChild
    assert(node instanceof HTMLElement)
    root.render(null)
    root.flush()
    expect(getComputedStyle(node).zIndex).toBe('2')
    await Promise.resolve()
    let animations = node.getAnimations()
    expect(animations.length).toBe(2)
    let instant = animations.find((animation) => animation.effect?.getTiming().duration === 0)
    let fade = animations.find((animation) => animation.effect?.getTiming().duration === 1000)
    assert(instant && fade)
    expect(instant.effect?.getTiming().delay).toBe(200)
    expect(fade.effect?.getTiming().delay).toBe(0)
    instant.pause()
    fade.pause()
    instant.currentTime = 100
    fade.currentTime = 100
    expect(getComputedStyle(node).zIndex).toBe('2')
    expect(Number(getComputedStyle(node).opacity)).toBeCloseTo(0.9)
    instant.currentTime = 200
    expect(getComputedStyle(node).zIndex).toBe('101')
    instant.finish()
    fade.finish()
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(node.isConnected).toBe(false)
  })
})

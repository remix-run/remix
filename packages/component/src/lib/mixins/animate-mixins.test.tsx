import { describe, expect, it, vi } from 'vitest'
import { createRoot } from '../vdom.ts'
import { animateEntrance, animateExit } from './animate-mixins.tsx'
import { invariant } from '../invariant.ts'

describe('animate entrance/exit mixins', () => {
  it('reclaims persisted nodes by type/key and reuses the same DOM element', () => {
    let container = document.createElement('div')
    let root = createRoot(container)

    root.render(
      <div key="item" id="reclaim-target" mix={[animateExit({ opacity: 0, duration: 150 })]} />,
    )
    root.flush()

    let first = container.querySelector('#reclaim-target')
    invariant(first)

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
    let reverse = vi.fn()
    let commitStyles = vi.fn()
    let cancel = vi.fn()
    let animateSpy = vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation(
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
    animateSpy.mockRestore()
  })

  it('does not reverse on initial insert when entrance and exit mixins are both present', () => {
    let reverse = vi.fn()
    let animateSpy = vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation(
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
    animateSpy.mockRestore()
  })

  it('keeps persist behavior after reclaim interruption completes', async () => {
    let container = document.createElement('div')
    let root = createRoot(container)
    let mix = [
      animateEntrance({ opacity: 0, duration: 40 }),
      animateExit({ opacity: 0, duration: 40 }),
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
    let animateSpy = vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation(
      () =>
        ({
          playState: 'running',
          reverse: vi.fn(),
          commitStyles: vi.fn(),
          cancel: vi.fn(),
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

    animateSpy.mockRestore()
  })
})

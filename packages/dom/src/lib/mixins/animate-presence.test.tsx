import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDomReconciler } from '../dom-reconciler.ts'
import { animateEntrance, animateExit } from './animate-presence.tsx'

describe('animate presence mixins', () => {
  function flushTwice(root: { flush(): void }) {
    root.flush()
    root.flush()
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('animates entrance from definition to natural styles', () => {
    let reconciler = createDomReconciler(document)
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)
    let animation = createAnimation()
    let animateSpy = vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation(() => animation)

    root.render(
      <div
        mix={[
          animateEntrance({
            keyframes: { opacity: 0, transform: 'scale(0.8)' },
            options: { duration: 240 },
          }),
        ]}
      />,
    )
    flushTwice(root)

    expect(animateSpy).toHaveBeenCalledTimes(1)
    let calls = animateSpy.mock.calls as unknown as unknown[][]
    let keyframes = calls[0]?.[0] as Keyframe[] | undefined
    let options = calls[0]?.[1] as KeyframeAnimationOptions | undefined
    if (!keyframes || !options) {
      throw new Error('expected entrance animate call')
    }
    expect(keyframes[0]).toMatchObject({ opacity: 0, transform: 'scale(0.8)' })
    expect(keyframes[1]).toMatchObject({})
    expect(options).toMatchObject({ duration: 240, fill: 'backwards' })
  })

  it('animates exit from natural to definition styles', () => {
    let reconciler = createDomReconciler(document)
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(<div mix={[animateExit({ keyframes: { opacity: 0, transform: 'scale(0.8)' } })]} />)
    flushTwice(root)

    let node = container.firstElementChild as HTMLElement
    let animation = createAnimation()
    let animateSpy = vi.fn(() => animation)
    node.animate = animateSpy

    root.render(null)
    flushTwice(root)

    expect(animateSpy).toHaveBeenCalledTimes(1)
    let calls = animateSpy.mock.calls as unknown as unknown[][]
    let keyframes = calls[0]?.[0] as Keyframe[] | undefined
    let options = calls[0]?.[1] as KeyframeAnimationOptions | undefined
    if (!keyframes || !options) {
      throw new Error('expected exit animate call')
    }
    expect(keyframes[0]).toMatchObject({})
    expect(keyframes[1]).toMatchObject({ opacity: 0, transform: 'scale(0.8)' })
    expect(options).toMatchObject({ fill: 'forwards' })
  })

  it('reverses running enter animation when interrupted by exit', () => {
    let reconciler = createDomReconciler(document)
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)
    let animation = createAnimation()
    let animateSpy = vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation(() => animation)

    root.render(<div mix={[animateEntrance(), animateExit()]} />)
    flushTwice(root)
    expect(animateSpy).toHaveBeenCalledTimes(1)

    root.render(null)
    flushTwice(root)

    expect(animation.reverse).toHaveBeenCalledTimes(1)
    expect(animateSpy).toHaveBeenCalledTimes(1)
  })

  it('retains exiting node and reclaims it when reinserted', () => {
    let reconciler = createDomReconciler(document)
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(<div key="same" mix={[animateExit({ keyframes: { opacity: 0 } })]} />)
    flushTwice(root)

    let node = container.firstElementChild as HTMLElement
    let animation = createAnimation()
    let animateSpy = vi.fn(() => animation)
    node.animate = animateSpy

    root.render(null)
    flushTwice(root)
    expect(container.firstElementChild).toBe(node)

    root.render(<div key="same" mix={[animateExit({ keyframes: { opacity: 0 } })]} />)
    flushTwice(root)

    expect(container.firstElementChild).toBe(node)
    expect(animation.reverse).toHaveBeenCalledTimes(1)
    expect(animateSpy).toHaveBeenCalledTimes(1)
  })

  it('removes retained exiting node when exit animation finishes', async () => {
    let reconciler = createDomReconciler(document)
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(<div key="same" mix={[animateExit({ keyframes: { opacity: 0 } })]} />)
    flushTwice(root)

    let node = container.firstElementChild as HTMLElement
    let animation = createAnimation()
    node.animate = vi.fn(() => animation)

    root.render(null)
    flushTwice(root)

    expect(container.firstElementChild).toBe(node)
    animation.dispatchFinish()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(container.firstElementChild).toBeNull()
  })

  it('retains inline styles while exiting node is kept in dom', () => {
    let reconciler = createDomReconciler(document)
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(
      <div
        key="same"
        mix={[animateExit({ keyframes: { opacity: 0, transform: 'scale(0.85)' } })]}
        style={{ opacity: 1, transform: 'scale(1)', backgroundColor: 'red' }}
      />,
    )
    flushTwice(root)

    let node = container.firstElementChild as HTMLElement
    let animation = createAnimation()
    node.animate = vi.fn(() => animation)

    root.render(null)
    flushTwice(root)

    expect(container.firstElementChild).toBe(node)
    expect(node.style.opacity).toBe('1')
    expect(node.style.transform).toBe('scale(1)')
  })

  it('skips first entrance when initial is false', () => {
    let reconciler = createDomReconciler(document)
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)
    let animateSpy = vi
      .spyOn(HTMLElement.prototype, 'animate')
      .mockImplementation(() => createAnimation())

    root.render(
      <div
        key="same"
        mix={[
          animateEntrance({
            initial: false,
            keyframes: { opacity: 0, transform: 'scale(0.9)' },
          }),
        ]}
      />,
    )
    flushTwice(root)

    expect(animateSpy).toHaveBeenCalledTimes(0)
  })

  it('animates on subsequent entrance for same parent/key when initial is false', () => {
    let reconciler = createDomReconciler(document)
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)
    let animateSpy = vi
      .spyOn(HTMLElement.prototype, 'animate')
      .mockImplementation(() => createAnimation())

    root.render(
      <div
        key="same"
        mix={[
          animateEntrance({
            initial: false,
            keyframes: { opacity: 0, transform: 'scale(0.9)' },
          }),
          animateExit({ keyframes: { opacity: 0 } }),
        ]}
      />,
    )
    flushTwice(root)
    expect(animateSpy).toHaveBeenCalledTimes(0)

    root.render(null)
    flushTwice(root)
    root.render(
      <div
        key="same"
        mix={[
          animateEntrance({
            initial: false,
            keyframes: { opacity: 0, transform: 'scale(0.9)' },
          }),
          animateExit({ keyframes: { opacity: 0 } }),
        ]}
      />,
    )
    flushTwice(root)

    expect(animateSpy).toHaveBeenCalledTimes(1)
  })
})

function createAnimation() {
  let listeners = new Map<string, Set<EventListener>>()
  let addEventListener = (type: string, listener: EventListenerOrEventListenerObject | null) => {
    if (!listener) return
    let callback =
      typeof listener === 'function' ? listener : (event: Event) => listener.handleEvent(event)
    let set = listeners.get(type) ?? new Set<EventListener>()
    set.add(callback)
    listeners.set(type, set)
  }
  let removeEventListener = (type: string, listener: EventListenerOrEventListenerObject | null) => {
    if (!listener) return
    let callback =
      typeof listener === 'function' ? listener : (event: Event) => listener.handleEvent(event)
    listeners.get(type)?.delete(callback)
  }
  let dispatch = (type: string) => {
    for (let listener of listeners.get(type) ?? []) {
      listener(new Event(type))
    }
  }
  return {
    playState: 'running' as AnimationPlayState,
    addEventListener,
    removeEventListener,
    reverse: vi.fn(),
    cancel: vi.fn(() => {
      dispatch('cancel')
    }),
    dispatchFinish() {
      dispatch('finish')
    },
  } as unknown as Animation & { reverse: ReturnType<typeof vi.fn>; dispatchFinish(): void }
}

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDomReconciler } from '../dom-reconciler.ts'
import { animateLayout } from './animate-layout-mixin.tsx'

type MockAnimation = Animation & {
  cancel: ReturnType<typeof vi.fn>
}

describe('animateLayout mixin', () => {
  function flushTwice(root: { flush(): void }) {
    root.flush()
    root.flush()
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses beforeCommit snapshot as the FLIP start state', () => {
    let reconciler = createDomReconciler(document)
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(
      <div
        mix={[animateLayout({ duration: 420, easing: 'linear' })]}
        style={{ width: '10px', height: '10px' }}
      />,
    )
    flushTwice(root)

    let node = container.firstElementChild as HTMLElement
    let animation = createAnimation()
    let animateSpy = vi.fn(() => animation)
    node.animate = animateSpy

    let getRectSpy = vi
      .spyOn(node, 'getBoundingClientRect')
      .mockReturnValueOnce(createRect(50, 0, 100, 100))
      .mockReturnValueOnce(createRect(100, 0, 100, 100))

    root.render(
      <div
        mix={[animateLayout({ duration: 420, easing: 'linear' })]}
        style={{ width: '20px', height: '10px' }}
      />,
    )
    flushTwice(root)

    expect(getRectSpy).toHaveBeenCalledTimes(2)
    expect(animateSpy).toHaveBeenCalledTimes(1)
    let animateCalls = animateSpy.mock.calls as unknown as unknown[][]
    let keyframes = animateCalls[0]?.[0] as Keyframe[] | undefined
    let options = animateCalls[0]?.[1] as KeyframeAnimationOptions | undefined
    if (!keyframes || !options) {
      throw new Error('expected animate call')
    }
    expect(keyframes[0]?.transform).toBe('translate(-50px, 0px) scale(1, 1)')
    expect(keyframes[1]?.transform).toBe('none')
    expect(options).toMatchObject({ duration: 420, easing: 'linear' })
  })

  it('cancels in-flight animation when a new commit starts another one', () => {
    let reconciler = createDomReconciler(document)
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(<div mix={[animateLayout({ duration: 300, easing: 'ease-out' })]} />)
    flushTwice(root)

    let node = container.firstElementChild as HTMLElement
    let firstAnimation = createAnimation()
    let secondAnimation = createAnimation()
    let animateSpy = vi
      .fn(() => firstAnimation)
      .mockImplementationOnce(() => firstAnimation)
      .mockImplementationOnce(() => secondAnimation)
    node.animate = animateSpy

    vi.spyOn(node, 'getBoundingClientRect')
      .mockReturnValueOnce(createRect(0, 0, 100, 100))
      .mockReturnValueOnce(createRect(10, 0, 100, 100))
      .mockReturnValueOnce(createRect(20, 0, 100, 100))
      .mockReturnValueOnce(createRect(40, 0, 100, 100))

    root.render(<div mix={[animateLayout({ duration: 300, easing: 'ease-out' })]} />)
    flushTwice(root)

    root.render(<div mix={[animateLayout({ duration: 300, easing: 'ease-out' })]} />)
    flushTwice(root)

    expect(animateSpy).toHaveBeenCalledTimes(2)
    expect(firstAnimation.cancel).toHaveBeenCalledTimes(1)
    expect(secondAnimation.cancel).toHaveBeenCalledTimes(0)
  })

  it('cancels active animation on unmount', () => {
    let reconciler = createDomReconciler(document)
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(<div mix={[animateLayout()]} />)
    flushTwice(root)

    let node = container.firstElementChild as HTMLElement
    let animation = createAnimation()
    let animateSpy = vi.fn(() => animation)
    node.animate = animateSpy

    vi.spyOn(node, 'getBoundingClientRect')
      .mockReturnValueOnce(createRect(0, 0, 100, 100))
      .mockReturnValueOnce(createRect(20, 0, 100, 100))

    root.render(<div mix={[animateLayout()]} />)
    flushTwice(root)
    expect(animateSpy).toHaveBeenCalledTimes(1)

    root.render(null)
    flushTwice(root)

    expect(animation.cancel).toHaveBeenCalledTimes(1)
  })

  it('does not animate on first commit or when there is no measurable delta', () => {
    let reconciler = createDomReconciler(document)
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(<div mix={[animateLayout()]} />)
    flushTwice(root)

    let node = container.firstElementChild as HTMLElement
    let animateSpy = vi.fn(() => createAnimation())
    node.animate = animateSpy

    vi.spyOn(node, 'getBoundingClientRect')
      .mockReturnValueOnce(createRect(10, 10, 100, 100))
      .mockReturnValueOnce(createRect(10, 10, 100, 100))

    root.render(<div mix={[animateLayout()]} />)
    flushTwice(root)

    expect(animateSpy).toHaveBeenCalledTimes(0)
  })
})

function createAnimation(): MockAnimation {
  let listeners = new Map<string, EventListener[]>()
  let cancel = vi.fn(() => {
    let cancelListeners = listeners.get('cancel') ?? []
    for (let listener of cancelListeners) {
      listener(new Event('cancel'))
    }
  })

  let animation = {
    addEventListener(type: string, listener: EventListenerOrEventListenerObject | null) {
      if (!listener) return
      let eventListener =
        typeof listener === 'function' ? listener : (event: Event) => listener.handleEvent(event)
      let existing = listeners.get(type) ?? []
      existing.push(eventListener)
      listeners.set(type, existing)
    },
    cancel,
  }

  return animation as MockAnimation
}

function createRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON() {
      return {
        x: left,
        y: top,
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
      }
    },
  } as DOMRect
}

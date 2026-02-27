import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRoot } from '../vdom.ts'
import { animateLayout } from './animate-layout-mixin.tsx'
import { invariant } from '../invariant.ts'

interface MockAnimation {
  keyframes: Keyframe[]
  options: KeyframeAnimationOptions
  playState: AnimationPlayState
  finished: Promise<Animation>
  cancel: () => void
}

let originalAnimate: typeof Element.prototype.animate
let originalRaf: typeof globalThis.requestAnimationFrame
let mockAnimations: MockAnimation[] = []

function createMockAnimation(
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
): MockAnimation {
  let resolveFinished!: () => void
  let finished = new Promise<Animation>((_resolve) => {
    resolveFinished = () => _resolve({} as Animation)
  })
  return {
    keyframes,
    options,
    playState: 'running',
    finished,
    cancel() {
      this.playState = 'idle'
      resolveFinished()
    },
  }
}

function mockBoundingRect(
  el: Element,
  rect: { left: number; top: number; right: number; bottom: number },
) {
  el.getBoundingClientRect = () =>
    ({
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.right - rect.left,
      height: rect.bottom - rect.top,
      x: rect.left,
      y: rect.top,
      toJSON() {
        return this
      },
    }) as DOMRect
}

function mockBoundingRectSequence(
  el: Element,
  rects: Array<{ left: number; top: number; right: number; bottom: number }>,
) {
  let index = 0
  el.getBoundingClientRect = () => {
    let next = rects[Math.min(index, rects.length - 1)]
    index++
    return {
      left: next.left,
      top: next.top,
      right: next.right,
      bottom: next.bottom,
      width: next.right - next.left,
      height: next.bottom - next.top,
      x: next.left,
      y: next.top,
      toJSON() {
        return this
      },
    } as DOMRect
  }
}

describe('animateLayout mixin', () => {
  beforeEach(() => {
    mockAnimations = []
    originalAnimate = Element.prototype.animate
    originalRaf = globalThis.requestAnimationFrame
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
      queueMicrotask(() => callback(performance.now() + 1000))
      return 0
    }
    Element.prototype.animate = function (keyframes, options) {
      let animation = createMockAnimation(
        keyframes as Keyframe[],
        options as KeyframeAnimationOptions,
      ) as unknown as Animation
      mockAnimations.push(animation as unknown as MockAnimation)
      return animation
    }
  })

  afterEach(() => {
    Element.prototype.animate = originalAnimate
    globalThis.requestAnimationFrame = originalRaf
    document.body.innerHTML = ''
  })

  it('animates when layout geometry changes', () => {
    let container = document.createElement('div')
    let root = createRoot(container)

    root.render(<div data-tick="0" mix={[animateLayout({ duration: 350, easing: 'linear' })]} />)
    root.flush()
    let node = container.querySelector('div')
    invariant(node)

    mockBoundingRect(node, { left: 0, top: 0, right: 100, bottom: 100 })
    root.render(<div data-tick="1" mix={[animateLayout({ duration: 350, easing: 'linear' })]} />)
    root.flush()
    mockAnimations = []

    mockBoundingRectSequence(node, [
      { left: 0, top: 0, right: 100, bottom: 100 },
      { left: 40, top: 10, right: 140, bottom: 110 },
    ])
    root.render(<div data-tick="2" mix={[animateLayout({ duration: 350, easing: 'linear' })]} />)
    root.flush()

    expect(mockAnimations).toHaveLength(1)
    let animation = mockAnimations[0]
    expect(animation.options.duration).toBe(350)
    expect(animation.options.easing).toBe('linear')
  })

  it('does not animate when geometry does not change', () => {
    let container = document.createElement('div')
    let root = createRoot(container)

    root.render(<div data-tick="0" mix={[animateLayout()]} />)
    root.flush()
    let node = container.querySelector('div')
    invariant(node)

    mockBoundingRect(node, { left: 5, top: 5, right: 105, bottom: 105 })
    root.render(<div data-tick="1" mix={[animateLayout()]} />)
    root.flush()
    mockAnimations = []

    mockBoundingRectSequence(node, [
      { left: 5, top: 5, right: 105, bottom: 105 },
      { left: 5, top: 5, right: 105, bottom: 105 },
    ])
    root.render(<div data-tick="2" mix={[animateLayout()]} />)
    root.flush()

    expect(mockAnimations).toHaveLength(0)
  })

  it('cancels an in-flight layout animation when interrupted', () => {
    let container = document.createElement('div')
    let root = createRoot(container)

    root.render(<div data-tick="0" mix={[animateLayout()]} />)
    root.flush()
    let node = container.querySelector('div')
    invariant(node)

    mockBoundingRect(node, { left: 0, top: 0, right: 100, bottom: 100 })
    root.render(<div data-tick="1" mix={[animateLayout()]} />)
    root.flush()
    mockAnimations = []

    mockBoundingRectSequence(node, [
      { left: 0, top: 0, right: 100, bottom: 100 },
      { left: 30, top: 0, right: 130, bottom: 100 },
    ])
    root.render(<div data-tick="2" mix={[animateLayout()]} />)
    root.flush()
    let firstAnimation = mockAnimations[0]
    expect(firstAnimation.playState).toBe('running')

    mockBoundingRectSequence(node, [
      { left: 30, top: 0, right: 130, bottom: 100 },
      { left: 60, top: 0, right: 160, bottom: 100 },
    ])
    root.render(<div data-tick="3" mix={[animateLayout()]} />)
    root.flush()

    expect(firstAnimation.playState).toBe('idle')
    expect(mockAnimations).toHaveLength(2)
  })

  it('cancels active animation on remove', () => {
    let container = document.createElement('div')
    let root = createRoot(container)

    root.render(<div data-tick="0" mix={[animateLayout()]} />)
    root.flush()
    let node = container.querySelector('div')
    invariant(node)

    mockBoundingRect(node, { left: 0, top: 0, right: 100, bottom: 100 })
    root.render(<div data-tick="1" mix={[animateLayout()]} />)
    root.flush()
    mockAnimations = []

    mockBoundingRectSequence(node, [
      { left: 0, top: 0, right: 100, bottom: 100 },
      { left: 30, top: 0, right: 130, bottom: 100 },
    ])
    root.render(<div data-tick="2" mix={[animateLayout()]} />)
    root.flush()
    let active = mockAnimations[0]
    expect(active.playState).toBe('running')

    root.render(null)
    root.flush()

    expect(active.playState).toBe('idle')
  })
})

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import {
  registerLayoutElement,
  unregisterLayoutElement,
  markLayoutSubtreePending,
  captureLayoutSnapshots,
  applyLayoutAnimations,
} from '../lib/layout-animation.ts'

// --- WAAPI Mock ---

interface MockAnimation {
  keyframes: Keyframe[]
  options: KeyframeAnimationOptions
  playState: AnimationPlayState
  finished: Promise<Animation>
  cancel: () => void
  _resolve: () => void
  _reject: (reason?: unknown) => void
}

let mockAnimations: MockAnimation[] = []
let originalAnimate: typeof Element.prototype.animate

function createMockAnimation(
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
): MockAnimation {
  let resolve: () => void
  let reject: (reason?: unknown) => void
  let finished = new Promise<Animation>((res, rej) => {
    resolve = () => res({} as Animation)
    reject = rej
  })

  let animation: MockAnimation = {
    keyframes,
    options,
    playState: 'running',
    finished,
    cancel() {
      this.playState = 'idle'
      reject(new DOMException('Animation cancelled', 'AbortError'))
    },
    _resolve: resolve!,
    _reject: reject!,
  }

  mockAnimations.push(animation)
  return animation
}

// --- Test Helpers ---

function createTestElement(): HTMLElement {
  let el = document.createElement('div')
  document.body.appendChild(el)
  return el
}

function mockBoundingRect(
  el: HTMLElement,
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

// --- Tests ---

describe('layout-animation', () => {
  beforeEach(() => {
    mockAnimations = []
    originalAnimate = Element.prototype.animate
    Element.prototype.animate = function (keyframes, options) {
      return createMockAnimation(
        keyframes as Keyframe[],
        options as KeyframeAnimationOptions,
      ) as unknown as Animation
    }
  })

  afterEach(() => {
    Element.prototype.animate = originalAnimate
    // Clean up any test elements
    document.body.innerHTML = ''
  })

  describe('registerLayoutElement / unregisterLayoutElement', () => {
    it('registers an element for layout animations', () => {
      let el = createTestElement()
      mockBoundingRect(el, { left: 0, top: 0, right: 100, bottom: 100 })

      registerLayoutElement(el, { duration: 200 })

      // Should not create animation on registration alone
      expect(mockAnimations).toHaveLength(0)

      unregisterLayoutElement(el)
    })

    it('clears transform styles on unregister', () => {
      let el = createTestElement()
      mockBoundingRect(el, { left: 0, top: 0, right: 100, bottom: 100 })
      el.style.transform = 'translate3d(10px, 20px, 0)'
      el.style.transformOrigin = '50% 50%'

      registerLayoutElement(el, {})
      unregisterLayoutElement(el)

      expect(el.style.transform).toBe('')
      expect(el.style.transformOrigin).toBe('')
    })
  })

  describe('FLIP animation flow', () => {
    it('captures snapshot before DOM changes and animates after', () => {
      let el = createTestElement()
      let parent = document.body

      // Initial position
      mockBoundingRect(el, { left: 0, top: 0, right: 100, bottom: 100 })

      registerLayoutElement(el, { duration: 200, easing: 'ease-out' })
      markLayoutSubtreePending(parent)
      captureLayoutSnapshots()

      // Simulate DOM change - element moved right and down
      mockBoundingRect(el, { left: 50, top: 30, right: 150, bottom: 130 })

      applyLayoutAnimations()

      // Should create one animation
      expect(mockAnimations).toHaveLength(1)

      let animation = mockAnimations[0]
      expect(animation.options.duration).toBe(200)
      expect(animation.options.easing).toBe('ease-out')

      // Keyframes should go from inverted position to identity
      expect(animation.keyframes).toHaveLength(2)
      expect(animation.keyframes[0].transform).toContain('translate3d(-50px, -30px, 0)')
      expect(animation.keyframes[1].transform).toBe('none')

      unregisterLayoutElement(el)
    })

    it('does not animate when position has not changed', () => {
      let el = createTestElement()
      let parent = document.body

      mockBoundingRect(el, { left: 100, top: 100, right: 200, bottom: 200 })

      registerLayoutElement(el, {})
      markLayoutSubtreePending(parent)
      captureLayoutSnapshots()

      // Same position after "DOM change"
      mockBoundingRect(el, { left: 100, top: 100, right: 200, bottom: 200 })

      applyLayoutAnimations()

      // No animation needed
      expect(mockAnimations).toHaveLength(0)

      unregisterLayoutElement(el)
    })

    it('includes scale when element size changes', () => {
      let el = createTestElement()
      let parent = document.body

      // Original size: 100x100
      mockBoundingRect(el, { left: 0, top: 0, right: 100, bottom: 100 })

      registerLayoutElement(el, {})
      markLayoutSubtreePending(parent)
      captureLayoutSnapshots()

      // New size: 200x50 (doubled width, halved height)
      mockBoundingRect(el, { left: 0, top: 0, right: 200, bottom: 50 })

      applyLayoutAnimations()

      expect(mockAnimations).toHaveLength(1)

      let animation = mockAnimations[0]
      // Scale should invert: old/new, so 100/200=0.5 for x, 100/50=2 for y
      expect(animation.keyframes[0].transform).toContain('scale(0.5, 2)')

      unregisterLayoutElement(el)
    })

    it('combines translation and scale when both change', () => {
      let el = createTestElement()
      let parent = document.body

      // Original: 100x100 at (0,0)
      mockBoundingRect(el, { left: 0, top: 0, right: 100, bottom: 100 })

      registerLayoutElement(el, {})
      markLayoutSubtreePending(parent)
      captureLayoutSnapshots()

      // New: 200x200 at (100,100)
      mockBoundingRect(el, { left: 100, top: 100, right: 300, bottom: 300 })

      applyLayoutAnimations()

      expect(mockAnimations).toHaveLength(1)

      let animation = mockAnimations[0]
      let transform = animation.keyframes[0].transform as string

      // Should have both translate and scale
      expect(transform).toContain('translate3d(')
      expect(transform).toContain('scale(')

      unregisterLayoutElement(el)
    })

    it('uses default duration and easing when not specified', () => {
      let el = createTestElement()
      let parent = document.body

      mockBoundingRect(el, { left: 0, top: 0, right: 100, bottom: 100 })

      registerLayoutElement(el, {})
      markLayoutSubtreePending(parent)
      captureLayoutSnapshots()

      mockBoundingRect(el, { left: 50, top: 0, right: 150, bottom: 100 })

      applyLayoutAnimations()

      let animation = mockAnimations[0]
      expect(animation.options.duration).toBe(200)
      expect(animation.options.easing).toBe('ease-out')

      unregisterLayoutElement(el)
    })
  })

  describe('newly registered elements', () => {
    it('initializes snapshot for newly registered elements without animating', () => {
      let el = createTestElement()

      mockBoundingRect(el, { left: 0, top: 0, right: 100, bottom: 100 })

      // Register without marking pending - simulates first render
      registerLayoutElement(el, {})

      // Apply without capturing (newly registered element)
      applyLayoutAnimations()

      // Should not animate - just initialize
      expect(mockAnimations).toHaveLength(0)

      unregisterLayoutElement(el)
    })
  })

  describe('animation interruption', () => {
    it('cancels previous animation when position changes mid-flight', () => {
      let el = createTestElement()
      let parent = document.body

      mockBoundingRect(el, { left: 0, top: 0, right: 100, bottom: 100 })

      registerLayoutElement(el, {})
      markLayoutSubtreePending(parent)
      captureLayoutSnapshots()

      // First position change
      mockBoundingRect(el, { left: 50, top: 0, right: 150, bottom: 100 })
      applyLayoutAnimations()

      expect(mockAnimations).toHaveLength(1)
      let firstAnimation = mockAnimations[0]
      expect(firstAnimation.playState).toBe('running')

      // Second position change while first is still running
      markLayoutSubtreePending(parent)
      captureLayoutSnapshots()
      mockBoundingRect(el, { left: 100, top: 0, right: 200, bottom: 100 })
      applyLayoutAnimations()

      // First animation should be cancelled
      expect(firstAnimation.playState).toBe('idle')
      // New animation should be created
      expect(mockAnimations).toHaveLength(2)
      expect(mockAnimations[1].playState).toBe('running')

      unregisterLayoutElement(el)
    })
  })

  describe('markLayoutSubtreePending', () => {
    it('only processes elements within the marked subtree', () => {
      let container1 = document.createElement('div')
      let container2 = document.createElement('div')
      let el1 = document.createElement('div')
      let el2 = document.createElement('div')

      container1.appendChild(el1)
      container2.appendChild(el2)
      document.body.appendChild(container1)
      document.body.appendChild(container2)

      mockBoundingRect(el1, { left: 0, top: 0, right: 100, bottom: 100 })
      mockBoundingRect(el2, { left: 0, top: 0, right: 100, bottom: 100 })

      registerLayoutElement(el1, {})
      registerLayoutElement(el2, {})

      // Only mark container1 as pending
      markLayoutSubtreePending(container1)
      captureLayoutSnapshots()

      // Change positions for both
      mockBoundingRect(el1, { left: 50, top: 0, right: 150, bottom: 100 })
      mockBoundingRect(el2, { left: 50, top: 0, right: 150, bottom: 100 })

      applyLayoutAnimations()

      // Only el1 should animate (it was in the pending subtree)
      expect(mockAnimations).toHaveLength(1)

      unregisterLayoutElement(el1)
      unregisterLayoutElement(el2)
    })
  })

  describe('transform origin', () => {
    it('sets transform origin based on delta calculation', () => {
      let el = createTestElement()
      let parent = document.body

      mockBoundingRect(el, { left: 0, top: 0, right: 100, bottom: 100 })

      registerLayoutElement(el, {})
      markLayoutSubtreePending(parent)
      captureLayoutSnapshots()

      mockBoundingRect(el, { left: 50, top: 50, right: 150, bottom: 150 })

      applyLayoutAnimations()

      let animation = mockAnimations[0]
      // Default origin is 50% 50%
      expect(animation.keyframes[0].transformOrigin).toBe('50% 50%')
      expect(animation.keyframes[1].transformOrigin).toBe('50% 50%')

      unregisterLayoutElement(el)
    })
  })

  describe('edge cases', () => {
    it('handles zero-size elements gracefully', () => {
      let el = createTestElement()
      let parent = document.body

      // Zero-size element
      mockBoundingRect(el, { left: 0, top: 0, right: 0, bottom: 0 })

      registerLayoutElement(el, {})
      markLayoutSubtreePending(parent)
      captureLayoutSnapshots()

      // Still zero-size but moved
      mockBoundingRect(el, { left: 50, top: 50, right: 50, bottom: 50 })

      applyLayoutAnimations()

      // Should handle without errors
      expect(mockAnimations).toHaveLength(1)

      unregisterLayoutElement(el)
    })

    it('snaps to identity for very small deltas', () => {
      let el = createTestElement()
      let parent = document.body

      mockBoundingRect(el, { left: 0, top: 0, right: 100, bottom: 100 })

      registerLayoutElement(el, {})
      markLayoutSubtreePending(parent)
      captureLayoutSnapshots()

      // Very small position change (below precision threshold)
      mockBoundingRect(el, { left: 0.005, top: 0.005, right: 100.005, bottom: 100.005 })

      applyLayoutAnimations()

      // Should not animate for sub-pixel changes
      expect(mockAnimations).toHaveLength(0)

      unregisterLayoutElement(el)
    })
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createReconciler } from '../index.ts'
import { presence } from './presence.ts'
import type { Plugin } from '../types.ts'

describe('plugin-spike example presence plugin', () => {
  let animations: MockAnimation[] = []
  let animateSpy = vi.spyOn(Element.prototype, 'animate')

  afterEach(() => {
    animateSpy.mockReset()
    animations = []
  })

  it('animates entry and waits for WAAPI exit before removal', async () => {
    animateSpy.mockImplementation((keyframes, options) => {
      let animation = createMockAnimation(keyframes, options)
      animations.push(animation)
      return animation as unknown as Animation
    })

    let reconciler = createReconciler([presence, createPassthroughPlugin()])
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(() => (
      <div key="a" {...({ presenceMs: 50 } as Record<string, unknown>)} connect={() => {}}>
        hello
      </div>
    ))
    root.flush()

    expect(animations).toHaveLength(1)
    expect(animations[0].keyframes).toEqual([{ opacity: 0 }, { opacity: 1 }])
    expect(animations[0].options).toMatchObject({ duration: 50 })
    expect(container.innerHTML).toBe('<div>hello</div>')

    root.render(() => null)
    root.flush()
    expect(animations).toHaveLength(2)
    expect(animations[1].keyframes).toEqual([{ opacity: 1 }, { opacity: 0 }])
    expect(container.innerHTML).toBe('<div>hello</div>')

    animations[1].finish()
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(container.innerHTML).toBe('')
  })

  it('cancels exit and restarts entry when removal is interrupted by reclaim', async () => {
    animateSpy.mockImplementation((keyframes, options) => {
      let animation = createMockAnimation(keyframes, options)
      animations.push(animation)
      return animation as unknown as Animation
    })

    let reconciler = createReconciler([presence, createPassthroughPlugin()])
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)
    let firstNode: null | Element = null
    let reclaimedNode: null | Element = null

    root.render(() => (
      <div
        key="a"
        {...({ presenceMs: 50 } as Record<string, unknown>)}
        connect={(node: Element) => {
          firstNode = node
        }}
      >
        hello
      </div>
    ))
    root.flush()
    expect(animations).toHaveLength(1)

    root.render(() => null)
    root.flush()
    expect(animations).toHaveLength(2)
    let exitAnimation = animations[1]
    expect(container.children.length).toBe(1)

    root.render(() => (
      <div
        key="a"
        {...({ presenceMs: 50 } as Record<string, unknown>)}
        connect={(node: Element) => {
          reclaimedNode = node
        }}
      >
        hello again
      </div>
    ))
    root.flush()
    expect(exitAnimation.canceled).toBe(true)
    expect(animations).toHaveLength(3)
    expect(animations[2].keyframes).toEqual([{ opacity: 0 }, { opacity: 1 }])

    expect(firstNode).toBeTruthy()
    expect(reclaimedNode).toBe(firstNode)
    expect(container.innerHTML).toBe('<div>hello again</div>')

    exitAnimation.finish()
    await Promise.resolve()
    expect(container.innerHTML).toBe('<div>hello again</div>')
  })
})

function createPassthroughPlugin(): Plugin {
  return () => () => (input) => input
}

type MockAnimation = {
  finished: Promise<void>
  keyframes: null | PropertyIndexedKeyframes | Keyframe[] | undefined
  options: null | number | KeyframeAnimationOptions | undefined
  canceled: boolean
  finish(): void
  cancel(): void
}

function createMockAnimation(
  keyframes: null | PropertyIndexedKeyframes | Keyframe[] | undefined,
  options: null | number | KeyframeAnimationOptions | undefined,
): MockAnimation {
  let settled = false
  let resolveFinished = () => {}
  let rejectFinished = (_error?: unknown) => {}
  let finished = new Promise<void>((resolve, reject) => {
    resolveFinished = resolve
    rejectFinished = reject
  })

  return {
    finished,
    keyframes,
    options,
    canceled: false,
    finish() {
      if (settled) return
      settled = true
      resolveFinished()
    },
    cancel() {
      if (settled) return
      settled = true
      this.canceled = true
      rejectFinished(new Error('canceled'))
    },
  }
}

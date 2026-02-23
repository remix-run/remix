import { describe, expect, it } from 'vitest'
import { createDomReconciler } from '../dom-reconciler.ts'
import { on } from './on-mixin.tsx'

describe('on mixin', () => {
  it('supports reentry signal and aborts previous run', () => {
    let firstSignal: null | AbortSignal = null
    let secondSignal: null | AbortSignal = null
    let calls = 0
    let reconciler = createDomReconciler(document)
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(
      <button
        mix={[
          on('click', (_event, reentrySignal) => {
            calls++
            if (calls === 1) firstSignal = reentrySignal
            if (calls === 2) secondSignal = reentrySignal
          }),
        ]}
      >
        hello
      </button>,
    )
    root.flush()
    let button = container.firstElementChild as HTMLButtonElement
    button.click()
    button.click()

    expect(calls).toBe(2)
    if (!firstSignal || !secondSignal) {
      throw new Error('expected reentry signals')
    }
    let initialSignal = firstSignal as AbortSignal
    let latestSignal = secondSignal as AbortSignal
    expect(initialSignal.aborted).toBe(true)
    expect(latestSignal.aborted).toBe(false)
  })

  it('retargets listeners when event type changes and detaches on unmount', () => {
    let clicks = 0
    let pointerDowns = 0
    let reconciler = createDomReconciler(document)
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(
      <button
        mix={[
          on('click', () => {
            clicks++
          }),
        ]}
      />,
    )
    root.flush()
    root.flush()

    let button = container.firstElementChild as HTMLButtonElement
    button.click()
    expect(clicks).toBe(1)

    root.render(
      <button
        mix={[
          on('pointerdown', () => {
            pointerDowns++
          }),
        ]}
      />,
    )
    root.flush()
    root.flush()

    button.click()
    button.dispatchEvent(new PointerEvent('pointerdown'))
    expect(clicks).toBe(1)
    expect(pointerDowns).toBe(1)

    root.render(null)
    root.flush()
    button.dispatchEvent(new PointerEvent('pointerdown'))
    expect(pointerDowns).toBe(1)
  })
})

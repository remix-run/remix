import { describe, it, expect, vi } from 'vitest'
import { createRoot } from './vdom.ts'
import { requestRemount } from './component.ts'
import type { Handle } from './component.ts'

describe('requestRemount', () => {
  it('triggers cleanup listeners when signal is aborted', () => {
    let container = document.createElement('div')
    let root = createRoot(container)

    let cleanupCount = 0
    let componentHandle!: Handle

    function TestComponent(handle: Handle) {
      componentHandle = handle

      // Register cleanup listener
      handle.signal.addEventListener('abort', () => {
        cleanupCount++
      })

      return () => <div>Test</div>
    }

    root.render(<TestComponent />)
    root.flush()

    expect(cleanupCount).toBe(0)

    // Trigger remount - should abort old signal
    requestRemount(componentHandle!)
    root.flush()

    expect(cleanupCount).toBe(1)
  })

  it('creates a new signal after remount', () => {
    let container = document.createElement('div')
    let root = createRoot(container)

    let signals: AbortSignal[] = []
    let componentHandle!: Handle

    function TestComponent(handle: Handle) {
      componentHandle = handle
      signals.push(handle.signal)
      return () => <div>Test</div>
    }

    root.render(<TestComponent />)
    root.flush()

    let originalSignal = signals[0]
    expect(originalSignal.aborted).toBe(false)

    // Trigger remount
    requestRemount(componentHandle!)
    root.flush()

    // Old signal should be aborted
    expect(originalSignal.aborted).toBe(true)

    // New signal should exist and not be aborted
    let newSignal = componentHandle!.signal
    expect(newSignal).not.toBe(originalSignal)
    expect(newSignal.aborted).toBe(false)
  })

  it('re-initializes setup scope on remount', () => {
    let container = document.createElement('div')
    let root = createRoot(container)

    let setupCount = 0
    let componentHandle!: Handle

    function TestComponent(handle: Handle) {
      componentHandle = handle
      setupCount++
      let count = 0

      return () => (
        <button
          on={{
            click() {
              count++
              handle.update()
            },
          }}
        >
          {count}
        </button>
      )
    }

    root.render(<TestComponent />)
    root.flush()

    expect(setupCount).toBe(1)

    let button = container.querySelector('button')!
    button.click()
    root.flush()

    // Count should be incremented
    expect(button.textContent).toBe('1')

    // Remount - should re-run setup
    requestRemount(componentHandle!)
    root.flush()

    expect(setupCount).toBe(2)

    // Count should be reset to 0
    expect(button.textContent).toBe('0')
  })

  it('triggers update after remount', () => {
    let container = document.createElement('div')
    let root = createRoot(container)

    let renderCount = 0
    let componentHandle!: Handle

    function TestComponent(handle: Handle) {
      componentHandle = handle

      return () => {
        renderCount++
        return <div>Render {renderCount}</div>
      }
    }

    root.render(<TestComponent />)
    root.flush()

    expect(renderCount).toBe(1)

    // Remount should trigger update
    requestRemount(componentHandle!)
    root.flush()

    // Initial render + render after remount
    expect(renderCount).toBe(2)
    expect(container.textContent).toBe('Render 2')
  })

  it('warns when called with unknown handle', () => {
    let consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    let unknownHandle = {
      id: 'unknown',
      signal: new AbortController().signal,
      update: vi.fn(),
    } as unknown as Handle

    requestRemount(unknownHandle)

    expect(consoleWarnSpy).toHaveBeenCalledWith('requestRemount called with unknown handle')

    consoleWarnSpy.mockRestore()
  })

  it('handles multiple remounts correctly', () => {
    let container = document.createElement('div')
    let root = createRoot(container)

    let setupCount = 0
    let cleanupCount = 0
    let componentHandle!: Handle

    function TestComponent(handle: Handle) {
      componentHandle = handle
      setupCount++

      handle.signal.addEventListener('abort', () => {
        cleanupCount++
      })

      return () => <div>Setup: {setupCount}</div>
    }

    root.render(<TestComponent />)
    root.flush()

    expect(setupCount).toBe(1)
    expect(cleanupCount).toBe(0)

    // First remount
    requestRemount(componentHandle)
    root.flush()

    expect(setupCount).toBe(2)
    expect(cleanupCount).toBe(1)

    // Second remount
    requestRemount(componentHandle)
    root.flush()

    expect(setupCount).toBe(3)
    expect(cleanupCount).toBe(2)

    // Third remount
    requestRemount(componentHandle)
    root.flush()

    expect(setupCount).toBe(4)
    expect(cleanupCount).toBe(3)
  })

  it('preserves component identity across remounts', () => {
    let container = document.createElement('div')
    let root = createRoot(container)

    let componentHandle!: Handle
    let ids: string[] = []

    function TestComponent(handle: Handle) {
      componentHandle = handle
      ids.push(handle.id)
      return () => <div>ID: {handle.id}</div>
    }

    root.render(<TestComponent />)
    root.flush()

    let originalId = ids[0]

    // Remount multiple times
    requestRemount(componentHandle)
    root.flush()

    requestRemount(componentHandle)
    root.flush()

    // Component ID should remain stable
    expect(ids).toEqual([originalId, originalId, originalId])
    expect(componentHandle.id).toBe(originalId)
  })

  it('clears interval when signal is aborted during remount', () => {
    let container = document.createElement('div')
    let root = createRoot(container)

    let componentHandle!: Handle
    let intervals: NodeJS.Timeout[] = []

    function TestComponent(handle: Handle) {
      componentHandle = handle

      let interval = setInterval(() => handle.update(), 1000)
      intervals.push(interval)

      handle.signal.addEventListener('abort', () => {
        clearInterval(interval)
      })

      return () => <div>Test</div>
    }

    root.render(<TestComponent />)
    root.flush()

    expect(intervals).toHaveLength(1)

    // Spy on clearInterval
    let clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')

    // Remount - should clear the old interval
    requestRemount(componentHandle)
    root.flush()

    expect(clearIntervalSpy).toHaveBeenCalledWith(intervals[0])
    expect(intervals).toHaveLength(2)

    clearIntervalSpy.mockRestore()
  })
})

import type { Handle } from '@remix-run/component'

/**
 * A timer component that demonstrates HMR cleanup behavior.
 *
 * Uses setInterval in the setup scope and registers cleanup via handle.signal.
 * This test verifies that cleanup listeners fire during HMR remount when the setup changes.
 *
 * @param handle The component handle for triggering updates
 * @returns A render function that returns the timer UI
 */
export function Timer(handle: Handle) {
  // Track cleanup calls by storing to global for test verification
  let cleanupCount = (globalThis as any).__timer_cleanup_count || 0

  // Setup scope - runs once
  let interval = setInterval(() => handle.update(), 1000)

  // Register cleanup - should fire when component signal is aborted
  handle.signal.addEventListener('abort', () => {
    clearInterval(interval)
    cleanupCount++
    ;(globalThis as any).__timer_cleanup_count = cleanupCount
  })

  return () => (
    <div data-testid="timer">
      <p data-testid="timer-tick">Tick: {new Date().toISOString()}</p>
    </div>
  )
}

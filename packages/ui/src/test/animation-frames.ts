import type { TestContext } from '@remix-run/test'

// Holds animation frames for the rest of the test, like fake timers hold timeouts. Tests that
// dispatch their own transition events need this: `waitForCssTransition()` finishes a close
// transition on its own if two frames pass without a `transitionrun`, and a slow runner can render
// two frames while the test awaits a popover `toggle` event.
export function holdAnimationFrames(t: TestContext) {
  t.mock.method(globalThis, 'requestAnimationFrame', () => 0)
  t.mock.method(globalThis, 'cancelAnimationFrame', () => {})
}

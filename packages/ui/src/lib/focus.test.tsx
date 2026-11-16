import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { createRoot } from '@remix-run/component'
import { FocusGuard } from './focus.tsx'

describe('focus guards', () => {
  it('retains its element while toggling keyboard and WebKit accessibility activation', (t) => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    t.after(() => {
      root.dispose()
      container.remove()
    })
    let onFocus = () => {}
    root.render(<FocusGuard active={false} onFocus={onFocus} />)
    root.flush()
    let guard = container.querySelector<HTMLElement>('[data-rmx-focus-guard]')
    if (!guard) throw new Error('Missing guard')
    expect(guard.tabIndex).toBe(-1)
    expect(guard.getAttribute('aria-hidden')).toBe('true')
    expect(guard.hasAttribute('role')).toBe(false)

    root.render(<FocusGuard active onFocus={onFocus} />)
    root.flush()
    expect(container.querySelector('[data-rmx-focus-guard]')).toBe(guard)
    expect(guard.tabIndex).toBe(0)
    let platform = navigator.platform.toLowerCase()
    let webKit =
      (platform.startsWith('mac') || /^i(os$|p)/.test(platform)) &&
      CSS.supports('-webkit-backdrop-filter:none')
    expect(guard.getAttribute('role')).toBe(webKit ? 'button' : null)
    expect(guard.getAttribute('aria-hidden')).toBe(webKit ? null : 'true')

    root.render(<FocusGuard active={false} onFocus={onFocus} />)
    root.flush()
    expect(guard.tabIndex).toBe(-1)
    expect(guard.getAttribute('aria-hidden')).toBe('true')
    expect(guard.hasAttribute('role')).toBe(false)
  })

  it('delegates focus and ref lifetime to the owning pattern', (t) => {
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    t.after(() => {
      root.dispose()
      container.remove()
    })
    let signal: AbortSignal | undefined
    let registered: HTMLElement | undefined
    let focused: HTMLElement | undefined
    root.render(
      <FocusGuard
        active
        onRef={(node, lifetime) => {
          registered = node
          signal = lifetime
        }}
        onFocus={(event) => {
          focused = event.currentTarget
        }}
      />,
    )
    root.flush()
    if (!registered) throw new Error('Missing registered guard')
    registered.focus()
    expect(focused).toBe(registered)
    expect(document.activeElement).toBe(registered)
    expect(signal?.aborted).toBe(false)
    root.dispose()
    expect(signal?.aborted).toBe(true)
  })
})

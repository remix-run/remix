import { describe, expect, it } from 'vitest'
import type { Handle } from '../lib/component.ts'
import { createRoot } from '../lib/vdom.ts'
import { on } from '../index.ts'

describe('vdom controlled props', () => {
  it('restores controlled value on native input when no update happens', async () => {
    let container = document.createElement('div')
    let root = createRoot(container)
    root.render(<input value="hello" />)
    root.flush()

    let input = container.querySelector('input') as HTMLInputElement
    input.value = 'hello123'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await Promise.resolve()
    await Promise.resolve()
    expect(input.value).toBe('hello')
  })

  it('restores controlled checked on native change when no update happens', async () => {
    let container = document.createElement('div')
    let root = createRoot(container)
    root.render(<input type="checkbox" checked={true} />)
    root.flush()

    let input = container.querySelector('input') as HTMLInputElement
    input.checked = false
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await Promise.resolve()
    await Promise.resolve()
    expect(input.checked).toBe(true)
  })

  it('does not clobber controlled value when input event commits a new value', async () => {
    function App(handle: Handle) {
      let value = 'hello'
      return () => (
        <input
          value={value}
          mix={[
            on('input', (event) => {
              value = event.currentTarget.value
              handle.update()
            }),
          ]}
        />
      )
    }

    let container = document.createElement('div')
    let root = createRoot(container)
    root.render(<App />)
    root.flush()

    let input = container.querySelector('input') as HTMLInputElement
    input.value = 'helloa'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await Promise.resolve()
    await Promise.resolve()
    expect(input.value).toBe('helloa')
  })

  it('does not control value/checked when prop value is undefined', async () => {
    let container = document.createElement('div')
    let root = createRoot(container)
    root.render(
      <>
        <input id="text" value={undefined} />
        <input id="check" type="checkbox" checked={undefined} />
      </>,
    )
    root.flush()

    let text = container.querySelector('#text') as HTMLInputElement
    text.value = 'user typed'
    text.dispatchEvent(new Event('input', { bubbles: true }))

    let check = container.querySelector('#check') as HTMLInputElement
    check.checked = true
    check.dispatchEvent(new Event('change', { bubbles: true }))

    await Promise.resolve()
    await Promise.resolve()
    expect(text.value).toBe('user typed')
    expect(check.checked).toBe(true)
  })

  it('detaches controlled listeners on dispose', async () => {
    let container = document.createElement('div')
    let root = createRoot(container)
    root.render(<input value="hello" />)
    root.flush()

    let input = container.querySelector('input') as HTMLInputElement
    root.dispose()
    root.flush()

    input.value = 'post-dispose'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await Promise.resolve()
    await Promise.resolve()
    expect(input.value).toBe('post-dispose')
  })
})

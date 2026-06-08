import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { on, type Handle } from '../index.ts'
import { render } from '../test.ts'

describe('render', () => {
  function Counter(handle: Handle<{ count?: number }>) {
    let count = handle.props.count ?? 0
    return () => (
      <div>
        <h3>Counter</h3>
        <div>
          <button
            data-action="decrement"
            mix={[
              on('click', () => {
                count--
                handle.update()
              }),
            ]}
          >
            -
          </button>
          <span
            data-testid="count"
            style={{ fontSize: '24px', minWidth: '2ch', textAlign: 'center' }}
          >
            {count}
          </span>
          <button
            data-action="increment"
            mix={[
              on('click', () => {
                count++
                handle.update()
              }),
            ]}
          >
            +
          </button>
        </div>
      </div>
    )
  }

  it('renders with initial count of 0 when not specified', (t) => {
    let { $, cleanup } = render(<Counter />)
    t.after(cleanup)
    expect(Number($('[data-testid="count"]')?.textContent)).toBe(0)
  })

  it('renders with a provided initial count', (t) => {
    let { $, cleanup } = render(<Counter count={5} />)
    t.after(cleanup)
    expect(Number($('[data-testid="count"]')?.textContent)).toBe(5)
  })

  it('flushes updates triggered during act', async (t) => {
    let { $, act, cleanup } = render(<Counter />)
    t.after(cleanup)

    await act(() => $('[data-action="increment"]')?.click())
    expect(Number($('[data-testid="count"]')?.textContent)).toBe(1)

    await act(() => $('[data-action="increment"]')?.click())
    expect(Number($('[data-testid="count"]')?.textContent)).toBe(2)

    await act(() => $('[data-action="decrement"]')?.click())
    expect(Number($('[data-testid="count"]')?.textContent)).toBe(1)
  })

  it('cleanup disposes the root and removes the container from the DOM', () => {
    let { container, cleanup } = render(<div data-testid="manual">hello</div>)
    expect(document.body.contains(container)).toBe(true)

    cleanup()
    expect(document.body.contains(container)).toBe(false)
  })
})

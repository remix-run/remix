import * as assert from '@remix-run/assert'
import { describe, it, render } from '@remix-run/test/browser'
import { on, type Handle } from '@remix-run/component'

function Counter(handle: Handle, setup?: number) {
  let count = setup ?? 0
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

// --- Tests ---

describe('Counter', () => {
  it('renders with initial count of 0 when not specified', () => {
    let { $, cleanup } = render(<Counter />)
    assert.equal(Number($('[data-testid="count"]')!.textContent), 0)
    cleanup()
  })

  it('renders with a setup-prop provided initial count', () => {
    let { $, cleanup } = render(<Counter setup={5} />)
    assert.equal(Number($('[data-testid="count"]')!.textContent), 5)
    cleanup()
  })

  it('increments the count', async () => {
    let { $, act, cleanup } = render(<Counter />)
    await act(() => $('[data-action="increment"]')?.click())
    assert.equal(Number($('[data-testid="count"]')!.textContent), 1)
    cleanup()
  })

  it('decrements the count', async () => {
    let { $, act, cleanup } = render(<Counter />)
    await act(() => $('[data-action="decrement"]')?.click())
    assert.equal(Number($('[data-testid="count"]')!.textContent), -1)
    cleanup()
  })

  it('increments multiple times', async () => {
    let { $, act, cleanup } = render(<Counter />)
    await act(() => $('[data-action="increment"]')?.click())
    await act(() => $('[data-action="increment"]')?.click())
    await act(() => $('[data-action="increment"]')?.click())
    assert.equal(Number($('[data-testid="count"]')!.textContent), 3)
    cleanup()
  })

  it('increments and decrements', async () => {
    let { $, act, cleanup } = render(<Counter />)
    await act(() => $('[data-action="increment"]')?.click())
    await act(() => $('[data-action="increment"]')?.click())
    await act(() => $('[data-action="decrement"]')?.click())
    assert.equal(Number($('[data-testid="count"]')!.textContent), 1)
    cleanup()
  })
})

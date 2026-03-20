import decamelize from 'decamelize'
import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { render } from '@remix-run/test/browser'
import { on, type Handle } from '@remix-run/component'

// ── Counter ───────────────────────────────────────────────────────────────────

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

// ── FieldLabel ────────────────────────────────────────────────────────────────

// Demonstrates that ESM third-party libraries are importable from test modules

function FieldLabel(_handle: unknown) {
  return (props: { name: string }) => (
    <span data-testid="label">{decamelize(props.name, { separator: ' ' })}</span>
  )
}

describe('FieldLabel (using decamelize)', () => {
  it('renders a single word unchanged', () => {
    let { $, cleanup } = render(<FieldLabel name="name" />)
    assert.equal($('[data-testid="label"]')?.textContent, 'name')
    cleanup()
  })

  it('converts camelCase to spaced words', () => {
    let { $, cleanup } = render(<FieldLabel name="firstName" />)
    assert.equal($('[data-testid="label"]')?.textContent, 'first name')
    cleanup()
  })

  it('handles multiple humps', () => {
    let { $, cleanup } = render(<FieldLabel name="dateOfBirth" />)
    assert.equal($('[data-testid="label"]')?.textContent, 'date of birth')
    cleanup()
  })
})

// ── DOM ───────────────────────────────────────────────────────────────────────

describe('DOM Tests', () => {
  it('can interact with DOM', async () => {
    let div = document.createElement('div')
    div.textContent = 'Hello'
    assert.equal(div.textContent, 'Hello')
  })

  it('can test fetch API', async () => {
    let response = await fetch('data:text/plain,hello')
    let text = await response.text()
    assert.equal(text, 'hello')
  })

  it.skip('skip: can skip tests', () => {
    assert.equal(true, false)
  })

  it.todo('todo: can mark tests as todo')
})

describe.skip('skip: Skipped Test Suite', () => {
  it('would fail', () => {
    assert.equal(true, false)
  })
})

describe.todo('todo: Test Suite')

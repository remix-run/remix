import decamelize from 'decamelize'
import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { on, type Handle } from '@remix-run/component'

describe('Counter', () => {
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

  it('renders with initial count of 0 when not specified', (t) => {
    let { $ } = t.render(<Counter />)
    assert.equal(Number($('[data-testid="count"]')!.textContent), 0)
  })

  it('renders with a setup-prop provided initial count', (t) => {
    let { $ } = t.render(<Counter setup={5} />)
    assert.equal(Number($('[data-testid="count"]')!.textContent), 5)
  })

  it('increments the count', async (t) => {
    let { $, act } = t.render(<Counter />)
    await act(() => $('[data-action="increment"]')?.click())
    assert.equal(Number($('[data-testid="count"]')!.textContent), 1)
  })

  it('decrements the count', async (t) => {
    let { $, act } = t.render(<Counter />)
    await act(() => $('[data-action="decrement"]')?.click())
    assert.equal(Number($('[data-testid="count"]')!.textContent), -1)
  })

  it('increments multiple times', async (t) => {
    let { $, act } = t.render(<Counter />)
    await act(() => $('[data-action="increment"]')?.click())
    await act(() => $('[data-action="increment"]')?.click())
    await act(() => $('[data-action="increment"]')?.click())
    assert.equal(Number($('[data-testid="count"]')!.textContent), 3)
  })

  it('increments and decrements', async (t) => {
    let { $, act } = t.render(<Counter />)
    await act(() => $('[data-action="increment"]')?.click())
    await act(() => $('[data-action="increment"]')?.click())
    await act(() => $('[data-action="decrement"]')?.click())
    assert.equal(Number($('[data-testid="count"]')!.textContent), 1)
  })
})

describe('FieldLabel (using decamelize)', () => {
  // Demonstrates that ESM third-party libraries are importable from test modules
  function FieldLabel(_handle: unknown) {
    return (props: { name: string }) => (
      <span data-testid="label">{decamelize(props.name, { separator: ' ' })}</span>
    )
  }

  it('renders a single word unchanged', (t) => {
    let { $ } = t.render(<FieldLabel name="name" />)
    assert.equal($('[data-testid="label"]')?.textContent, 'name')
  })

  it('converts camelCase to spaced words', (t) => {
    let { $ } = t.render(<FieldLabel name="firstName" />)
    assert.equal($('[data-testid="label"]')?.textContent, 'first name')
  })

  it('handles multiple humps', (t) => {
    let { $ } = t.render(<FieldLabel name="dateOfBirth" />)
    assert.equal($('[data-testid="label"]')?.textContent, 'date of birth')
  })
})

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

describe('render/cleanup', () => {
  it('cleanup removes the container from the DOM', (t) => {
    let { container, cleanup } = t.render(<div data-testid="manual">hello</div>)
    assert.equal(document.body.contains(container), true)
    cleanup()
    assert.equal(document.body.contains(container), false)
  })
})

describe.skip('skip: Skipped Test Suite', () => {
  it('would fail', () => {
    assert.equal(true, false)
  })
})

describe.todo('todo: Test Suite')

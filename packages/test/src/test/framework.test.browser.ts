import decamelize from 'decamelize'
import cx from 'clsx'
import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

describe('Counter', () => {
  function createCounter(options: { count?: number } = {}) {
    let count = options.count ?? 0
    let container = document.createElement('div')
    let heading = document.createElement('h3')
    let controls = document.createElement('div')
    let decrement = document.createElement('button')
    let output = document.createElement('span')
    let increment = document.createElement('button')

    function update() {
      output.textContent = String(count)
    }

    heading.textContent = 'Counter'
    decrement.dataset.action = 'decrement'
    decrement.textContent = '-'
    decrement.addEventListener('click', () => {
      count--
      update()
    })
    output.dataset.testid = 'count'
    output.style.fontSize = '24px'
    output.style.minWidth = '2ch'
    output.style.textAlign = 'center'
    increment.dataset.action = 'increment'
    increment.textContent = '+'
    increment.addEventListener('click', () => {
      count++
      update()
    })
    update()

    controls.append(decrement, output, increment)
    container.append(heading, controls)
    document.body.append(container)

    return createFixture(container)
  }

  it('renders with initial count of 0 when not specified', (t) => {
    let { $, cleanup } = createCounter()
    t.after(cleanup)
    assert.equal(Number($('[data-testid="count"]')!.textContent), 0)
  })

  it('renders with a provided initial count', (t) => {
    let { $, cleanup } = createCounter({ count: 5 })
    t.after(cleanup)
    assert.equal(Number($('[data-testid="count"]')!.textContent), 5)
  })

  it('increments the count', async (t) => {
    let { $, act, cleanup } = createCounter()
    t.after(cleanup)
    await act(() => button($, '[data-action="increment"]')?.click())
    assert.equal(Number($('[data-testid="count"]')!.textContent), 1)
    await act(() => button($, '[data-action="increment"]')?.click())
    assert.equal(Number($('[data-testid="count"]')!.textContent), 2)
    await act(() => button($, '[data-action="increment"]')?.click())
    assert.equal(Number($('[data-testid="count"]')!.textContent), 3)
  })

  it('decrements the count', async (t) => {
    let { $, act, cleanup } = createCounter({ count: 3 })
    t.after(cleanup)
    await act(() => button($, '[data-action="decrement"]')?.click())
    assert.equal(Number($('[data-testid="count"]')!.textContent), 2)
    await act(() => button($, '[data-action="decrement"]')?.click())
    assert.equal(Number($('[data-testid="count"]')!.textContent), 1)
    await act(() => button($, '[data-action="decrement"]')?.click())
    assert.equal(Number($('[data-testid="count"]')!.textContent), 0)
  })
})

describe('FieldLabel (using decamelize)', () => {
  // Demonstrates that ESM third-party libraries are importable from test modules
  function createFieldLabel(name: string) {
    let span = document.createElement('span')
    span.dataset.testid = 'label'
    span.textContent = decamelize(name, { separator: ' ' })
    document.body.append(span)

    return createFixture(span)
  }

  it('renders a single word unchanged', (t) => {
    let { $, cleanup } = createFieldLabel('name')
    t.after(cleanup)
    assert.equal($('[data-testid="label"]')?.textContent, 'name')
  })

  it('converts camelCase to spaced words', (t) => {
    let { $, cleanup } = createFieldLabel('firstName')
    t.after(cleanup)
    assert.equal($('[data-testid="label"]')?.textContent, 'first name')
  })

  it('handles multiple humps', (t) => {
    let { $, cleanup } = createFieldLabel('dateOfBirth')
    t.after(cleanup)
    assert.equal($('[data-testid="label"]')?.textContent, 'date of birth')
  })
})

describe('MobileMenu (using clsx)', () => {
  function createMobileMenu(isOpen: boolean) {
    let nav = document.createElement('nav')
    let docs = document.createElement('a')
    let blog = document.createElement('a')

    nav.ariaLabel = 'Mobile navigation'
    nav.className = cx('mobile-menu', {
      'mobile-menu--open': isOpen,
      'mobile-menu--closed': !isOpen,
    })
    docs.href = '/docs'
    docs.textContent = 'Docs'
    blog.href = '/blog'
    blog.textContent = 'Blog'
    nav.append(docs, blog)
    document.body.append(nav)

    return createFixture(nav)
  }

  it('resolves browser-oriented package exports for default imports', (t) => {
    let { $, cleanup } = createMobileMenu(true)
    t.after(cleanup)

    assert.equal($('[aria-label="Mobile navigation"]')?.className, 'mobile-menu mobile-menu--open')
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
  it('cleanup removes the container from the DOM', () => {
    let container = document.createElement('div')
    container.dataset.testid = 'manual'
    container.textContent = 'hello'
    document.body.append(container)
    let { cleanup } = createFixture(container)

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

function createFixture(container: Element): {
  $: (selector: string) => Element | null
  act(fn: () => void): Promise<void>
  cleanup(): void
} {
  return {
    $(selector) {
      return container.matches(selector) ? container : container.querySelector(selector)
    },
    async act(fn) {
      fn()
      await Promise.resolve()
    },
    cleanup() {
      container.remove()
    },
  }
}

function button(
  query: (selector: string) => Element | null,
  selector: string,
): HTMLButtonElement | null {
  let element = query(selector)
  return element instanceof HTMLButtonElement ? element : null
}

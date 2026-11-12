import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import type { Handle } from '../runtime/component.ts'
import { createRoot } from '../runtime/vdom.ts'
import { createMixin, on } from '../index.ts'

// Synthetic per-character `type` against an <input>. Mirrors what a real
// browser fires: keydown -> beforeinput -> input -> keyup, mutating the value
// at the cursor between beforeinput and input. When the cursor is still at the
// default 0/0 with a non-empty value we move it to the end first, so typing
// into a pre-filled controlled input appends rather than prepends.
async function type(field: HTMLInputElement, text: string): Promise<void> {
  field.focus()
  if (field.selectionStart === 0 && field.selectionEnd === 0 && field.value.length > 0) {
    field.setSelectionRange(field.value.length, field.value.length)
  }
  for (let char of text) {
    field.dispatchEvent(
      new KeyboardEvent('keydown', { key: char, bubbles: true, cancelable: true }),
    )
    let beforeInput = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: char,
    })
    if (field.dispatchEvent(beforeInput)) {
      let start = field.selectionStart ?? field.value.length
      let end = field.selectionEnd ?? field.value.length
      field.value = field.value.slice(0, start) + char + field.value.slice(end)
      field.setSelectionRange(start + 1, start + 1)
      field.dispatchEvent(
        new InputEvent('input', { bubbles: true, inputType: 'insertText', data: char }),
      )
    }
    field.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }))
  }
  await controlledRestore()
}

// Controlled restores run in a microtask queued while the event dispatches, so a microtask queued
// after the dispatch runs once they have finished.
function controlledRestore(): Promise<void> {
  return new Promise((resolve) => queueMicrotask(resolve))
}

describe('vdom controlled props', () => {
  it('restores controlled array values after an option component updates itself', (t) => {
    let container = document.createElement('div')
    let root = createRoot(container)
    t.after(() => root.dispose())
    let showB = false
    let firstValue = 'a'
    let update = () => {}
    function Choices(handle: Handle) {
      update = () => {
        void handle.update()
      }
      return () => (
        <optgroup label="Choices">
          <option value={firstValue}>First</option>
          {showB && <option value="b">B</option>}
        </optgroup>
      )
    }
    root.render(
      <select multiple value={['b']}>
        <Choices />
      </select>,
    )
    root.flush()
    let select = container.querySelector('select')
    if (!select) throw new Error('Missing select')
    showB = true
    update()
    root.flush()
    expect([...select.selectedOptions].map((option) => option.value)).toEqual(['b'])
    firstValue = 'b'
    update()
    root.flush()
    expect(select.selectedOptions.length).toBe(2)
    firstValue = 'c'
    showB = false
    update()
    root.flush()
    expect(select.selectedOptions.length).toBe(0)
  })

  it('restores controlled scalar values after an option mixin updates itself', (t) => {
    let container = document.createElement('div')
    let root = createRoot(container)
    t.after(() => root.dispose())
    let value = 'b'
    let update = () => {}
    let optionValue = createMixin((handle) => {
      update = () => {
        void handle.update()
      }
      return (props) => <handle.element {...props} value={value} />
    })
    root.render(
      <select value="b">
        <option value="a">A</option>
        <optgroup label="Choices">
          <option mix={optionValue()}>B</option>
        </optgroup>
      </select>,
    )
    root.flush()
    let select = container.querySelector('select')
    if (!select) throw new Error('Missing select')
    expect(select.value).toBe('b')
    value = 'c'
    update()
    root.flush()
    expect(select.selectedIndex).toBe(-1)
    value = 'b'
    update()
    root.flush()
    expect(select.value).toBe('b')
  })

  it('restores controlled selection when a separate option root renders or disposes', (t) => {
    let container = document.createElement('div')
    let root = createRoot(container)
    t.after(() => root.dispose())
    root.render(
      <select value="b">
        <option value="a">A</option>
        <optgroup label="Choices" />
      </select>,
    )
    let select = container.querySelector('select')
    let group = container.querySelector('optgroup')
    if (!select || !group) throw new Error('Missing select')
    let options = createRoot(group)
    t.after(() => options.dispose())
    options.render(<option value="b">B</option>)
    expect(select.value).toBe('b')
    options.render(<option value="c">C</option>)
    expect(select.selectedIndex).toBe(-1)
    options.render(<option value="b">B</option>)
    expect(select.value).toBe('b')
    options.dispose()
    expect(select.selectedIndex).toBe(-1)
  })

  it('preserves native scalar assignment and value removal on multiple selects', async (t) => {
    let container = document.createElement('div')
    let root = createRoot(container)
    t.after(() => root.dispose())
    function markup(value?: string | ReadonlyArray<string>) {
      return (
        <select multiple value={value}>
          <option value="">Empty</option>
          <option value="a">First A</option>
          <option value="a">Second A</option>
          <option value="b">B</option>
        </select>
      )
    }
    root.render(markup('b'))
    root.flush()
    let select = container.querySelector('select')
    if (!select) throw new Error('Missing select')
    root.render(markup('a'))
    root.flush()
    expect([...select.selectedOptions].map((option) => option.index)).toEqual([1])
    select.value = 'b'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    await Promise.resolve()
    await Promise.resolve()
    expect([...select.selectedOptions].map((option) => option.index)).toEqual([1])
    root.render(markup(['a', 'b']))
    root.flush()
    expect([...select.selectedOptions].map((option) => option.value)).toEqual(['a', 'a', 'b'])
    root.render(markup())
    root.flush()
    expect([...select.selectedOptions].map((option) => option.value)).toEqual([''])
  })

  it('keeps initial array defaults through option and default changes while supporting controlled values', async (t) => {
    let container = document.createElement('div')
    let root = createRoot(container)
    t.after(() => root.dispose())
    let defaults = ['a', 'b']
    let showB = false
    function markup(value?: ReadonlyArray<string>) {
      return (
        <form>
          <select multiple defaultValue={defaults} value={value}>
            <option key="a" value="a">
              A
            </option>
            <option key="c" value="c">
              C
            </option>
            {showB && (
              <option key="b" value="b">
                B
              </option>
            )}
          </select>
        </form>
      )
    }
    root.render(markup())
    root.flush()
    let select = container.querySelector('select')
    let form = container.querySelector('form')
    if (!select || !form) throw new Error('Missing form controls')
    function selected(node: HTMLSelectElement) {
      return [...node.selectedOptions].map((option) => option.value)
    }
    expect(selected(select)).toEqual(['a'])
    select.options[0].selected = false
    select.options[1].selected = true
    showB = true
    root.render(markup())
    root.flush()
    expect(selected(select)).toEqual(['c'])
    form.reset()
    expect(selected(select)).toEqual(['a'])
    select.options[2].selected = true
    defaults = ['c']
    root.render(markup())
    root.flush()
    expect(selected(select)).toEqual(['a', 'b'])
    form.reset()
    expect(selected(select)).toEqual(['a'])
    root.render(markup(['a', 'c']))
    root.flush()
    expect(selected(select)).toEqual(['a', 'c'])
    select.options[2].selected = true
    select.dispatchEvent(new Event('change', { bubbles: true }))
    await Promise.resolve()
    expect(selected(select)).toEqual(['a', 'c'])
    root.render(markup([]))
    root.flush()
    expect(selected(select)).toEqual([])
  })

  it('ignores changes and removal of a select defaultValue after initialization', (t) => {
    let container = document.createElement('div')
    let root = createRoot(container)
    t.after(() => root.dispose())
    function markup(defaultValue?: string) {
      return (
        <form>
          <select defaultValue={defaultValue}>
            <option value="a">A</option>
            <option value="b">B</option>
            <option value="b">Another B</option>
          </select>
        </form>
      )
    }
    root.render(markup('b'))
    root.flush()
    let select = container.querySelector('select')
    let form = container.querySelector('form')
    if (!select || !form) throw new Error('Missing form controls')
    expect(select.value).toBe('b')
    expect(select.selectedIndex).toBe(1)
    expect(select.hasAttribute('defaultvalue')).toBe(false)
    select.value = 'a'
    root.render(markup('a'))
    root.flush()
    expect(select.value).toBe('a')
    form.reset()
    expect(select.value).toBe('b')
    root.render(markup())
    root.flush()
    expect(select.value).toBe('b')
    select.value = 'a'
    form.reset()
    expect(select.value).toBe('b')
  })

  it('reapplies select defaults when multiple is toggled', (t) => {
    let container = document.createElement('div')
    let root = createRoot(container)
    t.after(() => root.dispose())
    function markup(multiple: boolean, defaultValue?: string | string[]) {
      return (
        <select multiple={multiple} defaultValue={defaultValue}>
          <option value="a" disabled>
            A
          </option>
          <option value="b">B</option>
          <option value="c">C</option>
        </select>
      )
    }
    root.render(markup(false, 'b'))
    root.flush()
    let select = container.querySelector('select')
    if (!select) throw new Error('Missing select')
    select.value = 'c'
    root.render(markup(true, ['b', 'c']))
    root.flush()
    expect([...select.selectedOptions].map((option) => option.value)).toEqual(['b', 'c'])
    root.render(markup(false, 'b'))
    root.flush()
    expect(select.value).toBe('b')
    root.render(markup(true))
    root.flush()
    expect(select.selectedOptions.length).toBe(0)
    root.render(markup(false))
    root.flush()
    expect(select.value).toBe('b')
  })

  it('continues updating input and textarea reset defaults after edits', (t) => {
    let container = document.createElement('div')
    let root = createRoot(container)
    t.after(() => root.dispose())
    function markup(defaultValue: string) {
      return (
        <form>
          <input defaultValue={defaultValue} />
          <textarea defaultValue={defaultValue} />
        </form>
      )
    }
    root.render(markup('initial'))
    root.flush()
    let form = container.querySelector('form')
    let input = container.querySelector('input')
    let textarea = container.querySelector('textarea')
    if (!form || !input || !textarea) throw new Error('Missing form controls')
    input.value = 'edited'
    textarea.value = 'edited'
    root.render(markup('updated'))
    root.flush()
    expect(input.value).toBe('edited')
    expect(textarea.value).toBe('edited')
    expect(input.defaultValue).toBe('updated')
    expect(textarea.defaultValue).toBe('updated')
    form.reset()
    expect(input.value).toBe('updated')
    expect(textarea.value).toBe('updated')
  })

  it('restores controlled value on native input when no update happens', async () => {
    let container = document.createElement('div')
    let root = createRoot(container)
    root.render(<input value="hello" />)
    root.flush()

    let input = container.querySelector('input') as HTMLInputElement
    input.value = 'hello123'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await controlledRestore()
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
    await controlledRestore()
    expect(input.checked).toBe(true)
  })

  it('allows controlled value changes when an input event calls handle.update()', () => {
    function App(handle: Handle) {
      let value = 'hello'
      let renderCount = 0

      function rerender() {
        renderCount++
        handle.update()
      }

      return () => (
        <>
          <input
            value={value}
            mix={[
              on('input', (event) => {
                let nextValue = event.currentTarget.value
                if (/\d/.test(nextValue)) return
                value = nextValue
                rerender()
              }),
            ]}
          />
          <output>{`${renderCount}:${value}`}</output>
        </>
      )
    }

    let container = document.createElement('div')
    let root = createRoot(container)
    root.render(<App />)
    root.flush()

    let input = container.querySelector('input') as HTMLInputElement
    let output = container.querySelector('output') as HTMLOutputElement

    input.value = 'helloa'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    root.flush()

    expect(input.value).toBe('helloa')
    expect(output.textContent).toBe('1:helloa')
  })

  it('preserves controlled updates from real typing while rejecting invalid input', async () => {
    function App(handle: Handle) {
      let value = 'hello'
      let renderCount = 0

      function rerender() {
        renderCount++
        handle.update()
      }

      return () => (
        <>
          <label htmlFor="tracked">Tracked</label>
          <input
            id="tracked"
            value={value}
            mix={[
              on('input', (event) => {
                let nextValue = event.currentTarget.value
                if (/\d/.test(nextValue)) return
                value = nextValue
                rerender()
              }),
            ]}
          />
          <output>{`${renderCount}:${value}`}</output>
        </>
      )
    }

    let container = document.createElement('div')
    document.body.appendChild(container)
    let root = createRoot(container)
    root.render(<App />)
    root.flush()

    let input = container.querySelector('input') as HTMLInputElement
    let output = container.querySelector('output') as HTMLOutputElement

    await type(input, 'a')
    root.flush()
    expect(input.value).toBe('helloa')
    expect(output.textContent).toBe('1:helloa')

    await type(input, '1')
    await controlledRestore()
    expect(input.value).toBe('helloa')
    expect(output.textContent).toBe('1:helloa')

    await type(input, 'b')
    root.flush()
    expect(input.value).toBe('helloab')
    expect(output.textContent).toBe('2:helloab')

    container.remove()
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
    await controlledRestore()
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

    await controlledRestore()
    expect(text.value).toBe('user typed')
    expect(check.checked).toBe(true)
  })

  it('restores controlled value on native change for select when no update happens', async () => {
    let container = document.createElement('div')
    let root = createRoot(container)
    root.render(
      <select value="b">
        <option value="a">A</option>
        <option value="b">B</option>
      </select>,
    )
    root.flush()

    let select = container.querySelector('select') as HTMLSelectElement
    select.value = 'a'
    select.dispatchEvent(new Event('change', { bubbles: true }))

    await controlledRestore()
    expect(select.value).toBe('b')
  })

  it('applies next select value from change handlers after prior input event', async () => {
    function App(handle: Handle) {
      let value = 'alpha'
      return () => (
        <>
          <select
            value={value}
            mix={[
              on('change', (event) => {
                value = event.currentTarget.value
                handle.update()
              }),
            ]}
          >
            <option value="alpha">Alpha</option>
            <option value="beta">Beta</option>
            <option value="gamma">Gamma</option>
          </select>
          <output>{value}</output>
        </>
      )
    }

    let container = document.createElement('div')
    let root = createRoot(container)
    root.render(<App />)
    root.flush()

    let select = container.querySelector('select') as HTMLSelectElement
    let output = container.querySelector('output') as HTMLOutputElement

    select.value = 'beta'
    select.dispatchEvent(new Event('input', { bubbles: true }))
    await controlledRestore()
    select.dispatchEvent(new Event('change', { bubbles: true }))
    root.flush()

    expect(select.value).toBe('beta')
    expect(output.textContent).toBe('beta')
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
    await controlledRestore()
    expect(input.value).toBe('post-dispose')
  })
})

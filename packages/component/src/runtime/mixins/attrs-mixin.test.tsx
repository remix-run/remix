import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { createRoot } from '../vdom.ts'
import { invariant } from '../invariant.ts'
import { attrs } from './attrs-mixin.ts'

describe('attrs mixin', () => {
  it('applies default props when the element does not provide them', () => {
    let container = document.createElement('div')
    let root = createRoot(container)

    root.render(<button mix={attrs({ type: 'button', title: 'Save changes' })}>Save</button>)
    root.flush()

    let button = container.querySelector('button')
    invariant(button)
    expect(button.getAttribute('type')).toBe('button')
    expect(button.getAttribute('title')).toBe('Save changes')
  })

  it('preserves explicit props from the element', () => {
    let container = document.createElement('div')
    let root = createRoot(container)

    root.render(
      <button type="submit" title="Publish" mix={attrs({ type: 'button', title: 'Save changes' })}>
        Save
      </button>,
    )
    root.flush()

    let button = container.querySelector('button')
    invariant(button)
    expect(button.getAttribute('type')).toBe('submit')
    expect(button.getAttribute('title')).toBe('Publish')
  })

  it('applies className and style defaults without merging them', () => {
    let container = document.createElement('div')
    let root = createRoot(container)

    root.render(
      <div
        mix={attrs({
          className: 'default-class',
          style: { color: 'red' },
        })}
      />,
    )
    root.flush()

    let div = container.querySelector('div')
    invariant(div)
    expect(div.className).toBe('default-class')
    expect(div.style.color).toBe('red')
  })

  it('does not merge className and style when explicit props are present', () => {
    let container = document.createElement('div')
    let root = createRoot(container)

    root.render(
      <div
        className="explicit-class"
        style={{ backgroundColor: 'blue' }}
        mix={attrs({
          className: 'default-class',
          style: { color: 'red' },
        })}
      />,
    )
    root.flush()

    let div = container.querySelector('div')
    invariant(div)
    expect(div.className).toBe('explicit-class')
    expect(div.style.backgroundColor).toBe('blue')
    expect(div.style.color).toBe('')
  })
})

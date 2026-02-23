import { describe, expect, it } from 'vitest'
import { createDomReconciler } from '../dom-reconciler.ts'
import { basicPropsPlugin } from './basic-props-plugin.ts'

describe('basic props plugin', () => {
  it('applies and removes html/aria/data/property/attribute props', () => {
    let reconciler = createDomReconciler(document, [basicPropsPlugin as any])
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(
      <label
        htmlFor="field"
        className="base"
        data-id="123"
        aria-label="label"
        title="hello"
        draggable={true}
      >
        text
      </label>,
    )
    root.flush()

    let label = container.firstElementChild as HTMLLabelElement
    expect(label.getAttribute('for')).toBe('field')
    expect(label.className).toBe('base')
    expect(label.getAttribute('data-id')).toBe('123')
    expect(label.getAttribute('aria-label')).toBe('label')
    expect(label.title).toBe('hello')
    expect(label.draggable).toBe(true)

    root.render(
      <label
        className="next"
        innerHTML="<span>ok</span>"
        title={null as any}
        draggable={false}
        data-id={false as any}
        custom-attr={true}
      />,
    )
    root.flush()

    let updated = container.firstElementChild as HTMLLabelElement
    expect(updated.className).toBe('next')
    expect(updated.innerHTML).toBe('<span>ok</span>')
    expect(updated.title).toBe('')
    expect(updated.draggable).toBe(false)
    expect(updated.getAttribute('data-id')).toBeNull()
    expect(updated.getAttribute('custom-attr')).toBe('')
    expect(updated.getAttribute('for')).toBeNull()
    expect(updated.getAttribute('aria-label')).toBeNull()
  })
})

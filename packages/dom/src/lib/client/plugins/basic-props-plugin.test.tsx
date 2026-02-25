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

  it('normalizes class/className/innerHTML nulls and removal paths', () => {
    let reconciler = createDomReconciler(document, [basicPropsPlugin as any])
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(<label class={null as any} innerHTML={null as any}>ignored</label>)
    root.flush()
    let first = container.firstElementChild as HTMLLabelElement
    expect(first.className).toBe('')
    expect(first.innerHTML).toBe('')

    root.render(<label className="next" innerHTML="<span>x</span>" />)
    root.flush()
    let second = container.firstElementChild as HTMLLabelElement
    expect(second.className).toBe('')
    expect(second.innerHTML).toBe('<span>x</span>')

    root.render(<label className="from-classname" class="from-class" />)
    root.flush()
    let third = container.firstElementChild as HTMLLabelElement
    expect(third.className).toBe('from-class')

    root.render(<label />)
    root.flush()
    let fourth = container.firstElementChild as HTMLLabelElement
    expect(fourth.className).toBe('')
    expect(fourth.innerHTML).toBe('')
  })

  it('applies null className values as empty strings', () => {
    let reconciler = createDomReconciler(document, [basicPropsPlugin as any])
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render(<label className={null as any} />)
    root.flush()
    expect((container.firstElementChild as HTMLLabelElement).className).toBe('')
  })
})

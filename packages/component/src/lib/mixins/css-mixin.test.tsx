import { describe, expect, it } from 'vitest'
import { createRoot } from '../vdom.ts'
import { invariant } from '../invariant.ts'
import { css } from './css-mixin.tsx'

describe('css mixin', () => {
  it('concatenates generated classes with existing className', () => {
    let container = document.createElement('div')
    let root = createRoot(container)
    root.render(
      <div
        className="base"
        mix={[
          css({ color: 'red' }),
          css({
            backgroundColor: 'blue',
          }),
        ]}
      />,
    )
    root.flush()

    let div = container.querySelector('div')
    invariant(div)
    let classNames = div.className.split(/\s+/).filter(Boolean)
    let generated = classNames.filter((name) => name.startsWith('rmxc-'))
    expect(classNames).toContain('base')
    expect(generated.length).toBe(2)
    expect(new Set(generated).size).toBe(2)
  })

  it('coexists with existing class/className props', () => {
    let container = document.createElement('div')
    let root = createRoot(container)
    root.render(
      <div
        class="from-class"
        className="from-classname"
        mix={[
          css({
            borderColor: 'black',
            borderStyle: 'solid',
            borderWidth: 1,
          }),
        ]}
      />,
    )
    root.flush()

    let div = container.querySelector('div')
    invariant(div)
    let classNames = div.className.split(/\s+/).filter(Boolean)
    expect(classNames).toContain('from-class')
    expect(classNames).toContain('from-classname')
    expect(classNames.some((name) => name.startsWith('rmxc-'))).toBe(true)
  })
})

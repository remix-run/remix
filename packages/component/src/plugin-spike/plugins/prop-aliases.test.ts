import { describe, expect, it } from 'vitest'

import { createReconciler } from '../index.ts'
import { attributeProps } from './attribute-props.ts'
import { propAliases } from './prop-aliases.ts'

describe('plugin-spike prop-aliases plugin', () => {
  it('applies alias props before attribute fallback', () => {
    let reconciler = createReconciler([propAliases, attributeProps])
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render((handle) =>
      handle.host({
        type: 'label',
        key: 'a',
        props: {
          className: 'field-label',
          htmlFor: 'field-input',
        },
        children: ['name'],
      }),
    )
    root.flush()

    let node = container.querySelector('label')
    if (!node) throw new Error('expected label')
    expect(node.getAttribute('class')).toBe('field-label')
    expect(node.getAttribute('for')).toBe('field-input')
    expect(node.getAttribute('className')).toBeNull()
    expect(node.getAttribute('htmlFor')).toBeNull()
  })
})

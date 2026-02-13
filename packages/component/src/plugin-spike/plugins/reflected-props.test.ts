import { describe, expect, it } from 'vitest'

import { createReconciler } from '../index.ts'
import { attributeProps } from './attribute-props.ts'
import { reflectedPropsPlugin } from './reflected-props.ts'

describe('plugin-spike reflected-props plugin', () => {
  it('writes reflected dom props', () => {
    let reconciler = createReconciler([reflectedPropsPlugin, attributeProps])
    let container = document.createElement('div')
    let root = reconciler.createRoot(container)

    root.render((handle) =>
      handle.host({
        type: 'input',
        key: 'a',
        props: {
          type: 'checkbox',
          checked: true,
          value: 'on',
        },
        children: [],
      }),
    )
    root.flush()

    let node = container.querySelector('input')
    if (!(node instanceof HTMLInputElement)) throw new Error('expected input')
    expect(node.checked).toBe(true)
    expect(node.value).toBe('on')

    root.render((handle) =>
      handle.host({
        type: 'input',
        key: 'a',
        props: {
          type: 'checkbox',
          checked: false,
        },
        children: [],
      }),
    )
    root.flush()
    expect(node.checked).toBe(false)
    expect(node.value).toBe('')
  })
})

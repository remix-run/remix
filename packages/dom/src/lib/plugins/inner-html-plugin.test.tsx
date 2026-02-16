import { createReconciler } from '@remix-run/reconciler'
import { describe, expect, it } from 'vitest'

import { createDomNodePolicy } from '../dom-node-policy.ts'
import { innerHTMLPlugin } from './inner-html-plugin.ts'

describe('innerHTMLPlugin', () => {
  it('no-ops when innerHTML is never provided', () => {
    let container = document.createElement('div')
    let root = createDomRoot(container)

    root.render(<div />)
    root.flush()

    expect(container.innerHTML).toBe('<div></div>')
  })

  it('sets and clears innerHTML values', () => {
    let container = document.createElement('div')
    let root = createDomRoot(container)

    root.render(<div innerHTML="<span>hello</span>" />)
    root.flush()
    expect(container.innerHTML).toBe('<div><span>hello</span></div>')

    root.render(<div innerHTML={undefined} />)
    root.flush()
    expect(container.innerHTML).toBe('<div></div>')
  })

  it('does not rewrite unchanged HTML', () => {
    let container = document.createElement('div')
    let root = createDomRoot(container)

    root.render(<div innerHTML="<span>same</span>" />)
    root.flush()
    root.render(<div innerHTML="<span>same</span>" />)
    root.flush()

    expect(container.innerHTML).toBe('<div><span>same</span></div>')
  })
})

function createDomRoot(container: HTMLElement) {
  let reconciler = createReconciler(createDomNodePolicy(document), [innerHTMLPlugin])
  return reconciler.createRoot(container)
}

import { describe, expect, it } from 'vitest'
import { createDomReconciler } from '../dom-reconciler.ts'
import { basicPropsPlugin } from './basic-props-plugin.ts'
import { createDocumentStatePlugin, getDocumentState } from './document-state-plugin.ts'

describe('document state plugin', () => {
  it('tracks commit state and restores focus by fallback id', () => {
    let documentStatePlugin = createDocumentStatePlugin(document)
    let reconciler = createDomReconciler(document, [documentStatePlugin as any, basicPropsPlugin as any])
    let container = document.createElement('div')
    document.body.appendChild(container)
    let root = reconciler.createRoot(container)

    try {
      root.render(<input id="focus-target" key="one" value="abc" />)
      root.flush()
      let first = container.firstElementChild as HTMLInputElement
      first.focus()
      first.setSelectionRange(1, 2, 'forward')

      root.render(<textarea id="focus-target" key="two">next</textarea>)
      root.flush()

      root.render(<div __rmx_document_state_internal__={true} />)
      root.flush()

      let after = container.firstElementChild as HTMLElement
      expect(after.localName).toBe('div')
      expect(getDocumentState(root as any)).toBeUndefined()
    } finally {
      container.remove()
    }
  })
})

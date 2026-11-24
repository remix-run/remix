import { expect, throws } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { moveNodeBefore } from '../runtime/reconcile.ts'
import { invariant } from '../runtime/invariant.ts'

function forbidNativeMoves(parent: ParentNode): void {
  Object.defineProperty(parent, 'moveBefore', {
    value() {
      throw new Error('Ineligible move reached moveBefore()')
    },
  })
}

describe('DOM move eligibility', () => {
  it('inserts disconnected new nodes and fragments into a connected parent', (t) => {
    let parent = document.createElement('div')
    document.body.append(parent)
    t.after(() => parent.remove())
    forbidNativeMoves(parent)
    let ref = document.createElement('span')
    let fragment = document.createDocumentFragment()
    fragment.append('first', document.createElement('input'))

    moveNodeBefore(parent, ref, null)
    moveNodeBefore(parent, fragment, ref)

    expect(parent.innerHTML).toBe('first<input><span></span>')
  })

  it('moves connected nodes into detached parents with insertBefore', (t) => {
    let source = document.createElement('div')
    source.innerHTML = '<input>'
    document.body.append(source)
    t.after(() => source.remove())
    let parent = document.createElement('div')
    forbidNativeMoves(parent)
    let input = source.firstChild
    invariant(input)

    moveNodeBefore(parent, input, null)

    expect(parent.firstChild).toBe(input)
    expect(source.childNodes.length).toBe(0)
  })

  it('moves between detached roots in the same document with insertBefore', () => {
    let source = document.createElement('div')
    source.innerHTML = '<input>'
    let input = source.firstChild
    invariant(input)
    let parent = document.createElement('div')
    forbidNativeMoves(parent)

    moveNodeBefore(parent, input, null)

    expect(parent.firstChild).toBe(input)
  })

  it('adopts nodes from a different document with insertBefore', () => {
    let source = document.implementation.createHTMLDocument('source')
    let target = document.implementation.createHTMLDocument('target')
    let input = source.createElement('input')
    source.body.append(input)
    forbidNativeMoves(target.body)

    moveNodeBefore(target.body, input, null)

    expect(target.body.firstChild).toBe(input)
    expect(input.ownerDocument).toBe(target)
  })

  it('retains insertBefore for document elements and doctypes', () => {
    let doc = document.implementation.createHTMLDocument('test')
    let element = doc.documentElement
    let doctype = doc.doctype
    invariant(doctype)
    forbidNativeMoves(doc)

    throws(() => moveNodeBefore(doc, element, null), { name: 'HierarchyRequestError' })
    throws(() => moveNodeBefore(doc, doctype, element), { name: 'HierarchyRequestError' })

    expect(doc.firstChild).toBe(doctype)
    expect(doc.lastChild).toBe(element)
  })

  it(
    'moves elements and character data within detached fragments and connected shadow roots',
    { skip: typeof DocumentFragment.prototype.moveBefore !== 'function' },
    (t) => {
      let fragment = document.createDocumentFragment()
      let host = document.createElement('div')
      document.body.append(host)
      t.after(() => host.remove())
      let shadow = host.attachShadow({ mode: 'open' })

      for (let parent of [fragment, shadow]) {
        let text = document.createTextNode('text')
        let comment = document.createComment('comment')
        let element = document.createElement('span')
        parent.append(text, comment, element)

        moveNodeBefore(parent, element, text)
        moveNodeBefore(parent, comment, text)
        moveNodeBefore(parent, text, element)

        expect(Array.from(parent.childNodes)).toEqual([text, element, comment])
      }
    },
  )
})

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { closePagefindSearch, startPagefindSearch } from './public/pagefind-search.ts'

describe('Pagefind search behavior', () => {
  it('opens search from either trigger and restores focus when the modal closes', async (t) => {
    if (!customElements.get('pagefind-modal')) {
      customElements.define('pagefind-modal', class extends HTMLElement {})
    }

    let fullTrigger = document.createElement('button')
    fullTrigger.id = 'docs-search-button'
    fullTrigger.setAttribute('aria-expanded', 'false')
    let compactTrigger = document.createElement('button')
    compactTrigger.id = 'docs-search-compact'
    compactTrigger.setAttribute('aria-expanded', 'false')
    let modal = document.createElement('pagefind-modal')
    let dialog = document.createElement('dialog')
    dialog.id = 'pagefind-dialog'
    modal.append(dialog)
    document.body.append(fullTrigger, compactTrigger, modal)
    t.after(() => {
      fullTrigger.remove()
      compactTrigger.remove()
      modal.remove()
    })

    let closeModal = () => {
      dialog.removeAttribute('open')
      dialog.dispatchEvent(new Event('close'))
    }
    Reflect.set(modal, 'open', () => dialog.setAttribute('open', ''))
    Reflect.set(modal, 'close', closeModal)

    let stopSearch = startPagefindSearch()
    t.after(stopSearch)
    fullTrigger.click()
    await Promise.resolve()

    assert.equal(dialog.open, true)
    assert.equal(fullTrigger.getAttribute('aria-controls'), dialog.id)
    assert.equal(fullTrigger.getAttribute('aria-expanded'), 'true')
    closeModal()
    assert.equal(fullTrigger.getAttribute('aria-expanded'), 'false')
    assert.equal(document.activeElement, fullTrigger)

    compactTrigger.click()
    await Promise.resolve()

    assert.equal(dialog.open, true)
    assert.equal(compactTrigger.getAttribute('aria-expanded'), 'true')
    assert.equal(fullTrigger.getAttribute('aria-expanded'), 'false')
    closePagefindSearch()
    assert.equal(dialog.open, false)
    assert.equal(compactTrigger.getAttribute('aria-expanded'), 'false')
    assert.notEqual(document.activeElement, compactTrigger)
  })
})

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { createRoot } from 'remix/ui'

import { DocsShellBehavior, startDocsShellBehavior } from './docs-shell.browser.tsx'

describe('startDocsShellBehavior', () => {
  it('synchronizes the collapsed rail and search accessibility state', (t) => {
    let fixture = createShellFixture()
    t.after(fixture.cleanup)

    fixture.navToggle.click()

    assert.equal(document.documentElement.hasAttribute('data-docs-nav-collapsed'), true)
    assert.equal(fixture.chapterNavigation.hasAttribute('inert'), true)
    assert.equal(fixture.chapterNavigation.getAttribute('aria-hidden'), 'true')
    assert.equal(fixture.navToggle.getAttribute('aria-expanded'), 'false')
    assert.equal(fixture.navToggle.getAttribute('aria-label'), 'Expand chapter navigation')
    assert.equal(fixture.compactSearch.hasAttribute('aria-hidden'), false)
    assert.equal(fixture.expandedSearch.getAttribute('aria-hidden'), 'true')

    fixture.navToggle.click()

    assert.equal(document.documentElement.hasAttribute('data-docs-nav-collapsed'), false)
    assert.equal(fixture.chapterNavigation.hasAttribute('inert'), false)
    assert.equal(fixture.chapterNavigation.hasAttribute('aria-hidden'), false)
    assert.equal(fixture.navToggle.getAttribute('aria-expanded'), 'true')
    assert.equal(fixture.navToggle.getAttribute('aria-label'), 'Collapse chapter navigation')
    assert.equal(fixture.compactSearch.getAttribute('aria-hidden'), 'true')
    assert.equal(fixture.expandedSearch.hasAttribute('aria-hidden'), false)
  })

  it('restarts when navigation re-renders the client entry', (t) => {
    let fixture = createShellFixture({ startBehavior: false })
    let rootContainer = document.createElement('div')
    let root = createRoot(rootContainer)
    t.after(() => {
      root.dispose()
      fixture.cleanup()
    })

    root.render(<DocsShellBehavior />)
    root.flush()

    root.render(<DocsShellBehavior />)
    root.flush()
    fixture.navToggle.click()
    assert.equal(document.documentElement.hasAttribute('data-docs-nav-collapsed'), true)
  })

  it('restores the server-rendered state during cleanup', () => {
    let fixture = createShellFixture()

    fixture.navToggle.click()
    fixture.cleanup()

    assert.equal(document.documentElement.hasAttribute('data-docs-nav-collapsed'), false)
    assert.equal(fixture.chapterNavigation.hasAttribute('inert'), false)
    assert.equal(fixture.chapterNavigation.hasAttribute('aria-hidden'), false)
    assert.equal(fixture.compactSearch.getAttribute('aria-hidden'), 'true')
    assert.equal(fixture.expandedSearch.hasAttribute('aria-hidden'), false)
  })
})

function createShellFixture(options: { startBehavior?: boolean } = {}) {
  let container = document.createElement('div')
  container.innerHTML = `
    <button id="docs-nav-toggle" aria-expanded="true"></button>
    <button id="docs-search-compact" aria-hidden="true" disabled></button>
    <button id="docs-search-button" disabled></button>
    <nav id="docs-chapters-navigation"><a href="/docs/start-here">Start Here</a></nav>
  `
  document.body.append(container)

  let controller = new AbortController()
  if (options.startBehavior !== false) {
    startDocsShellBehavior(controller.signal)
  }

  return {
    chapterNavigation: getElement('docs-chapters-navigation'),
    compactSearch: getElement('docs-search-compact'),
    expandedSearch: getElement('docs-search-button'),
    navToggle: getElement('docs-nav-toggle'),
    cleanup() {
      controller.abort()
      container.remove()
    },
  }
}

function getElement(id: string): HTMLElement {
  let element = document.getElementById(id)
  if (!element) throw new Error(`Missing test element #${id}`)
  return element
}

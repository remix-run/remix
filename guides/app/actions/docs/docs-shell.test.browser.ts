import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { startDocsShellBehavior } from './docs-shell.browser.tsx'

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

  it('closes the mobile menu through Escape and primary navigation', (t) => {
    let fixture = createShellFixture()
    t.after(fixture.cleanup)

    fixture.menuToggle.click()
    assert.equal(document.documentElement.hasAttribute('data-mobile-menu-open'), true)
    assert.equal(fixture.menuToggle.getAttribute('aria-expanded'), 'true')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    assert.equal(document.documentElement.hasAttribute('data-mobile-menu-open'), false)
    assert.equal(fixture.menuToggle.getAttribute('aria-expanded'), 'false')
    assert.equal(document.activeElement, fixture.menuToggle)

    fixture.menuToggle.click()
    fixture.primaryNavigationLink.click()
    assert.equal(document.documentElement.hasAttribute('data-mobile-menu-open'), false)
    assert.equal(fixture.menuToggle.getAttribute('aria-expanded'), 'false')
  })

  it('restores the server-rendered state during cleanup', () => {
    let fixture = createShellFixture()

    fixture.navToggle.click()
    fixture.menuToggle.click()
    fixture.cleanup()

    assert.equal(document.documentElement.hasAttribute('data-docs-nav-collapsed'), false)
    assert.equal(document.documentElement.hasAttribute('data-mobile-menu-open'), false)
    assert.equal(document.documentElement.hasAttribute('data-mobile-menu-ready'), false)
    assert.equal(fixture.chapterNavigation.hasAttribute('inert'), false)
    assert.equal(fixture.chapterNavigation.hasAttribute('aria-hidden'), false)
    assert.equal(fixture.compactSearch.getAttribute('aria-hidden'), 'true')
    assert.equal(fixture.expandedSearch.hasAttribute('aria-hidden'), false)
  })
})

function createShellFixture() {
  let container = document.createElement('div')
  container.innerHTML = `
    <button id="docs-nav-toggle" aria-expanded="true"></button>
    <button id="docs-search-compact" aria-hidden="true" disabled></button>
    <button id="docs-search-button" disabled></button>
    <button id="site-menu-toggle" aria-expanded="false"></button>
    <nav id="site-primary-navigation"><a id="primary-navigation-link" href="#target">Guides</a></nav>
    <nav id="docs-chapters-navigation"><a href="/docs/start-here">Start Here</a></nav>
  `
  document.body.append(container)

  let controller = new AbortController()
  startDocsShellBehavior(controller.signal)

  return {
    chapterNavigation: getElement('docs-chapters-navigation'),
    compactSearch: getElement('docs-search-compact'),
    expandedSearch: getElement('docs-search-button'),
    menuToggle: getElement('site-menu-toggle'),
    navToggle: getElement('docs-nav-toggle'),
    primaryNavigationLink: getElement('primary-navigation-link'),
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

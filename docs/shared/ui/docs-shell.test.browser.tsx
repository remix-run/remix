import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { startDocsShellBehavior } from './docs-shell.browser.tsx'

describe('startDocsShellBehavior', () => {
  it('synchronizes collapsed shell accessibility state', (t) => {
    let fixture = createShellFixture()
    t.after(fixture.cleanup)

    fixture.navigationToggle.click()
    let showCollapsedOnly = window.matchMedia('(width >= 900px)').matches

    assert.equal(document.documentElement.hasAttribute('data-docs-nav-collapsed'), true)
    assert.equal(fixture.navigation.hasAttribute('inert'), true)
    assert.equal(fixture.navigation.getAttribute('aria-hidden'), 'true')
    assert.equal(fixture.collapsedOnly.hasAttribute('inert'), !showCollapsedOnly)
    assert.equal(fixture.collapsedOnly.hasAttribute('aria-hidden'), !showCollapsedOnly)
    assert.equal(fixture.expandedOnly.hasAttribute('inert'), showCollapsedOnly)
    assert.equal(fixture.expandedOnly.hasAttribute('aria-hidden'), showCollapsedOnly)
    assert.equal(fixture.navigationToggle.getAttribute('aria-expanded'), 'false')
    assert.equal(fixture.navigationToggle.getAttribute('aria-label'), 'Expand chapter navigation')

    fixture.navigationToggle.click()

    assert.equal(document.documentElement.hasAttribute('data-docs-nav-collapsed'), false)
    assert.equal(fixture.navigation.hasAttribute('inert'), false)
    assert.equal(fixture.navigation.hasAttribute('aria-hidden'), false)
    assert.equal(fixture.collapsedOnly.hasAttribute('inert'), true)
    assert.equal(fixture.collapsedOnly.getAttribute('aria-hidden'), 'true')
    assert.equal(fixture.expandedOnly.hasAttribute('inert'), false)
    assert.equal(fixture.expandedOnly.hasAttribute('aria-hidden'), false)
    assert.equal(fixture.navigationToggle.getAttribute('aria-expanded'), 'true')
    assert.equal(fixture.navigationToggle.getAttribute('aria-label'), 'Collapse chapter navigation')
  })

  it('preserves collapsed state when the shell is reconnected', () => {
    let fixture = createShellFixture()

    fixture.navigationToggle.click()
    fixture.stopBehavior()
    fixture.startBehavior()

    assert.equal(document.documentElement.hasAttribute('data-docs-nav-collapsed'), true)
    assert.equal(fixture.navigation.hasAttribute('inert'), true)
    fixture.cleanup()
  })
})

function createShellFixture() {
  let container = document.createElement('div')
  container.innerHTML = `
    <button id="docs-navigation-toggle" aria-expanded="true"></button>
    <nav id="docs-navigation"><a href="/start-here/">Start Here</a></nav>
    <button data-docs-collapsed-only>Compact search</button>
    <button data-docs-expanded-only>Expanded search</button>
  `
  document.body.append(container)

  let controller: AbortController
  startBehavior()

  return {
    navigation: getElement('docs-navigation'),
    navigationToggle: getElement('docs-navigation-toggle'),
    collapsedOnly: getElement('[data-docs-collapsed-only]'),
    expandedOnly: getElement('[data-docs-expanded-only]'),
    startBehavior,
    stopBehavior() {
      controller.abort()
    },
    cleanup() {
      controller.abort()
      document.documentElement.removeAttribute('data-docs-nav-collapsed')
      container.remove()
    },
  }

  function startBehavior() {
    controller = new AbortController()
    startDocsShellBehavior(controller.signal, { navigationName: 'chapter navigation' })
  }
}

function getElement(selector: string): HTMLElement {
  let element =
    selector.startsWith('#') || selector.startsWith('[')
      ? document.querySelector(selector)
      : document.getElementById(selector)
  if (!(element instanceof HTMLElement)) throw new Error(`Missing test element ${selector}`)
  return element
}

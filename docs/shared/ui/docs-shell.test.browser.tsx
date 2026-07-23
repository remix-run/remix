import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { startDocsShellBehavior } from './docs-shell.browser.tsx'

describe('startDocsShellBehavior', () => {
  it('synchronizes collapsed shell accessibility state', (t) => {
    let fixture = createShellFixture()
    t.after(fixture.cleanup)

    fixture.navigationToggle.click()
    let mobile = window.matchMedia('(width < 900px)').matches
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
    assert.equal(fixture.navigation.hasAttribute('inert'), mobile)
    assert.equal(fixture.navigation.hasAttribute('aria-hidden'), mobile)
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

  it('opens mobile navigation panels from the sub-header', () => {
    assert.equal(window.matchMedia('(width < 900px)').matches, true)
    let fixture = createShellFixture()

    fixture.mobileNavigationToggle.click()

    assert.equal(document.documentElement.getAttribute('data-docs-mobile-panel'), 'navigation')
    assert.equal(fixture.navigation.hasAttribute('inert'), false)
    assert.equal(fixture.secondaryNavigation.hasAttribute('inert'), true)
    assert.equal(fixture.mobileNavigationToggle.getAttribute('aria-expanded'), 'true')
    assert.equal(document.body.style.overflow, 'hidden')
    assert.equal(document.activeElement, fixture.navigationLink)

    fixture.mobileSecondaryNavigationToggle.click()

    assert.equal(document.documentElement.getAttribute('data-docs-mobile-panel'), 'secondary')
    assert.equal(fixture.navigation.hasAttribute('inert'), true)
    assert.equal(fixture.secondaryNavigation.hasAttribute('inert'), false)
    assert.equal(fixture.mobileNavigationToggle.getAttribute('aria-expanded'), 'false')
    assert.equal(fixture.mobileSecondaryNavigationToggle.getAttribute('aria-expanded'), 'true')
    assert.equal(document.activeElement, fixture.secondaryNavigationLink)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    assert.equal(document.documentElement.hasAttribute('data-docs-mobile-panel'), false)
    assert.equal(fixture.secondaryNavigation.hasAttribute('inert'), true)
    assert.equal(fixture.mobileSecondaryNavigationToggle.getAttribute('aria-expanded'), 'false')
    assert.equal(document.body.style.overflow, '')
    assert.equal(document.activeElement, fixture.mobileSecondaryNavigationToggle)
    fixture.cleanup()
  })

  it('tracks the sticky mobile navigation edge while scrolling', () => {
    let fixture = createShellFixture()

    assert.equal(
      document.documentElement.style.getPropertyValue('--docs-mobile-navigation-top'),
      '112px',
    )

    fixture.setMobileNavigationBottom(48)
    window.dispatchEvent(new Event('scroll'))

    assert.equal(
      document.documentElement.style.getPropertyValue('--docs-mobile-navigation-top'),
      '48px',
    )
    fixture.cleanup()
  })

  it('remeasures the sticky edge before opening a mobile panel', () => {
    let fixture = createShellFixture()

    fixture.setMobileNavigationBottom(48)
    fixture.mobileNavigationToggle.click()

    assert.equal(
      document.documentElement.style.getPropertyValue('--docs-mobile-navigation-top'),
      '48px',
    )
    fixture.cleanup()
  })

  it('keeps the navigation panel open while page navigation is pending', () => {
    let fixture = createShellFixture()

    fixture.mobileNavigationToggle.click()
    fixture.navigationLink.click()

    assert.equal(document.documentElement.getAttribute('data-docs-mobile-panel'), 'navigation')
    fixture.completeNavigation()
    assert.equal(document.documentElement.hasAttribute('data-docs-mobile-panel'), false)
    fixture.cleanup()
  })
})

function createShellFixture() {
  let container = document.createElement('div')
  container.innerHTML = `
    <button id="docs-navigation-toggle" aria-expanded="true"></button>
    <button id="docs-mobile-navigation-toggle" aria-expanded="false"></button>
    <button id="docs-mobile-secondary-navigation-toggle" aria-expanded="false"></button>
    <nav id="docs-mobile-navigation-bar"></nav>
    <button id="docs-mobile-navigation-backdrop"></button>
    <nav id="docs-navigation"><a href="/start-here/" id="navigation-link">Start Here</a></nav>
    <aside id="docs-secondary-navigation"><a href="#intro" id="secondary-navigation-link">Intro</a></aside>
    <button data-docs-collapsed-only>Compact search</button>
    <button data-docs-expanded-only>Expanded search</button>
  `
  document.body.append(container)
  let mobileNavigationBottom = 112
  let mobileNavigationBar = getElement('docs-mobile-navigation-bar')
  let navigationCompleteTarget = new EventTarget()
  mobileNavigationBar.getBoundingClientRect = () =>
    DOMRect.fromRect({ y: mobileNavigationBottom - 48, height: 48 })

  let controller: AbortController
  startBehavior()

  return {
    navigation: getElement('docs-navigation'),
    navigationToggle: getElement('docs-navigation-toggle'),
    mobileNavigationToggle: getElement('docs-mobile-navigation-toggle'),
    mobileSecondaryNavigationToggle: getElement('docs-mobile-secondary-navigation-toggle'),
    navigationLink: getElement('navigation-link'),
    secondaryNavigation: getElement('docs-secondary-navigation'),
    secondaryNavigationLink: getElement('secondary-navigation-link'),
    collapsedOnly: getElement('[data-docs-collapsed-only]'),
    expandedOnly: getElement('[data-docs-expanded-only]'),
    setMobileNavigationBottom(value: number) {
      mobileNavigationBottom = value
    },
    completeNavigation() {
      navigationCompleteTarget.dispatchEvent(new Event('reloadComplete'))
    },
    startBehavior,
    stopBehavior() {
      controller.abort()
    },
    cleanup() {
      controller.abort()
      document.documentElement.removeAttribute('data-docs-nav-collapsed')
      document.documentElement.removeAttribute('data-docs-mobile-panel')
      document.documentElement.style.removeProperty('--docs-mobile-navigation-top')
      document.body.style.overflow = ''
      container.remove()
    },
  }

  function startBehavior() {
    controller = new AbortController()
    startDocsShellBehavior(controller.signal, {
      navigationName: 'chapter navigation',
      navigationCompleteTarget,
    })
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

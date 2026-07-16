import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { startChapterNavigationIndicator } from './chapter-navigation-indicator.browser.ts'

describe('startChapterNavigationIndicator', () => {
  it('moves the indicator from the previous to the destination chapter', async (t) => {
    let fixture = createChapterNavigationFixture()
    t.after(fixture.cleanup)

    assert.equal(fixture.list.getAttribute('data-has-current'), '')
    assert.equal(fixture.list.style.getPropertyValue('--docs-selection-indicator-y'), '0px')

    fixture.navigate('/routing-and-controllers/')
    fixture.selectSecondChapter()
    fixture.restart()

    assert.equal(fixture.list.style.getPropertyValue('--docs-selection-indicator-y'), '0px')

    await nextAnimationFrame()

    assert.equal(fixture.list.style.getPropertyValue('--docs-selection-indicator-y'), '36px')
    assert.equal(fixture.list.style.getPropertyValue('--docs-selection-indicator-height'), '32px')
  })

  it('keeps the current indicator for destinations outside the chapter list', (t) => {
    let fixture = createChapterNavigationFixture()
    t.after(fixture.cleanup)

    fixture.navigate('/search/')

    assert.equal(fixture.list.style.getPropertyValue('--docs-selection-indicator-y'), '0px')
  })

  it('restores the server-rendered state during cleanup', () => {
    let fixture = createChapterNavigationFixture()

    fixture.cleanup()

    assert.equal(fixture.list.hasAttribute('data-has-current'), false)
    assert.equal(fixture.list.style.getPropertyValue('--docs-selection-indicator-y'), '')
    assert.equal(fixture.list.style.getPropertyValue('--docs-selection-indicator-height'), '')
  })
})

function createChapterNavigationFixture() {
  let container = document.createElement('div')
  container.innerHTML = `
    <ol id="test-chapter-list">
      <li><a id="first-chapter" href="/start-here/" aria-current="page">Start Here</a></li>
      <li><a id="second-chapter" href="/routing-and-controllers/">Routing and Controllers</a></li>
    </ol>
  `
  document.body.append(container)

  let list = getList('test-chapter-list')
  let firstLink = getLink('first-chapter')
  let secondLink = getLink('second-chapter')
  let navigation = new EventTarget()

  list.getBoundingClientRect = () => DOMRect.fromRect()
  firstLink.getBoundingClientRect = () => DOMRect.fromRect({ y: 0, height: 32 })
  secondLink.getBoundingClientRect = () => DOMRect.fromRect({ y: 36, height: 32 })

  let controller = new AbortController()
  startChapterNavigationIndicator(list, controller.signal, navigation)

  return {
    list,
    navigate(href: string) {
      let event = new Event('navigate')
      Object.defineProperty(event, 'destination', {
        value: { url: new URL(href, window.location.href).href },
      })
      navigation.dispatchEvent(event)
    },
    selectSecondChapter() {
      firstLink.removeAttribute('aria-current')
      secondLink.setAttribute('aria-current', 'page')
    },
    restart() {
      controller.abort()
      controller = new AbortController()
      startChapterNavigationIndicator(list, controller.signal, navigation)
    },
    cleanup() {
      controller.abort()
      container.remove()
    },
  }
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()))
}

function getLink(id: string): HTMLAnchorElement {
  let element = document.getElementById(id)
  if (!(element instanceof HTMLAnchorElement)) {
    throw new Error(`Missing test link #${id}`)
  }
  return element
}

function getList(id: string): HTMLOListElement {
  let element = document.getElementById(id)
  if (!(element instanceof HTMLOListElement)) {
    throw new Error(`Missing ordered list #${id}`)
  }
  return element
}

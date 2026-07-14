import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { startTableOfContentsBehavior } from './table-of-contents.browser.tsx'

describe('startTableOfContentsBehavior', () => {
  it('synchronizes the current link and indicator after scrolling', async (t) => {
    let fixture = createTableOfContentsFixture()
    t.after(fixture.cleanup)

    assert.equal(fixture.firstLink.getAttribute('aria-current'), 'location')
    assert.equal(fixture.secondLink.hasAttribute('aria-current'), false)
    assert.equal(fixture.list.getAttribute('data-has-current'), '')
    assert.equal(fixture.list.style.getPropertyValue('--docs-toc-indicator-y'), '0px')
    assert.equal(fixture.list.style.getPropertyValue('--docs-toc-indicator-height'), '32px')

    fixture.setHeadingTops([-200, 80, 360])
    window.dispatchEvent(new Event('scroll'))
    window.dispatchEvent(new Event('scroll'))
    await nextAnimationFrame()

    assert.equal(fixture.firstLink.hasAttribute('aria-current'), false)
    assert.equal(fixture.secondLink.getAttribute('aria-current'), 'location')
    assert.equal(fixture.list.style.getPropertyValue('--docs-toc-indicator-y'), '36px')
  })

  it('restores server-rendered state during cleanup', () => {
    let fixture = createTableOfContentsFixture()

    fixture.cleanup()

    assert.equal(fixture.firstLink.hasAttribute('aria-current'), false)
    assert.equal(fixture.list.hasAttribute('data-has-current'), false)
    assert.equal(fixture.list.style.getPropertyValue('--docs-toc-indicator-y'), '')
    assert.equal(fixture.list.style.getPropertyValue('--docs-toc-indicator-height'), '')
  })
})

function createTableOfContentsFixture() {
  let container = document.createElement('div')
  container.style.minHeight = '5000px'
  container.innerHTML = `
    <ol id="test-toc">
      <li><a id="first-link" href="#first-heading">First</a></li>
      <li><a id="second-link" href="#second-heading">Second</a></li>
      <li><a id="third-link" href="#third-heading">Third</a></li>
    </ol>
    <h2 id="first-heading">First</h2>
    <h2 id="second-heading">Second</h2>
    <h2 id="third-heading">Third</h2>
  `
  document.body.append(container)

  let headingTops = [180, 420, 760]
  let headings = [
    getElement('first-heading'),
    getElement('second-heading'),
    getElement('third-heading'),
  ]
  let links = [getLink('first-link'), getLink('second-link'), getLink('third-link')]

  for (let [index, heading] of headings.entries()) {
    heading.getBoundingClientRect = () => DOMRect.fromRect({ y: headingTops[index] })
  }
  for (let [index, link] of links.entries()) {
    Object.defineProperties(link, {
      offsetTop: { configurable: true, value: index * 36 },
      offsetHeight: { configurable: true, value: 32 },
    })
  }

  let controller = new AbortController()
  startTableOfContentsBehavior('test-toc', controller.signal)

  return {
    list: getElement('test-toc'),
    firstLink: links[0],
    secondLink: links[1],
    setHeadingTops(tops: number[]) {
      headingTops = tops
    },
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

function getLink(id: string): HTMLAnchorElement {
  let element = document.getElementById(id)
  if (!(element instanceof HTMLAnchorElement)) {
    throw new Error(`Missing test link #${id}`)
  }
  return element
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()))
}

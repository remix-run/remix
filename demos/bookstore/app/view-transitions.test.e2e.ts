import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { Page } from 'playwright'

import { createTestRouter } from '../test/helpers.ts'

describe('bookstore view transitions', () => {
  it('cross-fades content while moving only the cover from a scrolled catalog', async (t) => {
    let page = await t.serve(await createTestServer((await createTestRouter()).fetch))
    let errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript(() => {
      let start = document.startViewTransition.bind(document)
      document.startViewTransition = (update) => {
        let transition = start(update)
        delete document.documentElement.dataset.transitionReady
        void transition.ready.then(() => {
          for (let animation of document.getAnimations()) {
            if (
              animation.effect instanceof KeyframeEffect &&
              animation.effect.pseudoElement?.startsWith('::view-transition')
            ) {
              animation.pause()
              animation.currentTime = 0
            }
          }
          document.documentElement.dataset.transitionReady = 'true'
        })
        document.addEventListener('finish-test-transition', () => transition.skipTransition(), {
          once: true,
        })
        return transition
      }
    })
    await page.goto('/books')
    let entry = await page.locator('script[type="module"][src]').getAttribute('src')
    assert.ok(entry)
    await page.evaluate(async (href) => {
      let { app } = await import(href)
      await app.ready()
    }, entry)
    let link = page.locator('a[data-rmx-prefetch="viewport"][href="/books/ink-and-tide"]')
    await link.scrollIntoViewIfNeeded()
    let originalScroll = await page.evaluate(() => scrollY)
    assert.ok(originalScroll > 0)
    await link.click({ noWaitAfter: true })
    await page.waitForFunction(() => document.documentElement.dataset.transitionReady === 'true')

    let start = await sampleTransition(page, 0)
    let middle = await sampleTransition(page, 0.5)
    assert.deepEqual(middle.page, start.page)
    assert.notEqual(middle.cover.transform, start.cover.transform)
    assert.equal(start.title, 'none')
    assert.deepEqual(middle.snapshotTransforms, ['none', 'none'])
    assert.ok(middle.oldOpacity < start.oldOpacity)
    assert.ok(middle.newOpacity > start.newOpacity)
    assert.equal(await page.evaluate(() => scrollY), 0)
    await page.evaluate(() => {
      document.dispatchEvent(new Event('finish-test-transition'))
      delete document.documentElement.dataset.transitionReady
    })
    await page.evaluate(async () => window.navigation.transition?.finished)
    await page.getByRole('heading', { level: 1, name: 'Ink & Tide', exact: true }).waitFor()

    let back = page.goBack()
    await page.waitForFunction(() => document.documentElement.dataset.transitionReady === 'true')
    start = await sampleTransition(page, 0)
    middle = await sampleTransition(page, 0.5)
    assert.deepEqual(middle.page, start.page)
    assert.notEqual(middle.cover.transform, start.cover.transform)
    assert.equal(start.title, 'none')
    assert.deepEqual(middle.snapshotTransforms, ['none', 'none'])
    assert.ok(middle.oldOpacity < start.oldOpacity)
    assert.ok(middle.newOpacity > start.newOpacity)
    assert.ok(Math.abs((await page.evaluate(() => scrollY)) - originalScroll) < 1)
    await sampleTransition(page, 1)
    let buttons = page.locator('[data-test-slug="ink-and-tide"] .btn')
    let snapshotButtons = await buttons.evaluateAll((buttons) =>
      buttons.map((button) => button.getBoundingClientRect().toJSON()),
    )
    await page.evaluate(() => document.dispatchEvent(new Event('finish-test-transition')))
    await back
    await page.getByRole('heading', { name: 'Browse Books', exact: true }).waitFor()
    await page.waitForFunction(() =>
      document.querySelector('[data-test-slug="ink-and-tide"]')?.matches(':hover'),
    )
    await page.locator('[data-test-slug="ink-and-tide"]').evaluate(async (card) => {
      card.getBoundingClientRect()
      await Promise.all(card.getAnimations().map((animation) => animation.finished))
    })
    assert.deepEqual(
      await buttons.evaluateAll((buttons) =>
        buttons.map((button) => button.getBoundingClientRect().toJSON()),
      ),
      snapshotButtons,
    )
    assert.deepEqual(errors, [])
  })
})

async function sampleTransition(page: Page, progress: number) {
  return page.evaluate((progress) => {
    for (let animation of document.getAnimations()) {
      if (
        animation.effect instanceof KeyframeEffect &&
        animation.effect.pseudoElement?.startsWith('::view-transition')
      ) {
        let duration = animation.effect.getTiming().duration
        if (typeof duration === 'number') animation.currentTime = duration * progress
      }
    }
    function geometry(name: string) {
      let style = getComputedStyle(document.documentElement, `::view-transition-group(${name})`)
      return { transform: style.transform, width: style.width, height: style.height }
    }
    let oldPage = getComputedStyle(
      document.documentElement,
      '::view-transition-old(bookstore-page)',
    )
    let newPage = getComputedStyle(
      document.documentElement,
      '::view-transition-new(bookstore-page)',
    )
    let title =
      document.querySelector('[data-test-slug="ink-and-tide"] h3') ??
      document.querySelector('main h1')
    return {
      page: geometry('bookstore-page'),
      cover: geometry('book-cover-13'),
      title: title ? getComputedStyle(title).viewTransitionName : undefined,
      snapshotTransforms: [oldPage.transform, newPage.transform],
      oldOpacity: Number(oldPage.opacity),
      newOpacity: Number(newPage.opacity),
    }
  }, progress)
}

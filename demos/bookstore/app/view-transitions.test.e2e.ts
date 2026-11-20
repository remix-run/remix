import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { Page } from 'playwright'

import { createTestRouter } from '../test/helpers.ts'

describe('bookstore view transitions', () => {
  it('reverses the selected related cover on Back and restores it on Forward', async (t) => {
    let page = await t.serve(await createTestServer((await createTestRouter()).fetch))
    await page.setViewportSize({ width: 1280, height: 1800 })
    await pauseViewTransitions(page)
    await page.goto('/books/bbq')
    await page.evaluate(async () => {
      let script = document.querySelector<HTMLScriptElement>('script[type="module"][src]')
      if (!script) throw new Error('Missing app entry')
      let { app } = await import(script.src)
      await app.ready()
    })
    let related = page.getByRole('region', { name: 'Related Books', exact: true })
    await related.getByRole('heading', { name: 'Bread Before Dawn', exact: true }).waitFor()
    await related
      .locator('[data-test-slug="bread-before-dawn"]')
      .getByRole('link', { name: 'View Details', exact: true })
      .click({ noWaitAfter: true })
    await page.waitForFunction(() => document.documentElement.dataset.transitionReady === 'true')
    await finishTransition(page)
    await related.getByRole('heading', { name: 'Ash & Smoke', exact: true }).waitFor()

    let relatedFrameRequests = 0
    page.on('request', (request) => {
      if (
        new URL(request.url()).pathname === '/books/bbq/related' &&
        request.headers()['x-remix-prefetch'] !== 'true'
      ) {
        relatedFrameRequests++
      }
    })
    let back = page.goBack()
    await page.waitForFunction(() => document.documentElement.dataset.transitionReady === 'true')
    let covers = await activeCoverTransitions(page)
    assert.deepEqual(covers, ['book-cover-11'], `Back animated ${covers.join(', ')}`)
    assert.equal(
      await page
        .locator('[data-book-faceout="1"]')
        .evaluate((faceout) => getComputedStyle(faceout).viewTransitionName),
      'none',
    )
    assert.ok(
      relatedFrameRequests <= 1,
      `Back loaded the related frame ${relatedFrameRequests} times`,
    )
    await finishTransition(page)
    await back
    await related.getByRole('heading', { name: 'Bread Before Dawn', exact: true }).waitFor()

    let forward = page.goForward()
    await page.waitForFunction(() => document.documentElement.dataset.transitionReady === 'true')
    covers = await activeCoverTransitions(page)
    assert.deepEqual(covers, ['book-cover-11'], `Forward animated ${covers.join(', ')}`)
    assert.equal(
      await page
        .locator('[data-book-faceout="11"]')
        .evaluate((faceout) => getComputedStyle(faceout).viewTransitionName),
      'book-cover-11',
    )
    await finishTransition(page)
    await forward
  })

  it('cross-fades content while moving only the cover from a scrolled catalog', async (t) => {
    let page = await t.serve(await createTestServer((await createTestRouter()).fetch))
    let errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await pauseViewTransitions(page)
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
    assert.equal(start.pageAnimation, 'none')
    assert.equal(middle.pageAnimation, 'none')
    assert.notEqual(middle.cover.transform, start.cover.transform)
    assert.equal(start.title, 'none')
    assert.deepEqual(middle.snapshotTransforms, ['none', 'none'])
    assert.ok(middle.oldOpacity < start.oldOpacity)
    assert.ok(middle.newOpacity > start.newOpacity)
    let resetScroll = await page.evaluate(() => scrollY)
    assert.ok(Math.abs(resetScroll) <= 1, `Expected scroll near 0, received ${resetScroll}`)
    await page.evaluate(() => {
      document.dispatchEvent(new Event('finish-test-transition'))
      delete document.documentElement.dataset.transitionReady
    })
    await page.evaluate(async () => window.navigation.transition?.finished)
    await page.getByRole('heading', { level: 1, name: 'Ink & Tide', exact: true }).waitFor()

    let back = page.goBack()
    await page.waitForFunction(() => document.documentElement.dataset.transitionReady === 'true')
    await page.evaluate(async () => window.navigation.transition?.finished)
    start = await sampleTransition(page, 0)
    middle = await sampleTransition(page, 0.5)
    assert.equal(start.pageAnimation, 'none')
    assert.equal(middle.pageAnimation, 'none')
    assert.notEqual(middle.cover.transform, start.cover.transform)
    assert.equal(start.title, 'none')
    assert.deepEqual(middle.snapshotTransforms, ['none', 'none'])
    assert.ok(middle.oldOpacity < start.oldOpacity)
    assert.ok(middle.newOpacity > start.newOpacity)
    let restoredScroll = await page.evaluate(() => scrollY)
    assert.ok(
      Math.abs(restoredScroll - originalScroll) <= 1,
      `Expected scroll near ${originalScroll}, received ${restoredScroll}`,
    )
    await sampleTransition(page, 1)
    let buttons = page.locator('[data-test-slug="ink-and-tide"] .btn')
    let snapshotButtons = await buttons.evaluateAll((buttons) =>
      buttons.map((button) => button.getBoundingClientRect().toJSON()),
    )
    await page.evaluate(() => document.dispatchEvent(new Event('finish-test-transition')))
    await back
    await page.getByRole('heading', { name: 'Browse Books', exact: true }).waitFor()
    await link.hover()
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

  it('moves only faceout covers when navigating through related cards and back to the catalog', async (t) => {
    let page = await t.serve(await createTestServer((await createTestRouter()).fetch))
    let errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width: 1280, height: 1800 })
    await pauseViewTransitions(page)
    await page.goto('/books/bbq')
    await page.evaluate(async () => {
      let script = document.querySelector<HTMLScriptElement>('script[type="module"][src]')
      if (!script) throw new Error('Missing app entry')
      let { app } = await import(script.src)
      await app.ready()
    })
    let related = page.getByRole('region', { name: 'Related Books', exact: true })
    await related.getByRole('heading', { name: 'Citrus & Salt', exact: true }).waitFor()
    let bread = related.locator('[data-test-slug="bread-before-dawn"]')
    await bread
      .getByRole('link', { name: 'View Details', exact: true })
      .click({ noWaitAfter: true })
    await page.waitForFunction(() => document.documentElement.dataset.transitionReady === 'true')
    assert.deepEqual(await activeCoverTransitions(page), ['book-cover-11'])
    assert.equal(
      await page
        .locator('[data-book-faceout="11"]')
        .evaluate((faceout) => getComputedStyle(faceout).viewTransitionName),
      'book-cover-11',
    )
    await page.evaluate(() => {
      document.dispatchEvent(new Event('finish-test-transition'))
      delete document.documentElement.dataset.transitionReady
    })
    await page.evaluate(async () => window.navigation.transition?.finished)
    await related.getByRole('heading', { name: 'Ash & Smoke', exact: true }).waitFor()
    let bbq = related.getByRole('img', { name: 'Ash & Smoke', exact: true })
    assert.equal(await bbq.isVisible(), true)

    await page
      .getByRole('link', { name: 'Back to Books', exact: true })
      .click({ noWaitAfter: true })
    await page.waitForFunction(() => document.documentElement.dataset.transitionReady === 'true')
    assert.deepEqual(await activeCoverTransitions(page), ['book-cover-11'])
    let catalogBbq = page.locator('[data-test-slug="bbq"] img')
    assert.equal(await catalogBbq.isVisible(), true)
    assert.equal(
      await catalogBbq.evaluate((cover) => getComputedStyle(cover).viewTransitionName),
      'none',
    )
    await page.evaluate(() => document.dispatchEvent(new Event('finish-test-transition')))
    await page.evaluate(async () => window.navigation.transition?.finished)
    assert.deepEqual(errors, [])
  })
})

async function finishTransition(page: Page) {
  await page.evaluate(() => {
    document.dispatchEvent(new Event('finish-test-transition'))
    delete document.documentElement.dataset.transitionReady
  })
  await page.evaluate(async () => window.navigation.transition?.finished)
}

async function activeCoverTransitions(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    let names = document.getAnimations().flatMap((animation) => {
      if (!(animation.effect instanceof KeyframeEffect)) return []
      let match = animation.effect.pseudoElement?.match(
        /^::view-transition-group\((book-cover-\d+)\)$/,
      )
      return match ? [match[1]] : []
    })
    return [...new Set(names)].sort()
  })
}

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
      // Lazy content can change snapshot dimensions; the page group must have no motion animation.
      pageAnimation: getComputedStyle(
        document.documentElement,
        '::view-transition-group(bookstore-page)',
      ).animationName,
      cover: geometry('book-cover-13'),
      title: title ? getComputedStyle(title).viewTransitionName : undefined,
      snapshotTransforms: [oldPage.transform, newPage.transform],
      oldOpacity: Number(oldPage.opacity),
      newOpacity: Number(newPage.opacity),
    }
  }, progress)
}

async function pauseViewTransitions(page: Page) {
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
}

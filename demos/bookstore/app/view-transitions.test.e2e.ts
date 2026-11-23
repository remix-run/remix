import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { Locator, Page } from 'playwright'

import { createTestRouter } from '../test/helpers.ts'

const transitionBookIds = [1, 2, 3, 4, 5, 6, 11, 13, 33, 34]

describe('bookstore view transitions', () => {
  it('selects the catalog cover in both directions and leaves cart mutations outside transitions', async (t) => {
    let page = await t.serve(
      await createTestServer((await createTestRouter({ bookIds: transitionBookIds })).fetch),
    )
    await recordViewTransitions(page)
    await page.goto('/books')
    await ready(page)
    let card = page.locator('[data-test-slug="ink-and-tide"]')
    await assertCoverStyle(card.locator('img'), 13)
    assert.deepEqual(await transitionStyles(card.locator('h3')), [])
    await card.getByRole('link', { name: 'View Details', exact: true }).click()
    await assertTransition(page, 1, 'book-cover-13')
    let details = page.getByRole('heading', { level: 1, name: 'Ink & Tide', exact: true })
    await details.waitFor()
    await assertCoverStyle(page.locator('[data-book-faceout="13"]'), 13)
    assert.deepEqual(await transitionStyles(details), [])

    await details.locator('..').getByRole('button', { name: 'Add to Cart', exact: true }).click()
    await details
      .locator('..')
      .getByRole('button', { name: 'Remove from Cart', exact: true })
      .waitFor()
    await assertTransition(page, 1, 'book-cover-13')

    await page.goBack()
    await assertTransition(page, 2, 'book-cover-13')
    await page.getByRole('heading', { name: 'Browse Books', exact: true }).waitFor()
    await assertCoverStyle(card.locator('img'), 13)
  })

  it('selects the outgoing related cover on Back, the incoming cover on Forward, and only the faceout when returning to the catalog', async (t) => {
    let returning = false
    let returningRelated = Promise.withResolvers<void>()
    let releaseRelated = Promise.withResolvers<void>()
    t.after(() => releaseRelated.resolve())
    let router = await createTestRouter({ bookIds: transitionBookIds })
    let page = await t.serve(
      await createTestServer(async (request) => {
        let response = await router.fetch(request)
        if (new URL(request.url).pathname === '/books/bbq/related') {
          // Keep the response out of the HTTP cache so Back exercises a pending lazy load.
          response.headers.set('Cache-Control', 'no-store')
          if (returning) {
            returningRelated.resolve()
            await releaseRelated.promise
          }
        }
        return response
      }),
    )
    await recordViewTransitions(page)
    await page.setViewportSize({ width: 1280, height: 1800 })
    await page.goto('/books/bbq')
    await ready(page)
    let related = page.getByRole('region', { name: 'Related Books', exact: true })
    await related.getByRole('heading', { name: 'Bread Before Dawn', exact: true }).waitFor()
    await related
      .locator('[data-test-slug="bread-before-dawn"]')
      .getByRole('link', { name: 'View Details', exact: true })
      .click()
    await assertTransition(page, 1, 'book-cover-11')
    await page.getByRole('heading', { level: 1, name: 'Bread Before Dawn', exact: true }).waitFor()
    await assertCoverStyle(page.locator('[data-book-faceout="11"]'), 11)
    await related.getByRole('heading', { name: 'Ash & Smoke', exact: true }).waitFor()

    await page.evaluate(() => {
      let fetchRequest = window.fetch
      window.fetch = (input, init) => {
        let url = new URL(input instanceof Request ? input.url : String(input), location.href)
        if (
          url.pathname === '/books/bbq/related' &&
          new Headers(init?.headers).get('X-Remix-Prefetch') !== 'true'
        ) {
          document.documentElement.dataset.testRelatedCache = init?.cache ?? 'default'
        }
        return fetchRequest(input, init)
      }
    })
    returning = true
    await page.goBack()
    await returningRelated.promise
    // The page transition completes while the related frame's normal load is still pending.
    await assertTransition(page, 2, 'book-cover-11')
    assert.equal(await page.locator('html').getAttribute('data-test-related-cache'), 'force-cache')
    releaseRelated.resolve()
    returning = false
    await page.getByRole('heading', { level: 1, name: 'Ash & Smoke', exact: true }).waitFor()
    await related.getByRole('heading', { name: 'Bread Before Dawn', exact: true }).waitFor()
    await assertCoverStyle(related.locator('[data-test-slug="bread-before-dawn"] img'), 11)
    await page.evaluate(async () => {
      let script = document.querySelector<HTMLScriptElement>('script[type="module"][src]')
      if (!script) throw new Error('Missing app entry')
      let { app } = await import(script.src)
      await app.frames.get('related-books-1')?.reload()
    })
    assert.equal(await page.locator('html').getAttribute('data-test-related-cache'), 'force-cache')

    await page.goForward()
    await assertTransition(page, 3, 'book-cover-11')
    await page.getByRole('heading', { level: 1, name: 'Bread Before Dawn', exact: true }).waitFor()
    await related.getByRole('heading', { name: 'Ash & Smoke', exact: true }).waitFor()
    await assertCoverStyle(related.locator('[data-test-slug="bbq"] img'), 1)
    await page.getByRole('link', { name: 'Back to Books', exact: true }).click()
    await assertTransition(page, 4, 'book-cover-11')
    await page.getByRole('heading', { name: 'Browse Books', exact: true }).waitFor()
    await assertCoverStyle(page.locator('[data-test-slug="bread-before-dawn"] img'), 11)
    await assertCoverStyle(page.locator('[data-test-slug="bbq"] img'), 1)
  })

  it('does not start a transition when reduced motion is requested', async (t) => {
    let page = await t.serve(
      await createTestServer((await createTestRouter({ bookIds: transitionBookIds })).fetch),
    )
    await recordViewTransitions(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/books')
    await ready(page)
    await page
      .locator('[data-test-slug="bbq"]')
      .getByRole('link', { name: 'View Details', exact: true })
      .click()
    await page.getByRole('heading', { level: 1, name: 'Ash & Smoke', exact: true }).waitFor()
    await ready(page)
    assert.equal(await page.locator('html').getAttribute('data-test-transition-calls'), null)
  })
})

async function ready(page: Page) {
  await page.evaluate(async () => {
    let script = document.querySelector<HTMLScriptElement>('script[type="module"][src]')
    if (!script) throw new Error('Missing app entry')
    let { app } = await import(script.src)
    await app.ready()
  })
}

async function recordViewTransitions(page: Page) {
  await page.addInitScript(() => {
    let calls = 0
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value(update: Parameters<Document['startViewTransition']>[0]) {
        let call = ++calls
        let types = new Set<string>(typeof update === 'object' ? update?.types : undefined)
        // Exercise the application's commit callback without native snapshots or animation clocks.
        let committed = Promise.resolve().then(async () => {
          if (typeof update === 'function') await update()
          else await update?.update?.()
          document.documentElement.dataset.testTransitionCalls = String(calls)
          document.documentElement.dataset.testTransitionCommitted = String(call)
          document.documentElement.dataset.testTransitionTypes = [...types].join(' ')
        })
        return {
          types,
          ready: committed,
          updateCallbackDone: committed,
          finished: committed,
          skipTransition() {},
        } satisfies Pick<
          ViewTransition,
          'types' | 'ready' | 'updateCallbackDone' | 'finished' | 'skipTransition'
        >
      },
    })
  })
}

async function assertTransition(page: Page, calls: number, type: string) {
  await page.waitForFunction(
    (calls) => Number(document.documentElement.dataset.testTransitionCommitted ?? 0) >= calls,
    calls,
  )
  assert.equal(await page.locator('html').getAttribute('data-test-transition-calls'), String(calls))
  assert.equal(await page.locator('html').getAttribute('data-test-transition-types'), type)
}

async function transitionStyles(element: Locator) {
  return element.evaluate((element) => {
    function styleRules(rules: CSSRuleList): CSSStyleRule[] {
      return Array.from(rules).flatMap((rule) => {
        if (rule instanceof CSSStyleRule) return [rule, ...styleRules(rule.cssRules)]
        return rule instanceof CSSGroupingRule ? styleRules(rule.cssRules) : []
      })
    }
    let sheets = [...document.styleSheets, ...document.adoptedStyleSheets]
    return sheets
      .flatMap((sheet) => styleRules(sheet.cssRules))
      .flatMap((rule) => {
        let name = rule.style.getPropertyValue('view-transition-name')
        if (!name || name === 'none') return []
        let selectors = [rule.selectorText]
        for (let parent = rule.parentRule; parent; parent = parent.parentRule) {
          if (parent instanceof CSSStyleRule) selectors.push(parent.selectorText)
        }
        if (
          ![...element.classList].some((className) =>
            selectors.some((selector) => selector.endsWith(`.${CSS.escape(className)}`)),
          )
        ) {
          return []
        }
        return [
          {
            name,
            group: rule.style.getPropertyValue('view-transition-class'),
            selector: selectors.join(' '),
          },
        ]
      })
  })
}

async function assertCoverStyle(element: Locator, id: number) {
  let name = `book-cover-${id}`
  let styles = await transitionStyles(element)
  assert.deepEqual([...new Set(styles.map((style) => style.name))], [name])
  assert.ok(styles.every((style) => style.group === 'book-cover'))
  assert.ok(
    styles.every((style) => style.selector.includes(`:root:active-view-transition-type(${name})`)),
  )
}

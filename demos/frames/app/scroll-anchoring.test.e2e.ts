import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'

import { router } from './router.ts'
import { routes } from './routes.ts'

declare global {
  interface Window {
    nativeRestorationY: number
    afterRestorationY: number
  }
}

describe('scroll anchoring', () => {
  it('restores traversal scroll after an earlier client entry is removed', async (t) => {
    let { page, reproduction, scrollPosition } = await openDetailPage(t)

    // Keep the destination's blocking frame pending while the outgoing layout is painted.
    await page.route('**/scroll-anchoring-items', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 350))
      await route.continue()
    })
    await page.goBack()
    await page.getByText('Anchoring row 48', { exact: true }).waitFor()
    await reproduction.getByRole('button', { name: 'Hydration check: 1', exact: true }).waitFor()
    await page.waitForFunction(
      ({ expected, tolerance }) =>
        window.navigation.transition === null && Math.abs(window.scrollY - expected) < tolerance,
      { expected: scrollPosition, tolerance: 50 },
    )
    let restoredPosition = await page.evaluate(
      () =>
        new Promise<number>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve(window.scrollY))),
        ),
    )

    assert.ok(
      Math.abs(restoredPosition - scrollPosition) < 50,
      `Expected traversal to restore ${scrollPosition}, got ${restoredPosition}`,
    )
  })

  it('does not override native restoration after user interaction during a traversal', async (t) => {
    let { page, reproduction } = await openDetailPage(t)
    let requested = Promise.withResolvers<void>()
    let resume = Promise.withResolvers<void>()
    t.after(() => resume.resolve())
    await page.route('**/scroll-anchoring-items', async (route) => {
      requested.resolve()
      await resume.promise
      await route.continue()
    })
    await observeNativeRestoration(page)

    let traversal = page.evaluate(async () => {
      await window.navigation.back().finished
    })
    void traversal.catch(() => {})
    await requested.promise
    await page.waitForTimeout(350)
    await page.mouse.click(10, 10)
    resume.resolve()
    await traversal
    await page.getByText('Anchoring row 48', { exact: true }).waitFor()
    await reproduction.getByRole('button', { name: 'Hydration check: 1', exact: true }).waitFor()
    let { native, actual } = await page.evaluate(() => ({
      native: window.nativeRestorationY,
      actual: window.afterRestorationY,
    }))
    assert.equal(typeof native, 'number')
    assert.equal(actual, native)
  })

  it('respects manual history scroll restoration during a traversal', async (t) => {
    let { page, reproduction } = await openDetailPage(t, 'manual')
    await observeNativeRestoration(page)
    await page.route('**/scroll-anchoring-items', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 350))
      await route.continue()
    })

    await page.goBack()
    await page.getByText('Anchoring row 48', { exact: true }).waitFor()
    await reproduction.getByRole('button', { name: 'Hydration check: 1', exact: true }).waitFor()
    await page.waitForFunction(() => window.navigation.transition === null)
    let { native, actual } = await page.evaluate(() => ({
      native: window.nativeRestorationY,
      actual: window.afterRestorationY,
    }))
    assert.equal(await page.evaluate(() => window.history.scrollRestoration), 'manual')
    assert.equal(typeof native, 'number')
    assert.equal(actual, native)
  })
})

async function openDetailPage(
  t: TestContext,
  scrollRestoration: History['scrollRestoration'] = 'auto',
) {
  let page = await t.serve(await createTestServer(router.fetch))
  await page.addInitScript((mode) => (window.history.scrollRestoration = mode), scrollRestoration)
  await page.goto(routes.scrollAnchoring.href())
  await page.locator('html[data-frames-ready="true"]').waitFor()

  let reproduction = page.locator('#scroll-anchoring-reproduction')
  let hydrationCheck = reproduction.getByRole('button', {
    name: 'Hydration check: 0',
    exact: true,
  })
  await hydrationCheck.waitFor()
  await hydrationCheck.click()
  await reproduction.getByRole('button', { name: 'Hydration check: 1', exact: true }).waitFor()

  await page.locator('#scroll-anchoring-list-end').scrollIntoViewIfNeeded()
  let scrollPosition = await page.evaluate(() => window.scrollY)
  await page.getByRole('link', { name: 'Open the anchoring detail page' }).click()
  await page.getByRole('heading', { name: 'Scroll anchoring detail' }).waitFor()
  await reproduction.getByRole('button', { name: 'Hydration check: 1', exact: true }).waitFor()
  await page.evaluate(() => window.scrollTo(0, 500))
  let detailScrollPosition = await page.evaluate(() => window.scrollY)
  assert.ok(
    detailScrollPosition > 100,
    `Expected the detail page to scroll, got ${detailScrollPosition}`,
  )

  return { page, reproduction, scrollPosition }
}

async function observeNativeRestoration(page: Awaited<ReturnType<TestContext['serve']>>) {
  await page.evaluate(() => {
    window.navigation.addEventListener(
      'navigate',
      (event) => {
        let scroll = event.scroll.bind(event)
        event.scroll = () => {
          scroll()
          window.nativeRestorationY = window.scrollY
          queueMicrotask(() => {
            window.afterRestorationY = window.scrollY
          })
        }
      },
      { once: true },
    )
  })
}

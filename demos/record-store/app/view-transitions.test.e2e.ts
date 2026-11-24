import * as assert from 'remix/assert'
import { createElement } from 'remix/component'
import { renderToString } from 'remix/component/server'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'

import { createTestRouter } from '../test/helpers.ts'
import { albumCoverTransition } from './ui/album-transitions.ts'

describe('record store view transitions', () => {
  it('wires catalog and faceout cover classes to the page transition', async (t) => {
    let markup = await renderToString(createElement('img', { mix: albumCoverTransition(1) }))
    let coverClass = /class="([^"]+)"/.exec(markup)?.[1]
    assert.ok(coverClass)
    let page = await t.serve(
      await createTestServer((await createTestRouter({ albumIds: [1, 2, 3] })).fetch),
    )
    await page.addInitScript(() => {
      let calls = 0
      Object.defineProperty(document, 'startViewTransition', {
        configurable: true,
        value(update: () => Promise<void>) {
          calls++
          let types = new Set<string>()
          let committed = Promise.resolve().then(async () => {
            await update()
            document.documentElement.dataset.testTransitionCalls = String(calls)
            document.documentElement.dataset.testTransitionTypes = [...types].join(' ')
          })
          return {
            types,
            ready: committed,
            updateCallbackDone: committed,
            finished: committed,
            skipTransition() {},
          } satisfies ViewTransition
        },
      })
    })
    await page.goto('/albums')
    await page.evaluate(async () => {
      let script = document.querySelector<HTMLScriptElement>('script[type="module"][src]')
      if (!script) throw new Error('Missing app entry')
      let { app } = await import(script.src)
      await app.ready()
    })
    let card = page.locator('[data-test-slug="overpass-stereo"]')
    assert.ok((await card.locator('img').getAttribute('class'))?.split(' ').includes(coverClass))
    assert.equal(
      (await card.locator('h3').getAttribute('class'))?.split(' ').includes(coverClass) ?? false,
      false,
    )
    await card.getByRole('link', { name: 'View Details', exact: true }).click()
    await page.waitForFunction(
      () => document.documentElement.dataset.testTransitionTypes === 'album-cover-1',
    )
    assert.equal(await page.locator('html').getAttribute('data-test-transition-calls'), '1')
    assert.ok(
      (await page.locator('[data-album-faceout="1"]').getAttribute('class'))
        ?.split(' ')
        .includes(coverClass),
    )
    assert.equal(
      (
        await page
          .getByRole('heading', { level: 1, name: 'Overpass Stereo', exact: true })
          .getAttribute('class')
      )
        ?.split(' ')
        .includes(coverClass) ?? false,
      false,
    )
  })
})

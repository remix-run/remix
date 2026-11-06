import * as assert from '@remix-run/assert'
import { createTestServer } from '@remix-run/node-fetch-server/test'
import timers from 'node:timers'
import { describe, it } from '../index.ts'

describe('E2E mock.timers', () => {
  it('mocks the worker clock without changing the Playwright page clock', async (t) => {
    let server = await createTestServer(() => new Response('clock test'))
    let page = await t.serve(server)
    await page.goto('/')
    let pageTime = await page.evaluate(() => Date.now())
    t.mock.timers.enable({ apis: ['Date', 'setTimeout'] })
    let fired = false
    timers.setTimeout(() => {
      fired = true
    }, 10)
    t.mock.timers.tick(10)
    assert.equal(fired, true)
    assert.equal(Date.now(), 10)
    assert.ok(await page.evaluate((earlier) => Date.now() >= earlier, pageTime))
    t.mock.timers.reset()
  })
})

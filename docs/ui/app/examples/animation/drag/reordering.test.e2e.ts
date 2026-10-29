import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'
import { router } from '../../../router.ts'

async function checkHeldRow(t: TestContext) {
  let page = await t.serve(await createTestServer(router.fetch))
  page.setDefaultTimeout(6000)
  await page.goto('/animation/drag/#reordering')
  let board = page.getByRole('region', { name: 'Reorder work queue' })
  let row = board.getByLabel('Review API', { exact: true })
  let next = board.getByLabel('Update examples', { exact: true })
  await row.scrollIntoViewIfNeeded()
  let before = await row.boundingBox()
  let neighbor = await next.boundingBox()
  assert.ok(before && neighbor)
  let step = neighbor.y - before.y
  let x = before.x + 40
  let y = before.y + before.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  try {
    await page.mouse.move(x, y + step + 8, { steps: 6 })
    await page.waitForFunction(() => {
      let list = document.querySelector(`ol[aria-label="Work queue"]`)
      return list?.children[1]?.getAttribute('aria-label') === 'Review API'
    })
    await row.evaluate(async (node) => {
      for (let animation of node.getAnimations()) animation.finish()
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    })
    assert.equal(await row.getAttribute('data-dragging'), '')
    let swapped = await row.boundingBox()
    assert.ok(swapped)
    let expected = before.y + step + 8
    assert.ok(Math.abs(swapped.y - expected) < 1, `${swapped.y} should equal ${expected}`)
    await page.mouse.move(x, y + step + 18)
    let moved = await row.boundingBox()
    assert.ok(moved)
    assert.ok(Math.abs(moved.y - swapped.y - 10) < 1)
  } finally {
    await page.mouse.up()
  }
  await page.waitForFunction(() => {
    let node = document.querySelector(`ol[aria-label="Work queue"] > [aria-label="Review API"]`)
    if (!(node instanceof HTMLElement) || !(node.offsetParent instanceof HTMLElement)) return false
    let target = node.offsetParent.getBoundingClientRect().top + node.offsetTop
    return Math.abs(node.getBoundingClientRect().top - target) < 0.2
  })
  assert.equal(await row.getAttribute('data-dragging'), null)
}

describe('Native vertical drag-to-reorder', () => {
  it('keeps the row under the held mouse across a swap and further movement', async (t) => {
    await checkHeldRow(t)
  })

  it('reorders upward with touch, cancels into the new slot and allows another gesture', async (t) => {
    let server = await createTestServer(router.fetch)
    let initialPage = await t.serve(server)
    let browser = initialPage.context().browser()
    assert.ok(browser)
    let context = await browser.newContext({
      hasTouch: true,
      viewport: { width: 390, height: 720 },
      baseURL: server.baseUrl,
      colorScheme: 'light',
    })
    t.after(() => context.close())
    let page = await context.newPage()
    page.setDefaultTimeout(6000)
    await page.goto('/animation/drag/#reordering')
    let row = page.getByLabel('Publish preview', { exact: true })
    await row.scrollIntoViewIfNeeded()
    let before = await row.boundingBox()
    assert.ok(before)
    let step = await row.evaluate((node) => {
      let previous = node.previousElementSibling
      if (!(node instanceof HTMLElement) || !(previous instanceof HTMLElement))
        throw new Error('Missing adjacent rows')
      return node.offsetTop - previous.offsetTop
    })
    let x = before.x + 40
    let y = before.y + before.height / 2
    let input = await context.newCDPSession(page)
    await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    await input.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: y - step * 2 - 8 }],
    })
    await page.waitForFunction(
      () =>
        document
          .querySelector('[aria-label="Work queue"]')
          ?.children[1]?.getAttribute('aria-label') === 'Publish preview',
    )
    assert.equal(await row.getAttribute('data-dragging'), '')
    await row.evaluate(async (node) => {
      for (let animation of node.getAnimations()) animation.finish()
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    })
    let held = await row.boundingBox()
    assert.ok(held)
    assert.ok(Math.abs(held.y - (before.y - step * 2 - 8)) < 1)
    await input.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
    assert.equal(await row.getAttribute('data-dragging'), null)
    await page.waitForFunction(() => {
      let node = document.querySelector('[aria-label="Publish preview"]')
      return (
        node instanceof HTMLElement &&
        (getComputedStyle(node).translate === 'none' ||
          Math.abs(parseFloat(getComputedStyle(node).translate.split(' ')[1]) || 0) < 0.1)
      )
    })
    let settled = await row.boundingBox()
    assert.ok(settled)
    assert.ok(Math.abs(settled.y - (before.y - step * 2)) < 1)
    y = settled.y + settled.height / 2
    await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    await input.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: y + 16 }],
    })
    let again = await row.boundingBox()
    assert.ok(again)
    assert.ok(Math.abs(again.y - settled.y - 16) < 1)
    await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    assert.equal(await row.getAttribute('data-dragging'), null)
  })

  it('ends the gesture when another control deliberately takes pointer capture', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.goto('/animation/drag/#reordering')
    let row = page.getByLabel('Review API', { exact: true })
    await row.scrollIntoViewIfNeeded()
    await row.evaluate((node) =>
      node.addEventListener('pointerdown', (event) => {
        if (event instanceof PointerEvent)
          node.setAttribute('data-test-pointer-id', String(event.pointerId))
      }),
    )
    let box = await row.boundingBox()
    assert.ok(box)
    await page.mouse.move(box.x + 80, box.y + 25)
    await page.mouse.down()
    try {
      await page.mouse.move(box.x + 80, box.y + 35)
      assert.equal(await row.getAttribute('data-dragging'), '')
      let id = Number(await row.getAttribute('data-test-pointer-id'))
      await page
        .getByRole('button', { name: 'Move Review API down', exact: true })
        .evaluate((button, id) => button.setPointerCapture(id), id)
      await page.mouse.move(box.x + 80, box.y + 40)
      assert.equal(await row.getAttribute('data-dragging'), null)
    } finally {
      await page.mouse.up()
    }
  })
})

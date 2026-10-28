import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import { router } from './router.ts'

describe('Live examples in the docs site', () => {
  it('positions custom toasts at the top center on desktop and narrow screens', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    page.setDefaultTimeout(5000)
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
    await page.goto('/patterns/toast/#custom-position')
    let trigger = page.getByRole('button', { name: 'Show top-center toast', exact: true })
    await trigger.click()
    let toastItem = page.getByRole('dialog', { name: 'Toast title', exact: true })
    await toastItem.waitFor()
    let bounds = await toastItem.boundingBox()
    assert.ok(bounds)
    assert.ok(Math.abs(bounds.y - 16) < 1)
    assert.ok(Math.abs(bounds.x + bounds.width / 2 - 640) < 1)
    assert.equal(await trigger.evaluate((el) => el === document.activeElement), true)

    await page.setViewportSize({ width: 390, height: 720 })
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
    bounds = await toastItem.boundingBox()
    assert.ok(bounds)
    assert.ok(Math.abs(bounds.y - 16) < 1)
    assert.ok(Math.abs(bounds.x - 16) < 1)
    assert.ok(Math.abs(bounds.width - 358) < 1)
    assert.equal(
      await toastItem.evaluate((el) => {
        let rect = el.getBoundingClientRect()
        return el.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + 20))
      }),
      true,
    )
    let dismiss = toastItem.locator('button[aria-label="Dismiss notification"]')
    await dismiss.focus()
    await dismiss.press('Enter')
    await toastItem.waitFor({ state: 'hidden' })

    await trigger.click()
    await toastItem.waitFor()
    bounds = await toastItem.boundingBox()
    assert.ok(bounds)
    let x = bounds.x + bounds.width / 2
    let y = bounds.y + bounds.height - 12
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x, y + 40, { steps: 5 })
    assert.equal(
      await toastItem.evaluate((el) =>
        Number.parseFloat(getComputedStyle(el).translate.split(' ')[1]),
      ),
      4,
    )
    await page.mouse.move(x, y - 55, { steps: 10 })
    await page.mouse.up()
    await toastItem.waitFor({ state: 'hidden' })
  })

  it('tracks swipe movement, resists left drags and hands a right dismissal to toast', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    page.setDefaultTimeout(5000)
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/patterns/toast/#basic')
    let show = page.locator('#basic').getByRole('button', { name: 'Show toast', exact: true })
    await show.click()
    await show.click()
    let region = page.getByRole('region', { name: 'Notifications', exact: true }).first()
    let article = region.locator('article').first()
    await article.hover()
    await region.evaluate(async (el) => {
      await Promise.allSettled(el.getAnimations({ subtree: true }).map((a) => a.finished))
    })
    let surface = article
    let box = await surface.boundingBox()
    assert.ok(box)
    let x = box.x + 60
    let y = box.y + 30
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x - 100, y, { steps: 10 })
    assert.equal(
      await surface.evaluate((el) => Number.parseFloat(getComputedStyle(el).translate) || 0),
      -10,
    )
    await page.mouse.up()
    await page.waitForFunction(() => {
      let el = document.querySelector('[aria-label="Notifications"]:first-child article')
      return el && (Number.parseFloat(getComputedStyle(el).translate) || 0) === 0
    })
    assert.equal(
      await surface.evaluate((el) => Number.parseFloat(getComputedStyle(el).translate) || 0),
      0,
    )
    assert.equal(await region.locator('article').count(), 2)

    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 80, y, { steps: 8 })
    assert.equal(
      await surface.evaluate((el) => Number.parseFloat(getComputedStyle(el).translate) || 0),
      80,
    )
    await page.mouse.move(x + 60, y, { steps: 4 })
    await page.mouse.up()
    await page.waitForFunction(() => {
      let el = document.querySelector('[aria-label="Notifications"]:first-child article')
      return el && (Number.parseFloat(getComputedStyle(el).translate) || 0) === 0
    })
    assert.equal(await region.locator('article').count(), 2, 'Reversing cancels dismissal')

    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 160, y, { steps: 12 })
    await page.mouse.move(x + 40, y, { steps: 10 })
    await page.mouse.move(x + 100, y, { steps: 6 })
    await page.mouse.up()
    await page.waitForFunction(
      () =>
        document.querySelectorAll('[aria-label="Notifications"]:first-child article').length === 1,
    )
    assert.equal(await region.locator('article').count(), 1)
  })

  it('uses the same drag behaviour on a plain card without toast', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    page.setDefaultTimeout(5000)
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/animation/drag/#resistance')
    let card = page.locator('#resistance-example article')
    await card.evaluate(async (el) => {
      await Promise.allSettled(el.getAnimations().map((animation) => animation.finished))
    })
    let box = await card.boundingBox()
    assert.ok(box)
    let x = box.x + 60
    let y = box.y + 30
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x - 100, y, { steps: 10 })
    assert.equal(
      await card.evaluate((el) => Number.parseFloat(getComputedStyle(el).translate)),
      -10,
    )
    await page.mouse.up()
    await page.waitForFunction(() => {
      let el = document.querySelector('#resistance-example article')
      return el && getComputedStyle(el).translate === 'none'
    })
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 100, y, { steps: 10 })
    assert.equal(
      await card.evaluate((el) => Number.parseFloat(getComputedStyle(el).translate)),
      100,
    )
    let preview = await page.locator('#resistance-example .docs-demo-preview').boundingBox()
    assert.ok(preview)
    let edge = preview.x + preview.width
    await page.mouse.move(edge - 8, y, { steps: 10 })
    assert.equal(
      await page.evaluate(
        ({ x, y }) =>
          document
            .elementsFromPoint(x, y)
            .some((el) => el.getAttribute('aria-label') === 'Swipe to dismiss card'),
        { x: edge - 8, y },
      ),
      true,
      'The card remains visible up to the preview edge',
    )
    assert.equal(
      await page.evaluate(
        ({ x, y }) =>
          document
            .elementsFromPoint(x, y)
            .some((el) => el.getAttribute('aria-label') === 'Swipe to dismiss card'),
        { x: edge + 8, y },
      ),
      false,
      'The card is clipped at the preview edge',
    )
    await page.mouse.up()
    await page.waitForFunction(() => !document.querySelector('#resistance-example article'))
    await card.waitFor({ state: 'visible' })
    await page.waitForFunction(() => {
      let card = document.querySelector('#resistance-example article')
      return card && getComputedStyle(card).translate === 'none'
    })
  })

  it('leaves a slowly placed tile at its release position', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    page.setDefaultTimeout(5000)
    await page.goto('/animation/drag/')
    let tile = page.getByRole('article', { name: 'Drag anywhere', exact: true })
    await tile.scrollIntoViewIfNeeded()
    let box = await tile.boundingBox()
    assert.ok(box)
    await page.mouse.move(box.x + 36, box.y + 36)
    await page.mouse.down()
    await page.mouse.move(box.x + 76, box.y + 56, { steps: 10 })
    await page.waitForTimeout(150)
    await page.mouse.up()
    await page.waitForTimeout(300)
    assert.equal(await tile.evaluate((el) => getComputedStyle(el).translate), '40px 20px')
  })

  it('drags on both axes and carries momentum beyond the release position', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    page.setDefaultTimeout(5000)
    await page.goto('/animation/drag/')
    let tile = page.getByRole('article', { name: 'Drag anywhere' })
    let box = await tile.boundingBox()
    assert.ok(box)
    let x = box.x + box.width / 2
    let y = box.y + box.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 32, y - 24, { steps: 5 })
    assert.equal(await tile.evaluate((el) => getComputedStyle(el).translate), '32px -24px')
    await page.mouse.move(x + 80, y - 24, { steps: 5 })
    assert.equal(await tile.evaluate((el) => getComputedStyle(el).translate), '80px -24px')
    await page.mouse.up()
    await page.waitForFunction(() => {
      let el = document.querySelector('[aria-label="Drag anywhere"]')
      return el && (Number.parseFloat(getComputedStyle(el).translate) || 0) > 100
    })
    let settled = await tile.boundingBox()
    assert.ok(settled)
    assert.ok(settled.x > box.x + 80)
  })

  it('locks a real captured pointer and snaps a tile into a grid slot on release', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    page.setDefaultTimeout(5000)
    await page.goto('/animation/drag/#direction-lock')
    let tile = page.getByRole('article', { name: 'Lock drag direction' })
    let box = await tile.boundingBox()
    assert.ok(box)
    let x = box.x + box.width / 2
    let y = box.y + box.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 40, y + 5, { steps: 4 })
    await page.mouse.move(x + 50, y + 90, { steps: 4 })
    assert.equal(await tile.getAttribute('data-drag-axis'), 'x')
    assert.deepEqual(
      await tile.evaluate((el) => {
        let [x, y] = getComputedStyle(el).translate.split(' ')
        return [Number.parseFloat(x), Number.parseFloat(y) || 0]
      }),
      [10, 0],
    )
    await page.mouse.up()
    await page.waitForFunction(() => {
      let el = document.querySelector('[aria-label="Lock drag direction"]')
      return el && getComputedStyle(el).translate === 'none'
    })

    await page.goto('/animation/drag/#snap-list')
    let gridTile = page.getByRole('article', { name: 'Drag between grid slots' })
    box = await gridTile.boundingBox()
    assert.ok(box)
    x = box.x + box.width / 2
    y = box.y + box.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x - 90, y + 50, { steps: 10 })
    await page.waitForTimeout(120)
    await page.mouse.up()
    await page.waitForFunction(() => {
      let el = document.querySelector('[aria-label="Drag between grid slots"]')
      return el && getComputedStyle(el).translate === '-64px 64px'
    })
  })

  it('picks up a settling tile at its current visual position', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    page.setDefaultTimeout(5000)
    await page.goto('/animation/drag/')
    let tile = page.getByRole('article', { name: 'Drag anywhere' })
    let box = await tile.boundingBox()
    assert.ok(box)
    await page.mouse.move(box.x + 36, box.y + 36)
    await page.mouse.down()
    await page.mouse.move(box.x + 68, box.y + 36, { steps: 4 })
    await page.mouse.up()
    box = await tile.boundingBox()
    assert.ok(box)
    await page.mouse.move(box.x + 36, box.y + 36)
    await page.mouse.down()
    let held = await tile.evaluate((el) => Number.parseFloat(getComputedStyle(el).translate))
    assert.ok(held >= 32)
    await page.mouse.move(box.x + 26, box.y + 36, { steps: 2 })
    let moved = await tile.evaluate((el) => Number.parseFloat(getComputedStyle(el).translate))
    assert.ok(Math.abs(moved - (held - 10)) < 0.1)
    await page.mouse.up()
  })

  it('supports a light narrow preview and immediate reduced-motion release', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.setViewportSize({ width: 390, height: 720 })
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
    await page.goto('/animation/drag/#axes')
    let tile = page.getByRole('article', { name: 'Drag vertically' })
    await tile.scrollIntoViewIfNeeded()
    assert.equal(
      await tile.evaluate((el) => getComputedStyle(el).backgroundColor),
      'rgb(255, 255, 255)',
    )
    let box = await tile.boundingBox()
    assert.ok(box)
    await page.mouse.move(box.x + 36, box.y + 36)
    await page.mouse.down()
    await page.mouse.move(box.x + 36, box.y + 60, { steps: 4 })
    assert.equal(await tile.evaluate((el) => getComputedStyle(el).translate), '0px 24px')
    await page.mouse.up()
    assert.equal(await tile.evaluate((el) => getComputedStyle(el).translate), 'none')
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    )
  })

  it('restricts vertical dragging to the y axis', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    page.setDefaultTimeout(5000)
    await page.goto('/animation/drag/#vertical')
    let tile = page.getByRole('article', { name: 'Drag vertically' })
    let box = await tile.boundingBox()
    assert.ok(box)
    let x = box.x + box.width / 2
    let y = box.y + box.height / 2
    assert.equal(await tile.evaluate((el) => getComputedStyle(el).touchAction), 'pan-x')
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 10, y + 32, { steps: 5 })
    assert.equal(await tile.evaluate((el) => getComputedStyle(el).translate), '0px 32px')
    let preview = await page.locator('#vertical .docs-demo-preview').boundingBox()
    assert.ok(preview)
    let bottom = preview.y + preview.height
    await page.mouse.move(x, bottom - 12, { steps: 5 })
    assert.equal(
      await page.evaluate(
        ({ x, y }) =>
          document
            .elementsFromPoint(x, y)
            .some((el) => el.getAttribute('aria-label') === 'Drag vertically'),
        { x, y: bottom - 12 },
      ),
      true,
      'The tile remains visible in the preview padding',
    )
    await page.mouse.move(x, bottom + 20, { steps: 5 })
    assert.equal(
      await page.evaluate(
        ({ x, y }) =>
          document
            .elementsFromPoint(x, y)
            .some((el) => el.getAttribute('aria-label') === 'Drag vertically'),
        { x, y: bottom + 20 },
      ),
      false,
      'The tile cannot paint over the source below the preview',
    )
    await page.mouse.up()
    await page.waitForFunction(() => {
      let el = document.querySelector('[aria-label="Drag vertically"]')
      return el && getComputedStyle(el).translate === 'none'
    })
  })

  it('tracks a finger on touch, springs back after cancellation and dismisses to the right', async (t) => {
    let server = await createTestServer(router.fetch)
    let page = await t.serve(server)
    let browser = page.context().browser()
    assert.ok(browser)
    let context = await browser.newContext({
      hasTouch: true,
      viewport: { width: 390, height: 720 },
      baseURL: server.baseUrl,
    })
    t.after(() => context.close())
    let touchPage = await context.newPage()
    touchPage.setDefaultTimeout(5000)
    await touchPage.goto('/patterns/toast/#basic')
    await touchPage.locator('#basic').getByRole('button', { name: 'Show toast', exact: true }).tap()
    let region = touchPage.getByRole('region', { name: 'Notifications', exact: true }).first()
    let card = region.locator('article')
    await region.evaluate(async (el) => {
      await Promise.allSettled(el.getAnimations({ subtree: true }).map((a) => a.finished))
    })
    let box = await card.boundingBox()
    assert.ok(box)
    let x = box.x + 60
    let y = box.y + 30
    let pointer = await context.newCDPSession(touchPage)
    await pointer.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y }],
    })
    await pointer.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x + 25, y }],
    })
    assert.equal(
      await card.evaluate((el) => Number.parseFloat(getComputedStyle(el).translate) || 0),
      25,
    )
    await pointer.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
    await touchPage.waitForFunction(() => {
      let el = document.querySelector('[aria-label="Notifications"]:first-child article')
      return el && (Number.parseFloat(getComputedStyle(el).translate) || 0) === 0
    })
    await pointer.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y }],
    })
    await pointer.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x + 160, y }],
    })
    assert.equal(
      await card.evaluate((el) => Number.parseFloat(getComputedStyle(el).translate) || 0),
      160,
    )
    await pointer.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x + 40, y }],
    })
    await pointer.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x + 100, y }],
    })
    await pointer.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await card.waitFor({ state: 'detached' })
  })

  it('collapses the basic stack after mouse dismissal but keeps keyboard expansion until blur', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    page.setDefaultTimeout(5000)
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/patterns/toast/#basic')
    let panel = page.locator('#basic')
    let show = panel.getByRole('button', { name: 'Show toast', exact: true })
    await show.click()
    await show.click()
    await show.click()
    let region = page.locator(
      'body > .ui-toast-demo-outlets [aria-label="Notifications"]:first-child',
    )
    await region.locator('article').first().hover()
    await region.locator('button').first().click()
    await page.mouse.move(1, 1)
    await region.locator('article').nth(2).waitFor({ state: 'detached' })
    await page.waitForFunction(
      () =>
        !document
          .querySelector('body > .ui-toast-demo-outlets [aria-label="Notifications"]:first-child')
          ?.hasAttribute('data-expanded'),
    )
    await show.click()
    await page.keyboard.press('F6')
    assert.equal(await region.evaluate((el) => el === document.activeElement), true)
    assert.equal(await region.getAttribute('data-expanded'), '')
    await page.mouse.move(1, 1)
    assert.equal(await region.getAttribute('data-expanded'), '')
    await page.keyboard.press('F6')
    assert.equal(await region.getAttribute('data-expanded'), null)
    assert.equal(await show.evaluate((el) => el === document.activeElement), true)
  })

  it('visits toast content and controls with the keyboard and returns to the publisher', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    page.setDefaultTimeout(5000)
    await page.goto('/patterns/toast/#basic')
    let show = page.locator('#basic').getByRole('button', { name: 'Show toast', exact: true })
    await show.click()
    await show.click()
    await page.mouse.move(1, 1)
    await page.keyboard.press('F6')
    let region = page.getByRole('region', { name: 'Notifications', exact: true }).first()
    assert.equal(await region.evaluate((el) => el === document.activeElement), true)
    await page.keyboard.press('Shift+Tab')
    assert.equal(await show.evaluate((el) => el === document.activeElement), true)
    await page.keyboard.press('F6')
    await page.keyboard.press('Tab')
    let dialogs = region.getByRole('dialog')
    assert.equal(await dialogs.nth(0).evaluate((el) => el === document.activeElement), true)
    assert.equal(
      await dialogs.nth(0).getAttribute('aria-describedby'),
      await dialogs.nth(0).locator('p').getAttribute('id'),
    )
    await page.keyboard.press('Tab')
    assert.equal(
      await dialogs
        .nth(0)
        .getByRole('button', { name: 'Dismiss notification' })
        .evaluate((el) => el === document.activeElement),
      true,
    )
    await page.keyboard.press('Tab')
    assert.equal(await dialogs.nth(1).evaluate((el) => el === document.activeElement), true)
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    assert.equal(await show.evaluate((el) => el === document.activeElement), true)
    assert.equal(await dialogs.count(), 2)
    await page.keyboard.press('F6')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Escape')
    await dialogs.nth(1).waitFor({ state: 'detached' })
    assert.equal(await dialogs.count(), 1)
    assert.equal(await dialogs.nth(0).evaluate((el) => el === document.activeElement), true)
    await page.keyboard.press('Escape')
    assert.equal(await show.evaluate((el) => el === document.activeElement), true)
  })

  it('fans out stacked toasts on touch and collapses when tapping outside', async (t) => {
    let server = await createTestServer(router.fetch)
    let page = await t.serve(server)
    let browser = page.context().browser()
    assert.ok(browser)
    let context = await browser.newContext({
      hasTouch: true,
      viewport: { width: 390, height: 720 },
      baseURL: server.baseUrl,
    })
    t.after(() => context.close())
    let touchPage = await context.newPage()
    touchPage.setDefaultTimeout(5000)
    await touchPage.goto('/patterns/toast/#basic')
    let panel = touchPage.locator('#basic')
    let show = panel.getByRole('button', { name: 'Show toast', exact: true })
    await show.tap()
    await show.tap()
    await show.tap()
    let region = touchPage.locator(
      'body > .ui-toast-demo-outlets [aria-label="Notifications"]:first-child',
    )
    await region.locator('article').first().tap()
    await touchPage.waitForFunction(() =>
      document
        .querySelector('body > .ui-toast-demo-outlets [aria-label="Notifications"]:first-child')
        ?.hasAttribute('data-expanded'),
    )
    await region.evaluate(async (el) => {
      await Promise.allSettled(
        el.getAnimations({ subtree: true }).map((animation) => animation.finished),
      )
    })
    let front = await region.locator('article').nth(0).boundingBox()
    let rear = await region.locator('article').nth(1).boundingBox()
    assert.ok(front && rear)
    assert.equal(rear.height, front.height)
    assert.ok(rear.y + rear.height + 11 <= front.y)
    await region.getByRole('button', { name: 'Dismiss notification' }).nth(1).tap()
    await region.locator('article').nth(2).waitFor({ state: 'detached' })
    assert.equal(await region.getAttribute('data-expanded'), '')
    // A neutral outside target avoids publishing another toast as part of collapse.
    await panel.locator('.docs-demo-preview').tap({ position: { x: 8, y: 8 } })
    await touchPage.waitForFunction(
      () =>
        !document
          .querySelector('body > .ui-toast-demo-outlets [aria-label="Notifications"]:first-child')
          ?.hasAttribute('data-expanded'),
    )
    assert.equal(await region.evaluate((el) => el.contains(document.activeElement)), false)
  })

  it('renders toast examples at the document root and follows native action links', async (t) => {
    let nodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    t.after(() => {
      if (nodeEnv === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = nodeEnv
    })
    let page = await t.serve(await createTestServer(router.fetch))
    page.setDefaultTimeout(5000)
    let errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/patterns/toast/')
    let trigger = page.locator('#basic').getByRole('button', { name: 'Show toast', exact: true })
    await trigger.click()
    let outlets = page.locator('body > .ui-toast-demo-outlets')
    let toastItem = outlets.getByRole('dialog', { name: 'Toast 1 created', exact: true })
    await toastItem.waitFor()
    assert.equal(
      await toastItem
        .locator(':scope > div > div')
        .evaluate((el) => getComputedStyle(el).backgroundColor),
      'rgb(255, 255, 255)',
    )
    await trigger.press('F6')
    assert.equal(
      await toastItem.locator('..').evaluate((el) => el === document.activeElement),
      true,
    )
    await toastItem.evaluate((el) =>
      Promise.all(el.getAnimations().map((animation) => animation.finished)),
    )
    let geometry = await toastItem.evaluate((el) => {
      let rect = el.getBoundingClientRect()
      return {
        bottom: innerHeight - rect.bottom,
        right: innerWidth - rect.right,
        reachable: el.contains(
          document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2),
        ),
        inPreview: el.closest('.docs-demo') !== null,
      }
    })
    assert.ok(Math.abs(geometry.bottom - 16) < 1, JSON.stringify(geometry))
    assert.ok(Math.abs(geometry.right - 16) < 1)
    assert.equal(geometry.reachable, true)
    assert.equal(geometry.inPreview, false)
    await toastItem.getByRole('button', { name: 'Dismiss notification' }).press('Enter')
    await toastItem.waitFor({ state: 'hidden' })
    assert.equal(await trigger.evaluate((el) => el === document.activeElement), true)

    await page.setViewportSize({ width: 390, height: 720 })
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.getByRole('button', { name: 'Show toast with link', exact: true }).click()
    let actionToastItem = outlets.getByRole('dialog', { name: 'Toast title', exact: true })
    await actionToastItem.waitFor()
    assert.equal(
      await actionToastItem
        .locator(':scope > div > div')
        .evaluate((el) => getComputedStyle(el).backgroundColor),
      'rgb(34, 34, 40)',
    )
    let size = await actionToastItem.boundingBox()
    assert.ok(size && size.x >= 0 && size.x + size.width <= 390)
    let navigation = page.getByRole('button', { name: 'Toast', exact: true })
    await navigation.click()
    assert.equal(await navigation.getAttribute('aria-expanded'), 'true')
    await navigation.click()
    await actionToastItem.getByRole('button', { name: 'Dismiss', exact: true }).click()
    await actionToastItem.waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: 'Show toast with link', exact: true }).click()
    await actionToastItem.getByRole('link', { name: 'View docs', exact: true }).press('Enter')
    await page.waitForURL('**/animation/entrance-exit/')
    await page.getByRole('heading', { name: 'Entrance and exit', exact: true }).waitFor()
    assert.deepEqual(errors, [], errors.join('\n'))
  })

  it('hydrates examples with working pointer interaction, keyboard dismissal and focus restoration', async (t) => {
    // Development mode leaves search disabled until its generated assets exist.
    let nodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    t.after(() => {
      if (nodeEnv === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = nodeEnv
    })
    let page = await t.serve(await createTestServer(router.fetch))
    page.setDefaultTimeout(5000)
    let errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`${message.location().url} ${message.text()}`)
    })

    await page.setViewportSize({ width: 390, height: 720 })
    await page.goto('/patterns/accordion/')
    let source = page.locator('#basic .docs-demo-source')
    let code = source.locator('.docs-demo-source-code')
    let disclosure = source.getByRole('button', { name: 'Show code', exact: true })
    assert.equal(await disclosure.getAttribute('aria-expanded'), 'false')
    assert.equal(await code.getAttribute('inert'), '')
    await disclosure.press('Enter')
    disclosure = source.getByRole('button', { name: 'Hide code', exact: true })
    assert.equal(await disclosure.getAttribute('aria-expanded'), 'true')
    assert.equal(await code.getAttribute('inert'), null)

    // Long source grows vertically with the document and scrolls horizontally.
    let layout = await code.evaluate((element) => {
      let pre = element.querySelector('pre')
      if (!pre) throw new Error('Missing example source')
      return {
        height: element.clientHeight,
        fullHeight: element.scrollHeight,
        width: pre.clientWidth,
        fullWidth: pre.scrollWidth,
        overflowX: getComputedStyle(pre).overflowX,
        preHeight: pre.clientHeight,
        preFullHeight: pre.scrollHeight,
        sourceWidth: element.clientWidth,
        sourceFullWidth: element.scrollWidth,
      }
    })
    assert.ok(layout.fullHeight <= layout.height + 1)
    assert.ok(layout.fullWidth > layout.width)
    assert.equal(layout.overflowX, 'auto')
    assert.ok(layout.preFullHeight <= layout.preHeight + 1)
    assert.ok(layout.sourceFullWidth <= layout.sourceWidth + 1)
    await disclosure.press('Space')
    disclosure = source.getByRole('button', { name: 'Show code', exact: true })
    assert.equal(await disclosure.getAttribute('aria-expanded'), 'false')
    assert.equal(await disclosure.evaluate((el) => el === document.activeElement), true)
    assert.equal(await code.getAttribute('inert'), '')
    assert.equal(await page.locator('#anatomy pre').first().isVisible(), true)
    await page.setViewportSize({ width: 1280, height: 720 })

    let hero = page.locator('#basic .docs-demo-preview')
    let billing = hero.getByRole('button', { name: 'Billing', exact: true })
    await billing.click()
    await hero.locator('button[aria-expanded="true"]').filter({ hasText: 'Billing' }).waitFor()
    assert.equal(
      await hero
        .getByRole('button', { name: 'Shipping', exact: true })
        .getAttribute('aria-expanded'),
      'false',
    )

    await page.goto('/patterns/popover/')
    let popover = page.locator('#basic .docs-demo-preview')
    let trigger = popover.getByRole('button', { name: 'Filter pull requests' })
    await trigger.click()
    let dialog = popover.getByRole('dialog', { name: 'Filter pull requests' })
    await dialog.waitFor()
    let open = dialog.getByRole('checkbox', { name: 'Open', exact: true })
    await dialog.locator('input[value="open"]:focus').waitFor()
    await open.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
    await popover.locator('button[aria-label="Filter pull requests"]:focus').waitFor()
    assert.deepEqual(errors, [], errors.join('\n'))
  })
  it('opens API details with the keyboard and follows type links without JavaScript', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    page.setDefaultTimeout(5000)
    await page.route('**/*', (route) =>
      route.request().resourceType() === 'script' ? route.abort() : route.continue(),
    )
    await page.goto('/patterns/accordion/')
    let reference = page.locator('#api-reference')
    let callback = reference.locator('details').filter({
      has: page.locator('summary').filter({ hasText: 'onValueChange' }),
    })
    let signature = callback.getByRole('row', { name: /^Type / }).getByRole('cell')
    assert.equal(await signature.isVisible(), false)
    await callback.locator('summary').press('Enter')
    assert.equal(await signature.isVisible(), true)
    assert.match(await signature.innerText(), /\(value: string\[\]\) => void/)
    await callback.locator('summary').press('Space')
    assert.equal(await signature.isVisible(), false)

    let value = reference
      .locator('.ui-api-table')
      .first()
      .locator('details')
      .filter({
        has: page.locator('summary code').getByText('value', { exact: true }),
      })
    await value.locator('summary').click()
    await value.getByRole('link', { name: 'AccordionMultipleValue', exact: true }).click()
    let definition = page.locator('#type-AccordionMultipleValue')
    await definition.waitFor({ state: 'visible' })
    assert.match(
      await definition.locator('pre').innerText(),
      /type AccordionMultipleValue = string\[\]/,
    )
    assert.equal(await definition.evaluate((el) => el.closest('details')?.open), true)

    let attributes = reference.locator('.ui-api-table').filter({
      has: page.locator('summary code').getByText('aria-hidden', { exact: true }),
    })
    let hidden = attributes.locator('details').filter({
      has: page.locator('summary code').getByText('aria-hidden', { exact: true }),
    })
    await hidden.locator('summary').click()
    assert.equal(
      await hidden.getByRole('rowheader', { name: 'Description', exact: true }).isVisible(),
      true,
    )
    assert.equal(
      await hidden.getByRole('rowheader', { name: 'Value', exact: true }).isVisible(),
      true,
    )
    assert.match(
      await hidden.getByRole('row', { name: /^Description / }).innerText(),
      /Present while closed/,
    )

    await page.setViewportSize({ width: 390, height: 720 })
    let props = reference.locator('details').filter({
      has: page.locator('summary code').getByText('AccordionMultipleContextProps', { exact: true }),
    })
    await props.locator('summary').click()
    assert.match(await props.locator('pre').innerText(), /onValueChange\?:/)
    let layout = await props.evaluate((el) => {
      let pre = el.querySelector('pre')
      if (!pre) throw new Error('Missing type definition')
      return {
        width: el.clientWidth,
        fullWidth: el.scrollWidth,
        overflowX: getComputedStyle(pre).overflowX,
      }
    })
    assert.ok(layout.fullWidth <= layout.width + 1)
    assert.equal(layout.overflowX, 'auto')

    await page.goto('/patterns/listbox/#context-reference')
    let settled = page.locator('.ui-api-entry').filter({
      has: page.locator('summary code').getByText('onSelectSettled', { exact: true }),
    })
    await settled.locator('summary').click()
    assert.match(
      await settled.getByRole('row', { name: /^Type / }).innerText(),
      /option\?: ListboxRegisteredOption.*void \| Promise<void>/,
    )
    let referenceWidth = await settled.evaluate((el) => ({
      width: el.clientWidth,
      fullWidth: el.scrollWidth,
    }))
    assert.ok(referenceWidth.fullWidth <= referenceWidth.width + 1)

    await page.goto('/animation/spring/#types-reference')
    let springOptions = page.locator('.ui-api-entry').filter({
      has: page.locator('summary code').getByText('SpringOptions', { exact: true }),
    })
    await springOptions.locator('summary').click()
    assert.match(await springOptions.locator('pre').innerText(), /bounce\?: number/)
    assert.equal(
      await springOptions.locator('pre').evaluate((el) => getComputedStyle(el).overflowX),
      'auto',
    )
  })

  it('navigates to API parts and shares entries below the sticky navigation', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    page.setDefaultTimeout(5000)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.route('**/*', (route) =>
      route.request().resourceType() === 'script' ? route.abort() : route.continue(),
    )
    await page.goto('/patterns/listbox/')
    let outline = page.locator('#docs-secondary-navigation')
    await outline.getByRole('link', { name: 'ListboxRef', exact: true }).click()
    let heading = await page.locator('#ref-reference').boundingBox()
    let header = await page.getByRole('banner').boundingBox()
    assert.ok(heading && header)
    assert.ok(heading.y >= header.y + header.height + 16)
    assert.ok(heading.y < 140)

    let method = page.locator('.ui-api-entry').filter({
      has: page.locator('summary code').getByText('matchSearchText', { exact: true }),
    })
    await method.locator('summary').click()
    let permalink = method.getByRole('link', { name: 'Link to matchSearchText', exact: true })
    assert.equal(await permalink.getAttribute('href'), '#ref-members-matchSearchText')
    await permalink.click()
    assert.equal(new URL(page.url()).hash, '#ref-members-matchSearchText')
    await page.goto('/patterns/accordion/')
    await page.goto('/patterns/listbox/#ref-members-matchSearchText')
    let entry = page.locator('#ref-members-matchSearchText')
    await entry.waitFor({ state: 'visible' })
    assert.match(await entry.innerText(), /fromValue\?: ListboxValue/)
    let summary = await method.locator('summary').boundingBox()
    assert.ok(summary)
    assert.ok(summary.y >= header.y + header.height + 16)

    await page.unroute('**/*')
    await page.reload()
    await entry.waitFor({ state: 'visible' })
    await page.setViewportSize({ width: 390, height: 720 })
    await page.goto('/patterns/listbox/')
    let toggle = page.getByRole('button', { name: 'On this page', exact: true })
    await toggle.click()
    await outline.getByRole('link', { name: 'option()', exact: true }).click()
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false')
    heading = await page.locator('#option-reference').boundingBox()
    let toolbar = await page.locator('#docs-mobile-navigation-bar').boundingBox()
    assert.ok(heading && toolbar)
    assert.ok(heading.y >= toolbar.y + toolbar.height + 16)
    assert.ok(heading.y < 100)
    await outline.locator('a[href="#option-reference"][aria-current="location"]').waitFor({
      state: 'attached',
    })

    await page.goto('/patterns/listbox/#context-options-onSelectSettled')
    let callback = page.locator('#context-options-onSelectSettled')
    await callback.waitFor({ state: 'visible' })
    summary = await callback.locator('..').locator('summary').boundingBox()
    assert.ok(summary)
    assert.ok(summary.y >= toolbar.y + toolbar.height + 16)
  })
})

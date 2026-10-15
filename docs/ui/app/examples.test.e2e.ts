import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import { router } from './router.ts'

describe('Live examples in the docs site', () => {
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

    await page.goto('/patterns/accordion/')
    let source = page.locator('#basic .ui-demo-source')
    let code = source.locator('.ui-demo-source-code')
    let disclosure = source.getByRole('button', { name: 'Show code', exact: true })
    assert.equal(await disclosure.getAttribute('aria-expanded'), 'false')
    assert.equal(await code.evaluate((el) => el.clientHeight), 160)
    assert.equal(await code.getAttribute('inert'), '')
    await page.emulateMedia({ colorScheme: 'dark' })
    let backgrounds = await source.evaluate((element) => {
      let pre = element.querySelector('pre')
      if (!pre) throw new Error('Missing example source')
      return [getComputedStyle(element).backgroundColor, getComputedStyle(pre).backgroundColor]
    })
    assert.equal(backgrounds[0], backgrounds[1])
    await page.emulateMedia({ colorScheme: 'light' })
    await disclosure.press('Enter')
    disclosure = source.getByRole('button', { name: 'Hide code', exact: true })
    assert.equal(await disclosure.getAttribute('aria-expanded'), 'true')
    assert.equal(await code.getAttribute('inert'), null)

    // Long source must grow with the document, including on narrow screens.
    await page.setViewportSize({ width: 390, height: 720 })
    let layout = await code.evaluate((element) => {
      let pre = element.querySelector('pre')
      if (!pre) throw new Error('Missing example source')
      return {
        height: element.clientHeight,
        fullHeight: element.scrollHeight,
        width: pre.clientWidth,
        fullWidth: pre.scrollWidth,
        preHeight: pre.clientHeight,
        preFullHeight: pre.scrollHeight,
      }
    })
    assert.ok(layout.height > 440)
    assert.ok(layout.fullHeight <= layout.height + 1)
    assert.ok(layout.fullWidth <= layout.width + 1)
    assert.ok(layout.preFullHeight <= layout.preHeight + 1)
    await page.evaluate(() => {
      let code = document.querySelector('#basic .ui-demo-source')
      if (!code) throw new Error('Missing example source')
      window.scrollTo(0, window.scrollY + code.getBoundingClientRect().top + 1000)
    })
    let floating = await disclosure.boundingBox()
    assert.ok(floating)
    assert.ok(Math.abs(floating.y + floating.height - 704) <= 1)

    await page.evaluate(() => {
      let code = document.querySelector('#basic .ui-demo-source')
      if (!code) throw new Error('Missing example source')
      window.scrollTo(0, window.scrollY + code.getBoundingClientRect().bottom - 600)
    })
    let pinned = await disclosure.boundingBox()
    assert.ok(pinned)
    assert.ok(Math.abs(pinned.y + pinned.height - 584) <= 1)
    await disclosure.press('Space')
    disclosure = source.getByRole('button', { name: 'Show code', exact: true })
    assert.equal(await disclosure.getAttribute('aria-expanded'), 'false')
    assert.equal(await code.evaluate((el) => el.clientHeight), 160)
    assert.equal(await disclosure.evaluate((el) => el === document.activeElement), true)
    let collapsed = await disclosure.boundingBox()
    assert.ok(collapsed && Math.abs(collapsed.y - 64) <= 1)
    let preview = await code.boundingBox()
    assert.ok(preview && preview.y + preview.height <= 49, JSON.stringify(preview))
    assert.equal(await page.locator('#anatomy pre').first().isVisible(), true)
    await page.setViewportSize({ width: 1280, height: 720 })
    await disclosure.click()
    await source.getByRole('button', { name: 'Hide code', exact: true }).click()
    collapsed = await disclosure.boundingBox()
    assert.ok(collapsed && Math.abs(collapsed.y - 80) <= 1)
    preview = await code.boundingBox()
    assert.ok(preview && preview.y + preview.height <= 65, JSON.stringify(preview))

    let hero = page.locator('#basic .ui-demo-preview')
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
    let popover = page.locator('#basic .ui-demo-preview')
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
        codeWidth: pre.clientWidth,
        codeFullWidth: pre.scrollWidth,
      }
    })
    assert.ok(layout.fullWidth <= layout.width + 1)
    assert.ok(layout.codeFullWidth <= layout.codeWidth + 1)

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
    let definitionWidth = await springOptions.locator('pre').evaluate((el) => ({
      width: el.clientWidth,
      fullWidth: el.scrollWidth,
    }))
    assert.ok(definitionWidth.fullWidth <= definitionWidth.width + 1)
  })
})

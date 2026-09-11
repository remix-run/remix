import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'

import { createAppRouter } from './router.ts'
import { routes } from './routes.ts'

describe('i18n browser behavior', () => {
  it('uses full-document language navigations, then saves and clears preferences', async (t) => {
    let page = await t.serve(await createTestServer(createAppRouter().fetch))
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
    await page.goto(routes.home.href({ locale: 'en' }))
    let cartQuantity = page.getByRole('spinbutton', { name: 'Cart quantity' })
    let cartSummary = page.getByRole('status', { name: 'Cart summary' })
    await cartSummary.filter({ hasText: 'Your cart is empty' }).waitFor()
    await cartQuantity.fill('2')
    await cartSummary.filter({ hasText: 'You have 2 items in your cart' }).waitFor()

    await page.getByRole('button', { name: 'Increase value', exact: true }).click()
    await page.getByRole('status').filter({ hasText: '1,251,000' }).waitFor()
    let documentStarted = await page.evaluate(() => performance.timeOrigin)

    await page.getByRole('link', { name: 'العربية', exact: true }).click()
    await page.locator('html[lang="ar"][dir="rtl"]').waitFor()
    assert.equal(new URL(page.url()).pathname, routes.home.href({ locale: 'ar' }))
    assert.equal(await page.title(), 'مثال التدويل في Remix')
    assert.equal(await page.getByRole('combobox').inputValue(), 'ar')
    await page.setViewportSize({ width: 375, height: 812 })
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
      true,
    )
    let arabicDocumentStarted = await page.evaluate(() => performance.timeOrigin)
    assert.notEqual(arabicDocumentStarted, documentStarted)

    let arabicCartQuantity = page.getByRole('spinbutton', { name: 'كمية سلة التسوق' })
    let arabicCartSummary = page.getByRole('status', { name: 'ملخص سلة التسوق' })
    assert.equal(await arabicCartQuantity.inputValue(), '0')
    await arabicCartSummary.filter({ hasText: 'سلة التسوق فارغة' }).waitFor()
    await arabicCartQuantity.fill('2')
    await arabicCartSummary.filter({ hasText: 'لديك منتجان في سلة التسوق' }).waitFor()
    await page.getByRole('button', { name: 'إضافة منتج واحد' }).click()
    await arabicCartSummary.filter({ hasText: 'لديك 3 منتجات في سلة التسوق' }).waitFor()

    let arabicValue = page.getByRole('status', { name: 'القيمة المنسقة في المتصفح' })
    await arabicValue.filter({ hasText: new Intl.NumberFormat('ar').format(1250000) }).waitFor()

    await page.getByRole('link', { name: 'English', exact: true }).click()
    await page.locator('html[lang="en"][dir="ltr"]').waitFor()
    await page
      .getByRole('status', { name: 'Browser-formatted value' })
      .filter({ hasText: '1,250,000' })
      .waitFor()
    assert.equal(await page.getByRole('spinbutton', { name: 'Cart quantity' }).inputValue(), '0')
    await page
      .getByRole('status', { name: 'Cart summary' })
      .filter({ hasText: 'Your cart is empty' })
      .waitFor()
    assert.equal(await page.title(), 'Remix i18n Demo')
    assert.equal(await page.getByRole('combobox').inputValue(), 'en')
    assert.notEqual(await page.evaluate(() => performance.timeOrigin), arabicDocumentStarted)

    await page.getByRole('combobox').selectOption('ja')
    await page.getByRole('button', { name: 'Save preference', exact: true }).click()
    await page.waitForURL((url) => url.pathname === routes.home.href({ locale: 'ja' }))
    await page.locator('html[lang="ja"]').waitFor()
    assert.notEqual(await page.evaluate(() => performance.timeOrigin), documentStarted)

    await page.getByRole('link', { name: 'Remix i18n', exact: true }).click()
    await page.waitForURL((url) => url.pathname === routes.home.href())
    await page.locator('html[lang="ja"]').waitFor()
    assert.equal(await page.getByRole('combobox').inputValue(), 'ja')

    await page.getByRole('link', { name: 'English', exact: true }).click()
    await page.locator('html[lang="en"]').waitFor()
    await page.getByRole('combobox').selectOption('ja')
    await page.getByRole('button', { name: 'Clear saved preference', exact: true }).click()
    await page.waitForURL((url) => url.pathname === routes.home.href())
    await page.locator('html[lang="en"][dir="ltr"]').waitFor()
    assert.equal(await page.getByRole('combobox').inputValue(), 'en')
    assert.equal(await page.title(), 'Remix i18n Demo')
    assert.equal(
      (await page.context().cookies()).some((cookie) => cookie.name === 'locale'),
      false,
    )
  })

  it('supports language links and preference forms without JavaScript', async (t) => {
    let server = await createTestServer(createAppRouter().fetch)
    let runtimePage = await t.serve(server)
    let browser = runtimePage.context().browser()
    assert.ok(browser)
    let context = await browser.newContext({
      baseURL: server.baseUrl,
      javaScriptEnabled: false,
      locale: 'en-US',
    })
    t.after(() => context.close())
    let page = await context.newPage()

    await page.goto(routes.home.href({ locale: 'en' }))
    assert.equal(await page.getByRole('button', { name: 'Increase value' }).isDisabled(), true)
    assert.equal(await page.getByRole('spinbutton', { name: 'Cart quantity' }).isDisabled(), true)
    await page.getByRole('link', { name: 'العربية', exact: true }).click()
    await page.locator('html[lang="ar"][dir="rtl"]').waitFor()
    await page.getByRole('combobox').selectOption('fr')
    await page.getByRole('button', { name: 'حفظ التفضيل', exact: true }).click()
    await page.waitForURL((url) => url.pathname === routes.home.href({ locale: 'fr' }))
    assert.equal(await page.title(), 'Démo i18n dans Remix')

    await page.getByRole('link', { name: 'Remix i18n', exact: true }).click()
    await page.waitForURL((url) => url.pathname === routes.home.href())
    assert.equal(await page.getByRole('combobox').inputValue(), 'fr')
    await page
      .getByRole('button', { name: 'Effacer la préférence enregistrée', exact: true })
      .click()
    await page.waitForURL((url) => url.pathname === routes.home.href())
    await page.locator('html[lang="en"][dir="ltr"]').waitFor()
    assert.equal(await page.getByRole('combobox').inputValue(), 'en')
  })
})

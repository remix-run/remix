import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { Page } from 'playwright'

import { createTestRouter } from '../test/helpers.ts'
import { db } from './db.ts'
import { users } from './data/schema.ts'

describe('bookstore form submissions', () => {
  it('roundtrips field and form errors through hydrated submissions', async (t) => {
    diagnostic('hydrated router setup start')
    let router = await createTestRouter()
    diagnostic('hydrated router setup done')
    let submissions = 0
    let page = await t.serve(
      await createTestServer((request) => {
        if (request.method === 'POST' && new URL(request.url).pathname === '/register') {
          submissions++
        }
        return router.fetch(request)
      }),
    )
    await registrationFlow(page, true, () => submissions)
  })

  it('roundtrips field and form errors without JavaScript', async (t) => {
    diagnostic('no-JS router setup start')
    let router = await createTestRouter()
    diagnostic('no-JS router setup done')
    let submissions = 0
    let server = await createTestServer((request) => {
      if (request.method === 'POST' && new URL(request.url).pathname === '/register') {
        submissions++
      }
      return router.fetch(request)
    })
    let runtimePage = await t.serve(server)
    let browser = runtimePage.context().browser()
    assert.ok(browser)
    let context = await browser.newContext({ baseURL: server.baseUrl, javaScriptEnabled: false })
    // Release this context's connections before t.serve() cleanup closes the server.
    try {
      await registrationFlow(await context.newPage(), false, () => submissions)
    } finally {
      diagnostic('no-JS context close start')
      await context.close()
      diagnostic('no-JS context close done')
    }
  })
})

async function registrationFlow(
  page: Page,
  javaScriptEnabled: boolean,
  submissionCount: () => number,
): Promise<void> {
  let pageErrors: string[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error.message)
    diagnostic(`page error: ${error.message}`)
  })
  let diagnosticsEnabled = process.env.REMIX_TEST_DIAGNOSTICS === '1'
  if (diagnosticsEnabled) {
    page.on('requestfailed', (request) => {
      diagnostic(
        `request failed: ${request.method()} ${new URL(request.url()).pathname}: ${request.failure()?.errorText}`,
      )
    })
    page.on('crash', () => diagnostic('page crashed'))
    page.on('console', (message) => {
      if (message.text().startsWith('[bookstore-diagnostics]')) diagnostic(message.text())
    })
  }
  let emailAddress = `form-${crypto.randomUUID()}@example.com`
  await page.goto('/register')
  if (javaScriptEnabled) {
    diagnostic('app ready start')
    await page.evaluate(async (diagnosticsEnabled) => {
      let script = document.querySelector<HTMLScriptElement>('script[type="module"][src]')
      if (!script) throw new Error('Missing app entry')
      let { app } = await import(script.src)
      if (diagnosticsEnabled) console.info('[bookstore-diagnostics] app module imported')
      await app.ready()
    }, diagnosticsEnabled)
    diagnostic('app ready done')
  }
  let name = page.getByRole('textbox', { name: 'Name', exact: true })
  let email = page.getByRole('textbox', { name: 'Email', exact: true })
  let password = page.getByLabel('Password', { exact: true })
  let submit = page.getByRole('button', { name: 'Register', exact: true })
  let nativeForm = page.locator('form[action="/register"]')
  await name.fill('Ada')
  await email.fill(emailAddress)
  await password.fill('badpass')
  await password.blur()
  if (javaScriptEnabled) {
    await page.waitForFunction(() => {
      let control = document.querySelector('input[name="password"]')
      return control?.getAttribute('aria-invalid') === 'true'
    })
    assert.ok(await password.getAttribute('aria-describedby'))
    assert.ok((await page.getByRole('alert').textContent())?.trim())
  } else {
    assert.equal(await password.getAttribute('aria-invalid'), null)
    assert.equal(await password.getAttribute('minlength'), '8')
  }
  await submit.click()
  assert.equal(submissionCount(), 0, 'Native validation must block submission')

  // Bypass browser validation to prove the real handler still rejects the same values.
  let rejected = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && new URL(response.url()).pathname === '/register',
  )
  await nativeForm.evaluate((form: HTMLFormElement) => {
    form.noValidate = true
    form.requestSubmit()
  })
  let response = await rejected
  assert.equal(response.status(), 400)
  assert.equal(
    response.request().headers()['x-remix-frame'],
    javaScriptEnabled ? 'true' : undefined,
  )
  assert.ok(!(await response.text()).includes('badpass'), 'Failure HTML must omit the password')
  await page.waitForFunction(() => {
    let control = document.querySelector('input[name="password"]')
    return (
      control instanceof HTMLInputElement &&
      control.value === '' &&
      control.getAttribute('aria-invalid') === 'true'
    )
  })
  assert.equal(await name.inputValue(), 'Ada')
  assert.equal(await email.inputValue(), emailAddress)
  assert.equal(await password.inputValue(), '')
  let errorId = await password.getAttribute('aria-describedby')
  assert.ok(errorId)
  await page.locator(`[id="${errorId}"][role="alert"]`).waitFor()
  assert.ok((await page.locator(`[id="${errorId}"]`).textContent())?.trim())
  assert.equal(await db.findOne(users, { where: { email: emailAddress } }), null)

  await password.fill('valid-password')
  if (javaScriptEnabled) {
    await page.waitForFunction(
      () => !document.querySelector('input[name="password"]')?.hasAttribute('aria-invalid'),
    )
    assert.equal(await password.getAttribute('aria-describedby'), null)
  }
  await submit.click()
  await page.waitForURL((url) => url.pathname === '/account')
  await page.getByRole('heading', { name: 'My Account', exact: true }).waitFor()
  let user = await db.findOne(users, { where: { email: emailAddress } })
  assert.ok(user)
  assert.equal(user.name, 'Ada')
  assert.notEqual(user.password_hash, 'valid-password')
  assert.equal(submissionCount(), 2)

  await page.context().clearCookies()
  await page.goto('/login')
  await email.fill(emailAddress)
  await password.fill('wrong-password')
  let invalidLogin = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && new URL(response.url()).pathname === '/login',
  )
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  let loginResponse = await invalidLogin
  assert.equal(loginResponse.status(), 400)
  assert.ok(!(await loginResponse.text()).includes('wrong-password'))
  await page.getByRole('alert').filter({ hasText: 'Invalid email or password' }).waitFor()
  assert.equal(await email.inputValue(), emailAddress)
  assert.equal(await password.inputValue(), '')
  assert.equal(await email.getAttribute('aria-invalid'), null)
  await password.fill('valid-password')
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/account')
  await page.getByRole('heading', { name: 'My Account', exact: true }).waitFor()
  assert.deepEqual(pageErrors, [])
}

function diagnostic(message: string): void {
  if (process.env.REMIX_TEST_DIAGNOSTICS === '1') {
    console.error(
      `[bookstore-diagnostics ${new Date().toISOString()} pid=${process.pid}] ${message}`,
    )
  }
}

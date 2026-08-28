import * as assert from 'remix/assert'
import { SetCookie } from 'remix/headers/set-cookie'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { Page } from 'playwright'

import { authCookie } from './middleware/auth.ts'
import { router } from './router.ts'
import { routes } from './routes.ts'

declare global {
  interface Window {
    __frameNavigationTestDocument?: string
  }
}

describe('frame navigation', () => {
  it('redirects unauthenticated requests to sign in', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))

    await page.goto(routes.main.index.href())
    await waitForNavigationRuntime(page)
    await page.getByRole('heading', { name: 'Fake login page' }).waitFor()

    assert.equal(new URL(page.url()).pathname, routes.auth.login.index.href())
  })

  it('signs in without reloading the document', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.goto(routes.main.index.href())
    await waitForNavigationRuntime(page)
    let documentMarker = await markDocument(page)

    await page.getByRole('button', { name: 'Set auth cookie' }).click()
    await page.waitForURL((url) => url.pathname === routes.main.index.href())
    await page.getByRole('heading', { name: 'Learning dashboard' }).waitFor()

    assert.equal(new URL(page.url()).pathname, routes.main.index.href())
    await assertDocumentPreserved(page, documentMarker)
  })

  it('navigates without reloading the document and supports back navigation', async (t) => {
    let server = await createTestServer(router.fetch)
    let page = await t.serve(server)
    await setAuthCookie(page, server.baseUrl)
    await page.goto(routes.main.index.href())
    await waitForNavigationRuntime(page)
    let documentMarker = await markDocument(page)

    await page.getByRole('link', { name: 'Courses', exact: true }).click()
    await page.locator('#courses-heading').waitFor()

    assert.equal(new URL(page.url()).pathname, routes.main.courses.href())
    await assertDocumentPreserved(page, documentMarker)

    await page.goBack()
    await page.getByRole('heading', { name: 'Learning dashboard' }).waitFor()

    assert.equal(new URL(page.url()).pathname, routes.main.index.href())
    await assertDocumentPreserved(page, documentMarker)
  })

  it('replaces history when filtering courses', async (t) => {
    let server = await createTestServer(router.fetch)
    let page = await t.serve(server)
    await setAuthCookie(page, server.baseUrl)
    await page.goto(routes.main.index.href())
    await waitForNavigationRuntime(page)
    let documentMarker = await markDocument(page)

    await page.getByRole('link', { name: 'Courses', exact: true }).click()
    await page.locator('#courses-heading').waitFor()
    await page.getByLabel('Filter courses').fill('accessibility')
    await page.getByRole('button', { name: 'Filter', exact: true }).click()
    await page.getByText('1 course matching “accessibility”', { exact: true }).waitFor()

    let filteredUrl = new URL(page.url())
    assert.equal(filteredUrl.pathname, routes.main.courses.href())
    assert.equal(filteredUrl.searchParams.get('q'), 'accessibility')
    await assertDocumentPreserved(page, documentMarker)

    await page.goBack()
    await page.getByRole('heading', { name: 'Learning dashboard' }).waitFor()

    assert.equal(new URL(page.url()).pathname, routes.main.index.href())
    await assertDocumentPreserved(page, documentMarker)
  })

  it('submits a form and follows its redirect without reloading the document', async (t) => {
    let server = await createTestServer(router.fetch)
    let page = await t.serve(server)
    await setAuthCookie(page, server.baseUrl)
    await page.goto(routes.main.index.href())
    await waitForNavigationRuntime(page)
    let documentMarker = await markDocument(page)

    await page.getByRole('link', { name: 'Account', exact: true }).click()
    await page.locator('#account-heading').waitFor()
    await page.getByRole('link', { name: 'Edit', exact: true }).click()
    await page.getByRole('heading', { name: 'Edit account' }).waitFor()

    await page.getByLabel('Display name').fill('Ada Lovelace')
    await page.getByLabel('Program').fill('Computer Science')
    await page.getByLabel('Expected graduation').fill('2028-06')

    let submission = page.waitForRequest(
      (request) =>
        request.method() === 'POST' &&
        new URL(request.url()).pathname === routes.main.account.edit.action.href(),
    )
    await page.getByRole('button', { name: 'Save account' }).click()
    await submission
    await page.getByText('Account saved', { exact: true }).waitFor()

    let url = new URL(page.url())
    assert.equal(url.pathname, routes.main.account.index.href())
    assert.equal(url.searchParams.has('saved'), true)
    assert.equal(await page.getByText('Ada Lovelace', { exact: true }).count(), 1)
    await assertDocumentPreserved(page, documentMarker)
  })

  it('follows a frame redirect without reloading the document', async (t) => {
    let server = await createTestServer(router.fetch)
    let page = await t.serve(server)
    await setAuthCookie(page, server.baseUrl)
    await page.goto(routes.main.index.href())
    await waitForNavigationRuntime(page)
    let documentMarker = await markDocument(page)

    await page.getByRole('link', { name: 'Settings', exact: true }).click()
    await page.waitForURL((url) => url.pathname === routes.settings.overview.href())
    await page.getByRole('heading', { name: 'Settings overview' }).waitFor()

    assert.equal(new URL(page.url()).pathname, routes.settings.overview.href())
    await assertDocumentPreserved(page, documentMarker)
  })

  it('reloads the document when a subframe redirects to sign in', async (t) => {
    let server = await createTestServer(router.fetch)
    let page = await t.serve(server)
    await setAuthCookie(page, server.baseUrl)
    await page.goto(routes.settings.overview.href())
    await waitForNavigationRuntime(page)
    let documentMarker = await markDocument(page)
    await page.context().clearCookies()

    await page.getByRole('link', { name: 'Profile', exact: true }).click()
    await page.getByRole('heading', { name: 'Fake login page' }).waitFor()

    assert.equal(new URL(page.url()).pathname, routes.auth.login.index.href())
    await assertDocumentReplaced(page, documentMarker)
  })
})

async function setAuthCookie(page: Page, baseUrl: string): Promise<void> {
  let cookie = new SetCookie(await authCookie.serialize('1'))
  assert.ok(cookie.name)
  assert.ok(cookie.value)

  await page.context().addCookies([
    {
      name: cookie.name,
      value: cookie.value,
      url: baseUrl,
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite,
      secure: cookie.secure,
    },
  ])
}

async function waitForNavigationRuntime(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    let state = window.navigation.currentEntry?.getState()
    return typeof state === 'object' && state != null && '$rmx' in state
  })
}

async function markDocument(page: Page): Promise<string> {
  return page.evaluate(() => {
    let marker = crypto.randomUUID()
    window.__frameNavigationTestDocument = marker
    return marker
  })
}

async function assertDocumentPreserved(page: Page, marker: string): Promise<void> {
  assert.equal(
    await page.evaluate(() => window.__frameNavigationTestDocument),
    marker,
    'expected frame navigation to preserve the current document',
  )
}

async function assertDocumentReplaced(page: Page, marker: string): Promise<void> {
  assert.notEqual(
    await page.evaluate(() => window.__frameNavigationTestDocument),
    marker,
    'expected document navigation to replace the current document',
  )
}

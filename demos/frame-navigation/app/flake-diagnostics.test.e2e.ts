// Temporary diagnostics for the flaky "replaces history when filtering courses" test. Not for merge.
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
    __diag?: string[]
  }
}

const iterationsPerWorker = 50
const workers = 4

describe('frame navigation flake diagnostics', () => {
  it('filters courses after navigating to Courses', { timeout: 20 * 60_000 }, async (t) => {
    let failures: string[] = []
    await Promise.all(
      Array.from({ length: workers }, async (_, worker) => {
        for (let iteration = 0; iteration < iterationsPerWorker; iteration++) {
          let server = await createTestServer(router.fetch)
          let page = await t.serve(server)
          await setAuthCookie(page, server.baseUrl)
          await page.addInitScript(recordNavigation)
          let failure = await runIteration(page)
          if (failure) failures.push(`worker ${worker} iteration ${iteration}\n${failure}`)
          await page.context().close()
        }
      }),
    )

    assert.equal(
      failures.length,
      0,
      `${failures.length}/${workers * iterationsPerWorker} iterations failed\n\n${failures.join('\n\n')}`,
    )
  })
})

function recordNavigation() {
  let log: string[] = []
  window.__diag = log
  let start = performance.now()
  let record = (message: string) =>
    log.push(`${(performance.now() - start).toFixed(1)}ms ${message}`)
  let entryKey = () => window.navigation.currentEntry?.key.slice(0, 8)
  let id = 0
  window.navigation.addEventListener('navigate', (event) => {
    let n = ++id
    let source = event.sourceElement
    record(
      `navigate#${n} type=${event.navigationType} url=${event.destination.url} source=${source?.tagName ?? '-'} hasInfo=${event.info !== undefined} cancelable=${event.cancelable} entry=${entryKey()}`,
    )
    event.signal.addEventListener('abort', () =>
      record(
        `navigate#${n} aborted reason=${String(event.signal.reason?.name ?? event.signal.reason)}`,
      ),
    )
  })
  window.navigation.addEventListener('navigatesuccess', () =>
    record(`navigatesuccess url=${location.href} entry=${entryKey()}`),
  )
  window.navigation.addEventListener('navigateerror', (event) =>
    record(
      `navigateerror ${String(event.error?.name ?? event.error)}: ${event.error?.message ?? ''}`,
    ),
  )
  window.navigation.addEventListener('currententrychange', (event) =>
    record(
      `currententrychange from=${event.navigationType} url=${location.href} entry=${entryKey()}`,
    ),
  )
  window.addEventListener('error', (event) => record(`window error ${event.message}`))
  window.addEventListener('unhandledrejection', (event) =>
    record(`unhandledrejection ${String(event.reason?.stack ?? event.reason)}`),
  )
  document.addEventListener(
    'submit',
    (event) => record(`submit ${new FormData(event.target as HTMLFormElement).get('q')}`),
    true,
  )
  new MutationObserver(() => {
    let status = document.querySelector('#course-results')?.textContent
    if (status && status !== log.at(-1)?.split(' status=')[1]) record(`status=${status}`)
  }).observe(document, { subtree: true, childList: true, characterData: true })
}

async function runIteration(page: Page): Promise<string | undefined> {
  let requests: string[] = []
  let started = Date.now()
  let stamp = () => `${Date.now() - started}ms`
  page.on('request', (request) => {
    if (!request.url().includes('/assets/'))
      requests.push(
        `${stamp()} request ${request.url()} target=${request.headers()['x-remix-target'] ?? '-'}`,
      )
  })
  page.on('requestfinished', async (request) => {
    if (request.url().includes('/assets/')) return
    let response = await request.response()
    requests.push(`${stamp()} finished ${request.url()} status=${response?.status()}`)
  })
  page.on('requestfailed', (request) =>
    requests.push(`${stamp()} failed ${request.url()} ${request.failure()?.errorText}`),
  )
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning')
      requests.push(`${stamp()} console.${message.type()} ${message.text()}`)
  })
  page.on('pageerror', (error) => requests.push(`${stamp()} pageerror ${error.stack}`))

  await page.goto(routes.main.index.href())
  await waitForNavigationRuntime(page)
  await page.getByRole('link', { name: 'Courses', exact: true }).click()
  await page.locator('#courses-heading').waitFor()
  await page.getByLabel('Filter courses').fill('accessibility')
  requests.push(`${stamp()} filled`)
  await page.getByRole('button', { name: 'Filter', exact: true }).click()
  requests.push(`${stamp()} clicked Filter`)

  let passed = await page
    .getByText('1 course matching “accessibility”', { exact: true })
    .waitFor({ timeout: 10_000 })
    .then(
      () => true,
      () => false,
    )
  if (passed) return

  let state = await page.evaluate(() => ({
    url: location.href,
    status: document.querySelector('#course-results')?.textContent,
    input: document.querySelector<HTMLInputElement>('#course-filter')?.value,
    transition: window.navigation.transition
      ? `${window.navigation.transition.navigationType} from ${window.navigation.transition.from.url}`
      : null,
    entries: window.navigation.entries().map((entry) => entry.url),
    log: window.__diag ?? [],
    coursesFrame: document.querySelector('#courses-heading')?.closest('section')?.outerHTML.length,
  }))
  return [
    `url=${state.url}`,
    `status=${state.status}`,
    `input=${state.input}`,
    `transition=${state.transition}`,
    `entries=${state.entries.join(' | ')}`,
    '-- page log --',
    ...state.log,
    '-- network/console --',
    ...requests,
  ].join('\n')
}

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

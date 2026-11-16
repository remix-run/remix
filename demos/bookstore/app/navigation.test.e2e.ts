import { fileURLToPath } from 'node:url'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { Page } from 'playwright'
import type * as Navigation from './ui/public/navigation.ts'
import type * as Entry from './actions/public/entry.tsx'

import { createTestRouter } from '../test/helpers.ts'
import { assets } from './utils/assets.ts'

type NavigationModule = typeof Navigation
type EntryModule = typeof Entry

const router = await createTestRouter()
const navigationHref = await assets.getHref(
  fileURLToPath(new URL('./ui/public/navigation.ts', import.meta.url)),
)
const entryHref = await assets.getHref(
  fileURLToPath(new URL('./actions/public/entry.tsx', import.meta.url)),
)

async function ready(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.evaluate(async (href) => {
    let { app }: EntryModule = await import(href)
    await app.ready()
  }, entryHref)
}

describe('bookstore navigation', () => {
  it('shows global and link pending UI and preserves one navigation through a redirect', async (t) => {
    let requested = Promise.withResolvers<void>()
    let release = Promise.withResolvers<void>()
    t.after(() => release.resolve())
    let page = await t.serve(
      await createTestServer(async (request) => {
        let pathname = new URL(request.url).pathname
        if (request.headers.has('X-Remix-Frame')) {
          if (pathname === '/about')
            return new Response(null, { status: 302, headers: { Location: '/contact' } })
          if (pathname === '/contact') {
            requested.resolve()
            await release.promise
          }
        }
        return router.fetch(request)
      }),
    )
    await ready(page)
    let changes = await page.evaluateHandle(async (href) => {
      let { navigation }: NavigationModule = await import(href)
      let first: NavigationModule['navigation']['current']
      let changes: Array<{ url?: string; same: boolean }> = []
      navigation.addEventListener('change', () => {
        first ??= navigation.current
        changes.push({ url: navigation.current?.url, same: first === navigation.current })
      })
      return changes
    }, navigationHref)
    let about = page.getByRole('banner').getByRole('link', { name: 'About', exact: true })
    await about.evaluate((anchor: HTMLAnchorElement) => anchor.click())
    await requested.promise
    await page.getByRole('status').filter({ hasText: 'Loading page' }).waitFor()
    await about.locator('.navigation-spinner').waitFor()
    assert.equal(await about.getAttribute('aria-busy'), 'true')
    assert.deepEqual(
      await page.evaluate(async (href) => {
        let { navigation }: NavigationModule = await import(href)
        return {
          supported: navigation.supported,
          type: navigation.current?.type,
          target: navigation.current?.target,
          submission: navigation.current?.submission,
        }
      }, navigationHref),
      { supported: true, type: 'push', target: undefined, submission: undefined },
    )

    release.resolve()
    await page.evaluate(async (href) => {
      let { navigation }: NavigationModule = await import(href)
      await navigation.settled()
    }, navigationHref)
    await page.getByRole('heading', { name: 'Contact Us', exact: true }).waitFor()
    await page.getByRole('status').filter({ hasText: 'Loading page' }).waitFor({ state: 'hidden' })
    assert.deepEqual(
      (await changes.jsonValue()).map((change) => ({
        path: change.url ? new URL(change.url).pathname : null,
        same: change.same,
      })),
      [
        { path: '/about', same: true },
        { path: '/contact', same: true },
        { path: null, same: false },
      ],
    )
  })

  it('reports an external submitter and its form as one pending navigation', async (t) => {
    let requested = Promise.withResolvers<void>()
    let release = Promise.withResolvers<void>()
    t.after(() => release.resolve())
    let page = await t.serve(
      await createTestServer(async (request) => {
        if (request.headers.has('X-Remix-Frame') && new URL(request.url).pathname === '/contact') {
          requested.resolve()
          await release.promise
        }
        return router.fetch(request)
      }),
    )
    await ready(page)
    let changes = await page.evaluateHandle(async (href) => {
      let { navigation }: NavigationModule = await import(href)
      let changes: Array<string | null> = []
      navigation.addEventListener('change', () => changes.push(navigation.current?.url ?? null))
      let form = document.createElement('form')
      form.id = 'pending-form'
      form.action = '/contact'
      let button = document.createElement('button')
      button.setAttribute('form', form.id)
      document.body.append(form, button)
      form.requestSubmit(button)
      return changes
    }, navigationHref)
    await requested.promise
    assert.equal((await changes.jsonValue()).length, 1)
    assert.equal(
      await page.evaluate(async (href) => {
        let { navigation }: NavigationModule = await import(href)
        return navigation.current?.submission?.method
      }, navigationHref),
      'GET',
    )

    release.resolve()
    await page.evaluate(async (href) => {
      let { navigation }: NavigationModule = await import(href)
      await navigation.settled()
    }, navigationHref)
    assert.deepEqual(
      (await changes.jsonValue()).map((url) => (url ? new URL(url).pathname : null)),
      ['/contact', null],
    )
  })

  it('keeps settled waiting when another link replaces a pending navigation', async (t) => {
    let aboutRequested = Promise.withResolvers<void>()
    let contactRequested = Promise.withResolvers<void>()
    let releaseAbout = Promise.withResolvers<void>()
    let releaseContact = Promise.withResolvers<void>()
    t.after(() => {
      releaseAbout.resolve()
      releaseContact.resolve()
    })
    let page = await t.serve(
      await createTestServer(async (request) => {
        let pathname = new URL(request.url).pathname
        if (request.headers.has('X-Remix-Frame') && pathname === '/about') {
          aboutRequested.resolve()
          await releaseAbout.promise
        }
        if (request.headers.has('X-Remix-Frame') && pathname === '/contact') {
          contactRequested.resolve()
          await releaseContact.promise
        }
        return router.fetch(request)
      }),
    )
    await ready(page)
    await page
      .getByRole('banner')
      .getByRole('link', { name: 'About', exact: true })
      .evaluate((anchor: HTMLAnchorElement) => anchor.click())
    await aboutRequested.promise
    let state = await page.evaluateHandle(async (href) => {
      let { navigation }: NavigationModule = await import(href)
      let state = { first: navigation.current, done: false, waiting: Promise.resolve() }
      state.waiting = navigation.settled().then(() => {
        state.done = true
      })
      return state
    }, navigationHref)
    await page
      .getByRole('banner')
      .getByRole('link', { name: 'Contact', exact: true })
      .evaluate((anchor: HTMLAnchorElement) => anchor.click())
    await contactRequested.promise
    assert.deepEqual(
      await state.evaluate((state) => ({ aborted: state.first?.signal.aborted, done: state.done })),
      { aborted: true, done: false },
    )
    releaseAbout.resolve()
    releaseContact.resolve()
    await state.evaluate((state) => state.waiting)
    await page.getByRole('heading', { name: 'Contact Us', exact: true }).waitFor()
    assert.equal(
      await page.evaluate(async (href) => {
        let { navigation }: NavigationModule = await import(href)
        return navigation.current
      }, navigationHref),
      null,
    )
  })

  it('waits for a transition intercepted by other code while current remains null', async (t) => {
    let page = await t.serve(await createTestServer((request) => router.fetch(request)))
    await ready(page)
    let result = await page.evaluate(async (href) => {
      let { navigation }: NavigationModule = await import(href)
      let release = Promise.withResolvers<void>()
      let started = Promise.withResolvers<void>()
      let finished = false
      let waiting: Promise<void> | undefined
      window.navigation.addEventListener(
        'navigate',
        (event) => {
          event.intercept({
            handler() {
              waiting = navigation.settled().then(() => {
                finished = true
              })
              started.resolve()
              return release.promise
            },
          })
        },
        { once: true },
      )
      let transition = window.navigation.navigate('#external-interceptor')
      await started.promise
      let pending = { current: navigation.current, finished }
      release.resolve()
      await transition.finished
      await waiting
      return { pending, finished }
    }, navigationHref)
    assert.deepEqual(result, { pending: { current: null, finished: false }, finished: true })
  })
})

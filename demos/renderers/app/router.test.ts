import * as assert from 'remix/assert'
import { beforeEach, describe, it } from 'remix/test'

import { db, loadAppMigrations, loadAppSeed } from './db.ts'
import { router } from './router.ts'
import { preactEntryHref, reactEntryHref } from './utils/assets.ts'

beforeEach(async () => {
  await db.reset({ migrations: await loadAppMigrations(), seed: await loadAppSeed() })
})

describe('home', () => {
  it('links to each renderer without installing one', async () => {
    let response = await router.fetch(new Request('http://localhost/'))

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Type'), 'text/html; charset=UTF-8')

    let html = await response.text()
    assert.ok(html.includes('href="/preact"'))
    assert.ok(html.includes('href="/react"'))
  })
})

describe('preact renderer', () => {
  it('streams a Preact document as an HTML response', async () => {
    let response = await router.fetch(new Request('http://localhost/preact'))

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Type'), 'text/html; charset=UTF-8')

    let html = await response.text()
    assert.ok(html.startsWith('<!DOCTYPE html><html lang="en">'))
    assert.ok(html.includes('<title>Guestbook · Preact</title>'))
    assert.ok(html.includes('<form method="post" action="/preact/entries"'))
    assert.ok(html.includes('<script id="entry-form-props" type="application/json">'))
    assert.ok(html.includes(`<script type="module" src="${preactEntryHref}">`))
    assert.ok(!html.includes('<script type="importmap">'))
  })

  it('re-renders the form with a 400 status when the entry is invalid', async () => {
    let response = await signGuestbook('/preact/entries', { name: '', message: 'x'.repeat(141) })

    assert.equal(response.status, 400)
    assert.equal(response.headers.get('Content-Type'), 'text/html; charset=UTF-8')

    let html = await response.text()
    assert.ok(html.includes('Please tell us your name.'))
    assert.ok(html.includes('Keep it under 140 characters.'))
  })

  it('escapes serialized props so user input cannot break out of the script tag', async () => {
    let response = await signGuestbook('/preact/entries', { name: '', message: '</script><b>' })

    let html = await response.text()
    assert.ok(!html.includes('"message":"</script>'))
    assert.ok(html.includes('"message":"\\u003c/script>\\u003cb>"'))
  })

  it('adds a valid entry and redirects back to the guestbook', async () => {
    let response = await signGuestbook('/preact/entries', {
      name: 'Linus',
      message: 'Signed from a test.',
    })

    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), '/preact')

    let guestbook = await router.fetch(new Request('http://localhost/preact'))
    let html = await guestbook.text()
    assert.ok(html.includes('Linus'))
    assert.ok(html.includes('Signed from a test.'))
  })

  it('renders a seeded entry from the database', async () => {
    let response = await router.fetch(new Request('http://localhost/preact/entries/2'))

    assert.equal(response.status, 200)

    let html = await response.text()
    assert.ok(html.includes('<h1>Ada</h1>'))
    assert.ok(html.includes('<time datetime="2025-09-03T12:05:00.000Z">'))
  })

  it('renders a Preact page with a 404 status for unknown entries', async () => {
    let missing = await router.fetch(new Request('http://localhost/preact/entries/999'))
    assert.equal(missing.status, 404)
    assert.equal(missing.headers.get('Content-Type'), 'text/html; charset=UTF-8')
    assert.ok((await missing.text()).includes('<h1>Entry not found</h1>'))

    let malformed = await router.fetch(new Request('http://localhost/preact/entries/not-a-number'))
    assert.equal(malformed.status, 404)
  })
})

describe('react renderer', () => {
  it('streams a React document with an import map pinned to the server React version', async () => {
    let response = await router.fetch(new Request('http://localhost/react'))

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Type'), 'text/html; charset=UTF-8')

    let html = await response.text()
    let { version } = await import('react')

    assert.ok(html.startsWith('<!DOCTYPE html><html lang="en">'))
    assert.ok(html.includes('<title>Guestbook · React</title>'))
    assert.ok(html.includes('<form noValidate="" action="/react/entries" method="post">'))
    assert.ok(html.includes(`"react":"https://esm.unpkg.com/react@${version}"`))
    assert.ok(
      html.includes(
        `"react-dom/client":"https://esm.unpkg.com/react-dom@${version}/client?external=react"`,
      ),
    )
    assert.ok(html.includes(`<script type="module" src="${reactEntryHref}">`))
  })

  it('places the import map before the first module script', async () => {
    let response = await router.fetch(new Request('http://localhost/react'))
    let html = await response.text()

    let importMapIndex = html.indexOf('<script type="importmap">')
    let firstModuleIndex = html.search(/<script type="module"|rel="modulepreload"/)

    assert.ok(importMapIndex !== -1)
    assert.ok(importMapIndex < firstModuleIndex)
  })

  it('re-renders the form with a 400 status when the entry is invalid', async () => {
    let response = await signGuestbook('/react/entries', { name: '', message: '' })

    assert.equal(response.status, 400)

    let html = await response.text()
    assert.ok(html.includes('Please tell us your name.'))
    assert.ok(html.includes('Please write a message.'))
  })

  it('adds a valid entry and redirects back to the guestbook', async () => {
    let response = await signGuestbook('/react/entries', { name: 'Grace', message: 'Via React.' })

    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), '/react')

    let guestbook = await router.fetch(new Request('http://localhost/react'))
    assert.ok((await guestbook.text()).includes('Via React.'))
  })

  it('renders a React page with a 404 status for unknown entries', async () => {
    let response = await router.fetch(new Request('http://localhost/react/entries/999'))

    assert.equal(response.status, 404)
    assert.ok((await response.text()).includes('<h1>Entry not found</h1>'))
  })
})

describe('shared database', () => {
  it('shows entries signed through one renderer in the other', async () => {
    await signGuestbook('/react/entries', { name: 'Crossover', message: 'Same rows.' })

    let preact = await router.fetch(new Request('http://localhost/preact'))
    assert.ok((await preact.text()).includes('Crossover'))
  })
})

function signGuestbook(path: string, values: { name: string; message: string }) {
  return router.fetch(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      body: new URLSearchParams(values),
    }),
  )
}

import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createCookieSessionStorage, createMemorySessionStorage } from '@remix-run/session'

import { createRoutes } from '../route-map.ts'
import { createRouter } from '../router.ts'
import { session } from './session.ts'

describe('sessions', () => {
  let getSessionCookie = (r: Response) => r.headers.get('Set-Cookie')?.split(';')[0] || ''

  it('without a middleware, automatically provides a request-scoped session instance', async () => {
    let routes = createRoutes({
      home: '/',
    })

    let router = createRouter({ middleware: [] })

    router.get(routes.home, {
      middleware: [
        (context) => {
          context.session.set('name', 'Remix')
        },
      ],
      handler(context) {
        return new Response(`Home: ${context.session.get('name')}`)
      },
    })

    // No session cookie created if session is unused
    let response = await router.fetch('https://remix.run')
    assert.equal(await response.text(), 'Home: Remix')
    assert.equal(response.headers.has('Set-Cookie'), false)
  })

  it('only sets a cookie header if the session is used', async () => {
    let routes = createRoutes({
      home: '/',
    })

    let router = createRouter({ middleware: [session()] })

    router.get(routes.home, (context) => {
      return new Response(`Home: ${context.session.get('name')}`)
    })

    router.post(routes.home, (context) => {
      context.session.set('name', context.url.searchParams.get('name') ?? 'Remix')
      return new Response(`Home (post): ${context.session.get('name')}`)
    })

    // No session cookie created if session is unused
    let response = await router.fetch('https://remix.run')
    assert.equal(await response.text(), 'Home: undefined')
    assert.equal(response.headers.has('Set-Cookie'), false)

    // Session cookie created when a new session is used
    response = await router.fetch('https://remix.run/', { method: 'POST' })
    assert.equal(await response.text(), 'Home (post): Remix')
    assert.match(response.headers.get('Set-Cookie')!, /HttpOnly;/)
    assert.match(response.headers.get('Set-Cookie')!, /Path=\/;/)
    // Grab the set-cookie header and extract/decode the session to ensure that
    // it is a cookie session that contains the data in the cookie
    let cookie = getSessionCookie(response)
    let parsed = atob(decodeURIComponent(cookie.split('=')[1]))
    assert.deepEqual(parsed, '{"name":"Remix"}')

    // Parses the session from the incoming cookie
    // No updated session cookie on read-only requests
    response = await router.fetch('https://remix.run/', {
      headers: {
        Cookie: cookie,
      },
    })

    assert.equal(await response.text(), 'Home: Remix')
    assert.equal(response.headers.has('Set-Cookie'), false)

    // Parses the session from the incoming cookie
    // Updates session cookie when session is mutated
    response = await router.fetch('https://remix.run/?name=Remix2', {
      method: 'POST',
      headers: {
        Cookie: cookie,
      },
    })
    assert.equal(response.headers.has('Set-Cookie'), true)
    assert.equal(await response.text(), 'Home (post): Remix2')
  })

  it('provides session to middleware and handlers', async () => {
    let routes = createRoutes({
      home: '/',
    })

    let router = createRouter({
      middleware: [
        session({ sessionStorage: createMemorySessionStorage() }),
        (context) => {
          requestLog.push(`middleware: ${context.session.get('name')}`)
        },
      ],
    })

    let requestLog: string[] = []

    router.get(routes.home, (context) => {
      if (context.session.has('name')) {
        requestLog.push(`handler: ${context.session.get('name')}`)
      } else {
        requestLog.push(`setting name Remix`)
        context.session.set('name', 'Remix')
      }

      return new Response('Home')
    })

    // Session creation
    let response = await router.fetch('https://remix.run')

    assert.equal(await response.text(), 'Home')
    assert.deepEqual(requestLog, ['middleware: undefined', 'setting name Remix'])

    // Grab the set-cookie header and extract/decode the session to ensure that
    // it only contains the sessionId proving that this is actually a memory
    // session
    let cookie = response.headers.get('Set-Cookie')?.split(';')[0] || ''
    let sessionId = atob(decodeURIComponent(cookie.split('=')[1]))
    assert.equal(sessionId.length, 8)

    // Session parsing
    response = await router.fetch('https://remix.run', {
      headers: { Cookie: cookie },
    })

    assert.equal(await response.text(), 'Home')
    assert.deepEqual(requestLog, [
      'middleware: undefined',
      'setting name Remix',
      'middleware: Remix',
      'handler: Remix',
    ])
  })

  it('provides the session to the default handler', async () => {
    let routes = createRoutes({
      home: '/',
    })

    let router = createRouter({
      middleware: [session()],
      defaultHandler: (context) => {
        return new Response(`Not Found: ${context.url.pathname} ${context.session.get('name')}`)
      },
    })

    router.post(routes.home, (context) => {
      context.session.set('name', 'Remix')
      return new Response('Home')
    })

    // Session creation
    let response = await router.fetch('https://remix.run', { method: 'POST' })
    assert.equal(await response.text(), 'Home')

    response = await router.fetch('https://remix.run/junk', {
      headers: {
        Cookie: getSessionCookie(response),
      },
    })

    assert.equal(await response.text(), 'Not Found: /junk Remix')
  })

  it('exposes session to route-level middleware', async () => {
    let routes = createRoutes({
      home: '/',
      blog: '/blog',
    })

    let router = createRouter({ middleware: [session()] })

    router.get(routes.home, () => {
      return new Response('Home')
    })

    let requestLog: string[] = []

    let blogMiddleware = (context: any) => {
      requestLog.push(`middleware: ${context.session.get('name')}`)
    }

    router.get(routes.blog, {
      middleware: [blogMiddleware],
      handler(context) {
        if (context.session.has('name')) {
          requestLog.push(`handler: ${context.session.get('name')}`)
        } else {
          requestLog.push(`setting name Remix`)
          context.session.set('name', 'Remix')
        }

        return new Response('Blog')
      },
    })

    // Session creation
    let response = await router.fetch('https://remix.run/blog')
    assert.equal(await response.text(), 'Blog')
    assert.deepEqual(requestLog, ['middleware: undefined', 'setting name Remix'])

    // Session parsing
    response = await router.fetch('https://remix.run/blog', {
      headers: {
        Cookie: response.headers.get('Set-Cookie')?.split(';')[0] || '',
      },
    })
    assert.equal(await response.text(), 'Blog')
    assert.deepEqual(requestLog, [
      'middleware: undefined',
      'setting name Remix',
      'middleware: Remix',
      'handler: Remix',
    ])
  })

  describe('cookie-backed sessions', () => {
    it('does not send a set-cookie header on initial session creation if the session is not used', async () => {
      let routes = createRoutes({
        home: '/',
      })

      let router = createRouter({
        middleware: [session({ sessionStorage: createCookieSessionStorage() })],
      })

      router.get(routes.home, () => {
        return new Response('Home')
      })

      let response = await router.fetch('https://remix.run')
      assert.equal(await response.text(), 'Home')
      assert.equal(response.headers.has('Set-Cookie'), false)
    })

    it('sends a set-cookie header on initial session creation if the session is used', async () => {
      let routes = createRoutes({
        home: '/',
      })

      let router = createRouter({
        middleware: [session({ sessionStorage: createCookieSessionStorage() })],
      })

      router.get(routes.home, (context) => {
        context.session.set('name', 'Remix')
        return new Response('Home')
      })

      let response = await router.fetch('https://remix.run')
      assert.equal(await response.text(), 'Home')
      assert.equal(response.headers.has('Set-Cookie'), true)
    })

    it('does not send a set-cookie header on request that only read from a session', async () => {
      let routes = createRoutes({
        home: '/',
      })

      let router = createRouter({
        middleware: [session({ sessionStorage: createCookieSessionStorage() })],
      })

      router.get(routes.home, () => {
        return new Response('Home')
      })

      let response = await router.fetch('https://remix.run')

      response = await router.fetch('https://remix.run', {
        headers: {
          Cookie: getSessionCookie(response),
        },
      })

      assert.equal(await response.text(), 'Home')
      assert.equal(response.headers.has('Set-Cookie'), false)
    })

    it('sends a set-cookie header if the session data is modified', async () => {
      let routes = createRoutes({
        home: '/',
      })

      let router = createRouter({
        middleware: [session({ sessionStorage: createCookieSessionStorage() })],
      })

      router.get(routes.home, (context) => {
        return new Response('Home:' + (context.session.get('name') ?? ''))
      })

      router.post(routes.home, (context) => {
        context.session.set('name', 'Remix')
        return new Response('Home (post):' + (context.session.get('name') ?? ''))
      })

      let response = await router.fetch('https://remix.run')
      let cookie = getSessionCookie(response)

      response = await router.fetch('https://remix.run', {
        method: 'post',
        body: '',
        headers: {
          Cookie: cookie,
        },
      })

      assert.equal(await response.text(), 'Home (post):Remix')
      assert.equal(response.headers.has('Set-Cookie'), true)
      cookie = getSessionCookie(response)

      // Another GET request - should read from the session but not send back a
      // Set-Cookie header
      response = await router.fetch('https://remix.run', {
        headers: {
          Cookie: cookie,
        },
      })

      assert.equal(await response.text(), 'Home:Remix')
      assert.equal(response.headers.has('Set-Cookie'), false)
    })

    it('sends a set-cookie header if the session is destroyed', async () => {
      let routes = createRoutes({
        home: '/',
        logout: '/logout',
      })

      let router = createRouter({
        middleware: [session({ sessionStorage: createCookieSessionStorage() })],
      })

      router.get(routes.home, (context) => {
        context.session.set('name', 'Remix')
        return new Response('Home')
      })

      router.post(routes.logout, (context) => {
        context.session.destroy()
        return new Response('Logout')
      })

      let response = await router.fetch('https://remix.run')
      assert.equal(response.headers.has('Set-Cookie'), true)
      let cookie = getSessionCookie(response)

      // Another GET request - ensure we're re-using the session
      response = await router.fetch('https://remix.run', {
        headers: {
          Cookie: cookie,
        },
      })
      assert.equal(response.headers.has('Set-Cookie'), true)

      // Logout to destroy the session
      let response5 = await router.fetch('https://remix.run/logout', {
        method: 'post',
        body: '',
        headers: {
          Cookie: cookie,
        },
      })
      assert.equal(await response5.text(), 'Logout')
      assert.equal(response5.headers.has('Set-Cookie'), true)
      let logoutCookie = response5.headers.get('Set-Cookie') || ''
      assert.ok(logoutCookie.includes('Expires=Thu, 01 Jan 1970 00:00:00 GMT'))
    })
  })

  describe('non-cookie-backed-sessions', () => {
    it('does not send a set-cookie header on initial session creation if the session is not used', async () => {
      let routes = createRoutes({
        home: '/',
      })

      let router = createRouter({
        middleware: [session({ sessionStorage: createMemorySessionStorage() })],
      })

      router.get(routes.home, () => {
        return new Response('Home')
      })

      let response = await router.fetch('https://remix.run')
      assert.equal(await response.text(), 'Home')
      assert.equal(response.headers.has('Set-Cookie'), false)
    })

    it('sends a set-cookie header on initial session creation if the session is used', async () => {
      let routes = createRoutes({
        home: '/',
      })

      let router = createRouter({
        middleware: [session({ sessionStorage: createMemorySessionStorage() })],
      })

      router.get(routes.home, (context) => {
        context.session.set('name', 'Remix')
        return new Response('Home')
      })

      let response = await router.fetch('https://remix.run')
      assert.equal(await response.text(), 'Home')
      assert.equal(response.headers.has('Set-Cookie'), true)
    })

    it('does not send a set-cookie header on request that only read from a session', async () => {
      let routes = createRoutes({
        home: '/',
      })

      let router = createRouter({
        middleware: [session({ sessionStorage: createMemorySessionStorage() })],
      })

      router.get(routes.home, () => {
        return new Response('Home')
      })

      let response = await router.fetch('https://remix.run')

      response = await router.fetch('https://remix.run', {
        headers: {
          Cookie: getSessionCookie(response),
        },
      })

      assert.equal(await response.text(), 'Home')
      assert.equal(response.headers.has('Set-Cookie'), false)
    })

    it('does not send a set-cookie header if the session data is modified', async () => {
      let routes = createRoutes({
        home: '/',
      })

      let router = createRouter({
        middleware: [session({ sessionStorage: createMemorySessionStorage() })],
      })

      router.get(routes.home, (context) => {
        return new Response('Home:' + (context.session.get('name') ?? ''))
      })

      router.post(routes.home, (context) => {
        context.session.set('name', 'Remix')
        return new Response('Home (post):' + (context.session.get('name') ?? ''))
      })

      let response = await router.fetch('https://remix.run')
      assert.equal(await response.text(), 'Home:')
      assert.equal(response.headers.has('Set-Cookie'), false)

      response = await router.fetch('https://remix.run', {
        method: 'post',
        body: '',
      })

      assert.equal(await response.text(), 'Home (post):Remix')
      assert.equal(response.headers.has('Set-Cookie'), true)

      // Another GET request - should read from the session but not send back a
      // Set-Cookie header
      response = await router.fetch('https://remix.run', {
        headers: {
          Cookie: getSessionCookie(response),
        },
      })

      assert.equal(await response.text(), 'Home:Remix')
      assert.equal(response.headers.has('Set-Cookie'), false)
    })

    it('sends a set-cookie header if the session is destroyed', async () => {
      let routes = createRoutes({
        home: '/',
        logout: '/logout',
      })

      let router = createRouter({
        middleware: [session({ sessionStorage: createMemorySessionStorage() })],
      })

      router.get(routes.home, (context) => {
        context.session.set('name', 'Remix')
        return new Response('Home')
      })

      router.post(routes.logout, (context) => {
        context.session.destroy()
        return new Response('Logout')
      })

      let response = await router.fetch('https://remix.run')
      assert.equal(response.headers.has('Set-Cookie'), true)
      let cookie = getSessionCookie(response)

      // Another GET request - ensure we're re-using the session
      response = await router.fetch('https://remix.run', {
        headers: {
          Cookie: cookie,
        },
      })
      assert.equal(response.headers.has('Set-Cookie'), false)

      // Logout to destroy the session
      let response5 = await router.fetch('https://remix.run/logout', {
        method: 'post',
        body: '',
        headers: {
          Cookie: cookie,
        },
      })
      assert.equal(await response5.text(), 'Logout')
      assert.equal(response5.headers.has('Set-Cookie'), true)
      let logoutCookie = response5.headers.get('Set-Cookie') || ''
      assert.ok(logoutCookie.includes('Expires=Thu, 01 Jan 1970 00:00:00 GMT'))
    })
  })
})

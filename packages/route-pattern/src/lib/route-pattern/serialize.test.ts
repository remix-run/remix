import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { parsePattern } from './parse.ts'
import { getRoutePatternParts } from '../route-pattern.ts'
import {
  serializeHostname,
  serializePathname,
  serializePattern,
  serializePatternParts,
  serializePort,
  serializeProtocol,
  serializeSearch,
} from './serialize.ts'

function partsOf(source: string) {
  return getRoutePatternParts(parsePattern(source))
}

describe('serializePattern', () => {
  function assertRoundTrip(source: string, expected?: string) {
    assert.equal(serializePattern(partsOf(source)), expected ?? source)
  }

  it('reconstructs pathname only', () => {
    assertRoundTrip('/posts/:id')
    assertRoundTrip('posts/:id', '/posts/:id')
    assertRoundTrip('/posts(/:id)')
    assertRoundTrip('/', '/')
    assertRoundTrip('', '/')
  })

  it('reconstructs hostname only', () => {
    assertRoundTrip('://example.com', '://example.com/')
    assertRoundTrip('://:host', '://:host/')
  })

  it('reconstructs port', () => {
    assertRoundTrip('://example.com:8000', '://example.com:8000/')
    assertRoundTrip('://:host:8080', '://:host:8080/')
  })

  it('reconstructs protocol', () => {
    assertRoundTrip('http://', 'http:///')
    assertRoundTrip('https://', 'https:///')
    assertRoundTrip('http(s)://', 'http(s):///')
  })

  it('reconstructs protocol + hostname + pathname', () => {
    assertRoundTrip('https://example.com/about')
    assertRoundTrip('http://example.com/products/:id')
    assertRoundTrip('http(s)://*host/path')
  })

  it('reconstructs search', () => {
    assertRoundTrip('/?q', '/?q=')
    assertRoundTrip('/?q=1')
    assertRoundTrip('/?q=1&q=2')
  })
})

describe('serializeProtocol', () => {
  function protocolOf(source: string) {
    return serializeProtocol(partsOf(source))
  }

  it('returns protocol or empty string', () => {
    assert.equal(protocolOf('http://example.com'), 'http')
    assert.equal(protocolOf('https://example.com'), 'https')
    assert.equal(protocolOf('http(s)://example.com'), 'http(s)')
    assert.equal(protocolOf('/pathname'), '')
    assert.equal(protocolOf('://example.com'), '')
  })
})

describe('serializeHostname', () => {
  function hostnameOf(source: string) {
    return serializeHostname(partsOf(source))
  }

  it('returns hostname or empty string', () => {
    assert.equal(hostnameOf('://example.com'), 'example.com')
    assert.equal(hostnameOf('://:host'), ':host')
    assert.equal(hostnameOf('://api.example.com'), 'api.example.com')
    assert.equal(hostnameOf('/pathname'), '')
    assert.equal(hostnameOf('http://'), '')
  })

  it('preserves hostname structure', () => {
    assert.equal(hostnameOf('://:tenant.example.com'), ':tenant.example.com')
  })

  it('escapes special chars in hostname text', () => {
    let pattern = 'a\\:b.c\\*d.e\\(f\\).g\\\\h'
    assert.equal(hostnameOf(`://${pattern}`), pattern)
  })
})

describe('serializePort', () => {
  function portOf(source: string) {
    return serializePort(partsOf(source))
  }

  it('returns port or empty string', () => {
    assert.equal(portOf('://example.com:8000'), '8000')
    assert.equal(portOf('://example.com:3000'), '3000')
    assert.equal(portOf('://example.com'), '')
    assert.equal(portOf('/pathname'), '')
  })
})

describe('serializePathname', () => {
  function pathnameOf(source: string) {
    return serializePathname(partsOf(source))
  }

  it('returns pathname or empty string', () => {
    assert.equal(pathnameOf('/posts/:id'), 'posts/:id')
    assert.equal(pathnameOf('posts/:id'), 'posts/:id')
    assert.equal(pathnameOf('/posts(/:id)'), 'posts(/:id)')
    assert.equal(pathnameOf('://example.com'), '')
    assert.equal(pathnameOf('/'), '')
    assert.equal(pathnameOf(''), '')
  })

  it('preserves pathname structure', () => {
    assert.equal(pathnameOf('api/(v:major(.:minor)/)run'), 'api/(v:major(.:minor)/)run')
    assert.equal(
      pathnameOf('*/node_modules/(*path/):package/dist/index.:ext'),
      '*/node_modules/(*path/):package/dist/index.:ext',
    )
  })

  it('emits nameless wildcard as bare *', () => {
    assert.equal(pathnameOf('*'), '*')
  })

  it('escapes special chars in pathname text', () => {
    let pattern = 'a\\:b/c\\*d/e\\(f\\)/g\\\\h'
    assert.equal(pathnameOf(`/${pattern}`), pattern)
  })
})

describe('serializeSearch', () => {
  function searchOf(source: string) {
    return serializeSearch(partsOf(source))
  }

  it('returns search or empty string', () => {
    assert.equal(searchOf('?q'), 'q=')
    assert.equal(searchOf('?q='), 'q=')
    assert.equal(searchOf('?q=1'), 'q=1')
    assert.equal(searchOf('?q=1&q=2'), 'q=1&q=2')
    assert.equal(searchOf('/posts?filter'), 'filter=')
    assert.equal(searchOf('/posts?sort=asc'), 'sort=asc')
    assert.equal(searchOf('/posts'), '')
    assert.equal(searchOf(''), '')
  })
})

describe('serializePatternParts', () => {
  it('returns each helper as a single object', () => {
    assert.deepEqual(
      serializePatternParts(partsOf('https://api.example.com:8000/v1/:resource?filter=active')),
      {
        protocol: 'https',
        hostname: 'api.example.com',
        port: '8000',
        pathname: 'v1/:resource',
        search: 'filter=active',
      },
    )
  })
})

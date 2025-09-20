import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { Assert, IsEqual } from '../type-utils.d.ts'
import { splitStrings } from './split.ts'
import type { Split } from './split.ts'

describe('split', () => {
  it('parses empty string', () => {
    assert.deepEqual(splitStrings(''), {
      protocol: undefined,
      hostname: undefined,
      port: undefined,
      pathname: undefined,
      search: undefined,
    })
  })

  it('parses complex URL', () => {
    assert.deepEqual(
      splitStrings('http(s)://(*host.:sub.)remix.run:8080/products(/:id/v:version)/*?q=1'),
      {
        protocol: 'http(s)',
        hostname: '(*host.:sub.)remix.run',
        port: '8080',
        pathname: 'products(/:id/v:version)/*',
        search: 'q=1',
      },
    )
  })

  // protocol + ...
  it('parses protocol and hostname', () => {
    assert.deepEqual(splitStrings('http://host.com'), {
      protocol: 'http',
      hostname: 'host.com',
      port: undefined,
      pathname: undefined,
      search: undefined,
    })
  })

  it('parses protocol and hostname with port', () => {
    assert.deepEqual(splitStrings('http://host.com:8080'), {
      protocol: 'http',
      hostname: 'host.com',
      port: '8080',
      pathname: undefined,
      search: undefined,
    })
  })

  it('parses protocol and hostname with pathname', () => {
    assert.deepEqual(splitStrings('http://host.com/path/:id'), {
      protocol: 'http',
      hostname: 'host.com',
      port: undefined,
      pathname: 'path/:id',
      search: undefined,
    })
  })

  it('parses protocol and hostname with port and pathname', () => {
    assert.deepEqual(splitStrings('http://host.com:8080/path/:id'), {
      protocol: 'http',
      hostname: 'host.com',
      port: '8080',
      pathname: 'path/:id',
      search: undefined,
    })
  })

  it('parses protocol and hostname with search', () => {
    assert.deepEqual(splitStrings('http://host.com?q=1'), {
      protocol: 'http',
      hostname: 'host.com',
      port: undefined,
      pathname: undefined,
      search: 'q=1',
    })
  })

  it('parses protocol and hostname with pathname and search', () => {
    assert.deepEqual(splitStrings('http://host.com/path/:id?q=1'), {
      protocol: 'http',
      hostname: 'host.com',
      port: undefined,
      pathname: 'path/:id',
      search: 'q=1',
    })
  })

  // hostname + ...
  it('parses hostname only', () => {
    assert.deepEqual(splitStrings('://host.com'), {
      protocol: undefined,
      hostname: 'host.com',
      port: undefined,
      pathname: undefined,
      search: undefined,
    })
  })

  it('parses hostname with port', () => {
    assert.deepEqual(splitStrings('://host.com:3000'), {
      protocol: undefined,
      hostname: 'host.com',
      port: '3000',
      pathname: undefined,
      search: undefined,
    })
  })

  it('parses hostname with pathname', () => {
    assert.deepEqual(splitStrings('://host.com/path/:id'), {
      protocol: undefined,
      hostname: 'host.com',
      port: undefined,
      pathname: 'path/:id',
      search: undefined,
    })
  })

  it('parses hostname with port and pathname', () => {
    assert.deepEqual(splitStrings('://host.com:3000/path/:id'), {
      protocol: undefined,
      hostname: 'host.com',
      port: '3000',
      pathname: 'path/:id',
      search: undefined,
    })
  })

  it('parses hostname with search', () => {
    assert.deepEqual(splitStrings('://host.com?q=1'), {
      protocol: undefined,
      hostname: 'host.com',
      port: undefined,
      pathname: undefined,
      search: 'q=1',
    })
  })

  it('parses hostname with pathname and search', () => {
    assert.deepEqual(splitStrings('://host.com/path/:id?q=1'), {
      protocol: undefined,
      hostname: 'host.com',
      port: undefined,
      pathname: 'path/:id',
      search: 'q=1',
    })
  })

  // pathname + ...
  it('parses pathname only', () => {
    assert.deepEqual(splitStrings('path/:id'), {
      protocol: undefined,
      hostname: undefined,
      port: undefined,
      pathname: 'path/:id',
      search: undefined,
    })
  })

  it('parses pathname with search', () => {
    assert.deepEqual(splitStrings('path/:id?q=1'), {
      protocol: undefined,
      hostname: undefined,
      port: undefined,
      pathname: 'path/:id',
      search: 'q=1',
    })
  })

  it('parses pathname with leading slash', () => {
    assert.deepEqual(splitStrings('/path/:id'), {
      protocol: undefined,
      hostname: undefined,
      port: undefined,
      pathname: 'path/:id',
      search: undefined,
    })
  })

  // search + ...
  it('parses search only', () => {
    assert.deepEqual(splitStrings('?q=1'), {
      protocol: undefined,
      hostname: undefined,
      port: undefined,
      pathname: undefined,
      search: 'q=1',
    })
  })

  it('parses pathname with leading slash and search', () => {
    assert.deepEqual(splitStrings('/path/:id?q=1'), {
      protocol: undefined,
      hostname: undefined,
      port: undefined,
      pathname: 'path/:id',
      search: 'q=1',
    })
  })
})

// prettier-ignore
export type Tests = [
  // empty string
  Assert<IsEqual<
    Split<''>,
    { protocol: undefined; hostname: undefined; port: undefined; pathname: undefined; search: undefined }
  >>,

  // complex URL
  Assert<IsEqual<
    Split<'http(s)://(*host.:sub.)remix.run:8080/products(/:id/v:version)/*?q=1'>,
    { protocol: 'http(s)'; hostname: '(*host.:sub.)remix.run'; port: '8080'; pathname: 'products(/:id/v:version)/*'; search: 'q=1' }
  >>,

  // protocol + ...
  Assert<IsEqual<
    Split<'http://host.com'>,
    { protocol: 'http'; hostname: 'host.com'; port: undefined; pathname: undefined; search: undefined }
  >>,
  Assert<IsEqual<
    Split<'http://host.com:8080'>,
    { protocol: 'http'; hostname: 'host.com'; port: '8080'; pathname: undefined; search: undefined }
  >>,
  Assert<IsEqual<
    Split<'http://host.com/path/:id'>,
    { protocol: 'http'; hostname: 'host.com'; port: undefined; pathname: 'path/:id'; search: undefined }
  >>,
  Assert<IsEqual<
    Split<'http://host.com:8080/path/:id'>,
    { protocol: 'http'; hostname: 'host.com'; port: '8080'; pathname: 'path/:id'; search: undefined }
  >>,
  Assert<IsEqual<
    Split<'http://host.com?q=1'>,
    { protocol: 'http'; hostname: 'host.com'; port: undefined; pathname: undefined; search: 'q=1' }
  >>,
  Assert<IsEqual<
    Split<'http://host.com/path/:id?q=1'>,
    { protocol: 'http'; hostname: 'host.com'; port: undefined; pathname: 'path/:id'; search: 'q=1' }
  >>,

  // hostname + ...
  Assert<IsEqual<
    Split<'://host.com'>,
    { protocol: undefined; hostname: 'host.com'; port: undefined; pathname: undefined; search: undefined }
  >>,
  Assert<IsEqual<
    Split<'://host.com:3000'>,
    { protocol: undefined; hostname: 'host.com'; port: '3000'; pathname: undefined; search: undefined }
  >>,
  Assert<IsEqual<
    Split<'://host.com/path/:id'>,
    { protocol: undefined; hostname: 'host.com'; port: undefined; pathname: 'path/:id'; search: undefined }
  >>,
  Assert<IsEqual<
    Split<'://host.com:3000/path/:id'>,
    { protocol: undefined; hostname: 'host.com'; port: '3000'; pathname: 'path/:id'; search: undefined }
  >>,
  Assert<IsEqual<
    Split<'://host.com?q=1'>,
    { protocol: undefined; hostname: 'host.com'; port: undefined; pathname: undefined; search: 'q=1' }
  >>,
  Assert<IsEqual<
    Split<'://host.com/path/:id?q=1'>,
    { protocol: undefined; hostname: 'host.com'; port: undefined; pathname: 'path/:id'; search: 'q=1' }
  >>,

  // pathname + ...
  Assert<IsEqual<
    Split<'path/:id'>,
    { protocol: undefined; hostname: undefined; port: undefined; pathname: 'path/:id'; search: undefined }
  >>,
  Assert<IsEqual<
    Split<'path/:id?q=1'>,
    { protocol: undefined; hostname: undefined; port: undefined; pathname: 'path/:id'; search: 'q=1' }
  >>,
  Assert<IsEqual<
    Split<'/path/:id'>,
    { protocol: undefined; hostname: undefined; port: undefined; pathname: 'path/:id'; search: undefined }
  >>,

  // search + ...
  Assert<IsEqual<
    Split<'?q=1'>,
    { protocol: undefined; hostname: undefined; port: undefined; pathname: undefined; search: 'q=1' }
  >>,
  Assert<IsEqual<
    Split<'/path/:id?q=1'>,
    { protocol: undefined; hostname: undefined; port: undefined; pathname: 'path/:id'; search: 'q=1' }
  >>,
]

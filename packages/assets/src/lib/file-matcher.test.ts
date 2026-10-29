import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createFileMatcher } from './file-matcher.ts'

describe('createFileMatcher', () => {
  it('matches files under a root directory whose name contains parentheses', () => {
    let matcher = createFileMatcher('app/**/public/**', '/srv/app (copy)')

    assert.equal(matcher('/srv/app (copy)/app/actions/public/entry.ts'), true)
    // The `(copy)` group must not be treated as glob syntax that also
    // matches the same path without the parentheses.
    assert.equal(matcher('/srv/app copy/app/actions/public/entry.ts'), false)
  })

  it('matches files under a root directory whose name contains brackets', () => {
    let matcher = createFileMatcher('app/**', '/srv/with [brackets]')

    assert.equal(matcher('/srv/with [brackets]/app/entry.ts'), true)
    assert.equal(matcher('/srv/with b/app/entry.ts'), false)
  })

  it('matches files under a root directory whose name contains braces', () => {
    let matcher = createFileMatcher('app/**', '/srv/with {braces}')

    assert.equal(matcher('/srv/with {braces}/app/entry.ts'), true)
    assert.equal(matcher('/srv/with braces/app/entry.ts'), false)
  })

  it('keeps glob syntax in the pattern itself working', () => {
    let matcher = createFileMatcher('app/[ab]/*.ts', '/srv/app (copy)')

    assert.equal(matcher('/srv/app (copy)/app/a/entry.ts'), true)
    assert.equal(matcher('/srv/app (copy)/app/c/entry.ts'), false)
    assert.equal(matcher('/srv/app (copy)/app/a/entry.js'), false)
  })

  it('matches glob patterns under a plain root directory', () => {
    let matcher = createFileMatcher('app/**/*.ts', '/srv/plain')

    assert.equal(matcher('/srv/plain/app/entry.ts'), true)
    assert.equal(matcher('/srv/plain/app/entry.js'), false)
  })

  it('uses absolute patterns verbatim, including their glob syntax', () => {
    let matcher = createFileMatcher('/srv/app (copy)/app/**', '/elsewhere')

    assert.equal(matcher('/srv/app copy/app/entry.ts'), true)
    assert.equal(matcher('/srv/app (copy)/app/entry.ts'), false)
  })

  it('still matches patterns that resolve outside the root directory', () => {
    let matcher = createFileMatcher('../shared/**', '/srv/app (copy)')

    assert.equal(matcher('/srv/shared/entry.ts'), true)
    assert.equal(matcher('/srv/app (copy)/app/entry.ts'), false)
  })
})

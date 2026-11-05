import * as path from 'node:path'
import * as process from 'node:process'
import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { getDisplayPath } from './display-path.ts'

describe('getDisplayPath', () => {
  it('returns a dot for the cwd itself', () => {
    let cwd = path.resolve('project')

    assert.equal(getDisplayPath(cwd, cwd), '.')
  })

  it('returns paths inside the cwd relative to it', () => {
    let cwd = path.resolve('project')

    assert.equal(getDisplayPath(path.join(cwd, 'apps', 'my-app'), cwd), path.join('apps', 'my-app'))
  })

  it('returns paths outside the cwd relative to it', () => {
    let cwd = path.resolve('project')

    assert.equal(
      getDisplayPath(path.resolve('other', 'my-app'), cwd),
      path.join('..', 'other', 'my-app'),
    )
  })

  it('resolves relative inputs against the process cwd', () => {
    assert.equal(getDisplayPath('my-app', process.cwd()), 'my-app')
    assert.equal(getDisplayPath(path.join(process.cwd(), 'my-app')), 'my-app')
  })
})

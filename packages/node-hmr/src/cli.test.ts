import * as path from 'node:path'
import { pathToFileURL } from 'node:url'

import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { buildNodeArgs } from './cli.ts'
import { shouldIgnoreWatchPath } from './lib/cli-args.ts'

describe('buildNodeArgs', () => {
  it('preloads the node-hmr register hook after explicit child node options', () => {
    let entryPath = path.resolve('app/server.ts')
    let registerPath = path.resolve('app/register.ts')

    let args = buildNodeArgs({
      browserEventUrl: 'http://127.0.0.1:1234/hmr',
      entry: entryPath,
      entryArgs: ['--debug'],
      nodeArgs: ['--import', 'remix/node-tsx', '--enable-source-maps'],
      registerPath,
      rootPath: path.resolve('app'),
    })

    let registerUrl = pathToFileURL(registerPath)
    registerUrl.searchParams.set('browserEventUrl', 'http://127.0.0.1:1234/hmr')
    registerUrl.searchParams.set('rootPath', path.resolve('app'))

    assert.deepEqual(args, [
      '--import',
      'remix/node-tsx',
      '--enable-source-maps',
      '--import',
      registerUrl.href,
      entryPath,
      '--debug',
    ])
  })

  it('omits the browser event channel URL when browser events are disabled', () => {
    let registerPath = path.resolve('app/register.ts')
    let args = buildNodeArgs({
      entry: 'server.ts',
      entryArgs: [],
      nodeArgs: [],
      registerPath,
      rootPath: path.resolve('app'),
    })

    let registerUrl = pathToFileURL(registerPath)
    registerUrl.searchParams.set('rootPath', path.resolve('app'))

    assert.deepEqual(args, ['--import', registerUrl.href, 'server.ts'])
  })
})

describe('shouldIgnoreWatchPath', () => {
  it('ignores dependency and build output directories', () => {
    assert.equal(shouldIgnoreWatchPath('node_modules/pkg/index.js'), true)
    assert.equal(shouldIgnoreWatchPath('dist/server.js'), true)
  })

  it('does not ignore application source files', () => {
    assert.equal(shouldIgnoreWatchPath('app/router.ts'), false)
  })
})

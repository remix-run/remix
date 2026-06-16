import * as path from 'node:path'
import { pathToFileURL } from 'node:url'

import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { buildChildProcessArgs, resolveChokidarWatchOptions } from './runner.ts'

describe('buildChildProcessArgs', () => {
  it('preloads the node-hmr register hook after explicit child node options', () => {
    let entryPath = path.resolve('app/server.ts')
    let registerPath = path.resolve('app/register.ts')

    let args = buildChildProcessArgs({
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
    let args = buildChildProcessArgs({
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

describe('resolveChokidarWatchOptions', () => {
  it('uses graph-scoped watch defaults', () => {
    assert.deepEqual(resolveChokidarWatchOptions(), {
      awaitWriteFinish: {
        pollInterval: 10,
        stabilityThreshold: 10,
      },
      depth: 0,
      ignorePermissionErrors: true,
      ignored: ['**/.git/**'],
      ignoreInitial: true,
      interval: 100,
      usePolling: process.platform === 'win32',
    })
  })

  it('applies custom watch options', () => {
    assert.deepEqual(
      resolveChokidarWatchOptions({
        ignore: ['**/node_modules/**', '**/dist/**'],
        poll: true,
        pollInterval: 250,
      }),
      {
        awaitWriteFinish: {
          pollInterval: 10,
          stabilityThreshold: 10,
        },
        depth: 0,
        ignorePermissionErrors: true,
        ignored: ['**/.git/**', '**/node_modules/**', '**/dist/**'],
        ignoreInitial: true,
        interval: 250,
        usePolling: true,
      },
    )
  })
})

import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import * as path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

import { buildNodeArgs, parseNodeHmrCommand, shouldIgnoreWatchPath } from './cli.ts'
import { getNodeHmrEndpoint, getNodeHmrEventUrl } from './index.ts'

describe('parseNodeHmrCommand', () => {
  it('parses an entry and entry arguments', () => {
    let result = parseNodeHmrCommand(['server.ts', '--port', '3000'])

    assert.deepEqual(result, {
      command: {
        entry: 'server.ts',
        entryArgs: ['--port', '3000'],
        host: '127.0.0.1',
        port: 0,
      },
      help: false,
    })
  })

  it('parses HMR endpoint options before the entry', () => {
    let result = parseNodeHmrCommand([
      '--hmr-host',
      '0.0.0.0',
      '--hmr-port=12345',
      'server.ts',
      '--port',
      '3000',
    ])

    assert.deepEqual(result, {
      command: {
        entry: 'server.ts',
        entryArgs: ['--port', '3000'],
        host: '0.0.0.0',
        port: 12345,
      },
      help: false,
    })
  })

  it('rejects invalid HMR ports', () => {
    assert.throws(() => parseNodeHmrCommand(['--hmr-port', '70000', 'server.ts']), {
      message: 'Invalid HMR port: 70000',
    })
  })

  it('detects help flags', () => {
    let result = parseNodeHmrCommand(['--help'])

    assert.deepEqual(result, { help: true })
  })
})

describe('buildNodeArgs', () => {
  it('preloads node-tsx and the node-hmr register hook', () => {
    let entryPath = path.resolve('app/server.ts')
    let nodeTsxImportUrl = pathToFileURL(path.resolve('packages/node-tsx/src/index.ts')).href
    let registerPath = path.resolve('app/register.ts')

    let args = buildNodeArgs({
      entry: entryPath,
      entryArgs: ['--debug'],
      nodeTsxImportUrl,
      registerPath,
    })

    assert.deepEqual(args, [
      '--import',
      nodeTsxImportUrl,
      '--import',
      pathToFileURL(registerPath).href,
      entryPath,
      '--debug',
    ])
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

describe('node HMR browser endpoint helpers', () => {
  it('returns undefined outside the node HMR child process', () => {
    let originalEventUrl = process.env.REMIX_NODE_HMR_EVENT_URL
    try {
      delete process.env.REMIX_NODE_HMR_EVENT_URL

      assert.equal(getNodeHmrEventUrl(), undefined)
      assert.equal(getNodeHmrEndpoint(), undefined)
    } finally {
      if (originalEventUrl === undefined) {
        delete process.env.REMIX_NODE_HMR_EVENT_URL
      } else {
        process.env.REMIX_NODE_HMR_EVENT_URL = originalEventUrl
      }
    }
  })

  it('describes the parent browser HMR endpoint from env', () => {
    let originalEventUrl = process.env.REMIX_NODE_HMR_EVENT_URL
    try {
      process.env.REMIX_NODE_HMR_EVENT_URL = 'http://127.0.0.1:4567/hmr'

      assert.equal(getNodeHmrEventUrl(), 'http://127.0.0.1:4567/hmr')
      assert.deepEqual(getNodeHmrEndpoint(), {
        hostname: '127.0.0.1',
        pathname: '/hmr',
        port: 4567,
        url: 'http://127.0.0.1:4567/hmr',
      })
    } finally {
      if (originalEventUrl === undefined) {
        delete process.env.REMIX_NODE_HMR_EVENT_URL
      } else {
        process.env.REMIX_NODE_HMR_EVENT_URL = originalEventUrl
      }
    }
  })
})

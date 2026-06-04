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
        nodeArgs: [],
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
        nodeArgs: [],
        port: 12345,
      },
      help: false,
    })
  })

  it('forwards node options before the entry', () => {
    let result = parseNodeHmrCommand([
      '--import',
      'remix/node-tsx',
      '--enable-source-maps',
      '--conditions=development',
      'server.ts',
      '--port',
      '3000',
    ])

    assert.deepEqual(result, {
      command: {
        entry: 'server.ts',
        entryArgs: ['--port', '3000'],
        host: '127.0.0.1',
        nodeArgs: [
          '--import',
          'remix/node-tsx',
          '--enable-source-maps',
          '--conditions=development',
        ],
        port: 0,
      },
      help: false,
    })
  })

  it('uses -- to separate node options from entries that start with a dash', () => {
    let result = parseNodeHmrCommand(['--inspect', '--', '--entry.ts', '--debug'])

    assert.deepEqual(result, {
      command: {
        entry: '--entry.ts',
        entryArgs: ['--debug'],
        host: '127.0.0.1',
        nodeArgs: ['--inspect'],
        port: 0,
      },
      help: false,
    })
  })

  it('rejects invalid HMR ports', () => {
    assert.throws(() => parseNodeHmrCommand(['--hmr-port', '70000', 'server.ts']), {
      message: 'Invalid HMR port: 70000',
    })
  })

  it('rejects unsupported node execution modes', () => {
    assert.throws(() => parseNodeHmrCommand(['--watch', 'server.ts']), {
      message: 'Node option --watch is not supported by node-hmr',
    })
    assert.throws(() => parseNodeHmrCommand(['--watch-path=app', 'server.ts']), {
      message: 'Node option --watch-path is not supported by node-hmr',
    })
    assert.throws(() => parseNodeHmrCommand(['--test', 'server.ts']), {
      message: 'Node option --test is not supported by node-hmr',
    })
    assert.throws(() => parseNodeHmrCommand(['--test-reporter', 'spec', 'server.ts']), {
      message: 'Node option --test-reporter is not supported by node-hmr',
    })
    assert.throws(() => parseNodeHmrCommand(['--eval', 'console.log(1)']), {
      message: 'Node option --eval is not supported by node-hmr',
    })
  })

  it('rejects node options that are missing required values', () => {
    assert.throws(() => parseNodeHmrCommand(['--import']), {
      message: 'Missing value for Node option: --import',
    })
  })

  it('detects help flags', () => {
    let result = parseNodeHmrCommand(['--help'])

    assert.deepEqual(result, { help: true })
  })
})

describe('buildNodeArgs', () => {
  it('forwards node options and preloads the node-hmr register hook', () => {
    let entryPath = path.resolve('app/server.ts')
    let registerPath = path.resolve('app/register.ts')

    let args = buildNodeArgs({
      entry: entryPath,
      entryArgs: ['--debug'],
      nodeArgs: ['--import', 'remix/node-tsx', '--enable-source-maps'],
      registerPath,
    })

    assert.deepEqual(args, [
      '--import',
      'remix/node-tsx',
      '--enable-source-maps',
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

import { execFile } from 'node:child_process'
import * as path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { buildNodeArgs, parseNodeHmrCommand, shouldIgnoreWatchPath } from './lib/cli-args.ts'

const execFileAsync = promisify(execFile)

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
      '--hmr-event-host',
      '0.0.0.0',
      '--hmr-event-port=12345',
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
    assert.throws(() => parseNodeHmrCommand(['--hmr-event-port', '70000', 'server.ts']), {
      message: 'Invalid HMR event port: 70000',
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
      hmrEventUrl: 'http://127.0.0.1:1234/hmr',
      nodeArgs: ['--import', 'remix/node-tsx', '--enable-source-maps'],
      registerPath,
    })

    let registerUrl = pathToFileURL(registerPath)
    registerUrl.searchParams.set('hmrEventUrl', 'http://127.0.0.1:1234/hmr')

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

describe('node HMR runtime', () => {
  it('safely imports the public runtime outside the node HMR child process', async () => {
    let script = `
      process.env.REMIX_NODE_HMR_EVENT_URL = 'http://127.0.0.1:1234/hmr'
      let runtime = await import('@remix-run/node-hmr/runtime')

      if (runtime.eventChannel !== undefined) {
        throw new Error('expected eventChannel to be undefined outside node-hmr')
      }
    `

    await execFileAsync(process.execPath, [
      '--disable-warning=ExperimentalWarning',
      '--import',
      '@remix-run/node-tsx',
      '--input-type=module',
      '--eval',
      script,
    ])
  })
})

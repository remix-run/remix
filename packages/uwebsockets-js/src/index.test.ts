import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import * as path from 'node:path'
import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

const source = readFileSync(new URL('./index.cjs', import.meta.url), 'utf8')
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

function load(
  options: {
    platform?: string
    arch?: string
    glibc?: boolean
    missingPackage?: boolean
    missingBinary?: boolean
    loadError?: Error
  } = {},
) {
  let selected = ''
  let exports = { App: 'native app' }
  let module = { exports: {} }
  let require = Object.assign(
    (name: string) => {
      if (name === 'node:fs') return { existsSync: () => !options.missingBinary }
      if (name === 'node:path') return path
      if (name === '../package.json') return packageJson
      if (options.loadError) throw options.loadError
      return exports
    },
    {
      resolve(name: string) {
        selected = name
        if (options.missingPackage) throw new Error('MODULE_NOT_FOUND')
        return '/native/dist/uws.js'
      },
    },
  )
  runInNewContext(source, {
    require,
    module,
    process: {
      platform: options.platform ?? 'darwin',
      arch: options.arch ?? 'arm64',
      version: 'v24.0.0',
      versions: { modules: '137' },
      report: {
        getReport: () => ({ header: { glibcVersionRuntime: options.glibc ? '2.35' : undefined } }),
      },
    },
    Error,
  })
  return { selected, exports: module.exports }
}

describe('uWebSockets.js native loader', () => {
  it('selects each supported optional platform package', () => {
    for (let [platform, arch, suffix] of [
      ['darwin', 'arm64', 'darwin-arm64'],
      ['darwin', 'x64', 'darwin-x64'],
      ['linux', 'arm64', 'linux-arm64-gnu'],
      ['linux', 'x64', 'linux-x64-gnu'],
      ['win32', 'x64', 'win32-x64'],
    ]) {
      let result = load({ platform, arch, glibc: true })
      assert.equal(result.selected, `@remix-run/uwebsockets-js-${suffix}`)
      assert.deepEqual(result.exports, { App: 'native app' })
    }
  })

  it('explains how to reinstall missing optional dependencies', () => {
    assert.throws(() => load({ missingPackage: true }), /npm install --include=optional/)
  })

  it('reports the missing Node ABI', () => {
    assert.throws(() => load({ missingBinary: true }), /no binary for Node ABI 137/)
  })

  it('rejects unsupported architectures before resolving a package', () => {
    assert.throws(() => load({ arch: 'riscv64' }), /does not support darwin-riscv64/)
  })

  it('rejects musl Linux before resolving a glibc package', () => {
    assert.throws(() => load({ platform: 'linux' }), /Linux requires glibc/)
  })

  it('retains native loader failures as the cause', () => {
    let cause = new Error('incompatible native library')
    assert.throws(
      () => load({ loadError: cause }),
      (error: unknown) => {
        assert.ok(error instanceof Error)
        assert.equal(error.cause, cause)
        return true
      },
    )
  })
})

import * as assert from '@remix-run/assert'
import { execFile } from 'node:child_process'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import { promisify } from 'node:util'
import { describe, it } from '../lib/framework.ts'
import { IS_BUN } from '../lib/runtime.ts'
import { transformTypeScript } from '../lib/ts-transform.ts'

const PKG_DIR = path.resolve(import.meta.dirname, '..', '..')
const execFileAsync = promisify(execFile)

async function withProject(
  compilerOptions: Record<string, unknown>,
  run: (dir: string) => Promise<void>,
): Promise<void> {
  let root = path.join(PKG_DIR, '.tmp')
  await fsp.mkdir(root, { recursive: true })
  let dir = await fsp.mkdtemp(path.join(root, 'ts-transform-'))
  try {
    await fsp.writeFile(path.join(dir, 'package.json'), '{"type":"module"}')
    await fsp.writeFile(path.join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions }))
    await run(dir)
  } finally {
    await fsp.rm(dir, { recursive: true, force: true })
  }
}

async function assertIgnoredJsxCoverage(source: string): Promise<void> {
  let failures: string[] = []
  for (let compilerOptions of [
    { jsx: 'react', jsxFactory: 'Object.assign' },
    { jsx: 'react-jsx', jsxImportSource: 'fixture-jsx-runtime' },
  ]) {
    await withProject(compilerOptions, async (dir) => {
      let runtimeDir = path.join(dir, 'node_modules', 'fixture-jsx-runtime')
      await fsp.mkdir(runtimeDir, { recursive: true })
      await fsp.writeFile(
        path.join(runtimeDir, 'package.json'),
        JSON.stringify({ type: 'module', exports: { './jsx-runtime': './jsx-runtime.js' } }),
      )
      await fsp.writeFile(
        path.join(runtimeDir, 'jsx-runtime.js'),
        'export function jsx(type, props) { return props }\nexport { jsx as jsxs }',
      )
      await fsp.writeFile(path.join(dir, 'fixture.tsx'), source)
      let frameworkPath = path
        .relative(dir, path.join(PKG_DIR, 'src/lib/framework.ts'))
        .split(path.sep)
        .join('/')
      let testSource = `import { describe, it } from ${JSON.stringify(frameworkPath)}
import { render } from './fixture.tsx'
describe('JSX coverage fixture', () => {
  it('renders without calling the ignored callback', () => { render() })
})`
      await fsp.writeFile(path.join(dir, 'fixture.test.ts'), testSource)
      await fsp.writeFile(path.join(dir, 'fixture.test.browser.ts'), testSource)
      for (let type of ['server', 'browser']) {
        let glob = type === 'server' ? 'fixture.test.ts' : 'fixture.test.browser.ts'
        try {
          await execFileAsync(
            process.execPath,
            [
              path.resolve(PKG_DIR, '../remix/src/cli-entry.ts'),
              'test',
              '--type',
              type,
              '--glob.test',
              glob,
              '--project',
              'chromium',
              '--coverage',
              '--coverage.dir',
              `.coverage/${type}`,
              '--coverage.include',
              'fixture.tsx',
              '--coverage.functions',
              '100',
              '--quiet',
            ],
            { cwd: dir },
          )
          let lcov = await fsp.readFile(path.join(dir, `.coverage/${type}/lcov.info`), 'utf-8')
          assert.match(lcov, /^SF:fixture.tsx$/m)
          let found = /^FNF:(\d+)$/m.exec(lcov)
          assert.ok(found)
          assert.ok(Number(found[1]) > 0)
          assert.match(lcov, new RegExp(`^FNH:${found[1]}$`, 'm'))
        } catch (error) {
          let output = error instanceof Error && 'stdout' in error ? `\n${error.stdout}` : ''
          failures.push(`${compilerOptions.jsx}/${type}: ${String(error)}${output}`)
        }
      }
    })
  }
  assert.equal(failures.length, 0, failures.join('\n\n'))
}

describe('TypeScript transforms', () => {
  it('ignores an uncalled JSX prop callback in coverage', { skip: IS_BUN }, async () => {
    await assertIgnoredJsxCoverage(`
let Inner = 'div'
export function render() {
  return <Inner onUpdate={
    /* c8 ignore next */ () => 'intentionally uncalled'
  } />
}
`)
  })

  it('ignores an uncalled JSX child between coverage directives', { skip: IS_BUN }, async () => {
    await assertIgnoredJsxCoverage(`
let Inner = 'div'
export function render() {
  return <Inner>
    {/* c8 ignore start */}
    {() => 'intentionally uncalled'}
    {/* c8 ignore stop */}
  </Inner>
}
`)
  })

  it('honors experimentalDecorators for legacy parameter decorators', async () => {
    await withProject({ experimentalDecorators: true }, async (dir) => {
      let { code } = await transformTypeScript(
        `let decoratedParameter
function parameter(target: object, key: string, index: number) {
  decoratedParameter = [key, index]
}
class Example {
  greet(@parameter name: string) { return 'Hello, ' + name }
}
export let result = { decoratedParameter, greeting: new Example().greet('Remix') }`,
        path.join(dir, 'fixture.ts'),
      )
      let { result } = await import(`data:text/javascript,${encodeURIComponent(code)}`)
      assert.deepEqual(result, { decoratedParameter: ['greet', 0], greeting: 'Hello, Remix' })
    })
  })
})

import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { expect } from '@remix-run/assert'
import { it } from '@remix-run/test'
import type * as Component from '../src/index.ts'
import type * as JSXRuntime from '../src/jsx-runtime.ts'
import type * as Server from '../src/server.ts'
import pkg from '../package.json' with { type: 'json' }

it('ships the public browser exports with one shared component runtime', async (t) => {
  let root = path.dirname(import.meta.dirname)
  let output = await mkdtemp(path.join(tmpdir(), 'remix-component-browser-'))
  t.after(() => rm(output, { recursive: true, force: true }))
  await writeFile(path.join(output, 'package.json'), JSON.stringify({ type: 'module' }))
  await promisify(execFile)(
    process.execPath,
    ['scripts/build-browser.ts', path.join(output, 'dist')],
    { cwd: root },
  )

  for (let target of Object.values(pkg.publishConfig.exports)) {
    if (typeof target === 'string') continue
    let source = target.default.replace('./dist/', './src/').replace(/\.js$/, '.ts')
    let original = await import(pathToFileURL(path.join(root, source)).href)
    let browser = await import(pathToFileURL(path.join(output, target.browser)).href)
    expect(Object.keys(browser)).toEqual(Object.keys(original))
  }

  let component: typeof Component = await import(
    pathToFileURL(path.join(output, pkg.publishConfig.exports['.'].browser)).href
  )
  let jsx: typeof JSXRuntime = await import(
    pathToFileURL(path.join(output, pkg.publishConfig.exports['./jsx-runtime'].browser)).href
  )
  let server: typeof Server = await import(
    pathToFileURL(path.join(output, pkg.publishConfig.exports['./server'].browser)).href
  )
  expect(jsx.Fragment).toBe(component.Fragment)
  let element = jsx.jsx(jsx.Fragment, {
    children: jsx.jsx('p', { innerHTML: component.unsafeHTML('<b>hello</b>') }),
  })
  expect(await server.renderToString(element)).toContain('<p><b>hello</b></p>')
})

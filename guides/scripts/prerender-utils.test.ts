import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  createStaticAssetHrefMap,
  getAssetOutputPath,
  getPageOutputPath,
  resetOutputDir,
  rewriteAssetHrefs,
} from './prerender-utils.ts'

describe('resetOutputDir', () => {
  it('removes stale output before recreating the directory', async (t) => {
    let parentDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-guides-prerender-'))
    t.after(() => fs.rm(parentDir, { recursive: true, force: true }))
    let outputDir = path.join(parentDir, 'site')
    await fs.mkdir(outputDir)
    await fs.writeFile(path.join(outputDir, 'stale.html'), 'stale')

    await resetOutputDir(outputDir)

    assert.deepEqual(await fs.readdir(outputDir), [])
  })
})

describe('createStaticAssetHrefMap', () => {
  it('rewrites served TypeScript and JSX modules to JavaScript paths', () => {
    let hrefMap = createStaticAssetHrefMap([
      '/assets/entry.@abc.ts',
      '/assets/component.@def.tsx',
      '/assets/legacy.@ghi.jsx',
      '/assets/styles.@jkl.css',
    ])

    assert.equal(hrefMap.get('/assets/entry.@abc.ts'), '/assets/entry.@abc.js')
    assert.equal(hrefMap.get('/assets/component.@def.tsx'), '/assets/component.@def.js')
    assert.equal(hrefMap.get('/assets/legacy.@ghi.jsx'), '/assets/legacy.@ghi.js')
    assert.equal(hrefMap.get('/assets/styles.@jkl.css'), '/assets/styles.@jkl.css')
  })

  it('preserves search parameters', () => {
    let hrefMap = createStaticAssetHrefMap(['/assets/entry.@abc.ts?transform=small'])
    assert.equal(
      hrefMap.get('/assets/entry.@abc.ts?transform=small'),
      '/assets/entry.@abc.js?transform=small',
    )
  })
})

describe('rewriteAssetHrefs', () => {
  it('rewrites exact generated asset hrefs without changing source examples', () => {
    let hrefMap = createStaticAssetHrefMap([
      '/assets/entry.@abc.ts',
      '/assets/counter.demo.@def.tsx',
    ])
    let html = [
      '<script type="module" src="/assets/entry.@abc.ts"></script>',
      '<script type="application/json">',
      '{"moduleUrl":"/assets/counter.demo.@def.tsx"}',
      '</script>',
      '<code>app/entry.browser.ts</code>',
      '<code>/assets/counter.demo.tsx</code>',
    ].join('')

    assert.equal(
      rewriteAssetHrefs(html, hrefMap),
      [
        '<script type="module" src="/assets/entry.@abc.js"></script>',
        '<script type="application/json">',
        '{"moduleUrl":"/assets/counter.demo.@def.js"}',
        '</script>',
        '<code>app/entry.browser.ts</code>',
        '<code>/assets/counter.demo.tsx</code>',
      ].join(''),
    )
  })

  it('rewrites longer hrefs before hrefs that are their prefixes', () => {
    let hrefMap = new Map([
      ['/assets/example.ts', '/assets/example.js'],
      ['/assets/example.tsx', '/assets/example-tsx.js'],
    ])

    assert.equal(
      rewriteAssetHrefs('/assets/example.ts /assets/example.tsx', hrefMap),
      '/assets/example.js /assets/example-tsx.js',
    )
  })
})

describe('prerender output paths', () => {
  it('writes clean page URLs to directory index files', () => {
    assert.equal(
      getPageOutputPath('/tmp/site', '/start-here'),
      path.join('/tmp/site', 'start-here', 'index.html'),
    )
    assert.equal(getPageOutputPath('/tmp/site', '/'), path.join('/tmp/site', 'index.html'))
  })

  it('writes assets beneath the output directory', () => {
    assert.equal(
      getAssetOutputPath('/tmp/site', '/assets/app/entry.@abc.js'),
      path.join('/tmp/site', 'assets', 'app', 'entry.@abc.js'),
    )
  })
})

import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  createStaticAssetHrefMap,
  getAssetOutputPath,
  getPageOutputPath,
  normalizeBasePath,
  resetOutputDir,
  rewriteAssetHrefs,
  rewriteRemixDataHrefs,
  rewriteSiteHrefsInCss,
  rewriteSiteHrefsInHtml,
} from './prerender-utils.ts'

describe('normalizeBasePath', () => {
  it('normalizes root and nested base paths', () => {
    assert.equal(normalizeBasePath(''), '')
    assert.equal(normalizeBasePath('/'), '')
    assert.equal(normalizeBasePath('remix-guides-docs/'), '/remix-guides-docs')
    assert.equal(normalizeBasePath('/remix-guides-docs///'), '/remix-guides-docs')
  })

  it('rejects URLs, query strings, and hashes', () => {
    assert.throws(() => normalizeBasePath('https://example.com/guides'))
    assert.throws(() => normalizeBasePath('/guides?preview=true'))
    assert.throws(() => normalizeBasePath('/guides#content'))
  })
})

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

  it('prefixes static hrefs with the deployment base path', () => {
    let hrefMap = createStaticAssetHrefMap(
      ['/assets/entry.@abc.ts', '/assets/styles.@def.css'],
      '/remix-guides-docs',
    )

    assert.equal(hrefMap.get('/assets/entry.@abc.ts'), '/remix-guides-docs/assets/entry.@abc.js')
    assert.equal(
      hrefMap.get('/assets/styles.@def.css'),
      '/remix-guides-docs/assets/styles.@def.css',
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

describe('rewriteSiteHrefsInHtml', () => {
  it('prefixes site-owned URL attributes without changing external URLs or source examples', () => {
    let html = [
      '<a href="/start-here/">Start Here</a>',
      '<img src="/remix-logo.svg">',
      '<a href="#content">Content</a>',
      '<a href="https://example.com/">External</a>',
      '<a href="//example.com/">Protocol relative</a>',
      '<code>href="/example-route/"</code>',
    ].join('')

    assert.equal(
      rewriteSiteHrefsInHtml(html, '/remix-guides-docs'),
      [
        '<a href="/remix-guides-docs/start-here/">Start Here</a>',
        '<img src="/remix-guides-docs/remix-logo.svg">',
        '<a href="#content">Content</a>',
        '<a href="https://example.com/">External</a>',
        '<a href="//example.com/">Protocol relative</a>',
        '<code>href="/example-route/"</code>',
      ].join(''),
    )
  })

  it('configures Pagefind bundle and result URLs for the base path', () => {
    let html = '<pagefind-config base-url="/" bundle-path="/assets/pagefind/"></pagefind-config>'

    assert.equal(
      rewriteSiteHrefsInHtml(html, '/remix-guides-docs'),
      '<pagefind-config base-url="/remix-guides-docs/" bundle-path="/remix-guides-docs/assets/pagefind/"></pagefind-config>',
    )
  })
})

describe('rewriteRemixDataHrefs', () => {
  it('prefixes generated modules and frame sources without changing component props', () => {
    let data = {
      h: {
        component: {
          exportName: 'Example',
          moduleUrl: '/assets/example.@abc.js',
          props: { src: '/example-prop/' },
        },
      },
      f: {
        frame: { status: 'resolved', src: '/examples/chapter/example/' },
      },
    }
    let html = `<script type="application/json" id="rmx-data">${JSON.stringify(data)}</script>`
    let rewritten = rewriteRemixDataHrefs(html, '/remix-guides-docs')

    assert.match(rewritten, /"moduleUrl":"\/remix-guides-docs\/assets\/example\.@abc\.js"/)
    assert.match(rewritten, /"src":"\/remix-guides-docs\/examples\/chapter\/example\/"/)
    assert.match(rewritten, /"props":\{"src":"\/example-prop\/"\}/)
  })
})

describe('rewriteSiteHrefsInCss', () => {
  it('prefixes root-relative URLs without changing data, fragment, or external URLs', () => {
    let css = [
      "mask: url('/remix-wordmark.svg')",
      'background: url("data:image/svg+xml,...")',
      'filter: url(#shadow)',
      'background: url(https://example.com/image.png)',
    ].join(';')

    assert.equal(
      rewriteSiteHrefsInCss(css, '/remix-guides-docs'),
      [
        "mask: url('/remix-guides-docs/remix-wordmark.svg')",
        'background: url("data:image/svg+xml,...")',
        'filter: url(#shadow)',
        'background: url(https://example.com/image.png)',
      ].join(';'),
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

  it('keeps the asset layout unchanged when hrefs include a base path', () => {
    assert.equal(
      getAssetOutputPath(
        '/tmp/site',
        '/remix-guides-docs/assets/app/entry.@abc.js',
        '/remix-guides-docs',
      ),
      path.join('/tmp/site', 'assets', 'app', 'entry.@abc.js'),
    )
  })
})

import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import * as assert from 'remix/assert'
import { createRouter } from 'remix/router'
import { describe, it } from 'remix/test'

import { prerender } from './run.ts'

function html(content: string): Response {
  return new Response(content, { headers: { 'Content-Type': 'text/html' } })
}

describe('prerender(router, options)', () => {
  it('copies public directories and writes crawled responses', async () => {
    let tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-docs-prerender-'))

    try {
      let firstPublicDir = path.join(tempDir, 'public-a')
      let secondPublicDir = path.join(tempDir, 'public-b')
      let outputDir = path.join(tempDir, 'output')
      await fs.mkdir(firstPublicDir)
      await fs.mkdir(secondPublicDir)
      await fs.writeFile(path.join(firstPublicDir, 'favicon.svg'), '<svg>favicon</svg>')
      await fs.writeFile(path.join(secondPublicDir, 'wordmark.svg'), '<svg>wordmark</svg>')

      let router = createRouter()
      router.get('/', () => html('<a href="/about">About</a>'))
      router.get('/about', () => html('<h1>About</h1>'))

      let finalized = false
      await prerender(router, {
        outputDir,
        publicDirs: [firstPublicDir, secondPublicDir],
        onFinally() {
          finalized = true
        },
      })

      assert.equal(
        await fs.readFile(path.join(outputDir, 'favicon.svg'), 'utf8'),
        '<svg>favicon</svg>',
      )
      assert.equal(
        await fs.readFile(path.join(outputDir, 'wordmark.svg'), 'utf8'),
        '<svg>wordmark</svg>',
      )
      assert.equal(
        await fs.readFile(path.join(outputDir, 'index.html'), 'utf8'),
        '<a href="/about">About</a>',
      )
      assert.equal(
        await fs.readFile(path.join(outputDir, 'about', 'index.html'), 'utf8'),
        '<h1>About</h1>',
      )
      assert.equal(finalized, true)
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  it('passes site-specific options to the crawler', async () => {
    let tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-docs-prerender-'))

    try {
      let outputDir = path.join(tempDir, 'output')
      let router = createRouter()
      router.get('/start', () => html('<a href="/linked">Linked</a>'))
      router.get('/linked', () => html('<h1>Linked</h1>'))

      await prerender(router, {
        outputDir,
        paths: ['/start'],
        crawlOptions: { spider: false },
      })

      assert.equal(
        await fs.readFile(path.join(outputDir, 'start', 'index.html'), 'utf8'),
        '<a href="/linked">Linked</a>',
      )
      await assert.rejects(() => fs.access(path.join(outputDir, 'linked', 'index.html')))
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  it('runs finalization when prerendering fails', async () => {
    let tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-docs-prerender-'))

    try {
      let finalized = false
      let router = createRouter()
      router.get('/', () => new Response('Nope', { status: 500 }))

      await assert.rejects(
        () =>
          prerender(router, {
            outputDir: path.join(tempDir, 'output'),
            onFinally() {
              finalized = true
            },
          }),
        /Crawl failed: 500/,
      )
      assert.equal(finalized, true)
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })
})

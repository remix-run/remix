/**
 * Benchmark: crawl() throughput
 *
 * Measures raw HTML-parsing and link-extraction throughput using a zero-latency
 * router so I/O doesn't obscure the cost of parsing and extraction.
 *
 * The site is a 100-page graph built from the realistic HTML fixtures,
 * with internal links rewritten to point at sibling pages.
 *
 * Run: node bench/src/crawl-throughput.ts
 */

import { readFileSync } from 'node:fs'
import { crawl, createRouter } from '../../src/index.ts'

const PAGE_COUNT = 100
const TRIALS = 10

// Load and duplicate the docs-page fixture (richest link/asset density)
let template = readFileSync(new URL('../fixtures/docs-page.html', import.meta.url), 'utf-8')

// Inject internal links into the template so the spider actually traverses the site
function buildPageHtml(index: number, total: number): string {
  // Link to the next 5 pages (wrapping) to create a connected graph
  let links = Array.from(
    { length: Math.min(5, total - 1) },
    (_, k) => `<a href="/page/${(index + k + 1) % total}">Page ${(index + k + 1) % total}</a>`,
  ).join('\n')
  return template + `\n<nav class="bench-links">${links}</nav>`
}

function buildRouter() {
  let router = createRouter({
    // Return empty 200 for any unregistered asset paths (CSS, JS, images from fixtures)
    defaultHandler: () => new Response('', { status: 200 }),
  })

  // Root redirects into the page graph
  let rootHtml = `<html><body>${Array.from({ length: Math.min(5, PAGE_COUNT) }, (_, i) => `<a href="/page/${i}">Page ${i}</a>`).join('')}</body></html>`
  router.get('/', () => new Response(rootHtml, { headers: { 'Content-Type': 'text/html' } }))

  for (let i = 0; i < PAGE_COUNT; i++) {
    let html = buildPageHtml(i, PAGE_COUNT)
    router.get(`/page/${i}`, () => new Response(html, { headers: { 'Content-Type': 'text/html' } }))
  }

  return router
}

async function runOnce(router: ReturnType<typeof createRouter>): Promise<number> {
  let count = 0
  for await (let _ of crawl(router)) {
    count++
  }
  return count
}

function stats(samples: number[]): { min: number; median: number; max: number; mean: number } {
  let sorted = [...samples].sort((a, b) => a - b)
  let mid = Math.floor(sorted.length / 2)
  return {
    min: sorted[0],
    median: sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid],
    max: sorted[sorted.length - 1],
    mean: samples.reduce((a, b) => a + b, 0) / samples.length,
  }
}

async function benchmark(label: string) {
  let router = buildRouter()

  // Warm-up
  await runOnce(router)

  let elapsed: number[] = []
  let pageCount = 0
  for (let t = 0; t < TRIALS; t++) {
    let start = performance.now()
    pageCount = await runOnce(router)
    elapsed.push(performance.now() - start)
  }

  let s = stats(elapsed)
  let pagesPerSec = (pageCount / s.median) * 1000

  console.log(`\n${label}`)
  console.log('-'.repeat(60))
  console.log(`  Pages crawled : ${pageCount}`)
  console.log(`  Trials        : ${TRIALS}`)
  console.log(`  Min           : ${s.min.toFixed(1)}ms`)
  console.log(`  Median        : ${s.median.toFixed(1)}ms`)
  console.log(`  Max           : ${s.max.toFixed(1)}ms`)
  console.log(`  Throughput    : ${pagesPerSec.toFixed(0)} pages/sec  ← headline number`)

  return { pagesPerSec, medianMs: s.median }
}

console.log(`Crawl throughput benchmark  (${PAGE_COUNT} pages, ${TRIALS} trials, zero I/O latency)`)
await benchmark('Current implementation')

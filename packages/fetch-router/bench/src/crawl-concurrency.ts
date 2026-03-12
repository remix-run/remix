/**
 * Benchmark: crawl() concurrency
 *
 * Simulates a ~100-page site where each handler has configurable async latency
 * to model real-world I/O. Measures total wall-clock time across concurrency
 * levels to show the speedup from parallel fetching.
 *
 * Run: node --disable-warning=ExperimentalWarning bench/src/crawl-concurrency.bench.ts
 */

import { crawl, createRouter } from '../../src/index.ts'

// Build a site graph with the given number of pages and latency per request.
// The root page links to all other pages; each other page links back to root.
function buildRouter(pageCount: number, latencyMs: number) {
  let router = createRouter()

  let links = Array.from({ length: pageCount - 1 }, (_, i) => `<a href="/page/${i}">`)

  router.get('/', () =>
    new Promise<Response>((resolve) =>
      setTimeout(
        () => resolve(new Response(links.join(''), { headers: { 'Content-Type': 'text/html' } })),
        latencyMs,
      ),
    ),
  )

  for (let i = 0; i < pageCount - 1; i++) {
    router.get(`/page/${i}`, () =>
      new Promise<Response>((resolve) =>
        setTimeout(
          () =>
            resolve(
              new Response('<a href="/">Home</a>', { headers: { 'Content-Type': 'text/html' } }),
            ),
          latencyMs,
        ),
      ),
    )
  }

  return router
}

async function runCrawl(router: ReturnType<typeof createRouter>, concurrency: number) {
  let count = 0
  for await (let _ of crawl(router, { concurrency })) {
    count++
  }
  return count
}

async function benchmark(label: string, pageCount: number, latencyMs: number) {
  let router = buildRouter(pageCount, latencyMs)

  console.log(`\n${label} (${pageCount} pages, ${latencyMs}ms latency/request)`)
  console.log('-'.repeat(60))

  let levels = [1, 2, 4, 8, 16, 32]
  let baseline: number | null = null

  for (let concurrency of levels) {
    let start = performance.now()
    let count = await runCrawl(router, concurrency)
    let elapsed = performance.now() - start

    if (baseline === null) baseline = elapsed
    let speedup = baseline / elapsed

    console.log(
      `  concurrency=${String(concurrency).padStart(2)}: ${elapsed.toFixed(0).padStart(6)}ms` +
        `  (${speedup.toFixed(2)}x speedup, ${count} pages)`,
    )
  }
}

await benchmark('Small site', 20, 10)
await benchmark('Medium site', 50, 10)
await benchmark('Large site', 100, 10)
await benchmark('High latency', 50, 25)

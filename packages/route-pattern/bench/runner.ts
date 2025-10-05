import { performance } from 'node:perf_hooks'
import { TrieMatcher, RegExpMatcher } from '@remix-run/route-pattern'

import { PathToRegexpMatcher } from './path-to-regexp-matcher.ts'
import { FindMyWayMatcher } from './find-my-way-matcher.ts'

interface BenchData {
  name: string
  handler: string
}

interface BenchmarkStats {
  mean: number
  stdDev: number
  coefficientOfVariation: number
  min: number
  max: number
}

function calculateStats(measurements: number[]): BenchmarkStats {
  let mean = measurements.reduce((a, b) => a + b, 0) / measurements.length
  let variance = measurements.reduce((a, b) => a + (b - mean) ** 2, 0) / measurements.length
  let stdDev = Math.sqrt(variance)
  let coefficientOfVariation = (stdDev / mean) * 100
  let min = Math.min(...measurements)
  let max = Math.max(...measurements)

  return { mean, stdDev, coefficientOfVariation, min, max }
}

function formatStats(stats: BenchmarkStats): string {
  return `${stats.mean.toFixed(2)}ms ± ${stats.stdDev.toFixed(2)}ms (CV: ${stats.coefficientOfVariation.toFixed(1)}%)`
}

// Create patterns that ALL libraries can handle (fair comparison)
function createCommonPatterns(count: number): {
  routePatternSyntax: string[]
  pathToRegexpSyntax: string[]
  findMyWaySyntax: string[]
} {
  let routePatternSyntax: string[] = []
  let pathToRegexpSyntax: string[] = []
  let findMyWaySyntax: string[] = []

  // Only use pattern types that all libraries support with equivalent capabilities
  for (let i = 0; i < count; i++) {
    if (i % 5 === 0) {
      // Static paths
      routePatternSyntax.push(`api/v${Math.floor(i / 100)}/users/${i}`)
      pathToRegexpSyntax.push(`/api/v${Math.floor(i / 100)}/users/${i}`)
      findMyWaySyntax.push(`/api/v${Math.floor(i / 100)}/users/${i}`)
    } else if (i % 5 === 1) {
      // Dynamic segments
      routePatternSyntax.push(`posts/:id/comments/${i}`)
      pathToRegexpSyntax.push(`/posts/:id/comments/${i}`)
      findMyWaySyntax.push(`/posts/:id/comments/${i}`)
    } else if (i % 5 === 2) {
      // Multiple dynamic segments
      routePatternSyntax.push(`users/:userId/posts/:postId/${i}`)
      pathToRegexpSyntax.push(`/users/:userId/posts/:postId/${i}`)
      findMyWaySyntax.push(`/users/:userId/posts/:postId/${i}`)
    } else if (i % 5 === 3) {
      // Optional segments at end (find-my-way requires optionals at end)
      routePatternSyntax.push(`api/resource/${i}(/:version)`)
      pathToRegexpSyntax.push(`/api/resource/${i}{/:version}`)
      findMyWaySyntax.push(`/api/resource/${i}/:version?`)
    } else {
      // Wildcard at end of pathname
      routePatternSyntax.push(`files/${i}/*path`)
      pathToRegexpSyntax.push(`/files/${i}/*path`)
      findMyWaySyntax.push(`/files/${i}/*`)
    }
  }

  return { routePatternSyntax, pathToRegexpSyntax, findMyWaySyntax }
}

function createTestUrls(): string[] {
  let urls: string[] = []

  // Add varied URLs that will/won't match
  for (let i = 0; i < 20; i++) {
    urls.push(`api/v${i % 3}/users/${i}`)
    urls.push(`posts/post-${i}/comments/${i}`)
    urls.push(`users/user${i}/posts/post${i}/${i}`)
    urls.push(`api/resource/${i}`) // Optional without version
    urls.push(`api/resource/${i}/v${i % 2}`) // Optional with version
    urls.push(`files/${i}/deep/nested/path.txt`) // Wildcard
    urls.push(`files/${i}/another/file.js`) // Wildcard
    urls.push(`nonexistent/path/${i}`) // Won't match
  }

  return urls
}

interface Matcher {
  add(pattern: string, data: BenchData): void
  match(url: string | URL): { data: BenchData; params: any } | null
}

function benchmarkMatcher(
  createMatcher: () => Matcher,
  patterns: string[],
  testUrls: string[],
  options?: { precompile?: boolean },
): { time: number; matches: number } {
  let matcher = createMatcher()

  // Build matcher
  for (let i = 0; i < patterns.length; i++) {
    matcher.add(patterns[i], { name: `handler-${i}`, handler: `handle-${i}` })
  }

  // Pre-compile if requested (for lazy compilation)
  if (options?.precompile) {
    matcher.match('https://example.com/dummy')
  }

  // Test matching
  let matchStart = performance.now()
  let matches = 0
  for (let url of testUrls) {
    let fullUrl =
      url.startsWith('http://') || url.startsWith('https://') ? url : `https://example.com/${url}`
    let match = matcher.match(fullUrl)
    if (match) matches++
  }
  let matchTime = performance.now() - matchStart

  return { time: matchTime, matches }
}

function runBenchmarkForPatternCount(patternCount: number, iterations: number = 100) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Benchmark: ${patternCount} patterns (common features only)`)
  console.log('='.repeat(60))

  let patterns = createCommonPatterns(patternCount)
  let testUrls = createTestUrls()

  console.log(
    `Testing ${patterns.routePatternSyntax.length} patterns against ${testUrls.length} test URLs`,
  )
  console.log(`Running ${iterations} iterations for statistical significance\n`)

  // Run multiple iterations
  let trieTimes: number[] = []
  let reTimes: number[] = []
  let pathToRegexpTimes: number[] = []
  let findMyWayTimes: number[] = []
  let trieMatches = 0
  let reMatches = 0
  let pathMatches = 0
  let findMyWayMatches = 0

  for (let i = 0; i < iterations; i++) {
    let pathResult = benchmarkMatcher(
      () => new PathToRegexpMatcher(),
      patterns.pathToRegexpSyntax,
      testUrls,
    )
    pathToRegexpTimes.push(pathResult.time)
    pathMatches = pathResult.matches

    let findMyWayResult = benchmarkMatcher(
      () => new FindMyWayMatcher(),
      patterns.findMyWaySyntax,
      testUrls,
    )
    findMyWayTimes.push(findMyWayResult.time)
    findMyWayMatches = findMyWayResult.matches

    let reResult = benchmarkMatcher(
      () => new RegExpMatcher<BenchData>(),
      patterns.routePatternSyntax,
      testUrls,
      { precompile: true },
    )
    reTimes.push(reResult.time)
    reMatches = reResult.matches

    let trieResult = benchmarkMatcher(
      () => new TrieMatcher<BenchData>(),
      patterns.routePatternSyntax,
      testUrls,
    )
    trieTimes.push(trieResult.time)
    trieMatches = trieResult.matches
  }

  // Calculate statistics
  let trieStats = calculateStats(trieTimes)
  let reStats = calculateStats(reTimes)
  let pathStats = calculateStats(pathToRegexpTimes)
  let findMyWayStats = calculateStats(findMyWayTimes)

  // Display results
  console.log('path-to-regexp:')
  console.log(`  Time: ${formatStats(pathStats)}`)
  console.log(`  Matches: ${pathMatches}/${testUrls.length}`)
  console.log()

  console.log('find-my-way:')
  console.log(`  Time: ${formatStats(findMyWayStats)}`)
  console.log(`  Matches: ${findMyWayMatches}/${testUrls.length}`)
  console.log()

  console.log('RegExpMatcher:')
  console.log(`  Time: ${formatStats(reStats)}`)
  console.log(`  Matches: ${reMatches}/${testUrls.length}`)
  console.log()

  console.log('TrieMatcher:')
  console.log(`  Time: ${formatStats(trieStats)}`)
  console.log(`  Matches: ${trieMatches}/${testUrls.length}`)
  console.log()

  console.log('--- Speed Comparison ---')

  // Create array of results and sort by speed
  let results = [
    { name: 'path-to-regexp', stats: pathStats },
    { name: 'find-my-way', stats: findMyWayStats },
    { name: 'RegExpMatcher', stats: reStats },
    { name: 'TrieMatcher', stats: trieStats },
  ]
  results.sort((a, b) => a.stats.mean - b.stats.mean)

  let fastest = results[0].stats.mean

  for (let i = 0; i < results.length; i++) {
    let { name, stats } = results[i]
    if (i === 0) {
      console.log(`1. ${name}: ${stats.mean.toFixed(2)}ms (fastest)`)
    } else {
      let ratio = (stats.mean / fastest).toFixed(2)
      console.log(`${i + 1}. ${name}: ${stats.mean.toFixed(2)}ms (${ratio}x slower)`)
    }
  }
}

function runBenchmark() {
  console.log('=== Route Pattern Benchmark ===')
  console.log('Comparing industry standard routers vs route-pattern\n')
  console.log('NOTE: This benchmark uses only patterns that all libraries')
  console.log('      can handle for a fair apples-to-apples comparison.')
  console.log('      route-pattern also supports full URLs with protocols and')
  console.log('      query string constraints which other libraries cannot handle.\n')

  runBenchmarkForPatternCount(10)
  runBenchmarkForPatternCount(100)
  runBenchmarkForPatternCount(1000)
  runBenchmarkForPatternCount(5000)
}

// Run benchmark
runBenchmark()

import { performance } from 'node:perf_hooks'

import { TrieMatcher } from './trie-matcher.ts'
import { RegExpMatcher } from './regexp-matcher.ts'

interface BenchData {
  name: string
  handler: string
}

// Simple benchmark to compare TrieMatcher vs RegExpMatcher
function createTestPatterns(count: number): string[] {
  let patterns: string[] = []

  // Create a mix of all pattern types including search constraints
  for (let i = 0; i < count; i++) {
    if (i % 7 === 0) {
      patterns.push(`api/v${Math.floor(i / 100)}/users/${i}`)
    } else if (i % 7 === 1) {
      patterns.push(`static/path/${i}`)
    } else if (i % 7 === 2) {
      patterns.push(`dynamic/:id/posts/${i}`)
    } else if (i % 7 === 3) {
      patterns.push(`files/*path/asset-${i}`)
    } else if (i % 7 === 4) {
      patterns.push(`api(/:version)/resource/${i}`)
    } else if (i % 7 === 5) {
      patterns.push(`https://api${i % 10}.example.com/service/${i}`)
    } else {
      patterns.push(`search/${i}?q=test&format=json`)
    }
  }

  return patterns
}

function benchmarkTrieMatcher(patterns: string[], testUrls: string[]): number {
  let trie = new TrieMatcher<BenchData>()

  // Build trie
  let buildStart = performance.now()
  for (let i = 0; i < patterns.length; i++) {
    trie.add(patterns[i], { name: `handler-${i}`, handler: `handle-${i}` })
  }
  let buildTime = performance.now() - buildStart

  // Test matching
  let matchStart = performance.now()
  let matches = 0
  for (let url of testUrls) {
    // Only prefix with host if the URL is relative
    let fullUrl =
      url.startsWith('http://') || url.startsWith('https://') ? url : `https://example.com/${url}`
    let match = trie.match(fullUrl)
    if (match) matches++
  }
  let matchTime = performance.now() - matchStart

  console.log(`TrieMatcher: ${patterns.length} patterns`)
  console.log(`  Build time: ${buildTime.toFixed(2)}ms`)
  console.log(`  Match time: ${matchTime.toFixed(2)}ms for ${testUrls.length} URLs`)
  console.log(`  Matches: ${matches}/${testUrls.length}`)
  console.log(`  Avg match time: ${(matchTime / testUrls.length).toFixed(4)}ms per URL`)

  return matchTime
}

function benchmarkRegExpMatcher(patterns: string[], testUrls: string[]): number {
  let re = new RegExpMatcher<BenchData>()

  // Build matcher
  let buildStart = performance.now()
  for (let i = 0; i < patterns.length; i++) {
    re.add(patterns[i], { name: `handler-${i}`, handler: `handle-${i}` })
  }
  let buildTime = performance.now() - buildStart

  // Test matching
  let matchStart = performance.now()
  let matches = 0
  for (let url of testUrls) {
    // Only prefix with host if the URL is relative
    let fullUrl =
      url.startsWith('http://') || url.startsWith('https://') ? url : `https://example.com/${url}`
    let match = re.match(fullUrl)
    if (match) matches++
  }
  let matchTime = performance.now() - matchStart

  console.log(`RegExpMatcher: ${patterns.length} patterns`)
  console.log(`  Build time: ${buildTime.toFixed(2)}ms`)
  console.log(`  Match time: ${matchTime.toFixed(2)}ms for ${testUrls.length} URLs`)
  console.log(`  Matches: ${matches}/${testUrls.length}`)
  console.log(`  Avg match time: ${(matchTime / testUrls.length).toFixed(4)}ms per URL`)

  return matchTime
}

function runBenchmark() {
  console.log('=== Matcher Benchmark ===\n')

  let patterns = createTestPatterns(1000)
  let testUrls = [
    'api/v1/users/123',
    'static/path/456',
    'dynamic/test-id/posts/789',
    'files/docs/readme.txt/asset-100',
    'api/v5/users/999',
    'api/v1/resource/200', // Optional with version
    'api/resource/300', // Optional without version
    'https://api1.example.com/service/100', // Full URL
    'https://api5.example.com/service/500', // Full URL
    'search/100?q=test&format=json', // Search constraints
    'search/200?q=test&format=json&extra=ignore', // Search constraints with extra
    'nonexistent/path',
    'static/path/1',
    'dynamic/another-id/posts/2',
    'files/images/logo.png/asset-200',
  ]

  console.log(`Testing with ${patterns.length} patterns and ${testUrls.length} test URLs\n`)

  let trieTime = benchmarkTrieMatcher(patterns, testUrls)
  console.log()
  let reTime = benchmarkRegExpMatcher(patterns, testUrls)

  console.log('\n=== Results ===')
  console.log(`TrieMatcher: ${trieTime.toFixed(2)}ms`)
  console.log(`RegExpMatcher: ${reTime.toFixed(2)}ms`)
  let speedup = (reTime / trieTime).toFixed(2)
  console.log(`TrieMatcher is ${speedup}x faster (higher is better)\n`)

  // Expanded Benchmarks
  console.log('\n=== Expanded Benchmarks ===')

  // 10k patterns
  console.log('Testing with 10000 patterns and 15 test URLs')
  let patterns10k = createTestPatterns(10000)
  let start = performance.now()
  let trie10k = new TrieMatcher<BenchData>()
  for (let i = 0; i < patterns10k.length; i++) {
    trie10k.add(patterns10k[i], { name: `pattern-${i}`, handler: `handle-${i}` })
  }
  let build10k = performance.now() - start
  console.log(`TrieMatcher 10k: Build time: ${build10k.toFixed(2)}ms`)

  start = performance.now()
  let matches10k = 0
  for (let url of testUrls) {
    let fullUrl = url.startsWith('http') ? url : `https://example.com/${url}`
    let match = trie10k.match(fullUrl)
    if (match) matches10k++
  }
  let match10k = performance.now() - start
  console.log(
    `Match time: ${match10k.toFixed(2)}ms for ${testUrls.length} URLs, Matches: ${matches10k}/${testUrls.length}`,
  )

  // Baseline 10k (RegExpMatcher)
  start = performance.now()
  let re10k = new RegExpMatcher<BenchData>()
  for (let i = 0; i < patterns10k.length; i++) {
    re10k.add(patterns10k[i], { name: `pattern-${i}`, handler: `handle-${i}` })
  }
  let buildBaseline10k = performance.now() - start
  console.log(`RegExpMatcher 10k: Build time: ${buildBaseline10k.toFixed(2)}ms`)

  start = performance.now()
  let baselineMatches10k = 0
  for (let url of testUrls) {
    let fullUrl = url.startsWith('http') ? url : `https://example.com/${url}`
    let match = re10k.match(fullUrl)
    if (match) baselineMatches10k++
  }
  let matchBaseline10k = performance.now() - start
  console.log(`Match time: ${matchBaseline10k.toFixed(2)}ms for ${testUrls.length} URLs`)
  let speedup10k = matchBaseline10k / match10k
  console.log(`TrieMatcher 10k vs RegExpMatcher: ${speedup10k.toFixed(2)}x faster`)

  // Dynamic
  console.log('\nDynamic add/match: 1000 adds + 100 matches interspersed')
  let trieDynamic = new TrieMatcher<BenchData>()
  let dynamicMatches = 0
  for (let i = 0; i < 1000; i++) {
    trieDynamic.add(`dynamic/${i}`, { name: `dynamic-${i}`, handler: `handler-${i}` })
    if (i % 10 === 0) {
      let match = trieDynamic.match(`https://example.com/dynamic/${i % 10}`)
      if (match) dynamicMatches++
    }
  }
  console.log(`Dynamic: ${dynamicMatches} matches, Final size: ${trieDynamic.size}`)

  // Baseline dynamic (RegExpMatcher)
  let baselineDynamicTime = 0
  for (let i = 0; i < 100; i++) {
    let patternsDyn = createTestPatterns(i * 10 + 1).slice(0, i * 10 + 1)
    let reDyn = new RegExpMatcher<BenchData>()
    for (let p of patternsDyn) reDyn.add(p, { name: 'x', handler: 'x' })
    start = performance.now()
    let fullUrl = `https://example.com/dynamic/${i}`
    reDyn.match(fullUrl)
    baselineDynamicTime += performance.now() - start
  }
  console.log(`Baseline Dynamic avg match: ${(baselineDynamicTime / 100).toFixed(2)}ms`)

  // High-optionals
  console.log('\nHigh-optionals: 100 nested optional patterns')
  let trieOpts = new TrieMatcher<BenchData>()
  for (let i = 0; i < 100; i++) {
    let optPattern = `api(/v1(/v2(/v3(/v4(/v5)))))/${i}`
    trieOpts.add(optPattern, { name: `opt-${i}`, handler: `opt-handler-${i}` })
  }
  start = performance.now()
  let optMatch = 0
  for (let i = 0; i < 5; i++) {
    let match = trieOpts.match(`https://example.com/api/v1/v2/v3/${i}`)
    if (match) optMatch++
  }
  let optTime = performance.now() - start
  console.log(`High-optionals match time: ${optTime.toFixed(2)}ms, Matches: ${optMatch}/5`)

  // Baseline high-opt (RegExpMatcher)
  start = performance.now()
  let reOpt = new RegExpMatcher<BenchData>()
  for (let i = 0; i < 100; i++)
    reOpt.add(`api(/v1(/v2(/v3(/v4(/v5)))))/${i}`, { name: 'x', handler: 'x' })
  let optBaselineTime = 0
  for (let i = 0; i < 5; i++) {
    start = performance.now()
    let fullUrl = `https://example.com/api/v1/v2/v3/${i}`
    reOpt.match(fullUrl)
    optBaselineTime += performance.now() - start
  }
  console.log(`Baseline high-opt avg: ${(optBaselineTime / 5).toFixed(2)}ms`)

  // Wildcard-heavy
  console.log('\nWildcard-heavy: 500 wildcard patterns')
  let trieWild = new TrieMatcher<BenchData>()
  for (let i = 0; i < 500; i++) {
    trieWild.add(`files/*path/${i}`, { name: `wild-${i}`, handler: `wild-handler-${i}` })
  }
  start = performance.now()
  let wildMatch = 0
  for (let i = 0; i < 10; i++) {
    let match = trieWild.match(`https://example.com/files/deep/nested/${i}`)
    if (match) wildMatch++
  }
  let wildTime = performance.now() - start
  console.log(`Wildcard match time: ${wildTime.toFixed(2)}ms, Matches: ${wildMatch}/10`)

  // Baseline wild (RegExpMatcher)
  start = performance.now()
  let reWild = new RegExpMatcher<BenchData>()
  for (let i = 0; i < 500; i++) reWild.add(`files/*path/${i}`, { name: 'x', handler: 'x' })
  let wildBaselineTime = 0
  for (let i = 0; i < 10; i++) {
    start = performance.now()
    let fullUrl = `https://example.com/files/deep/nested/${i}`
    reWild.match(fullUrl)
    wildBaselineTime += performance.now() - start
  }
  console.log(`Baseline wildcard avg: ${(wildBaselineTime / 10).toFixed(2)}ms`)

  // Memory
  let memoryAfter = process.memoryUsage()
  console.log('\nMemory after 1000 build/match:')
  console.log(`Heap Used: ${(memoryAfter.heapUsed / 1024 / 1024).toFixed(2)} MB`)
  console.log(`Heap Total: ${(memoryAfter.heapTotal / 1024 / 1024).toFixed(2)} MB`)

  // matchAll vs match
  console.log('\nmatchAll vs match for 10000 patterns')
  start = performance.now()
  let allMatches = 0
  for (let url of testUrls) {
    let fullUrl = url.startsWith('http') ? url : `https://example.com/${url}`
    let matches = trie10k.matchAll(fullUrl)
    allMatches += Array.from(matches).length
  }
  let allTime = performance.now() - start
  console.log(`matchAll time: ${allTime.toFixed(2)}ms, Total matches: ${allMatches}`)

  // Baseline matchAll (RegExpMatcher)
  start = performance.now()
  let baselineAll = 0
  for (let url of testUrls) {
    let fullUrl = url.startsWith('http') ? url : `https://example.com/${url}`
    let found = Array.from(re10k.matchAll(fullUrl)).length
    baselineAll += found
  }
  let baselineAllTime = performance.now() - start
  console.log(`Baseline matchAll: ${baselineAllTime.toFixed(2)}ms`)

  // Single pattern benchmark
  console.log('\nSingle Pattern Benchmark')
  let singlePattern = 'users/:id'
  let testSingleUrl = 'https://example.com/users/123'

  // RegExp (current RoutePattern via RegExpMatcher)
  let regStart = performance.now()
  let reSingle = new RegExpMatcher<{ name: string }>()
  reSingle.add(singlePattern, { name: 'single' })
  let regBuild = performance.now() - regStart

  let regMatchStart = performance.now()
  let regMatches = 0
  for (let i = 0; i < 1000; i++) {
    let match = reSingle.match(testSingleUrl)
    if (match) regMatches++
  }
  let regMatchTime = performance.now() - regMatchStart
  console.log(
    `RegExp Single: Build ${regBuild.toFixed(2)}ms, Match ${regMatchTime.toFixed(2)}ms for 1000 calls (${(regMatchTime / 1000).toFixed(4)}ms avg)`,
  )

  // Trie
  let trieSingleStart = performance.now()
  let trieSingle = new TrieMatcher<{ name: string }>()
  trieSingle.add(singlePattern, { name: 'single' })
  let trieBuild = performance.now() - trieSingleStart

  let trieMatchStart = performance.now()
  let trieMatches = 0
  for (let i = 0; i < 1000; i++) {
    let match = trieSingle.match(testSingleUrl)
    if (match) trieMatches++
  }
  let trieMatchTime = performance.now() - trieMatchStart
  let trieAvg = (trieMatchTime / 1000).toFixed(4)
  console.log(
    `Trie Single: Build ${trieBuild.toFixed(2)}ms, Match ${trieMatchTime.toFixed(2)}ms for 1000 calls (${trieAvg}ms avg)`,
  )

  // Summary
  if (trieMatchTime < regMatchTime) {
    console.log(`Trie single match is ${(regMatchTime / trieMatchTime).toFixed(2)}x faster`)
  } else {
    console.log(`RegExp single match is ${(trieMatchTime / regMatchTime).toFixed(2)}x faster`)
  }

  // Summary
  console.log('\n=== Expanded Summary ===')
  console.log(`10k Build: Trie ${build10k.toFixed(2)}ms vs RegExp ${buildBaseline10k.toFixed(2)}ms`)
  console.log(
    `10k Match: Trie ${match10k.toFixed(2)}ms vs RegExp ${matchBaseline10k.toFixed(2)}ms (${(matchBaseline10k / match10k).toFixed(2)}x faster)`,
  )
}

// Run benchmark
runBenchmark()

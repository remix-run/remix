import { createMultiMatcher } from '@remix-run/route-pattern/match'

function collectGarbage(): void {
  let gc = globalThis.gc
  if (gc === undefined) throw new Error('Run this benchmark with --expose-gc')
  gc()
}

function createOptionalSuffix(count: number): string {
  let suffix = ''
  for (let index = 0; index < count; index++) suffix += `(/segment-${index})`
  return suffix
}

function measureRetainedHeap(optionalCount: number, patternCount: number): number {
  collectGarbage()
  let before = process.memoryUsage().heapUsed
  let matcher = createMultiMatcher()
  let suffix = createOptionalSuffix(optionalCount)
  for (let index = 0; index < patternCount; index++) {
    matcher.add(`/pattern-${index}${suffix}`, null)
  }
  collectGarbage()
  let retained = process.memoryUsage().heapUsed - before
  if (matcher.match('https://example.com/pattern-0') === null) throw new Error('invalid matcher')
  return retained
}

const patternCount = 250
measureRetainedHeap(1, patternCount)

for (let optionalCount of [8, 16, 32, 64]) {
  let bytes = measureRetainedHeap(optionalCount, patternCount)
  console.log(`${optionalCount} optionals x ${patternCount} patterns: ${bytes} retained bytes`)
}

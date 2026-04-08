import type { Counts } from '../utils.ts'
import type { TestResults } from '../executor.ts'
import { SpecReporter } from './spec.ts'
import { TapReporter } from './tap.ts'
import { DotReporter } from './dot.ts'

export interface Reporter {
  onResult(results: TestResults, env?: string): void
  onSummary(counts: Counts, durationMs: number): void
  onSectionStart(label: string): void
}

export { SpecReporter, TapReporter, DotReporter }

export function createReporter(type: string): Reporter {
  switch (type) {
    case 'tap':
      return new TapReporter()
    case 'dot':
      return new DotReporter()
    case 'spec':
    default:
      return new SpecReporter()
  }
}

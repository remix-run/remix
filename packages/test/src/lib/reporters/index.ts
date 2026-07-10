import { DotReporter } from './dot.ts'
import { FilesReporter } from './files.ts'
import type { Counts, TestResults } from './results.ts'
import { SpecReporter } from './spec.ts'
import { TapReporter } from './tap.ts'

export interface Reporter {
  onResult(results: TestResults, env?: string): void
  onSummary(counts: Counts, durationMs: number): void
  onSectionStart(label: string): void
}

export interface ReporterOptions {
  quiet?: boolean
}

export { DotReporter, FilesReporter, SpecReporter, TapReporter }

export function createReporter(type: string, options: ReporterOptions = {}): Reporter {
  switch (type) {
    case 'tap':
      return new TapReporter(options)
    case 'dot':
      return new DotReporter(options)
    case 'files':
      return new FilesReporter(options)
    case 'spec':
    default:
      return new SpecReporter(options)
  }
}

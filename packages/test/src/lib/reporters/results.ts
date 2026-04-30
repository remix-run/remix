import type { V8CoverageEntry } from '../coverage'

export interface TestResult {
  name: string
  suiteName: string
  filePath?: string
  status: 'passed' | 'failed' | 'skipped' | 'todo'
  error?: {
    message: string
    stack?: string
  }
  duration: number
}

export interface TestResults {
  passed: number
  failed: number
  skipped: number
  todo: number
  tests: TestResult[]
  e2eBrowserCoverageEntries?: Array<{ entries: V8CoverageEntry[]; baseUrl: string }>
}

export type Counts = {
  passed: number
  failed: number
  skipped: number
  todo: number
}

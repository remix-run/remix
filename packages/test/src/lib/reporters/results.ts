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
}

export type Counts = {
  passed: number
  failed: number
  skipped: number
  todo: number
}

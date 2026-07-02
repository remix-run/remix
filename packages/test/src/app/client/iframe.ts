import { runTests } from '../../lib/executor.ts'
import type { SerializedTestNamePattern } from '../../lib/config.ts'

const params = new URLSearchParams(location.search)
const testFile = params.get('file')!
const rawTestNamePatterns = params.get('testNamePatterns')
const testNamePatterns = rawTestNamePatterns
  ? (JSON.parse(rawTestNamePatterns) as SerializedTestNamePattern[])
  : undefined

try {
  await import(testFile)
  let results = await runTests({ testNamePatterns })
  window.parent.postMessage({ type: 'test-results', results }, '*')
} catch (error: any) {
  window.parent.postMessage(
    {
      type: 'test-error',
      error: { message: error?.message ?? String(error), stack: error?.stack },
    },
    '*',
  )
}

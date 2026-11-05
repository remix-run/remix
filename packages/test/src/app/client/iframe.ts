import { runTests } from '../../lib/executor.ts'
import type { SerializedOnlyPattern } from '../../lib/config.ts'

const params = new URLSearchParams(location.search)
const testFile = params.get('file')!
const rawOnly = params.get('only')
const only = rawOnly ? (JSON.parse(rawOnly) as SerializedOnlyPattern[]) : undefined

try {
  await import(testFile)
  let results = await runTests({ only })
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

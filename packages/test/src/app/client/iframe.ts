import { runTests } from '../../lib/executor.ts'
import type { SerializedOnlyPattern } from '../../lib/config.ts'

const resultWindow: Window = window.opener ?? window.parent
const params = new URLSearchParams(location.search)
const testFile = params.get('file')!
const rawOnly = params.get('only')
const only = rawOnly ? (JSON.parse(rawOnly) as SerializedOnlyPattern[]) : undefined

if (params.get('isolation') === 'window' && document.readyState !== 'complete') {
  // Firefox defers history traversal while its isolated test window is loading.
  window.addEventListener('load', () => void runTestFile(), { once: true })
} else {
  await runTestFile()
}

async function runTestFile(): Promise<void> {
  try {
    await import(testFile)
    let results = await runTests({ only })
    resultWindow.postMessage({ type: 'test-results', results }, '*')
  } catch (error: any) {
    resultWindow.postMessage(
      {
        type: 'test-error',
        error: { message: error?.message ?? String(error), stack: error?.stack },
      },
      '*',
    )
  }
}

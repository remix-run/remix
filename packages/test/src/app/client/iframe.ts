import { runTests } from '../../lib/executor.ts'
import type { SerializedOnlyPattern } from '../../lib/config.ts'

const params = new URLSearchParams(location.search)
const testFile = params.get('file')!
const rawOnly = params.get('only')
const only = rawOnly ? (JSON.parse(rawOnly) as SerializedOnlyPattern[]) : undefined
const resultWindow: Window = window.opener ?? window.parent
// Recovery must use the real clock and network even when tests mock them.
const fetchFromRunner = window.fetch.bind(window)
const realSetTimeout = window.setTimeout.bind(window)

if (params.get('isolation') === 'window' && document.readyState !== 'complete') {
  // Firefox defers history traversal while its test window is loading.
  window.addEventListener('load', () => void runTestFile(), { once: true })
} else {
  await runTestFile()
}

async function runTestFile(): Promise<void> {
  try {
    await import(testFile)
    let results = await runTests({
      only,
      onHistoryQuotaExceeded: params.has('historyBackoff')
        ? async (testName) => {
            let response = await fetchFromRunner(
              `/history-quota?${new URLSearchParams({ file: testFile, test: testName })}`,
            )
            if (!response.ok) throw new Error('Failed to recover the browser history budget')
            // WebKit shares a 100-update quota across the main document and its frames,
            // resetting it after more than 10 seconds. Wait 11 seconds to allow a margin.
            // https://github.com/WebKit/WebKit/blob/31fdaeb27daf545ea0bbef129d1695c5844c46b9/Source/WebCore/page/History.cpp#L211-L238
            await new Promise<void>((resolve) => realSetTimeout(resolve, 11_000))
          }
        : undefined,
    })
    resultWindow.postMessage({ type: 'test-results', results }, location.origin)
  } catch (error) {
    resultWindow.postMessage(
      {
        type: 'test-error',
        error:
          error instanceof Error
            ? { message: error.message, stack: error.stack }
            : { message: String(error) },
      },
      location.origin,
    )
  }
}

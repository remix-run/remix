import { runTests } from '../../lib/executor.ts'
import { render } from '../../lib/render.ts'

const params = new URLSearchParams(location.search)
const testFile = params.get('file')!

try {
  await import(testFile)
  let results = await runTests({ render })
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

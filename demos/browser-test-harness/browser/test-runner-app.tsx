import { clientEntry, on, type Handle } from 'remix/component'
import { setupTestFramework, resetTestFramework } from './test-framework.ts'
import { setupAssertions } from './assertions.ts'
import { runTests } from './test-executor.ts'

export let TestStatus = clientEntry(
  '/_bundle/test-runner-app.js#TestStatus',
  function TestStatus(handle: Handle, setup: { testFiles: string[] }) {
    let status = 'Running tests...'
    let done = false

    async function run() {
      try {
        setupTestFramework()
        setupAssertions()

        let allResults = { passed: 0, failed: 0, tests: [] as any[] }

        for (let testFile of setup.testFiles) {
          resetTestFramework()
          await import(`/_module/${encodeURIComponent(testFile)}`)
          let results = await runTests()
          allResults.passed += results.passed
          allResults.failed += results.failed
          allResults.tests.push(...results.tests.map((t) => ({ ...t, filePath: testFile })))
        }

        ;(window as any).__testResults = allResults
        status = `${allResults.passed} passed, ${allResults.failed} failed`
      } catch (error: any) {
        console.error('Error running tests:', error)
        ;(window as any).__testResults = { passed: 0, failed: 1, tests: [] }
        status = 'Error: ' + error.message
      }
      done = true
      handle.update()
    }

    handle.queueTask(() => run())

    return () => (
      <div id="test-status">
        <span>{status}</span>
        {done && (
          <button
            type="button"
            mix={[on('click', () => window.location.reload())]}
          >
            Re-run
          </button>
        )}
      </div>
    )
  },
)

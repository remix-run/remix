import { clientEntry, type Handle } from 'remix/component'
import { setupTestFramework } from './test-framework.ts'
import { setupAssertions } from './assertions.ts'
import { runTests } from './test-executor.ts'

export let TestStatus = clientEntry(
  '/_bundle/test-runner-app.js#TestStatus',
  function TestStatus(handle: Handle, setup: { testFile: string }) {
    let status = 'Running tests...'

    function init() {
      setupTestFramework()
      setupAssertions()
    }

    async function run() {
      try {
        await import(`/_module/${setup.testFile}`)
        let results = await runTests()
        ;(window as any).__testResults = results
        status = `${results.passed} passed, ${results.failed} failed`
      } catch (error: any) {
        console.error('Error running tests:', error)
        ;(window as any).__testResults = { passed: 0, failed: 1, tests: [] }
        status = 'Error: ' + error.message
      }
      handle.update()
    }

    handle.queueTask(() => init())
    handle.queueTask(() => run())

    return () => <div id="test-status">{status}</div>
  },
)

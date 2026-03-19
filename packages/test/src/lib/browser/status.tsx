import { clientEntry, on, type Handle } from '@remix-run/component'
import { runTests } from '../executor.ts'
import { normalizeFilePath, normalizeLine } from './utils.ts'

// Matches `file:line:col` at end of a stack frame, e.g. `(fixtures/foo.ts:10:5)` or ` fixtures/foo.ts:10:5`
let frameLocRe = /([^():\s][^():]*\.[jt]sx?):(\d+):(\d+)/

function renderStack(stack: string, baseDir: string) {
  return stack.split('\n').map((raw, i) => {
    let isTestModule = raw.includes('/@test/')
    let line = normalizeLine(raw)
    let match = isTestModule ? frameLocRe.exec(line) : null
    if (match) {
      let [full, file, row, col] = match
      let abs = `${baseDir}/${file}`
      let href = `vscode://file/${abs}:${row}:${col}`
      let before = line.slice(0, match.index)
      let after = line.slice(match.index + full.length)
      return (
        <div key={i}>
          {before}
          <a
            href={href}
            style={{ color: 'inherit', textDecoration: 'underline', textDecorationColor: '#aaa' }}
          >
            {full}
          </a>
          {after}
        </div>
      )
    }
    return <div key={i}>{line}</div>
  })
}

type TestResult = {
  name: string
  suiteName: string
  filePath?: string
  status: 'passed' | 'failed'
  error?: { message: string; stack?: string }
  duration: number
}

export const TestStatus = clientEntry(
  'entry.js#TestStatus',
  function TestStatus(handle: Handle, setup: { testFiles: string[]; baseDir: string }) {
    let done = false
    let allResults = { passed: 0, failed: 0, tests: [] as TestResult[] }

    async function run() {
      try {
        for (let testFile of setup.testFiles) {
          await import(testFile)
          let { passed, failed, tests } = await runTests()
          allResults.passed += passed
          allResults.failed += failed
          tests.forEach((t) => allResults.tests.push({ ...t, filePath: testFile }))
          handle.update()
        }

        ;(window as any).__testResults = allResults
      } catch (error: any) {
        console.error('Error running tests:', error)
        ;(window as any).__testResults = { passed: 0, failed: 1, tests: [] }
      }
      done = true
      handle.update()
    }

    handle.queueTask(() => run())

    return () => {
      let fileMap = new Map<string, Map<string, TestResult[]>>()
      for (let test of allResults.tests) {
        let file = test.filePath || 'Unknown'
        let suite = test.suiteName || 'Tests'
        if (!fileMap.has(file)) fileMap.set(file, new Map())
        let suiteMap = fileMap.get(file)!
        if (!suiteMap.has(suite)) suiteMap.set(suite, [])
        suiteMap.get(suite)!.push(test)
      }

      let hasFailed = allResults.failed > 0

      return (
        <div
          id="test-status"
          style={{ fontFamily: 'monospace', padding: '16px', maxWidth: '900px' }}
        >
          <div
            style={{
              marginBottom: '16px',
              fontSize: '16px',
              fontWeight: 'bold',
              color: !done ? '#666' : hasFailed ? '#dc2626' : '#16a34a',
            }}
          >
            {!done
              ? `Running… (${allResults.passed} passed, ${allResults.failed} failed so far)`
              : `${allResults.passed} passed, ${allResults.failed} failed`}
          </div>

          {Array.from(fileMap.entries()).map(([file, suiteMap]) => (
            <details open style={{ marginBottom: '12px' }}>
              <summary
                style={{
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  padding: '4px 0',
                  userSelect: 'none',
                }}
              >
                {normalizeFilePath(file)}
              </summary>
              <div style={{ marginLeft: '16px', marginTop: '4px' }}>
                {Array.from(suiteMap.entries()).map(([suiteName, tests]) => {
                  let suiteFailed = tests.some((t) => t.status === 'failed')
                  return (
                    <details open={suiteFailed} style={{ marginBottom: '8px' }}>
                      <summary
                        style={{
                          cursor: 'pointer',
                          padding: '2px 0',
                          color: suiteFailed ? '#dc2626' : '#16a34a',
                          userSelect: 'none',
                        }}
                      >
                        <span style={{ marginLeft: '6px' }}>
                          {suiteFailed ? '✗' : '✓'} {suiteName}
                        </span>
                      </summary>
                      <div style={{ marginLeft: '16px', marginTop: '4px' }}>
                        {tests.map((test) => (
                          <div style={{ padding: '3px 18px' }}>
                            <div
                              style={{ color: test.status === 'passed' ? '#16a34a' : '#dc2626' }}
                            >
                              {test.status === 'passed' ? '✓' : '✗'} {test.name}{' '}
                              <span style={{ color: '#999', fontSize: '0.85em' }}>
                                ({test.duration.toFixed(2)}ms)
                              </span>
                            </div>
                            {test.error && (
                              <pre
                                style={{
                                  margin: '4px 0 4px 16px',
                                  padding: '8px 12px',
                                  fontSize: '12px',
                                  color: '#dc2626',
                                  background: '#fff5f5',
                                  borderLeft: '3px solid #dc2626',
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word',
                                }}
                              >
                                {test.error.message}
                                {test.error.stack && (
                                  <div style={{ color: '#999', marginTop: '6px' }}>
                                    {renderStack(test.error.stack, setup.baseDir)}
                                  </div>
                                )}
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    </details>
                  )
                })}
              </div>
            </details>
          ))}

          {done && (
            <button
              type="button"
              mix={[on('click', () => window.location.reload())]}
              style={{ marginTop: '8px', padding: '6px 12px', cursor: 'pointer' }}
            >
              Re-run
            </button>
          )}
        </div>
      )
    }
  },
)

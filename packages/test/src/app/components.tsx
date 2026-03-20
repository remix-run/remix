import { clientEntry, css, on, type Handle } from '@remix-run/component'
import { runTests } from '../lib/executor.ts'
import { normalizeLine } from '../lib/utils.ts'

type TestResult = {
  name: string
  suiteName: string
  filePath?: string
  status: 'passed' | 'failed' | 'skipped' | 'todo'
  error?: { message: string; stack?: string }
  duration: number
}

let styles = {
  container: css({ fontFamily: 'monospace', padding: '16px', maxWidth: '900px' }),
  summary: css({ marginBottom: '16px', lineHeight: '1.6' }),
  summaryRow: css({ display: 'block' }),
  info: css({ color: '#0ea5e9' }),
  indent: css({ marginLeft: '16px', marginTop: '4px' }),
  suiteDetails: css({ marginBottom: '8px' }),
  suiteSummary: css({ cursor: 'pointer', padding: '2px 0', userSelect: 'none' }),
  suiteIcon: css({ marginLeft: '6px' }),
  testItem: css({ padding: '3px 18px' }),
  testDuration: css({ color: '#999', fontSize: '0.85em' }),
  errorPre: css({
    margin: '4px 0 4px 16px',
    padding: '8px 12px',
    fontSize: '12px',
    color: '#dc2626',
    background: '#fff5f5',
    borderLeft: '3px solid #dc2626',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  }),
  errorStack: css({ color: '#999', marginTop: '6px' }),
  button: css({ marginTop: '8px', padding: '6px 12px', cursor: 'pointer' }),
  stackLink: css({ color: 'inherit', textDecoration: 'underline', textDecorationColor: '#aaa' }),
  passed: css({ color: '#16a34a' }),
  failed: css({ color: '#dc2626' }),
  muted: css({ color: '#666' }),
  todo: css({ color: '#a16207' }),
}

export const Tests = clientEntry(
  'entry.js#Tests',
  function Tests(handle: Handle, setup: { testFiles: string[]; baseDir: string }) {
    let done = false
    let startTime = performance.now()
    let allResults = { passed: 0, failed: 0, skipped: 0, todo: 0, tests: [] as TestResult[] }

    async function run() {
      try {
        for (let testFile of setup.testFiles) {
          await import(testFile)
          let { passed, failed, skipped, todo, tests } = await runTests()
          let fileResults = {
            passed,
            failed,
            skipped,
            todo,
            tests: tests.map((t) => ({ ...t, filePath: testFile })),
          }
          await fetch('/file-results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fileResults),
          })
          allResults.passed += passed
          allResults.failed += failed
          allResults.skipped += skipped
          allResults.todo += todo
          tests.forEach((t) => allResults.tests.push({ ...t, filePath: testFile }))
          handle.update()
        }
      } catch (error: any) {
        console.error('Error running tests:', error)
      }
      ;(window as any).__testsDone = true
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

      let durationMs = performance.now() - startTime

      return (
        <div id="test-status" mix={[styles.container]}>
          <div mix={[styles.summary]}>
            <span mix={[styles.summaryRow]}><span mix={[styles.info]}>ℹ</span> tests {allResults.passed + allResults.failed + allResults.skipped + allResults.todo}</span>
            <span mix={[styles.summaryRow]}><span mix={[styles.info]}>ℹ</span> pass {allResults.passed}</span>
            <span mix={[styles.summaryRow]}><span mix={[styles.info]}>ℹ</span> fail {allResults.failed}</span>
            {allResults.skipped > 0 && <span mix={[styles.summaryRow]}><span mix={[styles.info]}>ℹ</span> skipped {allResults.skipped}</span>}
            {allResults.todo > 0 && <span mix={[styles.summaryRow]}><span mix={[styles.info]}>ℹ</span> todo {allResults.todo}</span>}
            {done && <span mix={[styles.summaryRow]}><span mix={[styles.info]}>ℹ</span> duration_ms {durationMs.toFixed(5)}</span>}
          </div>

          {Array.from(fileMap.entries()).map(([, suiteMap]) =>
            Array.from(suiteMap.entries()).map(([suiteName, tests]) => (
              <TestSuite suiteName={suiteName} tests={tests} baseDir={setup.baseDir} />
            )),
          )}

          {done && (
            <button
              type="button"
              mix={[styles.button, on('click', () => window.location.reload())]}
            >
              Re-run
            </button>
          )}
        </div>
      )
    }
  },
)

function TestSuite(_handle: Handle, _setup: undefined) {
  return ({ suiteName, tests, baseDir }: { suiteName: string; tests: TestResult[]; baseDir: string }) => {
    let suiteFailed = tests.some((t) => t.status === 'failed')
    let suiteAllSkipped = tests.every((t) => t.status === 'skipped')
    let suiteAllTodo = tests.every((t) => t.status === 'todo')
    let suiteStyle = suiteFailed ? styles.failed : suiteAllSkipped ? styles.muted : suiteAllTodo ? styles.todo : styles.passed
    let suiteIcon = suiteFailed ? '✗' : suiteAllSkipped ? '↓' : suiteAllTodo ? '…' : '✓'
    return (
      <details open={suiteFailed} mix={[styles.suiteDetails]}>
        <summary mix={[styles.suiteSummary, suiteStyle]}>
          <span mix={[styles.suiteIcon]}>
            {suiteIcon} {suiteName}{suiteAllSkipped ? ' # skipped' : suiteAllTodo ? ' # todo' : ''}
          </span>
        </summary>
        <div mix={[styles.indent]}>
          {tests.map((test) => (
            <div mix={[styles.testItem]}>
              {test.status === 'passed' && (
                <div mix={[styles.passed]}>
                  ✓ {test.name}{' '}
                  <span mix={[styles.testDuration]}>({test.duration.toFixed(2)}ms)</span>
                </div>
              )}
              {test.status === 'failed' && (
                <div mix={[styles.failed]}>
                  ✗ {test.name}{' '}
                  <span mix={[styles.testDuration]}>({test.duration.toFixed(2)}ms)</span>
                  {test.error && (
                    <pre mix={[styles.errorPre]}>
                      {test.error.message}
                      {test.error.stack && (
                        <div mix={[styles.errorStack]}>
                          <Stack stack={test.error.stack} baseDir={baseDir} />
                        </div>
                      )}
                    </pre>
                  )}
                </div>
              )}
              {test.status === 'skipped' && test.name && (
                <div mix={[styles.muted]}>↓ {test.name} # skipped</div>
              )}
              {test.status === 'todo' && test.name && (
                <div mix={[styles.todo]}>… {test.name} # todo</div>
              )}
            </div>
          ))}
        </div>
      </details>
    )
  }
}

function Stack(_handle: Handle, _setup: undefined) {
  // Matches `file:line:col` at end of a stack frame, e.g. `(fixtures/foo.ts:10:5)` or ` fixtures/foo.ts:10:5`
  let frameLocRe = /([^():\s][^():]*\.[jt]sx?):(\d+):(\d+)/

  return ({ stack, baseDir }: { stack: string; baseDir: string }) => (
    <>
      {stack.split('\n').map((raw, i) => {
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
              <a href={href} mix={[styles.stackLink]}>
                {full}
              </a>
              {after}
            </div>
          )
        }
        return <div key={i}>{line}</div>
      })}
    </>
  )
}

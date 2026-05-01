import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createStepProgressReporter, runProgressStep, type StatusChannel } from './reporter.ts'

describe('progress adapter', () => {
  it('maps running and complete step labels onto the reporter status channel', async () => {
    let calls: string[] = []
    let status = createMockStatusChannel(calls)
    let progress = createStepProgressReporter(status, {
      environment: {
        complete: 'environment',
        running: 'Checking environment',
      },
    })

    progress.start('environment')
    progress.succeed('environment')
    progress.writeSummaryGap()

    assert.deepEqual(calls, ['start:Checking environment', 'succeed:environment', 'summary-gap'])
  })

  it('marks progress as failed when the wrapped step throws', async () => {
    let calls: string[] = []
    let status = createMockStatusChannel(calls)
    let progress = createStepProgressReporter(status, {
      actions: 'actions',
    })

    await assert.rejects(
      runProgressStep(progress, 'actions', async () => {
        throw new Error('boom')
      }),
      /boom/,
    )

    assert.deepEqual(calls, ['start:actions', 'fail:actions'])
  })
})

function createMockStatusChannel(calls: string[]): StatusChannel {
  return {
    blank() {},
    bullet() {},
    bullets() {},
    async commandHeader() {},
    dedent() {},
    failStep(label) {
      calls.push(`fail:${label ?? ''}`)
    },
    indent() {},
    label() {
      return ''
    },
    line() {},
    section() {},
    skipStep(label, reason) {
      calls.push(`skip:${label}:${reason ?? ''}`)
    },
    startStep(label) {
      calls.push(`start:${label}`)
    },
    succeedStep(label) {
      calls.push(`succeed:${label ?? ''}`)
    },
    summaryGap() {
      calls.push('summary-gap')
    },
    table() {},
    withIndent<result>(callback: () => result): result {
      return callback()
    },
  }
}

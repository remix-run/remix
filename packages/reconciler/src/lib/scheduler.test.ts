import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createScheduler } from './scheduler.ts'

describe('scheduler', () => {
  it('flushes enqueued roots in insertion order', () => {
    let scheduler = createScheduler()
    let calls: string[] = []
    let first = {
      flushWork() {
        calls.push('first')
      },
    }
    let second = {
      flushWork() {
        calls.push('second')
      },
    }

    scheduler.enqueue(first)
    scheduler.enqueue(second)
    scheduler.flush()

    assert.deepEqual(calls, ['first', 'second'])
  })

  it('dispose clears queued roots and resets scheduled state', () => {
    let scheduler = createScheduler()
    let calls = 0
    let root = {
      flushWork() {
        calls++
      },
    }

    scheduler.enqueue(root)
    scheduler.dispose()
    scheduler.flush()
    assert.equal(calls, 0)

    scheduler.enqueue(root)
    scheduler.flush()
    assert.equal(calls, 1)
  })

  it('flush drains roots enqueued during a flush cycle', () => {
    let scheduler = createScheduler()
    let calls: string[] = []
    let second = {
      flushWork() {
        calls.push('second')
      },
    }
    let first = {
      flushWork() {
        calls.push('first')
        scheduler.enqueue(second)
      },
    }

    scheduler.enqueue(first)
    scheduler.flush()

    assert.deepEqual(calls, ['first', 'second'])
  })
})

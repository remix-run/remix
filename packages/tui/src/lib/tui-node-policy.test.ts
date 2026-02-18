import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  assertTuiTreeConsistency,
  createTuiContainer,
  createTuiNodePolicy,
} from './tui-node-policy.ts'
import { createTestHostBridge } from '../testing/test-host-bridge.ts'

describe('tui node policy', () => {
  it('maintains parent and child invariants through insert/move/remove', () => {
    let bridge = createTestHostBridge()
    let policy = createTuiNodePolicy()
    let container = createTuiContainer({ type: 'root' }, bridge)
    let first = policy.createElement(container, 'box')
    let second = policy.createElement(container, 'text')
    let text = policy.createText('hello')

    policy.insert(container, first, null)
    policy.insert(container, second, null)
    policy.insert(first, text, null)
    policy.move(container, second, first)
    policy.remove(first, text)

    assert.deepEqual(
      container.children.map((child) => (child.kind === 'element' ? child.type : 'text')),
      ['text', 'box'],
    )
    assert.equal(first.children.length, 0)
    assertTuiTreeConsistency(container)
  })

  it('throws on illegal operations', () => {
    let bridge = createTestHostBridge()
    let policy = createTuiNodePolicy()
    let container = createTuiContainer({ type: 'root' }, bridge)
    let a = policy.createElement(container, 'box')
    let b = policy.createElement(container, 'box')

    policy.insert(container, a, null)
    assert.throws(() => policy.remove(container, b), /illegal remove/)
    assert.throws(() => policy.move(container, b, null), /illegal move/)
    assert.throws(() => policy.insert(container, a, null), /illegal insert/)
  })
})

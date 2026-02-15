import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createTestContainer, createTestNodePolicy, stringifyTestNode } from './test-node-policy.ts'

describe('test node policy', () => {
  it('supports basic create/insert/move/remove operations', () => {
    let policy = createTestNodePolicy()
    let container = createTestContainer()

    let alpha = policy.createElement(container, 'alpha')
    let beta = policy.createElement(container, 'beta')
    let text = policy.createText(container, 'x')

    policy.insert(container, alpha, null)
    policy.insert(container, beta, null)
    policy.insert(container, text, null)
    assert.equal(stringifyTestNode(container), '<alpha></alpha><beta></beta>x')

    policy.move(container, beta, alpha)
    assert.equal(stringifyTestNode(container), '<beta></beta><alpha></alpha>x')

    policy.remove(container, alpha)
    assert.equal(stringifyTestNode(container), '<beta></beta>x')
  })

  it('resolves matching traversal nodes for hydration', () => {
    let policy = createTestNodePolicy()
    let container = createTestContainer()
    let text = policy.createText(container, 'hello')
    let node = policy.createElement(container, 'div')
    policy.insert(container, text, null)
    policy.insert(container, node, null)

    let start = policy.begin(container)
    let resolvedText = policy.resolveText(container, start, 'updated')
    assert.equal(resolvedText.node.value, 'updated')
    let resolvedElement = policy.resolveElement(container, resolvedText.next, 'div')
    assert.equal(resolvedElement.node.type, 'div')
  })
})

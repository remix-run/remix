import { describe, it } from 'node:test'
import assert from 'node:assert'
import { topologicalSortAndGroup } from './topological-sort.ts'

describe('topologicalSortAndGroup', () => {
  it('handles empty input', () => {
    let result = topologicalSortAndGroup([])
    assert.deepStrictEqual(result, [])
  })

  it('handles single item with no dependencies', () => {
    let items = [{ name: 'a', dependencies: [] }]
    let result = topologicalSortAndGroup(items)

    assert.strictEqual(result.length, 1)
    assert.deepStrictEqual(
      result[0].map((i) => i.name),
      ['a'],
    )
  })

  it('puts all independent items in one group', () => {
    let items = [
      { name: 'a', dependencies: [] },
      { name: 'b', dependencies: [] },
      { name: 'c', dependencies: [] },
    ]
    let result = topologicalSortAndGroup(items)

    // All independent items should be in one group
    assert.strictEqual(result.length, 1)
    assert.strictEqual(result[0].length, 3)
    assert.deepStrictEqual(result[0].map((i) => i.name).sort(), ['a', 'b', 'c'])
  })

  it('creates separate groups for linear chain', () => {
    // c depends on b, b depends on a
    let items = [
      { name: 'c', dependencies: ['b'] },
      { name: 'a', dependencies: [] },
      { name: 'b', dependencies: ['a'] },
    ]
    let result = topologicalSortAndGroup(items)

    assert.strictEqual(result.length, 3)
    assert.deepStrictEqual(
      result.map((group) => group.map((i) => i.name)),
      [['a'], ['b'], ['c']],
    )
  })

  it('groups parallel dependencies in same group', () => {
    // d depends on b and c, both b and c depend on a
    let items = [
      { name: 'd', dependencies: ['b', 'c'] },
      { name: 'b', dependencies: ['a'] },
      { name: 'c', dependencies: ['a'] },
      { name: 'a', dependencies: [] },
    ]
    let result = topologicalSortAndGroup(items)

    // Should be: [a], [b, c], [d]
    assert.strictEqual(result.length, 3)
    assert.deepStrictEqual(
      result[0].map((i) => i.name),
      ['a'],
    )
    assert.deepStrictEqual(result[1].map((i) => i.name).sort(), ['b', 'c'])
    assert.deepStrictEqual(
      result[2].map((i) => i.name),
      ['d'],
    )
  })

  it('ignores dependencies not in the set', () => {
    // b depends on a and x, but x is not in the set
    let items = [
      { name: 'b', dependencies: ['a', 'x'] },
      { name: 'a', dependencies: [] },
    ]
    let result = topologicalSortAndGroup(items)

    // Should be two groups: [a], then [b]
    assert.strictEqual(result.length, 2)
    assert.deepStrictEqual(
      result[0].map((i) => i.name),
      ['a'],
    )
    assert.deepStrictEqual(
      result[1].map((i) => i.name),
      ['b'],
    )
  })

  it('throws on circular dependency (direct)', () => {
    // a depends on b, b depends on a
    let items = [
      { name: 'a', dependencies: ['b'] },
      { name: 'b', dependencies: ['a'] },
    ]
    assert.throws(
      () => topologicalSortAndGroup(items),
      /Circular dependency detected involving: a, b|Circular dependency detected involving: b, a/,
    )
  })

  it('throws on circular dependency (indirect)', () => {
    // a -> b -> c -> a
    let items = [
      { name: 'a', dependencies: ['c'] },
      { name: 'b', dependencies: ['a'] },
      { name: 'c', dependencies: ['b'] },
    ]
    assert.throws(() => topologicalSortAndGroup(items), /Circular dependency detected/)
  })

  it('preserves original item properties', () => {
    let items = [
      { name: 'b', dependencies: ['a'], extra: 'data-b' },
      { name: 'a', dependencies: [], extra: 'data-a' },
    ]
    let result = topologicalSortAndGroup(items)

    // First group contains 'a', second contains 'b'
    assert.strictEqual(result[0][0].extra, 'data-a')
    assert.strictEqual(result[1][0].extra, 'data-b')
  })
})

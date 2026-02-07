import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { lazy } from './lazy.ts'
import { array, object, string } from './schema.ts'
import type { Issue, Schema, ValidationResult } from './schema.ts'

type NodeOutput = {
  id: string
  children: NodeOutput[]
}

function assertSuccess<output>(
  result: ValidationResult<output>,
): asserts result is { value: output } {
  assert.ok(!result.issues)
}

function assertFailure<output>(
  result: ValidationResult<output>,
): asserts result is { issues: ReadonlyArray<Issue> } {
  assert.ok(result.issues)
}

describe('lazy', () => {
  it('validates recursive schemas', () => {
    let Node: Schema<unknown, NodeOutput>

    Node = lazy(function () {
      return object({
        id: string(),
        children: array(Node),
      })
    })

    let result = Node['~standard'].validate({
      id: 'root',
      children: [{ id: 'child', children: [] }],
    })

    assertSuccess(result)
    assert.equal(result.value.children.length, 1)
  })

  it('fails when recursive node is invalid', () => {
    let Node: Schema<unknown, NodeOutput>

    Node = lazy(function () {
      return object({
        id: string(),
        children: array(Node),
      })
    })

    let result = Node['~standard'].validate({ id: 'root', children: [{ id: 123, children: [] }] })

    assertFailure(result)
    assert.deepEqual(result.issues[0].path, ['children', 0, 'id'])
  })
})

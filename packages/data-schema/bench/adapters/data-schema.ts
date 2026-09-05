import * as checks from '../../dist/checks.js'
import * as s from '../../dist/index.js'

import { expectsSuccess, getInput } from '../fixtures.ts'
import type { BenchmarkAdapter, PreparedBenchmark, WorkloadId } from '../types.ts'

function createUserSchema() {
  return s.object({
    id: s.string().pipe(checks.minLength(1), checks.maxLength(64)),
    name: s.string().pipe(checks.minLength(1), checks.maxLength(80)),
    email: s.string().pipe(checks.email()),
    age: s.number().pipe(checks.min(0), checks.max(130)),
    active: s.boolean(),
    role: s.enum_(['admin', 'member', 'viewer']),
    address: s.object({
      street: s.string().pipe(checks.minLength(1)),
      city: s.string().pipe(checks.minLength(1)),
      postalCode: s.string().pipe(checks.minLength(1), checks.maxLength(20)),
    }),
    tags: s.array(s.string().pipe(checks.maxLength(24))),
    metadata: s.object({
      createdAt: s.string(),
      score: s.number(),
      verified: s.boolean(),
    }),
  })
}

function createSchema(): object {
  return createUserSchema()
}

function prepare(workload: WorkloadId): PreparedBenchmark {
  let input = getInput(workload)
  let expectedSuccess = expectsSuccess(workload)

  if (workload.endsWith('-array')) {
    let schema = s.array(createUserSchema())
    return { expectedSuccess, run: () => s.parseSafe(schema, input) }
  }

  let schema = createUserSchema()
  return { expectedSuccess, run: () => s.parseSafe(schema, input) }
}

export const adapter: BenchmarkAdapter = { createSchema, prepare }

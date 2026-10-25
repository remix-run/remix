import * as v from 'valibot'

import { expectsSuccess, getInput } from '../fixtures.ts'
import type { BenchmarkAdapter, PreparedBenchmark, WorkloadId } from '../types.ts'

function createUserSchema() {
  return v.object({
    id: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
    name: v.pipe(v.string(), v.minLength(1), v.maxLength(80)),
    email: v.pipe(v.string(), v.email()),
    age: v.pipe(v.number(), v.minValue(0), v.maxValue(130)),
    active: v.boolean(),
    role: v.picklist(['admin', 'member', 'viewer']),
    address: v.object({
      street: v.pipe(v.string(), v.minLength(1)),
      city: v.pipe(v.string(), v.minLength(1)),
      postalCode: v.pipe(v.string(), v.minLength(1), v.maxLength(20)),
    }),
    tags: v.array(v.pipe(v.string(), v.maxLength(24))),
    metadata: v.object({
      createdAt: v.string(),
      score: v.number(),
      verified: v.boolean(),
    }),
  })
}

function createSchema(): object {
  return createUserSchema()
}

function prepare(workload: WorkloadId): PreparedBenchmark {
  let schema = workload.endsWith('-array') ? v.array(createUserSchema()) : createUserSchema()
  let input = getInput(workload)
  let expectedSuccess = expectsSuccess(workload)

  return { expectedSuccess, run: () => v.safeParse(schema, input) }
}

export const adapter: BenchmarkAdapter = { createSchema, prepare }

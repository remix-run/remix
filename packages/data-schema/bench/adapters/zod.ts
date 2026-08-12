import * as z from 'zod'

import { expectsSuccess, getInput } from '../fixtures.ts'
import type { BenchmarkAdapter, PreparedBenchmark, WorkloadId } from '../types.ts'

function createUserSchema() {
  return z.object({
    id: z.string().min(1).max(64),
    name: z.string().min(1).max(80),
    email: z.string().email(),
    age: z.number().min(0).max(130),
    active: z.boolean(),
    role: z.enum(['admin', 'member', 'viewer']),
    address: z.object({
      street: z.string().min(1),
      city: z.string().min(1),
      postalCode: z.string().min(1).max(20),
    }),
    tags: z.array(z.string().max(24)),
    metadata: z.object({
      createdAt: z.string(),
      score: z.number(),
      verified: z.boolean(),
    }),
  })
}

function createSchema(): object {
  return createUserSchema()
}

function prepare(workload: WorkloadId): PreparedBenchmark {
  let schema = workload.endsWith('-array') ? z.array(createUserSchema()) : createUserSchema()
  let input = getInput(workload)
  let expectedSuccess = expectsSuccess(workload)

  return { expectedSuccess, run: () => schema.safeParse(input) }
}

export const adapter: BenchmarkAdapter = { createSchema, prepare }

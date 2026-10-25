import type { WorkloadId } from './types.ts'

const validUser = {
  id: 'user_123',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  age: 36,
  active: true,
  role: 'admin',
  address: {
    street: '12 St James Square',
    city: 'London',
    postalCode: 'SW1Y 4JH',
  },
  tags: ['math', 'programming', 'history'],
  metadata: {
    createdAt: '2026-08-12T12:00:00.000Z',
    score: 99.5,
    verified: true,
  },
}

const invalidUser = {
  id: '',
  name: '',
  email: 'not-an-email',
  age: -1,
  active: 'yes',
  role: 'owner',
  address: {
    street: 12,
    city: '',
    postalCode: 90210,
  },
  tags: ['this tag is much longer than twenty-four characters', 42],
  metadata: {
    createdAt: null,
    score: Number.NaN,
    verified: 'yes',
  },
}

const validUsers = Array.from({ length: 100 }, (_, index) => ({
  ...validUser,
  id: `user_${index}`,
}))

const invalidUsers = Array.from({ length: 100 }, (_, index) => ({
  ...invalidUser,
  id: index % 2 === 0 ? '' : index,
}))

export function getInput(workload: WorkloadId): unknown {
  switch (workload) {
    case 'valid-object':
      return validUser
    case 'invalid-object':
      return invalidUser
    case 'valid-array':
      return validUsers
    case 'invalid-array':
      return invalidUsers
  }
}

export function expectsSuccess(workload: WorkloadId): boolean {
  return workload === 'valid-object' || workload === 'valid-array'
}

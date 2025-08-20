import type { Assert, IsEqual } from './type-utils.d.ts'
import type { PatternsForResource } from './resource.ts'
import { createResource } from './resource.ts'

let user = createResource({
  name: 'user',
  index() {
    return fetch('/api/users')
  },
  show({ params }) {
    return fetch(`/api/users/${params.id}`)
  },
  new() {
    return fetch('/api/users/new')
  },
  edit() {
    return fetch('/api/users')
  },
})

// prettier-ignore
export type Tests = [
  Assert<IsEqual<
    PatternsForResource<typeof user>,
    | '/users'
    | '/users/new'
    | '/users/:id'
    | '/users/:id/edit'
  >>,
]

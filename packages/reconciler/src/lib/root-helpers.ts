import { invariant } from './invariant.ts'
import type { PreparedPlugin } from './types.ts'

export function removeActivePluginId(ids: number[], id: number) {
  let index = ids.indexOf(id)
  invariant(index !== -1, `active plugin id ${id} was not registered`)
  ids.splice(index, 1)
}

export function isPhasePluginAhead(ordered: PreparedPlugin<any>[], id: number, cursor: number) {
  for (let index = cursor + 1; index < ordered.length; index++) {
    if (ordered[index].id === id) return true
  }
  return false
}

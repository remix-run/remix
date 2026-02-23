import { invariant } from './invariant.ts'
import type { Plugin, PluginHostContext, PluginSetupHandle, PreparedPlugin } from './types.ts'

export function teardownPlugin<element>(
  plugin: Plugin<any>,
  context: PluginHostContext<element>,
  slot: unknown,
) {
  if (isSetupSlot<element>(slot)) {
    slot.handle.dispatchEvent(new Event('remove'))
    return
  }
  plugin.unmount?.(context, slot)
}

export function isSetupSlot<element>(
  slot: unknown,
): slot is {
  __rmxSetupSlot: true
  handle: PluginSetupHandle<element>
} {
  if (!slot || typeof slot !== 'object') return false
  let value = slot as { __rmxSetupSlot?: unknown; handle?: unknown }
  return value.__rmxSetupSlot === true && value.handle instanceof EventTarget
}

export function removeActivePluginId(ids: number[], id: number) {
  let index = ids.indexOf(id)
  invariant(index !== -1, `active plugin id ${id} was not registered`)
  ids.splice(index, 1)
}

export function isPhasePluginAhead(
  ordered: PreparedPlugin<any>[],
  id: number,
  cursor: number,
) {
  for (let index = cursor + 1; index < ordered.length; index++) {
    if (ordered[index].id === id) return true
  }
  return false
}

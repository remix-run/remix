import { invariant } from './invariant.ts'
import { createStyleManager } from '../style/index.ts'
import type { StyleManager } from '../style/index.ts'

let globalStyleManager =
  typeof window !== 'undefined' ? createStyleManager() : (null as unknown as StyleManager)

export { type StyleManager }
export { patchHostProps as diffHostProps } from './core/props.ts'

export let defaultStyleManager: StyleManager = globalStyleManager

/**
 * Reset the global style state. For testing only - not exported from index.ts.
 */
export function resetStyleState() {
  invariant(
    typeof window !== 'undefined',
    'resetStyleState() is only available in a browser environment',
  )
  globalStyleManager.dispose()
  globalStyleManager = createStyleManager()
  defaultStyleManager = globalStyleManager
}

export { transformComponent, maybeHasComponent, HMR_RUNTIME_PATH } from './lib/transform.ts'
export type { TransformResult } from './lib/transform.ts'

export {
  __hmr_state,
  __hmr_clear_state,
  __hmr_register,
  __hmr_call,
  __hmr_register_component,
  __hmr_get_component,
  __hmr_update,
  __hmr_setup,
  __hmr_get_tracked_handle_count,
} from './lib/runtime.ts'

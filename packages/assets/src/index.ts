/**
 * Core transform, resolution, and dev handler for unbundled assets.
 */

export { createDevAssetsHandler } from './lib/dev-handler.ts'
// TODO: Bike shed this and/or refactor.
export { createDevAssets } from './lib/dev-assets.ts'
export type {
  CreateDevAssetsHandlerOptions,
  DevAssetsWorkspaceOptions,
  DevAssetsEsbuildConfig,
} from './lib/options.ts'

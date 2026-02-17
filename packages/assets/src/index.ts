export { createDevAssetsHandler } from './lib/dev-handler.ts'
export { createDevAssets } from './lib/dev-assets.ts'
export { createAssets } from './lib/assets.ts'
export { defineFiles } from './lib/files.ts'
export { build } from './lib/build.ts'
export type { CreateDevAssetsHandlerOptions, BuildOptions } from './lib/options.ts'
export type { CreateDevAssetsOptions } from './lib/dev-assets.ts'
export type { CreateAssetsOptions } from './lib/assets.ts'
export type { AssetManifest } from './lib/manifest-types.ts'
export type {
  AssetEntry,
  AssetsApi,
  FilesConfig,
  FileRule,
  FileTransform,
  FileTransformContext,
  FileTransformResult,
} from './lib/files.ts'

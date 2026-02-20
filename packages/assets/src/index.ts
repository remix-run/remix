export { createDevAssetsHandler } from './lib/dev-handler.ts'
export { createDevAssetResolver } from './lib/dev-assets.ts'
export { createAssetResolver } from './lib/assets.ts'
export { defineAssetsSource } from './lib/files.ts'
export { build } from './lib/build.ts'
export {
  codegenPlaceholders,
  checkCodegenPlaceholders,
  watchCodegenPlaceholders,
  codegenBuild,
  substituteAssetPlaceholders,
} from './lib/codegen.ts'
export type { CreateDevAssetsHandlerOptions, BuildOptions } from './lib/options.ts'
export type { CreateDevAssetResolverOptions } from './lib/dev-assets.ts'
export type { CreateAssetResolverOptions } from './lib/assets.ts'
export type { AssetsManifest } from './lib/manifest-types.ts'
export type {
  CodegenOptions,
  CodegenCheckOptions,
  CodegenCheckResult,
  CodegenWatcher,
  CodegenBuildOptions,
  SubstituteAssetPlaceholdersOptions,
} from './lib/codegen.ts'
export type {
  AssetsSource,
  AssetEntry,
  AssetResolver,
  FilesConfig,
  FileRule,
  FileTransform,
  FileTransformContext,
  FileTransformResult,
} from './lib/files.ts'

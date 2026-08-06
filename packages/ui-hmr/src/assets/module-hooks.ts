/**
 * Creates module hooks compatible with `remix/assets` that transform Remix UI component modules for browser HMR.
 *
 * @returns Module hooks for `createAssetServer({ scripts: { moduleHooks } })`.
 */
export { createAssetsUiHmrModuleHooks as uiHmr } from '../lib/module-hooks.ts'

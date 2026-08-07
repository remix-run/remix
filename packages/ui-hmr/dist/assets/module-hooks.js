/**
 * Creates a `remix/assets` load hook that instruments Remix UI component modules for browser HMR.
 *
 * Add the returned hooks to `createAssetServer({ scripts: { moduleHooks } })` alongside an enabled
 * `hmr` channel. Modules that are not safe component HMR boundaries pass through unchanged.
 *
 * @returns Module hooks that run the Remix UI browser component transform.
 */
export { createAssetsUiHmrModuleHooks as uiHmr } from '../lib/module-hooks.js';

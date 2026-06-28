/**
 * Creates module hooks compatible with remix/assets that transform browser Remix UI component modules for HMR.
 *
 * @returns Module hooks, e.g. for `createAssetServer({ scripts: { moduleHooks } })`.
 */
export { createBrowserUiHmrModuleHooks as uiHmr } from "./lib/module-hooks.js";

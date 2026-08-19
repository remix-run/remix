/**
 * Creates a `remix/assets` loader that instruments Remix UI component modules for browser HMR.
 *
 * Add the returned loader to `createAssetServer({ scripts: { loaders } })` alongside an enabled
 * `hmr` channel. Modules that are not safe component HMR boundaries pass through unchanged.
 *
 * @returns A loader that runs the Remix UI browser component transform.
 */
export { createAssetsUiHmrLoader as uiHmr } from './lib/loaders.ts';
//# sourceMappingURL=assets.d.ts.map
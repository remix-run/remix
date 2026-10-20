/**
 * Creates a `remix/assets` loader that instruments Remix component modules for browser HMR.
 *
 * Add the returned loader to `createAssetServer({ scripts: { loaders } })` alongside an enabled
 * `hmr` channel. Modules that are not safe component HMR boundaries pass through unchanged.
 *
 * @returns A loader that runs the Remix browser component transform.
 */
export { createAssetsComponentHmrLoader as componentHmr } from './lib/loaders.ts';
//# sourceMappingURL=assets.d.ts.map
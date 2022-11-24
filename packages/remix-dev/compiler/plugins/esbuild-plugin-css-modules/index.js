// Local patched copy of https://github.com/indooorsman/esbuild-css-modules-plugin
// More details in readme and license included in plugin's root directory

/* eslint-disable */
// import pluginV1 from "./lib/v1";
import plugin from "./lib/plugin";
import { pluginName } from "./lib/utils";

/**
 * @type {(options: import('.').Options) => import('esbuild').Plugin}
 */
const CssModulesPlugin = (options = {}) => {
  return {
    name: pluginName,
    setup: async (build) => {
      const { bundle } = build.initialOptions;
      const { v2 } = options;
      const useV2 = v2 && bundle;

      if (useV2) {
        await plugin.setup(build, options);
      } else {
        // await pluginV1.setup(build, options);
      }
    },
  };
};

export default CssModulesPlugin;

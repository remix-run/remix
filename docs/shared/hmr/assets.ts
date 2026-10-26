import { componentHmr } from 'remix/component-hmr/assets'

export const docsAssetHmrOptions =
  process.env.REMIX_NODE_HMR === '1'
    ? {
        hmr: {
          channel: async () => (await import('remix/node-hmr/runtime')).createBrowserHmrChannel(),
          moduleImporter: 'remix/multiple-import-maps-polyfill',
        },
        scriptLoaders: [componentHmr()],
        watch: true,
      }
    : { hmr: undefined, scriptLoaders: undefined, watch: false }

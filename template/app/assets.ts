import { createAssetServer } from 'remix/assets'
import { uiHmr } from 'remix/ui-hmr/assets/module-hooks'

const rootDir = process.cwd()
const nodeEnv = process.env.NODE_ENV ?? 'development'
const isDevelopment = nodeEnv === 'development'

export const assetServer = createAssetServer({
  basePath: '/assets',
  rootDir,
  fileMap: {
    'app/*path': 'app/*path',
    'node_modules/*path': 'node_modules/*path',
    /* remix-template:remove-start This is only needed inside the Remix monorepo. */
    'packages/*path': '../packages/*path',
    /* remix-template:remove-end */
  },
  allowFiles: ['app/assets/**'],
  allowPackages: ['remix'],
  denyFiles: ['app/**/*.server.*'],
  sourceMaps: isDevelopment ? 'external' : undefined,
  minify: !isDevelopment,
  watch: isDevelopment,
  ...(isDevelopment &&
    process.env.REMIX_NODE_HMR && {
      hmr: async () => (await import('remix/node-hmr/runtime')).createBrowserHmrChannel(),
      scripts: { moduleHooks: [uiHmr()] },
    }),
})

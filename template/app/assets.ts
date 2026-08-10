import { createAssetServer } from 'remix/assets'
import { uiHmr } from 'remix/ui-hmr/assets'

const rootDir = process.cwd()
const nodeEnv = process.env.NODE_ENV ?? 'development'
const isDevelopment = nodeEnv === 'development'
const isHmr = Boolean(isDevelopment && process.env.REMIX_NODE_HMR)

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
  hmr: isHmr
    ? async () => (await import('remix/node-hmr/runtime')).createBrowserHmrChannel()
    : undefined,
  scripts: { loaders: isHmr ? [uiHmr()] : undefined },
})

import { createAssetServer } from 'remix/assets'

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
  allow: [
    'app/assets/**',
    'node_modules/**',
    /* remix-template:remove-start This is only needed inside the Remix monorepo. */
    '../packages/**',
    /* remix-template:remove-end */
  ],
  deny: ['app/**/*.server.*'],
  sourceMaps: isDevelopment ? 'external' : undefined,
  minify: !isDevelopment,
  watch: isDevelopment,
  scripts: {
    define: {
      'process.env.NODE_ENV': JSON.stringify(nodeEnv),
    },
  },
})

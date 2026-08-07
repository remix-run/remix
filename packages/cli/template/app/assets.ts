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
  },
  allowFiles: ['app/assets/**'],
  allowPackages: ['remix'],
  denyFiles: ['app/**/*.server.*'],
  sourceMaps: isDevelopment ? 'external' : undefined,
  minify: !isDevelopment,
  watch: false,
})

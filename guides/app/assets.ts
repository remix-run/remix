import { createAssetServer } from 'remix/assets'

const rootDir = process.cwd()

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
    'app/controllers/docs/examples/**/client.tsx',
    'node_modules/**',
    /* remix-template:remove-start This is only needed inside the Remix monorepo. */
    '../packages/**',
    /* remix-template:remove-end */
  ],
  deny: ['app/**/*.server.*'],
  sourceMaps: process.env.NODE_ENV === 'development' ? 'external' : undefined,
  scripts: {
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
    },
  },
})

import * as path from 'node:path'
import { createAssetServer } from 'remix/assets'

const DOCS_DIR = path.resolve(import.meta.dirname, '..', '..')
const REPO_DIR = path.resolve(DOCS_DIR, '..')

export const assetServer = createAssetServer({
  rootDir: REPO_DIR,
  basePath: '/(:version/)assets',
  fileMap: {
    '/demos/*path': 'docs/build/demos/*path',
    '/pkg/*path': 'packages/*path',
    '/client/*path': 'docs/src/client/*path',
    '/shared/*path': 'docs/src/shared/*path',
  },
  allow: ['docs/build/demos/**', 'docs/src/client/**', 'docs/src/shared/**', 'packages/**'],
  watch: process.env.NODE_ENV !== 'production',
})

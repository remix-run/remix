import * as fs from 'node:fs'
import * as path from 'node:path'

import { createAssetServer } from 'remix/assets'

const rootDir = process.cwd()
const workspacePackagesDir = path.resolve(rootDir, '..', 'packages')
const usesWorkspaceRemix = fs.existsSync(path.join(workspacePackagesDir, 'remix', 'src', 'ui.ts'))

export const assetServer = createAssetServer({
  basePath: '/assets',
  rootDir,
  fileMap: {
    'app/*path': 'app/*path',
    'node_modules/*path': 'node_modules/*path',
    ...(usesWorkspaceRemix ? { 'packages/*path': '../packages/*path' } : {}),
  },
  allow: ['app/assets/**', 'node_modules/**', ...(usesWorkspaceRemix ? ['../packages/**'] : [])],
  deny: ['app/**/*.server.*'],
  sourceMaps: process.env.NODE_ENV === 'development' ? 'external' : undefined,
  scripts: {
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
    },
  },
})

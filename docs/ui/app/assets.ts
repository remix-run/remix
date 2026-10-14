import * as path from 'node:path'
import { createAssetServer } from 'remix/assets'

const nodeEnv = process.env.NODE_ENV ?? 'production'
const isProduction = nodeEnv === 'production'

export const assetServer = createAssetServer({
  basePath: '/assets',
  rootDir: path.resolve(import.meta.dirname, '../../..'),
  allowFiles: [
    'docs/ui/app/**/public/**',
    'docs/shared/**/public/**',
    'docs/ui/app/examples/**/*.example.tsx',
  ],
  allowPackages: ['@remix-run/component', '@remix-run/ui', 'remix'],
  denyFiles: ['**/*.test.*'],
  mounts: {
    app: 'docs/ui/app',
    'docs-shared': 'docs/shared',
    npm: 'node_modules',
    packages: 'packages',
  },
  sourceMaps: isProduction ? undefined : 'external',
  minify: isProduction,
  fingerprint: isProduction,
  watch: false,
  scripts: { define: { 'process.env.NODE_ENV': JSON.stringify(nodeEnv) } },
})

export const scriptEntry = await assetServer.getScriptEntry(
  path.resolve(import.meta.dirname, 'actions/public/entry.ts'),
)
export const stylesheetHref = await assetServer.getHref(
  path.resolve(import.meta.dirname, 'actions/public/docs.css'),
)
export const stylesheetPreloads = await assetServer.getPreloads(
  path.resolve(import.meta.dirname, 'actions/public/docs.css'),
)

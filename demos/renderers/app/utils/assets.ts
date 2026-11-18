import * as path from 'node:path'
import { createAssetServer } from 'remix/assets'

import { assetsBase } from '../routes.ts'

const isDevelopment = process.env.NODE_ENV === 'development'

// The asset server is rooted at the monorepo so it can reach the pnpm store under the root
// `node_modules`. Remix itself stays on the server in this demo; only renderer code ships.
export const assets = createAssetServer({
  basePath: assetsBase,
  rootDir: path.resolve(import.meta.dirname, '../../../..'),
  allowFiles: ['demos/renderers/app/**/public/**'],
  // Preact publishes ES modules, so the browser loads it straight from node_modules.
  allowPackages: ['preact'],
  denyFiles: ['demos/renderers/app/**/*.test.*'],
  mounts: {
    app: 'demos/renderers/app',
    npm: 'node_modules',
  },
  scripts: {
    // React publishes CommonJS, which the asset server cannot serve. These specifiers are left
    // as-is for the import map in the React document to resolve to esm.unpkg.com.
    external: ['react', 'react/jsx-runtime', 'react-dom/client'],
  },
  sourceMaps: isDevelopment ? 'external' : undefined,
  minify: !isDevelopment,
  fingerprint: !isDevelopment,
  watch: false,
})

export const preactEntry = 'demos/renderers/app/actions/preact/public/entry.tsx'
export const preactEntryHref = await assets.getHref(preactEntry)
export const preactEntryPreloads = await assets.getPreloads(preactEntry)

export const reactEntry = 'demos/renderers/app/actions/react/public/entry.tsx'
export const reactEntryHref = await assets.getHref(reactEntry)

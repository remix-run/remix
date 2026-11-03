import { createAssetServer } from 'remix/assets'
import { componentHmr } from 'remix/component-hmr/assets'

const nodeEnv = process.env.NODE_ENV ?? 'development'
const isDevelopment = nodeEnv === 'development'
const isHmr = Boolean(isDevelopment && process.env.REMIX_NODE_HMR)

export const assets = createAssetServer({
  basePath: '/assets',
  rootDir: process.cwd(),
  /* remix-template:remove-start This is only needed inside the Remix monorepo. */
  mounts: {
    app: 'app',
    npm: '../node_modules',
    packages: '../packages',
  },
  /* remix-template:remove-end */
  allowFiles: ['app/routes.ts', 'app/**/public/**'],
  allowPackages: ['remix'],
  denyFiles: ['app/**/*.test.*'],
  sourceMaps: isDevelopment ? 'external' : undefined,
  minify: !isDevelopment,
  fingerprint: nodeEnv === 'production',
  watch: isDevelopment,
  hmr: isHmr
    ? {
        channel: async () => (await import('remix/node-hmr/runtime')).createBrowserHmrChannel(),
        moduleImporter: 'remix/multiple-import-maps-polyfill',
      }
    : undefined,
  scripts: { loaders: isHmr ? [componentHmr()] : undefined },
})

export const scriptEntry = await assets.getScriptEntry('app/actions/public/entry.ts')

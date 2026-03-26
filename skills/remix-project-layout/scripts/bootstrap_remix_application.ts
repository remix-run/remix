#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import * as process from 'node:process'
import { fileURLToPath } from 'node:url'

type ParsedArgs = {
  appName: string | null
  force: boolean
  remixVersion: string | null
  targetDir: string
}

type BootstrapConfig = {
  appDisplayName: string
  packageName: string
  remixVersion: string
}

type FileSpec = {
  content: string
  path: string
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const defaultTsxVersion = '^4.20.6'
const defaultTypesNodeVersion = '^24.6.0'
const defaultTypescriptVersion = '^5.9.3'

await main()

async function main(): Promise<void> {
  let parsed = parseArgs(process.argv.slice(2))
  let targetDir = path.resolve(parsed.targetDir)
  let rawAppName = parsed.appName ?? path.basename(targetDir)
  if (rawAppName.length === 0) {
    fail('Could not determine an app name from the target directory.')
  }

  let config = {
    appDisplayName: parsed.appName ?? humanizeName(rawAppName),
    packageName: toPackageName(rawAppName),
    remixVersion: parsed.remixVersion ?? (await readDefaultRemixVersion()),
  } satisfies BootstrapConfig

  await ensureTargetDirectory(targetDir, parsed.force)
  await writeDirectories(targetDir)

  let files = createFiles(config)
  for (let file of files) {
    await writeFile(targetDir, file)
  }

  process.stdout.write(`Created ${config.appDisplayName} at ${targetDir}\n`)
}

function parseArgs(argv: string[]): ParsedArgs {
  if (argv.includes('-h') || argv.includes('--help')) {
    printUsage()
    process.exit(0)
  }

  let appName: string | null = null
  let force = false
  let remixVersion: string | null = null
  let targetDir: string | null = null
  let index = 0

  while (index < argv.length) {
    let arg = argv[index]

    if (arg === '--app-name') {
      let next = argv[index + 1]
      if (!next) {
        fail('--app-name requires a value.')
      }

      appName = next
      index += 2
      continue
    }

    if (arg === '--remix-version') {
      let next = argv[index + 1]
      if (!next) {
        fail('--remix-version requires a value.')
      }

      remixVersion = next
      index += 2
      continue
    }

    if (arg === '--force') {
      force = true
      index++
      continue
    }

    if (arg.startsWith('--')) {
      fail(`Unknown argument: ${arg}`)
    }

    if (targetDir != null) {
      fail(`Unexpected extra argument: ${arg}`)
    }

    targetDir = arg
    index++
  }

  if (targetDir == null) {
    printUsage()
    process.exit(1)
  }

  let resolvedTargetDir = targetDir
  return { appName, force, remixVersion, targetDir: resolvedTargetDir }
}

function printUsage(): void {
  process.stdout.write(`Usage:
  bootstrap_remix_application.ts <target-dir> [--app-name <name>] [--remix-version <version>] [--force]

Examples:
  bootstrap_remix_application.ts ./my-remix-app
  bootstrap_remix_application.ts ./my-remix-app --app-name "My Remix App"
  bootstrap_remix_application.ts ./my-remix-app --remix-version 3.0.0-alpha.3
  bootstrap_remix_application.ts ./my-remix-app --force
`)
}

async function readDefaultRemixVersion(): Promise<string> {
  let packageJsonPath = path.resolve(scriptDir, '../../../packages/remix/package.json')
  let packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8')) as {
    version?: unknown
  }

  if (typeof packageJson.version !== 'string' || packageJson.version.length === 0) {
    fail(`Could not read a default remix version from ${packageJsonPath}.`)
  }

  return packageJson.version
}

async function ensureTargetDirectory(targetDir: string, force: boolean): Promise<void> {
  try {
    let stats = await fs.stat(targetDir)
    if (!stats.isDirectory()) {
      fail(`Target path is not a directory: ${targetDir}`)
    }

    let entries = await fs.readdir(targetDir)
    if (entries.length > 0 && !force) {
      fail(`Target directory is not empty: ${targetDir}. Re-run with --force to continue.`)
    }
  } catch (error) {
    let nodeError = error as NodeJS.ErrnoException
    if (nodeError.code !== 'ENOENT') {
      throw error
    }
  }

  await fs.mkdir(targetDir, { recursive: true })
}

async function writeDirectories(targetDir: string): Promise<void> {
  let directories = [
    'app/assets',
    'app/controllers/account/settings',
    'app/controllers/auth/login',
    'app/controllers/cart/api',
    'app/controllers/contact',
    'app/data',
    'app/middleware',
    'app/ui',
    'app/utils',
    'db',
    'public',
    'test',
    'tmp',
  ]

  for (let directory of directories) {
    await fs.mkdir(path.join(targetDir, directory), { recursive: true })
  }
}

async function writeFile(targetDir: string, file: FileSpec): Promise<void> {
  let filePath = path.join(targetDir, file.path)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, file.content, 'utf8')
}

function createFiles(config: BootstrapConfig): FileSpec[] {
  return [
    { path: '.gitignore', content: createGitIgnore() },
    { path: 'README.md', content: createReadme(config) },
    { path: 'package.json', content: createPackageJson(config) },
    { path: 'server.ts', content: createServerFile() },
    { path: 'tsconfig.json', content: createTsconfig() },
    { path: 'app/routes.ts', content: createRoutesFile() },
    { path: 'app/router.ts', content: createRouterFile() },
    { path: 'app/utils/render.tsx', content: createRenderFile() },
    { path: 'app/ui/document.tsx', content: createDocumentFile(config) },
    { path: 'app/ui/layout.tsx', content: createLayoutFile() },
    { path: 'app/controllers/home.tsx', content: createHomeFile(config) },
    { path: 'app/controllers/about.tsx', content: createAboutFile() },
    { path: 'app/controllers/search.tsx', content: createSearchFile() },
    { path: 'app/controllers/uploads.tsx', content: createUploadsFile() },
    { path: 'app/controllers/contact/page.tsx', content: createContactPageFile() },
    {
      path: 'app/controllers/contact/controller.tsx',
      content: createContactControllerFile(),
    },
    { path: 'app/controllers/auth/controller.tsx', content: createAuthControllerFile() },
    { path: 'app/controllers/auth/login/page.tsx', content: createLoginPageFile() },
    {
      path: 'app/controllers/auth/login/controller.tsx',
      content: createLoginControllerFile(),
    },
    { path: 'app/controllers/account/page.tsx', content: createAccountPageFile() },
    {
      path: 'app/controllers/account/controller.tsx',
      content: createAccountControllerFile(),
    },
    {
      path: 'app/controllers/account/settings/page.tsx',
      content: createSettingsPageFile(),
    },
    {
      path: 'app/controllers/account/settings/controller.tsx',
      content: createSettingsControllerFile(),
    },
    { path: 'app/controllers/cart/page.tsx', content: createCartPageFile() },
    { path: 'app/controllers/cart/controller.tsx', content: createCartControllerFile() },
    {
      path: 'app/controllers/cart/api/controller.tsx',
      content: createCartApiControllerFile(),
    },
    { path: 'test/helpers.ts', content: createTestHelpersFile() },
    { path: 'app/controllers/home.test.ts', content: createHomeTestFile(config) },
  ]
}

function createGitIgnore(): string {
  return `node_modules/
db/*.sqlite
tmp/
.DS_Store
`
}

function createReadme(config: BootstrapConfig): string {
  return `# ${config.appDisplayName}

A Remix application starter that follows the Remix application layout conventions.

## Application Layout

- \`app/\` holds runtime application code.
- \`db/\` holds database artifacts such as migrations and SQLite files.
- \`public/\` holds static files served as-is.
- \`test/\` holds shared test helpers and broader integration coverage.
- \`tmp/\` holds runtime scratch files.

Inside \`app/\`:

- \`assets/\` holds client entrypoints and client-owned behavior.
- \`controllers/\` holds route handlers and route-local UI.
- \`data/\` holds schema, queries, persistence setup, and startup data logic.
- \`middleware/\` holds request lifecycle concerns.
- \`ui/\` holds shared cross-route UI.
- \`utils/\` holds genuinely cross-layer helpers.

## Route Ownership

- Flat leaf routes live in files like \`app/controllers/home.tsx\`.
- Controller-backed routes live in folders with \`controller.tsx\`, like
  \`app/controllers/contact/controller.tsx\`.
- Nested route objects in \`app/routes.ts\` map to nested controller folders on disk, like
  \`app/controllers/auth/login/controller.tsx\`.

## Commands

\`\`\`sh
npm i
npm run start
npm test
\`\`\`
`
}

function createPackageJson(config: BootstrapConfig): string {
  return (
    JSON.stringify(
      {
        name: config.packageName,
        private: true,
        type: 'module',
        scripts: {
          dev: 'tsx watch server.ts',
          start: 'tsx server.ts',
          test: 'NODE_ENV=test tsx --test',
          typecheck: 'tsc --noEmit',
        },
        dependencies: {
          remix: config.remixVersion,
          tsx: defaultTsxVersion,
        },
        devDependencies: {
          '@types/node': defaultTypesNodeVersion,
          typescript: defaultTypescriptVersion,
        },
      },
      null,
      2,
    ) + '\n'
  )
}

function createTsconfig(): string {
  return `{
  "compilerOptions": {
    "strict": true,
    "lib": ["ES2024", "DOM", "DOM.Iterable"],
    "types": ["node"],
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "target": "ESNext",
    "allowImportingTsExtensions": true,
    "rewriteRelativeImportExtensions": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "jsx": "react-jsx",
    "jsxImportSource": "remix/component",
    "preserveSymlinks": true,
    "noEmit": true
  },
  "exclude": ["dist"]
}
`
}

function createServerFile(): string {
  return `import * as http from 'node:http'

import { createRequestListener } from 'remix/node-fetch-server'

import { router } from './app/router.ts'

let server = http.createServer(
  createRequestListener(async (request) => {
    try {
      return await router.fetch(request)
    } catch (error) {
      console.error(error)
      return new Response('Internal Server Error', { status: 500 })
    }
  }),
)

let port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 44100

server.listen(port, () => {
  console.log(\`Server listening on http://localhost:\${port}\`)
})

let shuttingDown = false

function shutdown() {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  server.close(() => {
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
`
}

function createRoutesFile(): string {
  return `import { form, get, post, route } from 'remix/fetch-router/routes'

export let routes = route({
  home: '/',
  about: '/about',
  search: '/search',
  uploads: '/uploads/*key',

  contact: form('contact'),

  auth: {
    login: form('login'),
  },

  account: route('account', {
    index: '/',
    settings: form('settings'),
  }),

  cart: route('cart', {
    index: get('/'),
    api: {
      add: post('/api/add'),
      remove: post('/api/remove'),
    },
  }),
})
`
}

function createRouterFile(): string {
  return `import { createRouter } from 'remix/fetch-router'

import accountController from './controllers/account/controller.tsx'
import authController from './controllers/auth/controller.tsx'
import cartController from './controllers/cart/controller.tsx'
import contactController from './controllers/contact/controller.tsx'
import { about } from './controllers/about.tsx'
import { home } from './controllers/home.tsx'
import { search } from './controllers/search.tsx'
import { uploads } from './controllers/uploads.tsx'
import { routes } from './routes.ts'

export let router = createRouter()

router.map(routes.home, home)
router.map(routes.about, about)
router.map(routes.search, search)
router.map(routes.uploads, uploads)

router.map(routes.contact, contactController)
router.map(routes.auth, authController)
router.map(routes.account, accountController)
router.map(routes.cart, cartController)
`
}

function createRenderFile(): string {
  return `import type { RemixNode } from 'remix/component'
import { renderToStream } from 'remix/component/server'

export function render(node: RemixNode, init?: ResponseInit) {
  let headers = new Headers(init?.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'text/html; charset=UTF-8')
  }

  return new Response(renderToStream(node), { ...init, headers })
}
`
}

function createDocumentFile(config: BootstrapConfig): string {
  return `import type { RemixNode } from 'remix/component'

export interface DocumentProps {
  children?: RemixNode
  title?: string
}

export function Document() {
  return ({ title = ${JSON.stringify(config.appDisplayName)}, children }: DocumentProps) => (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
      </head>
      <body>{children}</body>
    </html>
  )
}
`
}

function createLayoutFile(): string {
  return `import type { RemixNode } from 'remix/component'

import { routes } from '../routes.ts'
import { Document } from './document.tsx'

export interface LayoutProps {
  children?: RemixNode
  title?: string
}

export function Layout() {
  return ({ title, children }: LayoutProps) => (
    <Document title={title}>
      <header>
        <nav>
          <a href={routes.home.href()}>Home</a>{' '}
          <a href={routes.about.href()}>About</a>{' '}
          <a href={routes.search.href()}>Search</a>{' '}
          <a href={routes.contact.index.href()}>Contact</a>{' '}
          <a href={routes.auth.login.index.href()}>Log in</a>{' '}
          <a href={routes.account.index.href()}>Account</a>{' '}
          <a href={routes.cart.index.href()}>Cart</a>
        </nav>
      </header>
      <main>{children}</main>
    </Document>
  )
}
`
}

function createHomeFile(config: BootstrapConfig): string {
  return `import type { BuildAction } from 'remix/fetch-router'

import { routes } from '../routes.ts'
import { Layout } from '../ui/layout.tsx'
import { render } from '../utils/render.tsx'

export let home: BuildAction<'GET', typeof routes.home> = {
  handler() {
    return render(<HomePage />)
  },
}

function HomePage() {
  return () => (
    <Layout title="Home">
      <h1>{${JSON.stringify(config.appDisplayName)}}</h1>
      <p>This app follows the Remix application layout conventions.</p>
      <p>Start with flat leaf routes, promote to controller folders only when the route grows.</p>
    </Layout>
  )
}
`
}

function createAboutFile(): string {
  return `import type { BuildAction } from 'remix/fetch-router'

import { routes } from '../routes.ts'
import { Layout } from '../ui/layout.tsx'
import { render } from '../utils/render.tsx'

export let about: BuildAction<'GET', typeof routes.about> = {
  handler() {
    return render(<AboutPage />)
  },
}

function AboutPage() {
  return () => (
    <Layout title="About">
      <h1>About</h1>
      <p>
        Shared UI lives in <code>app/ui</code>, request lifecycle code lives in
        <code>app/middleware</code>, and persistence setup lives in <code>app/data</code>.
      </p>
    </Layout>
  )
}
`
}

function createSearchFile(): string {
  return `import type { BuildAction } from 'remix/fetch-router'

import { routes } from '../routes.ts'
import { Layout } from '../ui/layout.tsx'
import { render } from '../utils/render.tsx'

export let search: BuildAction<'GET', typeof routes.search> = {
  handler({ url }) {
    let query = url.searchParams.get('q') ?? ''
    return render(<SearchPage query={query} />)
  },
}

interface SearchPageProps {
  query: string
}

function SearchPage() {
  return ({ query }: SearchPageProps) => (
    <Layout title="Search">
      <h1>Search</h1>
      <form method="GET">
        <input name="q" value={query} />
        <button type="submit">Search</button>
      </form>
      <p>Current query: {query || 'none'}</p>
    </Layout>
  )
}
`
}

function createUploadsFile(): string {
  return `import type { BuildAction } from 'remix/fetch-router'

import { routes } from '../routes.ts'
import { Layout } from '../ui/layout.tsx'
import { render } from '../utils/render.tsx'

export let uploads: BuildAction<'GET', typeof routes.uploads> = {
  handler({ params }) {
    return render(<UploadsPage objectKey={params.key} />)
  },
}

interface UploadsPageProps {
  objectKey: string
}

function UploadsPage() {
  return ({ objectKey }: UploadsPageProps) => (
    <Layout title="Uploads">
      <h1>Uploads</h1>
      <p>Requested key: {objectKey}</p>
    </Layout>
  )
}
`
}

function createContactPageFile(): string {
  return `import { routes } from '../../routes.ts'
import { Layout } from '../../ui/layout.tsx'

export function ContactPage() {
  return () => (
    <Layout title="Contact">
      <h1>Contact</h1>
      <form method="POST">
        <button type="submit">Send message</button>
      </form>
    </Layout>
  )
}

export function ContactSuccessPage() {
  return () => (
    <Layout title="Message Sent">
      <h1>Message Sent</h1>
      <p>Your message was accepted.</p>
      <p>
        <a href={routes.contact.index.href()}>Send another message</a>
      </p>
    </Layout>
  )
}
`
}

function createContactControllerFile(): string {
  return `import type { Controller } from 'remix/fetch-router'

import { routes } from '../../routes.ts'
import { render } from '../../utils/render.tsx'
import { ContactPage, ContactSuccessPage } from './page.tsx'

export default {
  actions: {
    index() {
      return render(<ContactPage />)
    },

    action() {
      return render(<ContactSuccessPage />)
    },
  },
} satisfies Controller<typeof routes.contact>
`
}

function createAuthControllerFile(): string {
  return `import type { Controller } from 'remix/fetch-router'

import { routes } from '../../routes.ts'
import loginController from './login/controller.tsx'

export default {
  actions: {
    login: loginController,
  },
} satisfies Controller<typeof routes.auth>
`
}

function createLoginPageFile(): string {
  return `import { routes } from '../../../routes.ts'
import { Layout } from '../../../ui/layout.tsx'

export function LoginPage() {
  return () => (
    <Layout title="Log in">
      <h1>Log in</h1>
      <form method="POST">
        <button type="submit">Continue</button>
      </form>
    </Layout>
  )
}

export function LoginSuccessPage() {
  return () => (
    <Layout title="Logged In">
      <h1>Logged In</h1>
      <p>This starter keeps auth logic route-owned inside its controller folder.</p>
      <p>
        <a href={routes.account.index.href()}>Go to account</a>
      </p>
    </Layout>
  )
}
`
}

function createLoginControllerFile(): string {
  return `import type { Controller } from 'remix/fetch-router'

import { routes } from '../../../routes.ts'
import { render } from '../../../utils/render.tsx'
import { LoginPage, LoginSuccessPage } from './page.tsx'

export default {
  actions: {
    index() {
      return render(<LoginPage />)
    },

    action() {
      return render(<LoginSuccessPage />)
    },
  },
} satisfies Controller<typeof routes.auth.login>
`
}

function createAccountPageFile(): string {
  return `import { routes } from '../../routes.ts'
import { Layout } from '../../ui/layout.tsx'

export function AccountPage() {
  return () => (
    <Layout title="Account">
      <h1>Account</h1>
      <p>This route uses a controller folder because it owns nested child routes.</p>
      <p>
        <a href={routes.account.settings.index.href()}>Account settings</a>
      </p>
    </Layout>
  )
}
`
}

function createAccountControllerFile(): string {
  return `import type { Controller } from 'remix/fetch-router'

import { routes } from '../../routes.ts'
import { render } from '../../utils/render.tsx'
import { AccountPage } from './page.tsx'
import settingsController from './settings/controller.tsx'

export default {
  actions: {
    index() {
      return render(<AccountPage />)
    },

    settings: settingsController,
  },
} satisfies Controller<typeof routes.account>
`
}

function createSettingsPageFile(): string {
  return `import { routes } from '../../../routes.ts'
import { Layout } from '../../../ui/layout.tsx'

export function SettingsPage() {
  return () => (
    <Layout title="Settings">
      <h1>Settings</h1>
      <form method="POST">
        <button type="submit">Save settings</button>
      </form>
    </Layout>
  )
}

export function SettingsSavedPage() {
  return () => (
    <Layout title="Settings Saved">
      <h1>Settings Saved</h1>
      <p>Your settings route lives under the owning account controller folder.</p>
      <p>
        <a href={routes.account.index.href()}>Back to account</a>
      </p>
    </Layout>
  )
}
`
}

function createSettingsControllerFile(): string {
  return `import type { Controller } from 'remix/fetch-router'

import { routes } from '../../../routes.ts'
import { render } from '../../../utils/render.tsx'
import { SettingsPage, SettingsSavedPage } from './page.tsx'

export default {
  actions: {
    index() {
      return render(<SettingsPage />)
    },

    action() {
      return render(<SettingsSavedPage />)
    },
  },
} satisfies Controller<typeof routes.account.settings>
`
}

function createCartPageFile(): string {
  return `import { routes } from '../../routes.ts'
import { Layout } from '../../ui/layout.tsx'

export function CartPage() {
  return () => (
    <Layout title="Cart">
      <h1>Cart</h1>
      <p>
        This controller owns both the cart page and the nested API routes in
        <code>app/controllers/cart/api</code>.
      </p>
      <form method="POST" action={routes.cart.api.add.href()}>
        <button type="submit">Add item</button>
      </form>
      <form method="POST" action={routes.cart.api.remove.href()}>
        <button type="submit">Remove item</button>
      </form>
    </Layout>
  )
}
`
}

function createCartControllerFile(): string {
  return `import type { Controller } from 'remix/fetch-router'

import { routes } from '../../routes.ts'
import { render } from '../../utils/render.tsx'
import apiController from './api/controller.tsx'
import { CartPage } from './page.tsx'

export default {
  actions: {
    index() {
      return render(<CartPage />)
    },

    api: apiController,
  },
} satisfies Controller<typeof routes.cart>
`
}

function createCartApiControllerFile(): string {
  return `import type { Controller } from 'remix/fetch-router'

import { routes } from '../../../routes.ts'

export default {
  actions: {
    add() {
      return new Response('Added an item to the cart.', {
        headers: { 'Content-Type': 'text/plain; charset=UTF-8' },
      })
    },

    remove() {
      return new Response('Removed an item from the cart.', {
        headers: { 'Content-Type': 'text/plain; charset=UTF-8' },
      })
    },
  },
} satisfies Controller<typeof routes.cart.api>
`
}

function createTestHelpersFile(): string {
  return `import { router } from '../app/router.ts'

export function createTestRouter() {
  return router
}
`
}

function createHomeTestFile(config: BootstrapConfig): string {
  return `import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createTestRouter } from '../../test/helpers.ts'

let router = createTestRouter()

describe('home handler', () => {
  it('serves the home page through router.fetch', async () => {
    let response = await router.fetch('http://example.com/')
    assert.equal(response.status, 200)

    let contentType = response.headers.get('content-type') ?? ''
    assert.match(contentType, /^text\\/html/)

    let body = await response.text()
    assert.match(body, /<h1>${escapeRegExp(config.appDisplayName)}<\\/h1>/)
  })
})
`
}

function humanizeName(value: string): string {
  let parts = value.split(/[-_\s]+/).filter(Boolean)
  if (parts.length === 0) {
    return 'Remix App'
  }

  return parts
    .map((part) => {
      let head = part.slice(0, 1).toUpperCase()
      let tail = part.slice(1)
      return `${head}${tail}`
    })
    .join(' ')
}

function toPackageName(value: string): string {
  let packageName = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (packageName.length === 0) {
    fail(`Could not derive a valid package name from "${value}".`)
  }

  return packageName
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+*?.-]/g, '\\$&')
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

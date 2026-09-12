import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { loadConfig, loadRemixConfig } from './remix-config.ts'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')

describe('Remix config loading', () => {
  it('loads an explicit config file or searches upward from a directory', async () => {
    let rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-config-discovery-'))
    let nestedDir = path.join(rootDir, 'app', 'actions')
    let configPath = path.join(rootDir, 'project.jsonc')

    try {
      await fs.mkdir(nestedDir, { recursive: true })
      await fs.writeFile(path.join(rootDir, 'remix.json'), '{ "doctor": { "strict": true } }')
      await fs.writeFile(configPath, '{ "doctor": { "strict": false } }')

      assert.deepEqual(await loadConfig(nestedDir), { doctor: { strict: true } })
      assert.deepEqual(await loadConfig(configPath), { doctor: { strict: false } })
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true })
    }
  })

  it('parses asset configuration and resolves its root from the config file', async () => {
    let cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-config-assets-'))

    try {
      await fs.writeFile(
        path.join(cwd, 'remix.json'),
        JSON.stringify({
          assets: {
            allowFiles: ['app/routes.ts', 'app/**/public/**'],
            allowPackages: ['remix'],
            basePath: '/assets',
            denyFiles: ['app/**/*.test.*'],
            mounts: { app: 'app' },
            files: { extensions: ['.svg', '.png'] },
            rootDir: '..',
          },
        }),
      )

      let config = await loadConfig(cwd)
      assert.deepEqual(config.assets, {
        allowFiles: ['app/routes.ts', 'app/**/public/**'],
        allowPackages: ['remix'],
        basePath: '/assets',
        denyFiles: ['app/**/*.test.*'],
        mounts: { app: 'app' },
        files: { extensions: ['.svg', '.png'] },
        rootDir: path.dirname(cwd),
      })
    } finally {
      await fs.rm(cwd, { recursive: true, force: true })
    }
  })

  it('rejects incomplete asset configuration with a source location', async () => {
    let cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-config-assets-invalid-'))

    try {
      await fs.writeFile(
        path.join(cwd, 'remix.json'),
        ['{', '  "assets": {', '    "basePath": "/assets"', '  }', '}'].join('\n'),
      )

      await assert.rejects(
        () => loadConfig(cwd),
        /Expected an array of strings at assets\.allowFiles/,
      )
    } finally {
      await fs.rm(cwd, { recursive: true, force: true })
    }
  })

  it('treats a missing default config as empty', async () => {
    let cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-config-missing-default-'))

    try {
      assert.deepEqual(await loadRemixConfig(cwd, undefined), {})
    } finally {
      await fs.rm(cwd, { recursive: true, force: true })
    }
  })

  it('treats an empty or comments-only config as empty', async () => {
    let cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-config-empty-'))

    try {
      await fs.writeFile(path.join(cwd, 'remix.json'), '', 'utf8')
      assert.deepEqual(await loadRemixConfig(cwd, undefined), {})

      await fs.writeFile(path.join(cwd, 'remix.json'), '// nothing configured yet\n', 'utf8')
      assert.deepEqual(await loadRemixConfig(cwd, undefined), {})
    } finally {
      await fs.rm(cwd, { recursive: true, force: true })
    }
  })

  it('ignores a UTF-8 byte order mark', async () => {
    let cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-config-bom-'))

    try {
      await fs.writeFile(path.join(cwd, 'remix.json'), '﻿{ "test": { "watch": true } }', 'utf8')
      assert.deepEqual(await loadRemixConfig(cwd, undefined), { test: { watch: true } })
    } finally {
      await fs.rm(cwd, { recursive: true, force: true })
    }
  })

  it('parses doctor strict mode', async () => {
    let cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-config-doctor-'))

    try {
      await fs.writeFile(
        path.join(cwd, 'remix.json'),
        JSON.stringify({ doctor: { strict: true } }),
        'utf8',
      )

      assert.deepEqual(await loadRemixConfig(cwd, undefined), { doctor: { strict: true } })
    } finally {
      await fs.rm(cwd, { recursive: true, force: true })
    }
  })

  it('parses built-in database configurations', async () => {
    let cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-config-db-'))

    try {
      await fs.writeFile(
        path.join(cwd, 'remix.json'),
        JSON.stringify({
          db: {
            adapter: {
              type: 'sqlite',
              filename: { env: 'DATABASE_URL', default: './db/app.sqlite' },
              foreignKeys: true,
              busyTimeout: 250,
            },
            migrations: { directory: './db/migrations', journalTable: 'app_migrations' },
            seed: './db/seed.sql',
          },
        }),
        'utf8',
      )

      let config = await loadRemixConfig(cwd, undefined)
      assert.deepEqual(config.db?.adapter, {
        type: 'sqlite',
        filename: { env: 'DATABASE_URL', default: './db/app.sqlite' },
        foreignKeys: true,
        busyTimeout: 250,
      })
      assert.deepEqual(config.db?.migrations, {
        directory: path.join(cwd, 'db/migrations'),
        journalTable: 'app_migrations',
      })
      assert.equal(config.db?.seed, path.join(cwd, 'db/seed.sql'))
    } finally {
      await fs.rm(cwd, { recursive: true, force: true })
    }
  })

  it('rejects unsupported database adapter types', async () => {
    let cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-config-db-unknown-'))

    try {
      await fs.writeFile(
        path.join(cwd, 'remix.json'),
        JSON.stringify({ db: { adapter: { type: 'mongo', uri: 'mongodb://localhost' } } }),
        'utf8',
      )

      await assert.rejects(
        () => loadRemixConfig(cwd, undefined),
        /Expected one of: sqlite, postgres, mysql, module at db\.adapter\.type/,
      )
    } finally {
      await fs.rm(cwd, { recursive: true, force: true })
    }
  })

  it('parses a module database configuration', async () => {
    let cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-config-db-module-'))

    try {
      await fs.writeFile(
        path.join(cwd, 'remix.json'),
        JSON.stringify({
          db: {
            adapter: {
              type: 'module',
              module: './app/database.ts',
              export: 'createDatabase',
              connection: { env: 'DATABASE_URL', default: 'libsql://localhost' },
              options: { authToken: { env: 'DATABASE_AUTH_TOKEN' } },
            },
          },
        }),
        'utf8',
      )

      let config = await loadRemixConfig(cwd, undefined)
      assert.deepEqual(config.db?.adapter, {
        type: 'module',
        module: './app/database.ts',
        export: 'createDatabase',
        connection: { env: 'DATABASE_URL', default: 'libsql://localhost' },
        options: { authToken: { env: 'DATABASE_AUTH_TOKEN' } },
      })
    } finally {
      await fs.rm(cwd, { recursive: true, force: true })
    }
  })

  it('rejects a module database configuration without a module', async () => {
    let cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-config-db-module-invalid-'))

    try {
      await fs.writeFile(
        path.join(cwd, 'remix.json'),
        JSON.stringify({ db: { adapter: { type: 'module' } } }),
        'utf8',
      )

      await assert.rejects(
        () => loadRemixConfig(cwd, undefined),
        /Expected a string at db\.adapter\.module/,
      )
    } finally {
      await fs.rm(cwd, { recursive: true, force: true })
    }
  })

  it('parses postgres and mysql database configurations', async () => {
    let cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-config-db-server-'))

    try {
      await fs.writeFile(
        path.join(cwd, 'remix.json'),
        JSON.stringify({
          db: {
            adapter: {
              type: 'postgres',
              connectionString: { env: 'DATABASE_URL' },
              maintenanceDatabase: 'postgres',
              template: 'template0',
            },
          },
        }),
        'utf8',
      )
      let postgres = await loadRemixConfig(cwd, undefined)
      assert.equal(postgres.db?.adapter.type, 'postgres')

      await fs.writeFile(
        path.join(cwd, 'remix.json'),
        JSON.stringify({
          db: {
            adapter: {
              type: 'mysql',
              uri: { env: 'DATABASE_URL' },
              characterSet: 'utf8mb4',
              collation: 'utf8mb4_unicode_ci',
            },
          },
        }),
        'utf8',
      )
      let mysql = await loadRemixConfig(cwd, undefined)
      assert.equal(mysql.db?.adapter.type, 'mysql')
    } finally {
      await fs.rm(cwd, { recursive: true, force: true })
    }
  })

  it('rejects invalid database configuration with a source location', async () => {
    let cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-config-db-invalid-'))

    try {
      await fs.writeFile(
        path.join(cwd, 'remix.json'),
        ['{', '  "db": {', '    "adapter": { "type": "sqlite" }', '  }', '}'].join('\n'),
        'utf8',
      )
      await assert.rejects(
        () => loadRemixConfig(cwd, undefined),
        /Expected an object at db\.adapter\.filename|Expected a string at db\.adapter\.filename/,
      )
    } finally {
      await fs.rm(cwd, { recursive: true, force: true })
    }
  })

  it('rejects invalid doctor strict values', async () => {
    let cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-config-doctor-invalid-'))

    try {
      await fs.writeFile(
        path.join(cwd, 'remix.json'),
        JSON.stringify({ doctor: { strict: 'yes' } }),
        'utf8',
      )

      await assert.rejects(
        () => loadRemixConfig(cwd, undefined),
        /Expected a boolean at doctor\.strict/,
      )
    } finally {
      await fs.rm(cwd, { recursive: true, force: true })
    }
  })

  it('rejects a missing explicitly selected config', async () => {
    let cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-config-missing-explicit-'))

    try {
      await assert.rejects(
        () => loadRemixConfig(cwd, 'missing.json'),
        (error: unknown) => {
          assert.equal(getErrorCode(error), 'RMX_CONFIG_NOT_FOUND')
          assert.match(String(error), /missing\.json/)
          return true
        },
      )
    } finally {
      await fs.rm(cwd, { recursive: true, force: true })
    }
  })

  it('parses JSONC and resolves paths from a custom config directory', async () => {
    let rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-config-paths-'))
    let cwd = path.join(rootDir, 'project')
    let configDir = path.join(rootDir, 'config')

    try {
      await fs.mkdir(cwd)
      await fs.mkdir(configDir)
      await fs.writeFile(
        path.join(configDir, 'custom.jsonc'),
        [
          '{',
          '  // JSONC comments and trailing commas are supported.',
          '  "test": {',
          '    "files": ["./tests/**/*.test.ts"],',
          '    "setup": "./setup.ts",',
          '    "playwright": { "configFile": "./playwright.config.ts" },',
          '    "coverage": {',
          '      "dir": "./coverage",',
          '      "include": ["./src/**"],',
          '    },',
          '  },',
          '}',
        ].join('\n'),
        'utf8',
      )

      let config = await loadRemixConfig(cwd, '../config/custom.jsonc')

      assert.deepEqual(config.test?.files, ['../config/tests/**/*.test.ts'])
      assert.equal(config.test?.setup, path.join(configDir, 'setup.ts'))
      assert.equal(
        config.test?.playwright?.configFile,
        path.join(configDir, 'playwright.config.ts'),
      )
      assert.equal(config.test?.coverage?.dir, path.join(configDir, 'coverage'))
      assert.deepEqual(config.test?.coverage?.include, ['../config/src/**'])
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true })
    }
  })

  it('rejects unknown properties with a source location', async () => {
    let cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-config-unknown-'))

    try {
      await fs.writeFile(
        path.join(cwd, 'remix.json'),
        ['{', '  "test": {', '    "concurrancy": 2', '  }', '}'].join('\n'),
        'utf8',
      )

      await assert.rejects(
        () => loadRemixConfig(cwd, undefined),
        (error: unknown) => {
          assert.equal(getErrorCode(error), 'RMX_INVALID_CONFIG')
          assert.match(String(error), /remix\.json:3:20/)
          assert.match(String(error), /Unknown property "concurrancy" at test\.concurrancy/)
          return true
        },
      )
    } finally {
      await fs.rm(cwd, { recursive: true, force: true })
    }
  })

  it('rejects malformed JSONC with a source location', async () => {
    let cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-config-malformed-'))

    try {
      await fs.writeFile(path.join(cwd, 'remix.json'), '{\n  "test": { nope }\n}', 'utf8')

      await assert.rejects(
        () => loadRemixConfig(cwd, undefined),
        (error: unknown) => {
          assert.equal(getErrorCode(error), 'RMX_INVALID_CONFIG')
          assert.match(String(error), /remix\.json:2:/)
          return true
        },
      )
    } finally {
      await fs.rm(cwd, { recursive: true, force: true })
    }
  })

  it('validates nested values', async () => {
    let cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-config-invalid-value-'))

    try {
      await fs.writeFile(
        path.join(cwd, 'remix.json'),
        JSON.stringify({ test: { playwright: { projects: 'chromium' } } }),
        'utf8',
      )

      await assert.rejects(
        () => loadRemixConfig(cwd, undefined),
        /Expected an array of strings at test\.playwright\.projects/,
      )
    } finally {
      await fs.rm(cwd, { recursive: true, force: true })
    }
  })

  it('rejects invalid test-name patterns at their source location', async () => {
    let cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-config-invalid-only-'))

    try {
      await fs.writeFile(
        path.join(cwd, 'remix.json'),
        ['{', '  "test": {', '    "only": ["/checkout/z"]', '  }', '}'].join('\n'),
        'utf8',
      )

      await assert.rejects(
        () => loadRemixConfig(cwd, undefined),
        (error: unknown) => {
          assert.equal(getErrorCode(error), 'RMX_INVALID_CONFIG')
          assert.match(String(error), /remix\.json:3:14/)
          assert.match(String(error), /valid JavaScript regular expression/)
          return true
        },
      )
    } finally {
      await fs.rm(cwd, { recursive: true, force: true })
    }
  })

  it('treats a pattern whose trailing slash is escaped as a plain pattern', async () => {
    let cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-config-escaped-only-'))

    try {
      // "/a\\/" has no closing delimiter (the trailing slash is escaped), so it
      // falls back to a case-insensitive plain pattern instead of a literal.
      await fs.writeFile(
        path.join(cwd, 'remix.json'),
        ['{', '  "test": {', '    "only": ["/a\\\\/"]', '  }', '}'].join('\n'),
        'utf8',
      )

      assert.deepEqual(await loadRemixConfig(cwd, undefined), { test: { only: ['/a\\/'] } })
    } finally {
      await fs.rm(cwd, { recursive: true, force: true })
    }
  })

  it('declares its JSON Schema dialect without an unpublished identifier', async () => {
    let schema = JSON.parse(
      await fs.readFile(path.join(ROOT_DIR, 'packages', 'cli', 'schema', 'remix.json'), 'utf8'),
    )

    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema')
    assert.equal('$id' in schema, false)
  })
})

function getErrorCode(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined
}

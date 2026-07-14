import * as http from 'node:http'
import * as path from 'node:path'
import { createMigrator } from 'remix/data-table/migrations'
import { loadMigrations } from 'remix/data-table/migrations/node'
import { createRequestListener } from 'remix/node-fetch-server'

import { database } from './app/data/database.ts'
import { createSocialAuthRouter } from './app/router.ts'
import {
  externalProviderNames,
  getDemoOrigin,
  getExternalProviderLabel,
  getExternalProviderStatus,
} from './app/utils/external-auth.ts'
import { seed } from './db/seed.ts'

const db = await database.connect()
const migrator = createMigrator(await loadMigrations(path.join(import.meta.dirname, 'db/migrations')))
await migrator.migrate(db)
await seed(db)

const router = createSocialAuthRouter()

const server = http.createServer(
  createRequestListener(async (request) => {
    try {
      return await router.fetch(request)
    } catch (error) {
      if (!(request.signal.aborted && error === request.signal.reason)) {
        console.error(error)
      }
      return new Response('Internal Server Error', { status: 500 })
    }
  }),
)

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 44100

server.listen(port, () => {
  let demoUrl = getDemoOrigin()
  console.log(`Social auth demo listening at ${demoUrl}`)
  console.log('Configure OAuth callback URLs:')
  for (let provider of externalProviderNames) {
    console.log(`- ${getExternalProviderLabel(provider)}: ${demoUrl}/auth/${provider}/callback`)
  }
  console.log('\nProvider status:')
  for (let provider of externalProviderNames) {
    let status = getExternalProviderStatus(provider)
    let message = status.enabled ? 'enabled' : `missing ${status.missingEnvVars.join(', ')}`
    console.log(`- ${getExternalProviderLabel(provider)}: ${message}`)
  }
})

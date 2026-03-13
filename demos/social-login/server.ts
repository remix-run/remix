import * as http from 'node:http'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createRequestListener } from 'remix/node-fetch-server'

import { getSocialLoginConfig } from './app/config.ts'
import { getSocialProviderStates } from './app/middleware/auth.ts'
import { createSocialLoginRouter } from './app/router.ts'
import { socialLoginDatabaseFilePath } from './app/data/setup.ts'

let config = getSocialLoginConfig()
let providerStates = getSocialProviderStates(config)
let router = createSocialLoginRouter({ config })
let demoRoot = path.dirname(fileURLToPath(import.meta.url))
let relativeDatabasePath = path.relative(demoRoot, socialLoginDatabaseFilePath)
let localDemoOrigin = 'http://127.0.0.1'

let server = http.createServer(
  createRequestListener(async request => {
    try {
      return await router.fetch(request)
    } catch (error) {
      console.error(error)
      return new Response('Internal Server Error', { status: 500 })
    }
  }),
)

let port = process.env.PORT ? parseInt(process.env.PORT, 10) : 44100

server.listen(port, () => {
  console.log(`Social login demo is running on ${localDemoOrigin}:${port}`)
  console.log(`SQLite database: ${relativeDatabasePath}`)
  console.log('')
  console.log('Auth providers:')
  console.log('  Email and password: enabled (demo@example.com / password123)')

  for (let provider of providerStates) {
    if (provider.configured) {
      console.log(`  ${provider.label}: enabled`)
    } else {
      console.log(`  ${provider.label}: disabled (missing ${provider.missingEnv.join(' and ')})`)
    }
  }

  console.log('')
})

let shuttingDown = false

function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  server.close(() => {
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

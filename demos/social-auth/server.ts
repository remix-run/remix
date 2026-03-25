import * as http from 'node:http'
import { createRequestListener } from 'remix/node-fetch-server'

import { initializeSocialAuthDatabase } from './app/data/setup.ts'
import { createSocialAuthRouter } from './app/router.ts'
import {
  externalProviderNames,
  getDemoOrigin,
  getExternalProviderLabel,
  getExternalProviderStatus,
} from './app/utils/external-auth.ts'

await initializeSocialAuthDatabase()

const router = createSocialAuthRouter()

const server = http.createServer(
  createRequestListener(async (request) => {
    try {
      return await router.fetch(request)
    } catch (error) {
      console.error(error)
      return new Response('Internal Server Error', { status: 500 })
    }
  }),
)

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 44100

server.listen(port, () => {
  let demoUrl = getDemoOrigin()

  console.log(`social-auth demo is running on ${demoUrl}`)
  console.log('')
  console.log('Demo accounts:')
  console.log('  admin@example.com / password123')
  console.log('  user@example.com / password123')
  console.log('')
  console.log('Social auth providers:')

  for (let providerName of externalProviderNames) {
    console.log(
      `  ${formatProviderStatus(getExternalProviderLabel(providerName), getExternalProviderStatus(providerName))}`,
    )
  }
})

let shuttingDown = false

function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  server.close(() => process.exit(0))
  server.closeAllConnections()
}

function formatProviderStatus(
  label: string,
  status: { enabled: boolean; missingEnvVars: string[] },
): string {
  if (status.enabled) {
    return `${color('32', '✓')} ${label} enabled`
  }

  return `${color('31', '✗')} ${label} disabled (missing ${status.missingEnvVars.join(', ')})`
}

function color(code: string, text: string): string {
  return `\u001b[${code}m${text}\u001b[0m`
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

import * as fs from 'node:fs'
import * as http from 'node:http'
import { fileURLToPath } from 'node:url'
import { createRequestListener } from 'remix/node-fetch-server'

let envFilePath = fileURLToPath(new URL('.env', import.meta.url))
if (fs.existsSync(envFilePath)) {
  process.loadEnvFile?.(envFilePath)
}

let { router } = await import('./app/router.ts')
let { getDemoOrigin, getProviderStatuses } = await import('./app/providers.ts')

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
  let demoUrl = getDemoOrigin()
  let providerStatuses = getProviderStatuses()

  console.log(`social-login demo is running on ${demoUrl}`)
  console.log('')
  console.log('Demo accounts:')
  console.log('  admin@example.com / password123')
  console.log('  user@example.com / password123')
  console.log('')
  console.log('Social login providers:')
  console.log(`  ${formatProviderStatus('Google', providerStatuses.google)}`)
  console.log(`  ${formatProviderStatus('GitHub', providerStatuses.github)}`)
  console.log(`  ${formatProviderStatus('X', providerStatuses.x)}`)
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

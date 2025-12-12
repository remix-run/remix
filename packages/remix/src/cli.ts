#!/usr/bin/env node

import { parseArgs } from 'node:util'
import { showHelp, showVersion, dev, build, routes, typecheck } from './lib/cli/commands.ts'

let commands = {
  build: build,
  dev: dev,
  help: showHelp,
  routes: routes,
  typecheck: typecheck,
  version: showVersion,
}

// Main CLI router
async function main() {
  let { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      help: {
        type: 'boolean',
        short: 'h',
      },
      version: {
        type: 'boolean',
        short: 'v',
      },
    },
    allowPositionals: true,
    strict: false,
  })

  let command = positionals[0]

  if (!command) {
    if (values.help) {
      command = 'help'
    } else if (values.version) {
      command = 'version'
    }
  }

  if (commands.hasOwnProperty(command)) {
    await commands[command as keyof typeof commands]()
  } else {
    console.error(`❌ Unknown command: ${command}`)
    console.log('Run "remix --help" for available commands')
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Catch you on the flip side!')
  process.exit(0)
})

process.on('SIGTERM', () => {
  process.exit(0)
})

main().catch((error) => {
  console.error('❌ Error:', error.message)
  process.exit(1)
})

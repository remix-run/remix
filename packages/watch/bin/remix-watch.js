#!/usr/bin/env node

import { startWatcher } from '../src/index.ts'

let argv = process.argv.slice(2)
let entryPoint = null
let ignore = []
let watch = []

for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--ignore' && argv[i + 1] != null) {
    ignore.push(argv[++i])
  } else if (argv[i] === '--watch' && argv[i + 1] != null) {
    watch.push(argv[++i])
  } else if (argv[i] === '--help' || argv[i] === '-h') {
    console.log(`Usage: remix-watch <entry-point> [options]

Options:
  --ignore <pattern>  Exclude files from watching (can be repeated)
  --watch <path>     Also watch these files (e.g. config loaded via fs.readFile)
  -h, --help         Show this help`)
    process.exit(0)
  } else if (!argv[i].startsWith('-')) {
    entryPoint = argv[i]
  }
}

if (!entryPoint) {
  console.error('Usage: remix-watch <entry-point> [options]')
  console.error('Example: remix-watch server.js')
  console.error('         remix-watch server.js --ignore "**/test/**" --watch config.json')
  process.exit(1)
}

startWatcher(entryPoint, {
  ignore: ignore.length ? ignore : undefined,
  watch: watch.length ? watch : undefined,
})

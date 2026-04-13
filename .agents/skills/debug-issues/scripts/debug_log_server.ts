#!/usr/bin/env node
import { createServer } from 'node:http'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

type ParsedArgs = {
  file: string
  port: number
}

type DebugEntry = {
  receivedAt: string
} & Record<string, unknown>

let scriptDir = dirname(fileURLToPath(import.meta.url))
let defaultFile = resolve(scriptDir, '../tmp/debug-log.jsonl')

function main(): void {
  let parsed = parseArgs(process.argv.slice(2))
  ensureParentDir(parsed.file)
  ensureFile(parsed.file)

  let server = createServer(async (request, response) => {
    applyCors(response)

    if (request.method === 'OPTIONS') {
      response.writeHead(204)
      response.end()
      return
    }

    let url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)

    if (request.method === 'GET' && url.pathname === '/__debug/logs') {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
      response.end(JSON.stringify(readEntries(parsed.file), null, 2))
      return
    }

    if (request.method === 'POST' && url.pathname === '/__debug/log') {
      let body = await readJsonBody(request)
      let entry: DebugEntry = {
        receivedAt: new Date().toISOString(),
        ...(isRecord(body) ? body : { body }),
      }

      appendEntry(parsed.file, entry)
      response.writeHead(202, { 'content-type': 'application/json; charset=utf-8' })
      response.end(JSON.stringify({ ok: true }))
      return
    }

    if (request.method === 'POST' && url.pathname === '/__debug/clear') {
      writeFileSync(parsed.file, '', 'utf8')
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
      response.end(JSON.stringify({ ok: true }))
      return
    }

    if (request.method === 'GET' && url.pathname === '/__debug/health') {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
      response.end(JSON.stringify({ file: parsed.file, ok: true, port: parsed.port }))
      return
    }

    response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
    response.end(JSON.stringify({ error: 'Not found' }))
  })

  server.listen(parsed.port, () => {
    process.stdout.write(`Debug log server listening on http://127.0.0.1:${parsed.port}\n`)
    process.stdout.write(`Log file: ${parsed.file}\n`)
    process.stdout.write('Endpoints: POST /__debug/log, POST /__debug/clear, GET /__debug/logs\n')
  })

  function shutdown(): void {
    server.close(() => {
      process.exit(0)
    })
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

function parseArgs(argv: string[]): ParsedArgs {
  if (argv.includes('-h') || argv.includes('--help')) {
    printUsage()
    process.exit(0)
  }

  let port = 43210
  let file = defaultFile
  let index = 0

  while (index < argv.length) {
    let arg = argv[index]

    if (arg === '--port') {
      let next = argv[index + 1]
      if (!next || !/^[0-9]+$/.test(next)) {
        fail('--port requires a numeric value.')
      }
      port = Number.parseInt(next, 10)
      index += 2
      continue
    }

    if (arg === '--file') {
      let next = argv[index + 1]
      if (!next) {
        fail('--file requires a path.')
      }
      file = resolve(next)
      index += 2
      continue
    }

    if (arg === '--reset') {
      rmSync(file, { force: true })
      index++
      continue
    }

    fail(`Unknown argument: ${arg}`)
  }

  return { file, port }
}

function printUsage(): void {
  process.stdout.write(`Usage:
  node .agents/skills/debug-issues/scripts/debug_log_server.ts [--port 43210] [--file <path>] [--reset]

Examples:
  node .agents/skills/debug-issues/scripts/debug_log_server.ts
  node .agents/skills/debug-issues/scripts/debug_log_server.ts --port 43211 --reset
`)
}

function ensureParentDir(file: string): void {
  mkdirSync(dirname(file), { recursive: true })
}

function ensureFile(file: string): void {
  writeFileSync(file, readFileSafe(file), 'utf8')
}

function readFileSafe(file: string): string {
  try {
    return readFileSync(file, 'utf8')
  } catch {
    return ''
  }
}

function appendEntry(file: string, entry: DebugEntry): void {
  let existing = readFileSafe(file)
  let nextLine = `${JSON.stringify(entry)}\n`
  writeFileSync(file, `${existing}${nextLine}`, 'utf8')
}

function readEntries(file: string): DebugEntry[] {
  let content = readFileSafe(file).trim()
  if (!content) {
    return []
  }

  let lines = content.split('\n')
  let entries: DebugEntry[] = []

  for (let line of lines) {
    if (!line.trim()) continue
    let parsed = JSON.parse(line) as DebugEntry
    entries.push(parsed)
  }

  return entries
}

async function readJsonBody(request: Parameters<typeof createServer>[0]): Promise<unknown> {
  let chunks: Buffer[] = []

  for await (let chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  let text = Buffer.concat(chunks).toString('utf8').trim()
  if (!text) {
    return {}
  }

  return JSON.parse(text)
}

function applyCors(response: Parameters<Parameters<typeof createServer>[0]>[1]): void {
  response.setHeader('access-control-allow-origin', '*')
  response.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS')
  response.setHeader('access-control-allow-headers', 'content-type')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

main()

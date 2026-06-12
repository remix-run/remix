import { pathToFileURL } from 'node:url'

export interface NodeHmrCommand {
  entry: string
  entryArgs: Array<string>
  host: string
  nodeArgs: Array<string>
  port: number
}

export interface NodeHmrCommandResult {
  command?: NodeHmrCommand
  help: boolean
}

export function parseNodeHmrCommand(argv: Array<string>): NodeHmrCommandResult {
  let host = '127.0.0.1'
  let nodeArgs: Array<string> = []
  let port = 0
  let entry: string | undefined
  let entryArgs: Array<string> = []

  for (let index = 0; index < argv.length; index++) {
    let arg = argv[index]
    if (arg === undefined) continue

    if (entry !== undefined) {
      entryArgs.push(arg)
      continue
    }

    if (arg === '--help' || arg === '-h') {
      return { help: true }
    }

    if (arg === '--') {
      entry = argv[index + 1]
      entryArgs = argv.slice(index + 2)
      break
    }

    if (arg === '--hmr-event-host') {
      let value = argv[index + 1]
      if (value !== undefined) {
        host = value
        index++
      }
      continue
    }

    if (arg.startsWith('--hmr-event-host=')) {
      host = arg.slice('--hmr-event-host='.length)
      continue
    }

    if (arg === '--hmr-event-port') {
      let value = argv[index + 1]
      if (value !== undefined) {
        port = parsePort(value)
        index++
      }
      continue
    }

    if (arg.startsWith('--hmr-event-port=')) {
      port = parsePort(arg.slice('--hmr-event-port='.length))
      continue
    }

    assertSupportedNodeArg(arg)
    if (arg.startsWith('-')) {
      nodeArgs.push(arg)
      if (nodeArgConsumesValue(arg)) {
        let value = argv[index + 1]
        if (value === undefined) {
          throw new TypeError(`Missing value for Node option: ${arg}`)
        }
        nodeArgs.push(value)
        index++
      }
      continue
    }

    entry = arg
  }

  if (entry === undefined) {
    return { help: false }
  }

  return {
    command: { entry, entryArgs, host, nodeArgs, port },
    help: false,
  }
}

export function buildNodeArgs(options: {
  entry: string
  entryArgs: Array<string>
  hmrEventUrl: string
  nodeArgs: Array<string>
  registerPath: string
}): Array<string> {
  let registerUrl = pathToFileURL(options.registerPath)
  registerUrl.searchParams.set('hmrEventUrl', options.hmrEventUrl)

  return [...options.nodeArgs, '--import', registerUrl.href, options.entry, ...options.entryArgs]
}

export function shouldIgnoreWatchPath(path: string): boolean {
  let parts = path.split(/[\\/]/)

  return parts.some((part) =>
    ['.git', '.next', '.turbo', 'build', 'coverage', 'dist', 'node_modules'].includes(part),
  )
}

function parsePort(value: string): number {
  let port = Number(value)
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new TypeError(`Invalid HMR event port: ${value}`)
  }
  return port
}

const nodeOptionsWithValues = new Set([
  '--conditions',
  '--cpu-prof-dir',
  '--cpu-prof-interval',
  '--cpu-prof-name',
  '--diagnostic-dir',
  '--disable-proto',
  '--dns-result-order',
  '--env-file',
  '--env-file-if-exists',
  '--experimental-config-file',
  '--experimental-loader',
  '--heap-prof-dir',
  '--heap-prof-interval',
  '--heap-prof-name',
  '--heapsnapshot-near-heap-limit',
  '--heapsnapshot-signal',
  '--icu-data-dir',
  '--import',
  '--loader',
  '--max-http-header-size',
  '--openssl-config',
  '--policy-integrity',
  '--redirect-warnings',
  '--require',
  '--secure-heap',
  '--secure-heap-min',
  '--security-revert',
  '--snapshot-blob',
  '--snapshot-config',
  '--title',
  '--tls-cipher-list',
  '--trace-event-categories',
  '--trace-event-file-pattern',
  '--unhandled-rejections',
  '-C',
  '-r',
])

function nodeArgConsumesValue(arg: string): boolean {
  if (arg.includes('=')) return false
  return nodeOptionsWithValues.has(arg)
}

function assertSupportedNodeArg(arg: string): void {
  let flag = arg.split('=', 1)[0]!

  if (
    flag === '--watch' ||
    flag.startsWith('--watch-') ||
    flag === '--test' ||
    flag.startsWith('--test-') ||
    flag.startsWith('--experimental-test-') ||
    flag === '--run' ||
    flag === '--check' ||
    flag === '--eval' ||
    flag === '--print' ||
    flag === '--interactive' ||
    flag === '-c' ||
    flag === '-i' ||
    isShortExecutionModeArg(arg, '-e') ||
    isShortExecutionModeArg(arg, '-p')
  ) {
    throw new TypeError(`Node option ${flag} is not supported by node-hmr`)
  }
}

function isShortExecutionModeArg(arg: string, flag: '-e' | '-p'): boolean {
  return arg === flag || (arg.startsWith(flag) && !arg.startsWith('--'))
}

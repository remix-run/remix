import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { pathToFileURL } from 'node:url'

let [stage, command, ...args] = process.argv.slice(2)
let directory = path.resolve(process.env.HMR_PERF_ROOT ?? '.tmp/hmr-performance', stage)
fs.mkdirSync(directory, { recursive: true })
let metadata = {
  stage,
  command,
  args,
  at: Date.now(),
  node: process.version,
  v8: process.versions.v8,
  platform: process.platform,
  arch: process.arch,
  availableParallelism: os.availableParallelism(),
  cpus: os.cpus().map((cpu) => ({ model: cpu.model, speed: cpu.speed })),
  totalmem: os.totalmem(),
}
fs.writeFileSync(path.join(directory, 'metadata.json'), JSON.stringify(metadata, null, 2))
let log = fs.openSync(path.join(directory, 'test.log'), 'w')
let env = {
  ...process.env,
  HMR_PERF_DIR: path.join(directory, 'metrics'),
  HMR_PERF_STAGE: stage,
  NODE_OPTIONS: [
    process.env.NODE_OPTIONS,
    '--import',
    pathToFileURL(path.resolve('scripts/hmr-performance-metrics.ts')).href,
  ]
    .filter(Boolean)
    .join(' '),
}
let exec = promisify(execFile)
let previousCpu = os.cpus().map((cpu) => cpu.times)
let sampling = false
let sampleCount = 0
async function sample() {
  if (sampling) return
  sampling = true
  try {
    let currentCpu = os.cpus().map((cpu) => cpu.times)
    let cpuDelta = currentCpu.map((cpu, i) =>
      Object.fromEntries(Object.keys(cpu).map((key) => [key, cpu[key] - previousCpu[i][key]])),
    )
    previousCpu = currentCpu
    let processes = await exec('ps', ['-axo', 'pid,ppid,%cpu,rss,state,comm'], {
      maxBuffer: 8 * 1024 * 1024,
    })
    let vm =
      process.platform === 'darwin' && sampleCount++ % 5 === 0
        ? (await exec('vm_stat')).stdout
        : undefined
    fs.appendFileSync(
      path.join(directory, 'resources.jsonl'),
      JSON.stringify({
        at: Date.now(),
        cpuDelta,
        freemem: os.freemem(),
        loadavg: os.loadavg(),
        processes: processes.stdout,
        vm,
      }) + '\n',
    )
  } catch (error) {
    fs.appendFileSync(path.join(directory, 'sampling-errors.log'), String(error) + '\n')
  } finally {
    sampling = false
  }
}
await sample()
let startedAt = Date.now()
let child = spawn(command, args, { env, stdio: ['ignore', log, log] })
let interval = setInterval(sample, 1000)
let code = await new Promise((resolve, reject) => {
  child.once('exit', resolve)
  child.once('error', reject)
})
clearInterval(interval)
await sample()
fs.closeSync(log)
fs.writeFileSync(
  path.join(directory, 'result.json'),
  JSON.stringify({ code, elapsedMs: Date.now() - startedAt, endedAt: Date.now() }, null, 2),
)
console.log(JSON.stringify({ stage, code, elapsedMs: Date.now() - startedAt, directory }))

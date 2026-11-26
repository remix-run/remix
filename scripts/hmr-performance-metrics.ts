import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const directory = process.env.HMR_PERF_DIR
const groups = new Map<
  string,
  { count: number; bytes: number; wallMs: number; cpuUs: number; urls: Map<string, number> }
>()
if (directory) mkdirSync(directory, { recursive: true })

export function recordWork(kind: string, url: string, bytes: number, wallMs = 0, cpuUs = 0): void {
  if (!directory) return
  let group = groups.get(kind)
  if (!group) {
    group = { count: 0, bytes: 0, wallMs: 0, cpuUs: 0, urls: new Map() }
    groups.set(kind, group)
  }
  group.count++
  group.bytes += bytes
  group.wallMs += wallMs
  group.cpuUs += cpuUs
  group.urls.set(url, (group.urls.get(url) ?? 0) + 1)
}

export function measureSync<result>(
  kind: string,
  url: string,
  bytes: number,
  callback: () => result,
): result {
  if (!directory) return callback()
  let startedAt = performance.now()
  let startedCpu = process.cpuUsage()
  try {
    return callback()
  } finally {
    let cpu = process.cpuUsage(startedCpu)
    recordWork(kind, url, bytes, performance.now() - startedAt, cpu.user + cpu.system)
  }
}

export async function measureAsync<result>(
  kind: string,
  url: string,
  callback: () => Promise<result>,
): Promise<result> {
  if (!directory) return callback()
  let startedAt = performance.now()
  try {
    return await callback()
  } finally {
    recordWork(kind, url, 0, performance.now() - startedAt)
  }
}

export function snapshot(phase: string, detail: object = {}): void {
  if (!directory) return
  let cpu = process.cpuUsage()
  let work = Object.fromEntries(
    [...groups].map(([kind, group]) => [
      kind,
      {
        count: group.count,
        bytes: group.bytes,
        wallMs: group.wallMs,
        cpuUs: group.cpuUs,
        uniqueUrls: group.urls.size,
        repeated: [...group.urls]
          .filter(([, count]) => count > 1)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20),
      },
    ]),
  )
  appendFileSync(
    join(directory, `${process.pid}.jsonl`),
    JSON.stringify({
      at: Date.now(),
      phase,
      pid: process.pid,
      ppid: process.ppid,
      stage: process.env.HMR_PERF_STAGE,
      argv: process.argv,
      cwd: process.cwd(),
      workspace: process.env.npm_package_name,
      uptimeMs: process.uptime() * 1000,
      cpuUserMs: cpu.user / 1000,
      cpuSystemMs: cpu.system / 1000,
      resource: process.resourceUsage(),
      memory: process.memoryUsage(),
      work,
      ...detail,
    }) + '\n',
  )
}

snapshot('process:preload')
process.on('exit', () => snapshot('process:exit'))

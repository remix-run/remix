import * as os from 'node:os'
import * as process from 'node:process'

import * as messages from './messages.ts'
import * as busboy from './parsers/busboy.ts'
import * as fastifyBusboy from './parsers/fastify-busboy.ts'
import * as multipartParser from './parsers/multipart-parser.ts'
import * as multipasta from './parsers/multipasta.ts'

const benchmarks = [
  { name: '1 small file', message: messages.oneSmallFile },
  { name: '1 large file', message: messages.oneLargeFile },
  { name: '100 small files', message: messages.oneHundredSmallFiles },
  { name: '5 large files', message: messages.fiveLargeFiles },
]

interface Parser {
  parse(message: messages.MultipartMessage): Promise<number>
}

async function runParserBenchmarks(parser: Parser, times = 200): Promise<BenchmarkResults[string]> {
  let results: BenchmarkResults[string] = {}

  for (let benchmark of benchmarks) {
    let measurements: number[] = []
    for (let i = 0; i < times; ++i) {
      measurements.push(await parser.parse(benchmark.message))
    }

    results[benchmark.name] = getMeanAndStdDev(measurements)
  }

  return results
}

function getMeanAndStdDev(measurements: number[]): string {
  let mean = measurements.reduce((a, b) => a + b, 0) / measurements.length
  let variance = measurements.reduce((a, b) => a + (b - mean) ** 2, 0) / measurements.length
  let stdDev = Math.sqrt(variance)
  return mean.toFixed(2) + ' ms ± ' + stdDev.toFixed(2)
}

interface BenchmarkResults {
  [parserName: string]: {
    [benchmarkName: string]: string
  }
}

async function runBenchmarks(parserName?: string): Promise<BenchmarkResults> {
  let results: BenchmarkResults = {}

  if (parserName === 'multipart-parser' || parserName === undefined) {
    results['multipart-parser'] = await runParserBenchmarks(multipartParser)
  }
  if (parserName === 'multipasta' || parserName === undefined) {
    results['multipasta'] = await runParserBenchmarks(multipasta)
  }
  if (parserName === 'busboy' || parserName === undefined) {
    results.busboy = await runParserBenchmarks(busboy)
  }
  if (parserName === 'fastify-busboy' || parserName === undefined) {
    results['@fastify/busboy'] = await runParserBenchmarks(fastifyBusboy)
  }

  return results
}

function printResults(results: BenchmarkResults) {
  console.log(`Platform: ${os.type()} (${os.release()})`)
  console.log(`CPU: ${os.cpus()[0].model}`)
  console.log(`Date: ${new Date().toLocaleString()}`)

  if (typeof Bun !== 'undefined') {
    console.log(`Bun ${Bun.version}`)
  } else if (typeof Deno !== 'undefined') {
    console.log(`Deno ${Deno.version.deno}`)
  } else {
    console.log(`Node.js ${process.version}`)
  }

  console.table(results)
}

runBenchmarks(process.argv[2]).then(printResults, (error) => {
  console.error(error)
  process.exit(1)
})

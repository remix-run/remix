import * as os from 'node:os'
import * as process from 'node:process'

import { fixtures } from '../test/utils.ts'

import * as nodeTar from './parsers/node-tar.ts'
import * as tarParser from './parsers/tar-parser.ts'
import * as tarStream from './parsers/tar-stream.ts'

const benchmarks = [{ name: 'lodash npm package', filename: fixtures.lodashNpmPackage }]

interface Parser {
  parse(filename: string): Promise<number>
}

async function runParserBenchmarks(
  parser: Parser,
  times = 1000,
): Promise<BenchmarkResults[string]> {
  let results: BenchmarkResults[string] = {}

  for (let benchmark of benchmarks) {
    let measurements: number[] = []
    for (let i = 0; i < times; ++i) {
      measurements.push(await parser.parse(benchmark.filename))
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

  if (parserName === 'tar-parser' || parserName === undefined) {
    results['tar-parser'] = await runParserBenchmarks(tarParser)
  }
  if (parserName === 'tar-stream' || parserName === undefined) {
    results['tar-stream'] = await runParserBenchmarks(tarStream)
  }
  if (parserName === 'node-tar' || parserName === undefined) {
    results['node-tar'] = await runParserBenchmarks(nodeTar)
  }

  return results
}

function printResults(results: BenchmarkResults) {
  console.log(`Platform: ${os.type()} (${os.release()})`)
  console.log(`CPU: ${os.cpus()[0].model}`)
  console.log(`Date: ${new Date().toLocaleString()}`)
  console.log(`Node.js ${process.version}`)

  console.table(results)
}

runBenchmarks(process.argv[2]).then(printResults, (error) => {
  console.error(error)
  process.exit(1)
})

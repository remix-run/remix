import * as os from 'node:os';

import * as messages from './messages.js';
import * as busboy from './parsers/busboy.js';
import * as fastifyBusboy from './parsers/fastify-busboy.js';
import * as fetchMultipartParser from './parsers/fetch-multipart-parser.js';

const benchmarks = [
  { name: '1 small file', message: messages.oneSmallFile },
  { name: '1 large file', message: messages.oneLargeFile },
  { name: '100 small files', message: messages.oneHundredSmallFiles },
  { name: '5 large files', message: messages.fiveLargeFiles },
];

function getMeanAndStdDev(measurements: number[]): string {
  let mean = measurements.reduce((a, b) => a + b, 0) / measurements.length;
  let variance = measurements.reduce((a, b) => a + (b - mean) ** 2, 0) / measurements.length;
  let stdDev = Math.sqrt(variance);
  return mean.toFixed(2) + ' ms ± ' + stdDev.toFixed(2);
}

interface Parser {
  parse(message: messages.MultipartMessage): Promise<number>;
}

async function runParserBenchmarks(
  parser: Parser,
  times = 1000
): Promise<{ [testName: string]: string }> {
  let results: { [testName: string]: string } = {};

  for (let benchmark of benchmarks) {
    let measurements: number[] = [];
    for (let i = 0; i < times; ++i) {
      measurements.push(await parser.parse(benchmark.message));
    }

    results[benchmark.name] = getMeanAndStdDev(measurements);
  }

  return results;
}

interface BenchmarkResults {
  [parserName: string]: {
    [testName: string]: string;
  };
}

async function runBenchmarks(parserName?: string): Promise<BenchmarkResults> {
  let results: BenchmarkResults = {};

  if (parserName === 'fetch-multipart-parser' || parserName === undefined) {
    results['fetch-multipart-parser'] = await runParserBenchmarks(fetchMultipartParser);
  }
  if (parserName === 'busboy' || parserName === undefined) {
    results.busboy = await runParserBenchmarks(busboy);
  }
  if (parserName === 'fastify-busboy' || parserName === undefined) {
    results['@fastify/busboy'] = await runParserBenchmarks(fastifyBusboy);
  }

  return results;
}

function printResults(results: BenchmarkResults) {
  console.log(`Platform: ${os.type()} (${os.release()})`);
  console.log(`CPU: ${os.cpus()[0].model}`);
  console.log(`Node.js ${process.version}`);
  console.log(`Date: ${new Date().toLocaleString()}`);
  console.table(results);
}

runBenchmarks(process.argv[2]).then(printResults, (error) => {
  console.error(error);
  process.exit(1);
});

interface MultipartMessage {
  boundary: string;
  payload: string;
}

function createMultipartMessage(boundary: string, partSizes: number[]): MultipartMessage {
  let parts = [];
  for (let i = 0; i < partSizes.length; i++) {
    parts.push(`--${boundary}`);
    parts.push(`Content-Disposition: form-data; name="file${i}"; filename="file${i}.txt"`);
    parts.push('Content-Type: text/plain');
    parts.push('');
    parts.push('x'.repeat(partSizes[i]));
  }
  parts.push(`--${boundary}--`);
  return {
    boundary,
    payload: parts.join('\r\n'),
  };
}

interface MultipartBenchmark {
  name: string;
  message: MultipartMessage;
}

const oneKb = 1024;
const oneMb = 1024 * oneKb;
const benchmarks: MultipartBenchmark[] = [
  {
    name: '1-small-file',
    message: createMultipartMessage('----WebKitFormBoundaryzv0Og5zWtGjvzP2A', [oneKb]),
  },
  {
    name: '100-small-files',
    message: createMultipartMessage(
      '----WebKitFormBoundaryzv0Og5zWtGjvzP2A',
      Array(100).fill(oneKb)
    ),
  },
  {
    name: '1-large-file',
    message: createMultipartMessage('----WebKitFormBoundaryzv0Og5zWtGjvzP2A', [10 * oneMb]),
  },
  {
    name: '5-large-files',
    message: createMultipartMessage('----WebKitFormBoundaryzv0Og5zWtGjvzP2A', [
      10 * oneMb,
      10 * oneMb,
      10 * oneMb,
      20 * oneMb,
      50 * oneMb,
    ]),
  },
];

interface MultipartParser {
  name: string;
  parse: (message: MultipartMessage) => Promise<number>;
}

const parsers: MultipartParser[] = [
  {
    name: 'fetch-multipart-parser',
    async parse(message: MultipartMessage): Promise<number> {
      const { parseMultipartStream } = await import('../dist/index.js');

      let buffer = new TextEncoder().encode(message.payload);
      let stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(buffer);
          controller.close();
        },
      });

      let start = performance.now();

      let iterator = parseMultipartStream(message.boundary, stream, { maxFileSize: Infinity });
      for await (let part of iterator) {
        // Do nothing
      }

      return performance.now() - start;
    },
  },
  {
    name: 'busboy',
    async parse(message: MultipartMessage): Promise<number> {
      const { Readable } = await import('stream');
      const busboy = await import('busboy');

      let stream = new Readable({
        read() {
          this.push(message.payload);
          this.push(null);
        },
      });

      return new Promise((resolve, reject) => {
        let start = performance.now();

        let bb = busboy.default({
          headers: { 'content-type': `multipart/form-data; boundary=${message.boundary}` },
          limits: { fileSize: Infinity },
        });

        bb.on('error', reject);

        bb.on('close', () => {
          resolve(performance.now() - start);
        });

        stream.pipe(bb);
      });
    },
  },
  {
    name: '@fastify/busboy',
    async parse(message: MultipartMessage): Promise<number> {
      const { Readable } = await import('stream');
      const busboy = await import('@fastify/busboy');

      let stream = new Readable({
        read() {
          this.push(message.payload);
          this.push(null);
        },
      });

      return new Promise((resolve, reject) => {
        let start = performance.now();

        let bb = new busboy.Busboy({
          headers: { 'content-type': `multipart/form-data; boundary=${message.boundary}` },
          limits: { fileSize: Infinity },
        });

        bb.on('error', reject);

        bb.on('finish', () => {
          resolve(performance.now() - start);
        });

        stream.pipe(bb);
      });
    },
  },
];

interface BenchmarkResults {
  [parserName: string]: {
    [testName: string]: string;
  };
}

async function runBenchmarks(): Promise<BenchmarkResults> {
  let results: BenchmarkResults = {};

  for (let parser of parsers) {
    results[parser.name] = {};

    for (let benchmark of benchmarks) {
      let time = await parser.parse(benchmark.message);
      results[parser.name][benchmark.name] = time.toFixed(2) + ' ms';
    }
  }

  return results;
}

function printResults(results: BenchmarkResults) {
  console.table(results);
}

runBenchmarks().then(printResults, (error) => {
  console.error(error);
  process.exit(1);
});

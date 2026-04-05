import { Worker } from 'node:worker_threads';
import { pathToFileURL } from 'node:url';
const workerUrl = new URL('./worker.ts', import.meta.url);
export async function runServerTests(files, reporter, concurrency, type) {
    let counts = { passed: 0, failed: 0, skipped: 0, todo: 0 };
    let envLabel = type;
    function accumulate(results, file) {
        reporter.onResult({ ...results, tests: results.tests.map((t) => ({ ...t, filePath: file })) }, envLabel);
        counts.passed += results.passed;
        counts.failed += results.failed;
        counts.skipped += results.skipped;
        counts.todo += results.todo;
    }
    await runInConcurrentWorkers(files, concurrency, (file) => runFileInWorker(file, type), accumulate, () => counts.failed++);
    return { ...counts };
}
async function runInConcurrentWorkers(files, concurrency, runFile, onResult, onError) {
    let index = 0;
    let active = 0;
    await new Promise((resolve) => {
        function dispatch() {
            while (active < concurrency && index < files.length) {
                let file = files[index];
                index++;
                active++;
                runFile(file).then((results) => {
                    onResult(results, file);
                    active--;
                    if (index < files.length) {
                        dispatch();
                    }
                    else if (active === 0) {
                        resolve();
                    }
                }, (err) => {
                    console.error(`Error running ${file}:`, err.message);
                    console.error(err);
                    onError();
                    active--;
                    if (active === 0 && index >= files.length)
                        resolve();
                    else
                        dispatch();
                });
            }
            if (index >= files.length && active === 0)
                resolve();
        }
        dispatch();
    });
}
function runFileInWorker(file, type) {
    return new Promise((resolve, reject) => {
        let worker = new Worker(workerUrl, {
            workerData: {
                file: pathToFileURL(file).href,
                type,
            },
        });
        let results;
        worker.once('message', (msg) => {
            results = msg;
        });
        worker.once('error', reject);
        worker.once('exit', (code) => {
            if (code !== 0)
                reject(new Error(`Worker exited with code ${code}`));
            else if (results)
                resolve(results);
            else
                reject(new Error('Worker exited without sending results'));
        });
    });
}

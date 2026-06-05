import { parentPort, workerData } from 'node:worker_threads';
import { runE2ETestFile } from "./worker-e2e-file.js";
if (!parentPort) {
    throw new Error('E2E test worker is missing a parent port');
}
const port = parentPort;
const results = await runE2ETestFile(workerData, (openResults) => {
    port.postMessage(openResults);
});
if (results) {
    port.postMessage(results);
}
process.exit(0);

import { runE2ETestFile } from "./worker-e2e-file.js";
import { runServerTestFile } from "./worker-server.js";
import { createFailedResults } from "./worker-results.js";
const workerData = await readWorkerData();
const results = await runWorkerProcessFile(workerData);
if (results) {
    await sendResults(results);
}
if (process.connected) {
    process.disconnect();
}
process.exitCode = 0;
function readWorkerData() {
    return new Promise((resolve, reject) => {
        function cleanup() {
            process.off('message', onMessage);
            process.off('disconnect', onDisconnect);
        }
        function onMessage(value) {
            cleanup();
            resolve(value);
        }
        function onDisconnect() {
            cleanup();
            reject(new Error('Test worker process disconnected'));
        }
        process.once('message', onMessage);
        process.once('disconnect', onDisconnect);
    });
}
async function runWorkerProcessFile(value) {
    try {
        if (!isRecord(value) || (value.type !== 'server' && value.type !== 'e2e')) {
            throw new Error('Invalid test worker process data');
        }
        return value.type === 'e2e'
            ? await runE2ETestFile(value, sendResults)
            : await runServerTestFile(value);
    }
    catch (error) {
        return createFailedResults(error);
    }
}
async function sendResults(results) {
    if (!process.send) {
        throw new Error('Test worker process is missing an IPC channel');
    }
    let send = process.send.bind(process);
    await new Promise((resolve, reject) => {
        send(results, undefined, undefined, (error) => (error ? reject(error) : resolve()));
    });
}
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}

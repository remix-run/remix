import type { TestResults } from './reporters/results.ts';
export declare const isWorkerThread: boolean;
export declare function receiveWorkerData<T>(): T | Promise<T>;
export declare function sendResults(results: TestResults): void;
//# sourceMappingURL=worker-channel.d.ts.map
import { mock } from "./mock.js";
export function createTestContext() {
    let cleanups = [];
    let testContext = {
        mock: mock.fn,
        spyOn(obj, method, impl) {
            let mockFn = mock.spyOn(obj, method, impl);
            if (mockFn.mock.restore)
                cleanups.push(mockFn.mock.restore);
            return mockFn;
        },
        after(fn) {
            cleanups.push(fn);
        },
    };
    return {
        testContext,
        async cleanup() {
            for (let fn of cleanups)
                await fn();
            cleanups.length = 0;
        },
    };
}

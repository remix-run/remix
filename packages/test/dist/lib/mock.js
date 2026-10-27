function createMockFn(impl) {
    let calls = [];
    let fn = function (...args) {
        let call = { arguments: args };
        calls.push(call);
        if (impl) {
            try {
                let result = impl.apply(this, args);
                call.result = result;
                return result;
            }
            catch (error) {
                call.error = error;
                throw error;
            }
        }
        return undefined;
    };
    fn.mock = { calls };
    return fn;
}
function createMethodMock(obj, method, impl) {
    let original = obj[method];
    let effectiveImpl = (impl ?? original);
    let mockFn = createMockFn(effectiveImpl);
    obj[method] = mockFn;
    mockFn.mock.restore = () => {
        obj[method] = original;
    };
    return mockFn;
}
/**
 * Utilities for creating mock functions and method spies. Mirrors the names
 * on Node.js's built-in `MockTracker` from `node:test`.
 *
 * @example
 * // Standalone mock
 * const fn = mock.fn((x: number) => x * 2)
 * fn(3)
 * assert.equal(fn.mock.calls[0].result, 6)
 *
 * // Mock an existing method
 * const spy = mock.method(console, 'log')
 * console.log('hello')
 * assert.equal(spy.mock.calls.length, 1)
 * spy.mock.restore?.()
 */
export const mock = {
    /**
     * Creates a mock function that records every call. If `impl` is provided it
     * is used as the underlying implementation; otherwise the mock returns
     * `undefined`.
     */
    fn: createMockFn,
    /**
     * Replaces `obj[methodName]` with a mock and records every call. The
     * original method is used as the implementation unless `impl` is provided.
     * Call `mockFn.mock.restore()` to revert.
     */
    method: createMethodMock,
};

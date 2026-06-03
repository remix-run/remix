import { AssertionError, assert as assertFn, deepEqual, doesNotMatch, doesNotReject, doesNotThrow, equal, fail, match, notDeepEqual, notEqual, ok, partialDeepEqual, rejects, throws, } from "./lib/assert.js";
export * from "./lib/assert.js";
export { expect } from "./lib/expect.js";
const assert = Object.assign(assertFn, {
    AssertionError,
    assert: assertFn,
    ok,
    equal,
    notEqual,
    deepEqual,
    partialDeepEqual,
    notDeepEqual,
    fail,
    match,
    doesNotMatch,
    throws,
    doesNotThrow,
    rejects,
    doesNotReject,
});
export default assert;

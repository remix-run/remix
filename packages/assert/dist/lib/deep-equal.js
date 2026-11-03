function isObject(value) {
    return (typeof value === 'object' && value !== null) || typeof value === 'function';
}
function getTag(value) {
    return Object.prototype.toString.call(value);
}
function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value, key);
}
function getEnumerableKeys(value, skip = new Set()) {
    let keys = Object.keys(value);
    for (let symbol of Object.getOwnPropertySymbols(value)) {
        if (Object.prototype.propertyIsEnumerable.call(value, symbol)) {
            keys.push(symbol);
        }
    }
    return keys.filter((key) => !skip.has(key));
}
function hasCompared(memo, actual, expected) {
    return memo.get(actual)?.has(expected) === true;
}
function rememberComparison(memo, actual, expected) {
    let expectedSet = memo.get(actual);
    if (expectedSet === undefined) {
        expectedSet = new WeakSet();
        memo.set(actual, expectedSet);
    }
    expectedSet.add(expected);
}
function compareBytes(actualBytes, expectedBytes, mode) {
    if (mode === 'full' && actualBytes.length !== expectedBytes.length)
        return false;
    if (mode === 'partial' && actualBytes.length < expectedBytes.length)
        return false;
    if (mode === 'full') {
        for (let index = 0; index < actualBytes.length; index++) {
            if (actualBytes[index] !== expectedBytes[index])
                return false;
        }
        return true;
    }
    let actualIndex = 0;
    for (let expectedByte of expectedBytes) {
        let matched = false;
        while (actualIndex < actualBytes.length) {
            if (actualBytes[actualIndex] === expectedByte) {
                matched = true;
                actualIndex++;
                break;
            }
            actualIndex++;
        }
        if (!matched)
            return false;
    }
    return true;
}
function compareArrayBuffer(actual, expected, mode) {
    if (mode === 'full' && actual.byteLength !== expected.byteLength)
        return false;
    if (mode === 'partial' && actual.byteLength < expected.byteLength)
        return false;
    return compareBytes(new Uint8Array(actual), new Uint8Array(expected), mode);
}
function getViewBytes(value) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
}
function compareArrayBufferView(actual, expected, mode) {
    if (actual.constructor !== expected.constructor)
        return false;
    if (mode === 'full' && actual.byteLength !== expected.byteLength)
        return false;
    if (mode === 'partial' && actual.byteLength < expected.byteLength)
        return false;
    return compareBytes(getViewBytes(actual), getViewBytes(expected), mode);
}
function isArrayIndexKey(key) {
    if (typeof key !== 'string')
        return false;
    if (key === '')
        return false;
    let index = Number(key);
    return Number.isInteger(index) && index >= 0 && index < 2 ** 32 - 1 && String(index) === key;
}
function getEnumerableArrayIndexKeys(value) {
    return Object.keys(value).filter(isArrayIndexKey);
}
function compareOwnEnumerable(actual, expected, memo, mode, skip = new Set()) {
    let actualKeys = getEnumerableKeys(actual, skip);
    let expectedKeys = getEnumerableKeys(expected, skip);
    if (mode === 'full' && actualKeys.length !== expectedKeys.length)
        return false;
    if (mode === 'partial' && actualKeys.length < expectedKeys.length)
        return false;
    for (let key of expectedKeys) {
        if (!hasOwn(actual, key))
            return false;
        if (!compare(actual[key], expected[key], memo, mode)) {
            return false;
        }
    }
    return true;
}
function compareMap(actual, expected, memo, mode) {
    if (mode === 'full' && actual.size !== expected.size)
        return false;
    if (mode === 'partial' && actual.size < expected.size)
        return false;
    let unmatched = Array.from(actual.entries());
    for (let [expectedKey, expectedValue] of expected) {
        let matchIndex = unmatched.findIndex(([actualKey, actualValue]) => compare(actualKey, expectedKey, memo, mode) &&
            compare(actualValue, expectedValue, memo, mode));
        if (matchIndex === -1)
            return false;
        unmatched.splice(matchIndex, 1);
    }
    return true;
}
function compareSet(actual, expected, memo, mode) {
    if (mode === 'full' && actual.size !== expected.size)
        return false;
    if (mode === 'partial' && actual.size < expected.size)
        return false;
    let unmatched = Array.from(actual.values());
    for (let expectedValue of expected) {
        let matchIndex = unmatched.findIndex((actualValue) => compare(actualValue, expectedValue, memo, mode));
        if (matchIndex === -1)
            return false;
        unmatched.splice(matchIndex, 1);
    }
    return true;
}
function comparePartialArrayItems(actual, expected, memo, mode) {
    let actualKeys = getEnumerableArrayIndexKeys(actual);
    let actualKeyIndex = 0;
    for (let expectedKey of getEnumerableArrayIndexKeys(expected)) {
        let matched = false;
        while (actualKeyIndex < actualKeys.length) {
            let actualKey = actualKeys[actualKeyIndex];
            actualKeyIndex++;
            if (actualKey !== undefined &&
                compare(actual[Number(actualKey)], expected[Number(expectedKey)], memo, mode)) {
                matched = true;
                break;
            }
        }
        if (!matched)
            return false;
    }
    return true;
}
function compareBoxedPrimitive(actual, expected) {
    try {
        return Object.is(actual.valueOf(), expected.valueOf());
    }
    catch {
        return false;
    }
}
function compareError(actual, expected, memo, mode) {
    if (actual.name !== expected.name)
        return false;
    if (actual.message !== expected.message)
        return false;
    let actualHasCause = hasOwn(actual, 'cause');
    let expectedHasCause = hasOwn(expected, 'cause');
    if (mode === 'full' && actualHasCause !== expectedHasCause)
        return false;
    if (expectedHasCause && !actualHasCause)
        return false;
    if (expectedHasCause &&
        !compare(actual.cause, expected.cause, memo, mode)) {
        return false;
    }
    let actualHasErrors = hasOwn(actual, 'errors');
    let expectedHasErrors = hasOwn(expected, 'errors');
    if (mode === 'full' && actualHasErrors !== expectedHasErrors)
        return false;
    if (expectedHasErrors && !actualHasErrors)
        return false;
    if (expectedHasErrors &&
        !compare(actual.errors, expected.errors, memo, mode)) {
        return false;
    }
    return compareOwnEnumerable(actual, expected, memo, mode, new Set(['cause', 'errors', 'message', 'name', 'stack']));
}
function compare(actual, expected, memo, mode) {
    if (Object.is(actual, expected))
        return true;
    if (!isObject(actual) || !isObject(expected))
        return false;
    if (typeof actual !== typeof expected)
        return false;
    if (typeof actual === 'function')
        return false;
    if (hasCompared(memo, actual, expected))
        return true;
    if (mode === 'full' && Object.getPrototypeOf(actual) !== Object.getPrototypeOf(expected)) {
        return false;
    }
    let actualTag = getTag(actual);
    if (actualTag !== getTag(expected))
        return false;
    rememberComparison(memo, actual, expected);
    if (Array.isArray(actual) || Array.isArray(expected)) {
        if (!Array.isArray(actual) || !Array.isArray(expected))
            return false;
        if (mode === 'full' && actual.length !== expected.length)
            return false;
        if (mode === 'partial' && actual.length < expected.length)
            return false;
        if (mode === 'full')
            return compareOwnEnumerable(actual, expected, memo, mode);
        let skip = new Set([
            ...getEnumerableArrayIndexKeys(actual),
            ...getEnumerableArrayIndexKeys(expected),
        ]);
        return (comparePartialArrayItems(actual, expected, memo, mode) &&
            compareOwnEnumerable(actual, expected, memo, mode, skip));
    }
    if (actual instanceof Date && expected instanceof Date) {
        return (Object.is(actual.getTime(), expected.getTime()) &&
            compareOwnEnumerable(actual, expected, memo, mode));
    }
    if (actual instanceof RegExp && expected instanceof RegExp) {
        return (actual.source === expected.source &&
            actual.flags === expected.flags &&
            actual.lastIndex === expected.lastIndex &&
            compareOwnEnumerable(actual, expected, memo, mode));
    }
    if (actual instanceof Error && expected instanceof Error) {
        return compareError(actual, expected, memo, mode);
    }
    if (actual instanceof Map && expected instanceof Map) {
        return (compareMap(actual, expected, memo, mode) && compareOwnEnumerable(actual, expected, memo, mode));
    }
    if (actual instanceof Set && expected instanceof Set) {
        return (compareSet(actual, expected, memo, mode) && compareOwnEnumerable(actual, expected, memo, mode));
    }
    if (actualTag === '[object ArrayBuffer]' || actualTag === '[object SharedArrayBuffer]') {
        return (compareArrayBuffer(actual, expected, mode) &&
            compareOwnEnumerable(actual, expected, memo, mode));
    }
    if (ArrayBuffer.isView(actual) || ArrayBuffer.isView(expected)) {
        if (!ArrayBuffer.isView(actual) || !ArrayBuffer.isView(expected))
            return false;
        let skip = mode === 'partial'
            ? new Set([
                ...getEnumerableArrayIndexKeys(actual),
                ...getEnumerableArrayIndexKeys(expected),
            ])
            : new Set();
        return (compareArrayBufferView(actual, expected, mode) &&
            compareOwnEnumerable(actual, expected, memo, mode, skip));
    }
    if (actualTag === '[object Boolean]' ||
        actualTag === '[object Number]' ||
        actualTag === '[object String]' ||
        actualTag === '[object BigInt]' ||
        actualTag === '[object Symbol]') {
        return (compareBoxedPrimitive(actual, expected) && compareOwnEnumerable(actual, expected, memo, mode));
    }
    if (actualTag === '[object Promise]' ||
        actualTag === '[object WeakMap]' ||
        actualTag === '[object WeakSet]') {
        return false;
    }
    if (actual instanceof URL && expected instanceof URL) {
        return String(actual) === String(expected) && compareOwnEnumerable(actual, expected, memo, mode);
    }
    if (actual instanceof URLSearchParams && expected instanceof URLSearchParams) {
        return compareOwnEnumerable(actual, expected, memo, mode);
    }
    return compareOwnEnumerable(actual, expected, memo, mode);
}
export function isDeepEqual(actual, expected) {
    return compare(actual, expected, new WeakMap(), 'full');
}
export function isPartialDeepEqual(actual, expected) {
    return compare(actual, expected, new WeakMap(), 'partial');
}

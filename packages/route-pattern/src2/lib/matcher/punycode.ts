// Adapted from https://github.com/mathiasbynens/punycode.js/blob/9e1b2cda98d215d3a73fcbfe93c62e021f4ba768/punycode.js

/** Highest positive signed 32-bit float value */
const maxInt = 2147483647 // aka. 0x7FFFFFFF or 2^31-1

/** Bootstring parameters */
const base = 36
const tMin = 1
const tMax = 26
const skew = 38
const damp = 700
const initialBias = 72
const initialN = 128 // 0x80
const delimiter = '-' // '\x2D'

/** Regular expressions */
const regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g // RFC 3490 separators

/** Error messages */
const errors = {
  overflow: 'Overflow: input needs wider integers to process',
  'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
  'invalid-input': 'Invalid input',
}

type ErrorType = keyof typeof errors

const baseMinusTMin = base - tMin

/*--------------------------------------------------------------------------*/

/**
 * A generic error utility function.
 * @param type The error type.
 */
function error(type: ErrorType): never {
  throw new RangeError(errors[type])
}

/**
 * A simple `Array#map`-like wrapper to work with domain name strings or email
 * addresses.
 * @param domain The domain name or email address.
 * @param callback The function that gets called for every character.
 * @returns A new string of characters returned by the callback function.
 */
function mapDomain(domain: string, callback: (value: string) => string): string {
  let parts = domain.split('@')
  let result = ''
  if (parts.length > 1) {
    // In email addresses, only the domain name should be punycoded. Leave
    // the local part (i.e. everything up to `@`) intact.
    result = parts[0] + '@'
    domain = parts[1]
  }
  domain = domain.replace(regexSeparators, '.')
  let labels = domain.split('.')
  let encoded = labels.map(callback).join('.')
  return result + encoded
}

/**
 * Converts a basic code point into a digit/integer.
 * @see `digitToBasic()`
 * @param codePoint The basic numeric code point value.
 * @returns The numeric value of a basic code point in the range `0` to
 * `base - 1`, or `base` if the code point does not represent a value.
 */
function basicToDigit(codePoint: number): number {
  if (codePoint >= 0x30 && codePoint < 0x3a) {
    return 26 + (codePoint - 0x30)
  }
  if (codePoint >= 0x41 && codePoint < 0x5b) {
    return codePoint - 0x41
  }
  if (codePoint >= 0x61 && codePoint < 0x7b) {
    return codePoint - 0x61
  }
  return base
}

/**
 * Bias adaptation function as per section 3.4 of RFC 3492.
 * https://tools.ietf.org/html/rfc3492#section-3.4
 * @param delta The current delta.
 * @param numPoints The number of code points handled.
 * @param firstTime Whether this is the first adaptation.
 * @returns The adapted bias.
 */
function adapt(delta: number, numPoints: number, firstTime: boolean): number {
  let k = 0
  delta = firstTime ? Math.floor(delta / damp) : delta >> 1
  delta += Math.floor(delta / numPoints)
  for (; /* no initialization */ delta > (baseMinusTMin * tMax) >> 1; k += base) {
    delta = Math.floor(delta / baseMinusTMin)
  }
  return Math.floor(k + ((baseMinusTMin + 1) * delta) / (delta + skew))
}

/**
 * Converts a Punycode string of ASCII-only symbols to a string of Unicode
 * symbols.
 * @param input The Punycode string of ASCII-only symbols.
 * @returns The resulting string of Unicode symbols.
 */
function decode(input: string): string {
  // Don't use UCS-2.
  let output: number[] = []
  let inputLength = input.length
  let i = 0
  let n = initialN
  let bias = initialBias

  // Handle the basic code points: let `basic` be the number of input code
  // points before the last delimiter, or `0` if there is none, then copy
  // the first basic code points to the output.

  let basic = input.lastIndexOf(delimiter)
  if (basic < 0) {
    basic = 0
  }

  for (let j = 0; j < basic; ++j) {
    // if it's not a basic code point
    if (input.charCodeAt(j) >= 0x80) {
      error('not-basic')
    }
    output.push(input.charCodeAt(j))
  }

  // Main decoding loop: start just after the last delimiter if any basic code
  // points were copied; start at the beginning otherwise.

  for (let index = basic > 0 ? basic + 1 : 0; index < inputLength /* no final expression */; ) {
    // `index` is the index of the next character to be consumed.
    // Decode a generalized variable-length integer into `delta`,
    // which gets added to `i`. The overflow checking is easier
    // if we increase `i` as we go, then subtract off its starting
    // value at the end to obtain `delta`.
    let oldi = i
    for (let w = 1, k = base /* no condition */; ; k += base) {
      if (index >= inputLength) {
        error('invalid-input')
      }

      let digit = basicToDigit(input.charCodeAt(index++))

      if (digit >= base) {
        error('invalid-input')
      }
      if (digit > Math.floor((maxInt - i) / w)) {
        error('overflow')
      }

      i += digit * w
      let t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias

      if (digit < t) {
        break
      }

      let baseMinusT = base - t
      if (w > Math.floor(maxInt / baseMinusT)) {
        error('overflow')
      }

      w *= baseMinusT
    }

    let out = output.length + 1
    bias = adapt(i - oldi, out, oldi === 0)

    // `i` was supposed to wrap around from `out` to `0`,
    // incrementing `n` each time, so we'll fix that now:
    if (Math.floor(i / out) > maxInt - n) {
      error('overflow')
    }

    n += Math.floor(i / out)
    i %= out

    // Insert `n` at position `i` of the output.
    output.splice(i++, 0, n)
  }

  return String.fromCodePoint(...output)
}

/**
 * Converts a Punycode string representing a domain name or an email address
 * to Unicode. Only the Punycoded parts of the input will be converted, i.e.
 * it doesn't matter if you call it on a string that has already been
 * converted to Unicode.
 * @param input The Punycoded domain name or email address to convert to
 * Unicode.
 * @returns The Unicode representation of the given Punycode string.
 */
export const toUnicode = function (input: string): string {
  // Optimization: skip if no punycode markers found
  if (!input.includes('xn--')) return input

  return mapDomain(input, function (string: string) {
    return string.startsWith('xn--') ? decode(string.slice(4).toLowerCase()) : string
  })
}

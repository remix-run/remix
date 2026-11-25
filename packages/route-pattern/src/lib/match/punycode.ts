// Adapted from punycode.js by Mathias Bynens, MIT licensed:
// https://github.com/mathiasbynens/punycode.js/blob/9e1b2cda98d215d3a73fcbfe93c62e021f4ba768/punycode.js

const maxInt = 2147483647
const base = 36
const tMin = 1
const tMax = 26
const skew = 38
const damp = 700
const initialBias = 72
const initialN = 128
const delimiter = '-'
const baseMinusTMin = base - tMin

function basicToDigit(codePoint: number): number {
  if (codePoint >= 0x30 && codePoint < 0x3a) return 26 + (codePoint - 0x30)
  if (codePoint >= 0x41 && codePoint < 0x5b) return codePoint - 0x41
  if (codePoint >= 0x61 && codePoint < 0x7b) return codePoint - 0x61
  return base
}

// RFC 3492 section 3.4 bias adaptation
function adapt(delta: number, numPoints: number, firstTime: boolean): number {
  let k = 0
  delta = firstTime ? Math.floor(delta / damp) : delta >> 1
  delta += Math.floor(delta / numPoints)
  for (; delta > (baseMinusTMin * tMax) >> 1; k += base) {
    delta = Math.floor(delta / baseMinusTMin)
  }
  return Math.floor(k + ((baseMinusTMin + 1) * delta) / (delta + skew))
}

function decodeLabel(input: string): string {
  let output: number[] = []
  let inputLength = input.length
  let i = 0
  let n = initialN
  let bias = initialBias

  let basic = input.lastIndexOf(delimiter)
  if (basic < 0) basic = 0

  for (let j = 0; j < basic; ++j) {
    let code = input.charCodeAt(j)
    if (code >= 0x80) throw new RangeError('Illegal input >= 0x80 (not a basic code point)')
    output.push(code)
  }

  for (let index = basic > 0 ? basic + 1 : 0; index < inputLength; ) {
    let oldi = i
    for (let w = 1, k = base; ; k += base) {
      if (index >= inputLength) throw new RangeError('Invalid input')

      let digit = basicToDigit(input.charCodeAt(index++))
      if (digit >= base) throw new RangeError('Invalid input')
      if (digit > Math.floor((maxInt - i) / w)) {
        throw new RangeError('Overflow: input needs wider integers to process')
      }

      i += digit * w
      let t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias
      if (digit < t) break

      let baseMinusT = base - t
      if (w > Math.floor(maxInt / baseMinusT)) {
        throw new RangeError('Overflow: input needs wider integers to process')
      }
      w *= baseMinusT
    }

    let out = output.length + 1
    bias = adapt(i - oldi, out, oldi === 0)

    if (Math.floor(i / out) > maxInt - n) {
      throw new RangeError('Overflow: input needs wider integers to process')
    }

    n += Math.floor(i / out)
    i %= out
    output.splice(i++, 0, n)
  }

  return String.fromCodePoint(...output)
}

export function decodeHostname(input: string): string {
  if (input.indexOf('--') === -1) return input

  return input
    .split('.')
    .map((label) => {
      let lower = label.toLowerCase()
      return lower.startsWith('xn--') ? decodeLabel(lower.slice(4)) : label
    })
    .join('.')
}

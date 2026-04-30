// This file exists solely to validate coverage accuracy.
// Each function has a known expected coverage profile based on
// which paths the associated tests exercise.

// Fully covered — both statements and the single branch
export function add(a: number, b: number): number {
  return a + b
}

// Partially covered — only the `n > 0` branch is tested
export function classify(n: number): string {
  if (n > 0) {
    return 'positive'
  } else if (n < 0) {
    return 'negative'
  } else {
    return 'zero'
  }
}

// Never called — 0% across the board
export function uncalledFunction(): string {
  let result = 'never'
  result += ' reached'
  return result
}

// Partially covered — only the truthy `name` branch is tested
export function greet(name?: string): string {
  if (name) {
    return `Hello, ${name}!`
  }
  return 'Hello, stranger!'
}

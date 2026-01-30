export function unreachable(value?: never): never {
  let message = value === undefined ? 'Unreachable' : `Unreachable: ${value}`
  throw new Error(message)
}

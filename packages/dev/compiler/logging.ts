export function log(...args: any[]) {
  console.log(...args);
}

export function logInfo(...args: any[]) {
  if (process.env.VERBOSE) log(...args);
}

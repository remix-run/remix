// Temporary, opt-in instrumentation for the bookstore CI hang investigation.
export function diagnostic(message: string): void {
  if (typeof process === 'undefined' || process.env.REMIX_TEST_DIAGNOSTICS !== '1') return
  console.error(
    `[test-diagnostics ${new Date().toISOString()} pid=${process.pid} ${process.env.REMIX_TEST_DIAGNOSTIC_FILE}] ${message}`,
  )
}

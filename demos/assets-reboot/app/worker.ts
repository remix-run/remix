// Deliberately naive recursive fibonacci — CPU-bound to clearly demonstrate
// that this is running off the main thread.
function fib(n: number): number {
  return n <= 1 ? n : fib(n - 1) + fib(n - 2)
}

addEventListener('message', (event: MessageEvent<number>) => {
  postMessage(fib(event.data))
})

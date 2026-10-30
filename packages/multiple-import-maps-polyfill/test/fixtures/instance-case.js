import 'a'

const bPromise = import('b')

export async function check() {
  await bPromise
  return window.common_a === window.common_b
}

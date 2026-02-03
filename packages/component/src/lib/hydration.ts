export function logHydrationMismatch(...msg: any[]) {
  console.error('Hydration mismatch:', ...msg)
}

export function skipComments(cursor: Node | null): Node | null {
  while (cursor && cursor.nodeType === Node.COMMENT_NODE) {
    cursor = cursor.nextSibling
  }
  return cursor
}

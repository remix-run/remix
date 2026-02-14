import type { HydrationPolicy } from './types.ts'

export function createHydrationPolicy(
  overrides: Partial<HydrationPolicy> = {},
): HydrationPolicy {
  return {
    normalizeCursor,
    claimText(candidate, value) {
      if (candidate.data === value) {
        return { node: candidate, nextCursor: normalizeCursor(candidate.nextSibling) }
      }

      if (candidate.data.startsWith(value) && value.length < candidate.data.length) {
        let remainder = candidate.splitText(value.length)
        return { node: candidate, nextCursor: normalizeCursor(remainder) }
      }

      candidate.data = value
      return { node: candidate, nextCursor: normalizeCursor(candidate.nextSibling) }
    },
    matchElement(candidate, type) {
      return candidate.tagName.toLowerCase() === type
    },
    onElementMismatch() {},
    getRetryCandidate(candidate) {
      return normalizeCursor(candidate?.nextSibling ?? null)
    },
    ...overrides,
  }
}

function normalizeCursor(cursor: null | Node): null | Node {
  while (cursor?.nodeType === Node.COMMENT_NODE) {
    cursor = cursor.nextSibling
  }
  return cursor
}

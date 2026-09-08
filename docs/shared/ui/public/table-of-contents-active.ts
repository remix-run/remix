export function getActiveHeadingIndex(
  headingTops: number[],
  activationLine: number,
  atDocumentEnd: boolean,
): number {
  if (headingTops.length === 0) {
    return -1
  }

  if (atDocumentEnd) {
    return headingTops.length - 1
  }

  let activeIndex = 0
  for (let [index, top] of headingTops.entries()) {
    if (top > activationLine) {
      break
    }
    activeIndex = index
  }

  return activeIndex
}

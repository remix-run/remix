// A heading becomes current once its top crosses this line. It sits below the fixed header plus
// part of the viewport, so the next section activates as it nears the top instead of touching it.
export function getActivationLine(viewportHeight: number, wideViewport: boolean): number {
  let headerLine = wideViewport ? 116 : 88
  return headerLine + Math.min(160, viewportHeight * 0.15)
}

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

export interface MarkdownSections<node> {
  intro: node[]
  sections: node[][]
}

export function groupMarkdownSections<node>(
  nodes: readonly node[],
  startsSection: (node: node) => boolean,
): MarkdownSections<node> {
  let intro: node[] = []
  let sections: node[][] = []

  for (let node of nodes) {
    if (startsSection(node)) {
      sections.push([node])
      continue
    }

    let current = sections.at(-1) ?? intro
    current.push(node)
  }

  return { intro, sections }
}

/**
 * Topologically sorts items into groups where items in each group
 * have no dependencies on each other (within the set).
 * Items in later groups depend on items in earlier groups.
 * Uses Kahn's algorithm.
 *
 * @returns Array of groups, where each group can be processed in parallel
 * @throws Error if circular dependencies are detected
 */
export function topologicalSortAndGroup<Item extends { name: string; dependencies: string[] }>(
  items: Item[],
): Item[][] {
  let itemsByName = new Map(items.map((item) => [item.name, item]))
  let inDegree = new Map<string, number>()
  let groups: Item[][] = []
  let processed = 0

  // Initialize in-degree for all items
  for (let item of items) {
    inDegree.set(item.name, 0)
  }

  // Calculate in-degree (number of dependencies within the set)
  for (let item of items) {
    for (let dep of item.dependencies) {
      if (itemsByName.has(dep)) {
        inDegree.set(item.name, (inDegree.get(item.name) || 0) + 1)
      }
    }
  }

  // Process in groups - each group contains items with no remaining dependencies
  while (processed < items.length) {
    // Find all items with in-degree 0 that haven't been processed yet
    let group = items.filter(
      (item) => inDegree.get(item.name) === 0 && !groups.flat().includes(item),
    )

    if (group.length === 0) {
      // No items with in-degree 0 means we have a cycle
      let remaining = items.filter((item) => !groups.flat().includes(item)).map((item) => item.name)
      throw new Error(`Circular dependency detected involving: ${remaining.join(', ')}`)
    }

    groups.push(group)
    processed += group.length

    // Decrement in-degree for items that depend on items in this group
    for (let item of group) {
      for (let other of items) {
        if (other.dependencies.includes(item.name)) {
          inDegree.set(other.name, (inDegree.get(other.name) || 0) - 1)
        }
      }
    }
  }

  return groups
}

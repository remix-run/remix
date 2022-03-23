export const sortBy = <Item, Key>(keyFunction: (item: Item) => Key) => {
  return (a: Item, b: Item) => {
    let keyA = keyFunction(a)
    let keyB = keyFunction(b)
    if (keyA < keyB) return -1
    if (keyA > keyB) return 1
    return 0
  }
}
export interface Benchmark {
  run(): void
  teardown(): void
}

export interface Framework {
  name: string
  insert: () => Benchmark
  // swap: Benchmark
  // update: Benchmark
  // replace: Benchmark
}

export type Row = { id: number; label: string }

let idCounter = 1

const A = [
    'pretty',
    'large',
    'big',
    'small',
    'tall',
    'short',
    'long',
    'handsome',
    'plain',
    'quaint',
    'clean',
    'elegant',
    'easy',
    'angry',
    'crazy',
    'helpful',
    'mushy',
    'odd',
    'unsightly',
    'adorable',
    'important',
    'inexpensive',
    'cheap',
    'expensive',
    'fancy',
  ],
  C = [
    'red',
    'yellow',
    'blue',
    'green',
    'pink',
    'brown',
    'purple',
    'brown',
    'white',
    'black',
    'orange',
  ],
  N = [
    'table',
    'chair',
    'house',
    'bbq',
    'desk',
    'car',
    'pony',
    'cookie',
    'sandwich',
    'burger',
    'pizza',
    'mouse',
    'keyboard',
  ]

export function buildData(count: number) {
  let data = new Array(count)

  for (let i = 0; i < count; i++) {
    // Use deterministic selection based on index to ensure same data every time
    data[i] = {
      id: idCounter++,
      label: `${A[i % A.length]} ${C[i % C.length]} ${N[i % N.length]}`,
    }
  }

  return data
}

export function get1000Rows(): Row[] {
  return buildData(1000)
}

export function get10000Rows(): Row[] {
  return buildData(10000)
}

export function updatedEvery10thRow(data: Row[]): Row[] {
  let newData = data.slice(0)
  for (let i = 0, d = data, len = d.length; i < len; i += 10) {
    newData[i] = { id: data[i].id, label: data[i].label + ' !!!' }
  }
  return newData
}

export function swapRows(data: Row[]): Row[] {
  let d = data.slice()
  if (d.length > 998) {
    let tmp = d[1]
    d[1] = d[998]
    d[998] = tmp
  }
  return d
}

export function remove(data: Row[], id: number): Row[] {
  return data.filter((d) => d.id !== id)
}

export function sortRows(data: Row[], ascending: boolean = true): Row[] {
  let sorted = data.slice().sort((a, b) => {
    if (ascending) {
      return a.label.localeCompare(b.label)
    } else {
      return b.label.localeCompare(a.label)
    }
  })
  return sorted
}

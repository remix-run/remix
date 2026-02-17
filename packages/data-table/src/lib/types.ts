export type Pretty<value> = {
  [key in keyof value]: value[key]
} & {}

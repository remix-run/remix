import { definePlugin } from '../types.ts'

export const propAliases = definePlugin(() => () => (input) => {
  let props = input.props

  if ('className' in props && !('class' in props)) {
    props.class = props.className
  }
  if ('className' in props) {
    delete props.className
  }

  if ('htmlFor' in props && !('for' in props)) {
    props.for = props.htmlFor
  }
  if ('htmlFor' in props) {
    delete props.htmlFor
  }

  return input
})

import { createContextKey, type Middleware } from 'remix/router'

export const ExecutionTrace = createContextKey<string[]>()

export function initializeExecutionTrace(): Middleware {
  return (context, next) => {
    context.set(ExecutionTrace, ['router middleware'])
    return next()
  }
}

export function traceController(name: string): Middleware {
  return (context, next) => {
    let trace = context.get(ExecutionTrace)
    if (!trace) throw new Error('Execution trace middleware did not run')

    trace.push(`${name} controller middleware`)
    return next()
  }
}

export function traceMount(name: string): Middleware {
  return (context, next) => {
    let trace = context.get(ExecutionTrace)
    if (!trace) throw new Error('Execution trace middleware did not run')

    trace.push(`${name} mount middleware`)
    return next()
  }
}

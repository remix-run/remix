export type ElementFunction = ((...args: never[]) => unknown) & { readonly name?: string }

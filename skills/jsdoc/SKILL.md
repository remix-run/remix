---
name: jsdoc
description: Guidelines for writing good JSDoc comments on TypeScript APIs. Use this skill when adding or improving JSDoc comments on exported functions, classes, interfaces, type aliases, and their members.
---

# Writing Good JSDoc Comments

## When to add JSDoc

Add JSDoc to every exported API: functions, classes, interfaces, type aliases, and class/interface properties. Private or internal helpers do not need JSDoc.

Constructor signatures need a JSDoc comment with a description line (not just `@param` tags — TypeDoc requires a summary to consider the signature documented).

## Style

**Tense and voice**: Use present tense. Start with a verb or noun phrase.

- `Creates a new route with the given method and pattern.` ✓
- `A context object that contains information about the current request.` ✓
- `This function will create...` ✗

**Length**: One sentence is usually enough. Add a second sentence or paragraph only when there is important context, a caveat, or a non-obvious behavior worth calling out.

**Links**: Use `{@link API}` to link to related APIs when it adds value. Don't link every related API — use discretion to avoid noise.

**Backticks**: Use backticks for all other unlinked code references — identifiers, HTTP methods, special values.

```ts
/** Returns `true` if the key exists in the context. */
/** Calls the `next` function to continue the middleware chain. */
/** Matches `GET` and `HEAD` requests. */
```

## Tags

**`@param`**: One line per parameter. No type annotation (TypeDoc reads the signature). Keep descriptions brief.

```ts
/**
 * @param key The context key to look up
 * @param defaultValue Fallback value if the key is not set
 */
```

Specify `@param` default values in parenthesis - do not use the `@default` tag.

```ts
/**
 * @param concurrency Number of concurrent processes (default 1)
 */
```

**`@returns`**: Describe what is returned. Use backticks for special return values.

```ts
/** @returns The matched route, or `undefined` if no route matches. */
/** @returns `true` if the middleware chain was short-circuited. */
```

**`@example`**: Include when the API is non-obvious or has an important usage pattern. Use a fenced code block with a language tag.

````ts
/**
 * Creates a compression middleware.
 *
 * @example
 * ```ts
 * let router = createRouter({
 *   middleware: [compression()],
 * })
 * ```
 */
````

Skip `@example` for simple getters, trivial constructors, or APIs whose usage is self-evident from the description.

## Interfaces and type aliases

Document what the type represents, not just its name. Properties need their own JSDoc if they are non-obvious.

```ts
/**
 * Options for configuring the compression middleware.
 */
export interface CompressionOptions {
  /**
   * Minimum response size in bytes before compression is applied.
   * Only enforced when the `Content-Length` header is present.
   * Default: `1024`
   */
  threshold?: number
}
```

Type aliases for function shapes should describe what the function does:

```ts
/**
 * A handler invoked when a route matches. Receives the request context and
 * returns a `Response`.
 */
export type Action<...> = ...
```

## What to avoid

- Don't restate the name or type: `/** The name. */` for a `name: string` property adds nothing.
- Don't pad with filler: `/** This function creates a route. */` vs `/** Creates a route. */` — drop "This function".
- Don't document `@param` or `@returns` if the description is identical to the type signature with no added meaning.
- Don't add `@throws` unless the function throws in a meaningful, caller-relevant way.

## Validation

We use `eslint-plugin-jsdoc` to help validate JSDocs, so always validate that linting is passing when adding/editing JSDocs.

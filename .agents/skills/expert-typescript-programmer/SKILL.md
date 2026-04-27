---
name: expert-typescript-programmer
description: Write, refactor, or review TypeScript code with strict, precise, maintainable types and without unnecessary `any`, type assertions, or type suppressions. Use when working on `.ts` or `.tsx` files, public APIs, generics, discriminated unions, type guards, tsconfig/module settings, declaration-facing code, or any change where TypeScript type quality affects correctness in the Remix repo.
---

# Expert TypeScript Programmer

## Overview

Use this skill to write TypeScript that is simple at runtime and precise at compile time.
Prefer local repo conventions first, then apply the official TypeScript guidance summarized here.

## Workflow

1. Read the nearest `tsconfig.json`, package `package.json`, and relevant existing source before choosing types.
2. Model the runtime contract first: inputs, outputs, failure modes, ownership boundaries, and public API shape.
3. Use TypeScript to make invalid states hard to represent, but keep the implementation readable JavaScript.
4. Validate unknown external data at the boundary; do not pretend unvalidated data already matches an internal type.
5. Run the narrowest meaningful validation command before finishing: package typecheck/test for package changes, `pnpm run typecheck:changed` and `pnpm run test:changed` for broader changes, and `pnpm run lint` when practical.

## Repo Rules

- Use `import type { X }` and `export type { X }` for type-only symbols.
- Include `.ts` extensions in relative imports and exports, matching this repo's `allowImportingTsExtensions` / `rewriteRelativeImportExtensions` setup.
- Follow public API boundaries: each package export maps to a top-level `src/*.ts`; `src/lib` is implementation-only.
- Do not re-export APIs or types from another package. Import from the package that owns the symbol.
- Prefer Web APIs and standards-aligned primitives over Node-specific APIs when either works.
- Use repo style: `let` for locals, module-scope `const`, regular functions by default, arrows for callbacks, object method shorthand, native class fields, and `#private`.
- Use descriptive lowercase generic names in this repo, such as `source`, `pattern`, or `method`, instead of single-letter names unless local code already uses that convention.

## Package Structure

- Keep public barrels honest: top-level `src/*.ts` export files should re-export each public symbol directly from the module where it is defined, not through a `src/lib` pass-through barrel.
- Treat `src/lib` files as implementation owners. Split implementation by responsibility, but do not add thin re-export wrappers or indirect ownership inside `src/lib`.
- Export only APIs that a package consumer should rely on. Do not expose internal factories, data tables, or helper types just because they are useful across implementation modules.
- When moving functionality between modules, move the owning types with it or re-export them only from the package-level public entry point. Avoid making an implementation module look like a public API aggregator.
- Prefer internal factories or closures for configuration that should not leak into helper signatures. Public-facing helpers should not require callers to thread implementation booleans or mode flags through repeated calls.
- If a helper name implies a stronger semantic contract than the implementation provides, either narrow the name or keep it private until a package actually needs it. For example, terminal display width is different from code point length.
- Share constants from a single owning module when separate modules must agree on protocol values, escape sequences, sentinels, or discriminants. Avoid duplicating magic strings that can drift.
- Keep module dependency graphs one-way. When splitting modules, choose clear ownership so lower-level modules do not import from higher-level consumers, even for type-only imports.
- After public API changes, check the package barrel, README examples, tests, and change files together so documentation and exports match the actual supported surface.

## API Documentation

- When adding or tightening public JSDoc, use the `write-api-docs` skill; it owns detailed JSDoc style, ESLint expectations, and API-docs workflow.
- Treat JSDoc as part of the public type contract. It should document behavior, defaults, units, and edge cases that TypeScript cannot express, not repeat type syntax.
- Use names and docs that do not over-promise. If an API only counts code points, do not describe it as terminal display width; if a helper is not ready as a supported contract, keep it internal.
- Keep package metadata, README examples, JSDoc, tests, and change files aligned with the same public API surface.

## Type Design

- Let inference work for local variables and callback parameters when the initializer or context is obvious.
- Add explicit return types on exported functions, public methods, overloaded implementations, recursive functions, and functions where the return type is part of the contract.
- Use `unknown` for values that must be inspected before use. Avoid `any`; it disables useful type checking and spreads unsafety through every value it touches.
- Use primitive types `string`, `number`, `boolean`, `symbol`, and `object`; do not use boxed types like `String`, `Number`, `Boolean`, `Symbol`, or `Object`.
- Prefer `interface` for new public object shapes and option objects. Prefer `type` for unions, tuples, mapped types, conditional types, and aliases over non-object shapes.
- Represent states with discriminated unions when behavior depends on a mode, status, kind, or variant. Use exhaustive checks when adding or changing variants.
- Prefer literal unions and const objects over enums unless the surrounding package already established enums for that domain.
- Use `satisfies` when an object literal must conform to a broader type while preserving narrow property inference.
- Use `as const` for literal tables, discriminants, and tuples that should remain narrow and readonly. Do not use it to paper over mutable data flow.

## Avoid Type Holes

- Do not fix TypeScript errors by adding `any`, `as SomeType`, `!`, `@ts-ignore`, or `@ts-expect-error`. First improve the type model, add control-flow narrowing, validate unknown input, or change the API shape.
- Treat explicit `any` as a last resort for migration or broken third-party types only. Prefer `unknown` at boundaries and narrow it before use.
- Do not put `any` in public APIs unless the API truly accepts and safely handles every JavaScript value. In almost all new code, `unknown`, a generic, or a union is a better contract.
- Avoid type assertions as routine casting. A TypeScript assertion is erased at runtime; it does not parse, validate, convert, or make an unsafe value safe.
- Use an assertion only when there is a real proof TypeScript cannot express, such as a checked DOM query, a validated schema result, or an external library invariant. Keep the assertion as close as possible to that proof.
- When adapting bad external types, isolate the unsafe assertion in one small helper with a precise return type. Do not let `any` leak through the rest of the package.
- Prefer reusable type guards or assertion functions over repeated casts when the same runtime check appears more than once.
- Avoid double assertions like `value as unknown as Target`; if one is unavoidable, wrap it at the boundary and document the invariant.
- Before accepting a cast, ask whether `satisfies`, `as const`, an explicit return type, a discriminated union, a generic constraint, or a local variable with a narrower type would express the intent without disabling checking.

## Null, Optional, And Indexed Values

- Keep `strictNullChecks` discipline: handle `null` and `undefined` before using a value.
- Prefer explicit `value !== undefined`, `value !== null`, or `value != null` checks over broad truthiness when `''`, `0`, `false`, or empty arrays are valid values.
- Treat `property?: T` as an absent-property model. If the key is always present but the value can be missing, write `property: T | undefined`.
- When indexing arrays, tuples, maps, records, or URL/search params, account for missing values before using the result.
- Use non-null assertions (`!`) only when a nearby invariant proves the value exists and the code cannot express that proof cleanly. Keep the assertion local.

## Functions And APIs

- Prefer a union parameter over overloads when the implementation and return type are the same for each accepted input shape.
- Use overloads for genuinely different call signatures. Put the most specific overloads first and the most general overload last.
- Do not make callback parameters optional unless the implementation may actually call the callback without that argument.
- Use `() => void` for callbacks whose return value is ignored.
- Avoid `Function`; write the callable shape, for example `(request: Request) => Response | Promise<Response>`.
- Avoid boolean flag parameters when they create multiple behavioral modes. Prefer named option objects or discriminated unions.
- Keep public option objects extensible and documented when changing public APIs.

## Generics

- Introduce a type parameter only when it relates at least two positions, such as input-to-output, key-to-object, item-to-collection, or callback-to-value.
- Use as few type parameters as possible. Remove parameters that do not change the resulting type.
- Prefer the type parameter itself over a constrained container when that improves inference.
- Add constraints only for capabilities the implementation actually uses, such as `extends { length: number }` or `extends keyof source`.
- Prefer inferred type arguments for callers. Require explicit type arguments only when inference cannot represent the intended contract.
- Do not create generic types that ignore their type parameter.

## Boundaries And Assertions

- Parse and narrow untrusted inputs before converting them into internal types: JSON, request bodies, headers, environment values, dynamic route params, filesystem data, and third-party responses.
- Keep type assertions close to the runtime proof. Prefer a small type guard or assertion function when the proof is reusable.
- Avoid double assertions like `value as unknown as Target` unless adapting an external type hole; isolate them and explain the invariant if the reason is not obvious.
- Do not silence type errors with `@ts-ignore` or `@ts-expect-error` unless a test or upstream compatibility case requires it. Include the concrete reason.

## Review Checklist

- Does the type model match real runtime behavior, including errors and absent values?
- Did the change preserve package export boundaries and type ownership?
- Are type-only imports and `.ts` extensions correct?
- Do package-level exports point directly at the owning modules where symbols are defined?
- Did the change avoid turning `src/lib` modules into pass-through barrels or accidental public API aggregators?
- Is every exported helper/type something consumers should depend on now, not just an implementation convenience?
- Are public JSDoc comments written from the consumer's point of view, documenting semantics instead of repeating types?
- Do package metadata, README examples, JSDoc, and tests describe the same public API surface?
- Are `any`, assertions, non-null assertions, and suppressions absent? If not, is each one isolated, proved by nearby runtime logic, and impossible to express with safer TypeScript?
- Are generics necessary, minimal, and inference-friendly?
- Are unions narrowed explicitly enough that each branch is safe?
- If this changes public API, are tests, JSDoc, README examples, and change files handled by the relevant repo skills?

## Official Sources

- [TypeScript Handbook: Everyday Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html)
- [TypeScript Handbook: Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [TypeScript Handbook: More on Functions](https://www.typescriptlang.org/docs/handbook/2/functions.html)
- [TypeScript Handbook: Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html)
- [TypeScript Handbook: Modules](https://www.typescriptlang.org/docs/handbook/2/modules.html)
- [TypeScript Declaration Files: Do's and Don'ts](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)
- [TypeScript Modules: Choosing Compiler Options](https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html)
- [TSConfig: strict](https://www.typescriptlang.org/tsconfig/strict.html)
- [TSConfig: verbatimModuleSyntax](https://www.typescriptlang.org/tsconfig/verbatimModuleSyntax.html)
- [TSConfig: exactOptionalPropertyTypes](https://www.typescriptlang.org/tsconfig/exactOptionalPropertyTypes.html)
- [TSConfig: noUncheckedIndexedAccess](https://www.typescriptlang.org/tsconfig/noUncheckedIndexedAccess.html)
- [TypeScript 4.9: satisfies Operator](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html)
- [TypeScript 3.4: const Assertions](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html)

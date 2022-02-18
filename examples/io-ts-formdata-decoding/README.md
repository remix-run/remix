# FormData decoding with io-ts

This example shows how to utilize [io-ts](https://gcanti.github.io/io-ts/) to decode [FormData](https://developer.mozilla.org/de/docs/Web/API/FormData).

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in codesandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/io-ts-formdata-encoding)

## Example

### Motivation

When working directly with `FormData` in a Remix action, it's often inconvenient to narrow down the exact types.

TypeScript cannot statically analyze `FormData` because its values are only known at runtime: it's the user who fills out a form with the values of their choosing. That's why TypeScript will assign the type `FormDataEntryValue | null` as the return type of any call to `FormData#get`:

```typescript
const formData = await request.formData();
const name = formData.get("name"); // type: `FormDataEntryValue | null`
const age = formData.get("age"); // type: `FormDataEntryValue | null`
```

Typically, you want to _do something_ with `name` and `age`, e.g. create a new user in a database with [Prisma](https://www.prisma.io/). Since Prisma's database client is type-safe, it will expect `name` to be a `string` and `age` to be a `number`, which is not the case:

```typescript
const user = await prisma.user.create({
  data: {
    name, // type error
    age // type error
  }
});
```

The resulting type errors could be sidestepped with [type assertions](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-assertions):

```typescript
const name = formData.get("name") as string;
const age = formData.get("age") as number;
```

This could lead to subtle bugs, however. Since the data is provided by the user,
those assertions are not guaranteed to be safe:

> Reminder: Because type assertions are removed at compile-time, there is no
> runtime checking associated with a type assertion. There won’t be an exception
> or null generated if the type assertion is wrong.

### Solution

io-ts describes itself as a _"runtime type system for IO decoding/encoding"_. It can do what TypeScript by itself is not designed for: validate types at runtime. `app/formData.ts` implements a function `decodeFormData` that takes a `Request` and a [runtime representation of a type](https://gcanti.github.io/io-ts/modules/index.ts.html#type) and returns a correctly typed record with the form's data. In case the data is malformed, it will throw a [422 Uprocessable Entity](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/422).

The route `app/routes/index.tsx` implements an action that calls `decodeFormData`. It also implements a [CatchBoundary](https://remix.run/docs/en/v1/api/conventions#catchboundary), which will render iff you provide anything other than a number to the `<input name="age" />`.

## Related Links

- [io-ts docs](https://gcanti.github.io/io-ts/)
- [fp-ts docs](https://gcanti.github.io/fp-ts/)

### Alternatives

If the functional approach of io-ts and fp-ts is unfamiliar to you, there are alternatives that may be more approachable or might fit better for your use case:

- [joi](https://github.com/sideway/joi): "The most powerful data validation library for JS"
- [Superstruct](https://github.com/ianstormtaylor/superstruct): "A simple and composable way to validate data in JavaScript (and TypeScript)."
- [Yup](https://github.com/jquense/yup): "Dead simple Object schema validation"
- [Zod](https://github.com/colinhacks/zod): "TypeScript-first schema validation with static type inference"

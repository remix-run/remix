BREAKING CHANGE: Remove `createHrefBuilder`, `type HrefBuilder`, `type HrefBuilderArg`

`createHrefBuilder` was the original design and implementation of href generation,
but with the new `RoutePattern.href` method it is now obsolete.

Use `HrefArgs` instead of `HrefBuilderArgs`:

```ts
// before
type Args = HrefBuilderArgs<Source>

// after
type Args = HrefArgs<Source>
```


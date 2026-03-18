BREAKING CHANGE: `RoutePattern.ast` is now typed as deeply readonly.

This was always the intended design; the type system now reflects it:

```ts
// Before
pattern.ast = { ...pattern.ast, protocol: 'https' }
pattern.ast.protocol = 'https'
pattern.ast.port = '443'
pattern.ast.hostname = null
pattern.ast.pathname = otherPattern.ast.pathname
pattern.ast.search.set('q', new Set(['x']))
pattern.ast.pathname.tokens.push({ type: 'text', text: 'x' })
pattern.ast.pathname.optionals.set(0, 1)

// After
pattern.ast = { ...pattern.ast, protocol: 'https' }
//      ~~~
// Cannot assign to 'ast' because it is a read-only property. (2703)

pattern.ast.protocol = 'https'
//          ~~~~~~~~~
// Cannot assign to 'protocol' because it is a read-only property. (2540)

pattern.ast.port = '443'
//          ~~~~
// Cannot assign to 'port' because it is a read-only property. (2540)

pattern.ast.hostname = null
//          ~~~~~~~~
// Cannot assign to 'hostname' because it is a read-only property. (2540)

pattern.ast.pathname = otherPattern.ast.pathname
//          ~~~~~~~~
// Cannot assign to 'pathname' because it is a read-only property. (2540)

pattern.ast.search.set('q', new Set(['x']))
//                 ~~~
// Property 'set' does not exist on type 'ReadonlyMap<string, ReadonlySet<string> | null>'. (2339)


pattern.ast.pathname.tokens.push({ type: 'text', text: 'x' })
//                          ~~~~
// Property 'push' does not exist on type 'ReadonlyArray<PartPatternToken>'. (2339)

pattern.ast.pathname.optionals.set(0, 1)
//                             ~~~
// Property 'set' does not exist on type 'ReadonlyMap<number, number>'. (2339)
```

Add getters to `RoutePattern`

The `protocol`, `hostname`, `port`, `pathname`, and `search` getters display the normalized pattern parts as strings.

```ts
let pattern = RoutePattern.parse('https://:tenant.example.com:3000/:lang/docs/*?version=:version')

pattern.protocol // 'https'
pattern.hostname // ':tenant.example.com'
pattern.port // '3000'
pattern.pathname // ':lang/docs/*'
pattern.search // 'version=:version'
```

Omitted parts return empty strings.

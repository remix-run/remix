Matches return decoded values for params in pathname

```ts
let pattern = new RoutePattern('/posts/:slug')

let url = new URL('https://blog.example.com/posts/💿')
pattern.match(url)?.params.slug
// Before -> '%F0%9F%92%BF'
// After -> '💿'

url = new URL('https://blog.example.com/posts/café-hà-nội')
pattern.match(url)?.params.slug
// Before -> 'caf%C3%A9-h%C3%A0-n%E1%BB%99i'
// After -> 'café-hà-nội'

url = new URL('https://blog.example.com/posts/北京')
pattern.match(url)?.params.slug
// Before -> '%E5%8C%97%E4%BA%AC'
// After -> '北京'

url = new URL('https://blog.example.com/posts/مرحبا')
pattern.match(url)?.params.slug
// Before -> '%D9%85%D8%B1%D8%AD%D8%A8%D8%A7'
// After -> 'مرحبا'
```

If you need percent-encoded text again, use [`encodeURI`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURI):

```ts
let url = new URL('https://blog.example.com/posts/💿')
let slug = pattern.match(url)!.params.slug
// -> 💿

encodeURI(slug)
// -> '%F0%9F%92%BF'
```

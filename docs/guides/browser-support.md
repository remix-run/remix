---
title: Browser Support
---

# Browser Support

Thanks to first-class support for [Progressive Enhancement][pe], Remix apps can support browsers as old as Netscape 1.0! This works because Remix server renders and fully supports `<form>` for mutations. Rather than JavaScript _enabling_ the app to work, in a Remix app, JavaScript enhances the user experience of the app. App functionality is the baseline. Yep, you read that right:

<docs-success>Remix supports IE11 and _older_.</docs-success>

This is the case even if the libraries you're using to enhance the UX don't support older browsers.

So the question is less: "which browsers does Remix support" and more "which browsers can be progressively enhanced." The answer to that is: ["browsers that support `<script type="modlue">`."][esm-browsers]

It's pretty simple, here's how it works:

```html
<script type="module">
  <!-- Modern browser! -->
</script>
```

For older browsers, they just ignore that `script` tag because they don't understand the `type`. So no JavaScript is loaded and links (GETs) and forms (POSTs) work the way they've always worked. Your actions will be called exactly the same way regardless of the browser making those requests.

This is the power of progressive enhancement. Your mental model stays the same and you support every browser your users are using.

[pe]: https://en.wikipedia.org/wiki/Progressive_enhancement
[esm-browsers]: https://caniuse.com/es6-module

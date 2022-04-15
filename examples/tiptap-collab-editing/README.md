# Real time collaborative editing using tiptap and webrtc

this is an example of using tiptap,yjs and webrtc to do real time collaborative editing across device and browsers

## Relevent files

```
app
├── routes
│   └── editor.tsx // tiptab editor route, open it in different browser to see the changes get sync
└── utils
    └── webrtc.client.tsx //init the webrtc, ydoc and collaboration plugin on client
```

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/tiptap-collab-editing)

## Related Links

- [Collaborative editing – Tiptap Editor](https://tiptap.dev/guide/collaborative-editing#show-other-cursors)
- [Remix | Module Constraints](https://remix.run/docs/en/v1/guides/constraints#document-guard)

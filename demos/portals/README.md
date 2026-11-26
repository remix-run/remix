# Portals

Body and custom destinations, retargeting, shared containers, nested portals, and owner/destination/document frame reloads. Edit the note or increment the counter, then reload or retarget. Ctrl+Enter in the note reloads its owner without moving focus.

Inside a client entry, portal children render in the browser during hydration and subsequent updates. Portals render nothing on the server.

```sh
pnpm --dir demos/portals start
```

Open [localhost:44100](http://localhost:44100). Run `pnpm --dir demos/portals test` and `pnpm --dir demos/portals typecheck` for validation.

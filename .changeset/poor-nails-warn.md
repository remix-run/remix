---
"@remix-run/dev": patch
---

fix race where app server responds with updated manifest version _before_ dev server is listening for it

dev server now listens for updated versions _before_ writing the server changes, guaranteeing that it is listening
before the app server gets a chance to send its 'ready' message

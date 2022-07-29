---
"remix": patch
"@remix-run/dev": patch
---

use esbuild's new automatic jsx transform

there are no code changes from your end, but by using the new transform, we can prevent duplicate React imports from appearing in your build (#2987)

the automatic jsx transform was introduced in React 17 and allows you to write your React code without ever needing to import React to just write jsx, if you used `useState` or other hooks, you still needed it. However up until now, esbuild didnt support this and instead recommended you to use a "shim" to add `import React from 'react'` to your files to get the same affect. This unfortantely has caused some pain points with some external libraries resulting in React being declared multiple times, but no more! (Chance said so himself, so... go tell him if it's busted)

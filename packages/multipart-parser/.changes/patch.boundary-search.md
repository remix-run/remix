Speed up multipart boundary search on Bun, which now uses native `Buffer.indexOf` like Node.js. Bun 1.4.3 is now the minimum supported Bun version.

Runtimes without a global `Buffer`, such as Cloudflare Workers without Node.js compatibility, now use a Knuth–Morris–Pratt search. It takes linear time even when a request chooses a boundary designed to slow down parsing, but it is slower than the previous search on typical uploads.

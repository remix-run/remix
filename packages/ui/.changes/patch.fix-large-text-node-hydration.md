Fix hydration duplication when a text node exceeds the browser's per-node character cap

The hydration reconciler now correctly handles the case where the browser's HTML
parser splits a long server-rendered text node (>64KB in Chromium) into multiple
adjacent DOM text nodes. Previously only the reverse direction (one DOM text node
spanning several vnodes) was handled, causing content after the first chunk to be
duplicated in the DOM.

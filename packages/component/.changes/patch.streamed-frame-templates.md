Streamed `<Frame>` content no longer loses items when the browser receives its template in multiple network chunks during initial page loading, including when a script appends a sibling before parsing finishes. Waiting for frame content also preserves application-owned `<template>` elements (see #11975).

Templates without a completion marker render once the document finishes parsing.

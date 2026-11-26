Fix failed HMR edits replacing working component implementations when a module throws or rejects a top-level `await`. Existing references and setup callbacks continue to use the last working version.

/**
 * Adapted from https://github.com/facebook/react/blob/main/packages/react-dom-bindings/src/client/ReactInputSelection.js
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 * MIT License
 *
 * Eventually should be able to use moveBefore and won't need this at all.
 */
export declare function createDocumentState(_doc?: Document): {
    capture: () => void;
    restore: () => void;
};

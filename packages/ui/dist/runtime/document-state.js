/**
 * Adapted from https://github.com/facebook/react/blob/main/packages/react-dom-bindings/src/client/ReactInputSelection.js
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 * MIT License
 *
 * Eventually should be able to use moveBefore and won't need this at all.
 */
export function createDocumentState(_doc) {
    let doc = _doc ?? document;
    function getActiveElement() {
        return doc.activeElement || doc.body;
    }
    function hasSelectionCapabilities(elem) {
        let nodeName = elem.nodeName.toLowerCase();
        return ((nodeName === 'input' &&
            'type' in elem &&
            (elem.type === 'text' ||
                elem.type === 'search' ||
                elem.type === 'tel' ||
                elem.type === 'url' ||
                elem.type === 'password')) ||
            nodeName === 'textarea' ||
            (elem instanceof HTMLElement && elem.contentEditable === 'true'));
    }
    function getSelection(input) {
        if ('selectionStart' in input &&
            typeof input.selectionStart === 'number' &&
            'selectionEnd' in input) {
            let htmlInput = input;
            return {
                start: htmlInput.selectionStart ?? 0,
                end: htmlInput.selectionEnd ?? htmlInput.selectionStart ?? 0,
            };
        }
        // For contentEditable, we'd need more complex logic, but for now return null
        return null;
    }
    function setSelection(input, offsets) {
        if ('selectionStart' in input && 'selectionEnd' in input) {
            try {
                let htmlInput = input;
                htmlInput.selectionStart = offsets.start;
                htmlInput.selectionEnd = Math.min(offsets.end, htmlInput.value?.length ?? 0);
            }
            catch {
                // Ignore errors setting selection
            }
        }
    }
    function isInDocument(node) {
        return doc.documentElement.contains(node);
    }
    function getSelectionInformation() {
        let focusedElem = getActiveElement();
        return {
            focusedElem,
            selectionRange: focusedElem && hasSelectionCapabilities(focusedElem) ? getSelection(focusedElem) : null,
        };
    }
    function restoreSelection(priorSelectionInformation) {
        let curFocusedElem = getActiveElement();
        let priorFocusedElem = priorSelectionInformation.focusedElem;
        let priorSelectionRange = priorSelectionInformation.selectionRange;
        if (curFocusedElem !== priorFocusedElem && priorFocusedElem && isInDocument(priorFocusedElem)) {
            // Save scroll positions before focusing (focusing can change scroll)
            let ancestors = [];
            let ancestor = priorFocusedElem;
            while (ancestor) {
                if (ancestor.nodeType === Node.ELEMENT_NODE) {
                    let el = ancestor;
                    ancestors.push({
                        element: el,
                        left: el.scrollLeft ?? 0,
                        top: el.scrollTop ?? 0,
                    });
                }
                ancestor = ancestor.parentNode;
            }
            // Restore selection if applicable
            if (priorSelectionRange !== null && hasSelectionCapabilities(priorFocusedElem)) {
                setSelection(priorFocusedElem, priorSelectionRange);
            }
            // Restore focus
            if (priorFocusedElem instanceof HTMLElement && typeof priorFocusedElem.focus === 'function') {
                priorFocusedElem.focus();
            }
            // Restore scroll positions
            for (let info of ancestors) {
                info.element.scrollLeft = info.left;
                info.element.scrollTop = info.top;
            }
        }
    }
    let selectionInfo = null;
    function capture() {
        selectionInfo = getSelectionInformation();
    }
    function restore() {
        if (selectionInfo !== null) {
            restoreSelection(selectionInfo);
        }
        selectionInfo = null;
    }
    return { capture, restore };
}
//# sourceMappingURL=document-state.js.map
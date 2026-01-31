/**
 * Binds the escape key to an element and prevents the default browser behavior. Useful for adding keyboard navigation
 * to a component, particularly for WAI ARIA practices to close a modal or menu.
 */
export declare let escape: "keydown:Escape";
/**
 * Binds the enter key to an element and prevents the default browser behavior. Useful for adding keyboard navigation
 * to a component, particularly for WAI ARIA practices to select an item in a
 * list, submit a form or generally trigger an action.
 */
export declare let enter: "keydown:Enter";
/**
 * Binds the space key to an element and prevents the default browser behavior. Useful for adding keyboard navigation
 * to a component, particularly for WAI ARIA practices to select an item in a
 * list, submit a form or generally trigger an action.
 */
export declare let space: "keydown: ";
/**
 * Binds the backspace key to an element and prevents the default browser behavior.
 */
export declare let backspace: "keydown:Backspace";
/**
 * Binds the delete key to an element and prevents the default browser behavior. Useful for adding keyboard navigation
 * to a component, particularly for WAI ARIA practices.
 */
export declare let del: "keydown:Delete";
/**
 * Binds the arrow left key to an element and prevents the default browser behavior. Useful for adding keyboard navigation
 * to a component, particularly for WAI ARIA practices.
 */
export declare let arrowLeft: "keydown:ArrowLeft";
/**
 * Binds the arrow right key to an element and prevents the default browser behavior. Useful for adding keyboard navigation
 * to a component, particularly for WAI ARIA practices.
 */
export declare let arrowRight: "keydown:ArrowRight";
/**
 * Binds the arrow up key to an element and prevents the default browser behavior. Useful for adding keyboard navigation
 * to a component, particularly for WAI ARIA practices.
 */
export declare let arrowUp: "keydown:ArrowUp";
/**
 * Binds the arrow down key to an element and prevents the default browser behavior. Useful for adding keyboard navigation
 * to a component, particularly for WAI ARIA practices.
 */
export declare let arrowDown: "keydown:ArrowDown";
/**
 * Binds the home key to an element and prevents the default browser behavior. Useful for adding keyboard navigation
 * to a component, particularly for WAI ARIA practices to move to the first
 * item in a list.
 */
export declare let home: "keydown:Home";
/**
 * Binds the end key to an element and prevents the default browser behavior. Useful for adding keyboard navigation
 * to a component, particularly for WAI ARIA practices to move to the last
 * item in a list.
 */
export declare let end: "keydown:End";
/**
 * Binds the page up key to an element and prevents the default browser behavior. Useful for adding keyboard navigation
 * to a component, particularly for WAI ARIA practices to move to the previous
 * page in a list.
 */
export declare let pageUp: "keydown:PageUp";
/**
 * Binds the page down key to an element and prevents the default browser behavior. Useful for adding keyboard navigation
 * to a component, particularly for WAI ARIA practices to move to the next
 * page in a list.
 */
export declare let pageDown: "keydown:PageDown";
declare global {
    interface HTMLElementEventMap {
        [escape]: KeyboardEvent;
        [enter]: KeyboardEvent;
        [space]: KeyboardEvent;
        [backspace]: KeyboardEvent;
        [del]: KeyboardEvent;
        [arrowLeft]: KeyboardEvent;
        [arrowRight]: KeyboardEvent;
        [arrowUp]: KeyboardEvent;
        [arrowDown]: KeyboardEvent;
        [home]: KeyboardEvent;
        [end]: KeyboardEvent;
        [pageUp]: KeyboardEvent;
        [pageDown]: KeyboardEvent;
    }
    interface WindowEventMap {
        [escape]: KeyboardEvent;
        [enter]: KeyboardEvent;
        [space]: KeyboardEvent;
        [backspace]: KeyboardEvent;
        [del]: KeyboardEvent;
        [arrowLeft]: KeyboardEvent;
        [arrowRight]: KeyboardEvent;
        [arrowUp]: KeyboardEvent;
        [arrowDown]: KeyboardEvent;
        [home]: KeyboardEvent;
        [end]: KeyboardEvent;
        [pageUp]: KeyboardEvent;
        [pageDown]: KeyboardEvent;
    }
    interface DocumentEventMap {
        [escape]: KeyboardEvent;
        [enter]: KeyboardEvent;
        [space]: KeyboardEvent;
        [backspace]: KeyboardEvent;
        [del]: KeyboardEvent;
        [arrowLeft]: KeyboardEvent;
        [arrowRight]: KeyboardEvent;
        [arrowUp]: KeyboardEvent;
        [arrowDown]: KeyboardEvent;
        [home]: KeyboardEvent;
        [end]: KeyboardEvent;
        [pageUp]: KeyboardEvent;
        [pageDown]: KeyboardEvent;
    }
}

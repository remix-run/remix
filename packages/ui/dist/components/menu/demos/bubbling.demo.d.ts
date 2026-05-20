/**
 * @name Menu Event Bubbling
 * @description Item-level handlers fire before the root handler, letting individual items intercept events while others bubble up.
 */
export default function Example(): () => import("@remix-run/ui").RemixElement;

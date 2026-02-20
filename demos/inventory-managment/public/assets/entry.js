import {
  Catch,
  Fragment,
  Frame,
  createComponent,
  createElement,
  createFrameHandle
} from "./alert-ah82ckfn.js";
// ../../node_modules/.pnpm/@remix-run+dom@0.0.0-experimental-remix-jam.6/node_modules/@remix-run/dom/dist/lib/invariant.js
function invariant(assertion, message) {
  let prefix = "Framework invariant";
  if (assertion)
    return;
  throw new Error(message ? `${prefix}: ${message}` : prefix);
}

// ../../node_modules/.pnpm/@remix-run+dom@0.0.0-experimental-remix-jam.6/node_modules/@remix-run/dom/dist/lib/diff-dom.js
function diffNodes(curr, next, context) {
  const parent = curr[0]?.parentNode;
  invariant(parent, "Parent node not found");
  const regionTailRef = curr.length > 0 ? curr[curr.length - 1].nextSibling : null;
  const max = Math.max(curr.length, next.length);
  for (let i = 0;i < max; i++) {
    const c = curr[i];
    const n = next[i];
    if (!c && n) {
      if (regionTailRef) {
        parent.insertBefore(n, regionTailRef);
      } else {
        parent.appendChild(n);
      }
    } else if (c && !n) {
      parent.removeChild(c);
    } else if (c && n) {
      let cursor = diffNode(c, n, context);
      if (cursor) {
        i = next.indexOf(cursor);
      }
    }
  }
}
function diffNode(current, next, context) {
  if (isTextNode(current) && isTextNode(next)) {
    const newText = next.textContent || "";
    if (current.textContent !== newText)
      current.textContent = newText;
    return;
  }
  if (isVirtualRootStartMarker(current) && isVirtualRootStartMarker(next)) {
    let info = context.pendingRoots.get(next);
    context.pendingRoots.delete(next);
    invariant(info, "missing pending virtual root info");
    let [end, vElement] = info;
    current.$rmx.render(vElement);
    return end;
  }
  if (isCommentNode(current) && isCommentNode(next)) {
    const newData = next.data;
    if (current.data !== newData)
      current.data = newData;
    return;
  }
  if (isElement(current) && isElement(next)) {
    if (current.tagName !== next.tagName) {
      const parent2 = current.parentNode;
      if (parent2)
        parent2.replaceChild(next, current);
      return;
    }
    diffElementAttributes(current, next, context);
    diffElementChildren(current, next, context);
    return;
  }
  const parent = current.parentNode;
  if (parent)
    parent.replaceChild(next, current);
}
function diffElementAttributes(current, next, context) {
  const prevAttrNames = current.getAttributeNames();
  const nextAttrNames = next.getAttributeNames();
  const nextNameSet = new Set(nextAttrNames);
  for (const name of prevAttrNames) {
    if (!nextNameSet.has(name))
      current.removeAttribute(name);
  }
  for (const name of nextAttrNames) {
    const prevVal = current.getAttribute(name);
    const nextVal = next.getAttribute(name);
    if (prevVal !== nextVal)
      current.setAttribute(name, nextVal == null ? "" : String(nextVal));
  }
}
function diffElementChildren(current, next, context) {
  const currentChildren = Array.from(current.childNodes);
  const nextChildren = Array.from(next.childNodes);
  const keyToIndex = new Map;
  for (let i = 0;i < currentChildren.length; i++) {
    const node = currentChildren[i];
    if (isElement(node)) {
      const key = node.getAttribute("data-key");
      if (key != null)
        keyToIndex.set(key, i);
    }
  }
  const used = new Array(currentChildren.length).fill(false);
  const matchIndexForNext = new Array(nextChildren.length).fill(-1);
  for (let i = 0;i < nextChildren.length; i++) {
    const nextChild = nextChildren[i];
    let matchIndex = -1;
    if (isElement(nextChild)) {
      const key = nextChild.getAttribute("data-key");
      if (key != null && keyToIndex.has(key)) {
        const idx = keyToIndex.get(key);
        if (!used[idx])
          matchIndex = idx;
      }
    }
    if (matchIndex === -1) {
      const candidateIndex = i;
      if (candidateIndex < currentChildren.length && !used[candidateIndex] && nodeTypesComparable(currentChildren[candidateIndex], nextChild)) {
        matchIndex = candidateIndex;
      }
    }
    if (matchIndex !== -1)
      used[matchIndex] = true;
    matchIndexForNext[i] = matchIndex;
  }
  const committed = new Array(nextChildren.length);
  for (let i = 0;i < nextChildren.length; i++) {
    const mi = matchIndexForNext[i];
    if (mi !== -1) {
      const curChild = currentChildren[mi];
      let cursor = diffNode(curChild, nextChildren[i], context);
      if (cursor) {
        const nextEndIdx = nextChildren.indexOf(cursor);
        const currEndIdx = findHydrationEndIndex(currentChildren, mi);
        for (let k = mi;k <= currEndIdx; k++)
          used[k] = true;
        committed[i] = curChild;
        committed[nextEndIdx] = currentChildren[currEndIdx];
        for (let j = i + 1;j < nextEndIdx; j++)
          committed[j] = undefined;
        i = nextEndIdx;
        continue;
      }
      committed[i] = curChild;
    } else {
      committed[i] = nextChildren[i];
    }
  }
  let anchor = undefined;
  for (let i = committed.length - 1;i >= 0; i--) {
    const node = committed[i];
    if (!node)
      continue;
    const ref = anchor && anchor.parentNode === current ? anchor : null;
    if (isVirtualRootStartMarker(node) || isVirtualRootEndMarker(node)) {
      if (node.parentNode !== current) {
        current.insertBefore(node, ref);
      }
      anchor = node;
      continue;
    }
    if (node.parentNode === current) {
      const targetNext = ref;
      const alreadyInPlace = targetNext === null && node.nextSibling === null || node.nextSibling === targetNext;
      if (!alreadyInPlace) {
        current.insertBefore(node, targetNext);
      }
    } else {
      current.insertBefore(node, ref);
    }
    if (node.parentNode === current) {
      anchor = node;
    }
  }
  for (let i = 0;i < currentChildren.length; i++) {
    if (!used[i]) {
      const node = currentChildren[i];
      if (node.parentNode === current)
        current.removeChild(node);
    }
  }
}
function nodeTypesComparable(a, b) {
  if (isTextNode(a) && isTextNode(b))
    return true;
  if (isElement(a) && isElement(b))
    return a.tagName === b.tagName;
  if (isVirtualRootStartMarker(a) && isVirtualRootStartMarker(b))
    return true;
  if (isVirtualRootEndMarker(a) && isVirtualRootEndMarker(b))
    return true;
  if (isCommentNode(a) && isCommentNode(b))
    return true;
  return false;
}
function isHydrationEndComment(node) {
  return isCommentNode(node) && node.data.trim() === "/rmx:h";
}
function findHydrationEndIndex(nodes, startIdx) {
  for (let j = startIdx + 1;j < nodes.length; j++) {
    if (isHydrationEndComment(nodes[j]))
      return j;
  }
  return startIdx;
}
function isTextNode(node) {
  return node.nodeType === Node.TEXT_NODE;
}
function isElement(node) {
  return node.nodeType === Node.ELEMENT_NODE;
}
function isCommentNode(node) {
  return node.nodeType === Node.COMMENT_NODE;
}
function isVirtualRootStartMarker(node) {
  return isCommentNode(node) && node.data.trim() === "rmx:h";
}
function isVirtualRootEndMarker(node) {
  return isCommentNode(node) && node.data.trim() === "/rmx:h";
}

// ../../node_modules/.pnpm/@remix-run+events@0.0.0-experimental-remix-jam.5/node_modules/@remix-run/events/dist/lib/events.js
var _debug = false;
function log(...args) {
  if (_debug) {
    console.log("DEBUG", ...args);
  }
}
function events(target, initialDescriptors) {
  let descriptors = [];
  let cleanups = [];
  let on = (nextDescriptors) => {
    if (!nextDescriptors) {
      nextDescriptors = [];
    }
    if (!Array.isArray(nextDescriptors)) {
      nextDescriptors = [nextDescriptors];
    }
    if (descriptorsChanged(descriptors, nextDescriptors)) {
      cleanupAll(cleanups);
      cleanups = [];
      if (nextDescriptors.length > 0) {
        attachAllEvents(target, nextDescriptors, cleanups);
      }
      descriptors = nextDescriptors;
    } else {
      updateHandlersInPlace(descriptors, nextDescriptors);
    }
  };
  let cleanup = () => {
    cleanupAll(cleanups);
    descriptors = [];
    cleanups = [];
  };
  if (initialDescriptors) {
    on(initialDescriptors);
    return cleanup;
  }
  return { on, cleanup };
}
function bind(type, handler, options) {
  return { type, handler, options };
}
function shallowEqual(a, b) {
  if (a === b)
    return true;
  if (!a || !b)
    return false;
  if (typeof a !== "object" || typeof b !== "object")
    return false;
  let keysA = Object.keys(a);
  let keysB = Object.keys(b);
  if (keysA.length !== keysB.length)
    return false;
  for (let key of keysA) {
    if (a[key] !== b[key])
      return false;
  }
  return true;
}
function createDispatcher(target, type) {
  return (options, originalEvent) => {
    let customEvent = new CustomEvent(type, {
      bubbles: true,
      cancelable: true,
      ...options
    });
    if (originalEvent) {
      let originalStopPropagation = customEvent.stopPropagation.bind(customEvent);
      customEvent.stopPropagation = () => {
        originalStopPropagation();
        originalEvent.stopPropagation();
      };
    }
    target.dispatchEvent(customEvent);
  };
}
function prepareInteractions(target, descriptors, cleanups) {
  let seenEventTypes = new Set;
  for (let descriptor of descriptors) {
    if (seenEventTypes.has(descriptor.type)) {
      continue;
    }
    seenEventTypes.add(descriptor.type);
    let dispatch = createDispatcher(target, descriptor.type);
    let factoryResult = descriptor.factory({ dispatch, target }, descriptor.factoryOptions);
    if (factoryResult) {
      let factoryCleanups = Array.isArray(factoryResult) ? factoryResult : [factoryResult];
      cleanups.push(...factoryCleanups);
    }
  }
}
function attach(target, eventType, descriptors, cleanups) {
  log("attach", { target, eventType, descriptors });
  let preventedEvents = new Set;
  for (let descriptor of descriptors) {
    let controller = new AbortController;
    let wrappedHandler = (event) => {
      controller.abort(new DOMException("Handler reentered", "EventReentry"));
      controller = new AbortController;
      log("wrappedHandler", { target, eventType, event });
      if (preventedEvents.has(event)) {
        log("prevented", { target, eventType, event });
        return;
      }
      let call = descriptor.handler(event, controller.signal);
      if (call instanceof Promise) {
        call.catch((e) => {
          if (e instanceof DOMException && e.name === "EventReentry") {} else {
            throw e;
          }
        });
      }
      if (event.defaultPrevented) {
        preventedEvents.add(event);
        setTimeout(() => preventedEvents.delete(event), 0);
      }
    };
    target.addEventListener(eventType, wrappedHandler, descriptor.options);
    cleanups.push(() => {
      controller.abort();
      target.removeEventListener(eventType, wrappedHandler, descriptor.options);
    });
  }
}
function attachStandardEvents(target, descriptors, cleanups) {
  let eventsByType = new Map;
  for (let descriptor of descriptors) {
    if (!eventsByType.has(descriptor.type)) {
      eventsByType.set(descriptor.type, []);
    }
    eventsByType.get(descriptor.type).push(descriptor);
  }
  for (let [type, descriptors2] of eventsByType) {
    attach(target, type, descriptors2, cleanups);
  }
}
function attachInteractions(target, descriptors, cleanups) {
  let byType = new Map;
  for (let descriptor of descriptors) {
    if (!byType.has(descriptor.type)) {
      byType.set(descriptor.type, []);
    }
    byType.get(descriptor.type).push(descriptor);
  }
  for (let [type, descriptors2] of byType) {
    attach(target, type, descriptors2, cleanups);
  }
}
function attachAllEvents(target, descriptors, cleanups) {
  let { custom, standard } = splitDescriptors(descriptors);
  prepareInteractions(target, custom, cleanups);
  attachInteractions(target, custom, cleanups);
  attachStandardEvents(target, standard, cleanups);
}
function splitDescriptors(descriptors) {
  let custom = [];
  let standard = [];
  for (let descriptor of descriptors) {
    if (isInteractionDescriptor(descriptor)) {
      custom.push(descriptor);
    } else {
      standard.push(descriptor);
    }
  }
  return { custom, standard };
}
function isInteractionDescriptor(descriptor) {
  return descriptor.isCustom === true;
}
function descriptorsChanged(descriptors, nextDescriptors) {
  if (descriptors.length !== nextDescriptors.length) {
    return true;
  }
  for (let i = 0;i < descriptors.length; i++) {
    let current = descriptors[i];
    let next = nextDescriptors[i];
    if (current.type !== next.type || current.isCustom !== next.isCustom || !shallowEqual(current.options, next.options) || !shallowEqual(current.factoryOptions, next.factoryOptions)) {
      return true;
    }
  }
  return false;
}
function updateHandlersInPlace(descriptors, nextDescriptors) {
  for (let i = 0;i < nextDescriptors.length; i++) {
    descriptors[i].handler = nextDescriptors[i].handler;
  }
}
function cleanupAll(cleanups) {
  for (let cleanup of cleanups)
    cleanup();
}
// ../../node_modules/.pnpm/@remix-run+events@0.0.0-experimental-remix-jam.5/node_modules/@remix-run/events/dist/lib/targets.js
function createTargetProxy() {
  return new Proxy(function targetFunction(type, handler, options) {
    return bind(type, handler, options);
  }, {
    get(target, prop) {
      if (typeof prop === "string") {
        return function(handler, options) {
          return bind(prop, handler, options);
        };
      }
      return target[prop];
    }
  });
}
var dom = createTargetProxy();
var xhr = createTargetProxy();
var win = createTargetProxy();
var doc = createTargetProxy();
var ws = createTargetProxy();
// ../../node_modules/.pnpm/@remix-run+events@0.0.0-experimental-remix-jam.5/node_modules/@remix-run/events/dist/lib/event-type.js
function createEventType(eventName) {
  let binder = (handler, options) => {
    return {
      type: eventName,
      handler,
      options
    };
  };
  let createEvent = (...args) => {
    let init = args[0];
    return new CustomEvent(eventName, {
      bubbles: true,
      cancelable: true,
      ...init
    });
  };
  return [binder, createEvent];
}
// ../../node_modules/.pnpm/@remix-run+style@0.0.0-experimental-remix-jam.5/node_modules/@remix-run/style/dist/lib/style.js
function camelToKebab(str) {
  return str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
function isComplexSelector(key) {
  return key.startsWith("&") || key.startsWith("@") || key.startsWith(":") || key.startsWith("[") || key.startsWith(".");
}
function isKeyframesAtRule(key) {
  if (!key.startsWith("@"))
    return false;
  let lower = key.toLowerCase();
  return lower.startsWith("@keyframes") || lower.startsWith("@-webkit-keyframes") || lower.startsWith("@-moz-keyframes") || lower.startsWith("@-o-keyframes");
}
function hashStyle(obj) {
  let sortedEntries = Object.entries(obj).sort(([a], [b]) => a.localeCompare(b));
  let str = JSON.stringify(sortedEntries);
  let hash = 0;
  for (let i = 0;i < str.length; i++) {
    let char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}
function styleToCss(styles, selector = "") {
  let baseDeclarations = [];
  let nestedBlocks = [];
  let atRules = [];
  let preludeAtRules = [];
  for (let [key, value] of Object.entries(styles)) {
    if (isComplexSelector(key)) {
      if (key.startsWith("@")) {
        if (key.startsWith("@function")) {
          let body = atRuleBodyToCss(value);
          if (body.trim().length > 0) {
            preludeAtRules.push(`${key} {
${indent(body, 2)}
}`);
          } else {
            preludeAtRules.push(`${key} {
}`);
          }
        } else if (isKeyframesAtRule(key)) {
          let body = keyframesBodyToCss(value);
          if (body.trim().length > 0) {
            preludeAtRules.push(`${key} {
${indent(body, 2)}
}`);
          } else {
            preludeAtRules.push(`${key} {
}`);
          }
        } else {
          let inner = styleToCss(value, selector);
          if (inner.trim().length > 0) {
            atRules.push(`${key} {
${indent(inner, 2)}
}`);
          } else {
            atRules.push(`${key} {
  ${selector} {
  }
}`);
          }
        }
        continue;
      }
      let nestedContent = "";
      for (let [prop, propValue] of Object.entries(value)) {
        if (propValue != null) {
          nestedContent += `    ${camelToKebab(prop)}: ${propValue};
`;
        }
      }
      if (nestedContent) {
        nestedBlocks.push(`  ${key} {
${nestedContent}  }`);
      }
    } else {
      if (value != null) {
        baseDeclarations.push(`  ${camelToKebab(key)}: ${value};`);
      }
    }
  }
  let css = "";
  if (preludeAtRules.length > 0) {
    css += preludeAtRules.join(`
`);
  }
  if (selector && (baseDeclarations.length > 0 || nestedBlocks.length > 0)) {
    css += (css ? `
` : "") + `${selector} {
`;
    if (baseDeclarations.length > 0) {
      css += baseDeclarations.join(`
`) + `
`;
    }
    if (nestedBlocks.length > 0) {
      css += nestedBlocks.join(`
`) + `
`;
    }
    css += "}";
  }
  if (atRules.length > 0) {
    css += (css ? `
` : "") + atRules.join(`
`);
  }
  return css;
}
function indent(text, spaces) {
  let pad = " ".repeat(spaces);
  return text.split(`
`).map((line) => line.length ? pad + line : line).join(`
`);
}
function isRecord(value) {
  return typeof value === "object" && value !== null;
}
function keyframesBodyToCss(frames) {
  if (!isRecord(frames))
    return "";
  let blocks = [];
  for (let [frameSelector, frameValue] of Object.entries(frames)) {
    if (!isRecord(frameValue)) {
      continue;
    }
    let declarations = [];
    for (let [prop, propValue] of Object.entries(frameValue)) {
      if (propValue == null)
        continue;
      if (isComplexSelector(prop))
        continue;
      declarations.push(`  ${camelToKebab(prop)}: ${propValue};`);
    }
    if (declarations.length > 0) {
      blocks.push(`${frameSelector} {
${declarations.join(`
`)}
}`);
    } else {
      blocks.push(`${frameSelector} {
}`);
    }
  }
  return blocks.join(`
`);
}
function atRuleBodyToCss(styles) {
  let declarations = [];
  let nested = [];
  for (let [key, value] of Object.entries(styles)) {
    if (isComplexSelector(key)) {
      if (key.startsWith("@")) {
        let inner = atRuleBodyToCss(value);
        if (inner.trim().length > 0) {
          nested.push(`${key} {
${indent(inner, 2)}
}`);
        } else {
          nested.push(`${key} {
}`);
        }
      } else {
        continue;
      }
    } else {
      if (value != null) {
        declarations.push(`  ${camelToKebab(key)}: ${value};`);
      }
    }
  }
  let body = "";
  if (declarations.length > 0) {
    body += declarations.join(`
`);
  }
  if (nested.length > 0) {
    body += (body ? `
` : "") + nested.join(`
`);
  }
  return body;
}
function processStyle(styleObj, styleCache) {
  if (Object.keys(styleObj).length === 0) {
    return { className: "", css: "" };
  }
  let hash = hashStyle(styleObj);
  let className = `rmx-${hash}`;
  let cached = styleCache.get(hash);
  if (cached) {
    return cached;
  }
  let css = styleToCss(styleObj, `.${className}`);
  let result = { className, css };
  styleCache.set(hash, result);
  return result;
}
// ../../node_modules/.pnpm/@remix-run+style@0.0.0-experimental-remix-jam.5/node_modules/@remix-run/style/dist/lib/stylesheet.js
function createStyleManager(layer = "rmx") {
  let stylesheet = new CSSStyleSheet;
  document.adoptedStyleSheets.push(stylesheet);
  let counts = new Map;
  let inserted = new Set;
  function has(className) {
    return counts.has(className);
  }
  function insert(className, rule) {
    if (inserted.has(className))
      return;
    inserted.add(className);
    stylesheet.insertRule(`@layer ${layer} { ${rule} }`);
  }
  function remove(className) {}
  return { insert, remove, has };
}
// ../../node_modules/.pnpm/@remix-run+dom@0.0.0-experimental-remix-jam.6/node_modules/@remix-run/dom/dist/lib/vdom.js
var fixmeIdCounter = 0;
var TEXT_NODE = Symbol("TEXT_NODE");
var SVG_NS = "http://www.w3.org/2000/svg";
var XLINK_NS = "http://www.w3.org/1999/xlink";
var XML_NS = "http://www.w3.org/XML/1998/namespace";
var [connect, createConnectEvent] = createEventType("rmx:connect");
var [disconnect, createDisconnectEvent] = createEventType("rmx:disconnect");
var styleCache = new Map;
var styleManager = typeof window !== "undefined" ? createStyleManager() : null;
function createScheduler() {
  let scheduled = new Map;
  let tasks = [];
  function ancestorIsScheduled(vnode, batch) {
    let current = vnode._parent;
    while (current) {
      if (isCommittedComponentNode(current) && batch.has(current))
        return true;
      current = current._parent;
    }
    return false;
  }
  return {
    enqueue(vnode, domParent, anchor) {
      scheduled.set(vnode, [domParent, anchor]);
      queueMicrotask(() => this.dequeue());
    },
    enqueueTasks(newTasks) {
      tasks.push(...newTasks);
      queueMicrotask(() => this.dequeue());
    },
    dequeue() {
      let batch = new Map(scheduled);
      scheduled.clear();
      if (batch.size > 0) {
        let vnodes = Array.from(batch);
        for (let [vnode, [domParent, anchor]] of vnodes) {
          if (ancestorIsScheduled(vnode, batch))
            continue;
          let handle = vnode._handle;
          let curr = vnode._content;
          let vParent = vnode._parent;
          renderComponent(handle, curr, vnode, domParent, handle.frame, this, vParent, anchor);
        }
      }
      if (tasks.length > 0) {
        for (let task of tasks) {
          task();
        }
        tasks = [];
      }
    }
  };
}
var ROOT_VNODE = Symbol("ROOT_VNODE");
function createRangeRoot([start, end], options = {}) {
  let root = null;
  let frameStub = options.frame ?? createFrameHandle();
  let scheduler = options.scheduler ?? createScheduler();
  let container = end.parentNode;
  invariant(container, "Expected parent node");
  invariant(end.parentNode === container, "Boundaries must share parent");
  let hydrationCursor = start.nextSibling;
  return {
    render(element) {
      let vnode = toVNode(element);
      let vParent = { type: ROOT_VNODE };
      diffVNodes(root, vnode, container, frameStub, scheduler, vParent, end, hydrationCursor);
      root = vnode;
      hydrationCursor = null;
    },
    remove() {
      root = null;
    },
    flush() {
      scheduler.dequeue();
    }
  };
}
function flatMapChildrenToVNodes(node) {
  return "children" in node.props ? Array.isArray(node.props.children) ? node.props.children.flat(Infinity).map(toVNode) : [toVNode(node.props.children)] : [];
}
function toVNode(node) {
  if (node === null || node === undefined || typeof node === "boolean") {
    return { type: TEXT_NODE, _text: "" };
  }
  if (typeof node === "string" || typeof node === "number" || typeof node === "bigint") {
    return { type: TEXT_NODE, _text: String(node) };
  }
  if (Array.isArray(node)) {
    return { type: Fragment, _children: node.flat(Infinity).map(toVNode) };
  }
  if (node.type === Fragment) {
    return { type: Fragment, _children: flatMapChildrenToVNodes(node) };
  }
  if (node.type === Catch) {
    return {
      type: Catch,
      _fallback: node.props.fallback,
      _children: flatMapChildrenToVNodes(node)
    };
  }
  if (isRemixElement(node)) {
    let children = flatMapChildrenToVNodes(node);
    return { type: node.type, props: node.props, _children: children };
  }
  invariant(false, "Unexpected RemixNode");
}
function diffVNodes(curr, next, domParent, frame, scheduler, vParent, anchor, rootCursor) {
  next._parent = vParent;
  if (curr === null) {
    insert(next, domParent, frame, scheduler, vParent, anchor, rootCursor);
    return;
  }
  if (curr.type !== next.type) {
    replace(curr, next, domParent, frame, scheduler, vParent, anchor);
    return;
  }
  if (isCommittedTextNode(curr) && isTextNode2(next)) {
    diffText(curr, next, scheduler, vParent);
    return;
  }
  if (isCommittedHostNode(curr) && isHostNode(next)) {
    diffHost(curr, next, domParent, frame, scheduler, vParent);
    return;
  }
  if (isCommittedComponentNode(curr) && isComponentNode(next)) {
    diffComponent(curr, next, frame, scheduler, domParent, vParent);
    return;
  }
  if (isFragmentNode(curr) && isFragmentNode(next)) {
    diffChildren(curr._children, next._children, domParent, frame, scheduler, vParent, undefined, anchor);
    return;
  }
  if (isCatchNode(curr) && isCatchNode(next)) {
    diffCatch(curr, next, domParent, frame, scheduler, vParent);
    return;
  }
  if (curr.type === Frame && next.type === Frame) {
    throw new Error("TODO: Frame diff not implemented");
  }
  invariant(false, "Unexpected diff case");
}
function diffCatch(curr, next, domParent, frame, scheduler, vParent) {
  if (curr._tripped) {
    replace(curr, next, domParent, frame, scheduler, vParent);
    return;
  }
  let added = [];
  try {
    for (let i = 0;i < curr._children.length; i++) {
      let child = curr._children[i];
      diffVNodes(child, next._children[i], domParent, frame, scheduler, vParent);
      added.unshift(child);
    }
    commitCatch(curr, { _parent: vParent, _tripped: false, _added: added });
  } catch (e) {
    for (let child of added) {
      remove(child, domParent, scheduler);
    }
    let fallbackNode = getCatchFallback(next, e);
    let anchor = findFirstDomAnchor(curr) || findNextSiblingDomAnchor(curr, vParent) || undefined;
    insert(fallbackNode, domParent, frame, scheduler, vParent, anchor);
    commitCatch(curr, { _parent: vParent, _tripped: true, _added: [fallbackNode] });
    dispatchError(e);
  }
}
function replace(curr, next, domParent, frame, scheduler, vParent, anchor) {
  anchor = anchor || findFirstDomAnchor(curr) || findNextSiblingDomAnchor(curr, vParent) || undefined;
  insert(next, domParent, frame, scheduler, vParent, anchor);
  remove(curr, domParent, scheduler);
}
function diffHost(curr, next, domParent, frame, scheduler, vParent) {
  diffChildren(curr._children, next._children, curr._dom, frame, scheduler, next);
  diffHostProps(curr.props, next.props, curr._dom);
  let extras = { _dom: curr._dom, _parent: vParent, _events: curr._events };
  commitHost(next, extras, scheduler, domParent, frame);
  return;
}
function diffCssProp(curr, next, dom2) {
  let prevClassName = curr.css ? processStyle(curr.css, styleCache).className : "";
  let { className, css } = next.css ? processStyle(next.css, styleCache) : { className: "", css: "" };
  if (prevClassName === className)
    return;
  if (prevClassName) {
    dom2.classList.remove(prevClassName);
    styleManager.remove(prevClassName);
  }
  if (css && className) {
    dom2.classList.add(className);
    styleManager.insert(className, css);
  }
}
function diffHostProps(curr, next, dom2) {
  let isSvg = dom2.namespaceURI === SVG_NS;
  if (next.css || curr.css) {
    diffCssProp(curr, next, dom2);
  }
  for (let name in curr) {
    if (isFrameworkProp(name))
      continue;
    if (!(name in next) || next[name] == null) {
      if (canUseProperty(dom2, name, isSvg)) {
        try {
          dom2[name] = "";
          continue;
        } catch {}
      }
      let { ns, attr } = normalizePropName(name, isSvg);
      if (ns)
        dom2.removeAttributeNS(ns, attr);
      else
        dom2.removeAttribute(attr);
    }
  }
  for (let name in next) {
    if (isFrameworkProp(name))
      continue;
    let nextValue = next[name];
    if (nextValue == null)
      continue;
    let prevValue = curr[name];
    if (prevValue !== nextValue) {
      let { ns, attr } = normalizePropName(name, isSvg);
      if (attr === "style" && typeof nextValue === "object" && nextValue && !Array.isArray(nextValue)) {
        dom2.setAttribute("style", serializeStyleObject(nextValue));
        continue;
      }
      if (canUseProperty(dom2, name, isSvg)) {
        try {
          dom2[name] = nextValue == null ? "" : nextValue;
          continue;
        } catch {}
      }
      if (typeof nextValue === "function") {
        continue;
      }
      let isAriaOrData = name.startsWith("aria-") || name.startsWith("data-");
      if (nextValue != null && (nextValue !== false || isAriaOrData)) {
        let attrValue = name === "popover" && nextValue === true ? "" : String(nextValue);
        if (ns)
          dom2.setAttributeNS(ns, attr, attrValue);
        else
          dom2.setAttribute(attr, attrValue);
      } else {
        if (ns)
          dom2.removeAttributeNS(ns, attr);
        else
          dom2.removeAttribute(attr);
      }
    }
  }
}
var ATTRIBUTE_FALLBACK_NAMES = new Set([
  "width",
  "height",
  "href",
  "list",
  "form",
  "tabIndex",
  "download",
  "rowSpan",
  "colSpan",
  "role",
  "popover"
]);
function canUseProperty(dom2, name, isSvg) {
  if (isSvg)
    return false;
  if (ATTRIBUTE_FALLBACK_NAMES.has(name))
    return false;
  return name in dom2;
}
function isCommittedCatchNode(node) {
  return isCatchNode(node) && node._added != null && node._tripped != null;
}
function isComponentNode(node) {
  return typeof node.type === "function" && node.type !== Frame;
}
function isCommittedComponentNode(node) {
  return isComponentNode(node) && node._content !== undefined;
}
function isFrameworkProp(name) {
  return name === "children" || name === "key" || name === "on" || name === "css";
}
var NUMERIC_CSS_PROPS = new Set([
  "z-index",
  "opacity",
  "flex-grow",
  "flex-shrink",
  "flex-order",
  "grid-area",
  "grid-row",
  "grid-column",
  "font-weight",
  "line-height",
  "order",
  "orphans",
  "widows",
  "zoom",
  "columns",
  "column-count"
]);
function serializeStyleObject(style) {
  let parts = [];
  for (let [key, value] of Object.entries(style)) {
    if (value == null)
      continue;
    if (typeof value === "boolean")
      continue;
    if (typeof value === "number" && !Number.isFinite(value))
      continue;
    let cssKey = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    let shouldAppendPx = typeof value === "number" && value !== 0 && !NUMERIC_CSS_PROPS.has(cssKey) && !cssKey.startsWith("--");
    let cssValue = shouldAppendPx ? `${value}px` : Array.isArray(value) ? value.join(", ") : String(value);
    parts.push(`${cssKey}: ${cssValue};`);
  }
  return parts.join(" ");
}
function isSvgContext(vParent) {
  let current = vParent;
  while (current) {
    if (typeof current.type === "string") {
      if (current.type === "foreignObject")
        return false;
      if (current.type === "svg")
        return true;
    }
    current = current._parent;
  }
  return false;
}
function normalizePropName(name, isSvg) {
  if (name.startsWith("aria-") || name.startsWith("data-"))
    return { attr: name };
  if (!isSvg) {
    if (name === "className")
      return { attr: "class" };
    if (name === "htmlFor")
      return { attr: "for" };
    if (name === "tabIndex")
      return { attr: "tabindex" };
    if (name === "acceptCharset")
      return { attr: "accept-charset" };
    if (name === "httpEquiv")
      return { attr: "http-equiv" };
    return { attr: name.toLowerCase() };
  }
  if (name === "xlinkHref")
    return { ns: XLINK_NS, attr: "xlink:href" };
  if (name === "xmlLang")
    return { ns: XML_NS, attr: "xml:lang" };
  if (name === "xmlSpace")
    return { ns: XML_NS, attr: "xml:space" };
  if (name === "viewBox" || name === "preserveAspectRatio" || name === "gradientUnits" || name === "gradientTransform" || name === "patternUnits" || name === "patternTransform" || name === "clipPathUnits" || name === "maskUnits" || name === "maskContentUnits") {
    return { attr: name };
  }
  return { attr: camelToKebab2(name) };
}
function camelToKebab2(input) {
  return input.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/_/g, "-").toLowerCase();
}
function diffText(curr, next, scheduler, vParent) {
  if (curr._text !== next._text) {
    curr._dom.textContent = next._text;
  }
  commitText(next, { _dom: curr._dom, _parent: vParent });
}
function logHydrationMismatch(...msg) {
  console.error("Hydration mismatch:", ...msg);
}
function insert(node, domParent, frame, scheduler, vParent, anchor, cursor) {
  node._parent = vParent;
  cursor = skipComments(cursor ?? null);
  let doInsert = anchor ? (dom2) => domParent.insertBefore(dom2, anchor) : (dom2) => domParent.appendChild(dom2);
  if (isTextNode2(node)) {
    if (cursor instanceof Text) {
      commitText(node, { _dom: cursor, _parent: vParent });
      if (cursor.data !== node._text) {
        logHydrationMismatch("text mismatch", cursor.data, node._text);
        cursor.data = node._text;
      }
      return cursor.nextSibling;
    }
    let dom2 = document.createTextNode(node._text);
    commitText(node, { _dom: dom2, _parent: vParent });
    doInsert(dom2);
    return cursor;
  }
  if (isHostNode(node)) {
    if (cursor instanceof Element) {
      if (cursor.tagName.toLowerCase() === node.type) {
        diffHostProps({}, node.props, cursor);
        commitHost(node, { _dom: cursor, _parent: vParent }, scheduler, domParent, frame);
        let childCursor = cursor.firstChild;
        let excess = diffChildren(null, node._children, cursor, frame, scheduler, node, childCursor);
        if (excess) {
          logHydrationMismatch("excess", excess);
        }
        return cursor.nextSibling;
      } else {
        logHydrationMismatch("tag", cursor.tagName.toLowerCase(), node.type);
        cursor.remove();
        cursor = undefined;
      }
    }
    let inSvg = isSvgContext(vParent) || node.type === "svg";
    let dom2 = inSvg ? document.createElementNS(SVG_NS, node.type) : document.createElement(node.type);
    diffHostProps({}, node.props, dom2);
    diffChildren(null, node._children, dom2, frame, scheduler, node);
    commitHost(node, { _dom: dom2, _parent: vParent }, scheduler, domParent, frame);
    doInsert(dom2);
    return cursor;
  }
  if (isFragmentNode(node)) {
    for (let child of node._children) {
      cursor = insert(child, domParent, frame, scheduler, vParent, anchor, cursor);
    }
    return cursor;
  }
  if (isCatchNode(node)) {
    let added = [];
    try {
      for (let child of node._children) {
        insert(child, domParent, frame, scheduler, node, anchor);
        added.unshift(child);
      }
      commitCatch(node, { _parent: vParent, _tripped: false, _added: added });
    } catch (e) {
      let fallback = getCatchFallback(node, e);
      for (let child of added) {
        remove(child, domParent, scheduler);
      }
      insert(fallback, domParent, frame, scheduler, node, anchor);
      commitCatch(node, { _parent: vParent, _tripped: true, _added: [fallback] });
      dispatchError(e);
    }
    return;
  }
  if (isComponentNode(node)) {
    diffComponent(null, node, frame, scheduler, domParent, vParent, anchor, cursor);
    return cursor;
  }
  if (node.type === Frame) {
    throw new Error("TODO: Frame insert not implemented");
  }
  if (node.type === Catch) {
    throw new Error("TODO: Catch insert not implemented");
  }
  invariant(false, "Unexpected node type");
}
function renderComponent(handle, currContent, next, domParent, frame, scheduler, vParent, anchor, cursor) {
  let normalizedOn = next.props.on ? Array.isArray(next.props.on) ? next.props.on : [next.props.on] : undefined;
  let props = normalizedOn ? { ...next.props, on: normalizedOn } : next.props;
  let [element, tasks] = handle.render(props);
  let content = toVNode(element);
  diffVNodes(currContent, content, domParent, frame, scheduler, next, anchor, cursor);
  let committed = commitComponent(next, { _content: content, _handle: handle, _parent: vParent });
  handle.setScheduleUpdate(() => {
    scheduler.enqueue(committed, domParent, anchor);
  });
  scheduler.enqueueTasks(tasks);
}
function diffComponent(curr, next, frame, scheduler, domParent, vParent, anchor, cursor) {
  if (curr === null) {
    next._handle = createComponent({
      id: String(++fixmeIdCounter),
      frame,
      type: next.type,
      raise: (error) => {
        raise(error, next, domParent, frame, scheduler);
      },
      getContext: (type) => {
        return findContextFromAncestry(vParent, type);
      }
    });
    renderComponent(next._handle, null, next, domParent, frame, scheduler, vParent, anchor, cursor);
    return;
  }
  next._handle = curr._handle;
  let { _content, _handle } = curr;
  renderComponent(_handle, _content, next, domParent, frame, scheduler, vParent, anchor, cursor);
}
function findContextFromAncestry(node, type) {
  let current = node;
  while (current) {
    if (current.type === type && isComponentNode(current)) {
      return current._handle.getContextValue();
    }
    current = current._parent;
  }
  return;
}
function remove(node, domParent, scheduler) {
  if (isCommittedTextNode(node)) {
    domParent.removeChild(node._dom);
    return;
  }
  if (isCommittedHostNode(node)) {
    node._dom.dispatchEvent(createDisconnectEvent({ bubbles: false }));
    domParent.removeChild(node._dom);
    let _events = node._events;
    if (_events) {
      scheduler.enqueueTasks([() => _events.cleanup()]);
    }
    return;
  }
  if (isFragmentNode(node)) {
    for (let child of node._children) {
      remove(child, domParent, scheduler);
    }
    return;
  }
  if (isCommittedComponentNode(node)) {
    remove(node._content, domParent, scheduler);
    let tasks = node._handle.remove();
    scheduler.enqueueTasks(tasks);
    return;
  }
  if (isFragmentNode(node)) {
    for (let child of node._children) {
      remove(child, domParent, scheduler);
    }
    return;
  }
  if (isCommittedCatchNode(node)) {
    for (let child of node._added) {
      remove(child, domParent, scheduler);
    }
    return;
  }
}
function diffChildren(curr, next, domParent, frame, scheduler, vParent, cursor, anchor) {
  if (curr === null) {
    for (let node of next) {
      cursor = insert(node, domParent, frame, scheduler, vParent, anchor, cursor);
    }
    return cursor;
  }
  let currLength = curr.length;
  let nextLength = next.length;
  for (let i = 0;i < nextLength; i++) {
    let currentNode = i < currLength ? curr[i] : null;
    diffVNodes(currentNode, next[i], domParent, frame, scheduler, vParent, anchor, cursor);
  }
  if (currLength > nextLength) {
    for (let i = nextLength;i < currLength; i++) {
      let node = curr[i];
      if (node)
        remove(node, domParent, scheduler);
    }
  }
}
function commitText(node, extras) {
  return Object.assign(node, extras);
}
function commitComponent(node, extras) {
  return Object.assign(node, extras);
}
function commitCatch(node, extras) {
  return Object.assign(node, extras);
}
function commitHost(node, extras, scheduler, domParent, frame) {
  let _dom = extras._dom;
  let _events = extras._events || events(_dom);
  let on = node.props.on ? Array.isArray(node.props.on) ? node.props.on : [node.props.on] : [];
  let raiseError = (error) => raise(error, node, domParent, frame, scheduler);
  let wrapped = wrapEvents(on, raiseError);
  scheduler.enqueueTasks([() => _events.on(wrapped)]);
  if (!_dom.isConnected) {
    scheduler.enqueueTasks([() => _dom.dispatchEvent(createConnectEvent({ bubbles: false }))]);
  }
  extras._events = _events;
  return Object.assign(node, extras);
}
function dispatchError(error) {}
function getCatchFallback(vnode, error) {
  let content = typeof vnode._fallback === "function" ? vnode._fallback(error) : vnode._fallback;
  return toVNode(content);
}
function raise(error, descendant, domParent, frame, scheduler) {
  let catchBoundary = findCatchBoundary(descendant);
  if (catchBoundary) {
    let content = getCatchFallback(catchBoundary, error);
    let anchor = findFirstDomAnchor(catchBoundary) || findNextSiblingDomAnchor(catchBoundary, catchBoundary._parent) || undefined;
    insert(content, domParent, frame, scheduler, catchBoundary, anchor);
    for (let child of catchBoundary._added) {
      remove(child, domParent, scheduler);
    }
    commitCatch(catchBoundary, { _tripped: true, _added: [content] });
  } else {
    dispatchError(error);
  }
}
function findCatchBoundary(vnode) {
  let current = vnode;
  while (current) {
    if (isCommittedCatchNode(current))
      return current;
    current = current._parent;
  }
  return null;
}
function wrapEvents(on, raise2) {
  if (!Array.isArray(on))
    on = [on];
  return on.map((descriptor) => {
    let handler = descriptor.handler;
    Object.assign(descriptor, {
      handler: (event, signal) => {
        try {
          return handler(event, signal);
        } catch (error) {
          raise2(error);
        }
      }
    });
    return descriptor;
  });
}
function isFragmentNode(node) {
  return node.type === Fragment;
}
function isCatchNode(node) {
  return node.type === Catch;
}
function isTextNode2(node) {
  return node.type === TEXT_NODE;
}
function isCommittedTextNode(node) {
  return isTextNode2(node) && node._dom instanceof Text;
}
function isHostNode(node) {
  return typeof node.type === "string";
}
function isCommittedHostNode(node) {
  return isHostNode(node) && node._dom instanceof Element;
}
function isRemixElement(node) {
  return typeof node === "object" && node !== null && "$rmx" in node;
}
function findFirstDomAnchor(node) {
  if (!node)
    return null;
  if (isCommittedTextNode(node))
    return node._dom;
  if (isCommittedHostNode(node))
    return node._dom;
  if (isCommittedComponentNode(node))
    return findFirstDomAnchor(node._content);
  if (isFragmentNode(node)) {
    for (let child of node._children) {
      let dom2 = findFirstDomAnchor(child);
      if (dom2)
        return dom2;
    }
  }
  if (isCommittedCatchNode(node)) {
    for (let child of node._added) {
      let dom2 = findFirstDomAnchor(child);
      if (dom2)
        return dom2;
    }
  }
  return null;
}
function findNextSiblingDomAnchor(curr, vParent) {
  if (!vParent || !Array.isArray(vParent._children))
    return null;
  let children = vParent._children;
  let idx = children.indexOf(curr);
  if (idx === -1)
    return null;
  for (let i = idx + 1;i < children.length; i++) {
    let dom2 = findFirstDomAnchor(children[i]);
    if (dom2)
      return dom2;
  }
  return null;
}
function skipComments(cursor) {
  while (cursor && cursor.nodeType === Node.COMMENT_NODE) {
    cursor = cursor.nextSibling;
  }
  return cursor;
}

// ../../node_modules/.pnpm/@remix-run+dom@0.0.0-experimental-remix-jam.6/node_modules/@remix-run/dom/dist/lib/frame.js
var TOP_FRAME = Symbol("TOP_FRAME");
var defaultInit = {
  loadModule: async () => {
    throw new Error("loadModule not implemented");
  },
  pendingHydrationRoots: new Map,
  src: "/",
  scheduler: createScheduler(),
  resolveFrame: async () => {
    throw new Error("resolveFrame not implemented");
  }
};
function createFrame(root, init) {
  let config = { ...defaultInit, ...init };
  let container = createContainer(root);
  let scheduler = config.scheduler;
  let frame = createFrameHandle({
    src: config.src,
    reload: async () => {
      let content = await config.resolveFrame(config.src);
      await render(content);
    },
    replace: async (content) => {
      await render(content);
    }
  });
  let context = {
    frame,
    loadModule: config.loadModule,
    pendingRoots: config.pendingHydrationRoots,
    scheduler: config.scheduler,
    addFrame(start) {
      let end = findEndComment(start);
      let script = end.nextElementSibling;
      invariant(script instanceof HTMLScriptElement, "Invalid frame script");
      let marker = parseFrameScript(script);
      createFrame([start, end], { ...config, src: marker.src, marker });
      return script;
    }
  };
  async function render(content) {
    let fragment = typeof content === "string" ? createFragmentFromString(content) : content;
    let nextContainer = createContainer(fragment);
    await populatePendingRoots(nextContainer, context);
    diffNodes(container.childNodes, Array.from(nextContainer.childNodes), context);
    hydratedAndCreateSubFrames(container.childNodes, context);
  }
  async function hydrate() {
    await populatePendingRoots(container, context);
    hydratedAndCreateSubFrames(Array.from(container.childNodes), context);
    if (config.marker?.status === "pending") {
      let earlyContent = getEarlyFrameContent(config.marker.id);
      if (earlyContent) {
        await render(earlyContent);
      } else {
        setupTemplateObserver(config.marker.id, render);
      }
    }
  }
  let hydratePromise = hydrate();
  return {
    render,
    ready: () => hydratePromise,
    flush: () => scheduler.dequeue()
  };
}
function getEarlyFrameContent(id) {
  let template = document.querySelector(`template#${id}`);
  if (template instanceof HTMLTemplateElement) {
    let fragment = template.content;
    template.remove();
    return fragment;
  }
  return null;
}
function setupTemplateObserver(id, cb) {
  let observer = new MutationObserver(async (mutations) => {
    for (let mutation of mutations) {
      for (let node of mutation.addedNodes) {
        if (node instanceof HTMLTemplateElement && node.id === id) {
          observer.disconnect();
          node.remove();
          cb(node.content);
        }
      }
    }
  });
  observer.observe(document.body, { childList: true });
}
function parseFrameScript(script) {
  let data = JSON.parse(script.textContent || "{}");
  invariant(isFrameMarker(data));
  return data;
}
function isFrameMarker(object) {
  return typeof object === "object" && object !== null && "src" in object && "id" in object && "status" in object;
}
function findEndComment(comment) {
  let node = comment.nextSibling;
  while (node && node.nodeType !== 8) {
    node = node.nextSibling;
    if (node instanceof Comment && node.data.trim().startsWith("frame:end")) {
      return node;
    }
  }
  throw new Error("End comment not found");
}
function findCommentAbove(anchor, data) {
  let node = anchor.previousSibling;
  while (node && node.nodeType !== 8) {
    node = node.previousSibling;
    if (node instanceof Comment && node.data.trim() === data) {
      return node;
    }
  }
  invariant(false, "Start comment not found");
}
function hydrate(vElement, start, end, context) {
  context.pendingRoots.delete(start);
  let root = createRangeRoot([start, end], {
    scheduler: context.scheduler,
    frame: context.frame
  });
  Object.defineProperty(start, "$rmx", { value: root, enumerable: false });
  root.render(vElement);
}
function hydratedAndCreateSubFrames(nodes, context) {
  for (let i = 0;i < nodes.length; i++) {
    let node = nodes[i];
    if (node instanceof Comment && context.pendingRoots.has(node)) {
      let info = context.pendingRoots.get(node);
      invariant(info, "Expected hydration element");
      let [end, element] = info;
      hydrate(element, node, end, context);
      i = nodes.indexOf(end);
    }
    if (isFrameStart(node)) {
      let frameScript = context.addFrame(node);
      i = nodes.indexOf(frameScript);
      frameScript.remove();
    } else if (node.childNodes.length > 0) {
      hydratedAndCreateSubFrames(Array.from(node.childNodes), context);
    }
  }
}
function createFragmentFromString(content) {
  let template = document.createElement("template");
  template.innerHTML = content.trim();
  return template.content;
}
function isFrameStart(node) {
  return node instanceof Comment && node.data.trim().startsWith("frame:start:");
}
var hydrationScriptSelector = 'script[type="application/json"][rmx-hydrated]';
async function populatePendingRoots(container, context) {
  let scripts = queryHydrationScripts(container);
  await Promise.all(scripts.map(async (script) => {
    let data = JSON.parse(script.textContent || "{}");
    invariant(isHydrationScript(data), "Invalid hydration script");
    let mod = await context.loadModule(data.moduleUrl, data.exportName);
    let vElement = createElement(mod, data.props);
    let [start, end] = getVirtualRootMarkersFromScript(script);
    context.pendingRoots.set(start, [end, vElement]);
    script.remove();
  }));
}
function getVirtualRootMarkersFromScript(script) {
  let end = script.previousSibling;
  invariant(end instanceof Comment, "Expected comment");
  let start = findCommentAbove(end, "rmx:h");
  return [start, end];
}
function queryHydrationScripts(container) {
  return Array.from(container.root.querySelectorAll(hydrationScriptSelector));
}
function isHydrationScript(object) {
  return typeof object === "object" && object !== null && "moduleUrl" in object && "exportName" in object && "props" in object;
}
function createContainer(container) {
  return Array.isArray(container) ? createCommentContainer(container) : createElementContainer(container);
}
function createElementContainer(container) {
  return {
    root: container,
    appendChild: (node) => container.appendChild(node),
    get childNodes() {
      return Array.from(container.childNodes);
    },
    querySelectorAll: (selector) => Array.from(container.querySelectorAll(selector)),
    querySelector: (selector) => container.querySelector(selector),
    insertBefore: (node, before) => container.insertBefore(node, before)
  };
}
function createCommentContainer(container) {
  let root = container[1].parentNode;
  invariant(root, "Invalid comment container");
  let appendChild = (node) => {
    root.insertBefore(node, container[1]);
  };
  let getChildNodesBetween = () => {
    let nodes = [];
    let node = container[0].nextSibling;
    while (node && node !== container[1]) {
      nodes.push(node);
      node = node.nextSibling;
    }
    return nodes;
  };
  let querySelectorAll = (selector) => {
    let range = document.createRange();
    range.setStartAfter(container[0]);
    range.setEndBefore(container[1]);
    let all = root.querySelectorAll(selector);
    let results = [];
    for (let i = 0;i < all.length; i++) {
      let el = all[i];
      if (range.intersectsNode(el))
        results.push(el);
    }
    return results;
  };
  let querySelector = (selector) => {
    let range = document.createRange();
    range.setStartAfter(container[0]);
    range.setEndBefore(container[1]);
    let all = root.querySelectorAll(selector);
    for (let i = 0;i < all.length; i++) {
      let el = all[i];
      if (range.intersectsNode(el))
        return el;
    }
    return null;
  };
  let insertBefore = (node, before) => {
    root.insertBefore(node, before);
  };
  return {
    get childNodes() {
      return getChildNodesBetween();
    },
    appendChild,
    querySelectorAll,
    querySelector,
    insertBefore,
    root
  };
}
// app/assets/entry.tsx
createFrame(document, {
  async loadModule(moduleUrl, name) {
    let mod = await import(moduleUrl);
    if (!mod) {
      throw new Error(`Unknown module: ${moduleUrl}#${name}`);
    }
    let Component = mod[name];
    if (!Component) {
      throw new Error(`Unknown component: ${moduleUrl}#${name}`);
    }
    return Component;
  },
  async resolveFrame(frameUrl) {
    let res = await fetch(frameUrl);
    if (res.ok) {
      return res.text();
    }
    throw new Error(`Failed to fetch ${frameUrl}`);
  }
});

//# debugId=003FC310F6779A0964756E2164756E21

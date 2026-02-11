// ../shared.ts
var idCounter = 1;
var A = [
  "pretty",
  "large",
  "big",
  "small",
  "tall",
  "short",
  "long",
  "handsome",
  "plain",
  "quaint",
  "clean",
  "elegant",
  "easy",
  "angry",
  "crazy",
  "helpful",
  "mushy",
  "odd",
  "unsightly",
  "adorable",
  "important",
  "inexpensive",
  "cheap",
  "expensive",
  "fancy"
];
var C = [
  "red",
  "yellow",
  "blue",
  "green",
  "pink",
  "brown",
  "purple",
  "brown",
  "white",
  "black",
  "orange"
];
var N = [
  "table",
  "chair",
  "house",
  "bbq",
  "desk",
  "car",
  "pony",
  "cookie",
  "sandwich",
  "burger",
  "pizza",
  "mouse",
  "keyboard"
];
function buildData(count) {
  let data = new Array(count);
  for (let i = 0; i < count; i++) {
    data[i] = {
      id: idCounter++,
      label: `${A[i % A.length]} ${C[i % C.length]} ${N[i % N.length]}`
    };
  }
  return data;
}
function get1000Rows() {
  return buildData(1e3);
}
function get10000Rows() {
  return buildData(1e4);
}
function updatedEvery10thRow(data) {
  let newData = data.slice(0);
  for (let i = 0, d = data, len = d.length; i < len; i += 10) {
    newData[i] = { id: data[i].id, label: data[i].label + " !!!" };
  }
  return newData;
}
function swapRows(data) {
  let d = data.slice();
  if (d.length > 998) {
    let tmp = d[1];
    d[1] = d[998];
    d[998] = tmp;
  }
  return d;
}
function remove(data, id) {
  return data.filter((d) => d.id !== id);
}
function sortRows(data, ascending = true) {
  let sorted = data.slice().sort((a, b) => {
    if (ascending) {
      return a.label.localeCompare(b.label);
    } else {
      return b.label.localeCompare(a.label);
    }
  });
  return sorted;
}

// ../../../../interaction/src/lib/interaction.ts
function createContainer(target, options) {
  let disposed = false;
  let { signal } = options ?? {};
  let bindings = {};
  function disposeAll() {
    if (disposed) return;
    disposed = true;
    for (let type in bindings) {
      let existing = bindings[type];
      if (existing) {
        for (let binding of existing) {
          binding.dispose();
        }
      }
    }
  }
  if (signal) {
    signal.addEventListener("abort", disposeAll, { once: true });
  }
  return {
    dispose: disposeAll,
    set: (listeners) => {
      if (disposed) {
        throw new Error("Container has been disposed");
      }
      let listenerKeys = new Set(Object.keys(listeners));
      for (let type in bindings) {
        let eventType = type;
        if (!listenerKeys.has(eventType)) {
          let existing = bindings[eventType];
          if (existing) {
            for (let binding of existing) {
              binding.dispose();
            }
            delete bindings[eventType];
          }
        }
      }
      for (let type of listenerKeys) {
        let updateTypeBindings2 = function(type2, raw2) {
          let descriptors = normalizeDescriptors(raw2);
          let existing = bindings[type2];
          if (!existing) {
            bindings[type2] = descriptors.map((d) => {
              let { listener, ...options2 } = d;
              return createBinding(target, type2, listener, options2);
            });
            return;
          }
          let min = Math.min(existing.length, descriptors.length);
          for (let i = 0; i < min; i++) {
            let d = descriptors[i];
            let b = existing[i];
            let { listener, ...options2 } = d;
            if (optionsChanged(options2, b.options)) {
              b.rebind(listener, options2);
            } else {
              b.setListener(listener);
            }
          }
          if (descriptors.length > existing.length) {
            for (let i = existing.length; i < descriptors.length; i++) {
              let d = descriptors[i];
              let { listener, ...options2 } = d;
              existing.push(createBinding(target, type2, listener, options2));
            }
          }
          if (existing.length > descriptors.length) {
            for (let i = descriptors.length; i < existing.length; i++) {
              existing[i].dispose();
            }
            existing.length = descriptors.length;
          }
        };
        var updateTypeBindings = updateTypeBindings2;
        let raw = listeners[type];
        if (raw == null) continue;
        updateTypeBindings2(type, raw);
      }
    }
  };
}
var TypedEventTarget = class extends EventTarget {
};
var interactions = /* @__PURE__ */ new Map();
var initializedTargets = /* @__PURE__ */ new WeakMap();
var InteractionHandle = class {
  target;
  signal;
  constructor(target, signal) {
    this.target = target;
    this.signal = signal;
  }
  on(target, listeners) {
    let container = createContainer(target, { signal: this.signal });
    container.set(listeners);
  }
};
function normalizeDescriptors(raw) {
  if (Array.isArray(raw)) {
    return raw.map((item) => isDescriptor(item) ? item : { listener: item });
  }
  return [isDescriptor(raw) ? raw : { listener: raw }];
}
function isDescriptor(value) {
  return typeof value === "object" && value !== null && "listener" in value;
}
function dispatchError(target, error) {
  target.dispatchEvent(new ErrorEvent("error", { error, bubbles: true }));
}
function createBinding(target, type, listener, options) {
  let reentry = null;
  let interactionController = null;
  let disposed = false;
  let needsSignal = listener.length >= 2;
  function abort() {
    if (reentry) {
      reentry.abort(new DOMException("", "EventReentry"));
      reentry = new AbortController();
    }
  }
  let wrappedListener = (event) => {
    if (needsSignal) {
      abort();
      if (!reentry) reentry = new AbortController();
    }
    try {
      let result = listener(event, reentry?.signal);
      if (result instanceof Promise) {
        result.catch((error) => dispatchError(target, error));
      }
    } catch (error) {
      dispatchError(target, error);
    }
  };
  function bind() {
    target.addEventListener(type, wrappedListener, options);
  }
  function unbind() {
    abort();
    target.removeEventListener(type, wrappedListener, options);
  }
  function decrementInteractionRef() {
    let interaction = interactions.get(type);
    if (interaction) {
      let refCounts = initializedTargets.get(target);
      if (refCounts) {
        let count = refCounts.get(interaction) ?? 0;
        if (count > 0) {
          count--;
          if (count === 0) {
            refCounts.delete(interaction);
          } else {
            refCounts.set(interaction, count);
          }
        }
      }
    }
  }
  function cleanup() {
    if (disposed) return;
    disposed = true;
    unbind();
    if (interactionController) interactionController.abort();
    decrementInteractionRef();
  }
  if (interactions.has(type)) {
    let interaction = interactions.get(type);
    let refCounts = initializedTargets.get(target);
    if (!refCounts) {
      refCounts = /* @__PURE__ */ new Map();
      initializedTargets.set(target, refCounts);
    }
    let count = refCounts.get(interaction) ?? 0;
    if (count === 0) {
      interactionController = new AbortController();
      let interactionContext = new InteractionHandle(target, interactionController.signal);
      interaction(interactionContext);
    }
    refCounts.set(interaction, count + 1);
  }
  bind();
  return {
    type,
    get options() {
      return options;
    },
    setListener(newListener) {
      listener = newListener;
      needsSignal = newListener.length >= 2;
    },
    rebind(newListener, newOptions) {
      unbind();
      options = newOptions;
      listener = newListener;
      needsSignal = newListener.length >= 2;
      bind();
    },
    dispose: cleanup
  };
}
function optionsChanged(a, b) {
  return a.capture !== b.capture || a.once !== b.once || a.passive !== b.passive || a.signal !== b.signal;
}

// ../../../src/lib/component.ts
function createComponent(config) {
  let taskQueue = [];
  let renderCtrl = null;
  let connectedCtrl = null;
  let contextValue = void 0;
  function getConnectedSignal() {
    if (!connectedCtrl) connectedCtrl = new AbortController();
    return connectedCtrl.signal;
  }
  let getContent = null;
  let scheduleUpdate = () => {
    throw new Error("scheduleUpdate not implemented");
  };
  let context = {
    set: (value) => {
      contextValue = value;
    },
    get: (type) => config.getContext(type)
  };
  let handle = {
    id: config.id,
    update: (task) => {
      if (task) taskQueue.push(task);
      scheduleUpdate();
    },
    queueTask: (task) => {
      taskQueue.push(task);
    },
    frame: config.frame,
    context,
    get signal() {
      return getConnectedSignal();
    },
    on: (target, listeners) => {
      let container = createContainer(target, { signal: getConnectedSignal() });
      container.set(listeners);
    }
  };
  function dequeueTasks() {
    let needsSignal = taskQueue.some((task) => task.length >= 1);
    if (needsSignal && !renderCtrl) {
      renderCtrl = new AbortController();
    }
    let signal = renderCtrl?.signal;
    return taskQueue.splice(0, taskQueue.length).map((task) => () => task(signal));
  }
  function render(props) {
    if (connectedCtrl?.signal.aborted) {
      console.warn("render called after component was removed, potential application memory leak");
      return [null, []];
    }
    if (renderCtrl) {
      renderCtrl.abort();
      renderCtrl = null;
    }
    if (!getContent) {
      let { setup, ...propsWithoutSetup } = props;
      let result = config.type(handle, setup);
      if (typeof result !== "function") {
        let name2 = config.type.name || "Anonymous";
        throw new Error(`${name2} must return a render function, received ${typeof result}`);
      } else {
        getContent = (props2) => {
          let { setup: _, ...rest } = props2;
          return result(rest);
        };
      }
    }
    let node = getContent(props);
    return [node, dequeueTasks()];
  }
  function remove3() {
    if (connectedCtrl) connectedCtrl.abort();
    return dequeueTasks();
  }
  function setScheduleUpdate(_scheduleUpdate) {
    scheduleUpdate = _scheduleUpdate;
  }
  function getContextValue() {
    return contextValue;
  }
  return { render, remove: remove3, setScheduleUpdate, frame: config.frame, getContextValue };
}
function Frame(handle) {
  return (_) => null;
}
function Fragment() {
  return (_) => null;
}
function createFrameHandle(def) {
  return Object.assign(
    new EventTarget(),
    {
      src: "/",
      replace: notImplemented("replace not implemented"),
      reload: notImplemented("reload not implemented")
    },
    def
  );
}
function notImplemented(msg) {
  return () => {
    throw new Error(msg);
  };
}

// ../../../src/lib/invariant.ts
function invariant(assertion, message) {
  let prefix = "Framework invariant";
  if (assertion) return;
  throw new Error(message ? `${prefix}: ${message}` : prefix);
}

// ../../../src/lib/document-state.ts
function createDocumentState(_doc) {
  let doc = _doc ?? document;
  function getActiveElement() {
    return doc.activeElement || doc.body;
  }
  function hasSelectionCapabilities(elem) {
    let nodeName = elem.nodeName.toLowerCase();
    return nodeName === "input" && "type" in elem && (elem.type === "text" || elem.type === "search" || elem.type === "tel" || elem.type === "url" || elem.type === "password") || nodeName === "textarea" || elem instanceof HTMLElement && elem.contentEditable === "true";
  }
  function getSelection(input) {
    if ("selectionStart" in input && typeof input.selectionStart === "number" && "selectionEnd" in input) {
      let htmlInput = input;
      return {
        start: htmlInput.selectionStart ?? 0,
        end: htmlInput.selectionEnd ?? htmlInput.selectionStart ?? 0
      };
    }
    return null;
  }
  function setSelection(input, offsets) {
    if ("selectionStart" in input && "selectionEnd" in input) {
      try {
        let htmlInput = input;
        htmlInput.selectionStart = offsets.start;
        htmlInput.selectionEnd = Math.min(offsets.end, htmlInput.value?.length ?? 0);
      } catch {
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
      selectionRange: focusedElem && hasSelectionCapabilities(focusedElem) ? getSelection(focusedElem) : null
    };
  }
  function restoreSelection(priorSelectionInformation) {
    let curFocusedElem = getActiveElement();
    let priorFocusedElem = priorSelectionInformation.focusedElem;
    let priorSelectionRange = priorSelectionInformation.selectionRange;
    if (curFocusedElem !== priorFocusedElem && priorFocusedElem && isInDocument(priorFocusedElem)) {
      let ancestors = [];
      let ancestor = priorFocusedElem;
      while (ancestor) {
        if (ancestor.nodeType === Node.ELEMENT_NODE) {
          let el2 = ancestor;
          ancestors.push({
            element: el2,
            left: el2.scrollLeft ?? 0,
            top: el2.scrollTop ?? 0
          });
        }
        ancestor = ancestor.parentNode;
      }
      if (priorSelectionRange !== null && hasSelectionCapabilities(priorFocusedElem)) {
        setSelection(priorFocusedElem, priorSelectionRange);
      }
      if (priorFocusedElem instanceof HTMLElement && typeof priorFocusedElem.focus === "function") {
        priorFocusedElem.focus();
      }
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

// ../../../src/lib/layout-animation.ts
var LAYOUT_DEFAULTS = {
  duration: 200,
  easing: "ease-out"
};
function createAxis() {
  return { min: 0, max: 0 };
}
function createBox() {
  return { x: createAxis(), y: createAxis() };
}
function createAxisDelta() {
  return { translate: 0, scale: 1, origin: 0.5, originPoint: 0 };
}
function createDelta() {
  return { x: createAxisDelta(), y: createAxisDelta() };
}
function calcLength(axis) {
  return axis.max - axis.min;
}
function copyAxisDeltaInto(target, source) {
  target.translate = source.translate;
  target.scale = source.scale;
  target.origin = source.origin;
  target.originPoint = source.originPoint;
}
function copyDeltaInto(target, source) {
  copyAxisDeltaInto(target.x, source.x);
  copyAxisDeltaInto(target.y, source.y);
}
function mix(from, to, progress) {
  return from + (to - from) * progress;
}
function isNear(value, target, threshold) {
  return Math.abs(value - target) <= threshold;
}
var SCALE_PRECISION = 1e-4;
var TRANSLATE_PRECISION = 0.01;
function calcAxisDelta(delta, source, target, origin = 0.5) {
  delta.origin = origin;
  delta.originPoint = mix(source.min, source.max, origin);
  let sourceLength = calcLength(source);
  let targetLength = calcLength(target);
  delta.scale = sourceLength !== 0 ? targetLength / sourceLength : 1;
  let targetOriginPoint = mix(target.min, target.max, origin);
  delta.translate = targetOriginPoint - delta.originPoint;
  if (isNear(delta.scale, 1, SCALE_PRECISION) || isNaN(delta.scale)) {
    delta.scale = 1;
  }
  if (isNear(delta.translate, 0, TRANSLATE_PRECISION) || isNaN(delta.translate)) {
    delta.translate = 0;
  }
}
function calcBoxDelta(delta, source, target, originX = 0.5, originY = 0.5) {
  calcAxisDelta(delta.x, source.x, target.x, originX);
  calcAxisDelta(delta.y, source.y, target.y, originY);
}
function mixAxisDelta(output, delta, progress) {
  output.translate = mix(delta.translate, 0, progress);
  output.scale = mix(delta.scale, 1, progress);
  output.origin = delta.origin;
  output.originPoint = delta.originPoint;
}
function mixDelta(output, delta, progress) {
  mixAxisDelta(output.x, delta.x, progress);
  mixAxisDelta(output.y, delta.y, progress);
}
function buildProjectionTransform(delta) {
  let { x, y } = delta;
  let transform = "";
  if (x.translate || y.translate) {
    transform = `translate3d(${x.translate}px, ${y.translate}px, 0)`;
  }
  if (x.scale !== 1 || y.scale !== 1) {
    transform += transform ? " " : "";
    transform += `scale(${x.scale}, ${y.scale})`;
  }
  return transform || "none";
}
function buildTransformOrigin(delta) {
  return `${delta.x.origin * 100}% ${delta.y.origin * 100}%`;
}
function rectToBox(rect) {
  return {
    x: { min: rect.left, max: rect.right },
    y: { min: rect.top, max: rect.bottom }
  };
}
function isDeltaZero(delta) {
  return isNear(delta.x.translate, 0, TRANSLATE_PRECISION) && isNear(delta.y.translate, 0, TRANSLATE_PRECISION) && isNear(delta.x.scale, 1, SCALE_PRECISION) && isNear(delta.y.scale, 1, SCALE_PRECISION);
}
var layoutElements = /* @__PURE__ */ new Map();
var pendingElements = /* @__PURE__ */ new Set();
function markLayoutSubtreePending(root2) {
  for (let el2 of layoutElements.keys()) {
    if (root2.contains(el2)) {
      pendingElements.add(el2);
    }
  }
}
function captureLayoutSnapshots() {
  for (let el2 of pendingElements) {
    let data = layoutElements.get(el2);
    if (!data) continue;
    let htmlEl = el2;
    let prevTransform = htmlEl.style.transform;
    let prevOrigin = htmlEl.style.transformOrigin;
    htmlEl.style.transform = "none";
    htmlEl.style.transformOrigin = "";
    let box = createBox();
    let rect = el2.getBoundingClientRect();
    box.x.min = rect.left;
    box.x.max = rect.right;
    box.y.min = rect.top;
    box.y.max = rect.bottom;
    data.snapshot = box;
    htmlEl.style.transform = prevTransform;
    htmlEl.style.transformOrigin = prevOrigin;
  }
}
function applyLayoutAnimations() {
  for (let [el2, data] of layoutElements) {
    if (data.snapshot === null) {
      let htmlEl = el2;
      htmlEl.style.transform = "";
      htmlEl.style.transformOrigin = "";
      let rect = el2.getBoundingClientRect();
      data.snapshot = rectToBox(rect);
    }
  }
  for (let el2 of pendingElements) {
    let data = layoutElements.get(el2);
    if (!data) continue;
    let first = data.snapshot;
    if (!first) continue;
    let htmlEl = el2;
    let prevTransform = htmlEl.style.transform;
    let prevOrigin = htmlEl.style.transformOrigin;
    htmlEl.style.transform = "none";
    htmlEl.style.transformOrigin = "";
    let rect = el2.getBoundingClientRect();
    let last = rectToBox(rect);
    let targetDelta = createDelta();
    calcBoxDelta(targetDelta, last, first);
    if (data.animation && data.animation.playState === "running") {
      data.animation.cancel();
      if (data.currentDelta && data.progress > 0 && data.progress < 1) {
        let visualDelta = createDelta();
        mixDelta(visualDelta, data.currentDelta, data.progress);
        targetDelta.x.translate += visualDelta.x.translate;
        targetDelta.y.translate += visualDelta.y.translate;
        targetDelta.x.scale *= visualDelta.x.scale;
        targetDelta.y.scale *= visualDelta.y.scale;
      }
    }
    if (isDeltaZero(targetDelta)) {
      htmlEl.style.transform = prevTransform;
      htmlEl.style.transformOrigin = prevOrigin;
      data.snapshot = last;
      continue;
    }
    if (!data.currentDelta) {
      data.currentDelta = createDelta();
    }
    copyDeltaInto(data.currentDelta, targetDelta);
    data.progress = 0;
    let invertTransform = buildProjectionTransform(targetDelta);
    let transformOrigin = buildTransformOrigin(targetDelta);
    htmlEl.style.transform = invertTransform;
    htmlEl.style.transformOrigin = transformOrigin;
    let duration = data.config.duration ?? LAYOUT_DEFAULTS.duration;
    let easing = data.config.easing ?? LAYOUT_DEFAULTS.easing;
    let keyframes = [
      { transform: invertTransform, transformOrigin },
      { transform: "none", transformOrigin }
    ];
    let animation = htmlEl.animate(keyframes, {
      duration,
      easing,
      fill: "forwards"
    });
    data.animation = animation;
    let startTime = performance.now();
    let progressTracker = () => {
      if (data.animation !== animation) return;
      let elapsed = performance.now() - startTime;
      data.progress = Math.min(1, elapsed / duration);
      if (data.progress < 1) {
        requestAnimationFrame(progressTracker);
      }
    };
    requestAnimationFrame(progressTracker);
    animation.finished.then(() => {
      if (data.animation === animation) {
        htmlEl.style.transform = "";
        htmlEl.style.transformOrigin = "";
        data.animation = null;
        data.currentDelta = null;
        data.progress = 0;
        data.snapshot = rectToBox(el2.getBoundingClientRect());
      }
    }).catch(() => {
    });
  }
  pendingElements.clear();
}
function registerLayoutElement(el2, config) {
  layoutElements.set(el2, {
    snapshot: null,
    config,
    animation: null,
    progress: 0,
    currentDelta: null
  });
}
function updateLayoutElement(el2, config) {
  let data = layoutElements.get(el2);
  if (data) {
    data.config = config;
  } else {
    registerLayoutElement(el2, config);
  }
}
function unregisterLayoutElement(el2) {
  let data = layoutElements.get(el2);
  if (data) {
    if (data.animation) {
      data.animation.cancel();
    }
    let htmlEl = el2;
    htmlEl.style.transform = "";
    htmlEl.style.transformOrigin = "";
  }
  layoutElements.delete(el2);
}

// ../../../src/lib/vnode.ts
var TEXT_NODE = /* @__PURE__ */ Symbol("TEXT_NODE");
var ROOT_VNODE = /* @__PURE__ */ Symbol("ROOT_VNODE");
function isFragmentNode(node) {
  return node.type === Fragment;
}
function isTextNode(node) {
  return node.type === TEXT_NODE;
}
function isCommittedTextNode(node) {
  return isTextNode(node) && node._dom instanceof Text;
}
function isHostNode(node) {
  return typeof node.type === "string";
}
function isCommittedHostNode(node) {
  return isHostNode(node) && node._dom instanceof Element;
}
function isComponentNode(node) {
  return typeof node.type === "function" && node.type !== Frame;
}
function isCommittedComponentNode(node) {
  return isComponentNode(node) && node._content !== void 0;
}
function isRemixElement(node) {
  return typeof node === "object" && node !== null && "$rmx" in node;
}
function findContextFromAncestry(node, type) {
  let current = node;
  while (current) {
    if (current.type === type && isComponentNode(current)) {
      return current._handle.getContextValue();
    }
    current = current._parent;
  }
  return void 0;
}

// ../../../src/lib/style/lib/style.ts
function camelToKebab(str) {
  return str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
var NUMERIC_CSS_PROPS = /* @__PURE__ */ new Set([
  "aspect-ratio",
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
function normalizeCssValue(key, value) {
  if (value == null) return String(value);
  if (typeof value === "number" && value !== 0) {
    let cssKey = camelToKebab(key);
    if (!NUMERIC_CSS_PROPS.has(cssKey) && !cssKey.startsWith("--")) {
      return `${value}px`;
    }
  }
  return String(value);
}
function isComplexSelector(key) {
  return key.startsWith("&") || key.startsWith("@") || key.startsWith(":") || key.startsWith("[") || key.startsWith(".");
}
function isKeyframesAtRule(key) {
  if (!key.startsWith("@")) return false;
  let lower = key.toLowerCase();
  return lower.startsWith("@keyframes") || lower.startsWith("@-webkit-keyframes") || lower.startsWith("@-moz-keyframes") || lower.startsWith("@-o-keyframes");
}
function hashStyle(obj) {
  let sortedEntries = Object.entries(obj).sort(([a], [b]) => a.localeCompare(b));
  let str = JSON.stringify(sortedEntries);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
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
        let record2 = toRecord(value);
        if (!record2) continue;
        if (key.startsWith("@function")) {
          let body = atRuleBodyToCss(record2);
          if (body.trim().length > 0) {
            preludeAtRules.push(`${key} {
${indent(body, 2)}
}`);
          } else {
            preludeAtRules.push(`${key} {
}`);
          }
        } else if (isKeyframesAtRule(key)) {
          let body = keyframesBodyToCss(record2);
          if (body.trim().length > 0) {
            preludeAtRules.push(`${key} {
${indent(body, 2)}
}`);
          } else {
            preludeAtRules.push(`${key} {
}`);
          }
        } else {
          let inner = styleToCss(record2, selector);
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
      let record = toRecord(value);
      if (!record) continue;
      let nestedContent = "";
      for (let [prop, propValue] of Object.entries(record)) {
        if (propValue != null) {
          let normalizedValue = normalizeCssValue(prop, propValue);
          nestedContent += `    ${camelToKebab(prop)}: ${normalizedValue};
`;
        }
      }
      if (nestedContent) {
        nestedBlocks.push(`  ${key} {
${nestedContent}  }`);
      }
    } else {
      if (value != null) {
        let normalizedValue = normalizeCssValue(key, value);
        baseDeclarations.push(`  ${camelToKebab(key)}: ${normalizedValue};`);
      }
    }
  }
  let css = "";
  if (preludeAtRules.length > 0) {
    css += preludeAtRules.join("\n");
  }
  if (selector && (baseDeclarations.length > 0 || nestedBlocks.length > 0)) {
    css += (css ? "\n" : "") + `${selector} {
`;
    if (baseDeclarations.length > 0) {
      css += baseDeclarations.join("\n") + "\n";
    }
    if (nestedBlocks.length > 0) {
      css += nestedBlocks.join("\n") + "\n";
    }
    css += "}";
  }
  if (atRules.length > 0) {
    css += (css ? "\n" : "") + atRules.join("\n");
  }
  return css;
}
function indent(text, spaces) {
  let pad = " ".repeat(spaces);
  return text.split("\n").map((line) => line.length ? pad + line : line).join("\n");
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function toRecord(value) {
  return isRecord(value) ? value : null;
}
function keyframesBodyToCss(frames) {
  let blocks = [];
  for (let [frameSelector, frameValue] of Object.entries(frames)) {
    if (!isRecord(frameValue)) {
      continue;
    }
    let declarations = [];
    for (let [prop, propValue] of Object.entries(frameValue)) {
      if (propValue == null) continue;
      if (isComplexSelector(prop)) continue;
      let normalizedValue = normalizeCssValue(prop, propValue);
      declarations.push(`  ${camelToKebab(prop)}: ${normalizedValue};`);
    }
    if (declarations.length > 0) {
      blocks.push(`${frameSelector} {
${declarations.join("\n")}
}`);
    } else {
      blocks.push(`${frameSelector} {
}`);
    }
  }
  return blocks.join("\n");
}
function atRuleBodyToCss(styles) {
  let declarations = [];
  let nested = [];
  for (let [key, value] of Object.entries(styles)) {
    if (isComplexSelector(key)) {
      if (key.startsWith("@")) {
        let record = toRecord(value);
        if (!record) continue;
        let inner = atRuleBodyToCss(record);
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
        let normalizedValue = normalizeCssValue(key, value);
        declarations.push(`  ${camelToKebab(key)}: ${normalizedValue};`);
      }
    }
  }
  let body = "";
  if (declarations.length > 0) {
    body += declarations.join("\n");
  }
  if (nested.length > 0) {
    body += (body ? "\n" : "") + nested.join("\n");
  }
  return body;
}
function processStyle(styleObj, styleCache2) {
  if (Object.keys(styleObj).length === 0) {
    return { selector: "", css: "" };
  }
  let hash = hashStyle(styleObj);
  let selector = `rmx-${hash}`;
  let cached = styleCache2.get(hash);
  if (cached) {
    return cached;
  }
  let css = styleToCss(styleObj, `[data-css="${selector}"]`);
  let result = { selector, css };
  styleCache2.set(hash, result);
  return result;
}

// ../../../src/lib/style/lib/stylesheet.ts
function createStyleManager(layer = "rmx") {
  let stylesheet = new CSSStyleSheet();
  document.adoptedStyleSheets.push(stylesheet);
  let ruleMap = /* @__PURE__ */ new Map();
  let serverStyle = document.querySelector("style[data-rmx-styles]");
  if (serverStyle && serverStyle.sheet) {
    let rules = serverStyle.sheet.cssRules;
    for (let i = 0; i < rules.length; i++) {
      let rule = rules[i];
      if (rule instanceof CSSLayerBlockRule) {
        for (let j = 0; j < rule.cssRules.length; j++) {
          let innerRule = rule.cssRules[j];
          if (innerRule instanceof CSSStyleRule) {
            let match = innerRule.selectorText.match(/\[data-css="([^"]+)"\]/);
            if (match) {
              let className = match[1];
              ruleMap.set(className, { count: 1, index: -1 });
            }
          }
        }
      }
    }
  }
  function has(className) {
    let entry = ruleMap.get(className);
    return entry !== void 0 && entry.count > 0;
  }
  function insert2(className, rule) {
    let entry = ruleMap.get(className);
    if (entry) {
      entry.count++;
      return;
    }
    let index = stylesheet.cssRules.length;
    try {
      stylesheet.insertRule(`@layer ${layer} { ${rule} }`, index);
      ruleMap.set(className, { count: 1, index });
    } catch (error) {
      throw error;
    }
  }
  function remove3(className) {
    let entry = ruleMap.get(className);
    if (!entry) return;
    entry.count--;
    if (entry.count > 0) {
      return;
    }
    let indexToDelete = entry.index;
    ruleMap.delete(className);
    if (indexToDelete < 0) return;
    stylesheet.deleteRule(indexToDelete);
    for (let [name2, data] of ruleMap.entries()) {
      if (data.index > indexToDelete) {
        data.index--;
      }
    }
  }
  function dispose() {
    document.adoptedStyleSheets = Array.from(document.adoptedStyleSheets).filter(
      (s) => s !== stylesheet
    );
    ruleMap.clear();
  }
  return { insert: insert2, remove: remove3, has, dispose };
}

// ../../../src/lib/diff-props.ts
var SVG_NS = "http://www.w3.org/2000/svg";
var XLINK_NS = "http://www.w3.org/1999/xlink";
var XML_NS = "http://www.w3.org/XML/1998/namespace";
var styleCache = /* @__PURE__ */ new Map();
var styleManager = typeof window !== "undefined" ? createStyleManager() : null;
function cleanupCssProps(props) {
  if (!props?.css) return;
  let { selector } = processStyle(props.css, styleCache);
  if (selector) {
    styleManager.remove(selector);
  }
}
function diffCssProp(curr, next, dom) {
  let prevSelector = curr.css ? processStyle(curr.css, styleCache).selector : "";
  let { selector: nextSelector, css } = next.css ? processStyle(next.css, styleCache) : { selector: "", css: "" };
  if (prevSelector === nextSelector) return;
  if (prevSelector) {
    dom.removeAttribute("data-css");
    styleManager.remove(prevSelector);
  }
  if (css && nextSelector) {
    dom.setAttribute("data-css", nextSelector);
    styleManager.insert(nextSelector, css);
  }
}
var ATTRIBUTE_FALLBACK_NAMES = /* @__PURE__ */ new Set([
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
function canUseProperty(dom, name2, isSvg) {
  if (isSvg) return false;
  if (ATTRIBUTE_FALLBACK_NAMES.has(name2)) return false;
  return name2 in dom;
}
function isFrameworkProp(name2) {
  return name2 === "children" || name2 === "key" || name2 === "on" || name2 === "css" || name2 === "setup" || name2 === "connect" || name2 === "animate" || name2 === "innerHTML";
}
function serializeStyleObject(style) {
  let parts = [];
  for (let [key, value] of Object.entries(style)) {
    if (value == null) continue;
    if (typeof value === "boolean") continue;
    if (typeof value === "number" && !Number.isFinite(value)) continue;
    let cssKey = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    let cssValue = Array.isArray(value) ? value.join(", ") : normalizeCssValue(key, value);
    parts.push(`${cssKey}: ${cssValue};`);
  }
  return parts.join(" ");
}
function normalizePropName(name2, isSvg) {
  if (name2.startsWith("aria-") || name2.startsWith("data-")) return { attr: name2 };
  if (!isSvg) {
    if (name2 === "className") return { attr: "class" };
    if (name2 === "htmlFor") return { attr: "for" };
    if (name2 === "tabIndex") return { attr: "tabindex" };
    if (name2 === "acceptCharset") return { attr: "accept-charset" };
    if (name2 === "httpEquiv") return { attr: "http-equiv" };
    return { attr: name2.toLowerCase() };
  }
  if (name2 === "xlinkHref") return { ns: XLINK_NS, attr: "xlink:href" };
  if (name2 === "xmlLang") return { ns: XML_NS, attr: "xml:lang" };
  if (name2 === "xmlSpace") return { ns: XML_NS, attr: "xml:space" };
  if (name2 === "viewBox" || name2 === "preserveAspectRatio" || name2 === "gradientUnits" || name2 === "gradientTransform" || name2 === "patternUnits" || name2 === "patternTransform" || name2 === "clipPathUnits" || name2 === "maskUnits" || name2 === "maskContentUnits") {
    return { attr: name2 };
  }
  return { attr: camelToKebab2(name2) };
}
function camelToKebab2(input) {
  return input.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/_/g, "-").toLowerCase();
}
function diffHostProps(curr, next, dom) {
  let isSvg = dom.namespaceURI === SVG_NS;
  if (next.css || curr.css) {
    diffCssProp(curr, next, dom);
  }
  for (let name2 in curr) {
    if (isFrameworkProp(name2)) continue;
    if (!(name2 in next) || next[name2] == null) {
      if (canUseProperty(dom, name2, isSvg)) {
        try {
          dom[name2] = "";
          continue;
        } catch {
        }
      }
      let { ns, attr } = normalizePropName(name2, isSvg);
      if (ns) dom.removeAttributeNS(ns, attr);
      else dom.removeAttribute(attr);
    }
  }
  for (let name2 in next) {
    if (isFrameworkProp(name2)) continue;
    let nextValue = next[name2];
    if (nextValue == null) continue;
    let prevValue = curr[name2];
    if (prevValue !== nextValue) {
      let { ns, attr } = normalizePropName(name2, isSvg);
      if (attr === "style" && typeof nextValue === "object" && nextValue && !Array.isArray(nextValue)) {
        dom.setAttribute("style", serializeStyleObject(nextValue));
        continue;
      }
      if (canUseProperty(dom, name2, isSvg)) {
        try {
          dom[name2] = nextValue == null ? "" : nextValue;
          continue;
        } catch {
        }
      }
      if (typeof nextValue === "function") {
        continue;
      }
      let isAriaOrData = name2.startsWith("aria-") || name2.startsWith("data-");
      if (nextValue != null && (nextValue !== false || isAriaOrData)) {
        let attrValue = name2 === "popover" && nextValue === true ? "" : String(nextValue);
        if (ns) dom.setAttributeNS(ns, attr, attrValue);
        else dom.setAttribute(attr, attrValue);
      } else {
        if (ns) dom.removeAttributeNS(ns, attr);
        else dom.removeAttribute(attr);
      }
    }
  }
}

// ../../../src/lib/hydration.ts
function logHydrationMismatch(...msg) {
  console.error("Hydration mismatch:", ...msg);
}
function skipComments(cursor) {
  while (cursor && cursor.nodeType === Node.COMMENT_NODE) {
    cursor = cursor.nextSibling;
  }
  return cursor;
}

// ../../../src/lib/to-vnode.ts
function flatMapChildrenToVNodes(node) {
  return "children" in node.props ? Array.isArray(node.props.children) ? node.props.children.flat(Infinity).map(toVNode) : [toVNode(node.props.children)] : [];
}
function flattenRemixNodeArray(nodes, out = []) {
  for (let child of nodes) {
    if (Array.isArray(child)) {
      flattenRemixNodeArray(child, out);
    } else {
      out.push(child);
    }
  }
  return out;
}
function toVNode(node) {
  if (node === null || node === void 0 || typeof node === "boolean") {
    return { type: TEXT_NODE, _text: "" };
  }
  if (typeof node === "string" || typeof node === "number" || typeof node === "bigint") {
    return { type: TEXT_NODE, _text: String(node) };
  }
  if (Array.isArray(node)) {
    let flatChildren = flattenRemixNodeArray(node);
    return { type: Fragment, _children: flatChildren.map(toVNode) };
  }
  if (node.type === Fragment) {
    return { type: Fragment, key: node.key, _children: flatMapChildrenToVNodes(node) };
  }
  if (isRemixElement(node)) {
    let children = node.props.innerHTML != null ? [] : flatMapChildrenToVNodes(node);
    return { type: node.type, key: node.key, props: node.props, _children: children };
  }
  invariant(false, "Unexpected RemixNode");
}

// ../../../src/lib/presence.ts
var exitingNodes = /* @__PURE__ */ new Set();
function getDebugDurationMultiplier() {
  return typeof window !== "undefined" && window.DEBUG_PRESENCE ? 10 : 1;
}
var DEFAULT_ENTER = {
  opacity: 0,
  duration: 150,
  easing: "ease-out"
};
var DEFAULT_EXIT = {
  opacity: 0,
  duration: 150,
  easing: "ease-in"
};
var DEFAULT_LAYOUT = {
  duration: 200,
  easing: "ease-in-out"
};
function normalizePresence(presence) {
  let result = {};
  if (presence.enter === true) {
    result.enter = DEFAULT_ENTER;
  } else if (presence.enter) {
    result.enter = presence.enter;
  }
  if (presence.exit === true) {
    result.exit = DEFAULT_EXIT;
  } else if (presence.exit) {
    result.exit = presence.exit;
  }
  if (presence.layout === true) {
    result.layout = DEFAULT_LAYOUT;
  } else if (presence.layout) {
    result.layout = {
      duration: presence.layout.duration ?? DEFAULT_LAYOUT.duration,
      easing: presence.layout.easing ?? DEFAULT_LAYOUT.easing
    };
  }
  return result;
}
function getPresenceConfig(node) {
  let animate = node.props.animate;
  if (!animate) return null;
  return normalizePresence(animate);
}
function shouldPlayEnterAnimation(config) {
  return !!config;
}
function hasKeyframes(config) {
  return "keyframes" in config && Array.isArray(config.keyframes);
}
function extractStyleProps(config) {
  let result = {};
  for (let key in config) {
    if (key !== "offset" && key !== "easing" && key !== "composite" && key !== "duration" && key !== "delay") {
      result[key] = config[key];
    }
  }
  if (config.offset !== void 0) result.offset = config.offset;
  if (config.easing !== void 0) result.easing = config.easing;
  if (config.composite !== void 0) result.composite = config.composite;
  return result;
}
function buildEnterKeyframes(config) {
  if (hasKeyframes(config)) {
    return config.keyframes.map(extractStyleProps);
  }
  let keyframe = extractStyleProps(config);
  delete keyframe.easing;
  return [keyframe, {}];
}
function buildExitKeyframes(config) {
  if (hasKeyframes(config)) {
    return config.keyframes.map(extractStyleProps);
  }
  let keyframe = extractStyleProps(config);
  delete keyframe.easing;
  return [{}, keyframe];
}
function markNodeExiting(node, domParent) {
  node._exiting = true;
  node._exitingParent = domParent;
  exitingNodes.add(node);
}
function unmarkNodeExiting(node) {
  exitingNodes.delete(node);
  node._exiting = false;
  node._exitingParent = void 0;
}
function playEnterAnimation(node, config) {
  let dom = node._dom;
  let keyframes = buildEnterKeyframes(config);
  let multiplier = getDebugDurationMultiplier();
  let options = {
    duration: config.duration * multiplier,
    delay: config.delay != null ? config.delay * multiplier : void 0,
    easing: config.easing,
    composite: config.composite,
    fill: "backwards"
  };
  let animation = dom.animate(keyframes, options);
  node._animation = animation;
}
function playExitAnimation(node, config, domParent, onComplete) {
  let dom = node._dom;
  let keyframes = buildExitKeyframes(config);
  let multiplier = getDebugDurationMultiplier();
  let options = {
    duration: config.duration * multiplier,
    delay: config.delay != null ? config.delay * multiplier : void 0,
    easing: config.easing,
    composite: config.composite,
    fill: "forwards"
  };
  let animation = dom.animate(keyframes, options);
  node._animation = animation;
  markNodeExiting(node, domParent);
  animation.finished.then(() => {
    if (!node._exiting) return;
    unmarkNodeExiting(node);
    node._animation = void 0;
    onComplete();
  });
}
function findMatchingExitingNode(type, key, domParent) {
  if (key == null) return null;
  for (let node of exitingNodes) {
    if (!isCommittedHostNode(node)) continue;
    if (node._exitingParent !== domParent) continue;
    if (node.type !== type) continue;
    if (node.key !== key) continue;
    return node;
  }
  return null;
}

// ../../../src/lib/reconcile.ts
var SVG_NS2 = "http://www.w3.org/2000/svg";
var INSERT_VNODE = 1 << 0;
var MATCHED = 1 << 1;
var fixmeIdCounter = 0;
function getSvgContext(vParent, nodeType) {
  if (typeof nodeType === "string") {
    if (nodeType === "svg") return true;
    if (nodeType === "foreignObject") return false;
  }
  return vParent._svg ?? false;
}
function diffVNodes(curr, next, domParent, frame, scheduler, vParent, rootTarget, anchor, rootCursor) {
  next._parent = vParent;
  next._svg = getSvgContext(vParent, next.type);
  if (curr === null) {
    return insert(next, domParent, frame, scheduler, vParent, rootTarget, anchor, rootCursor);
  }
  if (curr.type !== next.type) {
    replace(curr, next, domParent, frame, scheduler, vParent, rootTarget, anchor);
    return rootCursor;
  }
  if (isCommittedTextNode(curr) && isTextNode(next)) {
    diffText(curr, next, vParent);
    return rootCursor;
  }
  if (isCommittedHostNode(curr) && isHostNode(next)) {
    diffHost(curr, next, frame, scheduler, vParent, rootTarget);
    return rootCursor;
  }
  if (isCommittedComponentNode(curr) && isComponentNode(next)) {
    diffComponent(curr, next, frame, scheduler, domParent, vParent, rootTarget);
    return rootCursor;
  }
  if (isFragmentNode(curr) && isFragmentNode(next)) {
    diffChildren(
      curr._children,
      next._children,
      domParent,
      frame,
      scheduler,
      vParent,
      rootTarget,
      void 0,
      anchor
    );
    return rootCursor;
  }
  if (curr.type === Frame && next.type === Frame) {
    throw new Error("TODO: Frame diff not implemented");
  }
  invariant(false, "Unexpected diff case");
}
function replace(curr, next, domParent, frame, scheduler, vParent, rootTarget, anchor) {
  anchor = findFirstDomAnchor(curr) || anchor;
  insert(next, domParent, frame, scheduler, vParent, rootTarget, anchor);
  remove2(curr, domParent, scheduler);
}
function diffHost(curr, next, frame, scheduler, vParent, rootTarget) {
  if (next.props.innerHTML != null) {
    if (curr.props.innerHTML !== next.props.innerHTML) {
      curr._dom.innerHTML = next.props.innerHTML;
    }
  } else if (curr.props.innerHTML != null) {
    curr._dom.innerHTML = "";
  }
  diffChildren(curr._children, next._children, curr._dom, frame, scheduler, next, rootTarget);
  diffHostProps(curr.props, next.props, curr._dom);
  next._dom = curr._dom;
  next._parent = vParent;
  next._controller = curr._controller;
  let nextOn = next.props.on;
  if (nextOn) {
    if (curr._events) {
      next._events = curr._events;
      let eventsContainer = curr._events;
      scheduler.enqueueTasks([() => eventsContainer.set(nextOn)]);
    } else {
      let eventsContainer = createContainer(curr._dom);
      scheduler.enqueueTasks([() => eventsContainer.set(nextOn)]);
      next._events = eventsContainer;
    }
  } else if (curr._events) {
    let eventsContainer = curr._events;
    scheduler.enqueueTasks([() => eventsContainer.dispose()]);
  }
  let nextPresenceConfig = getPresenceConfig(next);
  let currPresenceConfig = getPresenceConfig(curr);
  if (nextPresenceConfig?.layout) {
    updateLayoutElement(curr._dom, nextPresenceConfig.layout);
  } else if (currPresenceConfig?.layout) {
    unregisterLayoutElement(curr._dom);
  }
  return;
}
function setupHostNode(node, dom, scheduler) {
  node._dom = dom;
  let on2 = node.props.on;
  if (on2) {
    let eventsContainer = createContainer(dom);
    scheduler.enqueueTasks([() => eventsContainer.set(on2)]);
    node._events = eventsContainer;
  }
  let connect = node.props.connect;
  let presenceConfig = getPresenceConfig(node);
  let playEnter = shouldPlayEnterAnimation(presenceConfig?.enter);
  if (presenceConfig?.layout) {
    registerLayoutElement(dom, presenceConfig.layout);
  }
  if (connect) {
    if (connect.length >= 2) {
      let controller = new AbortController();
      node._controller = controller;
      scheduler.enqueueTasks([
        () => {
          connect(dom, controller.signal);
          if (playEnter) {
            playEnterAnimation(node, presenceConfig.enter);
          }
        }
      ]);
    } else {
      scheduler.enqueueTasks([
        () => {
          connect(dom);
          if (playEnter) {
            playEnterAnimation(node, presenceConfig.enter);
          }
        }
      ]);
    }
  } else if (playEnter) {
    scheduler.enqueueTasks([
      () => {
        playEnterAnimation(node, presenceConfig.enter);
      }
    ]);
  }
}
function diffText(curr, next, vParent) {
  if (curr._text !== next._text) {
    curr._dom.textContent = next._text;
  }
  next._dom = curr._dom;
  next._parent = vParent;
}
function insert(node, domParent, frame, scheduler, vParent, rootTarget, anchor, cursor) {
  node._parent = vParent;
  node._svg = getSvgContext(vParent, node.type);
  if (cursor && anchor && cursor === anchor) {
    cursor = null;
  }
  cursor = skipComments(cursor ?? null);
  if (cursor && anchor && cursor === anchor) {
    cursor = null;
  }
  let doInsert = anchor ? (dom) => domParent.insertBefore(dom, anchor) : (dom) => domParent.appendChild(dom);
  if (isTextNode(node)) {
    if (cursor instanceof Text) {
      node._parent = vParent;
      if (cursor.data !== node._text) {
        if (cursor.data.startsWith(node._text) && node._text.length < cursor.data.length) {
          let remainder = cursor.splitText(node._text.length);
          node._dom = cursor;
          return remainder;
        }
        logHydrationMismatch("text mismatch", cursor.data, node._text);
        cursor.data = node._text;
      }
      node._dom = cursor;
      return cursor.nextSibling;
    }
    let dom = document.createTextNode(node._text);
    node._dom = dom;
    node._parent = vParent;
    doInsert(dom);
    return cursor;
  }
  if (isHostNode(node)) {
    let exitingNode = findMatchingExitingNode(node.type, node.key, domParent);
    if (exitingNode) {
      reclaimExitingNode(exitingNode, node, domParent, frame, scheduler, vParent, rootTarget);
      return cursor;
    }
    if (cursor instanceof Element) {
      let cursorTag = node._svg ? cursor.tagName : cursor.tagName.toLowerCase();
      if (cursorTag === node.type) {
        diffHostProps({}, node.props, cursor);
        if (node.props.innerHTML != null) {
          cursor.innerHTML = node.props.innerHTML;
        } else {
          let childCursor = cursor.firstChild;
          diffChildren(
            null,
            node._children,
            cursor,
            frame,
            scheduler,
            node,
            rootTarget,
            childCursor
          );
        }
        setupHostNode(node, cursor, scheduler);
        return cursor.nextSibling;
      } else {
        let nextSibling = skipComments(cursor.nextSibling);
        if (nextSibling instanceof Element) {
          let nextTag = node._svg ? nextSibling.tagName : nextSibling.tagName.toLowerCase();
          if (nextTag === node.type) {
            diffHostProps({}, node.props, nextSibling);
            if (node.props.innerHTML != null) {
              nextSibling.innerHTML = node.props.innerHTML;
            } else {
              let childCursor = nextSibling.firstChild;
              diffChildren(
                null,
                node._children,
                nextSibling,
                frame,
                scheduler,
                node,
                rootTarget,
                childCursor
              );
            }
            setupHostNode(node, nextSibling, scheduler);
            return nextSibling.nextSibling;
          }
        }
        logHydrationMismatch("tag", cursorTag, node.type);
        cursor = void 0;
      }
    }
    let dom = node._svg ? document.createElementNS(SVG_NS2, node.type) : document.createElement(node.type);
    diffHostProps({}, node.props, dom);
    if (node.props.innerHTML != null) {
      dom.innerHTML = node.props.innerHTML;
    } else {
      diffChildren(null, node._children, dom, frame, scheduler, node, rootTarget);
    }
    setupHostNode(node, dom, scheduler);
    doInsert(dom);
    return cursor;
  }
  if (isFragmentNode(node)) {
    for (let child of node._children) {
      cursor = insert(child, domParent, frame, scheduler, vParent, rootTarget, anchor, cursor);
    }
    return cursor;
  }
  if (isComponentNode(node)) {
    return diffComponent(
      null,
      node,
      frame,
      scheduler,
      domParent,
      vParent,
      rootTarget,
      anchor,
      cursor
    );
  }
  if (node.type === Frame) {
    throw new Error("TODO: Frame insert not implemented");
  }
  invariant(false, "Unexpected node type");
}
function renderComponent(handle, currContent, next, domParent, frame, scheduler, rootTarget, vParent, anchor, cursor) {
  let [element, tasks] = handle.render(next.props);
  let content = toVNode(element);
  let newCursor = diffVNodes(
    currContent,
    content,
    domParent,
    frame,
    scheduler,
    next,
    rootTarget,
    anchor,
    cursor
  );
  next._content = content;
  next._handle = handle;
  next._parent = vParent;
  let committed = next;
  handle.setScheduleUpdate(() => {
    scheduler.enqueue(committed, domParent);
  });
  scheduler.enqueueTasks(tasks);
  return newCursor;
}
function diffComponent(curr, next, frame, scheduler, domParent, vParent, rootTarget, anchor, cursor) {
  if (curr === null) {
    next._handle = createComponent({
      id: `e${++fixmeIdCounter}`,
      frame,
      type: next.type,
      getContext: (type) => findContextFromAncestry(vParent, type)
    });
    return renderComponent(
      next._handle,
      null,
      next,
      domParent,
      frame,
      scheduler,
      rootTarget,
      vParent,
      anchor,
      cursor
    );
  }
  next._handle = curr._handle;
  let { _content, _handle } = curr;
  return renderComponent(
    _handle,
    _content,
    next,
    domParent,
    frame,
    scheduler,
    rootTarget,
    vParent,
    anchor,
    cursor
  );
}
function cleanupDescendants(node, scheduler) {
  if (isCommittedTextNode(node)) {
    return;
  }
  if (isCommittedHostNode(node)) {
    for (let child of node._children) {
      cleanupDescendants(child, scheduler);
    }
    cleanupCssProps(node.props);
    let presenceConfig = getPresenceConfig(node);
    if (presenceConfig?.layout) {
      unregisterLayoutElement(node._dom);
    }
    if (node._controller) node._controller.abort();
    let _events = node._events;
    if (_events) {
      scheduler.enqueueTasks([() => _events.dispose()]);
    }
    return;
  }
  if (isFragmentNode(node)) {
    for (let child of node._children) {
      cleanupDescendants(child, scheduler);
    }
    return;
  }
  if (isCommittedComponentNode(node)) {
    cleanupDescendants(node._content, scheduler);
    let tasks = node._handle.remove();
    scheduler.enqueueTasks(tasks);
    return;
  }
}
function remove2(node, domParent, scheduler) {
  if (isCommittedTextNode(node)) {
    domParent.removeChild(node._dom);
    return;
  }
  if (isCommittedHostNode(node)) {
    if (node._exiting) {
      return;
    }
    let presenceConfig = getPresenceConfig(node);
    if (presenceConfig?.exit) {
      let animation = node._animation;
      if (animation && animation.playState === "running") {
        animation.reverse();
        markNodeExiting(node, domParent);
        animation.finished.then(() => {
          if (!node._exiting) return;
          unmarkNodeExiting(node);
          node._animation = void 0;
          performHostNodeRemoval(node, domParent, scheduler);
        });
        return;
      }
      playExitAnimation(node, presenceConfig.exit, domParent, () => {
        performHostNodeRemoval(node, domParent, scheduler);
      });
      return;
    }
    if (node._animation) {
      node._animation.cancel();
      node._animation = void 0;
    }
    performHostNodeRemoval(node, domParent, scheduler);
    return;
  }
  if (isFragmentNode(node)) {
    for (let child of node._children) {
      remove2(child, domParent, scheduler);
    }
    return;
  }
  if (isCommittedComponentNode(node)) {
    remove2(node._content, domParent, scheduler);
    let tasks = node._handle.remove();
    scheduler.enqueueTasks(tasks);
    return;
  }
}
function performHostNodeRemoval(node, domParent, scheduler) {
  for (let child of node._children) {
    cleanupDescendants(child, scheduler);
  }
  cleanupCssProps(node.props);
  let presenceConfig = getPresenceConfig(node);
  if (presenceConfig?.layout) {
    unregisterLayoutElement(node._dom);
  }
  if (node._dom.parentNode === domParent) {
    domParent.removeChild(node._dom);
  }
  if (node._controller) node._controller.abort();
  let _events = node._events;
  if (_events) {
    scheduler.enqueueTasks([() => _events.dispose()]);
  }
}
function diffChildren(curr, next, domParent, frame, scheduler, vParent, rootTarget, cursor, anchor) {
  if (curr === null) {
    for (let node of next) {
      cursor = insert(node, domParent, frame, scheduler, vParent, rootTarget, anchor, cursor);
    }
    vParent._children = next;
    return cursor;
  }
  let currLength = curr.length;
  let nextLength = next.length;
  let hasKeys = false;
  for (let i = 0; i < nextLength; i++) {
    let node = next[i];
    if (node && node.key != null) {
      hasKeys = true;
      break;
    }
  }
  if (!hasKeys) {
    for (let i = 0; i < nextLength; i++) {
      let currentNode = i < currLength ? curr[i] : null;
      diffVNodes(
        currentNode,
        next[i],
        domParent,
        frame,
        scheduler,
        vParent,
        rootTarget,
        anchor,
        cursor
      );
    }
    if (currLength > nextLength) {
      for (let i = nextLength; i < currLength; i++) {
        let node = curr[i];
        if (node) remove2(node, domParent, scheduler);
      }
    }
    vParent._children = next;
    return;
  }
  let oldChildren = curr;
  let oldChildrenLength = currLength;
  let remainingOldChildren = oldChildrenLength;
  let oldKeyMap = /* @__PURE__ */ new Map();
  for (let i = 0; i < oldChildrenLength; i++) {
    let c = oldChildren[i];
    if (c) {
      c._flags = 0;
      if (c.key != null) {
        oldKeyMap.set(c.key, i);
      }
    }
  }
  let skew = 0;
  let newChildren = new Array(nextLength);
  for (let i = 0; i < nextLength; i++) {
    let childVNode = next[i];
    if (!childVNode) {
      newChildren[i] = childVNode;
      continue;
    }
    newChildren[i] = childVNode;
    childVNode._parent = vParent;
    let skewedIndex = i + skew;
    let matchingIndex = -1;
    let key = childVNode.key;
    let type = childVNode.type;
    if (key != null) {
      let mapIndex = oldKeyMap.get(key);
      if (mapIndex !== void 0) {
        let candidate = oldChildren[mapIndex];
        let candidateFlags = candidate?._flags ?? 0;
        if (candidate && (candidateFlags & MATCHED) === 0 && candidate.type === type) {
          matchingIndex = mapIndex;
        }
      }
    } else {
      let searchVNode = oldChildren[skewedIndex];
      let searchFlags = searchVNode?._flags ?? 0;
      let available = searchVNode != null && (searchFlags & MATCHED) === 0;
      if (available && searchVNode.key == null && type === searchVNode.type) {
        matchingIndex = skewedIndex;
      }
    }
    childVNode._index = matchingIndex;
    let matchedOldVNode = null;
    if (matchingIndex !== -1) {
      matchedOldVNode = oldChildren[matchingIndex];
      remainingOldChildren--;
      if (matchedOldVNode) {
        matchedOldVNode._flags = (matchedOldVNode._flags ?? 0) | MATCHED;
      }
    }
    let oldDom = matchedOldVNode && findFirstDomAnchor(matchedOldVNode);
    let isMounting = !matchedOldVNode || !oldDom;
    if (isMounting) {
      if (matchingIndex === -1) {
        if (nextLength > oldChildrenLength) {
          skew--;
        } else if (nextLength < oldChildrenLength) {
          skew++;
        }
      }
      childVNode._flags = (childVNode._flags ?? 0) | INSERT_VNODE;
    } else if (matchingIndex !== i + skew) {
      if (matchingIndex === i + skew - 1) {
        skew--;
      } else if (matchingIndex === i + skew + 1) {
        skew++;
      } else {
        if (matchingIndex > i + skew) skew--;
        else skew++;
        childVNode._flags = (childVNode._flags ?? 0) | INSERT_VNODE;
      }
    }
  }
  if (remainingOldChildren) {
    for (let i = 0; i < oldChildrenLength; i++) {
      let oldVNode = oldChildren[i];
      if (oldVNode && ((oldVNode._flags ?? 0) & MATCHED) === 0) {
        remove2(oldVNode, domParent, scheduler);
      }
    }
  }
  vParent._children = newChildren;
  let lastPlaced = null;
  for (let i = 0; i < nextLength; i++) {
    let childVNode = newChildren[i];
    if (!childVNode) continue;
    let idx = childVNode._index ?? -1;
    let oldVNode = idx >= 0 ? oldChildren[idx] : null;
    diffVNodes(
      oldVNode,
      childVNode,
      domParent,
      frame,
      scheduler,
      vParent,
      rootTarget,
      anchor,
      cursor
    );
    let shouldPlace = (childVNode._flags ?? 0) & INSERT_VNODE;
    let firstDom = findFirstDomAnchor(childVNode);
    let lastDom = firstDom ? findLastDomAnchor(childVNode) : null;
    if (shouldPlace && firstDom && lastDom && firstDom.parentNode === domParent) {
      let target;
      if (lastPlaced === null) {
        if (vParent._rangeStart && vParent._rangeStart.parentNode === domParent) {
          target = vParent._rangeStart.nextSibling;
        } else {
          target = domParent.firstChild;
        }
      } else {
        target = lastPlaced.nextSibling;
      }
      if (target === null && anchor) target = anchor;
      if (target && domRangeContainsNode(firstDom, lastDom, target)) {
      } else if (firstDom !== target) {
        moveDomRange(domParent, firstDom, lastDom, target);
      }
    }
    if (lastDom) lastPlaced = lastDom;
    childVNode._flags = 0;
    childVNode._index = void 0;
  }
  return;
}
function findFirstDomAnchor(node) {
  if (!node) return null;
  if (isCommittedTextNode(node)) return node._dom;
  if (isCommittedHostNode(node)) return node._dom;
  if (isCommittedComponentNode(node)) return findFirstDomAnchor(node._content);
  if (isFragmentNode(node)) {
    for (let child of node._children) {
      let dom = findFirstDomAnchor(child);
      if (dom) return dom;
    }
  }
  return null;
}
function findLastDomAnchor(node) {
  if (!node) return null;
  if (isCommittedTextNode(node)) return node._dom;
  if (isCommittedHostNode(node)) return node._dom;
  if (isCommittedComponentNode(node)) return findLastDomAnchor(node._content);
  if (isFragmentNode(node)) {
    for (let i = node._children.length - 1; i >= 0; i--) {
      let dom = findLastDomAnchor(node._children[i]);
      if (dom) return dom;
    }
  }
  return null;
}
function domRangeContainsNode(first, last, node) {
  let current = first;
  while (current) {
    if (current === node) return true;
    if (current === last) break;
    current = current.nextSibling;
  }
  return false;
}
function moveDomRange(domParent, first, last, before) {
  let current = first;
  while (current) {
    let next = current === last ? null : current.nextSibling;
    domParent.insertBefore(current, before);
    if (current === last) break;
    current = next;
  }
}
function findNextSiblingDomAnchor(curr, vParent) {
  if (!vParent || !Array.isArray(vParent._children)) return null;
  let children = vParent._children;
  let idx = children.indexOf(curr);
  if (idx === -1) return null;
  for (let i = idx + 1; i < children.length; i++) {
    let dom = findFirstDomAnchor(children[i]);
    if (dom) return dom;
  }
  return null;
}
function reclaimExitingNode(exitingNode, newNode, domParent, frame, scheduler, vParent, rootTarget) {
  let animation = exitingNode._animation;
  if (animation && animation.playState === "running") {
    animation.reverse();
    animation.finished.then(() => {
      exitingNode._animation = void 0;
    });
  }
  unmarkNodeExiting(exitingNode);
  newNode._dom = exitingNode._dom;
  newNode._parent = vParent;
  newNode._controller = exitingNode._controller;
  newNode._events = exitingNode._events;
  newNode._animation = exitingNode._animation;
  diffHostProps(exitingNode.props, newNode.props, exitingNode._dom);
  diffChildren(
    exitingNode._children,
    newNode._children,
    exitingNode._dom,
    frame,
    scheduler,
    newNode,
    rootTarget
  );
  let nextOn = newNode.props.on;
  if (nextOn) {
    if (newNode._events) {
      let eventsContainer = newNode._events;
      scheduler.enqueueTasks([() => eventsContainer.set(nextOn)]);
    } else {
      let eventsContainer = createContainer(exitingNode._dom);
      scheduler.enqueueTasks([() => eventsContainer.set(nextOn)]);
      newNode._events = eventsContainer;
    }
  } else if (newNode._events) {
    let eventsContainer = newNode._events;
    scheduler.enqueueTasks([() => eventsContainer.dispose()]);
    newNode._events = void 0;
  }
}

// ../../../src/lib/scheduler.ts
function createScheduler(doc, rootTarget) {
  let documentState = createDocumentState(doc);
  let scheduled = /* @__PURE__ */ new Map();
  let tasks = [];
  let flushScheduled = false;
  let scheduler;
  function dispatchError2(error) {
    console.error(error);
    rootTarget.dispatchEvent(new ErrorEvent("error", { error }));
  }
  function flush() {
    flushScheduled = false;
    let batch = new Map(scheduled);
    scheduled.clear();
    let hasWork = batch.size > 0 || tasks.length > 0;
    if (!hasWork) return;
    if (batch.size > 0) {
      for (let [, domParent] of batch) {
        markLayoutSubtreePending(domParent);
      }
    }
    captureLayoutSnapshots();
    documentState.capture();
    if (batch.size > 0) {
      let vnodes = Array.from(batch);
      let noScheduledAncestor = /* @__PURE__ */ new Set();
      for (let [vnode, domParent] of vnodes) {
        if (ancestorIsScheduled(vnode, batch, noScheduledAncestor)) continue;
        let handle = vnode._handle;
        let curr = vnode._content;
        let vParent = vnode._parent;
        let anchor = findNextSiblingDomAnchor(vnode, vParent) || void 0;
        try {
          renderComponent(
            handle,
            curr,
            vnode,
            domParent,
            handle.frame,
            scheduler,
            rootTarget,
            vParent,
            anchor
          );
        } catch (error) {
          dispatchError2(error);
        }
      }
    }
    documentState.restore();
    applyLayoutAnimations();
    if (tasks.length > 0) {
      for (let task of tasks) {
        try {
          task();
        } catch (error) {
          dispatchError2(error);
        }
      }
      tasks = [];
    }
  }
  function scheduleFlush() {
    if (flushScheduled) return;
    flushScheduled = true;
    queueMicrotask(flush);
  }
  function ancestorIsScheduled(vnode, batch, safe) {
    let path = [];
    let current = vnode._parent;
    while (current) {
      if (safe.has(current)) {
        for (let node of path) safe.add(node);
        return false;
      }
      path.push(current);
      if (isCommittedComponentNode(current) && batch.has(current)) {
        return true;
      }
      current = current._parent;
    }
    for (let node of path) safe.add(node);
    return false;
  }
  scheduler = {
    enqueue(vnode, domParent) {
      scheduled.set(vnode, domParent);
      scheduleFlush();
    },
    enqueueTasks(newTasks) {
      tasks.push(...newTasks);
      scheduleFlush();
    },
    dequeue() {
      flush();
    }
  };
  return scheduler;
}

// ../../../src/lib/vdom.ts
function createRoot(container, options = {}) {
  let vroot = null;
  let frameStub = options.frame ?? createFrameHandle();
  let hydrationCursor = container.innerHTML.trim() !== "" ? container.firstChild : void 0;
  let eventTarget = new TypedEventTarget();
  let scheduler = options.scheduler ?? createScheduler(container.ownerDocument ?? document, eventTarget);
  container.addEventListener("error", (event) => {
    eventTarget.dispatchEvent(new ErrorEvent("error", { error: event.error }));
  });
  return Object.assign(eventTarget, {
    render(element) {
      let vnode = toVNode(element);
      let vParent = { type: ROOT_VNODE, _svg: false };
      scheduler.enqueueTasks([
        () => {
          diffVNodes(
            vroot,
            vnode,
            container,
            frameStub,
            scheduler,
            vParent,
            eventTarget,
            void 0,
            hydrationCursor
          );
          vroot = vnode;
          hydrationCursor = void 0;
        }
      ]);
      scheduler.dequeue();
    },
    remove() {
      if (!vroot) return;
      let current = vroot;
      vroot = null;
      scheduler.enqueueTasks([() => remove2(current, container, scheduler)]);
      scheduler.dequeue();
    },
    flush() {
      scheduler.dequeue();
    }
  });
}

// ../../../src/lib/jsx.ts
function jsx(type, props, key) {
  return { type, props, key, $rmx: true };
}

// ../../../src/lib/spring.ts
var presets = {
  smooth: { duration: 400, bounce: -0.3 },
  snappy: { duration: 200, bounce: 0 },
  bouncy: { duration: 400, bounce: 0.3 }
};
var restSpeed = 0.01;
var restDelta = 5e-3;
var maxSettlingTime = 2e4;
var frameMs = 1e3 / 60;
function spring(presetOrOptions, overrides) {
  let options = resolveOptions(presetOrOptions, overrides);
  let { position, settlingTime, easing } = computeSpring(options);
  let duration = Math.round(settlingTime);
  function* generator() {
    let t = 0;
    while (t < settlingTime) {
      yield position(t);
      t += frameMs;
    }
    yield 1;
  }
  let iter = generator();
  Object.defineProperties(iter, {
    duration: { value: duration, enumerable: true },
    easing: { value: easing, enumerable: true },
    toString: {
      value() {
        return `${duration}ms ${easing}`;
      }
    }
  });
  return iter;
}
spring.transition = function transition(property, presetOrOptions, overrides) {
  let s = typeof presetOrOptions === "string" ? spring(presetOrOptions, overrides) : spring(presetOrOptions);
  let properties = Array.isArray(property) ? property : [property];
  return properties.map((p) => `${p} ${s}`).join(", ");
};
spring.presets = presets;
function resolveOptions(presetOrOptions, overrides) {
  if (typeof presetOrOptions === "string") {
    let preset = presets[presetOrOptions];
    return {
      duration: overrides?.duration ?? preset.duration,
      bounce: preset.bounce,
      velocity: overrides?.velocity
    };
  }
  if (presetOrOptions) {
    return presetOrOptions;
  }
  return presets.snappy;
}
function computeSpring(options) {
  let { duration: durationMs = 300, bounce = 0, velocity = 0 } = options;
  let durationSec = durationMs / 1e3;
  let omega0 = 2 * Math.PI / durationSec;
  bounce = Math.max(-1, Math.min(0.95, bounce));
  let zeta = bounce >= 0 ? 1 - bounce : 1 / (1 + bounce);
  let omega0Ms = omega0 / 1e3;
  let velocityMs = -velocity / 1e3;
  let position;
  if (zeta < 1) {
    let omegaD = omega0Ms * Math.sqrt(1 - zeta * zeta);
    position = (t) => {
      let envelope = Math.exp(-zeta * omega0Ms * t);
      return 1 - envelope * ((velocityMs + zeta * omega0Ms) / omegaD * Math.sin(omegaD * t) + Math.cos(omegaD * t));
    };
  } else if (zeta > 1) {
    let sqrtTerm = Math.sqrt(zeta * zeta - 1);
    let s1 = omega0Ms * (-zeta + sqrtTerm);
    let s2 = omega0Ms * (-zeta - sqrtTerm);
    let A2 = (s2 + velocityMs) / (s2 - s1);
    let B = 1 - A2;
    position = (t) => 1 - A2 * Math.exp(s1 * t) - B * Math.exp(s2 * t);
  } else {
    position = (t) => 1 - Math.exp(-omega0Ms * t) * (1 + (velocityMs + omega0Ms) * t);
  }
  let velocitySampleMs = 0.5;
  function velocityAt(t) {
    if (t < velocitySampleMs) {
      return (position(velocitySampleMs) - position(0)) / velocitySampleMs * 1e3;
    }
    return (position(t) - position(t - velocitySampleMs)) / velocitySampleMs * 1e3;
  }
  let settlingTime = maxSettlingTime;
  let step = 50;
  for (let t = 0; t < maxSettlingTime; t += step) {
    let pos = position(t);
    let vel = Math.abs(velocityAt(t));
    let displacement = Math.abs(1 - pos);
    if (vel <= restSpeed && displacement <= restDelta) {
      settlingTime = t;
      break;
    }
  }
  let easing = generateEasing(position, settlingTime);
  return { position, settlingTime, easing };
}
function generateEasing(position, settlingTime) {
  let points = adaptiveSample(position, settlingTime);
  return `linear(${points.map((p, i) => {
    let isLast = i === points.length - 1;
    let value = isLast ? 1 : Math.round(p.value * 1e4) / 1e4;
    if (i === 0 || isLast) {
      return value === 1 ? "1" : value.toString();
    }
    let percent = Math.round(p.t / settlingTime * 1e3) / 10;
    return `${value} ${percent}%`;
  }).join(", ")})`;
}
function adaptiveSample(resolve, duration, tolerance = 2e-3, minSegment = 8) {
  let points = [];
  function addPoint(t, value) {
    if (points.length === 0 || points[points.length - 1].t < t) {
      points.push({ t, value });
    }
  }
  function subdivide(t0, v0, t1, v1, depth = 0) {
    if (depth > 12) {
      addPoint(t0, v0);
      return;
    }
    let tMid = (t0 + t1) / 2;
    let vMid = resolve(tMid);
    let vLinear = (v0 + v1) / 2;
    let error = Math.abs(vMid - vLinear);
    if (error > tolerance && t1 - t0 > minSegment) {
      subdivide(t0, v0, tMid, vMid, depth + 1);
      subdivide(tMid, vMid, t1, v1, depth + 1);
    } else {
      addPoint(t0, v0);
    }
  }
  subdivide(0, resolve(0), duration, resolve(duration));
  addPoint(duration, resolve(duration));
  return points;
}

// index.tsx
var name = "remix";
function Button() {
  return ({ id, text, fn }) => /* @__PURE__ */ jsx("div", { class: "col-sm-6 smallpad", children: /* @__PURE__ */ jsx("button", { id, class: "btn btn-primary btn-block", type: "button", on: { click: fn }, children: text }) });
}
function MetricCard(handle) {
  let selected = false;
  let hovered = false;
  return ({
    id,
    label,
    value,
    change
  }) => /* @__PURE__ */ jsx(
    "div",
    {
      class: `metric-card ${selected ? "selected" : ""}`,
      on: {
        click: () => {
          selected = !selected;
          handle.update();
        },
        mouseenter: () => {
          hovered = true;
          handle.update();
        },
        mouseleave: () => {
          hovered = false;
          handle.update();
        },
        focus: (e) => {
          e.currentTarget.style.outline = "2px solid #222";
          e.currentTarget.style.outlineOffset = "2px";
        },
        blur: (e) => {
          e.currentTarget.style.outline = "";
        }
      },
      tabIndex: 0,
      style: {
        backgroundColor: hovered ? "#f5f5f5" : "#fff",
        transform: hovered && !selected ? "translateY(-2px)" : "translateY(0)",
        transition: "all 0.2s",
        padding: "20px",
        border: "1px solid #ddd",
        borderRadius: "8px",
        cursor: "pointer",
        boxShadow: selected ? "0 4px 8px rgba(0,0,0,0.1)" : "0 2px 4px rgba(0,0,0,0.05)"
      },
      children: [
        /* @__PURE__ */ jsx("div", { style: { fontSize: "14px", color: "#666", marginBottom: "8px" }, children: label }),
        /* @__PURE__ */ jsx("div", { style: { fontSize: "24px", fontWeight: "bold", marginBottom: "4px" }, children: value }),
        /* @__PURE__ */ jsx("div", { style: { fontSize: "12px", color: change.startsWith("+") ? "#28a745" : "#dc3545" }, children: change })
      ]
    }
  );
}
function ChartBar(handle) {
  let hovered = false;
  return ({ value, index }) => /* @__PURE__ */ jsx(
    "div",
    {
      class: "chart-bar",
      style: {
        height: `${value}%`,
        backgroundColor: hovered ? "#286090" : "#337ab7",
        width: "30px",
        margin: "0 2px",
        cursor: "pointer",
        transition: "all 0.2s",
        opacity: hovered ? 0.9 : 1,
        transform: hovered ? "scaleY(1.1)" : "scaleY(1)"
      },
      on: {
        click: () => {
        },
        mouseenter: () => {
          hovered = true;
          handle.update();
        },
        mouseleave: () => {
          hovered = false;
          handle.update();
        },
        focus: (e) => {
          e.currentTarget.style.outline = "2px solid #222";
          e.currentTarget.style.outlineOffset = "2px";
        },
        blur: (e) => {
          e.currentTarget.style.outline = "";
        }
      },
      tabIndex: 0
    }
  );
}
function ActivityItem(handle) {
  let read = false;
  let hovered = false;
  return ({ id, title, time, icon }) => /* @__PURE__ */ jsx(
    "li",
    {
      class: `activity-item ${read ? "read" : ""}`,
      on: {
        click: () => {
          read = !read;
          handle.update();
        },
        mouseenter: () => {
          hovered = true;
          handle.update();
        },
        mouseleave: () => {
          hovered = false;
          handle.update();
        }
      },
      style: {
        padding: "12px",
        borderBottom: "1px solid #eee",
        cursor: "pointer",
        backgroundColor: hovered ? "#f5f5f5" : read ? "rgba(245, 245, 245, 0.6)" : "#fff",
        display: "flex",
        alignItems: "center",
        gap: "12px"
      },
      children: [
        /* @__PURE__ */ jsx(
          "span",
          {
            style: {
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              backgroundColor: "#337ab7",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold"
            },
            children: icon
          }
        ),
        /* @__PURE__ */ jsx("div", { style: { flex: 1 }, children: [
          /* @__PURE__ */ jsx("div", { style: { fontWeight: read ? "normal" : "bold" }, children: title }),
          /* @__PURE__ */ jsx("div", { style: { fontSize: "12px", color: "#666" }, children: time })
        ] })
      ]
    }
  );
}
function DropdownMenu(handle) {
  let open = false;
  let hovered = false;
  let actions = ["View Details", "Edit", "Duplicate", "Archive", "Delete"];
  return ({ rowId }) => /* @__PURE__ */ jsx("div", { style: { position: "relative", display: "inline-block" }, children: [
    /* @__PURE__ */ jsx(
      "button",
      {
        class: "btn btn-primary",
        on: {
          click: (e) => {
            e.stopPropagation();
            open = !open;
            handle.update();
          },
          mouseenter: () => {
            hovered = true;
            handle.update();
          },
          mouseleave: () => {
            hovered = false;
            handle.update();
          },
          focus: (e) => {
            e.currentTarget.style.outline = "2px solid #222";
            e.currentTarget.style.outlineOffset = "2px";
          },
          blur: (e) => {
            e.currentTarget.style.outline = "";
          }
        },
        style: {
          padding: "4px 8px",
          fontSize: "12px",
          backgroundColor: hovered ? "#286090" : "#337ab7"
        },
        children: "\u22EE"
      }
    ),
    open && /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          position: "absolute",
          top: "100%",
          right: 0,
          backgroundColor: "#fff",
          border: "1px solid #ddd",
          borderRadius: "4px",
          boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
          zIndex: 1e3,
          minWidth: "150px",
          marginTop: "4px"
        },
        on: {
          mouseleave: () => {
            open = false;
            handle.update();
          }
        },
        children: actions.map((action, idx) => /* @__PURE__ */ jsx(
          "div",
          {
            on: {
              click: (e) => {
                e.stopPropagation();
                open = false;
                handle.update();
              },
              mouseenter: (e) => {
                e.currentTarget.style.backgroundColor = "#f5f5f5";
              },
              mouseleave: (e) => {
                e.currentTarget.style.backgroundColor = "#fff";
              }
            },
            style: {
              padding: "8px 12px",
              cursor: "pointer",
              borderBottom: idx < actions.length - 1 ? "1px solid #eee" : "none"
            },
            children: action
          },
          idx
        ))
      }
    )
  ] });
}
function DashboardTableRow(handle) {
  let hovered = false;
  let selected = false;
  return ({ row }) => /* @__PURE__ */ jsx(
    "tr",
    {
      class: selected ? "danger" : "",
      on: {
        click: () => {
          selected = !selected;
          handle.update();
        },
        mouseenter: () => {
          hovered = true;
          handle.update();
        },
        mouseleave: () => {
          hovered = false;
          handle.update();
        }
      },
      style: {
        backgroundColor: hovered ? "#f5f5f5" : "#fff",
        cursor: "pointer"
      },
      children: [
        /* @__PURE__ */ jsx("td", { style: { padding: "12px", borderTop: "1px solid #ddd" }, children: row.id }),
        /* @__PURE__ */ jsx("td", { style: { padding: "12px", borderTop: "1px solid #ddd" }, children: row.label }),
        /* @__PURE__ */ jsx("td", { style: { padding: "12px", borderTop: "1px solid #ddd" }, children: /* @__PURE__ */ jsx("span", { style: { color: "#28a745" }, children: "Active" }) }),
        /* @__PURE__ */ jsx("td", { style: { padding: "12px", borderTop: "1px solid #ddd" }, children: [
          "$",
          (row.id * 10.5).toFixed(2)
        ] }),
        /* @__PURE__ */ jsx("td", { style: { padding: "12px", borderTop: "1px solid #ddd" }, children: /* @__PURE__ */ jsx(DropdownMenu, { rowId: row.id }) })
      ]
    }
  );
}
function SearchInput(handle) {
  let value = "";
  let focused = false;
  return () => /* @__PURE__ */ jsx(
    "input",
    {
      type: "text",
      placeholder: "Search...",
      value,
      on: {
        input: (e) => {
          value = e.target.value;
          handle.update();
        },
        focus: () => {
          focused = true;
          handle.update();
        },
        blur: () => {
          focused = false;
          handle.update();
        }
      },
      style: {
        padding: "8px 12px",
        border: `1px solid ${focused ? "#337ab7" : "#ddd"}`,
        borderRadius: "4px",
        fontSize: "14px",
        width: "300px",
        outline: focused ? "2px solid #337ab7" : "none",
        outlineOffset: "2px"
      }
    }
  );
}
function FormWidgets(handle) {
  let selectValue = "option1";
  let checkboxValues = /* @__PURE__ */ new Set();
  let radioValue = "radio1";
  let toggleValue = false;
  let progressValue = 45;
  return () => /* @__PURE__ */ jsx("div", { style: { padding: "20px", backgroundColor: "#f9f9f9", borderRadius: "8px" }, children: [
    /* @__PURE__ */ jsx("h3", { style: { marginTop: 0, marginBottom: "16px" }, children: "Settings" }),
    /* @__PURE__ */ jsx("div", { style: { marginBottom: "16px" }, children: [
      /* @__PURE__ */ jsx("label", { style: { display: "block", marginBottom: "4px", fontSize: "14px" }, children: "Select Option" }),
      /* @__PURE__ */ jsx(
        "select",
        {
          value: selectValue,
          on: {
            change: (e) => {
              selectValue = e.target.value;
              handle.update();
            },
            focus: (e) => {
              e.currentTarget.style.borderColor = "#337ab7";
              e.currentTarget.style.outline = "2px solid #337ab7";
              e.currentTarget.style.outlineOffset = "2px";
            },
            blur: (e) => {
              e.currentTarget.style.borderColor = "#ddd";
              e.currentTarget.style.outline = "none";
            }
          },
          style: {
            padding: "6px 12px",
            border: "1px solid #ddd",
            borderRadius: "4px",
            fontSize: "14px",
            width: "100%"
          },
          children: [
            /* @__PURE__ */ jsx("option", { value: "option1", children: "Option 1" }),
            /* @__PURE__ */ jsx("option", { value: "option2", children: "Option 2" }),
            /* @__PURE__ */ jsx("option", { value: "option3", children: "Option 3" }),
            /* @__PURE__ */ jsx("option", { value: "option4", children: "Option 4" })
          ]
        }
      )
    ] }),
    ["Checkbox 1", "Checkbox 2", "Checkbox 3"].map((label, idx) => /* @__PURE__ */ jsx(
      "div",
      {
        style: { marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" },
        children: [
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "checkbox",
              id: `checkbox-${idx}`,
              checked: checkboxValues.has(`checkbox-${idx}`),
              on: {
                change: (e) => {
                  if (e.target.checked) {
                    checkboxValues.add(`checkbox-${idx}`);
                  } else {
                    checkboxValues.delete(`checkbox-${idx}`);
                  }
                  handle.update();
                },
                focus: (e) => {
                  e.currentTarget.style.outline = "2px solid #337ab7";
                  e.currentTarget.style.outlineOffset = "2px";
                },
                blur: (e) => {
                  e.currentTarget.style.outline = "";
                }
              }
            }
          ),
          /* @__PURE__ */ jsx("label", { for: `checkbox-${idx}`, style: { fontSize: "14px", cursor: "pointer" }, children: label })
        ]
      },
      idx
    )),
    /* @__PURE__ */ jsx("div", { style: { marginBottom: "16px" }, children: ["Radio 1", "Radio 2", "Radio 3"].map((label, idx) => /* @__PURE__ */ jsx("label", { style: { display: "block", marginBottom: "8px", cursor: "pointer" }, children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "radio",
          name: "radio-group",
          value: `radio${idx + 1}`,
          checked: radioValue === `radio${idx + 1}`,
          on: {
            change: (e) => {
              radioValue = e.target.value;
              handle.update();
            },
            focus: (e) => {
              e.currentTarget.style.outline = "2px solid #337ab7";
              e.currentTarget.style.outlineOffset = "2px";
            },
            blur: (e) => {
              e.currentTarget.style.outline = "";
            }
          },
          style: { marginRight: "8px" }
        }
      ),
      label
    ] }, idx)) }),
    /* @__PURE__ */ jsx("div", { style: { marginBottom: "16px" }, children: [
      /* @__PURE__ */ jsx("label", { style: { display: "block", marginBottom: "4px", fontSize: "14px" }, children: "Toggle Switch" }),
      /* @__PURE__ */ jsx(
        "label",
        {
          style: {
            display: "inline-block",
            position: "relative",
            width: "50px",
            height: "24px",
            cursor: "pointer"
          },
          children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "checkbox",
                checked: toggleValue,
                on: {
                  change: (e) => {
                    toggleValue = e.target.checked;
                    handle.update();
                  },
                  focus: (e) => {
                    e.currentTarget.style.outline = "2px solid #222";
                    e.currentTarget.style.outlineOffset = "2px";
                  },
                  blur: (e) => {
                    e.currentTarget.style.outline = "";
                  }
                },
                style: { opacity: 0, width: 0, height: 0 }
              }
            ),
            /* @__PURE__ */ jsx(
              "span",
              {
                style: {
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: toggleValue ? "#337ab7" : "#ccc",
                  borderRadius: "24px",
                  transition: "background-color 0.3s"
                },
                children: /* @__PURE__ */ jsx(
                  "span",
                  {
                    style: {
                      position: "absolute",
                      content: '""',
                      height: "18px",
                      width: "18px",
                      left: "3px",
                      bottom: "3px",
                      backgroundColor: "#fff",
                      borderRadius: "50%",
                      transition: "transform 0.3s",
                      transform: toggleValue ? "translateX(26px)" : "translateX(0)"
                    }
                  }
                )
              }
            )
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsx("div", { children: [
      /* @__PURE__ */ jsx("label", { style: { display: "block", marginBottom: "4px", fontSize: "14px" }, children: "Progress Bar" }),
      /* @__PURE__ */ jsx(
        "div",
        {
          style: {
            width: "100%",
            height: "24px",
            backgroundColor: "#eee",
            borderRadius: "4px",
            overflow: "hidden",
            position: "relative"
          },
          children: /* @__PURE__ */ jsx(
            "div",
            {
              style: {
                width: `${progressValue}%`,
                height: "100%",
                backgroundColor: "#337ab7",
                transition: "width 0.3s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: "12px"
              },
              children: [
                progressValue,
                "%"
              ]
            }
          )
        }
      )
    ] })
  ] });
}
function Dashboard(handle) {
  let dashboardRows = buildData(300);
  let sortDashboardAsc = () => {
    dashboardRows = sortRows(dashboardRows, true);
    handle.update();
  };
  let sortDashboardDesc = () => {
    dashboardRows = sortRows(dashboardRows, false);
    handle.update();
  };
  let chartData = [65, 45, 78, 52, 89, 34, 67, 91, 43, 56, 72, 38, 55, 82, 47, 63, 71, 39, 58, 84];
  let activities = Array.from({ length: 50 }, (_, i) => ({
    id: i + 1,
    title: `Activity ${i + 1}: ${["Order placed", "Payment received", "Shipment created", "Customer registered", "Product updated"][i % 5]}`,
    time: `${i + 1} ${i === 0 ? "minute" : "minutes"} ago`,
    icon: ["O", "P", "S", "C", "U"][i % 5]
  }));
  return ({ onSwitchToTable }) => /* @__PURE__ */ jsx("div", { class: "container", style: { maxWidth: "1400px" }, children: [
    /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          display: "flex",
          marginBottom: "20px",
          alignItems: "center",
          justifyContent: "space-between"
        },
        children: [
          /* @__PURE__ */ jsx("h1", { style: { margin: 0 }, children: "Dashboard" }),
          /* @__PURE__ */ jsx(
            "button",
            {
              id: "switchToTable",
              class: "btn btn-primary",
              type: "button",
              on: { click: onSwitchToTable },
              children: "Switch to Table"
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: "20px", marginBottom: "20px" }, children: /* @__PURE__ */ jsx("div", { style: { flex: 1, display: "flex", gap: "16px" }, children: [
      /* @__PURE__ */ jsx(MetricCard, { id: 1, label: "Total Sales", value: "$125,430", change: "+12.5%" }),
      /* @__PURE__ */ jsx(MetricCard, { id: 2, label: "Orders", value: "1,234", change: "+8.2%" }),
      /* @__PURE__ */ jsx(MetricCard, { id: 3, label: "Customers", value: "5,678", change: "+15.3%" }),
      /* @__PURE__ */ jsx(MetricCard, { id: 4, label: "Revenue", value: "$89,123", change: "+9.7%" })
    ] }) }),
    /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
          marginBottom: "20px"
        },
        children: [
          /* @__PURE__ */ jsx(
            "div",
            {
              style: {
                padding: "20px",
                backgroundColor: "#fff",
                border: "1px solid #ddd",
                borderRadius: "8px"
              },
              children: [
                /* @__PURE__ */ jsx("h3", { style: { marginTop: 0, marginBottom: "16px" }, children: "Sales Performance" }),
                /* @__PURE__ */ jsx(
                  "div",
                  {
                    style: {
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "space-around",
                      height: "200px",
                      padding: "20px 0"
                    },
                    children: chartData.map((value, index) => /* @__PURE__ */ jsx(ChartBar, { value, index }, index))
                  }
                )
              ]
            }
          ),
          /* @__PURE__ */ jsx(
            "div",
            {
              style: {
                padding: "20px",
                backgroundColor: "#fff",
                border: "1px solid #ddd",
                borderRadius: "8px"
              },
              children: [
                /* @__PURE__ */ jsx("h3", { style: { marginTop: 0, marginBottom: "16px" }, children: "Recent Activity" }),
                /* @__PURE__ */ jsx(
                  "ul",
                  {
                    style: {
                      listStyle: "none",
                      padding: 0,
                      margin: 0,
                      maxHeight: "200px",
                      overflowY: "auto"
                    },
                    children: activities.map((activity) => /* @__PURE__ */ jsx(ActivityItem, { ...activity }, activity.id))
                  }
                )
              ]
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsx("div", { style: { marginBottom: "20px" }, children: [
      /* @__PURE__ */ jsx(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px"
          },
          children: [
            /* @__PURE__ */ jsx("div", { style: { display: "flex", alignItems: "center", gap: "12px" }, children: [
              /* @__PURE__ */ jsx("h3", { style: { margin: 0 }, children: "Dashboard Items" }),
              /* @__PURE__ */ jsx(
                "button",
                {
                  id: "sortDashboardAsc",
                  class: "btn btn-primary",
                  type: "button",
                  on: { click: sortDashboardAsc },
                  style: { padding: "4px 8px", fontSize: "12px" },
                  children: "Sort \u2191"
                }
              ),
              /* @__PURE__ */ jsx(
                "button",
                {
                  id: "sortDashboardDesc",
                  class: "btn btn-primary",
                  type: "button",
                  on: { click: sortDashboardDesc },
                  style: { padding: "4px 8px", fontSize: "12px" },
                  children: "Sort \u2193"
                }
              )
            ] }),
            /* @__PURE__ */ jsx(SearchInput, {})
          ]
        }
      ),
      /* @__PURE__ */ jsx(
        "div",
        {
          style: {
            backgroundColor: "#fff",
            border: "1px solid #ddd",
            borderRadius: "8px",
            overflow: "hidden"
          },
          children: /* @__PURE__ */ jsx("table", { style: { width: "100%", borderCollapse: "collapse" }, children: [
            /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsx("tr", { style: { backgroundColor: "#f5f5f5" }, children: [
              /* @__PURE__ */ jsx("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" }, children: "ID" }),
              /* @__PURE__ */ jsx("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" }, children: "Label" }),
              /* @__PURE__ */ jsx("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" }, children: "Status" }),
              /* @__PURE__ */ jsx("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" }, children: "Value" }),
              /* @__PURE__ */ jsx("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" }, children: "Actions" })
            ] }) }),
            /* @__PURE__ */ jsx("tbody", { children: dashboardRows.map((row) => /* @__PURE__ */ jsx(DashboardTableRow, { row }, row.id)) })
          ] })
        }
      )
    ] }),
    /* @__PURE__ */ jsx(FormWidgets, {})
  ] });
}
function App(handle) {
  let rows = [];
  let selected = null;
  let view = "table";
  let setRows = (newRows) => {
    rows = newRows;
    handle.update();
  };
  let setSelected = (newSelected) => {
    selected = newSelected;
    handle.update();
  };
  let switchToDashboard = () => {
    view = "dashboard";
    handle.update();
  };
  let switchToTable = () => {
    view = "table";
    handle.update();
  };
  return () => {
    if (view === "dashboard") {
      return /* @__PURE__ */ jsx(Dashboard, { onSwitchToTable: switchToTable });
    }
    return /* @__PURE__ */ jsx("div", { class: "container", children: [
      /* @__PURE__ */ jsx("div", { class: "jumbotron", children: /* @__PURE__ */ jsx("div", { class: "row", children: [
        /* @__PURE__ */ jsx("div", { class: "col-md-6", children: /* @__PURE__ */ jsx("h1", { children: "Remix" }) }),
        /* @__PURE__ */ jsx("div", { class: "col-md-6", children: /* @__PURE__ */ jsx("div", { class: "row", children: [
          /* @__PURE__ */ jsx(
            Button,
            {
              id: "run",
              text: "Create 1,000 rows",
              fn: () => {
                rows = get1000Rows();
                selected = null;
                handle.update();
              }
            }
          ),
          /* @__PURE__ */ jsx(
            Button,
            {
              id: "runlots",
              text: "Create 10,000 rows",
              fn: () => {
                rows = get10000Rows();
                selected = null;
                handle.update();
              }
            }
          ),
          /* @__PURE__ */ jsx(
            Button,
            {
              id: "add",
              text: "Append 1,000 rows",
              fn: () => {
                setRows([...rows, ...get1000Rows()]);
              }
            }
          ),
          /* @__PURE__ */ jsx(
            Button,
            {
              id: "update",
              text: "Update every 10th row",
              fn: () => {
                setRows(updatedEvery10thRow(rows));
              }
            }
          ),
          /* @__PURE__ */ jsx(
            Button,
            {
              id: "clear",
              text: "Clear",
              fn: () => {
                rows = [];
                selected = null;
                handle.update();
              }
            }
          ),
          /* @__PURE__ */ jsx(
            Button,
            {
              id: "swaprows",
              text: "Swap Rows",
              fn: () => {
                setRows(swapRows(rows));
              }
            }
          ),
          /* @__PURE__ */ jsx(
            Button,
            {
              id: "sortasc",
              text: "Sort Ascending",
              fn: () => {
                setRows(sortRows(rows, true));
              }
            }
          ),
          /* @__PURE__ */ jsx(
            Button,
            {
              id: "sortdesc",
              text: "Sort Descending",
              fn: () => {
                setRows(sortRows(rows, false));
              }
            }
          ),
          /* @__PURE__ */ jsx(Button, { id: "switchToDashboard", text: "Switch to Dashboard", fn: switchToDashboard })
        ] }) })
      ] }) }),
      /* @__PURE__ */ jsx("table", { class: "table table-hover table-striped test-data", children: /* @__PURE__ */ jsx("tbody", { children: rows.map((row) => {
        let rowId = row.id;
        return /* @__PURE__ */ jsx("tr", { class: selected === rowId ? "danger" : "", children: [
          /* @__PURE__ */ jsx("td", { class: "col-md-1", children: rowId }),
          /* @__PURE__ */ jsx("td", { class: "col-md-4", children: /* @__PURE__ */ jsx(
            "a",
            {
              on: {
                click: () => {
                  setSelected(rowId);
                }
              },
              children: row.label
            }
          ) }),
          /* @__PURE__ */ jsx("td", { class: "col-md-1", children: /* @__PURE__ */ jsx(
            "a",
            {
              on: {
                click: () => {
                  setRows(remove(rows, rowId));
                }
              },
              children: /* @__PURE__ */ jsx("span", { class: "glyphicon glyphicon-remove", "aria-hidden": "true" })
            }
          ) }),
          /* @__PURE__ */ jsx("td", { class: "col-md-6" })
        ] }, rowId);
      }) }) }),
      /* @__PURE__ */ jsx("span", { class: "preloadicon glyphicon glyphicon-remove", "aria-hidden": "true" })
    ] });
  };
}
var el = document.getElementById("app");
var root = createRoot(el);
root.render(/* @__PURE__ */ jsx(App, {}));
export {
  name
};

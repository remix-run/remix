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

// ../../../src/runtime/prefetch-links.ts
var pendingPrefetchLinks = /* @__PURE__ */ new WeakSet();

// ../../../src/runtime/core/vnode.ts
function createRemixElement(type, props, key) {
  return {
    $rmx: true,
    key,
    props: normalizeElementProps(props),
    type
  };
}
function isRemixElement(node) {
  if (typeof node !== "object" || node === null) return false;
  let type = Reflect.get(node, "type");
  let props = Reflect.get(node, "props");
  return Reflect.get(node, "$rmx") === true && (typeof type === "string" || typeof type === "function") && typeof props === "object" && props !== null;
}
function normalizeElementProps(props) {
  if (!props) return {};
  if (!("mix" in props)) return props;
  if (isNormalizedMix(props.mix)) return props;
  let { mix, ...rest } = props;
  let normalizedMix = normalizeMixValue(mix);
  return normalizedMix === void 0 ? rest : { ...rest, mix: normalizedMix };
}
function isNormalizedMix(mix) {
  if (!Array.isArray(mix) || mix.length === 0) return false;
  for (let i = 0; i < mix.length; i++) {
    let item = mix[i];
    if (!item || Array.isArray(item)) return false;
  }
  return true;
}
function normalizeMixValue(mix) {
  if (!mix) return void 0;
  let normalizedMix = [];
  flattenMixValue(mix, normalizedMix);
  return normalizedMix.length === 0 ? void 0 : normalizedMix;
}
function flattenMixValue(mix, out) {
  if (!mix) return;
  if (!Array.isArray(mix)) {
    out.push(mix);
    return;
  }
  for (let item of mix) {
    flattenMixValue(item, out);
  }
}

// ../../../src/runtime/jsx.ts
function jsx(type, props, key) {
  return createRemixElement(type, props, key);
}

// ../../../src/runtime/typed-event-target.ts
var TypedEventTarget = class extends EventTarget {
};

// ../../../src/runtime/component.ts
function createComponent(config) {
  return new ComponentRuntime(config);
}
var ComponentRuntime = class {
  frame;
  #config;
  #connectedController;
  #contextValue;
  #handle;
  #props = {};
  #renderController;
  #renderFn;
  #removed = false;
  #phase = "idle";
  // The schedule target is stored as fields (updated each render) rather than
  // a closure so re-renders don't allocate a new function per component.
  #updateQueue;
  #updateVNode;
  #updateDomParent;
  #scheduleUpdate = () => {
    let queue = this.#updateQueue;
    if (!queue) throw new Error("scheduleUpdate not implemented");
    let vnode = this.#updateVNode;
    let domParent = this.#updateDomParent;
    if (!vnode || !domParent) throw new Error("scheduleUpdate target not initialized");
    queue.enqueue(vnode, domParent);
  };
  #tasks = [];
  constructor(config) {
    this.#config = config;
    this.frame = config.frame;
    this.#handle = this.#createHandle();
  }
  render = (nextProps) => {
    if (this.#removed) {
      console.warn("render called after component was removed, potential application memory leak");
      return [null, []];
    }
    this.#abortRenderSignal();
    syncProps(this.#props, nextProps);
    let renderFn = this.#renderFn;
    if (renderFn === void 0) {
      let initialize = this.#config.type;
      let result;
      this.#phase = "setup";
      try {
        result = initialize(this.#handle);
      } finally {
        this.#phase = "idle";
      }
      if (!isRenderFn(result)) {
        let name2 = this.#config.type.name || "Anonymous";
        throw new Error(`${name2} must return a render function, received ${typeof result}`);
      }
      renderFn = result;
      this.#renderFn = renderFn;
    }
    let element;
    this.#phase = "render";
    try {
      element = renderFn();
    } finally {
      this.#phase = "idle";
    }
    return [element, this.#dequeueTasks()];
  };
  remove = () => {
    if (this.#removed) return EMPTY_TASKS;
    this.#removed = true;
    this.#connectedController?.abort();
    this.#abortRenderSignal();
    if (this.#tasks.length === 0) return EMPTY_TASKS;
    return this.#dequeueTasks(sharedAbortedSignal ??= AbortSignal.abort());
  };
  setScheduleUpdate = (queue, vnode, domParent) => {
    this.#updateQueue = queue;
    this.#updateVNode = vnode;
    this.#updateDomParent = domParent;
  };
  getContextValue = () => this.#contextValue;
  isRemoved = () => this.#removed;
  #createHandle() {
    let component = this;
    let context = {
      set: (value) => {
        this.#contextValue = value;
      },
      get: (type) => isElementFunction(type) ? this.#config.getContext(type) : void 0
    };
    return {
      id: this.#config.id,
      props: this.#props,
      update: () => {
        if (component.#removed) return Promise.resolve(AbortSignal.abort());
        let name2 = component.#config.type.name || "Anonymous";
        if (component.#phase === "setup") {
          console.warn(
            `Ignored handle.update() while ${name2} is running its setup function. The initial render includes setup changes.`
          );
          return new Promise((resolve) => {
            this.#tasks.push((signal) => resolve(signal));
          });
        }
        if (component.#phase !== "idle") {
          throw new Error(
            `Cannot call handle.update() while ${name2} is running its ${component.#phase} function. Call it from an event handler or handle.queueTask() instead.`
          );
        }
        if (component.#updateQueue === void 0) {
          throw new Error(
            `Cannot call handle.update() before ${name2}'s initial render commits. Call it from an event handler or handle.queueTask() instead.`
          );
        }
        return new Promise((resolve) => {
          this.#tasks.push((signal) => resolve(signal));
          this.#scheduleUpdate();
        });
      },
      queueTask: (task) => {
        this.#tasks.push(task);
      },
      frame: this.#config.frame,
      frames: {
        get top() {
          return component.#config.getTopFrame?.() ?? component.#config.frame;
        },
        get(name2) {
          return component.#config.getFrameByName(name2);
        }
      },
      context,
      get signal() {
        return component.#config.signal ?? component.#connectedSignal();
      }
    };
  }
  #connectedSignal() {
    this.#connectedController ??= new AbortController();
    return this.#connectedController.signal;
  }
  #abortRenderSignal() {
    this.#renderController?.abort();
    this.#renderController = void 0;
  }
  #dequeueTasks(signal) {
    if (this.#tasks.length === 0) return EMPTY_TASKS;
    let needsSignal = signal === void 0 && this.#tasks.some((task) => task.length >= 1);
    if (needsSignal) {
      this.#renderController ??= new AbortController();
    }
    signal ??= this.#renderController?.signal;
    signal ??= sharedAbortedSignal ??= AbortSignal.abort();
    let tasks = this.#tasks.splice(0, this.#tasks.length);
    return tasks.map((task) => () => task(signal));
  }
};
function isRenderFn(value) {
  return typeof value === "function";
}
function isElementFunction(value) {
  return typeof value === "function";
}
var EMPTY_TASKS = [];
var sharedAbortedSignal;
function syncProps(target, next) {
  for (let key in target) {
    if (!(key in next)) {
      delete target[key];
    }
  }
  for (let key in next) {
    target[key] = next[key];
  }
}
function Frame(handle) {
  void handle;
  return () => null;
}
function Fragment(handle) {
  void handle;
  return () => null;
}
function createFrameHandle(def) {
  return Object.assign(
    new TypedEventTarget(),
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

// ../../../src/runtime/error-event.ts
function createComponentErrorEvent(error) {
  return new ErrorEvent("error", { error });
}
function getComponentError(event) {
  return event.error;
}

// ../../../src/runtime/invariant.ts
function invariant(assertion, message) {
  let prefix = "Framework invariant";
  if (assertion) return;
  throw new Error(message ? `${prefix}: ${message}` : prefix);
}

// ../../../src/runtime/document-state.ts
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

// ../../../src/runtime/vnode.ts
var TEXT_NODE = /* @__PURE__ */ Symbol("TEXT_NODE");
var NON_RENDER_NODE = /* @__PURE__ */ Symbol("NON_RENDER_NODE");
var ROOT_VNODE = /* @__PURE__ */ Symbol("ROOT_VNODE");
function isFragmentNode(node) {
  return node.kind === "fragment";
}
function isCommittedTextNode(node) {
  return node.kind === "text";
}
function isCommittedHostNode(node) {
  return node.kind === "host";
}
function isCommittedComponentNode(node) {
  return node.kind === "component" && "_content" in node;
}
function isCommittedClientEntryNode(node) {
  return node.kind === "client-entry";
}
function findContextFromAncestry(node, type) {
  let current = node;
  while (current) {
    if (current.kind === "component" && current.type === type) {
      return current._handle.getContextValue();
    }
    if (current.kind === "root") {
      return current._getContext?.(type);
    }
    current = "_parent" in current ? current._parent : void 0;
  }
  return void 0;
}

// ../../../src/runtime/spa-response.ts
var spaResponses;
function getSpaResponseData(response) {
  return spaResponses?.get(response);
}

// ../../../src/runtime/frame-resolution.ts
async function unwrapFrameResolution(resolution) {
  if (!(resolution instanceof Response)) return { content: resolution };
  let data = getSpaResponseData(resolution);
  if (data) {
    return {
      content: data.node,
      redirectedTo: data.redirectedTo
    };
  }
  let content = resolution.body ?? await resolution.text();
  return {
    content,
    redirectedTo: resolution.redirected && resolution.url ? resolution.url : void 0
  };
}

// ../../../src/style/style.ts
var CAMEL_TO_KEBAB_CACHE_LIMIT = 256;
var camelToKebabCache = /* @__PURE__ */ new Map();
function camelToKebab(str) {
  if (str.startsWith("--")) return str;
  let cached = camelToKebabCache.get(str);
  if (cached === void 0) {
    cached = str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).replace(/^(webkit|moz|ms|o)-/, "-$1-");
    if (camelToKebabCache.size >= CAMEL_TO_KEBAB_CACHE_LIMIT) {
      let oldest = camelToKebabCache.keys().next();
      if (!oldest.done) camelToKebabCache.delete(oldest.value);
    }
    camelToKebabCache.set(str, cached);
  }
  return cached;
}
var NUMERIC_CSS_PROP = new RegExp(
  "^(?:-(?:webkit|moz|ms|o)-)?(?:animation(?:-iteration-count)?|aspect-ratio|bookmark-level|(?:border-image|mask-border|mask-box-image)(?:-outset|-slice|-width)?|box-(?:flex|flex-group|ordinal-group)|column(?:s|-count|-span)|flex(?:-grow|-line-count|-negative|-order|-positive|-shrink)?|float-defer|font-(?:size-adjust|weight)|force-broken-image-icon|grid-(?:area|(?:column|row)(?:-end|-span|-start)?)|hyphenate-limit-(?:chars|lines)|initial-letter|line-(?:clamp|height)|math-depth|max-lines|opacity|order|orphans|reading-order|scale|shape-image-threshold|tab-size|voice-balance|widows|z-index|zoom|(?:fill|flood|stop|stroke)-opacity|stroke-(?:dasharray|dashoffset|miterlimit|width))$"
);
function normalizeCssValue(key, value) {
  if (value == null) return void 0;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return void 0;
    if (value !== 0 && !key.startsWith("--") && !NUMERIC_CSS_PROP.test(camelToKebab(key))) {
      return `${value}px`;
    }
  }
  return String(value);
}
function isComplexSelector(key) {
  return /^[&@:.[]/.test(key);
}
function isKeyframesAtRule(key) {
  return /^@(?:-(?:webkit|moz|o)-)?keyframes/.test(key.toLowerCase());
}
function hashStyle(obj) {
  let sortedEntries = Object.entries(obj).filter(([, value]) => value !== void 0).sort(([a], [b]) => a.localeCompare(b));
  let str = JSON.stringify(sortedEntries);
  let h1 = 2166136261;
  let h2 = 3421674724;
  for (let i = 0; i < str.length; i++) {
    let char = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ char, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ char, 16777619) >>> 0;
  }
  return h1.toString(36) + h2.toString(36);
}
function styleToCss(styles, selector) {
  let preludeAtRules = [];
  let atRules = [];
  let body = styleBodyToCss(styles, "  ", (key, record) => {
    if (!key.startsWith("@")) return nestedRuleToCss(key, record, "  ");
    if (key.startsWith("@function")) {
      preludeAtRules.push(ruleToCss(key, indent(atRuleBodyToCss(record))));
    } else if (isKeyframesAtRule(key)) {
      preludeAtRules.push(ruleToCss(key, indent(keyframesBodyToCss(record))));
    } else {
      let inner = styleToCss(record, selector) || ruleToCss(selector, "");
      atRules.push(ruleToCss(key, indent(inner)));
    }
  });
  let rule = body ? [ruleToCss(selector, body)] : [];
  return [...preludeAtRules, ...rule, ...atRules].join("\n");
}
function styleBodyToCss(styles, pad, renderRule) {
  let declarations = [];
  let rules = [];
  for (let [key, value] of Object.entries(styles)) {
    if (isComplexSelector(key)) {
      let rule = isRecord(value) ? renderRule?.(key, value) : void 0;
      if (rule) rules.push(rule);
    } else {
      let normalizedValue = normalizeCssValue(key, value);
      if (normalizedValue !== void 0) {
        declarations.push(`${pad}${camelToKebab(key)}: ${normalizedValue};`);
      }
    }
  }
  return [...declarations, ...rules].join("\n");
}
function nestedRuleToCss(key, styles, pad) {
  let bodyPad = pad + "  ";
  let body = styleBodyToCss(
    styles,
    bodyPad,
    (nestedKey, record) => nestedRuleToCss(nestedKey, record, bodyPad)
  );
  if (body) return `${pad}${key} {
${body}
${pad}}`;
}
function ruleToCss(selector, body) {
  return body ? `${selector} {
${body}
}` : `${selector} {
}`;
}
function indent(text) {
  return text.split("\n").map((line) => line.length ? "  " + line : line).join("\n");
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function keyframesBodyToCss(frames) {
  let blocks = [];
  for (let [frameSelector, frameValue] of Object.entries(frames)) {
    if (isRecord(frameValue)) {
      blocks.push(ruleToCss(frameSelector, styleBodyToCss(frameValue, "  ")));
    }
  }
  return blocks.join("\n");
}
function atRuleBodyToCss(styles) {
  return styleBodyToCss(
    styles,
    "  ",
    (key, record) => key.startsWith("@") ? ruleToCss(key, indent(atRuleBodyToCss(record))) : void 0
  );
}
function processStyleClass(styleObj, styleCache) {
  if (Object.keys(styleObj).length === 0) {
    return { selector: "", css: "" };
  }
  let hash = hashStyle(styleObj);
  let selector = `rmxc-${hash}`;
  let cached = styleCache.get(hash);
  if (cached) {
    return cached;
  }
  let css2 = styleToCss(styleObj, `.${selector}`);
  let result = { selector, css: css2 };
  styleCache.set(hash, result);
  return result;
}

// ../../../src/runtime/svg-attributes.ts
var XLINK_NS = "http://www.w3.org/1999/xlink";
var XML_NS = "http://www.w3.org/XML/1998/namespace";
var CANONICAL_CAMEL_SVG_ATTRS = /* @__PURE__ */ new Set([
  "accentHeight",
  "attributeName",
  "attributeType",
  "autoReverse",
  "baseFrequency",
  "baseProfile",
  "calcMode",
  "viewBox",
  "preserveAspectRatio",
  "externalResourcesRequired",
  "filterRes",
  "gradientUnits",
  "gradientTransform",
  "glyphRef",
  "kernelMatrix",
  "kernelUnitLength",
  "keyPoints",
  "keySplines",
  "keyTimes",
  "lengthAdjust",
  "limitingConeAngle",
  "markerHeight",
  "patternUnits",
  "patternContentUnits",
  "patternTransform",
  "markerWidth",
  "numOctaves",
  "pathLength",
  "pointsAtX",
  "pointsAtY",
  "pointsAtZ",
  "preserveAlpha",
  "clipPathUnits",
  "maskUnits",
  "maskContentUnits",
  "filterUnits",
  "primitiveUnits",
  "refX",
  "refY",
  "requiredExtensions",
  "requiredFeatures",
  "specularConstant",
  "specularExponent",
  "spreadMethod",
  "startOffset",
  "stdDeviation",
  "stitchTiles",
  "surfaceScale",
  "systemLanguage",
  "tableValues",
  "targetX",
  "targetY",
  "textLength",
  "viewTarget",
  "xChannelSelector",
  "yChannelSelector",
  "zoomAndPan",
  "edgeMode",
  "diffuseConstant",
  "markerUnits"
]);
var SVG_ATTR_ALIASES = /* @__PURE__ */ new Map();
for (let attr of CANONICAL_CAMEL_SVG_ATTRS) {
  SVG_ATTR_ALIASES.set(camelToKebab2(attr), attr);
}
var NAMESPACED_SVG_ATTR = /^(xlink|xmlns|xml)(?:[:-]([a-z]+)|([A-Z][a-z]+))$/;
var NAMESPACED_SVG_ATTRS = /* @__PURE__ */ new Set([
  "xlink:href",
  "xlink:actuate",
  "xlink:arcrole",
  "xlink:role",
  "xlink:show",
  "xlink:title",
  "xlink:type",
  "xml:base",
  "xml:lang",
  "xml:space",
  "xmlns:xlink"
]);
function normalizeSvgAttributeName(name2) {
  let alias = SVG_ATTR_ALIASES.get(name2);
  if (alias) return alias;
  if (CANONICAL_CAMEL_SVG_ATTRS.has(name2)) return name2;
  return camelToKebab2(name2);
}
function normalizeSvgAttribute(name2) {
  let match = NAMESPACED_SVG_ATTR.exec(name2);
  if (match) {
    let [, prefix, separatedName, camelName] = match;
    let attr = `${prefix}:${separatedName ?? camelName.toLowerCase()}`;
    if (NAMESPACED_SVG_ATTRS.has(attr)) {
      if (prefix === "xmlns") return { attr };
      return { ns: prefix === "xlink" ? XLINK_NS : XML_NS, attr };
    }
  }
  return { attr: normalizeSvgAttributeName(name2) };
}
function camelToKebab2(input) {
  return input.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/_/g, "-").toLowerCase();
}

// ../../../src/runtime/core/attributes.ts
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
  "popover",
  "translate"
]);
var BOOLEANISH_STRING_ATTRIBUTES = /* @__PURE__ */ new Set([
  "autoReverse",
  "contenteditable",
  "draggable",
  "externalResourcesRequired",
  "focusable",
  "preserveAlpha",
  "spellcheck"
]);
var BLOCKED_HOST_PROP_NAMES = /* @__PURE__ */ new Set(["__proto__", "outerHTML"]);
var UNSAFE_HOST_PROP_NAME = /^on|[\u0000\t\n\f\r "'/>=]/i;
var EXECUTABLE_URL_ATTRIBUTES = /* @__PURE__ */ new Set(["href", "src", "action", "formaction", "xlink:href"]);
var JAVASCRIPT_PROTOCOL = /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;
var BLOCKED_JAVASCRIPT_URL = "javascript:throw new Error('Remix has blocked a javascript: URL as a security precaution.')";
function isAllowedHostPropName(name2) {
  return name2.length > 0 && !UNSAFE_HOST_PROP_NAME.test(name2) && !BLOCKED_HOST_PROP_NAMES.has(name2);
}
function sanitizeUrlAttribute(tagName, attrName, value) {
  let isExecutableUrl = EXECUTABLE_URL_ATTRIBUTES.has(attrName) || attrName === "data" && tagName.toLowerCase() === "object";
  if (!isExecutableUrl) return value;
  return JAVASCRIPT_PROTOCOL.test(String(value)) ? BLOCKED_JAVASCRIPT_URL : value;
}
function canUseProperty(element, name2, isSvg, attr) {
  if (isSvg) return false;
  if (ATTRIBUTE_FALLBACK_NAMES.has(name2)) return false;
  if (isBooleanishStringAttribute(attr)) return false;
  return name2 in element;
}
var NORMALIZATION_CACHE_LIMIT = 256;
var htmlAttributeNameCache = /* @__PURE__ */ new Map();
var svgAttributeNameCache = /* @__PURE__ */ new Map();
function normalizeAttributeName(name2, isSvg) {
  let cache = isSvg ? svgAttributeNameCache : htmlAttributeNameCache;
  let cached = cache.get(name2);
  if (cached === void 0) {
    cached = computeAttributeName(name2, isSvg);
    if (cache.size >= NORMALIZATION_CACHE_LIMIT) {
      let oldest = cache.keys().next();
      if (!oldest.done) cache.delete(oldest.value);
    }
    cache.set(name2, cached);
  }
  return cached;
}
function computeAttributeName(name2, isSvg) {
  if (name2.startsWith("aria-") || name2.startsWith("data-")) return { attr: name2 };
  if (name2 === "className") return { attr: "class" };
  if (!isSvg) {
    if (name2 === "htmlFor") return { attr: "for" };
    if (name2 === "tabIndex") return { attr: "tabindex" };
    if (name2 === "acceptCharset") return { attr: "accept-charset" };
    if (name2 === "httpEquiv") return { attr: "http-equiv" };
    return { attr: name2.toLowerCase() };
  }
  return normalizeSvgAttribute(name2);
}
function isBooleanishStringAttribute(name2) {
  return BOOLEANISH_STRING_ATTRIBUTES.has(name2);
}
function serializeStyleObject(style) {
  let parts = [];
  for (let [key, value] of Object.entries(style)) {
    let cssValue = styleValueToCss(key, value);
    if (cssValue === void 0) continue;
    parts.push(`${camelToKebab(key)}: ${cssValue};`);
  }
  return parts.join(" ");
}
function styleValueToCss(name2, value) {
  if (typeof value === "boolean") return void 0;
  if (Array.isArray(value)) return value.join(", ");
  return normalizeCssValue(name2, value);
}
function getMergedClassName(props) {
  let classAttr = typeof props.class === "string" ? props.class : "";
  let className = typeof props.className === "string" ? props.className : "";
  let merged = classAttr && className ? `${classAttr} ${className}` : classAttr || className;
  return merged || void 0;
}

// ../../../src/runtime/core/props.ts
var SVG_NS = "http://www.w3.org/2000/svg";
function isFrameworkProp(name2) {
  return name2 === "children" || name2 === "mix" || name2 === "key" || name2 === "animate" || name2 === "innerHTML" || name2 === "on";
}
function toLocalName(attrName) {
  let separatorIndex = attrName.indexOf(":");
  if (separatorIndex === -1) return attrName;
  return attrName.slice(separatorIndex + 1);
}
function clearRuntimePropertyOnRemoval(dom, name2) {
  try {
    if (name2 === "value" || name2 === "defaultValue") {
      dom[name2] = "";
      return;
    }
    if (name2 === "checked" || name2 === "defaultChecked" || name2 === "selected") {
      dom[name2] = false;
      return;
    }
    if (name2 === "selectedIndex") {
      dom[name2] = -1;
    }
  } catch {
  }
}
function patchHostProps(curr, next, dom) {
  let isSvg = dom.namespaceURI === SVG_NS;
  let currClassName = getMergedClassName(curr);
  let nextClassName = getMergedClassName(next);
  if (currClassName !== nextClassName) {
    if (nextClassName) {
      dom.setAttribute("class", nextClassName);
    } else {
      dom.removeAttribute("class");
    }
  }
  for (let name2 in curr) {
    if (isFrameworkProp(name2)) continue;
    if (!isAllowedHostPropName(name2)) continue;
    if (name2 === "class" || name2 === "className") continue;
    if (name2 in next && next[name2] != null) continue;
    let { ns, attr } = normalizeAttributeName(name2, isSvg);
    if (canUseProperty(dom, name2, isSvg, attr)) {
      clearRuntimePropertyOnRemoval(dom, name2);
    }
    if (ns) dom.removeAttributeNS(ns, toLocalName(attr));
    else dom.removeAttribute(attr);
  }
  for (let name2 in next) {
    if (isFrameworkProp(name2)) continue;
    if (!isAllowedHostPropName(name2)) continue;
    if (name2 === "class" || name2 === "className") continue;
    let nextValue = next[name2];
    if (nextValue == null) continue;
    let prevValue = curr[name2];
    if (prevValue === nextValue) continue;
    if (name2 === "style" && isStyleObject(nextValue)) {
      if (isStyleObject(prevValue)) {
        patchStyleObject(dom, prevValue, nextValue);
      } else {
        dom.removeAttribute("style");
        patchStyleObject(dom, void 0, nextValue);
      }
      continue;
    }
    patchHostProp(dom, name2, nextValue, isSvg);
  }
}
function patchHostProp(dom, name2, value, isSvg) {
  let { ns, attr } = normalizeAttributeName(name2, isSvg);
  value = sanitizeUrlAttribute(dom.localName, attr, value);
  if (attr === "style" && isStyleObject(value)) {
    patchStyleObject(dom, void 0, value);
    return;
  }
  if (attr === "style" && typeof value === "string") {
    dom.setAttribute("style", value);
    return;
  }
  if (canUseProperty(dom, name2, isSvg, attr)) {
    try {
      dom[name2] = value == null ? "" : value;
      return;
    } catch {
    }
  }
  if (typeof value === "function") return;
  let isAriaOrData = name2.startsWith("aria-") || name2.startsWith("data-");
  let isBooleanishString = isBooleanishStringAttribute(attr);
  if (value != null && (value !== false || isAriaOrData || isBooleanishString)) {
    let attrValue = name2 === "popover" && value === true ? "" : String(value);
    if (ns) dom.setAttributeNS(ns, attr, attrValue);
    else dom.setAttribute(attr, attrValue);
  } else {
    if (ns) dom.removeAttributeNS(ns, toLocalName(attr));
    else dom.removeAttribute(attr);
  }
}
function isStyleObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function patchStyleObject(dom, curr, next) {
  if (!(dom instanceof HTMLElement || dom instanceof SVGElement)) {
    dom.setAttribute("style", serializeStyleObject(next));
    return;
  }
  let style = dom.style;
  if (curr) {
    for (let name2 in curr) {
      let nextCssValue = styleValueToCss(name2, next[name2]);
      if (nextCssValue !== void 0) continue;
      let prevCssValue = styleValueToCss(name2, curr[name2]);
      if (prevCssValue === void 0) continue;
      style.removeProperty(camelToKebab(name2));
    }
  }
  for (let name2 in next) {
    let nextCssValue = styleValueToCss(name2, next[name2]);
    if (nextCssValue === void 0) continue;
    let prevCssValue = curr ? styleValueToCss(name2, curr[name2]) : void 0;
    if (prevCssValue === nextCssValue) continue;
    style.setProperty(camelToKebab(name2), nextCssValue);
  }
}

// ../../../src/runtime/client-entries.ts
function isEntry(component) {
  return Boolean(component && typeof component === "function" && component.$entry === true);
}
function logHydrationMismatch(...msg) {
  console.error("Hydration mismatch:", ...msg);
}
function skipComments(cursor) {
  while (cursor && cursor.nodeType === Node.COMMENT_NODE) {
    cursor = cursor.nextSibling;
  }
  return cursor;
}

// ../../../src/runtime/core/children.ts
function isEmptyChild(value) {
  return value == null || typeof value === "boolean";
}
function isPrimitiveChild(value) {
  let type = typeof value;
  return type === "string" || type === "number" || type === "bigint";
}
function normalizeChildren(children) {
  for (let i = 0; i < children.length; i++) {
    if (Array.isArray(children[i])) {
      return children.flat(Infinity);
    }
  }
  return children;
}
function isRemixNode(value) {
  if (value == null) return true;
  let type = typeof value;
  if (type === "string" || type === "number" || type === "bigint" || type === "boolean") {
    return true;
  }
  if (isRemixElement(value)) return true;
  if (!Array.isArray(value)) return false;
  for (let child of value) {
    if (!isRemixNode(child)) return false;
  }
  return true;
}

// ../../../src/runtime/core/mix.ts
var MAX_MIX_DESCRIPTORS = 1024;
function composeMixedProps(hostType, props, runDescriptor) {
  let descriptors = resolveMixDescriptors(props);
  let composedProps = withoutMix(props);
  let mixinProps;
  for (let index = 0; index < descriptors.length && index < MAX_MIX_DESCRIPTORS; index++) {
    mixinProps ??= withoutMixinContentProps(composedProps);
    let result = runDescriptor(descriptors[index], index, mixinProps);
    if (!result) continue;
    if (isMixinElementFunction(result)) continue;
    let returnedDescriptors = resolveReturnedMixDescriptors(result);
    if (returnedDescriptors) {
      for (let returned of returnedDescriptors) descriptors.push(returned);
      continue;
    }
    if (!isRemixElementResult(result)) {
      console.error(new Error("mixins must return a remix element"));
      continue;
    }
    let resultType = typeof result.type === "string" ? result.type : isMixinElementFunction(result.type) ? result.type.__rmxMixinElementType : null;
    if (resultType !== hostType) {
      console.error(new Error("mixins must return an element with the same host type"));
      continue;
    }
    let nextProps = sanitizeReturnedMixinProps(result.props);
    for (let nested of resolveMixDescriptors(nextProps)) descriptors.push(nested);
    composedProps = { ...composedProps, ...withoutMix(nextProps) };
    mixinProps = void 0;
  }
  let nextMix = props.mix;
  if (nextMix !== void 0 && composedProps === mixinProps) {
    return { ...composedProps, mix: nextMix };
  }
  if (nextMix !== void 0) composedProps.mix = nextMix;
  return composedProps;
}
function resolveMixDescriptors(props) {
  let mix = props.mix;
  if (!mix) return [];
  if (Array.isArray(mix)) {
    if (mix.length === 0) return [];
    return mix.filter(Boolean);
  }
  return [mix];
}
function withoutMix(props) {
  if (!("mix" in props)) return props;
  let { mix: _mix, ...output } = props;
  return output;
}
function withoutMixinContentProps(props) {
  if (!hasMixinContentProps(props)) return props;
  let {
    children: _children,
    innerHTML: _innerHTML,
    srcDoc: _srcDoc,
    srcdoc: _srcdoc,
    outerHTML: _outerHTML,
    ...output
  } = props;
  return output;
}
function sanitizeReturnedMixinProps(props) {
  if (!hasMixinContentProps(props)) return props;
  console.error(new Error("mixins must not return children or raw HTML props"));
  return withoutMixinContentProps(props);
}
function hasMixinContentProps(props) {
  return "children" in props || "innerHTML" in props || "srcDoc" in props || "srcdoc" in props || "outerHTML" in props;
}
function isMixinDescriptor(value) {
  if (!value || typeof value !== "object" || isRemixElementResult(value)) {
    return false;
  }
  let descriptor = value;
  return typeof descriptor.type === "function" && Array.isArray(descriptor.args);
}
function isMixinElementFunction(value) {
  if (typeof value !== "function") return false;
  return "__rmxMixinElementType" in value;
}
function isRemixElementResult(value) {
  if (!value || typeof value !== "object") return false;
  return value.$rmx === true;
}
function resolveReturnedMixDescriptors(value) {
  let descriptors = [];
  if (!collectReturnedMixDescriptors(value, descriptors)) {
    return null;
  }
  return descriptors;
}
function collectReturnedMixDescriptors(value, output) {
  if (!value) {
    return true;
  }
  if (Array.isArray(value)) {
    for (let item of value) {
      if (!collectReturnedMixDescriptors(item, output)) {
        return false;
      }
    }
    return true;
  }
  if (!isMixinDescriptor(value)) {
    return false;
  }
  output.push(value);
  return true;
}

// ../../../src/runtime/unsafe-html.ts
var UnsafeHTMLValue = class {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static read(value) {
    return value.#value;
  }
};
function readUnsafeHTML(value) {
  return value instanceof UnsafeHTMLValue ? UnsafeHTMLValue.read(value) : void 0;
}
function normalizeUnsafeHTMLProps(props) {
  let innerHTML = readUnsafeHTML(props.innerHTML);
  invariant(
    props.innerHTML === void 0 || innerHTML !== void 0,
    "Invalid innerHTML prop: expected a value created with unsafeHTML()"
  );
  let srcDoc = readUnsafeHTML(props.srcDoc);
  invariant(
    props.srcDoc === void 0 || srcDoc !== void 0,
    "Invalid srcDoc prop: expected a value created with unsafeHTML()"
  );
  let srcdoc = readUnsafeHTML(props.srcdoc);
  invariant(
    props.srcdoc === void 0 || srcdoc !== void 0,
    "Invalid srcdoc prop: expected a value created with unsafeHTML()"
  );
  invariant(
    props.outerHTML === void 0,
    "Invalid outerHTML prop: outerHTML is not supported on host elements"
  );
  if (innerHTML === void 0 && srcDoc === void 0 && srcdoc === void 0) return props;
  return {
    ...props,
    ...innerHTML === void 0 ? {} : { innerHTML },
    ...srcDoc === void 0 ? {} : { srcDoc },
    ...srcdoc === void 0 ? {} : { srcdoc }
  };
}

// ../../../src/runtime/to-vnode.ts
function flatMapChildrenToVNodes(props) {
  let children = props.children;
  if (children === void 0) return [];
  if (!Array.isArray(children)) return [toVNode(children)];
  let vnodes = [];
  flattenChildrenToVNodes(children, vnodes);
  return vnodes;
}
function flattenChildrenToVNodes(nodes, out) {
  let children = normalizeChildren(nodes);
  for (let i = 0; i < children.length; i++) {
    out.push(toVNode(children[i]));
  }
}
function toVNode(node) {
  if (isEmptyChild(node)) {
    return { kind: "empty", type: NON_RENDER_NODE };
  }
  if (isPrimitiveChild(node)) {
    return { kind: "text", type: TEXT_NODE, _text: String(node) };
  }
  if (isRemixElement(node)) {
    if (node.type === Fragment) {
      let props = parseHostProps(node.props);
      return {
        kind: "fragment",
        type: Fragment,
        key: node.key,
        _children: flatMapChildrenToVNodes(props)
      };
    }
    if (node.type === Frame) {
      invariant(isFrameProps(node.props), "<Frame /> requires a src prop");
      return { kind: "frame", type: Frame, key: node.key, props: node.props };
    }
    if (typeof node.type === "string") {
      let props = parseHostProps(node.props);
      let children = props.innerHTML != null ? [] : flatMapChildrenToVNodes(props);
      return {
        kind: "host",
        type: node.type,
        key: node.key,
        props,
        _children: children
      };
    }
    invariant(isElementFunction2(node.type), "Expected component element type");
    return { kind: "component", type: node.type, key: node.key, props: node.props };
  }
  if (Array.isArray(node)) {
    let children = [];
    flattenChildrenToVNodes(node, children);
    return { kind: "fragment", type: Fragment, _children: children };
  }
  invariant(false, "Unexpected RemixNode");
}
function isFrameProps(props) {
  return typeof props.src === "string" && props.src.length > 0;
}
function parseHostProps(props) {
  let normalizedProps = normalizeUnsafeHTMLProps(props);
  let children = normalizedProps.children;
  invariant(children === void 0 || isRemixNode(children), "Invalid host children");
  let mix = normalizedProps.mix;
  invariant(mix === void 0 || isRuntimeMixValue(mix), "Invalid mix prop");
  return normalizedProps;
}
function isRuntimeMixValue(value) {
  if (!Array.isArray(value)) return isMixinDescriptor(value);
  for (let descriptor of value) {
    if (!isMixinDescriptor(descriptor)) return false;
  }
  return true;
}
function isElementFunction2(value) {
  return typeof value === "function";
}

// ../../../src/runtime/mixins/mixin.ts
function renderMixinElement(element, props) {
  let { key, ...rest } = props ?? {};
  return jsx(element, rest, key);
}
var mixinHandleId = 0;
function createMixin(type, options = {}) {
  let mixinType = options.ssr === false || "__rmxMixinSsr" in type ? Object.assign(
    function mixinSetup(handle, hostType) {
      return type(handle, hostType);
    },
    { __rmxMixinSsr: options.ssr !== false }
  ) : type;
  return (...args) => ({
    type: mixinType,
    args
  });
}
function resolveMixedProps(input) {
  let state = input.state ?? createMixinRuntimeState();
  let hostType = input.hostType;
  state.handle ??= new MixinHandleImpl(
    state,
    hostType,
    input.frame,
    input.scheduler,
    input.getContext ?? (() => void 0)
  );
  let handle = state.handle;
  let runnerCount = 0;
  let props = composeMixedProps(hostType, input.props, (descriptor, index, mixinProps) => {
    runnerCount = index + 1;
    let entry = state.runners[index];
    if (!entry || entry.type !== descriptor.type) {
      if (entry) {
        queueMixinRemove(handle, entry.scope);
      }
      let scope = /* @__PURE__ */ Symbol("mixin-scope");
      handle.setActiveScope(scope);
      entry = {
        scope,
        type: descriptor.type,
        runner: normalizeMixinRunner(
          descriptor.type(handle, hostType),
          handle
        )
      };
      handle.setActiveScope(void 0);
      state.runners[index] = entry;
      let binding = state.binding;
      if (binding?.node) {
        queueMixinBindEvent(handle, entry.scope, "insert", binding);
      }
    }
    handle.setActiveScope(entry.scope);
    let result = entry.runner(...descriptor.args, mixinProps);
    handle.setActiveScope(void 0);
    return result;
  });
  for (let index = runnerCount; index < state.runners.length; index++) {
    let entry = state.runners[index];
    if (entry) {
      removeMixinScope(handle, entry.scope);
    }
  }
  if (state.runners.length > runnerCount) {
    state.runners.length = runnerCount;
  }
  return { state, props };
}
function teardownMixins(state) {
  if (!state) return;
  state.binding = void 0;
  prepareMixinRemoval(state);
  cancelPendingMixinRemoval(state);
  let handle = state.handle;
  if (handle) {
    handle.queueCommitTask(() => finalizeMixinTeardown(state));
    return;
  }
  finalizeMixinTeardown(state);
}
function bindMixinRuntime(state, binding, reclaimed) {
  if (!state) return;
  let previousNode = state.binding?.node;
  state.binding = binding;
  if (!binding?.node || previousNode === binding.node) return;
  let handle = state.handle;
  if (!handle) return;
  for (let entry of state.runners) {
    queueMixinBindEvent(handle, entry.scope, reclaimed ? "reclaimed" : "insert", binding);
  }
}
function prepareMixinRemoval(state) {
  if (!state || state.removePrepared) return state?.pendingRemoval?.done;
  state.removePrepared = true;
  let pendingRemoval;
  let persistTeardowns = [];
  let registerPersistNode = (teardown) => {
    persistTeardowns.push(teardown);
  };
  if (!state.handle) return;
  dispatchMixinEvent(state, () => {
    let event = new Event("beforeRemove");
    event.persistNode = registerPersistNode;
    return event;
  });
  if (persistTeardowns.length > 0) {
    let controller = new AbortController();
    let done = Promise.allSettled(
      persistTeardowns.map((teardown) => Promise.resolve().then(() => teardown(controller.signal)))
    ).then(() => {
    });
    pendingRemoval = { controller, done };
  }
  state.pendingRemoval = pendingRemoval;
  return pendingRemoval?.done;
}
function cancelPendingMixinRemoval(state, reason = new DOMException("", "AbortError")) {
  if (!state?.pendingRemoval) return;
  state.pendingRemoval.controller.abort(reason);
  state.pendingRemoval = void 0;
  state.removePrepared = false;
}
function createMixinRuntimeState() {
  return {
    id: `m${++mixinHandleId}`,
    aborted: false,
    runners: []
  };
}
var MixinHandleImpl = class extends TypedEventTarget {
  id;
  context;
  frame;
  element;
  #state;
  #scheduler;
  #phaseListenerCounts = {
    beforeUpdate: 0,
    commit: 0
  };
  #activeScope;
  #scopes = /* @__PURE__ */ new Map();
  #onSchedulerPhase = (event) => {
    let binding = this.#state.binding;
    if (!binding) return;
    if (!isBindingInUpdateScope(binding, event.parents)) return;
    for (let [, scope] of this.#scopes) {
      let updateEvent = new Event(event.type);
      updateEvent.node = binding.node;
      scope.target.dispatchEvent(updateEvent);
    }
  };
  constructor(state, hostType, frame, scheduler, getContext) {
    super();
    this.#state = state;
    this.#scheduler = scheduler;
    this.id = state.id;
    this.context = {
      get: getContext
    };
    this.frame = frame;
    let element = ((_, __) => (props) => ({
      $rmx: true,
      type: hostType,
      key: null,
      props
    }));
    element.__rmxMixinElementType = hostType;
    this.element = element;
  }
  get signal() {
    let scope = this.#activeScope;
    invariant(
      scope,
      "handle.signal is only available during mixin setup, render, or lifecycle callbacks"
    );
    let record = this.#scopes.get(scope);
    invariant(record);
    record.controller ??= new AbortController();
    return record.controller.signal;
  }
  addEventListener(type, listener, options) {
    let scope = this.#getActiveScope();
    scope.target.addEventListener(
      type,
      listener,
      options
    );
    if (!listener || !isSchedulerPhaseType(type)) return;
    scope.phaseCounts[type] += 1;
    this.#updatePhaseListenerCount(type, 1);
  }
  removeEventListener(type, listener, options) {
    let scope = this.#getActiveScope();
    scope.target.removeEventListener(
      type,
      listener,
      typeof options === "boolean" ? { capture: options } : options
    );
    if (!listener || !isSchedulerPhaseType(type)) return;
    scope.phaseCounts[type] = Math.max(0, scope.phaseCounts[type] - 1);
    this.#updatePhaseListenerCount(type, -1);
  }
  update() {
    return new Promise((resolve) => {
      let signal = getMixinRuntimeSignal(this.#state);
      if (signal.aborted) {
        resolve(signal);
        return;
      }
      let binding = this.#state.binding;
      if (!binding) {
        resolve(signal);
        return;
      }
      binding.enqueueUpdate(resolve);
    });
  }
  queueTask(task) {
    this.#scheduler.enqueueTasks([
      () => {
        let binding = this.#state.binding;
        invariant(binding);
        task(binding.node, getMixinRuntimeSignal(this.#state));
      }
    ]);
  }
  queueCommitTask(task) {
    this.#scheduler.enqueueCommitPhase([task]);
  }
  setActiveScope(scope) {
    this.#activeScope = scope;
    if (!scope) return;
    if (this.#scopes.has(scope)) return;
    this.#scopes.set(scope, {
      target: new TypedEventTarget(),
      phaseCounts: { beforeUpdate: 0, commit: 0 }
    });
  }
  dispatchScopedEvent(scope, event) {
    let record = this.#scopes.get(scope);
    if (!record) return;
    let previousScope = this.#activeScope;
    this.#activeScope = scope;
    record.target.dispatchEvent(event);
    this.#activeScope = previousScope;
  }
  releaseScope(scope) {
    let record = this.#scopes.get(scope);
    if (record) {
      this.#updatePhaseListenerCount("beforeUpdate", -record.phaseCounts.beforeUpdate);
      this.#updatePhaseListenerCount("commit", -record.phaseCounts.commit);
      record.controller?.abort();
      this.#scopes.delete(scope);
    }
    if (this.#activeScope === scope) {
      this.#activeScope = void 0;
    }
  }
  #getActiveScope() {
    let scope = this.#activeScope;
    invariant(scope);
    let record = this.#scopes.get(scope);
    invariant(record);
    return record;
  }
  // Subscribes to the scheduler phase when the first listener is added and
  // unsubscribes whenever the count reaches zero on removal.
  #updatePhaseListenerCount(type, delta) {
    if (delta === 0) return;
    let count = Math.max(0, this.#phaseListenerCounts[type] + delta);
    this.#phaseListenerCounts[type] = count;
    if (delta > 0) {
      if (count === 1) this.#scheduler.addEventListener(type, this.#onSchedulerPhase);
    } else if (count === 0) {
      this.#scheduler.removeEventListener(type, this.#onSchedulerPhase);
    }
  }
};
function getMixinRuntimeSignal(state) {
  let controller = state.controller;
  if (!controller) {
    controller = new AbortController();
    if (state.aborted) {
      controller.abort();
    }
    state.controller = controller;
  }
  return controller.signal;
}
function dispatchMixinBeforeUpdate(state) {
  dispatchMixinUpdateEvent(state, "beforeUpdate");
}
function dispatchMixinCommit(state) {
  dispatchMixinUpdateEvent(state, "commit");
}
function queueMixinBindEvent(handle, scope, type, binding) {
  let { node, parent, key } = binding;
  handle.queueCommitTask(() => {
    let event = new Event(type);
    event.node = node;
    event.parent = parent;
    event.key = key;
    handle.dispatchScopedEvent(scope, event);
  });
}
function removeMixinScope(handle, scope) {
  handle.dispatchScopedEvent(scope, new Event("remove"));
  handle.releaseScope(scope);
}
function queueMixinRemove(handle, scope) {
  handle.queueCommitTask(() => removeMixinScope(handle, scope));
}
function dispatchMixinEvent(state, createEvent) {
  if (!state?.handle) return;
  let handle = state.handle;
  for (let entry of state.runners) {
    handle.dispatchScopedEvent(entry.scope, createEvent());
  }
}
function finalizeMixinTeardown(state) {
  dispatchMixinEvent(state, () => new Event("remove"));
  let handle = state.handle;
  if (handle) {
    for (let entry of state.runners) {
      handle.releaseScope(entry.scope);
    }
  }
  state.runners.length = 0;
  state.aborted = true;
  state.controller?.abort();
  state.pendingRemoval = void 0;
  state.removePrepared = true;
  state.handle = void 0;
}
function dispatchMixinUpdateEvent(state, type) {
  let node = state?.binding?.node;
  if (!node) return;
  dispatchMixinEvent(state, () => {
    let event = new Event(type);
    event.node = node;
    return event;
  });
}
function isSchedulerPhaseType(type) {
  return type === "beforeUpdate" || type === "commit";
}
function isBindingInUpdateScope(binding, parents) {
  for (let parent of parents) {
    if (parent.contains(binding.node)) return true;
  }
  return false;
}
function normalizeMixinRunner(result, handle) {
  if (typeof result === "function" && !isMixinElementFunction(result)) {
    return result;
  }
  if (result === void 0) {
    return () => handle.element;
  }
  return () => result;
}

// ../../../src/runtime/mixins/on-mixin.ts
var onMixinSetup = (handle) => {
  let currentHandler = () => {
  };
  let currentType = "";
  let currentCapture = false;
  let currentNode = null;
  let reentry = null;
  let stableHandler = (event) => {
    reentry?.abort(new DOMException("", "EventReentry"));
    reentry = new AbortController();
    void currentHandler(event, reentry.signal);
  };
  handle.addEventListener("insert", (event) => {
    currentNode = event.node;
    currentNode.addEventListener(currentType, stableHandler, currentCapture);
  });
  handle.addEventListener("remove", () => {
    currentNode?.removeEventListener(currentType, stableHandler, currentCapture);
    currentNode = null;
    reentry?.abort(new DOMException("", "AbortError"));
  });
  return (type, handler, captureBoolean = false) => {
    let previousType = currentType;
    let previousCapture = currentCapture;
    let needsRebind = currentType !== type || currentCapture !== captureBoolean;
    currentType = type;
    currentHandler = handler;
    currentCapture = captureBoolean;
    if (needsRebind && currentNode) {
      currentNode.removeEventListener(previousType, stableHandler, previousCapture);
      currentNode.addEventListener(type, stableHandler, captureBoolean);
    }
    return handle.element;
  };
};
var onMixin = createMixin(onMixinSetup, { ssr: false });
var onMixinType = onMixin("", () => {
}).type;
function isOnMixinDescriptor(descriptor) {
  if (!descriptor || typeof descriptor !== "object") return false;
  let candidate = descriptor;
  return candidate.type === onMixinType && Array.isArray(candidate.args);
}
function on(type, handler, captureBoolean) {
  return onMixin(
    type,
    handler,
    captureBoolean
  );
}

// ../../../src/runtime/refresh.ts
var componentStalenessCheck = null;
var roots = /* @__PURE__ */ new Set();
function registerRoot(root2) {
  roots.add(root2);
}
function unregisterRoot(root2) {
  roots.delete(root2);
}

// ../../../src/runtime/client-entry-boundary.ts
var HMR_TIMESTAMP_QUERY_SEGMENT_PATTERN = /^t=\d{13}$/;
function getClientEntryKey(identity) {
  return JSON.stringify([getClientEntryComparisonUrl(identity.moduleUrl), identity.exportName]);
}
function getHmrTimestampQuerySegmentIndex(querySegments) {
  let timestampIndex = -1;
  for (let index = 0; index < querySegments.length; index++) {
    if (!HMR_TIMESTAMP_QUERY_SEGMENT_PATTERN.test(querySegments[index])) continue;
    if (timestampIndex !== -1) return null;
    timestampIndex = index;
  }
  return timestampIndex === -1 ? null : timestampIndex;
}
function getClientEntryComparisonUrl(moduleUrl) {
  let hashIndex = moduleUrl.indexOf("#");
  let urlWithoutHash = hashIndex === -1 ? moduleUrl : moduleUrl.slice(0, hashIndex);
  let hash = hashIndex === -1 ? "" : moduleUrl.slice(hashIndex);
  let queryIndex = urlWithoutHash.indexOf("?");
  if (queryIndex === -1) return moduleUrl;
  let pathname = urlWithoutHash.slice(0, queryIndex);
  let query = urlWithoutHash.slice(queryIndex + 1);
  let querySegments = query.split("&");
  let timestampIndex = getHmrTimestampQuerySegmentIndex(querySegments);
  if (timestampIndex === null) return moduleUrl;
  querySegments.splice(timestampIndex, 1);
  let comparisonQuery = querySegments.length > 0 ? `?${querySegments.join("&")}` : "";
  return `${pathname}${comparisonQuery}${hash}`;
}
var CLIENT_ENTRY_BOUNDARY_OWNER = /* @__PURE__ */ Symbol("ClientEntryBoundaryOwner");
function getClientEntryBoundaryOwner(marker) {
  return marker[CLIENT_ENTRY_BOUNDARY_OWNER];
}
function setClientEntryBoundaryOwner(marker, end, identity, root2) {
  let owner = { end, identity, root: root2 };
  Object.defineProperties(marker, {
    [CLIENT_ENTRY_BOUNDARY_OWNER]: {
      configurable: true,
      value: owner
    },
    $rmx: {
      configurable: true,
      value: root2
    }
  });
  return owner;
}
function disposeClientEntryBoundary(marker) {
  let boundaryMarker = marker;
  let owner = boundaryMarker[CLIENT_ENTRY_BOUNDARY_OWNER];
  if (!owner) return false;
  delete boundaryMarker[CLIENT_ENTRY_BOUNDARY_OWNER];
  delete boundaryMarker.$rmx;
  owner.root.dispose();
  return true;
}

// ../../../src/runtime/reconcile.ts
var SVG_NS2 = "http://www.w3.org/2000/svg";
var idCounter2 = 0;
var persistedRemovalToken = 0;
var persistedMixinNodes = /* @__PURE__ */ new Set();
var activeSchedulerUpdateParents;
function getSvgContext(vParent, node) {
  if (node.kind === "host") {
    if (node.type === "svg") return true;
    if (node.type === "foreignObject") return false;
  }
  return vParent._svg;
}
function getHostProps(node) {
  return "_mixedProps" in node ? node._mixedProps : node.props;
}
function markNodePersistedByMixins(node, domParent, token) {
  node._persistence = { parent: domParent, token };
  persistedMixinNodes.add(node);
  bindMixinRuntime(node._mixState, void 0);
}
function unmarkNodePersistedByMixins(node) {
  node._persistence = void 0;
  persistedMixinNodes.delete(node);
}
function findMatchingPersistedMixinNode(type, key, domParent) {
  if (key == null) return null;
  for (let node of persistedMixinNodes) {
    if (node._persistence?.parent !== domParent) continue;
    if (node.type !== type) continue;
    if (node.key !== key) continue;
    return node;
  }
  return null;
}
var EMPTY_DIRECT_EVENT_DESCRIPTORS = [];
var EMPTY_COMMITTED_CHILDREN = [];
function shouldRestoreControlledReflectionOnInput(node, state) {
  if (state.hasControlledChecked) return false;
  if (node.type === "select") return false;
  return true;
}
function ensureControlledReflection(node, scheduler) {
  let existing = node._controlledState;
  if (existing) return existing;
  let state = {
    disposed: false,
    listenersAttached: false,
    pendingRestoreVersion: 0,
    hasControlledValue: false,
    controlledValue: void 0,
    hasControlledChecked: false,
    controlledChecked: void 0,
    onInput: () => {
      if (!shouldRestoreControlledReflectionOnInput(node, state)) return;
      scheduleControlledRestore(node, state);
    },
    onChange: () => {
      scheduleControlledRestore(node, state);
    }
  };
  node._controlledState = state;
  scheduler.enqueueTasks([
    () => {
      if (state.disposed) return;
      node._dom.addEventListener("input", state.onInput);
      node._dom.addEventListener("change", state.onChange);
      state.listenersAttached = true;
    }
  ]);
  return state;
}
function syncControlledReflection(node, scheduler) {
  let props = getHostProps(node);
  if (!node._controlledState && props.value === void 0 && props.checked === void 0) return;
  let state = ensureControlledReflection(node, scheduler);
  if (state.disposed) return;
  state.hasControlledValue = canManageValue(node.type, node._dom) && props.value !== void 0;
  state.controlledValue = props.value;
  state.hasControlledChecked = canReflectProperty(node._dom, "checked") && props.checked !== void 0;
  state.controlledChecked = props.checked;
  state.pendingRestoreVersion++;
}
function scheduleControlledRestore(node, state) {
  if (state.disposed) return;
  let version = ++state.pendingRestoreVersion;
  queueMicrotask(() => {
    if (state.disposed) return;
    if (state.pendingRestoreVersion !== version) return;
    restoreControlledReflections(node, state);
  });
}
function restoreControlledReflections(node, state) {
  let element = node._dom;
  if (state.hasControlledValue && readDomProp(element, "value") !== state.controlledValue) {
    setPropertyReflection(element, "value", state.controlledValue);
  }
  if (state.hasControlledChecked && readDomProp(element, "checked") !== state.controlledChecked) {
    setPropertyReflection(element, "checked", state.controlledChecked);
  }
}
function disposeControlledReflection(node, detach) {
  let state = node._controlledState;
  if (!state) return;
  state.disposed = true;
  state.pendingRestoreVersion++;
  if (detach && state.listenersAttached) {
    node._dom.removeEventListener("input", state.onInput);
    node._dom.removeEventListener("change", state.onChange);
  }
  state.listenersAttached = false;
}
function canManageValue(type, element) {
  if (type === "progress") return false;
  return canReflectProperty(element, "value");
}
function canReflectProperty(element, key) {
  return key in element && !key.includes("-");
}
function readDomProp(element, key) {
  if (!canReflectProperty(element, key)) return void 0;
  return element[key];
}
function setPropertyReflection(element, key, value) {
  if (!canReflectProperty(element, key)) return;
  element[key] = value == null ? "" : value;
}
function resolveNodeMixProps(node, parent, frame, scheduler, state) {
  let mix = node.props.mix;
  let directEventDescriptors = resolveDirectEventDescriptors(mix);
  if (directEventDescriptors) {
    if (state) teardownMixins(state);
    return { props: node.props, directEventDescriptors };
  }
  if (state == null && (mix == null || Array.isArray(mix) && mix.length === 0)) {
    return { props: node.props };
  }
  let resolved = resolveMixedProps({
    hostType: node.type,
    frame,
    scheduler,
    getContext: (type) => {
      if (typeof type !== "function") {
        return void 0;
      }
      return findContextFromAncestry(parent, type);
    },
    props: node.props,
    state
  });
  return { props: resolved.props, mixState: resolved.state };
}
function applyResolvedHostProps(node, resolved) {
  node._mixedProps = resolved.props;
  node._mixState = resolved.mixState;
  node._directEventDescriptors = resolved.directEventDescriptors;
}
function resolveDirectEventDescriptors(mix) {
  if (!mix) return EMPTY_DIRECT_EVENT_DESCRIPTORS;
  if (!Array.isArray(mix)) {
    return isOnMixinDescriptor(mix) ? [mix] : null;
  }
  return areOnMixinDescriptors(mix) ? mix : null;
}
function areOnMixinDescriptors(descriptors) {
  for (let i = 0; i < descriptors.length; i++) {
    if (!isOnMixinDescriptor(descriptors[i])) return false;
  }
  return true;
}
function enqueueMixinBindingUpdate(done) {
  let node = this.target;
  let state = node._mixState;
  this.scheduler.enqueueWork([
    () => {
      if (state?.aborted) {
        done(getMixinRuntimeSignal(state));
        return;
      }
      dispatchMixinBeforeUpdate(state);
      let prevProps = getHostProps(node);
      let resolved = resolveNodeMixProps(node, node._parent, this.frame, this.scheduler, state);
      applyResolvedHostProps(node, resolved);
      patchHostProps(prevProps, resolved.props, this.node);
      syncControlledReflection(node, this.scheduler);
      dispatchMixinCommit(state);
      done(state ? getMixinRuntimeSignal(state) : AbortSignal.abort());
    }
  ]);
}
function bindNodeMixRuntime(node, context, reclaimed = false, parent) {
  let state = node._mixState;
  if (!state) return;
  bindMixinRuntime(
    state,
    {
      node: node._dom,
      parent: parent ?? getRequiredDomParent(node._dom),
      key: node.key,
      target: node,
      frame: context.frame,
      scheduler: context.scheduler,
      enqueueUpdate: enqueueMixinBindingUpdate
    },
    reclaimed
  );
}
function isHeadHostNode(node) {
  return node.type.length === 4 && node.type.toLowerCase() === "head";
}
function getRequiredDomParent(node) {
  let parent = node.parentNode;
  invariant(parent, "Expected mounted host node to have a DOM parent");
  return parent;
}
function getDocumentHead(domParent) {
  if (domParent instanceof Document) {
    return domParent.head;
  }
  if (domParent instanceof Node) {
    return domParent.ownerDocument?.head ?? null;
  }
  return null;
}
function commitNonRenderNode(node, parent, svg) {
  let committed = node;
  committed._parent = parent;
  committed._svg = svg;
  return committed;
}
function commitTextNode(node, parent, svg, dom) {
  let committed = node;
  committed._parent = parent;
  committed._svg = svg;
  committed._dom = dom;
  return committed;
}
function beginFragmentNode(node, parent, svg) {
  let committed = node;
  committed._parent = parent;
  committed._svg = svg;
  committed._children = EMPTY_COMMITTED_CHILDREN;
  return committed;
}
function commitHostNode(node, parent, svg, dom, resolved) {
  let committed = node;
  committed._parent = parent;
  committed._svg = svg;
  committed._dom = dom;
  committed._children = EMPTY_COMMITTED_CHILDREN;
  applyResolvedHostProps(committed, resolved);
  return committed;
}
function beginComponentNode(node, parent, svg, handle, context) {
  let mounting = node;
  mounting._parent = parent;
  mounting._svg = svg;
  mounting._handle = handle;
  mounting._context = context;
  return mounting;
}
function commitComponentNode(node, content) {
  let committed = node;
  committed._content = content;
  return committed;
}
function diffVNodes(curr, next, domParent, vParent, context, anchor, cursor) {
  if (curr === null) {
    return insert(next, domParent, vParent, context, anchor, cursor);
  }
  if (isCommittedClientEntryNode(curr) && next.kind === "component" && isEntry(next.type)) {
    return diffClientEntryBoundary(curr, next, vParent, context);
  }
  if (componentStalenessCheck !== null && curr.kind === "component" && next.kind === "component" && componentStalenessCheck(curr.type) === true) {
    return replace(curr, next, domParent, vParent, context, anchor);
  }
  if (curr.kind !== next.kind || curr.type !== next.type) {
    return replace(curr, next, domParent, vParent, context, anchor);
  }
  let svg = getSvgContext(vParent, next);
  switch (next.kind) {
    case "host": {
      return diffHost(curr, next, vParent, context, svg);
    }
    case "text": {
      return diffText(curr, next, vParent, svg);
    }
    case "empty": {
      return commitNonRenderNode(next, vParent, svg);
    }
    case "fragment": {
      let childInputs = next._children;
      let committed = beginFragmentNode(next, vParent, svg);
      committed._children = diffChildren(
        curr._children,
        childInputs,
        domParent,
        committed,
        context,
        void 0,
        anchor
      );
      return committed;
    }
    case "frame": {
      return diffFrame(curr, next, domParent, vParent, context, svg, anchor);
    }
    case "component": {
      return diffComponent(
        curr,
        next,
        domParent,
        vParent,
        context,
        svg,
        anchor,
        cursor
      );
    }
  }
}
function replace(curr, next, domParent, vParent, context, anchor) {
  let currAnchor = findFirstDomAnchor(curr);
  if (currAnchor && currAnchor.parentNode === domParent) {
    let replacementAnchor2 = document.createComment("rmx:replace");
    domParent.insertBefore(replacementAnchor2, currAnchor);
    try {
      remove2(curr, domParent, context);
      return insert(next, domParent, vParent, context, replacementAnchor2);
    } finally {
      replacementAnchor2.parentNode?.removeChild(replacementAnchor2);
    }
  }
  let replacementAnchor = findNextSiblingDomAnchor(curr) ?? anchor;
  remove2(curr, domParent, context);
  return insert(next, domParent, vParent, context, replacementAnchor);
}
function diffHost(curr, next, vParent, context, svg) {
  let { frame, scheduler } = context;
  let currProps = getHostProps(curr);
  let resolved = resolveNodeMixProps(next, vParent, frame, scheduler, curr._mixState);
  let childInputs = next._children;
  let nextProps = resolved.props;
  let nextMixState = resolved.mixState;
  let shouldDispatchMixinLifecycle = (nextMixState?.runners.length ?? 0) > 0 && shouldDispatchInlineMixinLifecycle(curr._dom);
  if (shouldDispatchMixinLifecycle) {
    dispatchMixinBeforeUpdate(nextMixState);
  }
  if (nextProps.innerHTML != null) {
    if (currProps.innerHTML !== nextProps.innerHTML) {
      curr._dom.innerHTML = nextProps.innerHTML;
    }
  } else if (currProps.innerHTML != null) {
    curr._dom.innerHTML = "";
  }
  let committed = commitRetainedHostNode(curr, next, vParent, svg, resolved);
  committed._children = diffChildren(curr._children, childInputs, curr._dom, committed, context);
  patchHostProps(currProps, nextProps, curr._dom);
  setupHostNode(committed, scheduler);
  bindNodeMixRuntime(committed, context);
  if (shouldDispatchMixinLifecycle) {
    scheduler.enqueueCommitPhase([() => dispatchMixinCommit(nextMixState)]);
  }
  return committed;
}
function commitRetainedHostNode(curr, next, vParent, svg, resolved) {
  let committed = commitHostNode(next, vParent, svg, curr._dom, resolved);
  committed._directEventState = curr._directEventState;
  committed._controlledState = curr._controlledState;
  return committed;
}
function setupHostNode(node, scheduler) {
  syncDirectEventListeners(node);
  syncControlledReflection(node, scheduler);
}
function syncDirectEventListeners(node) {
  let descriptors = node._directEventDescriptors;
  if (!descriptors?.length) {
    disposeDirectEventListeners(node, true);
    return;
  }
  let state = node._directEventState;
  if (!state) {
    state = { bindings: [] };
    node._directEventState = state;
  }
  let bindings = state.bindings;
  for (let index = 0; index < descriptors.length; index++) {
    let args = descriptors[index].args;
    let type = args[0];
    let handler = args[1];
    let captureBoolean = args[2] ?? false;
    let binding = bindings[index];
    if (!binding) {
      binding = createDirectEventBinding(type, handler, captureBoolean);
      bindings[index] = binding;
      attachDirectEventBinding(node._dom, binding);
      continue;
    }
    if (binding.type !== type || binding.capture !== captureBoolean) {
      removeDirectEventBinding(node._dom, binding);
      binding.type = type;
      binding.capture = captureBoolean;
      attachDirectEventBinding(node._dom, binding);
    }
    binding.handler = handler;
  }
  for (let index = descriptors.length; index < bindings.length; index++) {
    removeDirectEventBinding(node._dom, bindings[index]);
  }
  bindings.length = descriptors.length;
}
function createDirectEventBinding(type, handler, capture) {
  let binding = {
    type,
    handler,
    capture,
    reentry: null,
    stableHandler: (event) => {
      invokeDirectEventBinding(binding, event);
    }
  };
  return binding;
}
function attachDirectEventBinding(dom, binding) {
  dom.addEventListener(binding.type, binding.stableHandler, binding.capture);
}
function removeDirectEventBinding(dom, binding, detach = true) {
  if (detach) {
    dom.removeEventListener(binding.type, binding.stableHandler, binding.capture);
  }
  binding.reentry?.abort(new DOMException("", "AbortError"));
  binding.reentry = null;
}
function disposeDirectEventListeners(node, detach) {
  let state = node._directEventState;
  if (!state) return;
  for (let binding of state.bindings) {
    removeDirectEventBinding(node._dom, binding, detach);
  }
  state.bindings.length = 0;
  node._directEventState = void 0;
}
function invokeDirectEventBinding(binding, event) {
  binding.reentry?.abort(new DOMException("", "EventReentry"));
  binding.reentry = new AbortController();
  void binding.handler(event, binding.reentry.signal);
}
function diffText(curr, next, vParent, svg) {
  if (curr._text !== next._text) {
    curr._dom.textContent = next._text;
  }
  return commitTextNode(next, vParent, svg, curr._dom);
}
function mountHostNode(node, vParent, svg, dom, resolved, context, childCursor, parent) {
  let hostProps = resolved.props;
  let childInputs = node._children;
  patchHostProps({}, hostProps, dom);
  let committed = commitHostNode(node, vParent, svg, dom, resolved);
  if (hostProps.innerHTML != null) {
    dom.innerHTML = hostProps.innerHTML;
  } else {
    committed._children = diffChildren(null, childInputs, dom, committed, context, childCursor);
  }
  setupHostNode(committed, context.scheduler);
  bindNodeMixRuntime(committed, context, false, parent);
  return committed;
}
function getHydrationTagName(element, svg) {
  return svg ? element.tagName : element.tagName.toLowerCase();
}
function insertDomNode(dom, domParent, anchor) {
  if (anchor) {
    domParent.insertBefore(dom, anchor);
  } else {
    domParent.appendChild(dom);
  }
}
function insert(node, domParent, vParent, context, anchor, cursor) {
  let { frame, scheduler, styles } = context;
  let svg = getSvgContext(vParent, node);
  let hydrationNode = cursor?.current;
  if (hydrationNode && anchor && hydrationNode === anchor) {
    hydrationNode = null;
  }
  hydrationNode = skipCommentsExceptBoundaryStart(
    hydrationNode ?? null,
    node.kind === "component" || node.kind === "fragment" || node.kind === "empty"
  );
  if (hydrationNode && anchor && hydrationNode === anchor) {
    hydrationNode = null;
  }
  if (cursor) cursor.current = hydrationNode;
  if (vParent.kind !== "root" && node.kind === "component" && isEntry(node.type) && hydrationNode instanceof Comment) {
    let runtime = getFrameRuntime(frame);
    let pending = runtime?.pendingClientEntries.get(hydrationNode);
    let owner = getClientEntryBoundaryOwner(hydrationNode);
    let end = pending?.[0] ?? owner?.end;
    if (end) {
      let committed = commitClientEntryBoundary(node, vParent, svg, hydrationNode, end);
      updateClientEntryBoundary(committed, context);
      if (cursor) cursor.current = end.nextSibling;
      return committed;
    }
  }
  if (node.kind === "empty") {
    return commitNonRenderNode(node, vParent, svg);
  }
  if (node.kind === "text") {
    if (hydrationNode instanceof Text) {
      if (hydrationNode.data !== node._text) {
        if (hydrationNode.data.startsWith(node._text) && node._text.length < hydrationNode.data.length) {
          let remainder = hydrationNode.splitText(node._text.length);
          if (cursor) cursor.current = remainder;
          return commitTextNode(node, vParent, svg, hydrationNode);
        }
        if (node._text.startsWith(hydrationNode.data) && hydrationNode.data.length < node._text.length) {
          let remainder = node._text.slice(hydrationNode.data.length);
          let sibling = hydrationNode.nextSibling;
          while (remainder.length > 0 && sibling instanceof Text && remainder.startsWith(sibling.data)) {
            remainder = remainder.slice(sibling.data.length);
            let next = sibling.nextSibling;
            sibling.remove();
            sibling = next;
          }
          if (remainder.length > 0 && sibling instanceof Text && sibling.data.startsWith(remainder)) {
            sibling.deleteData(0, remainder.length);
          }
          hydrationNode.data = node._text;
          if (cursor) cursor.current = sibling;
          return commitTextNode(node, vParent, svg, hydrationNode);
        }
        logHydrationMismatch("text mismatch", hydrationNode.data, node._text);
        hydrationNode.data = node._text;
      }
      if (cursor) cursor.current = hydrationNode.nextSibling;
      return commitTextNode(node, vParent, svg, hydrationNode);
    }
    let dom = document.createTextNode(node._text);
    insertDomNode(dom, domParent, anchor);
    return commitTextNode(node, vParent, svg, dom);
  }
  if (node.kind === "host") {
    let resolved = resolveNodeMixProps(node, vParent, frame, scheduler);
    if (isHeadHostNode(node)) {
      let targetHead = getDocumentHead(domParent);
      if (targetHead) {
        let childInputs = node._children;
        let childCursor = cursor ? { current: hydrationNode } : void 0;
        if (hydrationNode instanceof Element && hydrationNode.tagName.toLowerCase() === "head") {
          if (childCursor) childCursor.current = hydrationNode.firstChild;
          let nextCursor = hydrationNode.nextSibling;
          if (hydrationNode !== targetHead) {
            while (hydrationNode.firstChild) {
              targetHead.appendChild(hydrationNode.firstChild);
            }
            hydrationNode.remove();
          }
          if (cursor) cursor.current = nextCursor;
        }
        let committed2 = commitHostNode(node, vParent, svg, targetHead, resolved);
        committed2._children = diffChildren(
          null,
          childInputs,
          targetHead,
          committed2,
          context,
          childCursor
        );
        patchHostProps({}, resolved.props, targetHead);
        setupHostNode(committed2, scheduler);
        bindNodeMixRuntime(committed2, context);
        return committed2;
      }
    }
    let persistedNode = findMatchingPersistedMixinNode(node.type, node.key, domParent);
    if (persistedNode) {
      return reclaimPersistedMixinNode(persistedNode, node, vParent, context, svg);
    }
    if (hydrationNode instanceof Element) {
      let cursorTag = getHydrationTagName(hydrationNode, svg);
      let match = cursorTag === node.type ? hydrationNode : null;
      if (!match) {
        let nextSibling = skipComments(hydrationNode.nextSibling);
        if (nextSibling instanceof Element && getHydrationTagName(nextSibling, svg) === node.type) {
          match = nextSibling;
        }
      }
      if (match) {
        let nextCursor = match.nextSibling;
        let committed2 = mountHostNode(node, vParent, svg, match, resolved, context, {
          current: match.firstChild
        });
        if (cursor) cursor.current = nextCursor;
        return committed2;
      }
      logHydrationMismatch("tag", cursorTag, node.type);
      if (cursor) cursor.current = void 0;
    }
    let dom = svg ? document.createElementNS(SVG_NS2, node.type) : document.createElement(node.type);
    let committed = mountHostNode(node, vParent, svg, dom, resolved, context, void 0, domParent);
    insertDomNode(dom, domParent, anchor);
    return committed;
  }
  if (node.kind === "fragment") {
    let childInputs = node._children;
    let committed = beginFragmentNode(node, vParent, svg);
    let children = childInputs;
    for (let i = 0; i < childInputs.length; i++) {
      children[i] = insert(childInputs[i], domParent, committed, context, anchor, cursor);
    }
    committed._children = children;
    return committed;
  }
  if (node.kind === "component") {
    return diffComponent(null, node, domParent, vParent, context, svg, anchor, cursor);
  }
  if (node.kind === "frame") {
    return insertFrame(node, domParent, vParent, context, svg, anchor, cursor);
  }
  invariant(false, "Unexpected node type");
}
function diffFrame(curr, next, domParent, vParent, context, svg, anchor) {
  let { frame } = context;
  let currSrc = getFrameSrc(curr);
  let nextSrc = getFrameSrc(next);
  let currName = getFrameName(curr);
  let nextName = getFrameName(next);
  if (currName !== nextName || currSrc !== nextSrc && !curr._state.resolved) {
    let replaceAnchor = curr._rangeEnd.nextSibling ?? anchor;
    remove2(curr, domParent, context);
    return insertFrame(next, domParent, vParent, context, svg, replaceAnchor);
  }
  let committed = commitFrameNode(next, vParent, svg, curr._rangeStart, curr._rangeEnd, curr._state);
  let frameRuntime = getFrameRuntime(frame);
  let frameInstance = committed._state.instance;
  let serverFrameReload = frameRuntime?.serverFrameReload;
  if (currSrc !== nextSrc) {
    if (frameInstance) {
      frameInstance.handle.src = nextSrc;
    }
    if (frameRuntime) {
      resolveClientFrame(committed, frameRuntime, serverFrameReload);
    }
  } else if (frameRuntime && frameInstance && serverFrameReload) {
    resolveClientFrame(committed, frameRuntime, serverFrameReload);
  }
  if (!committed._state.resolved && committed._state.fallbackRoot) {
    committed._state.fallbackRoot.render(committed.props.fallback ?? null);
  }
  return committed;
}
function insertFrame(node, domParent, vParent, context, svg, anchor, cursor) {
  let { frame, styles } = context;
  let runtime = getFrameRuntime(frame);
  if (!runtime || runtime.canResolveFrames === false) {
    throw new Error(
      "Cannot render <Frame /> without frame runtime. Use run() or pass frameInit to createRoot/createRangeRoot."
    );
  }
  let getContext = (type) => findContextFromAncestry(vParent, type);
  if (isFrameStartComment(cursor?.current)) {
    let start2 = cursor.current;
    let end2 = findFrameEndComment(start2);
    if (end2) {
      let instance2 = runtime.frameInstances.get(start2);
      if (!instance2) {
        instance2 = createFrameInstance(node, start2, end2, runtime, getContext);
      } else {
        let instanceRuntime = getFrameRuntime(instance2.handle);
        if (instanceRuntime) instanceRuntime.getContext = getContext;
      }
      cursor.current = end2.nextSibling;
      return commitFrameNode(node, vParent, svg, start2, end2, {
        instance: instance2,
        resolveToken: 0,
        resolveController: void 0,
        fallbackRoot: void 0,
        resolved: true
      });
    }
  }
  let start = document.createComment(` rmx:f:${randomFrameId()} `);
  let end = document.createComment(" /rmx:f ");
  insertDomNode(start, domParent, anchor);
  insertDomNode(end, domParent, anchor);
  let fallbackRoot = createRangeRoot([start, end], {
    frame,
    getContext,
    styleManager: styles
  });
  fallbackRoot.render(node.props.fallback ?? null);
  let instance = createFrameInstance(node, start, end, runtime, getContext);
  let committed = commitFrameNode(node, vParent, svg, start, end, {
    instance,
    fallbackRoot,
    resolved: false,
    resolveToken: 0,
    resolveController: void 0
  });
  resolveClientFrame(committed, runtime, runtime.serverFrameReload);
  return committed;
}
function createFrameInstance(node, start, end, runtime, getContext) {
  let instance = createFrame([start, end], {
    name: getFrameName(node),
    src: getFrameSrc(node),
    getContext,
    errorTarget: runtime.errorTarget,
    loadModule: runtime.loadModule,
    resolveFrame: runtime.resolveFrame,
    pendingClientEntries: runtime.pendingClientEntries,
    scheduler: runtime.scheduler,
    styleManager: runtime.styleManager,
    data: {},
    moduleCache: runtime.moduleCache,
    moduleLoads: runtime.moduleLoads,
    frameInstances: runtime.frameInstances,
    namedFrames: runtime.namedFrames,
    processClientEntryPreloads: runtime.processClientEntryPreloads
  });
  runtime.frameInstances.set(start, instance);
  return instance;
}
function commitFrameNode(node, parent, svg, start, end, state) {
  let committed = node;
  committed._parent = parent;
  committed._svg = svg;
  committed._rangeStart = start;
  committed._rangeEnd = end;
  committed._state = state;
  return committed;
}
function resolveClientFrame(node, runtime, serverFrameReload) {
  let frameSrc = getFrameSrc(node);
  let state = node._state;
  let instance = state.instance;
  let token = state.resolveToken + 1;
  state.resolveToken = token;
  state.resolveController?.abort();
  let reload = serverFrameReload ? instance.beginClientFrameReloadForAncestorReload(serverFrameReload.signal) : void 0;
  if (!reload) {
    instance.cancelReload();
  }
  let resolveController = reload?.controller ?? new AbortController();
  state.resolveController = resolveController;
  let isStale = () => state.resolveToken !== token || resolveController.signal.aborted;
  let frameCommitted = Promise.withResolvers();
  let resolve = Promise.resolve().then(
    () => runtime.resolveFrame(frameSrc, {
      signal: resolveController.signal,
      target: getFrameName(node)
    })
  ).then(async (resolution) => {
    if (isStale()) return;
    let { content } = await unwrapFrameResolution(resolution);
    if (isStale()) return;
    state.fallbackRoot?.dispose();
    state.fallbackRoot = void 0;
    let nextContent = asAbortableFrameContent(content, resolveController.signal);
    await instance.render(nextContent, {
      signal: resolveController.signal,
      reconciliationTracker: serverFrameReload?.reconciliationTracker,
      blockingFrameTracker: serverFrameReload?.blockingFrameTracker,
      onCommit: frameCommitted.resolve
    });
    if (isStale()) return;
    state.resolved = true;
  }).catch((error) => {
    if (reload && !isStale()) {
      runtime.errorTarget.dispatchEvent(createComponentErrorEvent(error));
    }
  }).finally(() => {
    frameCommitted.resolve();
    reload?.complete();
    if (state.resolveController === resolveController) {
      state.resolveController = void 0;
    }
  });
  if (serverFrameReload?.reconciliationTracker && !node.props.fallback) {
    serverFrameReload.reconciliationTracker.waitFor(resolve);
  }
  if (serverFrameReload?.blockingFrameTracker && !node.props.fallback) {
    serverFrameReload.blockingFrameTracker.waitFor(frameCommitted.promise);
  }
}
function disposeFrameResources(node) {
  let state = node._state;
  state.resolveToken++;
  state.resolveController?.abort();
  state.resolveController = void 0;
  state.fallbackRoot?.dispose();
  state.fallbackRoot = void 0;
  state.instance.dispose();
}
function asAbortableFrameContent(content, signal) {
  if (!(content instanceof ReadableStream)) return content;
  return createAbortableReadableStream(content, signal);
}
function createAbortableReadableStream(source, signal) {
  let reader = source.getReader();
  let aborted = false;
  let onAbort = () => {
    aborted = true;
    void reader.cancel(signal.reason);
  };
  if (signal.aborted) onAbort();
  else signal.addEventListener("abort", onAbort, { once: true });
  return new ReadableStream({
    async pull(controller) {
      if (aborted) {
        controller.close();
        return;
      }
      let removeAbortReadListener;
      let abortRead = new Promise((resolve) => {
        if (signal.aborted) {
          resolve({ done: true, value: void 0 });
          return;
        }
        let onAbortRead = () => {
          resolve({ done: true, value: void 0 });
        };
        removeAbortReadListener = () => signal.removeEventListener("abort", onAbortRead);
        signal.addEventListener("abort", onAbortRead, { once: true });
      });
      let result = await Promise.race([reader.read(), abortRead]);
      removeAbortReadListener?.();
      if (result.done) {
        controller.close();
        return;
      }
      controller.enqueue(result.value);
    },
    cancel(reason) {
      signal.removeEventListener("abort", onAbort);
      return reader.cancel(reason);
    }
  });
}
function removeDomRange(start, end, domParent) {
  let cursor = start;
  while (cursor) {
    let nextSibling = cursor.nextSibling;
    if (cursor.parentNode === domParent) {
      domParent.removeChild(cursor);
    }
    if (cursor === end) break;
    cursor = nextSibling;
  }
}
function getFrameRuntime(frame) {
  let runtime = frame.$runtime;
  return isFrameRuntime(runtime) ? runtime : void 0;
}
function getFrameSrc(node) {
  return node.props.src;
}
function getFrameName(node) {
  let name2 = node.props.name;
  return typeof name2 === "string" && name2.length > 0 ? name2 : void 0;
}
function randomFrameId() {
  return `f${crypto.randomUUID().slice(0, 8)}`;
}
function skipCommentsExceptBoundaryStart(cursor, preserveClientEntry) {
  while (cursor && cursor.nodeType === Node.COMMENT_NODE) {
    if (isFrameStartComment(cursor)) return cursor;
    if (preserveClientEntry && isCommentNode(cursor) && cursor.data.trim().startsWith("rmx:h:")) {
      return cursor;
    }
    cursor = cursor.nextSibling;
  }
  return cursor;
}
function isFrameStartComment(node) {
  return isCommentNode(node) && node.data.trim().startsWith("rmx:f:");
}
function isFrameEndComment(node) {
  return isCommentNode(node) && node.data.trim() === "/rmx:f";
}
function isCommentNode(node) {
  return node?.nodeType === Node.COMMENT_NODE;
}
function findFrameEndComment(start) {
  let depth = 1;
  let node = start.nextSibling;
  while (node) {
    if (isFrameStartComment(node)) depth++;
    else if (isFrameEndComment(node)) {
      depth--;
      if (depth === 0) return node;
    }
    node = node.nextSibling;
  }
  return null;
}
function renderComponent(currContent, next, domParent, context, anchor, cursor) {
  let { scheduler } = context;
  let handle = next._handle;
  if (handle.isRemoved()) {
    invariant("_content" in next, "Expected removed component to be committed");
    return next;
  }
  let [element, tasks] = handle.render(next.props);
  let content = diffVNodes(currContent, toVNode(element), domParent, next, context, anchor, cursor);
  let committed = commitComponentNode(next, content);
  handle.setScheduleUpdate(scheduler, committed, domParent);
  scheduler.enqueueTasks(tasks);
  return committed;
}
function diffComponent(curr, next, domParent, vParent, context, svg, anchor, cursor) {
  let { frame } = context;
  let handle;
  if (curr === null) {
    let componentId = vParent.kind === "root" ? vParent._pendingHydrationComponentId : void 0;
    if (componentId) {
      if (vParent.kind === "root") vParent._pendingHydrationComponentId = void 0;
    } else {
      componentId = `c${++idCounter2}`;
    }
    handle = createComponent({
      id: componentId,
      frame,
      type: next.type,
      getContext: (type) => findContextFromAncestry(vParent, type),
      getFrameByName(name2) {
        let runtime = getFrameRuntime(frame);
        return runtime?.namedFrames.get(name2);
      },
      getTopFrame() {
        let runtime = getFrameRuntime(frame);
        return runtime?.topFrame;
      }
    });
  } else {
    handle = curr._handle;
  }
  let mounting = beginComponentNode(next, vParent, svg, handle, context);
  return renderComponent(curr && curr._content, mounting, domParent, context, anchor, cursor);
}
function commitClientEntryBoundary(node, parent, svg, start, end) {
  return {
    kind: "client-entry",
    type: node.type,
    key: node.key,
    props: node.props,
    _parent: parent,
    _svg: svg,
    _rangeStart: start,
    _rangeEnd: end
  };
}
function updateClientEntryBoundary(node, context) {
  let element = jsx(node.type, node.props, node.key);
  let owner = getClientEntryBoundaryOwner(node._rangeStart);
  if (owner) {
    owner.root.render(element);
    return;
  }
  let runtime = getFrameRuntime(context.frame);
  let pending = runtime?.pendingClientEntries.get(node._rangeStart);
  invariant(runtime && pending?.[0] === node._rangeEnd, "Expected pending client entry boundary");
  runtime.pendingClientEntries.set(node._rangeStart, [node._rangeEnd, element]);
}
function diffClientEntryBoundary(curr, next, parent, context) {
  let committed = commitClientEntryBoundary(
    next,
    parent,
    curr._svg,
    curr._rangeStart,
    curr._rangeEnd
  );
  updateClientEntryBoundary(committed, context);
  return committed;
}
function disposeCommittedClientEntryBoundary(node, context) {
  getFrameRuntime(context.frame)?.pendingClientEntries.delete(node._rangeStart);
  return disposeClientEntryBoundary(node._rangeStart);
}
function remove2(node, domParent, context) {
  let { scheduler } = context;
  if (isCommittedTextNode(node)) {
    if (domParent) node._dom.parentNode?.removeChild(node._dom);
    return;
  }
  if (isCommittedHostNode(node)) {
    if (domParent) {
      if (node._persistence) return;
      let persistedRemoval = prepareMixinRemoval(node._mixState);
      if (persistedRemoval) {
        let token = ++persistedRemovalToken;
        markNodePersistedByMixins(node, domParent, token);
        void persistedRemoval.catch(() => {
        }).finally(() => {
          if (!node._persistence) return;
          if (node._persistence.token !== token) return;
          unmarkNodePersistedByMixins(node);
          performHostNodeRemoval(node, domParent, context);
        });
        return;
      }
    }
    performHostNodeRemoval(node, domParent, context);
    return;
  }
  if (isFragmentNode(node)) {
    let children = node._children;
    for (let i = 0; i < children.length; i++) {
      remove2(children[i], domParent, context);
    }
    return;
  }
  if (isCommittedComponentNode(node)) {
    remove2(node._content, domParent, context);
    let tasks = node._handle.remove();
    scheduler.enqueueTasks(tasks);
    return;
  }
  if (isCommittedClientEntryNode(node)) {
    let disposedRoot = disposeCommittedClientEntryBoundary(node, context);
    if (!domParent) return;
    if (disposedRoot) {
      node._rangeStart.remove();
      node._rangeEnd.remove();
    } else {
      removeDomRange(node._rangeStart, node._rangeEnd, domParent);
    }
    return;
  }
  if (node.kind === "frame") {
    disposeFrameResources(node);
    if (domParent) removeDomRange(node._rangeStart, node._rangeEnd, domParent);
    return;
  }
}
function performHostNodeRemoval(node, domParent, context) {
  let isHead = domParent !== null && isHeadHostNode(node);
  let children = node._children;
  for (let i = 0; i < children.length; i++) {
    remove2(children[i], isHead ? node._dom : null, context);
  }
  teardownMixins(node._mixState);
  disposeDirectEventListeners(node, isHead);
  disposeControlledReflection(node, isHead);
  if (domParent && !isHead) {
    node._dom.parentNode?.removeChild(node._dom);
  }
}
function diffChildren(curr, next, domParent, vParent, context, cursor, anchor) {
  let hasKeys = hasKeyedChildren(next);
  let committed = next;
  if (curr === null) {
    if (hasKeys) {
      warnDuplicateKeys(next);
    }
    for (let i = 0; i < next.length; i++) {
      committed[i] = insert(next[i], domParent, vParent, context, anchor, cursor);
    }
    return committed;
  }
  if (curr.length > 0 && next.length === 0 && anchor === void 0 && !parentUsesInnerHTML(vParent) && canBulkClearChildren(curr)) {
    for (let i = 0; i < curr.length; i++) {
      remove2(curr[i], null, context);
    }
    domParent.textContent = "";
    return EMPTY_COMMITTED_CHILDREN;
  }
  if (!hasKeys) {
    for (let i = 0; i < next.length; i++) {
      let currentNode = i < curr.length ? curr[i] : null;
      committed[i] = diffVNodes(currentNode, next[i], domParent, vParent, context, anchor, cursor);
    }
    if (curr.length > next.length) {
      for (let i = next.length; i < curr.length; i++) {
        let node = curr[i];
        if (node) remove2(node, domParent, context);
      }
    }
    return committed;
  }
  return patchKeyedChildren(curr, next, domParent, vParent, context, cursor, anchor);
}
function parentUsesInnerHTML(parent) {
  return parent.kind === "host" && getHostProps(parent).innerHTML != null;
}
function canBulkClearChildren(children) {
  for (let i = 0; i < children.length; i++) {
    if (!canBulkClearNode(children[i])) return false;
  }
  return true;
}
function canBulkClearNode(node) {
  if (isCommittedTextNode(node)) return true;
  if (isCommittedHostNode(node)) {
    if (node._mixState) return false;
    return canBulkClearChildren(node._children);
  }
  if (isFragmentNode(node)) {
    return canBulkClearChildren(node._children);
  }
  if (isCommittedComponentNode(node)) {
    return canBulkClearNode(node._content);
  }
  return false;
}
function hasKeyedChildren(children) {
  for (let i = 0; i < children.length; i++) {
    if (children[i].key != null) return true;
  }
  return false;
}
function warnDuplicateKeys(children) {
  let seenKeys;
  let duplicateKeys;
  for (let node of children) {
    if (node.key == null) continue;
    if (!seenKeys) {
      seenKeys = /* @__PURE__ */ new Set([node.key]);
      continue;
    }
    if (seenKeys.has(node.key)) {
      duplicateKeys ??= /* @__PURE__ */ new Set();
      duplicateKeys.add(node.key);
    } else {
      seenKeys.add(node.key);
    }
  }
  if (duplicateKeys?.size) {
    let quotedKeys = Array.from(duplicateKeys, (key) => `"${String(key)}"`);
    console.warn(
      `Duplicate keys detected in siblings: ${quotedKeys.join(", ")}. Keys should be unique.`
    );
  }
}
function patchKeyedChildren(curr, next, domParent, vParent, context, cursor, anchor) {
  let matches = matchKeyedChildrenInOrder(curr, next) ?? matchKeyedChildrenAfterSingleRemoval(curr, next) ?? matchKeyedChildrenAfterPairSwap(curr, next);
  if (!matches) {
    warnDuplicateKeys(next);
    matches = matchKeyedChildren(curr, next);
  }
  let committed = next;
  let matchAnalysis = analyzeKeyedChildMatches(curr.length, matches);
  if (matchAnalysis.hasRemovals) {
    let usedOldIndexes = new Uint8Array(curr.length);
    for (let index = 0; index < matches.length; index++) {
      let oldIndex = matches[index];
      if (oldIndex >= 0) {
        usedOldIndexes[oldIndex] = 1;
      }
    }
    for (let oldIndex = 0; oldIndex < curr.length; oldIndex++) {
      if (usedOldIndexes[oldIndex] === 0) {
        remove2(curr[oldIndex], domParent, context);
      }
    }
  }
  for (let index = 0; index < next.length; index++) {
    let oldIndex = matches[index];
    let oldNode = oldIndex >= 0 ? curr[oldIndex] : null;
    committed[index] = diffVNodes(oldNode, next[index], domParent, vParent, context, anchor, cursor);
  }
  let committedChildren = committed;
  if (matchAnalysis.canSkipPlacement) {
    return committedChildren;
  }
  let stableIndexes = lisMatches(matches);
  let stableCursor = stableIndexes.length - 1;
  let placementAnchor = anchor ?? null;
  for (let index = next.length - 1; index >= 0; index--) {
    let nextNode = committedChildren[index];
    let isStable = stableIndexes[stableCursor] === index;
    if (isStable) {
      stableCursor--;
    } else {
      placeVNode(nextNode, domParent, placementAnchor);
    }
    placementAnchor = findFirstDomAnchor(nextNode) ?? placementAnchor;
  }
  return committedChildren;
}
function matchKeyedChildren(curr, next) {
  let oldKeyMap = /* @__PURE__ */ new Map();
  let usedOldIndexes = /* @__PURE__ */ new Set();
  let unkeyedSearchStart = 0;
  for (let index = 0; index < curr.length; index++) {
    let key = curr[index].key;
    if (key != null) oldKeyMap.set(key, index);
  }
  let matches = [];
  for (let nextIndex = 0; nextIndex < next.length; nextIndex++) {
    let nextNode = next[nextIndex];
    let oldIndex = -1;
    if (nextNode.key != null) {
      let keyedOldIndex = oldKeyMap.get(nextNode.key);
      if (keyedOldIndex !== void 0) {
        let oldNode = curr[keyedOldIndex];
        if (!usedOldIndexes.has(keyedOldIndex) && oldNode.type === nextNode.type) {
          oldIndex = keyedOldIndex;
        }
      }
    } else {
      for (let index = unkeyedSearchStart; index < curr.length; index++) {
        let oldNode = curr[index];
        if (usedOldIndexes.has(index) || oldNode.key != null || oldNode.type !== nextNode.type) {
          continue;
        }
        oldIndex = index;
        unkeyedSearchStart = index + 1;
        break;
      }
    }
    if (oldIndex >= 0) usedOldIndexes.add(oldIndex);
    matches.push(oldIndex);
  }
  return matches;
}
function isSameKeyedNode(oldNode, nextNode) {
  return oldNode.key === nextNode.key && oldNode.type === nextNode.type;
}
function matchKeyedChildrenInOrder(curr, next) {
  let length = Math.min(curr.length, next.length);
  let matches = [];
  for (let index = 0; index < length; index++) {
    let nextNode = next[index];
    if (nextNode.key == null) return null;
    let oldNode = curr[index];
    if (!isSameKeyedNode(oldNode, nextNode)) {
      return null;
    }
    matches.push(index);
  }
  for (let index = length; index < next.length; index++) {
    if (next[index].key == null) return null;
    matches.push(-1);
  }
  return matches;
}
function matchKeyedChildrenAfterSingleRemoval(curr, next) {
  if (curr.length !== next.length + 1) return null;
  let matches = [];
  let oldIndex = 0;
  let skippedOldNode = false;
  for (let nextIndex = 0; nextIndex < next.length; nextIndex++) {
    let nextNode = next[nextIndex];
    if (nextNode.key == null) return null;
    let oldNode = curr[oldIndex];
    if (isSameKeyedNode(oldNode, nextNode)) {
      matches.push(oldIndex);
      oldIndex++;
      continue;
    }
    if (skippedOldNode) return null;
    skippedOldNode = true;
    oldIndex++;
    oldNode = curr[oldIndex];
    if (!isSameKeyedNode(oldNode, nextNode)) {
      return null;
    }
    matches.push(oldIndex);
    oldIndex++;
  }
  return matches;
}
function matchKeyedChildrenAfterPairSwap(curr, next) {
  if (curr.length !== next.length) return null;
  let matches = [];
  let firstMismatch = -1;
  let secondMismatch = -1;
  for (let index = 0; index < next.length; index++) {
    let nextNode = next[index];
    if (nextNode.key == null) return null;
    let oldNode = curr[index];
    if (isSameKeyedNode(oldNode, nextNode)) {
      matches.push(index);
      continue;
    }
    if (firstMismatch === -1) {
      firstMismatch = index;
    } else if (secondMismatch === -1) {
      secondMismatch = index;
    } else {
      return null;
    }
    matches.push(-1);
  }
  if (firstMismatch === -1) return matches;
  if (secondMismatch === -1) return null;
  let firstOldNode = curr[firstMismatch];
  let secondOldNode = curr[secondMismatch];
  let firstNextNode = next[firstMismatch];
  let secondNextNode = next[secondMismatch];
  if (!isSameKeyedNode(firstOldNode, secondNextNode) || !isSameKeyedNode(secondOldNode, firstNextNode)) {
    return null;
  }
  matches[firstMismatch] = secondMismatch;
  matches[secondMismatch] = firstMismatch;
  return matches;
}
function analyzeKeyedChildMatches(currentLength, matches) {
  let hasRemovals = matches.length !== currentLength;
  let canSkipPlacement = true;
  let lastOldIndex = -1;
  let sawNewNode = false;
  for (let index = 0; index < matches.length; index++) {
    let oldIndex = matches[index];
    if (oldIndex < 0) {
      hasRemovals = true;
      sawNewNode = true;
      continue;
    }
    if (sawNewNode || oldIndex < lastOldIndex) {
      canSkipPlacement = false;
    }
    lastOldIndex = oldIndex;
  }
  return { hasRemovals, canSkipPlacement };
}
function lisMatches(matches) {
  let predecessors = Array.from({ length: matches.length });
  let tails = [];
  for (let index = 0; index < matches.length; index++) {
    let value = matches[index] + 1;
    if (value === 0) continue;
    let low = 0;
    let high = tails.length;
    while (low < high) {
      let middle = low + high >> 1;
      if (matches[tails[middle]] + 1 < value) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    predecessors[index] = low > 0 ? tails[low - 1] : -1;
    tails[low] = index;
  }
  let cursor = tails.at(-1) ?? -1;
  for (let index = tails.length - 1; index >= 0; index--) {
    tails[index] = cursor;
    cursor = predecessors[cursor] ?? -1;
  }
  return tails;
}
function placeVNode(node, domParent, anchor) {
  let firstDom = findFirstDomAnchor(node);
  if (!firstDom || firstDom.parentNode !== domParent) return;
  let lastDom = findLastDomAnchor(node);
  if (!lastDom) return;
  if (anchor && domRangeContainsNode(firstDom, lastDom, anchor)) return;
  if (firstDom === anchor) return;
  moveDomRange(domParent, firstDom, lastDom, anchor);
}
function findFirstDomAnchor(node) {
  return findEdgeDomNode(node, false);
}
function findLastDomAnchor(node) {
  return findEdgeDomNode(node, true);
}
function findEdgeDomNode(node, last) {
  if (!node) return null;
  if (isCommittedTextNode(node) || isCommittedHostNode(node)) return node._dom;
  if (isCommittedComponentNode(node)) return findEdgeDomNode(node._content, last);
  if (isCommittedClientEntryNode(node) || node.kind === "frame") {
    return last ? node._rangeEnd : node._rangeStart;
  }
  if (isFragmentNode(node)) {
    let children = node._children;
    for (let i = 0; i < children.length; i++) {
      let dom = findEdgeDomNode(children[last ? children.length - 1 - i : i], last);
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
function setActiveSchedulerUpdateParents(parents) {
  activeSchedulerUpdateParents = parents;
}
function shouldDispatchInlineMixinLifecycle(node) {
  let parents = activeSchedulerUpdateParents;
  if (!parents?.length) return true;
  for (let parent of parents) {
    if (parent instanceof Node && parent.contains(node)) return false;
  }
  return true;
}
function findNextSiblingDomAnchor(curr) {
  let vParent = curr._parent;
  if (vParent.kind === "component") return findNextSiblingDomAnchor(vParent);
  let children = vParent._children;
  if (children.length === 0) {
    if (vParent.kind === "root") return vParent._rangeEnd ?? null;
    if (vParent.kind === "fragment") return findNextSiblingDomAnchor(vParent);
    return null;
  }
  let idx = children.indexOf(curr);
  if (idx === -1) return null;
  for (let i = idx + 1; i < children.length; i++) {
    let dom = findFirstDomAnchor(children[i]);
    if (dom) return dom;
  }
  if (isFragmentNode(vParent)) {
    return findNextSiblingDomAnchor(vParent);
  }
  return vParent.kind === "root" ? vParent._rangeEnd ?? null : null;
}
function reclaimPersistedMixinNode(persistedNode, newNode, vParent, context, svg) {
  let { frame, scheduler } = context;
  cancelPendingMixinRemoval(persistedNode._mixState);
  unmarkNodePersistedByMixins(persistedNode);
  let prevProps = getHostProps(persistedNode);
  let childInputs = newNode._children;
  let resolved = resolveNodeMixProps(newNode, vParent, frame, scheduler, persistedNode._mixState);
  let committed = commitRetainedHostNode(persistedNode, newNode, vParent, svg, resolved);
  if (shouldDispatchInlineMixinLifecycle(persistedNode._dom)) {
    dispatchMixinBeforeUpdate(committed._mixState);
  }
  patchHostProps(prevProps, resolved.props, persistedNode._dom);
  syncDirectEventListeners(committed);
  ensureControlledReflection(committed, scheduler);
  syncControlledReflection(committed, scheduler);
  committed._children = diffChildren(
    persistedNode._children,
    childInputs,
    persistedNode._dom,
    committed,
    context
  );
  bindNodeMixRuntime(committed, context, true);
  if (shouldDispatchInlineMixinLifecycle(persistedNode._dom)) {
    scheduler.enqueueCommitPhase([() => dispatchMixinCommit(committed._mixState)]);
  }
  return committed;
}

// ../../../src/style/layers.ts
var REMIX_UI_STYLE_LAYER = "rmx";

// ../../../src/style/stylesheet.ts
var SERVER_STYLE_SELECTOR = "style[data-rmx-style]";
function getStyleLayerName(className, layer = REMIX_UI_STYLE_LAYER) {
  return `${layer}.${className}`;
}
function compareNodesInDocumentOrder(a, b) {
  if (a === b) return 0;
  let position = a.compareDocumentPosition(b);
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  return 0;
}
function isParentNode(value) {
  return "querySelectorAll" in value;
}
function collectServerStyleTagsFromNode(node, into) {
  if (isHtmlStyleElement(node) && node.matches(SERVER_STYLE_SELECTOR)) {
    into.add(node);
    return;
  }
  if (!(node instanceof Element) && !(node instanceof Document) && !(node instanceof DocumentFragment)) {
    return;
  }
  let nested = node.querySelectorAll?.(SERVER_STYLE_SELECTOR) ?? [];
  for (let i = 0; i < nested.length; i++) {
    let el2 = nested[i];
    if (isHtmlStyleElement(el2)) {
      into.add(el2);
    }
  }
}
function collectServerStyleTags(source) {
  let styles = /* @__PURE__ */ new Set();
  if (isParentNode(source)) {
    collectServerStyleTagsFromNode(source, styles);
  } else {
    for (let node of source) {
      collectServerStyleTagsFromNode(node, styles);
    }
  }
  return Array.from(styles).sort(compareNodesInDocumentOrder);
}
function isHtmlStyleElement(node) {
  return typeof node === "object" && node !== null && node instanceof HTMLStyleElement;
}
function getStyleSelector(styleEl) {
  let selector = styleEl.getAttribute("data-rmx-style")?.trim();
  return selector ? selector : null;
}
function createStyleManager(layer = REMIX_UI_STYLE_LAYER) {
  let stylesheet = null;
  let generation = 0;
  let ruleMap = /* @__PURE__ */ new Map();
  function getStylesheet() {
    if (!stylesheet) {
      stylesheet = new CSSStyleSheet();
      document.adoptedStyleSheets.push(stylesheet);
    }
    return stylesheet;
  }
  function removeStylesheet() {
    if (!stylesheet) return;
    document.adoptedStyleSheets = Array.from(document.adoptedStyleSheets).filter(
      (s) => s !== stylesheet
    );
    stylesheet = null;
  }
  function clearStylesheet() {
    if (!stylesheet) return;
    for (let i = stylesheet.cssRules.length - 1; i >= 0; i--) {
      stylesheet.deleteRule(i);
    }
  }
  function adoptServerStyleTag(styleEl) {
    let selector = getStyleSelector(styleEl);
    if (!selector) return void 0;
    let entry = ruleMap.get(selector);
    if (entry) {
      entry.pinned = true;
      styleEl.remove();
      return selector;
    }
    let cssText = styleEl.textContent?.trim() ?? "";
    if (cssText.length === 0) {
      styleEl.remove();
      return void 0;
    }
    try {
      let sheet = getStylesheet();
      let index = sheet.cssRules.length;
      sheet.insertRule(cssText, index);
      ruleMap.set(selector, { count: 0, index, pinned: true });
      styleEl.remove();
      return selector;
    } catch {
      return void 0;
    }
  }
  function has(className) {
    let entry = ruleMap.get(className);
    return entry !== void 0 && (entry.pinned || entry.count > 0);
  }
  function getGeneration() {
    return generation;
  }
  function insert2(className, rule) {
    let entry = ruleMap.get(className);
    if (entry) {
      if (!entry.pinned) entry.count++;
      return;
    }
    let sheet = getStylesheet();
    let index = sheet.cssRules.length;
    sheet.insertRule(`@layer ${getStyleLayerName(className, layer)} { ${rule} }`, index);
    ruleMap.set(className, { count: 1, index, pinned: false });
  }
  function remove3(className) {
    let entry = ruleMap.get(className);
    if (!entry || entry.pinned) return;
    entry.count--;
    if (entry.count > 0) {
      return;
    }
    let indexToDelete = entry.index;
    ruleMap.delete(className);
    if (!stylesheet) return;
    stylesheet.deleteRule(indexToDelete);
    for (let [, data] of ruleMap.entries()) {
      if (data.index > indexToDelete) {
        data.index--;
      }
    }
  }
  function reset() {
    clearStylesheet();
    ruleMap.clear();
    removeStylesheet();
    generation++;
  }
  function adoptServerStyles(source) {
    let styles = collectServerStyleTags(source);
    let adopted = /* @__PURE__ */ new Set();
    for (let styleEl of styles) {
      let selector = adoptServerStyleTag(styleEl);
      if (selector) adopted.add(selector);
    }
    return adopted;
  }
  function selectors() {
    return ruleMap.keys();
  }
  function dispose() {
    removeStylesheet();
    ruleMap.clear();
    generation++;
  }
  return {
    insert: insert2,
    remove: remove3,
    has,
    getGeneration,
    reset,
    adoptServerStyles,
    selectors,
    dispose
  };
}

// ../../../src/runtime/diff-props.ts
var globalStyleManager = typeof window !== "undefined" ? createStyleManager() : null;
var defaultStyleManager = globalStyleManager;

// ../../../src/runtime/scheduler.ts
var CASCADING_UPDATE_WARN_THRESHOLD = 50;
var MAX_CASCADING_COMPONENT_UPDATES = 50;
function getComponentName(vnode) {
  return vnode.type.name || "Anonymous";
}
function formatComponentCounts(counts) {
  return Array.from(counts, ([name2, count]) => `${name2} x${count}`).join(", ");
}
function createScheduler(doc, rootTarget, styles = defaultStyleManager) {
  let documentState = createDocumentState(doc);
  let scheduled = /* @__PURE__ */ new Map();
  let workTasks = [];
  let commitPhaseTasks = [];
  let postCommitTasks = [];
  let flushScheduled = false;
  let flushing = false;
  let cascadingComponentUpdateCount = 0;
  let cascadingComponentUpdateCounts = /* @__PURE__ */ new WeakMap();
  let cascadingComponentNameCounts = /* @__PURE__ */ new Map();
  let warnedAboutCascadingUpdates = false;
  let resetScheduled = false;
  let phaseEvents = new EventTarget();
  let phaseListenerCounts = {
    beforeUpdate: 0,
    commit: 0
  };
  let scheduler;
  function dispatchError(error) {
    console.error(error);
    rootTarget.dispatchEvent(createComponentErrorEvent(error));
  }
  function scheduleCounterReset() {
    if (resetScheduled) return;
    resetScheduled = true;
    setTimeout(() => {
      cascadingComponentUpdateCount = 0;
      cascadingComponentUpdateCounts = /* @__PURE__ */ new WeakMap();
      cascadingComponentNameCounts = /* @__PURE__ */ new Map();
      warnedAboutCascadingUpdates = false;
      resetScheduled = false;
    }, 0);
  }
  function trackCascadingUpdate(vnode) {
    cascadingComponentUpdateCount++;
    let componentName = getComponentName(vnode);
    cascadingComponentNameCounts.set(
      componentName,
      (cascadingComponentNameCounts.get(componentName) ?? 0) + 1
    );
    let componentUpdateCount = (cascadingComponentUpdateCounts.get(vnode) ?? 0) + 1;
    cascadingComponentUpdateCounts.set(vnode, componentUpdateCount);
    scheduleCounterReset();
    if (!warnedAboutCascadingUpdates && cascadingComponentUpdateCount >= CASCADING_UPDATE_WARN_THRESHOLD) {
      warnedAboutCascadingUpdates = true;
      console.warn(
        `${cascadingComponentUpdateCount} cascading component updates detected in one event loop turn. Consider reducing hydration regions. Components: ${formatComponentCounts(cascadingComponentNameCounts)}`
      );
    }
    if (componentUpdateCount > MAX_CASCADING_COMPONENT_UPDATES) {
      let error = new Error(
        `handle.update() infinite loop detected in ${componentName} after ${componentUpdateCount} cascading updates. Components: ${formatComponentCounts(cascadingComponentNameCounts)}`
      );
      dispatchError(error);
      return false;
    }
    return true;
  }
  function flush() {
    if (flushing) return;
    flushing = true;
    try {
      while (true) {
        flushScheduled = false;
        let batch = new Map(scheduled);
        scheduled.clear();
        let hasWork = batch.size > 0 || workTasks.length > 0 || commitPhaseTasks.length > 0 || postCommitTasks.length > 0;
        if (!hasWork) return;
        documentState.capture();
        let updateParents = batch.size > 0 ? Array.from(new Set(batch.values())) : [];
        setActiveSchedulerUpdateParents(updateParents);
        dispatchPhaseEvent("beforeUpdate", updateParents);
        if (batch.size > 0) {
          let vnodes = Array.from(batch);
          let noScheduledAncestor = /* @__PURE__ */ new Set();
          for (let [vnode, domParent] of vnodes) {
            if (ancestorIsScheduled(vnode, batch, noScheduledAncestor)) continue;
            if (!trackCascadingUpdate(vnode)) return;
            let curr = vnode._content;
            let anchor = findNextSiblingDomAnchor(vnode) || void 0;
            try {
              renderComponent(curr, vnode, domParent, vnode._context, anchor);
            } catch (error) {
              dispatchError(error);
            }
          }
        }
        flushTaskQueue(workTasks);
        setActiveSchedulerUpdateParents(void 0);
        documentState.restore();
        flushTaskQueue(commitPhaseTasks);
        dispatchPhaseEvent("commit", updateParents);
        flushTaskQueue(postCommitTasks);
      }
    } finally {
      setActiveSchedulerUpdateParents(void 0);
      flushing = false;
    }
  }
  function dispatchPhaseEvent(type, parents) {
    if (phaseListenerCounts[type] === 0) return;
    let event = Object.assign(new Event(type), { parents });
    phaseEvents.dispatchEvent(event);
  }
  function flushTaskQueue(queue) {
    while (queue.length > 0) {
      let task = queue.shift();
      if (!task) continue;
      try {
        task();
      } catch (error) {
        dispatchError(error);
      }
    }
  }
  function scheduleFlush() {
    if (flushScheduled || flushing) return;
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
      current = current.kind === "root" ? void 0 : current._parent;
    }
    for (let node of path) safe.add(node);
    return false;
  }
  scheduler = {
    enqueue(vnode, domParent) {
      scheduled.set(vnode, domParent);
      scheduleFlush();
    },
    enqueueWork(newTasks) {
      workTasks.push(...newTasks);
      scheduleFlush();
    },
    enqueueCommitPhase(newTasks) {
      commitPhaseTasks.push(...newTasks);
      scheduleFlush();
    },
    enqueueTasks(newTasks) {
      postCommitTasks.push(...newTasks);
      scheduleFlush();
    },
    addEventListener(type, listener, options) {
      if (listener) phaseListenerCounts[type]++;
      phaseEvents.addEventListener(type, listener, options);
    },
    removeEventListener(type, listener, options) {
      if (listener) phaseListenerCounts[type] = Math.max(0, phaseListenerCounts[type] - 1);
      phaseEvents.removeEventListener(type, listener, options);
    },
    dequeue() {
      flush();
    }
  };
  return scheduler;
}

// ../../../src/runtime/vdom.ts
function getHydrationComponentIdFromRangeStart(start) {
  if (!(start instanceof Comment)) return void 0;
  let marker = start.data.trim();
  if (!marker.startsWith("rmx:h:")) return void 0;
  let id = marker.slice("rmx:h:".length);
  return id.length > 0 ? id : void 0;
}
function createRangeRoot(boundaries, options = {}) {
  let [start, end] = boundaries;
  let container = end.parentNode;
  invariant(container, "Expected parent node");
  invariant(start.parentNode === container, "Boundaries must share parent");
  return createVirtualRoot(container, start.nextSibling, options, start, end);
}
function createRoot(container, options = {}) {
  let styles = options.styleManager ?? defaultStyleManager;
  if (container.innerHTML.trim() !== "") {
    styles.adoptServerStyles(container);
  }
  let hydrationStart = container.innerHTML.trim() !== "" ? container.firstChild : null;
  return createVirtualRoot(container, hydrationStart, options);
}
function createVirtualRoot(parent, hydrationStart, options, rangeStart, rangeEnd) {
  let vroot = null;
  let currentElement;
  let styles = options.styleManager ?? defaultStyleManager;
  let hydrationCursor = hydrationStart;
  let eventTarget = new TypedEventTarget();
  let scheduler = options.scheduler ?? createScheduler(parent.ownerDocument ?? document, eventTarget, styles);
  let frameStub = options.frame ?? createRootFrameHandle({
    src: options.frameInit?.src,
    resolveFrame: options.frameInit?.resolveFrame,
    loadModule: options.frameInit?.loadModule,
    errorTarget: eventTarget,
    scheduler,
    styleManager: styles
  });
  let context = {
    frame: frameStub,
    scheduler,
    styles,
    rootTarget: eventTarget
  };
  let isErrorForwardingAttached = false;
  function forwardDomError(event) {
    eventTarget.dispatchEvent(createComponentErrorEvent(getComponentError(event)));
  }
  function attachDomErrorForwarding() {
    if (isErrorForwardingAttached) return;
    parent.addEventListener("error", forwardDomError);
    isErrorForwardingAttached = true;
  }
  function detachDomErrorForwarding() {
    if (!isErrorForwardingAttached) return;
    parent.removeEventListener("error", forwardDomError);
    isErrorForwardingAttached = false;
  }
  attachDomErrorForwarding();
  let root2 = Object.assign(eventTarget, {
    render(element) {
      attachDomErrorForwarding();
      currentElement = element;
      let vnode = toVNode(element);
      let vParent = {
        kind: "root",
        type: ROOT_VNODE,
        _children: [],
        _svg: false,
        _getContext: options.getContext,
        _rangeStart: rangeStart,
        _rangeEnd: rangeEnd,
        _pendingHydrationComponentId: getHydrationComponentIdFromRangeStart(rangeStart)
      };
      scheduler.enqueueWork([
        () => {
          let cursor = hydrationCursor === null ? void 0 : { current: hydrationCursor };
          let committed = diffVNodes(vroot, vnode, parent, vParent, context, rangeEnd, cursor);
          vParent._children = [committed];
          vroot = committed;
          hydrationCursor = null;
        }
      ]);
      scheduler.dequeue();
    },
    reconcile() {
      if (currentElement === void 0) return;
      root2.render(currentElement);
    },
    dispose() {
      detachDomErrorForwarding();
      unregisterRoot(root2);
      currentElement = void 0;
      if (!vroot) return;
      let current = vroot;
      vroot = null;
      scheduler.enqueueWork([() => remove2(current, parent, context)]);
      scheduler.dequeue();
    },
    flush() {
      scheduler.dequeue();
    }
  });
  registerRoot(root2);
  return root2;
}
function createRootFrameHandle(init) {
  let resolveFrame = init.resolveFrame ?? (() => {
    throw new Error(
      "Cannot render <Frame /> without frame runtime. Use run() or pass frameInit to createRoot/createRangeRoot."
    );
  });
  let runtime = createFrameRuntime({
    topFrame: void 0,
    loadModule: init.loadModule ?? (() => {
      throw new Error("loadModule is required to hydrate client entries inside <Frame />");
    }),
    resolveFrame,
    errorTarget: init.errorTarget,
    pendingClientEntries: /* @__PURE__ */ new Map(),
    scheduler: init.scheduler,
    styleManager: init.styleManager,
    moduleCache: /* @__PURE__ */ new Map(),
    moduleLoads: /* @__PURE__ */ new Map(),
    frameInstances: /* @__PURE__ */ new WeakMap(),
    namedFrames: new NamedFrameRegistry()
  });
  runtime.canResolveFrames = !!init.resolveFrame;
  let frame = createFrameHandle({ src: init.src ?? "/", $runtime: runtime });
  runtime.topFrame = frame;
  return frame;
}

// ../../../src/runtime/frame-markers.ts
function isCommentNode2(node) {
  return node?.nodeType === Node.COMMENT_NODE;
}
function isFrameStart(node) {
  return isCommentNode2(node) && node.data.trim().startsWith("rmx:f:");
}
function isFrameEnd(node) {
  return isCommentNode2(node) && node.data.trim() === "/rmx:f";
}
function isHydrationStart(node) {
  return isCommentNode2(node) && node.data.trim().startsWith("rmx:h:");
}
function isHydrationEnd(node) {
  return isCommentNode2(node) && node.data.trim() === "/rmx:h";
}
function getFrameId(start) {
  let trimmed = start.data.trim();
  invariant(trimmed.startsWith("rmx:f:"), "Invalid frame start marker");
  return trimmed.slice("rmx:f:".length);
}
function findEndMarker(start, isStart, isEnd, message = "End marker not found") {
  let node = start.nextSibling;
  let depth = 1;
  while (node) {
    if (isStart(node)) depth++;
    else if (isEnd(node)) {
      depth--;
      if (depth === 0) return node;
    }
    node = node.nextSibling;
  }
  throw new Error(message);
}
function collectNodesBetween(start, end) {
  let nodes = [];
  let node = start.nextSibling;
  while (node && node !== end) {
    nodes.push(node);
    node = node.nextSibling;
  }
  return nodes;
}

// ../../../src/runtime/diff-dom.ts
var REMIX_PRESERVE_DOM_ATTRIBUTE = "data-rmx-preserve-dom";
function diffNodes(curr, next, context) {
  let parent = curr[0]?.parentNode ?? context.regionParent ?? null;
  invariant(parent, "Parent node not found");
  let regionTailRef = context.regionTailRef ?? (curr.length > 0 ? curr[curr.length - 1].nextSibling : null);
  diffSiblingUnits(curr, next, parent, regionTailRef, context);
}
function diffNode(current, next, context) {
  if (isTextNode(current) && isTextNode(next)) {
    let newText = next.textContent || "";
    if (current.textContent !== newText) current.textContent = newText;
    return;
  }
  if (isHydrationStart(current) && isHydrationStart(next)) {
    let nextData = next.data;
    if (current.data !== nextData) {
      current.data = nextData;
    }
    return findHydrationEndMarker(next);
  }
  if (isCommentNode2(current) && isCommentNode2(next) && markerKindsMatch(current, next)) {
    let newData = next.data;
    if (isFrameStartMarker(current)) {
      if (shouldPreserveFrameStartMarker(current, next, context)) {
        if (current.data !== newData) {
          current.data = newData;
        }
        let frame = context.frameInstances.get(current);
        let nextMarkerData = getFrameMarkerData(next, context);
        if (frame && nextMarkerData) {
          if (nextMarkerData.status === "resolved") {
            let nextEnd = findFrameEndMarker(next);
            let nextContent = collectFrameContentFragment(current.ownerDocument, next, nextEnd);
            let render = frame.renderMarkerContent(
              { ...nextMarkerData, id: getFrameId(next) },
              nextContent,
              {
                data: context.data,
                signal: context.signal,
                reconciliationTracker: context.reconciliationTracker
              }
            );
            if (context.reconciliationTracker) context.reconciliationTracker.waitFor(render);
            else void render;
            return nextEnd;
          }
          if (frame.isDisplayingResolvedContent()) {
            return findFrameEndMarker(next);
          }
        }
      } else if (current.data !== newData) {
        disposeFrameStartMarker(current, context);
      }
    }
    if (current.data !== newData) {
      current.data = newData;
    }
    return;
  }
  if (isElement(current) && isElement(next) && current.tagName === next.tagName) {
    if (shouldPreserveDomElement(current, next)) return;
    diffElementAttributes(current, next);
    if (shouldPreserveElementChildren(current, next)) return;
    diffElementChildren(current, next, context);
    return;
  }
  let parent = current.parentNode;
  if (parent) {
    parent.insertBefore(next, current);
    removeNode(current, parent, context);
  }
}
function diffElementAttributes(current, next) {
  let prevAttrNames = current.getAttributeNames();
  let nextAttrNames = next.getAttributeNames();
  let preservedNames = next.getAttribute("data-rmx-preserve-attrs")?.split(/[\t\n\f\r ]+/);
  let nextNameSet = new Set(nextAttrNames);
  for (let name2 of prevAttrNames) {
    if (preservedNames?.includes(name2)) continue;
    if (!nextNameSet.has(name2)) {
      if (shouldPreserveLiveAttribute(current, next, name2)) continue;
      current.removeAttribute(name2);
    }
  }
  for (let name2 of nextAttrNames) {
    if (preservedNames?.includes(name2)) continue;
    let prevVal = current.getAttribute(name2);
    let nextVal = next.getAttribute(name2);
    if (prevVal !== nextVal) {
      if (shouldPreserveLiveAttribute(current, next, name2)) continue;
      current.setAttribute(name2, nextVal == null ? "" : String(nextVal));
    }
  }
}
function shouldPreserveDomElement(current, next) {
  if (!next.hasAttribute(REMIX_PRESERVE_DOM_ATTRIBUTE)) return false;
  if (!current.hasAttribute(REMIX_PRESERVE_DOM_ATTRIBUTE)) {
    current.setAttribute(REMIX_PRESERVE_DOM_ATTRIBUTE, "");
  }
  return true;
}
function shouldPreserveLiveAttribute(current, next, name2) {
  if (name2 === "open") {
    if (current instanceof HTMLDetailsElement && next instanceof HTMLDetailsElement) {
      return current.open !== next.open;
    }
    if (current instanceof HTMLDialogElement && next instanceof HTMLDialogElement) {
      return current.open !== next.open;
    }
  }
  if (name2 === "checked") {
    if (current instanceof HTMLInputElement && next instanceof HTMLInputElement) {
      return current.checked !== next.checked;
    }
  }
  if (name2 === "value") {
    if (current instanceof HTMLInputElement && next instanceof HTMLInputElement && shouldPreserveInputValue(current)) {
      return current.value !== next.value;
    }
  }
  if (name2 === "selected") {
    if (current instanceof HTMLOptionElement && next instanceof HTMLOptionElement) {
      return current.selected !== next.selected;
    }
  }
  if (name2 === "popover") {
    return isPopoverOpen(current) !== isPopoverOpen(next);
  }
  return false;
}
function shouldPreserveElementChildren(current, next) {
  if (current instanceof HTMLTextAreaElement && next instanceof HTMLTextAreaElement) {
    return current.value !== next.value;
  }
  return false;
}
function shouldPreserveInputValue(input) {
  return !["button", "checkbox", "hidden", "image", "radio", "reset", "submit"].includes(input.type);
}
function isPopoverOpen(element) {
  try {
    return element.matches(":popover-open");
  } catch {
    return false;
  }
}
function diffElementChildren(current, next, context) {
  let shouldPreserveHeadNode = context.shouldPreserveHeadNode;
  let preservedHeadNodes = [];
  let currentChildren = Array.from(current.childNodes);
  if (current === current.ownerDocument.head && shouldPreserveHeadNode) {
    preservedHeadNodes = currentChildren.filter(shouldPreserveHeadNode);
    currentChildren = currentChildren.filter((node) => !shouldPreserveHeadNode(node));
  }
  let nextChildren = Array.from(next.childNodes);
  diffSiblingUnits(currentChildren, nextChildren, current, preservedHeadNodes[0] ?? null, context);
}
function diffSiblingUnits(currentNodes, nextNodes, parent, regionTailRef, context) {
  let currentUnits = parseSiblingUnits(currentNodes);
  let nextUnits = parseSiblingUnits(nextNodes);
  let keyToIndex = /* @__PURE__ */ new Map();
  for (let i = 0; i < currentUnits.length; i++) {
    let key = getSiblingUnitKey(currentUnits[i]);
    if (key !== void 0) keyToIndex.set(key, i);
  }
  let used = new Array(currentUnits.length).fill(false);
  let matchIndexForNext = new Array(nextUnits.length).fill(-1);
  for (let i = 0; i < nextUnits.length; i++) {
    let nextUnit = nextUnits[i];
    let matchIndex = -1;
    let key = getSiblingUnitKey(nextUnit);
    if (key !== void 0) {
      let keyedIndex = keyToIndex.get(key);
      if (keyedIndex !== void 0 && !used[keyedIndex] && siblingUnitsComparable(currentUnits[keyedIndex], nextUnit)) {
        matchIndex = keyedIndex;
      }
    }
    if (matchIndex === -1 && nextUnit.kind !== "node") {
      for (let j = 0; j < currentUnits.length; j++) {
        let currentUnit = currentUnits[j];
        if (used[j] || currentUnit.kind !== nextUnit.kind) continue;
        if (shouldPreserveBoundaryUnit(currentUnit, nextUnit, context)) {
          matchIndex = j;
          break;
        }
      }
    }
    if (matchIndex !== -1) used[matchIndex] = true;
    matchIndexForNext[i] = matchIndex;
  }
  let remainingCurrentIndexes = [];
  for (let i = 0; i < currentUnits.length; i++) {
    if (!used[i]) remainingCurrentIndexes.push(i);
  }
  let remainingNextIndexes = [];
  for (let i = 0; i < nextUnits.length; i++) {
    if (matchIndexForNext[i] === -1) remainingNextIndexes.push(i);
  }
  let remainingLength = Math.min(remainingCurrentIndexes.length, remainingNextIndexes.length);
  for (let i = 0; i < remainingLength; i++) {
    let currentIndex = remainingCurrentIndexes[i];
    let nextIndex = remainingNextIndexes[i];
    let currentUnit = currentUnits[currentIndex];
    let nextUnit = nextUnits[nextIndex];
    if (currentUnit.kind !== "node" || nextUnit.kind !== "node" || getSiblingUnitKey(currentUnit) !== void 0 || getSiblingUnitKey(nextUnit) !== void 0 || !siblingUnitsComparable(currentUnit, nextUnit)) {
      continue;
    }
    used[currentIndex] = true;
    matchIndexForNext[nextIndex] = currentIndex;
  }
  let committed = new Array(nextUnits.length);
  for (let i = 0; i < nextUnits.length; i++) {
    let matchIndex = matchIndexForNext[i];
    let nextUnit = nextUnits[i];
    if (matchIndex === -1) {
      committed[i] = nextUnit;
      continue;
    }
    let currentUnit = currentUnits[matchIndex];
    if (currentUnit.kind === "node" && nextUnit.kind === "node") {
      diffNode(currentUnit.node, nextUnit.node, context);
      committed[i] = currentUnit;
      continue;
    }
    invariant(currentUnit.kind !== "node" && nextUnit.kind !== "node", "Expected boundaries");
    if (!shouldPreserveBoundaryUnit(currentUnit, nextUnit, context)) {
      replaceCommentMarkerRange(currentUnit.start, nextUnit.start, parent, context);
      committed[i] = nextUnit;
      continue;
    }
    let cursor = diffNode(currentUnit.start, nextUnit.start, context);
    if (!cursor && currentUnit.kind === "frame" && nextUnit.kind === "frame") {
      diffNodes(
        collectNodesBetween(currentUnit.start, currentUnit.end),
        nextNodes.slice(nextUnit.startIndex + 1, nextUnit.endIndex),
        {
          ...context,
          regionParent: parent,
          regionTailRef: currentUnit.end
        }
      );
    }
    committed[i] = currentUnit;
  }
  for (let i = 0; i < currentUnits.length; i++) {
    if (!used[i]) removeSiblingUnit(currentUnits[i], parent, context);
  }
  let anchor = regionTailRef;
  for (let i = committed.length - 1; i >= 0; i--) {
    let unit = committed[i];
    let first = getSiblingUnitFirstNode(unit);
    let ref = anchor?.parentNode === parent ? anchor : null;
    if (unit.kind === "node" && isPreservedDomElement(unit.node) && unit.node.parentNode === parent) {
      anchor = unit.node;
      continue;
    }
    placeSiblingUnitBefore(unit, parent, ref);
    if (first.parentNode === parent) anchor = first;
  }
}
function parseSiblingUnits(nodes) {
  let units = [];
  for (let i = 0; i < nodes.length; i++) {
    let node = nodes[i];
    if (isHydrationStart(node)) {
      let endIndex = findEndIndex(nodes, i, isHydrationStart, isHydrationEnd);
      invariant(endIndex > i, "Hydration end marker not found");
      let end = nodes[endIndex];
      invariant(isHydrationEnd(end), "Expected hydration end marker");
      units.push({ kind: "hydration", start: node, end, startIndex: i, endIndex });
      i = endIndex;
      continue;
    }
    if (isFrameStartMarker(node)) {
      let endIndex = findEndIndex(nodes, i, isFrameStartMarker, isFrameEndMarker);
      invariant(endIndex > i, "Frame end marker not found");
      let end = nodes[endIndex];
      invariant(isFrameEndMarker(end), "Expected frame end marker");
      units.push({ kind: "frame", start: node, end, startIndex: i, endIndex });
      i = endIndex;
      continue;
    }
    invariant(!isHydrationEnd(node), "Unexpected hydration end marker");
    invariant(!isFrameEndMarker(node), "Unexpected frame end marker");
    units.push({ kind: "node", node, startIndex: i, endIndex: i });
  }
  return units;
}
function getSiblingUnitKey(unit) {
  if (unit.kind !== "node" || !isElement(unit.node)) return;
  return unit.node.getAttribute("data-rmx-key") ?? void 0;
}
function siblingUnitsComparable(current, next) {
  if (current.kind !== next.kind) return false;
  if (current.kind !== "node" || next.kind !== "node") return true;
  return nodeTypesComparable(current.node, next.node);
}
function shouldPreserveBoundaryUnit(current, next, context) {
  if (current.kind !== next.kind) return false;
  return current.kind === "frame" ? shouldPreserveFrameStartMarker(current.start, next.start, context) : shouldPreserveHydrationStartMarker(current.start, next.start, context);
}
function getSiblingUnitFirstNode(unit) {
  return unit.kind === "node" ? unit.node : unit.start;
}
function placeSiblingUnitBefore(unit, parent, ref) {
  if (unit.kind === "node") {
    if (unit.node.parentNode !== parent || unit.node.nextSibling !== ref) {
      parent.insertBefore(unit.node, ref);
    }
    return;
  }
  let nodes = collectNodeRange(unit.start, unit.end);
  if (unit.start.parentNode === parent && unit.end.nextSibling === ref) return;
  let fragment = unit.start.ownerDocument.createDocumentFragment();
  for (let node of nodes) fragment.appendChild(node);
  parent.insertBefore(fragment, ref);
}
function removeSiblingUnit(unit, parent, context) {
  if (unit.kind === "node") {
    removeNode(unit.node, parent, context);
    return;
  }
  for (let node of collectNodeRange(unit.start, unit.end)) {
    removeNode(node, parent, context);
  }
}
function isPreservedDomElement(node) {
  return isElement(node) && node.hasAttribute(REMIX_PRESERVE_DOM_ATTRIBUTE);
}
function nodeTypesComparable(a, b) {
  if (isTextNode(a) && isTextNode(b)) return true;
  if (isElement(a) && isElement(b)) return a.tagName === b.tagName;
  if (isCommentNode2(a) && isCommentNode2(b)) return markerKindsMatch(a, b);
  return false;
}
function getMarkerKind(node) {
  if (!isCommentNode2(node)) return void 0;
  if (isFrameStartMarker(node)) return "frame-start";
  if (isFrameEndMarker(node)) return "frame-end";
  if (isHydrationStart(node)) return "virtual-root-start";
  if (isHydrationEnd(node)) return "virtual-root-end";
  return void 0;
}
function markerKindsMatch(a, b) {
  return getMarkerKind(a) === getMarkerKind(b);
}
function findHydrationEndMarker(start) {
  return findEndMarker(start, isHydrationStart, isHydrationEnd, "Hydration end marker not found");
}
function findFrameEndMarker(start) {
  return findEndMarker(start, isFrameStartMarker, isFrameEndMarker, "Frame end marker not found");
}
function findEndIndex(nodes, startIndex, isStart, isEnd) {
  let depth = 1;
  for (let j = startIndex + 1; j < nodes.length; j++) {
    let node = nodes[j];
    if (isStart(node)) depth++;
    else if (isEnd(node)) {
      depth--;
      if (depth === 0) return j;
    }
  }
  return startIndex;
}
function isTextNode(node) {
  return node.nodeType === Node.TEXT_NODE;
}
function isElement(node) {
  return node.nodeType === Node.ELEMENT_NODE;
}
function isFrameStartMarker(node) {
  return node instanceof Comment && node.data.trim().startsWith("rmx:f:");
}
function isFrameEndMarker(node) {
  return node instanceof Comment && node.data.trim() === "/rmx:f";
}
function shouldPreserveFrameStartMarker(current, next, context) {
  if (!isFrameStartMarker(next)) return false;
  let nextData = getFrameMarkerData(next, context);
  let currentFrame = context.frameInstances.get(current);
  return currentFrame !== void 0 && nextData !== void 0 && currentFrame.matchesIdentity(nextData.src, nextData.name);
}
function shouldPreserveHydrationStartMarker(current, next, context) {
  if (!isHydrationStart(next)) return false;
  let currentOwner = getClientEntryBoundaryOwner(current);
  let nextData = getHydrationMarkerData(next, context);
  return currentOwner !== void 0 && nextData !== void 0 && getClientEntryKey(currentOwner.identity) === getClientEntryKey({ moduleUrl: nextData.moduleUrl, exportName: nextData.exportName });
}
function getHydrationMarkerData(marker, context) {
  let id = getHydrationId(marker);
  return context.data.h?.[id];
}
function getHydrationId(marker) {
  let trimmed = marker.data.trim();
  invariant(trimmed.startsWith("rmx:h:"), "Invalid hydration start marker");
  return trimmed.slice("rmx:h:".length);
}
function getFrameMarkerData(marker, context) {
  let id = getFrameId(marker);
  return context.data.f?.[id];
}
function replaceCommentMarkerRange(currentStart, nextStart, parent, context) {
  let currentEnd = findCommentMarkerRangeEnd(currentStart);
  let nextEnd = findCommentMarkerRangeEnd(nextStart);
  let nextNodes = collectNodeRange(nextStart, nextEnd);
  let currentNodes = collectNodeRange(currentStart, currentEnd);
  for (let node of nextNodes) {
    parent.insertBefore(node, currentStart);
  }
  for (let node of currentNodes) {
    removeNode(node, parent, context);
  }
}
function findCommentMarkerRangeEnd(start) {
  if (isFrameStartMarker(start)) return findFrameEndMarker(start);
  if (isHydrationStart(start)) return findHydrationEndMarker(start);
  throw new Error("Comment marker range start not found");
}
function collectNodeRange(start, end) {
  let nodes = [];
  let node = start;
  while (node) {
    nodes.push(node);
    if (node === end) break;
    node = node.nextSibling;
  }
  return nodes;
}
function collectFrameContentFragment(doc, start, end) {
  let fragment = doc.createDocumentFragment();
  let node = start.nextSibling;
  while (node && node !== end) {
    let next = node.nextSibling;
    fragment.appendChild(node);
    node = next;
  }
  return fragment;
}
function removeNode(node, parent, context) {
  visitSubtree(node, (next) => isHydrationStart(next) && disposeClientEntryBoundary(next));
  visitSubtree(node, (next) => {
    if (isFrameStartMarker(next)) disposeFrameStartMarker(next, context);
  });
  if (node.parentNode === parent) {
    parent.removeChild(node);
  }
}
function visitSubtree(node, visit) {
  let stack = [node];
  while (stack.length > 0) {
    let next = stack.pop();
    if (visit(next)) continue;
    for (let child of Array.from(next.childNodes)) {
      stack.push(child);
    }
  }
}
function disposeFrameStartMarker(marker, context) {
  let subFrame = context.frameInstances.get(marker);
  if (subFrame) {
    subFrame.dispose();
    context.frameInstances.delete(marker);
  }
}

// ../../../src/style/css-mixin.ts
var clientStyleCache = /* @__PURE__ */ new Map();
var cssMixinType = (handle) => {
  let activeSelector = "";
  let activeGeneration = -1;
  let currentStyles = {};
  handle.addEventListener("remove", () => {
    if (!activeSelector) return;
    let runtime = handle.frame.$runtime;
    invariant(runtime, "css mixin requires frame runtime");
    let styleTarget = resolveStyleTarget(runtime);
    styleTarget.styleManager?.remove(activeSelector);
    activeSelector = "";
    activeGeneration = -1;
  });
  return (styles, props) => {
    currentStyles = styles;
    let runtime = handle.frame.$runtime;
    invariant(runtime, "css mixin requires frame runtime");
    let styleTarget = resolveStyleTarget(runtime);
    let { selector, css: cssText } = processStyleClass(currentStyles, styleTarget.styleCache);
    let styleGeneration = styleTarget.styleManager?.getGeneration?.() ?? 0;
    if (styleTarget.styleManager) {
      if (activeSelector && activeSelector !== selector) {
        styleTarget.styleManager.remove(activeSelector);
      }
      if (selector && (activeSelector !== selector || activeGeneration !== styleGeneration)) {
        styleTarget.styleManager.insert(selector, cssText);
      }
      activeSelector = selector;
      activeGeneration = selector ? styleGeneration : -1;
    }
    if (!selector) {
      return handle.element;
    }
    return renderMixinElement(handle.element, {
      ...props ?? {},
      className: props?.className ? `${props.className} ${selector}` : selector
    });
  };
};
var css = createMixin(cssMixinType);
function resolveStyleTarget(runtime) {
  return {
    styleCache: runtime.styleCache ?? clientStyleCache,
    styleManager: runtime.styleManager
  };
}

// ../../../src/runtime/stream-protocol.ts
var FRAME_TEMPLATE_END_MARKER = "rmx:template-end";
var FLUSH_MARKER_PATTERN = /<!--\s*rmx:flush\s+(document|fragment)\s*-->/g;
function findFlushMarker(html, startIndex) {
  FLUSH_MARKER_PATTERN.lastIndex = startIndex;
  let match = FLUSH_MARKER_PATTERN.exec(html);
  if (!match) return void 0;
  return {
    index: match.index,
    endIndex: FLUSH_MARKER_PATTERN.lastIndex,
    kind: match[1]
  };
}

// ../../../src/runtime/module-preloader.ts
var SERVER_MODULE_PRELOAD_SELECTOR = 'link[data-rmx-module-preload][rel~="modulepreload" i][href]';
var modulePreloaders = /* @__PURE__ */ new WeakMap();
function getDocumentModulePreloader(doc) {
  let preloader = modulePreloaders.get(doc);
  if (!preloader) {
    preloader = createModulePreloader(doc);
    modulePreloaders.set(doc, preloader);
  }
  return preloader;
}
function createModulePreloader(doc) {
  let requestedUrls = /* @__PURE__ */ new Set();
  let activeLinks = /* @__PURE__ */ new WeakSet();
  let activeLinkCount = 0;
  function activateLink(link) {
    activeLinks.add(link);
    activeLinkCount++;
  }
  function deactivateLink(link) {
    if (activeLinks.delete(link)) activeLinkCount--;
  }
  function preload(href) {
    let link = doc.createElement("link");
    link.rel = "modulepreload";
    link.href = href;
    link.setAttribute("data-rmx-module-preload", "");
    let url = link.href;
    if (requestedUrls.has(url)) return;
    requestedUrls.add(url);
    activateLink(link);
    link.addEventListener(
      "load",
      () => {
        deactivateLink(link);
        link.remove();
      },
      { once: true }
    );
    link.addEventListener(
      "error",
      () => {
        deactivateLink(link);
        link.remove();
        requestedUrls.delete(url);
      },
      { once: true }
    );
    doc.head.append(link);
  }
  return {
    adoptInitialPreloadLinks(source) {
      for (let initialLink of source.querySelectorAll(
        SERVER_MODULE_PRELOAD_SELECTOR
      )) {
        let settle2 = function(succeeded) {
          if (settled) return;
          settled = true;
          deactivateLink(initialLink);
          deactivateLink(observerLink);
          initialLink.remove();
          observerLink.remove();
          if (!succeeded) requestedUrls.delete(url);
        };
        var settle = settle2;
        if (activeLinks.has(initialLink)) continue;
        let observerLink = doc.createElement("link");
        observerLink.rel = "modulepreload";
        observerLink.href = initialLink.href;
        observerLink.setAttribute("data-rmx-module-preload", "");
        let url = initialLink.href;
        requestedUrls.add(url);
        activateLink(initialLink);
        activateLink(observerLink);
        let settled = false;
        observerLink.addEventListener("load", () => settle2(true), { once: true });
        observerLink.addEventListener("error", () => settle2(false), { once: true });
        doc.head.append(observerLink);
      }
    },
    async consumePreloadLinks(source, process) {
      let hrefs = [];
      for (let link of source.querySelectorAll(SERVER_MODULE_PRELOAD_SELECTOR)) {
        let href = link.getAttribute("href");
        link.remove();
        if (href) hrefs.push(href);
      }
      let processedHrefs = process ? await process(hrefs) : hrefs;
      for (let href of processedHrefs) preload(href);
    },
    hasActivePreloads() {
      return activeLinkCount > 0;
    },
    isActivePreload(node) {
      return node instanceof HTMLLinkElement && activeLinks.has(node);
    }
  };
}

// ../../../src/runtime/import-map-manager.ts
var MANAGED_IMPORT_MAP_SELECTOR = 'script[data-rmx-import-map][type="importmap"]';
var IMPORT_MAP_SELECTOR = 'script[type="importmap"]';
var importMapManagers = /* @__PURE__ */ new WeakMap();
var ImportMapConflictError = class extends Error {
};
function getDocumentImportMapManager(doc) {
  let manager = importMapManagers.get(doc);
  if (!manager) {
    manager = createImportMapManager(doc);
    importMapManagers.set(doc, manager);
  }
  return manager;
}
function createImportMapManager(doc) {
  let nonce = doc.head.querySelector(MANAGED_IMPORT_MAP_SELECTOR)?.nonce;
  let installedImportMap = createInstalledImportMap();
  let processedScripts = /* @__PURE__ */ new WeakSet();
  let conflicted = false;
  function processImportMap(script) {
    if (processedScripts.has(script)) return;
    processedScripts.add(script);
    let importMap = parseImportMap(script.textContent ?? "");
    if (importMap) installImportMap(installedImportMap, importMap, script.baseURI);
  }
  function processImportMaps() {
    for (let script of doc.querySelectorAll(IMPORT_MAP_SELECTOR)) {
      processImportMap(script);
    }
  }
  function processMutations(mutations) {
    for (let mutation of mutations) {
      if (mutation.type !== "childList") continue;
      for (let node of mutation.addedNodes) {
        if (node instanceof HTMLScriptElement && node.matches(IMPORT_MAP_SELECTOR)) {
          processImportMap(node);
        }
      }
    }
  }
  let observer = new MutationObserver(processMutations);
  observer.observe(doc, { childList: true });
  observer.observe(doc.head, { childList: true });
  processImportMaps();
  return {
    consumeImportMaps(source) {
      if (conflicted) return "blocked";
      processMutations(observer.takeRecords());
      processImportMaps();
      let scripts = Array.from(
        source.querySelectorAll(MANAGED_IMPORT_MAP_SELECTOR)
      );
      if (scripts.length === 0) return "ready";
      let pendingImportMap = cloneInstalledImportMap(installedImportMap);
      let deltas = [];
      let baseUrl = doc.baseURI;
      try {
        for (let script of scripts) {
          let importMap = parseImportMap(script.textContent ?? "");
          if (!importMap) continue;
          let delta = installImportMap(
            pendingImportMap,
            importMap,
            baseUrl,
            cloneInstalledImportMap(pendingImportMap)
          );
          if (delta) deltas.push(delta);
        }
      } catch (error) {
        if (!(error instanceof ImportMapConflictError)) throw error;
        console.warn(error.message);
        conflicted = true;
        return "conflict";
      }
      for (let delta of deltas) {
        let installedScript = appendImportMapScript(doc, delta, nonce);
        processedScripts.add(installedScript);
      }
      installedImportMap = pendingImportMap;
      for (let script of scripts) script.remove();
      return "ready";
    },
    disconnect() {
      observer.disconnect();
    },
    shouldPreserveHeadNode(node) {
      return node.isConnected && node instanceof HTMLScriptElement && node.matches(MANAGED_IMPORT_MAP_SELECTOR);
    }
  };
}
function createInstalledImportMap() {
  return {
    imports: /* @__PURE__ */ new Map(),
    scopes: /* @__PURE__ */ new Map(),
    integrity: /* @__PURE__ */ new Map()
  };
}
function cloneInstalledImportMap(importMap) {
  return {
    imports: new Map(importMap.imports),
    scopes: new Map(Array.from(importMap.scopes, ([scope, imports]) => [scope, new Map(imports)])),
    integrity: new Map(importMap.integrity)
  };
}
function installImportMap(target, importMap, baseUrl, installed) {
  let imports = installImports(target.imports, installed?.imports, importMap.imports, baseUrl);
  let scopes = {};
  for (let [scope, scopeImports] of Object.entries(importMap.scopes ?? {})) {
    let normalizedScope = normalizeImportMapUrl(scope, baseUrl);
    if (normalizedScope === null) continue;
    let targetScopeImports = target.scopes.get(normalizedScope);
    if (!targetScopeImports) {
      targetScopeImports = /* @__PURE__ */ new Map();
      target.scopes.set(normalizedScope, targetScopeImports);
    }
    let importsDelta = installImports(
      targetScopeImports,
      installed && (installed.scopes.get(normalizedScope) ?? /* @__PURE__ */ new Map()),
      scopeImports,
      baseUrl,
      scope
    );
    if (importsDelta) scopes[scope] = importsDelta;
  }
  let integrity = {};
  for (let [url, metadata] of Object.entries(importMap.integrity ?? {})) {
    let normalizedUrl = normalizeImportMapUrl(url, baseUrl);
    if (normalizedUrl === null) continue;
    let installedMetadata = (installed ?? target).integrity.get(normalizedUrl);
    if (installedMetadata !== void 0) {
      if (installed && installedMetadata !== metadata) {
        throw new ImportMapConflictError(
          `[remix] Reloading page after import map integrity conflict for "${url}": "${installedMetadata}" is already installed, but the new map points to "${metadata}"`
        );
      }
      continue;
    }
    integrity[url] = metadata;
    if (!target.integrity.has(normalizedUrl)) target.integrity.set(normalizedUrl, metadata);
  }
  let delta = {};
  if (imports) delta.imports = imports;
  if (hasEntries(scopes)) delta.scopes = scopes;
  if (hasEntries(integrity)) delta.integrity = integrity;
  return hasEntries(delta) ? delta : void 0;
}
function installImports(target, installed, imports, baseUrl, scope) {
  let delta = {};
  for (let [specifier, href] of Object.entries(imports ?? {})) {
    let normalizedSpecifier = normalizeImportMapSpecifier(specifier, baseUrl);
    if (normalizedSpecifier === null) continue;
    let normalizedHref = normalizeImportMapAddress(href, baseUrl);
    let installedEntry = (installed ?? target).get(normalizedSpecifier);
    if (installedEntry) {
      if (installed && installedEntry.normalizedHref !== normalizedHref) {
        let scopeDescription = scope ? ` in scope "${scope}"` : "";
        throw new ImportMapConflictError(
          `[remix] Reloading page after import map conflict for "${specifier}"${scopeDescription}: ${formatImportMapAddress(installedEntry.href)} is already installed, but the new map points to ${formatImportMapAddress(href)}`
        );
      }
      continue;
    }
    delta[specifier] = href;
    if (!target.has(normalizedSpecifier)) target.set(normalizedSpecifier, { href, normalizedHref });
  }
  return hasEntries(delta) ? delta : void 0;
}
function hasEntries(record) {
  return Object.keys(record).length > 0;
}
function appendImportMapScript(doc, importMap, nonce) {
  let script = doc.createElement("script");
  script.setAttribute("data-rmx-import-map", "");
  script.type = "importmap";
  if (nonce) script.nonce = nonce;
  script.textContent = JSON.stringify(importMap);
  doc.head.appendChild(script);
  return script;
}
function parseImportMap(json) {
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  let importMap = {};
  if ("imports" in parsed) {
    let imports = parsed.imports;
    if (!isImportMapImports(imports)) return null;
    importMap.imports = imports;
  }
  if ("scopes" in parsed) {
    let scopes = parsed.scopes;
    if (!isScopedImportMapRecord(scopes)) return null;
    importMap.scopes = scopes;
  }
  if ("integrity" in parsed) {
    let integrity = parsed.integrity;
    if (!isImportMapIntegrity(integrity)) return null;
    importMap.integrity = integrity;
  }
  return importMap;
}
function isImportMapImports(value) {
  if (!value || typeof value !== "object") return false;
  return Object.values(value).every((entry) => entry === null || typeof entry === "string");
}
function isScopedImportMapRecord(value) {
  if (!value || typeof value !== "object") return false;
  return Object.values(value).every(isImportMapImports);
}
function isImportMapIntegrity(value) {
  if (!value || typeof value !== "object") return false;
  return Object.values(value).every((entry) => typeof entry === "string");
}
function normalizeImportMapSpecifier(specifier, baseUrl) {
  if (specifier.startsWith("/") || specifier.startsWith("./") || specifier.startsWith("../") || URL.canParse(specifier)) {
    return normalizeImportMapUrl(specifier, baseUrl);
  }
  return specifier;
}
function normalizeImportMapAddress(address, baseUrl) {
  if (address === null) return null;
  return normalizeImportMapUrl(address, baseUrl);
}
function normalizeImportMapUrl(value, baseUrl) {
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return null;
  }
}
function formatImportMapAddress(address) {
  return address === null ? "null" : `"${address}"`;
}

// ../../../src/runtime/document-reload.ts
var documentReloadInfo = "remix-document-reload";
function reloadDocument(doc, href = doc.location.href) {
  let navigation = doc.defaultView?.navigation;
  if (navigation) {
    navigation.navigate(href, { history: "replace", info: documentReloadInfo });
  } else {
    doc.location.replace(href);
  }
}

// ../../../src/runtime/frame.ts
var NamedFrameRegistry = class {
  #framesByName = /* @__PURE__ */ new Map();
  register(name2, frame) {
    let frames = this.#framesByName.get(name2);
    if (frames) {
      frames.push(frame);
    } else {
      this.#framesByName.set(name2, [frame]);
    }
  }
  get(name2) {
    return this.#framesByName.get(name2)?.at(-1);
  }
  unregister(name2, frame) {
    let frames = this.#framesByName.get(name2);
    if (!frames) return;
    let index = frames.lastIndexOf(frame);
    if (index === -1) return;
    frames.splice(index, 1);
    if (frames.length === 0) {
      this.#framesByName.delete(name2);
    }
  }
};
var bufferedFrameTemplates = /* @__PURE__ */ new Map();
var frameTemplateListeners = /* @__PURE__ */ new Map();
var pendingClientEntryHydrations = /* @__PURE__ */ new WeakMap();
var frameClientEntryParents = /* @__PURE__ */ new WeakMap();
function createLinkedAbortController(...signals) {
  let controller = new AbortController();
  let abort = () => controller.abort();
  for (let signal of signals) {
    if (!signal) continue;
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener("abort", abort, { once: true });
  }
  return {
    controller,
    disconnect() {
      for (let signal of signals) {
        signal?.removeEventListener("abort", abort);
      }
    }
  };
}
var FULL_DOCUMENT_PATTERN = /^\s*(?:<!doctype\b|<html\b)/i;
function inferFlushKind(html) {
  return FULL_DOCUMENT_PATTERN.test(html) ? "document" : "fragment";
}
var FRAME_RUNTIME = /* @__PURE__ */ Symbol("FrameRuntime");
function getSharedFrameRuntime(source) {
  return {
    errorTarget: source.errorTarget,
    loadModule: source.loadModule,
    resolveFrame: source.resolveFrame,
    pendingClientEntries: source.pendingClientEntries,
    scheduler: source.scheduler,
    styleManager: source.styleManager,
    moduleCache: source.moduleCache,
    moduleLoads: source.moduleLoads,
    frameInstances: source.frameInstances,
    namedFrames: source.namedFrames,
    processClientEntryPreloads: source.processClientEntryPreloads
  };
}
function isFrameRuntime(value) {
  return isRecord2(value) && Reflect.get(value, FRAME_RUNTIME) === true;
}
function createFrame(root2, init) {
  let container = createContainer(root2);
  let contentRoot;
  let reloadController;
  let ownsStyleManager = !init.styleManager;
  let reloadAbortUnsubscribe;
  let reloadKind;
  let styleManager = init.styleManager ?? createStyleManager();
  let modulePreloader = getDocumentModulePreloader(container.doc);
  let importMapManager = getDocumentImportMapManager(container.doc);
  let currentMarker = init.marker;
  let displayedContentStatus = init.marker?.status ?? "resolved";
  let pendingTemplateMarkerId;
  let stopPendingTemplateObserver;
  let pendingTemplateUnsubscribe;
  let inheritedReloadPending = false;
  let inheritedReloadAbortUnsubscribe;
  let disposed = false;
  let lifecycleController = new AbortController();
  async function consumeClientEntryResources(source, documentHref) {
    let importMapStatus = importMapManager.consumeImportMaps(source);
    if (importMapStatus !== "ready") {
      lifecycleController.abort();
      if (importMapStatus === "conflict") reloadDocument(container.doc, documentHref);
      return false;
    }
    await modulePreloader.consumePreloadLinks(source, init.processClientEntryPreloads);
    return true;
  }
  let initialClientEntryResources;
  function shouldPreserveManagedHeadNode(node) {
    return pendingPrefetchLinks.has(node) || importMapManager.shouldPreserveHeadNode(node) || modulePreloader.hasActivePreloads() && modulePreloader.isActivePreload(node);
  }
  if (isDocumentNode(container.root)) {
    modulePreloader.adoptInitialPreloadLinks(container.root);
  } else {
    initialClientEntryResources = consumeClientEntryResources(container.root);
  }
  mergeRmxDataFrom(init.data, container.doc);
  let runtime = createFrameRuntime({
    ...init,
    styleManager,
    reloadForNavigation: startReloadTransition
  });
  let frame = createFrameHandle({
    src: init.src,
    $runtime: runtime,
    reload: async (options) => (await reload(options)).signal,
    replace: async (content) => {
      await render(content);
    }
  });
  runtime.topFrame = runtime.topFrame ?? init.topFrame ?? frame;
  let frameName = init.marker?.name ?? init.name;
  if (frameName) {
    init.namedFrames.register(frameName, frame);
  }
  let context = {
    topFrame: runtime.topFrame,
    getContext: (type) => runtime.getContext?.(type),
    ...getSharedFrameRuntime(runtime),
    frame,
    data: init.data,
    lifecycleSignal: lifecycleController.signal,
    regionTailRef: container.regionTailRef,
    regionParent: container.regionParent
  };
  async function render(content, options) {
    if (isRenderAborted(options?.signal)) return;
    let ownsData = options?.data === void 0;
    let renderOptions = {
      ...options,
      data: options?.data ?? {}
    };
    try {
      await renderContent(content, renderOptions);
    } finally {
      if (ownsData) clearRmxData(renderOptions.data);
    }
  }
  async function renderContent(content, options) {
    if (isRenderAborted(options.signal)) return;
    if (content instanceof ReadableStream) {
      let linkedAbort = createLinkedAbortController(lifecycleController.signal, options.signal);
      try {
        await renderFrameStream(
          content,
          container.doc,
          async (html, flushKind) => {
            if (isRenderAborted(options.signal)) return;
            await render(html, { ...options, flushKind });
          },
          linkedAbort.controller.signal
        );
      } finally {
        linkedAbort.disconnect();
      }
      return;
    }
    if (isRemixNodeFrameContent(content)) {
      if (!contentRoot) {
        let currentNodes = getContentNodes();
        removeVirtualRoots(currentNodes);
        disposeSubFrames(currentNodes, context);
        clearFrameContent();
        if (container.root instanceof Document) {
          contentRoot = createFrameRoot(container.doc.body, context);
        } else {
          invariant(Array.isArray(root2), "Expected comment-bounded frame root");
          contentRoot = createFrameRoot(root2, context);
        }
      }
      if (isRenderAborted(options.signal)) return;
      let previousServerFrameReload = runtime.serverFrameReload;
      if (options.signal) {
        runtime.serverFrameReload = {
          signal: options.signal,
          reconciliationTracker: options.reconciliationTracker,
          blockingFrameTracker: options.blockingFrameTracker
        };
      }
      try {
        contentRoot.render(content);
        await new Promise((resolve) => context.scheduler.enqueueCommitPhase([resolve]));
        options.onCommit?.();
      } finally {
        runtime.serverFrameReload = previousServerFrameReload;
      }
      if (isRenderAborted(options.signal)) return;
      displayedContentStatus = options.contentStatus ?? "resolved";
      return;
    }
    if (contentRoot) {
      contentRoot.dispose();
      contentRoot = void 0;
    }
    let source;
    if (typeof content === "string") {
      let flushed = await consumeFlushBatches(content, async (html, flushKind) => {
        await render(html, { ...options, flushKind });
      });
      if (flushed.applied) {
        if (flushed.remainder !== "") {
          await render(flushed.remainder, { ...options, flushKind: "fragment" });
        }
        return;
      }
      source = container.root instanceof Document && (options.flushKind ?? inferFlushKind(content)) === "document" ? new DOMParser().parseFromString(content, "text/html") : createFragmentFromString(container.doc, content);
    } else {
      source = content;
    }
    if (!await consumeClientEntryResources(source, options.documentHref)) return;
    if (isRenderAborted(options.signal)) return;
    context.styleManager.adoptServerStyles(
      collectFrameServerStyleTags(createElementContainer(source))
    );
    if (!isDocumentNode(source)) removeEmptyHeads(source);
    mergeRmxDataFrom(options.data, source);
    let responseContext = {
      ...context,
      data: options.data,
      reconciliationTracker: options.reconciliationTracker,
      blockingFrameTracker: options.blockingFrameTracker
    };
    let hydrationContainer = container;
    if (isDocumentNode(source)) {
      diffElementAttributes(container.doc.documentElement, source.documentElement);
      let documentContext = {
        ...responseContext,
        regionParent: container.doc.documentElement,
        regionTailRef: null,
        signal: options.signal
      };
      diffNodes([container.doc.head], [source.head], {
        ...documentContext,
        shouldPreserveHeadNode: shouldPreserveManagedHeadNode
      });
      diffNodes([container.doc.body], [source.body], documentContext);
      hydrationContainer = createElementContainer(container.doc.body);
      if (isRenderAborted(options.signal)) return;
    } else {
      if (isRenderAborted(options.signal)) return;
      diffNodes(container.childNodes, Array.from(source.childNodes), {
        ...responseContext,
        regionTailRef: container.regionTailRef,
        regionParent: container.regionParent,
        signal: options.signal
      });
    }
    let subFramesReady = hydrateContainer(hydrationContainer, responseContext, options);
    options.onCommit?.();
    await subFramesReady;
    if (isRenderAborted(options.signal)) return;
    displayedContentStatus = options.contentStatus ?? "resolved";
  }
  function isRenderAborted(signal) {
    return disposed || lifecycleController.signal.aborted || signal?.aborted === true;
  }
  function getContentNodes() {
    return container.root instanceof Document ? Array.from(container.doc.body.childNodes) : container.childNodes;
  }
  function clearFrameContent() {
    for (let node of getContentNodes()) {
      node.parentNode?.removeChild(node);
    }
  }
  async function hydrateInitial() {
    let reconciliationTracker = createReconciliationTracker();
    if (await initialClientEntryResources === false) return;
    if (isRenderAborted()) return;
    context.styleManager.adoptServerStyles(collectFrameServerStyleTags(container));
    let subFramesReady = hydrateContainer(container, context, { reconciliationTracker });
    try {
      await subFramesReady;
      if (isRenderAborted()) return;
      if (currentMarker?.status === "pending") {
        await watchPendingFrameTemplate(currentMarker, reconciliationTracker);
      }
      reconciliationTracker.finalize();
      await reconciliationTracker.ready();
    } finally {
      clearRmxData(context.data);
    }
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    lifecycleController.abort();
    clearRmxData(context.data);
    reloadController?.abort();
    reloadController = void 0;
    reloadAbortUnsubscribe?.();
    reloadAbortUnsubscribe = void 0;
    reloadKind = void 0;
    contentRoot?.dispose();
    contentRoot = void 0;
    clearPendingFrameTemplateWatch();
    removeVirtualRoots(container.childNodes);
    disposeSubFrames(container.childNodes, context);
    if (ownsStyleManager) {
      context.styleManager.dispose();
    }
    if (frameName) {
      init.namedFrames.unregister(frameName, frame);
    }
  }
  let readyPromise = hydrateInitial();
  return {
    render,
    ready: () => readyPromise,
    flush: () => context.scheduler.dequeue(),
    clearPendingTemplateWatch: clearPendingFrameTemplateWatch,
    isDisplayingResolvedContent: () => displayedContentStatus === "resolved",
    beginClientFrameReloadForAncestorReload,
    cancelReload,
    startInheritedReload,
    updateMarker,
    renderMarkerContent,
    matchesIdentity: (src, name2) => !disposed && frame.src === src && frameName === name2,
    dispose,
    handle: frame
  };
  function setCurrentMarker(marker, signal) {
    let isInheritedReload = currentMarker !== void 0 && currentMarker.id !== marker.id;
    currentMarker = marker;
    if (isInheritedReload) {
      startInheritedReload(signal);
    }
    return isInheritedReload;
  }
  async function updateMarker(marker, options) {
    if (isRenderAborted(options?.signal)) return;
    let isInheritedReload = setCurrentMarker(marker, options?.signal);
    if (marker.status === "pending") {
      await watchPendingFrameTemplate(
        marker,
        options?.reconciliationTracker,
        options?.signal,
        isInheritedReload ? () => {
          completeInheritedReload();
        } : void 0
      );
    } else {
      clearPendingFrameTemplateWatch();
      if (isInheritedReload && !options?.signal?.aborted) {
        completeInheritedReload();
      }
    }
  }
  async function renderMarkerContent(marker, content, options) {
    if (isRenderAborted(options?.signal)) return;
    let isInheritedReload = setCurrentMarker(marker, options?.signal);
    clearPendingFrameTemplateWatch();
    await render(content, { ...options, contentStatus: "resolved" });
    if (isInheritedReload && !isRenderAborted(options?.signal)) {
      completeInheritedReload();
    }
  }
  async function reload(options) {
    let src = options?.src ?? frame.src;
    let method = options?.method?.toLowerCase();
    if (method !== void 0 && method !== "post") method = "get";
    let formData = options?.body;
    let encType;
    if (formData) {
      if (method !== "post") {
        let url = new URL(src, container.doc.baseURI);
        let query = new URLSearchParams();
        let normalizeNewlines = (value) => value.replace(/\r\n|\r|\n/g, "\r\n");
        for (let [name2, value] of formData) {
          query.append(
            normalizeNewlines(name2),
            normalizeNewlines(typeof value === "string" ? value : value.name)
          );
        }
        url.search = `?${query}`;
        src = url.href;
        formData = void 0;
      } else {
        encType = options?.encType?.toLowerCase();
        if (encType !== "multipart/form-data" && encType !== "text/plain") {
          encType = "application/x-www-form-urlencoded";
        }
      }
    }
    frame.src = src;
    let reloadOptions = {};
    if (method !== void 0) reloadOptions.method = method;
    if (encType !== void 0) reloadOptions.encType = encType;
    if (formData !== void 0) reloadOptions.formData = formData;
    let transition = startReloadTransition(reloadOptions);
    void transition.committed.catch(() => {
    });
    return await transition.finished;
  }
  function startReloadTransition(options) {
    let controller = startReload(options?.signal);
    let committed = Promise.withResolvers();
    let commitStarted = false;
    let finished = resolveAndRenderReload(controller, options, (ready) => {
      if (commitStarted) return;
      commitStarted = true;
      void ready.then(committed.resolve, committed.reject);
    });
    void finished.then(() => committed.resolve(), committed.reject);
    return { signal: controller.signal, committed: committed.promise, finished };
  }
  function startReload(signal) {
    let controller = replaceReloadController(signal);
    reloadKind = "direct";
    dispatchReloadStart(controller.signal);
    return controller;
  }
  function beginClientFrameReloadForAncestorReload(signal) {
    let inheritedReloadStarted = clearInheritedReload();
    let continuingAncestorReload = reloadKind === "ancestor";
    let controller = replaceReloadController(signal);
    reloadKind = "ancestor";
    if (!inheritedReloadStarted && !continuingAncestorReload) {
      dispatchReloadStart(controller.signal);
    }
    return {
      controller,
      complete: () => completeReload(controller)
    };
  }
  function cancelReload() {
    let controller = reloadController;
    if (!controller) return;
    controller.abort();
    completeReload(controller);
  }
  function dispatchReloadStart(signal) {
    frame.dispatchEvent(new Event("reloadStart"));
    startSubFrameInheritedReloads(getContentNodes(), signal);
  }
  function replaceReloadController(signal) {
    reloadController?.abort();
    reloadAbortUnsubscribe?.();
    let { controller, disconnect } = createLinkedAbortController(signal);
    reloadController = controller;
    reloadAbortUnsubscribe = disconnect;
    return controller;
  }
  async function resolveAndRenderReload(controller, options, resolveCommit) {
    let isStale = () => reloadController !== controller || controller.signal.aborted;
    try {
      let resolution = await init.resolveFrame(frame.src, {
        ...options,
        signal: controller.signal,
        target: frameName
      });
      if (isStale()) return { signal: controller.signal };
      let { content, redirectedTo } = await unwrapFrameResolution(resolution);
      if (isStale()) return { signal: controller.signal };
      let reconciliationTracker = createReconciliationTracker();
      let blockingFrameTracker = createReconciliationTracker();
      let commitStarted = false;
      await render(content, {
        documentHref: isDocumentNode(container.root) ? redirectedTo ?? frame.src : void 0,
        signal: controller.signal,
        reconciliationTracker,
        blockingFrameTracker,
        onCommit() {
          if (commitStarted) return;
          commitStarted = true;
          blockingFrameTracker.finalize();
          resolveCommit?.(blockingFrameTracker.ready());
        }
      });
      reconciliationTracker.finalize();
      await reconciliationTracker.ready();
      return {
        signal: controller.signal,
        redirectedTo: isStale() ? void 0 : redirectedTo
      };
    } catch (error) {
      if (isStale()) return { signal: controller.signal };
      init.errorTarget.dispatchEvent(createComponentErrorEvent(error));
      throw error;
    } finally {
      completeReload(controller);
    }
  }
  function completeReload(controller) {
    if (reloadController !== controller || reloadKind === void 0) return;
    reloadAbortUnsubscribe?.();
    reloadAbortUnsubscribe = void 0;
    reloadKind = void 0;
    frame.dispatchEvent(new Event("reloadComplete"));
  }
  function startInheritedReload(signal) {
    if (signal?.aborted) return;
    if (!inheritedReloadPending) {
      inheritedReloadPending = true;
      dispatchReloadStart(signal);
    }
    inheritedReloadAbortUnsubscribe?.();
    inheritedReloadAbortUnsubscribe = void 0;
    if (signal) {
      let abort = () => completeInheritedReload();
      signal.addEventListener("abort", abort, { once: true });
      inheritedReloadAbortUnsubscribe = () => {
        signal.removeEventListener("abort", abort);
      };
    }
  }
  function clearInheritedReload() {
    if (!inheritedReloadPending) return false;
    inheritedReloadPending = false;
    inheritedReloadAbortUnsubscribe?.();
    inheritedReloadAbortUnsubscribe = void 0;
    return true;
  }
  function completeInheritedReload() {
    if (clearInheritedReload()) frame.dispatchEvent(new Event("reloadComplete"));
  }
  function startSubFrameInheritedReloads(nodes, signal) {
    walkNodes(
      nodes,
      (node) => {
        if (!isFrameStart(node)) return;
        let end = findFrameEndMarker2(node);
        context.frameInstances.get(node)?.startInheritedReload(signal);
        return end;
      },
      signal
    );
  }
  function clearPendingFrameTemplateWatch() {
    pendingTemplateUnsubscribe?.();
    pendingTemplateUnsubscribe = void 0;
    stopPendingTemplateObserver?.();
    stopPendingTemplateObserver = void 0;
    pendingTemplateMarkerId = void 0;
  }
  async function watchPendingFrameTemplate(marker, reconciliationTracker, signal, onResolved) {
    if (isRenderAborted(signal)) return;
    if (pendingTemplateMarkerId === marker.id) return;
    clearPendingFrameTemplateWatch();
    pendingTemplateMarkerId = marker.id;
    let template = consumeFrameTemplate(marker.id) ?? getEarlyFrameContent(marker.id);
    if (!template) {
      if (isRenderAborted(signal)) {
        clearPendingFrameTemplateWatch();
        return;
      }
      stopPendingTemplateObserver = setupTemplateObserver(marker.id);
      pendingTemplateUnsubscribe = subscribeFrameTemplate(marker.id, async (fragment) => {
        if (isRenderAborted(signal)) return;
        if (pendingTemplateMarkerId !== marker.id) return;
        clearPendingFrameTemplateWatch();
        await render(fragment, { signal, contentStatus: "resolved" });
        if (!isRenderAborted(signal)) onResolved?.();
      });
      signal?.addEventListener(
        "abort",
        () => {
          if (pendingTemplateMarkerId === marker.id) {
            clearPendingFrameTemplateWatch();
          }
        },
        { once: true }
      );
      template = consumeFrameTemplate(marker.id);
      if (!template) return;
    }
    clearPendingFrameTemplateWatch();
    await render(template, { reconciliationTracker, signal, contentStatus: "resolved" });
    if (!isRenderAborted(signal)) onResolved?.();
  }
}
function createFrameRuntime(init) {
  return {
    [FRAME_RUNTIME]: true,
    topFrame: init.topFrame,
    getContext: init.getContext,
    ...getSharedFrameRuntime(init),
    serverFrameReload: void 0,
    reloadForNavigation: init.reloadForNavigation
  };
}
function createReconciliationTracker() {
  let pending = 0;
  let finalized = false;
  let failed = false;
  let failure;
  let resolveReady;
  let rejectReady;
  let readyPromise = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  function maybeSettle() {
    if (!finalized || pending !== 0) return;
    if (failed) rejectReady?.(failure);
    else resolveReady?.();
    resolveReady = void 0;
    rejectReady = void 0;
  }
  function track() {
    pending++;
    let completed = false;
    return () => {
      if (completed) return;
      completed = true;
      pending--;
      maybeSettle();
    };
  }
  return {
    track,
    waitFor(task) {
      let complete = track();
      void task.then(complete, (error) => {
        if (!failed) {
          failed = true;
          failure = error;
        }
        complete();
      });
    },
    finalize() {
      finalized = true;
      maybeSettle();
    },
    ready() {
      return readyPromise;
    }
  };
}
function mergeRmxDataFrom(into, root2) {
  let scripts = Array.from(root2.querySelectorAll("script#rmx-data"));
  for (let script of scripts) {
    if (!(script instanceof HTMLScriptElement)) continue;
    mergeRmxData(into, parseRmxDataScript(script));
    script.remove();
  }
}
function clearRmxData(data) {
  delete data.h;
  delete data.f;
}
function removeEmptyHeads(fragment) {
  let heads = Array.from(fragment.querySelectorAll("head"));
  for (let head of heads) {
    if (!head.childNodes.length) {
      head.remove();
    }
  }
}
function collectFrameServerStyleTags(container) {
  let styles = [];
  let nodes = container.root instanceof Document ? [...Array.from(container.doc.head.childNodes), ...Array.from(container.doc.body.childNodes)] : container.childNodes;
  walkNodes(nodes, (node) => {
    if (isFrameStart(node)) return findFrameEndMarker2(node);
    if (node instanceof HTMLStyleElement && node.matches("style[data-rmx-style]")) {
      styles.push(node);
      return node;
    }
  });
  return styles;
}
function parseRmxDataScript(script) {
  try {
    return JSON.parse(script.textContent || "{}");
  } catch {
    console.error("[createFrame] Failed to parse rmx-data script");
    return {};
  }
}
function mergeRmxData(into, from) {
  if (from.h) copyOwnRmxEntries(into.h ??= {}, from.h);
  if (from.f) copyOwnRmxEntries(into.f ??= {}, from.f);
}
function copyOwnRmxEntries(target, source) {
  for (let key of Object.keys(source)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    target[key] = source[key];
  }
}
function hydrateContainer(container, context, options) {
  let hydrationData = context.data.h;
  let hydrationMarkers = findHydrationMarkers(container, hydrationData);
  let hydrations = [];
  for (let marker of hydrationMarkers) {
    let entry = hydrationData?.[marker.id];
    if (!entry) continue;
    if (!context.pendingClientEntries.has(marker.start)) {
      context.pendingClientEntries.set(marker.start, [marker.end, void 0]);
    }
    let { promise, resolve } = Promise.withResolvers();
    pendingClientEntryHydrations.set(marker.start, promise);
    hydrations.push({
      marker,
      entry,
      complete() {
        if (pendingClientEntryHydrations.get(marker.start) === promise) {
          pendingClientEntryHydrations.delete(marker.start);
        }
        resolve();
      }
    });
  }
  let subFramesReady = createSubFrames(container.childNodes, context, options);
  for (let { marker, entry, complete } of hydrations) {
    scheduleHydrationMarker(
      marker,
      entry,
      context,
      complete,
      options?.reconciliationTracker,
      options?.signal
    );
  }
  return subFramesReady;
}
function scheduleHydrationMarker(marker, entry, context, onComplete, reconciliationTracker, signal) {
  if (signal?.aborted || context.lifecycleSignal.aborted) {
    onComplete();
    return;
  }
  let done = reconciliationTracker?.track();
  let identity = {
    moduleUrl: entry.moduleUrl,
    exportName: entry.exportName
  };
  let key = getClientEntryKey(identity);
  let props = entry.props;
  let completed = false;
  let complete = () => {
    if (completed) return;
    completed = true;
    props = void 0;
    signal?.removeEventListener("abort", complete);
    context.lifecycleSignal.removeEventListener("abort", complete);
    onComplete();
    done?.();
  };
  signal?.addEventListener("abort", complete, { once: true });
  context.lifecycleSignal.addEventListener("abort", complete, { once: true });
  let hydrateWithComponent = (component2) => {
    if (signal?.aborted || context.lifecycleSignal.aborted) return;
    if (!isHydrationMarkerLive(marker, context)) return;
    if (!props) return;
    let pending = context.pendingClientEntries.get(marker.start);
    let vElement = pending?.[1] ?? createElement(component2, props);
    context.pendingClientEntries.set(marker.start, [marker.end, vElement]);
    hydrateRegion(vElement, marker.start, marker.end, identity, context, signal);
  };
  let parentHydration = marker.parent && pendingClientEntryHydrations.get(marker.parent);
  let cached = context.moduleCache.get(key);
  if (cached && !parentHydration) {
    hydrateWithComponent(cached);
    complete();
    return;
  }
  let component = cached ?? getOrStartModuleLoad(key, identity, marker.id, context);
  Promise.all([component, parentHydration]).then(([component2]) => {
    if (component2) {
      hydrateWithComponent(component2);
    }
  }).finally(() => {
    complete();
  });
}
function getOrStartModuleLoad(key, identity, markerId, context) {
  let inFlight = context.moduleLoads.get(key);
  if (inFlight) return inFlight;
  let loadPromise = (async () => {
    try {
      let mod = await context.loadModule(identity.moduleUrl, identity.exportName);
      if (!isElementFunction3(mod)) {
        throw new Error(
          `Export "${identity.exportName}" from "${identity.moduleUrl}" is not a function`
        );
      }
      context.moduleCache.set(key, mod);
      return mod;
    } catch (error) {
      console.error(`[createFrame] Failed to load module for ${markerId}:`, error);
      return void 0;
    } finally {
      context.moduleLoads.delete(key);
    }
  })();
  context.moduleLoads.set(key, loadPromise);
  return loadPromise;
}
function createElement(component, props) {
  let revivedProps = reviveSerializedValue(props);
  invariant(isRecord2(revivedProps), "Expected revived component props to be an object");
  return jsx(component, revivedProps);
}
function isElementFunction3(value) {
  return typeof value === "function";
}
var unserializableMixin = createMixin(() => {
  throw new Error(
    "Client entry props contain a mixin that can't be serialized. Only css() mixins can be used in JSX passed to a client entry. Render elements that use other mixins, such as on() or ref(), inside the client entry instead."
  );
});
function reviveSerializedValue(value) {
  if (value === null || value === void 0) return value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((item) => reviveSerializedValue(item));
  }
  if (!isRecord2(value)) return value;
  let record = value;
  if (record.$rmxFrame === true) return reviveSerializedElement(Frame, record);
  if (record.$rmxFragment === true) return reviveSerializedElement(Fragment, record);
  if (record.$rmxMixin === "css") {
    let styles = Array.isArray(record.args) ? record.args[0] : void 0;
    return css(isCSSProps(styles) ? styles : {});
  }
  if (record.$rmxMixin === null) {
    return unserializableMixin();
  }
  if (record.$rmx === true && typeof record.type === "string") {
    return reviveSerializedElement(record.type, record);
  }
  let revived = {};
  for (let key in record) {
    revived[key] = reviveSerializedValue(record[key]);
  }
  return revived;
}
function reviveSerializedElement(type, record) {
  let props = reviveSerializedObject(record.props);
  let key = reviveSerializedValue(record.key);
  return jsx(type, props, key);
}
function reviveSerializedObject(value) {
  if (!isRecord2(value)) return {};
  let revived = reviveSerializedValue(value);
  return isRecord2(revived) ? revived : {};
}
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isCSSProps(value) {
  if (!isRecord2(value)) return false;
  for (let key in value) {
    let item = value[key];
    if (item == null || typeof item === "string" || typeof item === "number") continue;
    if (!isCSSProps(item)) return false;
  }
  return true;
}
function hydrateRegion(vElement, start, end, identity, context, signal) {
  if (signal?.aborted) return;
  context.pendingClientEntries.delete(start);
  let renderEntry = (root3) => {
    if (!signal) {
      root3.render(vElement);
      return;
    }
    let frameRuntime = context.frame.$runtime;
    invariant(
      isFrameRuntime(frameRuntime),
      "Expected frame runtime while rendering a client entry during a reload"
    );
    let previousServerFrameReload = frameRuntime.serverFrameReload;
    frameRuntime.serverFrameReload = {
      signal,
      reconciliationTracker: context.reconciliationTracker,
      blockingFrameTracker: context.blockingFrameTracker
    };
    try {
      root3.render(vElement);
    } finally {
      frameRuntime.serverFrameReload = previousServerFrameReload;
    }
  };
  let owner = getClientEntryBoundaryOwner(start);
  if (owner) {
    renderEntry(owner.root);
    return;
  }
  let root2 = createFrameRoot([start, end], context);
  setClientEntryBoundaryOwner(start, end, identity, root2);
  renderEntry(root2);
}
function createFrameRoot(target, context) {
  let options = {
    scheduler: context.scheduler,
    frame: context.frame,
    getContext: context.getContext,
    styleManager: context.styleManager
  };
  let root2 = Array.isArray(target) ? createRangeRoot(target, options) : createRoot(target, options);
  root2.addEventListener("error", (event) => {
    if (context.errorTarget === root2) return;
    context.errorTarget.dispatchEvent(createComponentErrorEvent(getComponentError(event)));
  });
  return root2;
}
async function createSubFrames(nodes, context, options) {
  let tasks = [];
  for (let i = 0; i < nodes.length; i++) {
    if (options?.signal?.aborted) break;
    let node = nodes[i];
    if (isFrameStart(node)) {
      let end = findFrameEndMarker2(node);
      let existingFrame = context.frameInstances.get(node);
      let id = getFrameId(node);
      let marker = context.data.f?.[id];
      if (existingFrame) {
        if (marker) {
          let frameMarker = { ...marker, id };
          tasks.push(existingFrame.updateMarker(frameMarker, options));
        } else {
          existingFrame.clearPendingTemplateWatch();
        }
      } else {
        if (marker) {
          let frameMarker = { ...marker, id };
          let subFrame = createFrame([node, end], {
            src: frameMarker.src,
            marker: frameMarker,
            topFrame: context.topFrame,
            getContext: context.getContext,
            ...getSharedFrameRuntime(context),
            data: context.data
          });
          context.frameInstances.set(node, subFrame);
          if (frameMarker.status === "resolved") {
            tasks.push(subFrame.ready());
          }
        }
      }
      i = findMarkerRangeEndIndex(nodes, end, i);
      continue;
    }
    if (node.childNodes && node.childNodes.length > 0) {
      tasks.push(createSubFrames(Array.from(node.childNodes), context, options));
    }
  }
  await Promise.all(tasks);
}
function isHydrationMarkerLive(marker, context) {
  if (!marker.start.isConnected || !marker.end.isConnected) return false;
  if (marker.start.parentNode !== marker.end.parentNode) return false;
  if (marker.start.data.trim() !== `rmx:h:${marker.id}`) return false;
  if (marker.end.data.trim() !== "/rmx:h") return false;
  if (context.regionTailRef) {
    let startPosition = marker.start.compareDocumentPosition(context.regionTailRef);
    let endPosition = marker.end.compareDocumentPosition(context.regionTailRef);
    let tailFollowsStart = (startPosition & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    let tailFollowsEnd = (endPosition & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    if (!tailFollowsStart || !tailFollowsEnd) return false;
  }
  return true;
}
function removeVirtualRoots(nodes) {
  walkNodes(nodes, (node) => {
    if (isHydrationStart(node) && disposeClientEntryBoundary(node)) {
      return findEndMarker(node, isHydrationStart, isHydrationEnd);
    }
  });
}
function disposeSubFrames(nodes, context) {
  walkNodes(nodes, (node) => {
    if (!isFrameStart(node)) return;
    let end = findFrameEndMarker2(node);
    let subFrame = context.frameInstances.get(node);
    if (subFrame) {
      subFrame.dispose();
      context.frameInstances.delete(node);
    }
    return end;
  });
}
function getEarlyFrameContent(id) {
  let template = document.querySelector(`template#${id}`);
  if (template instanceof HTMLTemplateElement && isFrameTemplateComplete(template)) {
    return takeFrameTemplateContent(template);
  }
  return null;
}
function isFrameTemplateComplete(template) {
  let end = template.content.lastChild;
  return isCommentNode2(end) && end.data === FRAME_TEMPLATE_END_MARKER || template.ownerDocument.readyState !== "loading";
}
function takeFrameTemplateContent(template) {
  let fragment = template.content;
  let end = fragment.lastChild;
  if (isCommentNode2(end) && end.data === FRAME_TEMPLATE_END_MARKER) end.remove();
  template.remove();
  return fragment;
}
function setupTemplateObserver(id) {
  let root2 = document.body ?? document.documentElement ?? document;
  let pending = /* @__PURE__ */ new Set();
  let observer = new MutationObserver((mutations) => {
    for (let mutation of mutations) {
      for (let node of mutation.addedNodes) {
        collectFrameTemplates(node, observeTemplate);
      }
    }
    publishCompleteTemplates();
  });
  function observeTemplate(template) {
    if (template.id !== id || pending.has(template)) return;
    pending.add(template);
    observer.observe(template.content, { childList: true });
  }
  function publishCompleteTemplates() {
    for (let template of pending) {
      if (!template.isConnected) {
        pending.delete(template);
        continue;
      }
      if (!isFrameTemplateComplete(template)) continue;
      pending.delete(template);
      publishFrameTemplate(template.id, takeFrameTemplateContent(template));
    }
  }
  observer.observe(root2, { childList: true, subtree: true });
  collectFrameTemplates(root2, observeTemplate);
  document.addEventListener("DOMContentLoaded", publishCompleteTemplates, { once: true });
  return () => {
    observer.disconnect();
    pending.clear();
    document.removeEventListener("DOMContentLoaded", publishCompleteTemplates);
  };
}
function collectFrameTemplates(node, collect) {
  if (node instanceof HTMLTemplateElement) {
    collect(node);
    return;
  }
  if (!(node instanceof Element)) return;
  let templates = Array.from(node.querySelectorAll("template"));
  for (let template of templates) {
    if (!(template instanceof HTMLTemplateElement)) continue;
    collect(template);
  }
}
function publishFrameTemplate(id, fragment) {
  let listeners = frameTemplateListeners.get(id);
  if (!listeners || listeners.size === 0) {
    let queue = bufferedFrameTemplates.get(id);
    if (!queue) {
      queue = [];
      bufferedFrameTemplates.set(id, queue);
    }
    queue.push(fragment);
    return;
  }
  for (let listener of listeners) {
    let clone = fragment.cloneNode(true);
    invariant(isDocumentFragmentNode(clone), "Expected cloned frame template fragment");
    listener(clone);
  }
}
function consumeFrameTemplate(id) {
  let queue = bufferedFrameTemplates.get(id);
  if (!queue || queue.length === 0) return null;
  let fragment = queue.shift() ?? null;
  if (queue.length === 0) {
    bufferedFrameTemplates.delete(id);
  }
  return fragment;
}
function subscribeFrameTemplate(id, listener) {
  let listeners = frameTemplateListeners.get(id);
  if (!listeners) {
    listeners = /* @__PURE__ */ new Set();
    frameTemplateListeners.set(id, listeners);
  }
  listeners.add(listener);
  return () => {
    let current = frameTemplateListeners.get(id);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) {
      frameTemplateListeners.delete(id);
    }
  };
}
var COMPLETE_TEMPLATE_WITH_ID_PATTERN = /<template\b[^>]*\bid=(?:"[^"]+"|'[^']+')[^>]*>[\s\S]*?<\/template>/gi;
function extractTemplatesFromBuffer(doc, buffer, onTemplate) {
  let html = "";
  let cursor = 0;
  for (let match of buffer.matchAll(COMPLETE_TEMPLATE_WITH_ID_PATTERN)) {
    html += buffer.slice(cursor, match.index);
    let parsed = createFragmentFromString(doc, match[0]);
    let template = parsed.querySelector("template");
    if (template instanceof HTMLTemplateElement && template.id) {
      onTemplate(template.id, takeFrameTemplateContent(template));
    }
    cursor = match.index + match[0].length;
  }
  let tail = buffer.slice(cursor);
  if (tail === "") return { html, remainder: "" };
  let tailStart = tail.toLowerCase().lastIndexOf("<template");
  if (tailStart === -1) {
    return { html: html + tail, remainder: "" };
  }
  return {
    html: html + tail.slice(0, tailStart),
    remainder: tail.slice(tailStart)
  };
}
async function renderFrameStream(stream, doc, applyHtml, signal) {
  let reader = stream.getReader();
  let decoder = new TextDecoder();
  let buffer = "";
  let html = "";
  let appliedOnce = false;
  let abort = () => {
    void reader.cancel().catch(() => {
    });
  };
  if (signal?.aborted) {
    await reader.cancel();
    reader.releaseLock();
    return;
  }
  signal?.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      let { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let parsed2 = extractTemplatesFromBuffer(doc, buffer, publishFrameTemplate);
      buffer = parsed2.remainder;
      if (parsed2.html !== "") {
        html += parsed2.html;
        let flushed = await consumeFlushBatches(html, applyHtml);
        appliedOnce = flushed.applied || appliedOnce;
        html = flushed.remainder;
      }
    }
    buffer += decoder.decode();
    let parsed = extractTemplatesFromBuffer(doc, buffer, publishFrameTemplate);
    html += parsed.html + parsed.remainder;
    if (html !== "") {
      await applyHtml(html, appliedOnce ? "fragment" : inferFlushKind(html));
    } else if (!appliedOnce) {
      await applyHtml("", "fragment");
    }
  } finally {
    signal?.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}
async function consumeFlushBatches(html, applyHtml) {
  let applied = false;
  let cursor = 0;
  let marker = findFlushMarker(html, cursor);
  while (marker) {
    let batch = html.slice(cursor, marker.index);
    await applyHtml(batch, marker.kind);
    applied = true;
    cursor = marker.endIndex;
    marker = findFlushMarker(html, cursor);
  }
  return { applied, remainder: html.slice(cursor) };
}
function createContainer(root2) {
  return Array.isArray(root2) ? createCommentContainer(root2) : createElementContainer(root2);
}
function createElementContainer(root2) {
  let doc = root2 instanceof Document ? root2 : root2.ownerDocument ?? document;
  return {
    doc,
    root: root2,
    get childNodes() {
      return Array.from(root2.childNodes);
    }
  };
}
function createCommentContainer([start, end]) {
  let parent = end.parentNode;
  invariant(parent, "Invalid comment container");
  invariant(start.parentNode === parent, "Boundaries must share parent");
  let doc = parent.ownerDocument ?? document;
  return {
    doc,
    root: parent,
    regionStart: start,
    get childNodes() {
      return collectNodesBetween(start, end);
    },
    regionTailRef: end,
    regionParent: parent
  };
}
function createFragmentFromString(doc, content) {
  let template = doc.createElement("template");
  template.innerHTML = content.trim();
  return template.content;
}
function isRemixNodeFrameContent(content) {
  return !(content instanceof ReadableStream || isDocumentFragmentNode(content) || typeof content === "string");
}
function findHydrationMarkers(container, data) {
  let markers = [];
  let parent = container.regionStart && frameClientEntryParents.get(container.regionStart);
  visit(container.childNodes, parent);
  return markers.map(({ id, start, end, parent: parent2 }) => {
    if (!end) throw new Error("End marker not found");
    return { id, start, end, parent: parent2 };
  });
  function visit(nodes, parent2) {
    let boundaries = [];
    for (let i = 0; i < nodes.length; i++) {
      let node = nodes[i];
      if (isFrameStart(node)) {
        if (parent2) frameClientEntryParents.set(node, parent2);
        else frameClientEntryParents.delete(node);
        let end = findFrameEndMarker2(node);
        i = findMarkerRangeEndIndex(nodes, end, i);
        continue;
      }
      if (isCommentNode2(node)) {
        if (isHydrationStart(node)) {
          let id = node.data.trim().slice("rmx:h:".length);
          let boundary = { id, start: node, parent: parent2 };
          markers.push(boundary);
          boundaries.push(boundary);
          if (data?.[id] || pendingClientEntryHydrations.has(node)) parent2 = node;
        } else if (isHydrationEnd(node)) {
          let boundary = boundaries.pop();
          if (boundary) {
            boundary.end = node;
            parent2 = boundary.parent;
          }
        }
      }
      if (node.childNodes.length > 0) {
        visit(Array.from(node.childNodes), parent2);
      }
    }
  }
}
function walkNodes(nodes, visit, signal) {
  for (let i = 0; i < nodes.length; i++) {
    if (signal?.aborted) break;
    let node = nodes[i];
    let end = visit(node);
    if (end) {
      i = findMarkerRangeEndIndex(nodes, end, i);
      continue;
    }
    if (node.childNodes.length > 0) {
      walkNodes(Array.from(node.childNodes), visit, signal);
    }
  }
}
function findFrameEndMarker2(start) {
  return findEndMarker(start, isFrameStart, isFrameEnd);
}
function findMarkerRangeEndIndex(nodes, end, startIndex) {
  return Math.max(startIndex, nodes.indexOf(end, startIndex));
}
function isDocumentNode(node) {
  return node.nodeType === Node.DOCUMENT_NODE;
}
function isDocumentFragmentNode(value) {
  return typeof value === "object" && value !== null && Reflect.get(value, "nodeType") === Node.DOCUMENT_FRAGMENT_NODE;
}

// index.tsx
var name = "remix";
function Button(handle) {
  return () => /* @__PURE__ */ jsx("div", { class: "col-sm-6 smallpad", children: /* @__PURE__ */ jsx(
    "button",
    {
      id: handle.props.id,
      class: "btn btn-primary btn-block",
      type: "button",
      mix: [on("click", handle.props.fn)],
      children: handle.props.text
    }
  ) });
}
function MetricCard(handle) {
  let selected = false;
  let hovered = false;
  return () => {
    let { label, value, change } = handle.props;
    return /* @__PURE__ */ jsx(
      "div",
      {
        class: `metric-card ${selected ? "selected" : ""}`,
        mix: [
          on("click", () => {
            selected = !selected;
            handle.update();
          }),
          on("mouseenter", () => {
            hovered = true;
            handle.update();
          }),
          on("mouseleave", () => {
            hovered = false;
            handle.update();
          }),
          on("focus", (e) => {
            e.currentTarget.style.outline = "2px solid #222";
            e.currentTarget.style.outlineOffset = "2px";
          }),
          on("blur", (e) => {
            e.currentTarget.style.outline = "";
          })
        ],
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
  };
}
function ChartBar(handle) {
  let hovered = false;
  return () => /* @__PURE__ */ jsx(
    "div",
    {
      class: "chart-bar",
      mix: [
        on("click", () => {
        }),
        on("mouseenter", () => {
          hovered = true;
          handle.update();
        }),
        on("mouseleave", () => {
          hovered = false;
          handle.update();
        }),
        on("focus", (e) => {
          e.currentTarget.style.outline = "2px solid #222";
          e.currentTarget.style.outlineOffset = "2px";
        }),
        on("blur", (e) => {
          e.currentTarget.style.outline = "";
        })
      ],
      style: {
        height: `${handle.props.value}%`,
        backgroundColor: hovered ? "#286090" : "#337ab7",
        width: "30px",
        margin: "0 2px",
        cursor: "pointer",
        transition: "all 0.2s",
        opacity: hovered ? 0.9 : 1,
        transform: hovered ? "scaleY(1.1)" : "scaleY(1)"
      },
      tabIndex: 0
    }
  );
}
function ActivityItem(handle) {
  let read = false;
  let hovered = false;
  return () => {
    let { title, time, icon } = handle.props;
    return /* @__PURE__ */ jsx(
      "li",
      {
        class: `activity-item ${read ? "read" : ""}`,
        mix: [
          on("click", () => {
            read = !read;
            handle.update();
          }),
          on("mouseenter", () => {
            hovered = true;
            handle.update();
          }),
          on("mouseleave", () => {
            hovered = false;
            handle.update();
          })
        ],
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
  };
}
function DropdownMenu(handle) {
  let open = false;
  let hovered = false;
  let actions = ["View Details", "Edit", "Duplicate", "Archive", "Delete"];
  return () => /* @__PURE__ */ jsx("div", { style: { position: "relative", display: "inline-block" }, children: [
    /* @__PURE__ */ jsx(
      "button",
      {
        class: "btn btn-primary",
        mix: [
          on("click", (e) => {
            e.stopPropagation();
            open = !open;
            handle.update();
          }),
          on("mouseenter", () => {
            hovered = true;
            handle.update();
          }),
          on("mouseleave", () => {
            hovered = false;
            handle.update();
          }),
          on("focus", (e) => {
            e.currentTarget.style.outline = "2px solid #222";
            e.currentTarget.style.outlineOffset = "2px";
          }),
          on("blur", (e) => {
            e.currentTarget.style.outline = "";
          })
        ],
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
        mix: [
          on("mouseleave", () => {
            open = false;
            handle.update();
          })
        ],
        children: actions.map((action, idx) => /* @__PURE__ */ jsx(
          "div",
          {
            mix: [
              on("click", (e) => {
                e.stopPropagation();
                open = false;
                handle.update();
              }),
              on("mouseenter", (e) => {
                e.currentTarget.style.backgroundColor = "#f5f5f5";
              }),
              on("mouseleave", (e) => {
                e.currentTarget.style.backgroundColor = "#fff";
              })
            ],
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
  return () => {
    let { row } = handle.props;
    return /* @__PURE__ */ jsx(
      "tr",
      {
        class: selected ? "danger" : "",
        mix: [
          on("click", () => {
            selected = !selected;
            handle.update();
          }),
          on("mouseenter", () => {
            hovered = true;
            handle.update();
          }),
          on("mouseleave", () => {
            hovered = false;
            handle.update();
          })
        ],
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
  };
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
      mix: [
        on("input", (e) => {
          value = e.target.value;
          handle.update();
        }),
        on("focus", () => {
          focused = true;
          handle.update();
        }),
        on("blur", () => {
          focused = false;
          handle.update();
        })
      ],
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
          mix: [
            on("change", (e) => {
              selectValue = e.target.value;
              handle.update();
            }),
            on("focus", (e) => {
              e.currentTarget.style.borderColor = "#337ab7";
              e.currentTarget.style.outline = "2px solid #337ab7";
              e.currentTarget.style.outlineOffset = "2px";
            }),
            on("blur", (e) => {
              e.currentTarget.style.borderColor = "#ddd";
              e.currentTarget.style.outline = "none";
            })
          ],
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
              mix: [
                on("change", (e) => {
                  if (e.target.checked) {
                    checkboxValues.add(`checkbox-${idx}`);
                  } else {
                    checkboxValues.delete(`checkbox-${idx}`);
                  }
                  handle.update();
                }),
                on("focus", (e) => {
                  e.currentTarget.style.outline = "2px solid #337ab7";
                  e.currentTarget.style.outlineOffset = "2px";
                }),
                on("blur", (e) => {
                  e.currentTarget.style.outline = "";
                })
              ]
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
          mix: [
            on("change", (e) => {
              radioValue = e.target.value;
              handle.update();
            }),
            on("focus", (e) => {
              e.currentTarget.style.outline = "2px solid #337ab7";
              e.currentTarget.style.outlineOffset = "2px";
            }),
            on("blur", (e) => {
              e.currentTarget.style.outline = "";
            })
          ],
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
                mix: [
                  on("change", (e) => {
                    toggleValue = e.target.checked;
                    handle.update();
                  }),
                  on("focus", (e) => {
                    e.currentTarget.style.outline = "2px solid #222";
                    e.currentTarget.style.outlineOffset = "2px";
                  }),
                  on("blur", (e) => {
                    e.currentTarget.style.outline = "";
                  })
                ],
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
  return () => /* @__PURE__ */ jsx("div", { class: "container", style: { maxWidth: "1400px" }, children: [
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
              mix: [on("click", handle.props.onSwitchToTable)],
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
                  mix: [on("click", sortDashboardAsc)],
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
                  mix: [on("click", sortDashboardDesc)],
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
              mix: [
                on("click", () => {
                  setSelected(rowId);
                })
              ],
              children: row.label
            }
          ) }),
          /* @__PURE__ */ jsx("td", { class: "col-md-1", children: /* @__PURE__ */ jsx(
            "a",
            {
              mix: [
                on("click", () => {
                  setRows(remove(rows, rowId));
                })
              ],
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
